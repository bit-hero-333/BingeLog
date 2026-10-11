import {
  TMDBMediaItem,
  MediaType,
  SeasonInfo,
  EpisodeInfo,
  DetailedMediaInfo,
} from '@/types/media';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface RawCreditsResponse {
  tagline?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  number_of_episodes?: number;
  number_of_seasons?: number;
  status?: string;
  created_by?: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
  production_companies?: { id: number; name: string; logo_path: string | null }[];
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
    apiKey: string
  ): Promise<DetailedMediaInfo> {
    try {
      const endpoint = type === 'movie' ? `/movie/${id}` : `/tv/${id}`;
      const data = await this.request<RawCreditsResponse>(endpoint, apiKey, {
        append_to_response: 'credits',
      });

      const cast = (data.credits?.cast || []).slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
      }));

      const directors = (data.credits?.crew || [])
        .filter((c) => c.job === 'Director')
        .map((c) => c.name);

      const creators = (data.created_by || []).map((c) => c.name);

      const writers = (data.credits?.crew || [])
        .filter(
          (c) =>
            c.department === 'Writing' ||
            c.job === 'Writer' ||
            c.job === 'Screenplay' ||
            c.job === 'Story'
        )
        .slice(0, 3)
        .map((c) => c.name);

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
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
          name: s.name,
          airDate: s.air_date,
          posterPath: s.poster_path,
          overview: s.overview,
        }));

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
};
