import {
  TMDBMediaItem,
  MediaType,
  SeasonInfo,
  EpisodeInfo,
  EpisodeDetailedInfo,
  CastMember,
  DetailedMediaInfo,
  PersonSummary,
  PersonFullDetails,
  CompanyFullDetails,
  GenreFullDetails,
  EntityType,
  WatchProvider,
  POPULAR_STREAMING_PROVIDERS,
  MultiDiscoverFilter,
  DiscoverReleaseWindow,
  MediaTrailerInfo,
} from '@/types/media';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface RawPersonResponse {
  id: number;
  name: string;
  biography?: string;
  birthday?: string | null;
  place_of_birth?: string | null;
  deathday?: string | null;
  known_for_department?: string;
  profile_path?: string | null;
  combined_credits?: {
    cast?: (TMDBMediaItem & { character?: string })[];
    crew?: (TMDBMediaItem & { job?: string; department?: string })[];
  };
}

interface RawCompanyResponse {
  id: number;
  name: string;
  description?: string;
  headquarters?: string;
  origin_country?: string;
  logo_path?: string | null;
}

interface RawWatchProviderItem {
  display_priorities?: Record<string, number>;
  display_priority?: number;
  logo_path: string | null;
  provider_name: string;
  provider_id: number;
}

interface RawWatchProviderListResponse {
  results: RawWatchProviderItem[];
}

const watchProvidersListCache: Record<string, WatchProvider[]> = {};

interface RawCreditsResponse {
  tagline?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  number_of_episodes?: number;
  number_of_seasons?: number;
  status?: string;
  origin_country?: string[];
  production_countries?: { iso_3166_1: string; name: string }[];
  release_date?: string;
  first_air_date?: string;
  created_by?: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
  production_companies?: { id: number; name: string; logo_path: string | null }[];
  next_episode_to_air?: {
    id?: number;
    name?: string;
    overview?: string;
    air_date?: string;
    episode_number: number;
    season_number: number;
  } | null;
  release_dates?: {
    results?: {
      iso_3166_1: string;
      release_dates: {
        certification?: string;
        descriptors?: string[];
        iso_639_1?: string;
        note?: string;
        release_date: string;
        type: number;
      }[];
    }[];
  };
  seasons?: {
    season_number: number;
    episode_count: number;
    name: string;
    air_date?: string | null;
    poster_path?: string | null;
    overview?: string;
  }[];
  credits?: {
    cast?: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }[];
    crew?: {
      id: number;
      name: string;
      job: string;
      department: string;
    }[];
  };
  ['watch/providers']?: {
    results?: Record<string, {
      link?: string;
      flatrate?: {
        provider_id: number;
        provider_name: string;
        logo_path: string | null;
        display_priority?: number;
      }[];
      free?: {
        provider_id: number;
        provider_name: string;
        logo_path: string | null;
        display_priority?: number;
      }[];
      ads?: {
        provider_id: number;
        provider_name: string;
        logo_path: string | null;
        display_priority?: number;
      }[];
      rent?: {
        provider_id: number;
        provider_name: string;
        logo_path: string | null;
        display_priority?: number;
      }[];
      buy?: {
        provider_id: number;
        provider_name: string;
        logo_path: string | null;
        display_priority?: number;
      }[];
    }>;
  };
  watch_providers?: {
    results?: Record<string, any>;
  };
}

interface RawPersonCreditsResponse {
  cast?: TMDBMediaItem[];
  crew?: TMDBMediaItem[];
}

function mapGenresForMediaType(genreIds: number[], isTv: boolean): number[] {
  const mapped: number[] = [];
  for (const id of genreIds) {
    if (isTv) {
      if (id === 28 || id === 12) mapped.push(10759);
      else if (id === 878 || id === 14) mapped.push(10765);
      else if (id === 10752) mapped.push(10768);
      else mapped.push(id);
    } else {
      if (id === 10759) mapped.push(28, 12);
      else if (id === 10765) mapped.push(878, 14);
      else if (id === 10768) mapped.push(10752);
      else mapped.push(id);
    }
  }
  return Array.from(new Set(mapped));
}

function resolveReleaseWindowBounds(
  releaseWindow: DiscoverReleaseWindow,
  upcomingOnly: boolean
): { releaseDateMin?: string; releaseDateMax?: string; releaseType?: string } {
  const today = new Date();
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = formatDate(today);

  if (releaseWindow === 'upcoming_30') {
    const d = new Date(today);
    d.setDate(d.getDate() + 30);
    return { releaseDateMin: todayStr, releaseDateMax: formatDate(d) };
  }
  if (releaseWindow === 'upcoming_60') {
    const d = new Date(today);
    d.setDate(d.getDate() + 60);
    return { releaseDateMin: todayStr, releaseDateMax: formatDate(d) };
  }
  if (releaseWindow === 'upcoming_90') {
    const d = new Date(today);
    d.setDate(d.getDate() + 90);
    return { releaseDateMin: todayStr, releaseDateMax: formatDate(d) };
  }
  if (releaseWindow === 'in_theaters') {
    const dMin = new Date(today);
    dMin.setDate(dMin.getDate() - 30);
    const dMax = new Date(today);
    dMax.setDate(dMax.getDate() + 14);
    return {
      releaseDateMin: formatDate(dMin),
      releaseDateMax: formatDate(dMax),
      releaseType: '2|3',
    };
  }
  if (releaseWindow === 'digital_premieres') {
    const dMin = new Date(today);
    dMin.setDate(dMin.getDate() - 14);
    const dMax = new Date(today);
    dMax.setDate(dMax.getDate() + 45);
    return {
      releaseDateMin: formatDate(dMin),
      releaseDateMax: formatDate(dMax),
      releaseType: '4',
    };
  }
  if (upcomingOnly) {
    return { releaseDateMin: todayStr };
  }
  return {};
}

