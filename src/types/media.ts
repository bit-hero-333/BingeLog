export type MediaType = 'movie' | 'tv';

export type MediaStatus = 'watching' | 'plan_to_watch' | 'completed' | 'on_hold' | 'dropped';

export interface EpisodeInfo {
  episodeNumber: number;
  name: string;
  overview?: string;
  airDate?: string | null;
  runtime?: number | null;
  stillPath?: string | null;
  voteAverage?: number;
}

export interface SeasonInfo {
  seasonNumber: number;
  episodeCount: number;
  name: string;
  airDate?: string | null;
  posterPath?: string | null;
  overview?: string;
  episodes?: EpisodeInfo[];
}

export interface TMDBMediaItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  overview: string;
  media_type?: MediaType;
  genre_ids?: number[];
  runtime?: number;
  number_of_episodes?: number;
  number_of_seasons?: number;
}

export interface TrackedItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  releaseYear?: string;
  voteAverage?: number;
  overview?: string;
  status: MediaStatus;
  userScore: number; // 0 = unrated, 1 to 10

  // TV Tracking Fields
  currentProgress?: number; // total episodes watched
  totalProgress?: number; // total episodes across all seasons
  totalEpisodes?: number | null;
  totalSeasons?: number | null;
  seasons?: SeasonInfo[];
  watchedEpisodeKeys?: string[]; // Keys like "s1_e1", "s2_e14" for granular episode tracking

  // Movie Tracking Fields
  runtimeMinutes?: number | null;
  minutesWatched?: number | null;
  rewatchCount?: number;

  // Dates & Timeline
  addedAt: string; // ISO date when added to list
  startedAt?: string | null; // Date user began watching (ISO)
  finishedAt?: string | null; // Date user completed watching (ISO)
  lastWatchedAt?: string | null; // Date user last updated progress
  updatedAt: string; // ISO date of last modification

  notes?: string;
}

export const STATUS_CONFIG: Record<
  MediaStatus,
  { label: string; shortLabel: string; color: string; bgColor: string }
> = {
  watching: {
    label: 'Currently Watching',
    shortLabel: 'Watching',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
  },
  plan_to_watch: {
    label: 'Plan to Watch',
    shortLabel: 'Plan',
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.15)',
  },
  completed: {
    label: 'Completed',
    shortLabel: 'Completed',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
  on_hold: {
    label: 'On Hold',
    shortLabel: 'On Hold',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  dropped: {
    label: 'Dropped',
    shortLabel: 'Dropped',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
};

export const MAL_SCORES = [
  { score: 0, label: 'Select Score' },
  { score: 10, label: '(10) Masterpiece' },
  { score: 9, label: '(9) Great' },
  { score: 8, label: '(8) Very Good' },
  { score: 7, label: '(7) Good' },
  { score: 6, label: '(6) Fine' },
  { score: 5, label: '(5) Average' },
  { score: 4, label: '(4) Bad' },
  { score: 3, label: '(3) Very Bad' },
  { score: 2, label: '(2) Horrible' },
  { score: 1, label: '(1) Appalling' },
];
