import { TMDBMediaItem, MediaType } from '@/types/media';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
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

    // Filter to only movie and tv types
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
};