function sortDiscoverResults(
  items: TMDBMediaItem[],
  sortBy: MultiDiscoverFilter['sortBy']
): TMDBMediaItem[] {
  const sorted = [...items];
  if (sortBy === 'vote_average.desc') {
    sorted.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  } else if (sortBy === 'primary_release_date.desc') {
    sorted.sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || '';
      const dateB = b.release_date || b.first_air_date || '';
      return dateB.localeCompare(dateA);
    });
  } else if (sortBy === 'primary_release_date.asc') {
    sorted.sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || '9999-12-31';
      const dateB = b.release_date || b.first_air_date || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  } else {
    sorted.sort((a, b) => (b.popularity || b.vote_count || 0) - (a.popularity || a.vote_count || 0));
  }
  return sorted;
}

function matchesClientFilters(
  item: TMDBMediaItem,
  filter: MultiDiscoverFilter,
  bounds: { releaseDateMin?: string; releaseDateMax?: string }
): boolean {
  const itemMediaType: MediaType = item.media_type || (item.title ? 'movie' : 'tv');
  if (filter.mediaType !== 'all' && itemMediaType !== filter.mediaType) {
    return false;
  }

  if (bounds.releaseDateMin || bounds.releaseDateMax) {
    const dateStr = item.release_date || item.first_air_date;
    if (!dateStr) return false;
    if (bounds.releaseDateMin && dateStr < bounds.releaseDateMin) return false;
    if (bounds.releaseDateMax && dateStr > bounds.releaseDateMax) return false;
  }

  if (filter.selectedGenres.length > 0) {
    const mappedGenres = mapGenresForMediaType(filter.selectedGenres, itemMediaType === 'tv');
    const itemGenres = item.genre_ids || [];
    if (!mappedGenres.some((g) => itemGenres.includes(g))) {
      return false;
    }
  }

  if (filter.selectedCountries && filter.selectedCountries.length > 0) {
    if (Array.isArray(item.origin_country) && item.origin_country.length > 0) {
      const selectedUpper = filter.selectedCountries.map((c) => c.toUpperCase());
      if (!item.origin_country.some((c) => selectedUpper.includes(c.toUpperCase()))) {
        return false;
      }
    }
  }

  if (filter.minRating > 0 && (item.vote_average || 0) < filter.minRating) {
    return false;
  }

  return true;
}

function deduplicateMediaItems(items: TMDBMediaItem[]): TMDBMediaItem[] {
  const map = new Map<string, TMDBMediaItem>();
  for (const item of items) {
    const type: MediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const key = `${type}-${item.id}`;
    if (!map.has(key)) {
      map.set(key, { ...item, media_type: type });
    }
  }
  return Array.from(map.values());
}

