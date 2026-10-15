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

interface RawCreditsResponse {
  tagline?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  number_of_episodes?: number;
  number_of_seasons?: number;
  status?: string;
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
}

export const TMDBService = {
  getImageUrl(
    path: string | null | undefined,
    size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'
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
      const append = type === 'movie' ? 'credits,release_dates' : 'credits';
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

      return {
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

  async discoverByEntity(
    entityType: EntityType,
    entityId: number,
    apiKey: string,
    page: number = 1
  ): Promise<TMDBMediaItem[]> {
    try {
      const params: Record<string, string | number> = {
        page,
        sort_by: 'popularity.desc',
      };
      if (entityType === 'person') {
        params.with_people = entityId;
      } else if (entityType === 'company' || entityType === 'network') {
        params.with_companies = entityId;
      } else if (entityType === 'genre') {
        params.with_genres = entityId;
      }

      const [moviesRes, tvRes] = await Promise.allSettled([
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/movie', apiKey, params),
        this.request<TMDBResponse<TMDBMediaItem>>('/discover/tv', apiKey, params),
      ]);

      const movies = moviesRes.status === 'fulfilled' ? (moviesRes.value.results || []).map(m => ({ ...m, media_type: 'movie' as MediaType })) : [];
      const tv = tvRes.status === 'fulfilled' ? (tvRes.value.results || []).map(t => ({ ...t, media_type: 'tv' as MediaType })) : [];

      return [...movies, ...tv].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
    } catch (e) {
      console.warn(`Failed to discover by entity ${entityType} ${entityId}`, e);
      return [];
    }
  },
};