export const TMDBService = {
  getImageUrl(
    path: string | null | undefined,
    size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'original' = 'w342'
  ): string | null {
    if (!path) return null;
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  async request<T>(endpoint: string, apiKey: string, params: Record<string, string | number> = {}): Promise<T> {
    if (!apiKey) {
      throw new Error('TMDB API Key is required. Please set it in Settings.');
    }

    const cleanKey = apiKey.trim();
    const isBearer = cleanKey.startsWith('eyJ') || cleanKey.length > 50;

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

    if (!isBearer) {
      url.searchParams.set('api_key', cleanKey);
    }

    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, String(v));
    });

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (isBearer) {
      headers.Authorization = `Bearer ${cleanKey}`;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid TMDB API Key. Please verify your key in Settings.');
      }
      throw new Error(`TMDB error (${response.status}): ${response.statusText}`);
    }

    return (await response.json()) as T;
  },

  async testApiKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
    try {
      await this.request<{ images: unknown }>('/configuration', apiKey);
      return { valid: true, message: 'API Key is valid!' };
    } catch (e: unknown) {
      const err = e as Error;
      return { valid: false, message: err?.message || 'Failed to authenticate with TMDB.' };
    }
  },

  async searchMulti(
    query: string,
    apiKey: string,
    page: number = 1
  ): Promise<TMDBMediaItem[]> {
    if (!query.trim()) return [];

    const data = await this.request<TMDBResponse<TMDBMediaItem>>('/search/multi', apiKey, {
      query: query.trim(),
      page,
      include_adult: 'false',
    });

    return (data.results || []).filter(
      (item) => item.media_type === 'movie' || item.media_type === 'tv'
    );
  },

  async searchByType(
    query: string,
    type: MediaType,
    apiKey: string,
    page: number = 1
  ): Promise<TMDBMediaItem[]> {
    if (!query.trim()) return [];

    const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
    const data = await this.request<TMDBResponse<TMDBMediaItem>>(endpoint, apiKey, {
      query: query.trim(),
      page,
      include_adult: 'false',
    });

    return (data.results || []).map((item) => ({
      ...item,
      media_type: type,
    }));
  },

  async getTrending(
    mediaType: 'all' | 'movie' | 'tv' = 'all',
    apiKey: string,
    timeWindow: 'day' | 'week' = 'day'
  ): Promise<TMDBMediaItem[]> {
    const data = await this.request<TMDBResponse<TMDBMediaItem>>(
      `/trending/${mediaType}/${timeWindow}`,
      apiKey
    );

    return (data.results || [])
      .filter((item) => {
        const type = item.media_type || (mediaType === 'all' ? undefined : mediaType);
        return type === 'movie' || type === 'tv';
      })
      .map((item) => ({
        ...item,
        media_type: item.media_type || (mediaType === 'movie' ? 'movie' : 'tv'),
      }));
  },

  async getPopular(type: MediaType, apiKey: string): Promise<TMDBMediaItem[]> {
    const endpoint = type === 'movie' ? '/movie/popular' : '/tv/popular';
    const data = await this.request<TMDBResponse<TMDBMediaItem>>(endpoint, apiKey, {
      page: 1,
    });

    return (data.results || []).map((item) => ({
      ...item,
      media_type: type,
    }));
  },

  async getMediaDetails(
    id: number,
    type: MediaType,
    apiKey: string,
    targetRegion: string = 'US'
  ): Promise<DetailedMediaInfo> {
    try {
      const endpoint = type === 'movie' ? `/movie/${id}` : `/tv/${id}`;
      const append = type === 'movie' ? 'credits,release_dates,watch/providers' : 'credits,watch/providers';
      const data = await this.request<RawCreditsResponse>(endpoint, apiKey, {
        append_to_response: append,
      });

      const cast = (data.credits?.cast || []).slice(0, 50).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
      }));

      const directors: PersonSummary[] = (data.credits?.crew || [])
        .filter((c) => c.job === 'Director')
        .map((c) => ({ id: c.id, name: c.name, role: 'Director' }));

      const creators: PersonSummary[] = (data.created_by || []).map((c) => ({
        id: c.id,
        name: c.name,
        role: 'Creator',
      }));

      const writers: PersonSummary[] = (data.credits?.crew || [])
        .filter(
          (c) =>
            c.department === 'Writing' ||
            c.job === 'Writer' ||
            c.job === 'Screenplay' ||
            c.job === 'Story'
        )
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, role: c.job || 'Writer' }));

      const studios = (data.production_companies || []).slice(0, 4).map((p) => ({
        id: p.id,
        name: p.name,
        logoPath: p.logo_path,
      }));

      const networks = (data.networks || []).slice(0, 3).map((n) => ({
        id: n.id,
        name: n.name,
        logoPath: n.logo_path,
      }));

      const rawSeasons = data.seasons || [];
      const seasons: SeasonInfo[] = rawSeasons
        .filter((s) => s.season_number >= 0)
        .map((s) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
          name: s.name || (s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`),
          airDate: s.air_date,
          posterPath: s.poster_path,
          overview: s.overview,
        }));

      // Parse regional release date for movies
      let regionalReleaseDate: string | undefined;
      let regionalReleaseType: string | undefined;

      if (type === 'movie' && data.release_dates?.results) {
        const normRegion = targetRegion.toUpperCase();
        const results = data.release_dates.results;
        // First try selected region, then fallback to 'US'
        const regionMatch =
          results.find((r) => r.iso_3166_1.toUpperCase() === normRegion) ||
          (normRegion !== 'US' ? results.find((r) => r.iso_3166_1.toUpperCase() === 'US') : undefined);

        if (regionMatch && regionMatch.release_dates?.length > 0) {
          // Priority: 3 (Theatrical), 4 (Digital), 1 (Premiere), 2 (Theatrical Ltd), any
          const sorted = [...regionMatch.release_dates].sort((a, b) => {
            const getPriority = (t: number) => {
              if (t === 3) return 1;
              if (t === 4) return 2;
              if (t === 1) return 3;
              if (t === 2) return 4;
              return 5;
            };
            return getPriority(a.type) - getPriority(b.type);
          });
          const picked = sorted[0];
          if (picked && picked.release_date) {
            regionalReleaseDate = picked.release_date.split('T')[0];
            const typeLabels: Record<number, string> = {
              1: 'Premiere',
              2: 'Theatrical (Ltd)',
              3: 'Theatrical',
              4: 'Digital',
              5: 'Physical',
              6: 'TV',
            };
            regionalReleaseType = typeLabels[picked.type] || 'Release';
          }
        }
      }

      // Parse TV next episode
      let nextAirDate: string | undefined;
      let nextEpisode: DetailedMediaInfo['nextEpisode'];

      if (type === 'tv' && data.next_episode_to_air) {
        nextAirDate = data.next_episode_to_air.air_date || undefined;
        nextEpisode = {
          seasonNumber: data.next_episode_to_air.season_number,
          episodeNumber: data.next_episode_to_air.episode_number,
          name: data.next_episode_to_air.name,
          airDate: data.next_episode_to_air.air_date,
        };
      }

      // Parse watch providers for all regions
      const rawProviders = data['watch/providers']?.results || data.watch_providers?.results;
      let watchProviders: DetailedMediaInfo['watchProviders'];

      if (rawProviders && typeof rawProviders === 'object') {
        watchProviders = {};
        for (const [countryCode, provData] of Object.entries(rawProviders)) {
          if (!provData || typeof provData !== 'object') continue;
          const mapList = (list: any[] | undefined): WatchProvider[] | undefined => {
            if (!Array.isArray(list) || list.length === 0) return undefined;
            return list.map((p) => ({
              id: p.provider_id,
              name: p.provider_name,
              logoPath: p.logo_path || null,
              displayPriority: p.display_priority,
            }));
          };

          watchProviders[countryCode.toUpperCase()] = {
            link: provData.link,
            flatrate: mapList(provData.flatrate),
            free: mapList(provData.free),
            ads: mapList(provData.ads),
            rent: mapList(provData.rent),
            buy: mapList(provData.buy),
          };
        }
      }

      // Parse origin country
      const rawOriginList: string[] = Array.isArray(data.origin_country)
        ? data.origin_country
        : Array.isArray(data.production_countries)
        ? data.production_countries.map((p) => p.iso_3166_1).filter(Boolean)
        : [];
      const networkOrigin = (data.networks?.[0] as any)?.origin_country || undefined;
      let originCountry = rawOriginList[0] || networkOrigin || undefined;

      // If Japan is in origin list and it is an animation or Japanese studio co-production, prioritize JP
      if (rawOriginList.includes('JP') && ((data.genres || []).some((g: any) => g.name === 'Animation') || studios.some((s) => s.name?.toLowerCase().includes('trigger')))) {
        originCountry = 'JP';
      }

      const originCountries = rawOriginList.length > 0 ? rawOriginList : originCountry ? [originCountry] : undefined;

      return {
        originCountry,
        originCountries,
        runtime: data.runtime || undefined,
        numberOfEpisodes: data.number_of_episodes || undefined,
        numberOfSeasons: data.number_of_seasons || undefined,
        seasons: seasons.length > 0 ? seasons : undefined,
        tagline: data.tagline || undefined,
        genres: data.genres || [],
        cast: cast.length > 0 ? cast : undefined,
        directors: directors.length > 0 ? directors : undefined,
        creators: creators.length > 0 ? creators : undefined,
        writers: writers.length > 0 ? writers : undefined,
        studios: studios.length > 0 ? studios : undefined,
        networks: networks.length > 0 ? networks : undefined,
        status: data.status,
        releaseDate: data.release_date || data.first_air_date || undefined,
        regionalReleaseDate,
        regionalReleaseType,
        nextAirDate,
        nextEpisode,
        watchProviders,
      };
    } catch (e) {
      console.warn('Failed to fetch detailed media info from TMDB', e);
      return {};
    }
  },

  async getSeasonEpisodes(
    tvId: number,
    seasonNumber: number,
    apiKey: string
  ): Promise<EpisodeInfo[]> {
    try {
      const endpoint = `/tv/${tvId}/season/${seasonNumber}`;
      interface RawSeasonResponse {
        episodes: {
          episode_number: number;
          name: string;
          overview?: string;
          air_date?: string | null;
          runtime?: number | null;
          still_path?: string | null;
          vote_average?: number;
        }[];
      }
      const data = await this.request<RawSeasonResponse>(endpoint, apiKey);
      return (data.episodes || []).map((ep) => ({
        episodeNumber: ep.episode_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview,
        airDate: ep.air_date,
        runtime: ep.runtime,
        stillPath: ep.still_path,
        voteAverage: ep.vote_average,
      }));
    } catch (e) {
      console.warn(`Failed to fetch season ${seasonNumber} episodes`, e);
      return [];
    }
  },

  async getSeasonDetails(
    tvId: number,
    seasonNumber: number,
    apiKey: string
  ): Promise<{
    seasonNumber: number;
    name: string;
    overview?: string;
    posterPath?: string | null;
    airDate?: string | null;
    episodes: EpisodeInfo[];
  } | null> {
    try {
      const endpoint = `/tv/${tvId}/season/${seasonNumber}`;
      interface RawSeasonDetailResponse {
        season_number: number;
        name: string;
        overview?: string;
        poster_path?: string | null;
        air_date?: string | null;
        episodes: {
          episode_number: number;
          name: string;
          overview?: string;
          air_date?: string | null;
          runtime?: number | null;
          still_path?: string | null;
          vote_average?: number;
        }[];
      }
      const data = await this.request<RawSeasonDetailResponse>(endpoint, apiKey);
      return {
        seasonNumber: data.season_number ?? seasonNumber,
        name: data.name || (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`),
        overview: data.overview,
        posterPath: data.poster_path,
        airDate: data.air_date,
        episodes: (data.episodes || []).map((ep) => ({
          episodeNumber: ep.episode_number,
          name: ep.name || `Episode ${ep.episode_number}`,
          overview: ep.overview,
          airDate: ep.air_date,
          runtime: ep.runtime,
          stillPath: ep.still_path,
          voteAverage: ep.vote_average,
        })),
      };
    } catch (e) {
      console.warn(`Failed to fetch season ${seasonNumber} details`, e);
      return null;
    }
  },

  async getEpisodeDetails(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
    apiKey: string
  ): Promise<EpisodeDetailedInfo | null> {
    try {
      const endpoint = `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`;
      interface RawEpisodeResponse {
        episode_number: number;
        name: string;
        overview?: string;
        air_date?: string | null;
        runtime?: number | null;
        still_path?: string | null;
        vote_average?: number;
        guest_stars?: {
          id: number;
          name: string;
          character: string;
          profile_path: string | null;
        }[];
        crew?: {
          id: number;
          name: string;
          job: string;
          department: string;
          profile_path?: string | null;
        }[];
      }
      const data = await this.request<RawEpisodeResponse>(endpoint, apiKey, {
        append_to_response: 'credits',
      });

      const guestStars: CastMember[] = (data.guest_stars || []).map((g) => ({
        id: g.id,
        name: g.name,
        character: g.character,
        profilePath: g.profile_path,
      }));

      const directors: PersonSummary[] = (data.crew || [])
        .filter((c) => c.job === 'Director')
        .map((c) => ({ id: c.id, name: c.name, role: 'Director' }));

      const writers: PersonSummary[] = (data.crew || [])
        .filter(
          (c) =>
            c.department === 'Writing' ||
            c.job === 'Writer' ||
            c.job === 'Teleplay by' ||
            c.job === 'Story by'
        )
        .map((c) => ({ id: c.id, name: c.name, role: c.job || 'Writer' }));

      return {
        episodeNumber: data.episode_number,
        name: data.name || `Episode ${data.episode_number}`,
        overview: data.overview,
        airDate: data.air_date,
        runtime: data.runtime,
        stillPath: data.still_path,
        voteAverage: data.vote_average,
        guestStars,
        directors,
        writers,
      };
    } catch (e) {
      console.warn(`Failed to fetch episode details for S${seasonNumber}E${episodeNumber}`, e);
      return null;
    }
  },

  async getPersonDetails(personId: number, apiKey: string): Promise<PersonFullDetails> {
    try {
      const data = await this.request<RawPersonResponse>(`/person/${personId}`, apiKey, {
        append_to_response: 'combined_credits',
      });

      const rawItems = [
        ...(data.combined_credits?.cast || []),
        ...(data.combined_credits?.crew || []),
      ];

      const seen = new Set<number>();
      const knownWorks: TMDBMediaItem[] = [];
      for (const item of rawItems) {
        if (!seen.has(item.id) && (item.poster_path || item.backdrop_path)) {
          seen.add(item.id);
          knownWorks.push({
            ...item,
            media_type: item.media_type || (item.title ? 'movie' : 'tv'),
          });
        }
      }
      knownWorks.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

      return {
        id: data.id,
        name: data.name,
        biography: data.biography,
        birthday: data.birthday,
        placeOfBirth: data.place_of_birth,
        deathday: data.deathday,
        knownForDepartment: data.known_for_department,
        profilePath: data.profile_path,
        knownWorks: knownWorks.slice(0, 20),
      };
    } catch (e) {
      console.warn(`Failed to fetch person details for ${personId}`, e);
      return { id: personId, name: 'Person Details' };
    }
  },

  async getCompanyDetails(companyId: number, apiKey: string): Promise<CompanyFullDetails> {
    try {
      const data = await this.request<RawCompanyResponse>(`/company/${companyId}`, apiKey);

      const [moviesRes, tvRes] = await Promise.allSettled([
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/movie', apiKey, {
          with_companies: companyId,
          sort_by: 'popularity.desc',
        }),
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/tv', apiKey, {
          with_companies: companyId,
          sort_by: 'popularity.desc',
        }),
      ]);

      const movies = moviesRes.status === 'fulfilled' ? (moviesRes.value.results || []).map(m => ({ ...m, media_type: 'movie' as MediaType })) : [];
      const tv = tvRes.status === 'fulfilled' ? (tvRes.value.results || []).map(t => ({ ...t, media_type: 'tv' as MediaType })) : [];

      const combined = [...movies, ...tv].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)).slice(0, 20);

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        headquarters: data.headquarters,
        originCountry: data.origin_country,
        logoPath: data.logo_path,
        knownWorks: combined,
      };
    } catch (e) {
      console.warn(`Failed to fetch company details for ${companyId}`, e);
      return { id: companyId, name: 'Studio Details' };
    }
  },

  async getGenreDetails(genreId: number, genreName: string, apiKey: string): Promise<GenreFullDetails> {
    try {
      const [moviesRes, tvRes] = await Promise.allSettled([
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/movie', apiKey, {
          with_genres: genreId,
          sort_by: 'popularity.desc',
        }),
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/tv', apiKey, {
          with_genres: genreId,
          sort_by: 'popularity.desc',
        }),
      ]);

      const movies = moviesRes.status === 'fulfilled' ? (moviesRes.value.results || []).map(m => ({ ...m, media_type: 'movie' as MediaType })) : [];
      const tv = tvRes.status === 'fulfilled' ? (tvRes.value.results || []).map(t => ({ ...t, media_type: 'tv' as MediaType })) : [];

      const combined = [...movies, ...tv].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)).slice(0, 20);

      return {
        id: genreId,
        name: genreName,
        knownWorks: combined,
      };
    } catch (e) {
      console.warn(`Failed to fetch genre details for ${genreId}`, e);
      return { id: genreId, name: genreName };
    }
  },

  async fetchPeopleCredits(
    peopleIds: number[],
    apiKey: string,
    mediaFilter: 'all' | 'movie' | 'tv' = 'all'
  ): Promise<TMDBMediaItem[]> {
    if (!apiKey || peopleIds.length === 0) return [];

    const endpointSuffix = mediaFilter === 'tv' ? 'tv_credits' : 'combined_credits';
    const responses = await Promise.allSettled(
      peopleIds.map((id) =>
        this.request<RawPersonCreditsResponse>(`/person/${id}/${endpointSuffix}`, apiKey)
      )
    );

    const collected: TMDBMediaItem[] = [];
    for (const res of responses) {
      if (res.status !== 'fulfilled') continue;
      const rawList = [...(res.value.cast || []), ...(res.value.crew || [])];
      for (const item of rawList) {
        const resolvedType: MediaType | undefined =
          mediaFilter === 'tv'
            ? 'tv'
            : item.media_type === 'movie' || item.media_type === 'tv'
            ? item.media_type
            : item.title
            ? 'movie'
            : item.name
            ? 'tv'
            : undefined;
        if (!resolvedType) continue;
        if (mediaFilter !== 'all' && resolvedType !== mediaFilter) continue;
        collected.push({ ...item, media_type: resolvedType });
      }
    }

    return deduplicateMediaItems(collected);
  },

  async discoverByEntity(
    entityType: EntityType,
    entityId: number | string,
    apiKey: string,
    page: number = 1,
    watchRegion?: string,
    mediaTypeFilter: 'all' | 'movie' | 'tv' = 'all'
  ): Promise<TMDBMediaItem[]> {
    try {
      if (entityType === 'person') {
        const personIdNum = Number(entityId);
        const moviePromise =
          mediaTypeFilter !== 'tv'
            ? this.request<TMDBResponse<TMDBMediaItem>>('/discover/movie', apiKey, {
                page,
                sort_by: 'popularity.desc',
                with_people: entityId,
              })
            : Promise.resolve(null);

        const tvPromise =
          mediaTypeFilter !== 'movie' && page === 1 && !Number.isNaN(personIdNum)
            ? this.fetchPeopleCredits([personIdNum], apiKey, 'tv')
            : Promise.resolve([]);

        const [moviesSettled, tvSettled] = await Promise.allSettled([moviePromise, tvPromise]);
        const movies =
          moviesSettled.status === 'fulfilled' && moviesSettled.value
            ? (moviesSettled.value.results || []).map((m) => ({ ...m, media_type: 'movie' as MediaType }))
            : [];
        const tvs = tvSettled.status === 'fulfilled' ? tvSettled.value : [];

        return deduplicateMediaItems([...movies, ...tvs]).sort(
          (a, b) => (b.vote_count || 0) - (a.vote_count || 0)
        );
      }

      const buildEntityParams = (isTv: boolean): Record<string, string | number> => {
        const params: Record<string, string | number> = {
          page,
          sort_by: 'popularity.desc',
        };
        if (entityType === 'country') {
          params.with_origin_country = String(entityId).toUpperCase();
        } else if (entityType === 'company' || entityType === 'network') {
          params.with_companies = entityId;
        } else if (entityType === 'genre') {
          const mapped = mapGenresForMediaType([Number(entityId)], isTv);
          params.with_genres = mapped.join(',');
        } else if (entityType === 'provider') {
          params.with_watch_providers = entityId;
          if (watchRegion && watchRegion !== 'ALL') {
            params.watch_region = watchRegion;
          }
        }
        return params;
      };

      const [moviesRes, tvRes] = await Promise.allSettled([
        mediaTypeFilter !== 'tv'
          ? this.request<TMDBResponse<TMDBMediaItem>>('/discover/movie', apiKey, buildEntityParams(false))
          : Promise.resolve(null),
        mediaTypeFilter !== 'movie'
          ? this.request<TMDBResponse<TMDBMediaItem>>('/discover/tv', apiKey, buildEntityParams(true))
          : Promise.resolve(null),
      ]);

      const movies =
        moviesRes.status === 'fulfilled' && moviesRes.value
          ? (moviesRes.value.results || []).map((m) => ({ ...m, media_type: 'movie' as MediaType }))
          : [];
      const tv =
        tvRes.status === 'fulfilled' && tvRes.value
          ? (tvRes.value.results || []).map((t) => ({ ...t, media_type: 'tv' as MediaType }))
          : [];

      return deduplicateMediaItems([...movies, ...tv]).sort(
        (a, b) => (b.vote_count || 0) - (a.vote_count || 0)
      );
    } catch (e) {
      console.warn(`Failed to discover by entity ${entityType} ${entityId}`, e);
      return [];
    }
  },

  async getWatchProvidersList(
    apiKey: string,
    watchRegion?: string
  ): Promise<WatchProvider[]> {
    if (!apiKey) {
      return POPULAR_STREAMING_PROVIDERS.map((p) => ({
        id: p.id,
        name: p.name,
        logoPath: p.logoPath,
      }));
    }

    const normRegion = watchRegion ? watchRegion.trim().toUpperCase() : undefined;
    const cacheKey = normRegion || 'ALL_WORLDWIDE';

    if (watchProvidersListCache[cacheKey] && watchProvidersListCache[cacheKey].length > 0) {
      return watchProvidersListCache[cacheKey];
    }

    try {
      const params: Record<string, string | number> = {};
      if (normRegion) {
        params.watch_region = normRegion;
      }

      const [movieRes, tvRes] = await Promise.allSettled([
        this.request<RawWatchProviderListResponse>('/watch/providers/movie', apiKey, params),
        this.request<RawWatchProviderListResponse>('/watch/providers/tv', apiKey, params),
      ]);

      const movieItems = movieRes.status === 'fulfilled' ? movieRes.value.results || [] : [];
      const tvItems = tvRes.status === 'fulfilled' ? tvRes.value.results || [] : [];

      const map = new Map<number, WatchProvider>();

      for (const item of [...movieItems, ...tvItems]) {
        if (!map.has(item.provider_id)) {
          map.set(item.provider_id, {
            id: item.provider_id,
            name: item.provider_name,
            logoPath: item.logo_path,
            displayPriority: item.display_priority,
            displayPriorities: item.display_priorities,
          });
        } else {
          const existing = map.get(item.provider_id)!;
          if (!existing.logoPath && item.logo_path) {
            existing.logoPath = item.logo_path;
          }
          if (item.display_priorities) {
            existing.displayPriorities = {
              ...(existing.displayPriorities || {}),
              ...item.display_priorities,
            };
          }
        }
      }

      const providers = Array.from(map.values());

      if (normRegion) {
        providers.sort((a, b) => {
          const prioA = a.displayPriorities?.[normRegion] ?? a.displayPriority ?? 999;
          const prioB = b.displayPriorities?.[normRegion] ?? b.displayPriority ?? 999;
          if (prioA !== prioB) return prioA - prioB;
          return a.name.localeCompare(b.name);
        });
      } else {
        providers.sort((a, b) => a.name.localeCompare(b.name));
      }

      if (providers.length > 0) {
        watchProvidersListCache[cacheKey] = providers;
        return providers;
      }
    } catch (e) {
      console.warn(`Failed to fetch watch providers for region ${watchRegion}`, e);
    }

    return POPULAR_STREAMING_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      logoPath: p.logoPath,
    }));
  },

  getCachedProvider(providerId: number): WatchProvider | undefined {
    for (const list of Object.values(watchProvidersListCache)) {
      const found = list.find((p) => p.id === providerId);
      if (found) return found;
    }
    const pop = POPULAR_STREAMING_PROVIDERS.find((p) => p.id === providerId);
    if (pop) return { id: pop.id, name: pop.name, logoPath: pop.logoPath };
    return undefined;
  },

  async searchPeople(
    query: string,
    apiKey: string
  ): Promise<{ id: number; name: string; profilePath: string | null; department?: string }[]> {
    if (!query.trim() || !apiKey) return [];
    try {
      const data = await this.request<
        TMDBResponse<{
          id: number;
          name: string;
          profile_path: string | null;
          known_for_department?: string;
        }>
      >('/search/person', apiKey, { query: query.trim() });
      return (data.results || []).slice(0, 15).map((p) => ({
        id: p.id,
        name: p.name,
        profilePath: p.profile_path,
        department: p.known_for_department,
      }));
    } catch {
      return [];
    }
  },

  async searchCompanies(
    query: string,
    apiKey: string
  ): Promise<{ id: number; name: string; logoPath: string | null }[]> {
    if (!query.trim() || !apiKey) return [];
    try {
      const data = await this.request<
        TMDBResponse<{
          id: number;
          name: string;
          logo_path: string | null;
        }>
      >('/search/company', apiKey, { query: query.trim() });
      return (data.results || []).slice(0, 15).map((c) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path,
      }));
    } catch {
      return [];
    }
  },

  async advancedDiscover(
    filter: MultiDiscoverFilter,
    apiKey: string,
    page = 1,
    userRegion = 'US',
    userSubscribedProviders: number[] = [],
    options: { upcomingOnly?: boolean } = {}
  ): Promise<{ results: TMDBMediaItem[]; totalPages: number }> {
    if (!apiKey) {
      return { results: [], totalPages: 0 };
    }

    try {
      const bounds = resolveReleaseWindowBounds(
        filter.releaseWindow,
        Boolean(options.upcomingOnly)
      );

      // Provider IDs resolution
      let providerIds: number[] = [];
      if (filter.providerScope === 'subscribed') {
        providerIds = userSubscribedProviders;
      } else if (filter.providerScope === 'region' || filter.providerScope === 'worldwide') {
        providerIds = filter.selectedProviders;
      }

      const effectiveRegion = userRegion && userRegion !== 'ALL' ? userRegion : 'US';

      // Base query params builder
      const buildParams = (isTv: boolean): Record<string, string | number> => {
        const params: Record<string, string | number> = {
          page,
        };

        // Sort by
        if (isTv) {
          if (filter.sortBy === 'primary_release_date.desc') {
            params.sort_by = 'first_air_date.desc';
          } else if (filter.sortBy === 'primary_release_date.asc') {
            params.sort_by = 'first_air_date.asc';
          } else {
            params.sort_by = filter.sortBy;
          }
        } else {
          params.sort_by = filter.sortBy;
        }

        // Release dates
        if (bounds.releaseDateMin) {
          if (isTv) {
            params['first_air_date.gte'] = bounds.releaseDateMin;
          } else {
            params['primary_release_date.gte'] = bounds.releaseDateMin;
          }
        }
        if (bounds.releaseDateMax) {
          if (isTv) {
            params['first_air_date.lte'] = bounds.releaseDateMax;
          } else {
            params['primary_release_date.lte'] = bounds.releaseDateMax;
          }
        }
        if (!isTv && bounds.releaseType) {
          params.with_release_type = bounds.releaseType;
        }

        // Streaming providers
        if (providerIds.length > 0) {
          params.with_watch_providers = providerIds.join('|');
          params.watch_region = effectiveRegion;
          params.with_watch_monetization_types = 'flatrate|free|ads';
        }

        // Genres (mapped cleanly for Movies vs TV)
        if (filter.selectedGenres.length > 0) {
          const mappedGenres = mapGenresForMediaType(filter.selectedGenres, isTv);
          if (mappedGenres.length > 0) {
            params.with_genres = mappedGenres.join('|');
          }
        }

        // Min rating
        if (filter.minRating > 0) {
          params['vote_average.gte'] = filter.minRating;
          params['vote_count.gte'] = 20;
        }

        // People (/discover/movie supports with_people; /discover/tv ignores it)
        if (!isTv && filter.selectedPeople.length > 0) {
          params.with_people = filter.selectedPeople.map((p) => p.id).join('|');
        }

        // Studios / Companies
        if (filter.selectedCompanies.length > 0) {
          params.with_companies = filter.selectedCompanies.map((c) => c.id).join('|');
        }

        // Origin Country
        if (filter.selectedCountries && filter.selectedCountries.length > 0) {
          params.with_origin_country = filter.selectedCountries.join('|');
        }

        return params;
      };

      // When filtering by cast/directors, TMDB /discover/tv ignores with_people, so use person TV credits
      if (filter.selectedPeople.length > 0) {
        const peopleIds = filter.selectedPeople.map((p) => p.id);

        if (filter.mediaType === 'tv') {
          if (page > 1) {
            return { results: [], totalPages: 1 };
          }
          const tvCredits = await this.fetchPeopleCredits(peopleIds, apiKey, 'tv');
          const filteredTv = tvCredits.filter((item) => matchesClientFilters(item, filter, bounds));
          return {
            results: sortDiscoverResults(filteredTv, filter.sortBy),
            totalPages: 1,
          };
        }

        if (filter.mediaType === 'movie') {
          const movieRes = await this.request<TMDBResponse<TMDBMediaItem>>(
            '/discover/movie',
            apiKey,
            buildParams(false)
          );
          return {
            results: (movieRes.results || []).map((m) => ({ ...m, media_type: 'movie' as MediaType })),
            totalPages: movieRes.total_pages || 1,
          };
        }

        const [movieSettled, tvSettled] = await Promise.allSettled([
          this.request<TMDBResponse<TMDBMediaItem>>('/discover/movie', apiKey, buildParams(false)),
          page === 1 ? this.fetchPeopleCredits(peopleIds, apiKey, 'tv') : Promise.resolve([]),
        ]);

        const movies =
          movieSettled.status === 'fulfilled'
            ? (movieSettled.value.results || []).map((m) => ({ ...m, media_type: 'movie' as MediaType }))
            : [];
        const tvs =
          tvSettled.status === 'fulfilled'
            ? tvSettled.value.filter((item) => matchesClientFilters(item, filter, bounds))
            : [];

        const moviePages = movieSettled.status === 'fulfilled' ? movieSettled.value.total_pages || 1 : 1;
        const merged = deduplicateMediaItems([...movies, ...tvs]);
        return {
          results: sortDiscoverResults(merged, filter.sortBy),
          totalPages: moviePages,
        };
      }

      if (filter.mediaType === 'movie') {
        const movieRes = await this.request<TMDBResponse<TMDBMediaItem>>(
          '/discover/movie',
          apiKey,
          buildParams(false)
        );
        return {
          results: (movieRes.results || []).map((m) => ({ ...m, media_type: 'movie' as MediaType })),
          totalPages: movieRes.total_pages || 1,
        };
      }

      if (filter.mediaType === 'tv') {
        const tvRes = await this.request<TMDBResponse<TMDBMediaItem>>(
          '/discover/tv',
          apiKey,
          buildParams(true)
        );
        return {
          results: (tvRes.results || []).map((t) => ({ ...t, media_type: 'tv' as MediaType })),
          totalPages: tvRes.total_pages || 1,
        };
      }

      // Both Movie and TV (mediaType === 'all')
      const [movieSettled, tvSettled] = await Promise.allSettled([
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/movie', apiKey, buildParams(false)),
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/tv', apiKey, buildParams(true)),
      ]);

      const movies =
        movieSettled.status === 'fulfilled'
          ? (movieSettled.value.results || []).map((m) => ({ ...m, media_type: 'movie' as MediaType }))
          : [];
      const tvs =
        tvSettled.status === 'fulfilled'
          ? (tvSettled.value.results || []).map((t) => ({ ...t, media_type: 'tv' as MediaType }))
          : [];

      const moviePages = movieSettled.status === 'fulfilled' ? movieSettled.value.total_pages : 1;
      const tvPages = tvSettled.status === 'fulfilled' ? tvSettled.value.total_pages : 1;
      const totalPages = Math.max(moviePages, tvPages);

      const merged = deduplicateMediaItems([...movies, ...tvs]);
      return { results: sortDiscoverResults(merged, filter.sortBy), totalPages };
    } catch (e) {
      console.warn('Advanced discover query failed', e);
      return { results: [], totalPages: 0 };
    }
  },

  async searchWithFilters(
    query: string,
    filter: MultiDiscoverFilter,
    apiKey: string,
    userRegion = 'US',
    userSubscribedProviders: number[] = []
  ): Promise<TMDBMediaItem[]> {
    const q = query.trim().toLowerCase();
    if (!q || !apiKey) return [];

    try {
      const bounds = resolveReleaseWindowBounds(filter.releaseWindow, false);
      const matchesQuery = (item: TMDBMediaItem) =>
        [item.title, item.name, item.original_title, item.original_name].some((s) =>
          Boolean(s && s.toLowerCase().includes(q))
        );

      // Case A: Person filter active alongside search query
      if (filter.selectedPeople.length > 0) {
        const peopleIds = filter.selectedPeople.map((p) => p.id);
        const searchPromise =
          filter.mediaType === 'all'
            ? this.searchMulti(query, apiKey, 1)
            : this.searchByType(query, filter.mediaType, apiKey, 1);

        const [peopleCredits, searchResults] = await Promise.all([
          this.fetchPeopleCredits(peopleIds, apiKey, filter.mediaType),
          searchPromise,
        ]);

        const creditKeys = new Set(
          peopleCredits.map((item) => `${item.media_type || (item.title ? 'movie' : 'tv')}-${item.id}`)
        );

        const matchedFromCredits = peopleCredits.filter((item) => matchesQuery(item));
        const matchedFromSearch = searchResults.filter((item) => {
          const type = item.media_type || (item.title ? 'movie' : 'tv');
          return creditKeys.has(`${type}-${item.id}`) && matchesQuery(item);
        });

        const filtered = deduplicateMediaItems([...matchedFromCredits, ...matchedFromSearch]).filter(
          (item) => matchesClientFilters(item, filter, bounds)
        );
        return sortDiscoverResults(filtered, filter.sortBy);
      }

      // Case B: Studio / Streaming Provider filters active alongside search query
      if (filter.selectedCompanies.length > 0 || filter.providerScope !== 'none') {
        const page1 = await this.advancedDiscover(
          filter,
          apiKey,
          1,
          userRegion,
          userSubscribedProviders,
          { upcomingOnly: false }
        );

        const extraPagesCount = Math.min(page1.totalPages || 1, 3);
        let extraResults: TMDBMediaItem[] = [];
        if (extraPagesCount >= 2) {
          const extraPromises: Promise<{ results: TMDBMediaItem[]; totalPages: number }>[] = [];
          for (let p = 2; p <= extraPagesCount; p++) {
            extraPromises.push(
              this.advancedDiscover(filter, apiKey, p, userRegion, userSubscribedProviders, {
                upcomingOnly: false,
              })
            );
          }
          const extraSettled = await Promise.allSettled(extraPromises);
          for (const res of extraSettled) {
            if (res.status === 'fulfilled') {
              extraResults = extraResults.concat(res.value.results);
            }
          }
        }

        const matched = deduplicateMediaItems([...page1.results, ...extraResults]).filter(
          (item) => matchesQuery(item) && matchesClientFilters(item, filter, bounds)
        );
        return sortDiscoverResults(matched, filter.sortBy);
      }

      // Case C: Genre / Country / MinRating / ReleaseWindow / SortBy filters alongside search query
      const fetchSearchPage = (pageNum: number) =>
        filter.mediaType === 'all'
          ? this.searchMulti(query, apiKey, pageNum)
          : this.searchByType(query, filter.mediaType, apiKey, pageNum);

      const page1 = await fetchSearchPage(1);
      let combined = deduplicateMediaItems(page1).filter((item) =>
        matchesClientFilters(item, filter, bounds)
      );

      if (combined.length < 10 && page1.length > 0) {
        const page2 = await fetchSearchPage(2);
        combined = deduplicateMediaItems([...combined, ...page2]).filter((item) =>
          matchesClientFilters(item, filter, bounds)
        );
      }

      return filter.sortBy !== 'popularity.desc'
        ? sortDiscoverResults(combined, filter.sortBy)
        : combined;
    } catch (e) {
      console.warn('Filtered search failed', e);
      return [];
    }
  },

  clearProvidersCache(): void {
    Object.keys(watchProvidersListCache).forEach((k) => {
      delete watchProvidersListCache[k];
    });
  },

  async getMediaTrailers(
    id: number,
    type: MediaType,
    apiKey: string
  ): Promise<MediaTrailerInfo[]> {
    try {
      interface RawVideoItem {
        key?: string;
        name?: string;
        site?: string;
        type?: string;
        official?: boolean;
        published_at?: string;
      }
      const data = await this.request<{ results?: RawVideoItem[] }>(
        `/${type}/${id}/videos`,
        apiKey
      );
      const raw = Array.isArray(data?.results) ? data.results : [];
      const youtube = raw.filter((v) => v.site === 'YouTube' && Boolean(v.key));

      const getRank = (v: RawVideoItem): number => {
        const isOfficial = Boolean(v.official);
        if (isOfficial && v.type === 'Trailer') return 0;
        if (!isOfficial && v.type === 'Trailer') return 1;
        if (isOfficial && v.type === 'Teaser') return 2;
        if (!isOfficial && v.type === 'Teaser') return 3;
        return 4;
      };

      youtube.sort((a, b) => {
        const rankDiff = getRank(a) - getRank(b);
        if (rankDiff !== 0) return rankDiff;
        const dateA = a.published_at || '';
        const dateB = b.published_at || '';
        return dateB.localeCompare(dateA);
      });

      return youtube.slice(0, 5).map((v) => ({
        key: v.key!,
        name: v.name || 'Trailer',
        site: v.site || 'YouTube',
        type: v.type || 'Trailer',
        official: Boolean(v.official),
        publishedAt: v.published_at,
      }));
    } catch (e) {
      console.warn('Failed to fetch media trailers from TMDB', e);
      return [];
    }
  },
};
