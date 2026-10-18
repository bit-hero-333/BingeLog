export type MediaType = 'movie' | 'tv';

export type MediaStatus = 'watching' | 'plan_to_watch' | 'completed' | 'on_hold' | 'dropped';

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

export interface GenreInfo {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface NetworkInfo {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface EpisodeInfo {
  episodeNumber: number;
  name: string;
  overview?: string;
  airDate?: string | null;
  runtime?: number | null;
  stillPath?: string | null;
  voteAverage?: number;
}

export interface EpisodeDetailedInfo extends EpisodeInfo {
  guestStars?: CastMember[];
  directors?: PersonSummary[];
  writers?: PersonSummary[];
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

export interface PersonSummary {
  id: number;
  name: string;
  role?: string;
  profilePath?: string | null;
}

export interface DetailedMediaInfo {
  runtime?: number;
  numberOfEpisodes?: number;
  numberOfSeasons?: number;
  seasons?: SeasonInfo[];
  tagline?: string;
  genres?: GenreInfo[];
  cast?: CastMember[];
  directors?: PersonSummary[];
  creators?: PersonSummary[];
  writers?: PersonSummary[];
  studios?: ProductionCompany[];
  networks?: NetworkInfo[];
  releaseDate?: string;
  regionalReleaseDate?: string;
  regionalReleaseType?: string;
  nextAirDate?: string;
  nextEpisode?: {
    seasonNumber: number;
    episodeNumber: number;
    name?: string;
    airDate?: string;
  };
  status?: string;
  watchProviders?: AllWatchProviders;
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string | null;
  displayPriority?: number;
  displayPriorities?: Record<string, number>;
}

export interface RegionalWatchProviders {
  link?: string;
  flatrate?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

export type AllWatchProviders = Record<string, RegionalWatchProviders>;

export type ProviderDisplayStrategy = 'all' | 'subscribed' | 'none';
export type StreamingRegionStrategy = 'match_region' | 'custom' | 'worldwide';

export interface PopularProviderOption {
  id: number;
  name: string;
  logoPath: string;
}

export const POPULAR_STREAMING_PROVIDERS: PopularProviderOption[] = [
  { id: 8, name: 'Netflix', logoPath: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
  { id: 9, name: 'Amazon Prime Video', logoPath: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png' },
  { id: 337, name: 'Disney Plus', logoPath: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
  { id: 350, name: 'Apple TV Plus', logoPath: '/9ghgSC0MA082EL6HLCW3GalykFD.jpg' },
  { id: 1899, name: 'Max', logoPath: '/fksCUZ9QDWZMUwL2LgMtLckROUN.jpg' },
  { id: 283, name: 'Crunchyroll', logoPath: '/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png' },
  { id: 531, name: 'Paramount Plus', logoPath: '/pkx3klJlwW5JdtaulvDx6hDNtch.png' },
  { id: 386, name: 'Peacock', logoPath: '/gKkl37BQuKTanygYQG1pyYgLVgf.jpg' },
  { id: 15, name: 'Hulu', logoPath: '/bxBlRPEPpMVDc4jMhSrTf2339DW.jpg' },
  { id: 188, name: 'YouTube Premium', logoPath: '/oIkQkEkwfmcG7IGpRR1NB8frZZM.jpg' },
];

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
  popularity?: number;
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

  // Viewing Progress & Rewatch Tracking (Movies & TV Shows)
  rewatchCount?: number;

  // Movie Tracking Fields
  runtimeMinutes?: number | null;
  minutesWatched?: number | null;

  // Rich Details
  tagline?: string;
  genres?: string[];
  genre_ids?: number[];
  studios?: string[];
  creators?: string[];
  watchProviders?: AllWatchProviders;

  // Dates & Timeline
  addedAt: string; // ISO date when added to list
  startedAt?: string | null; // Date user began watching (ISO)
  finishedAt?: string | null; // Date user completed watching (ISO)
  lastWatchedAt?: string | null; // Date user last updated progress
  lastSyncedAt?: string | null; // Date item was last synced with TMDB
  updatedAt: string; // ISO date of last modification

  // Regional Release & Broadcast Dates
  releaseDate?: string; // Standard release date (YYYY-MM-DD)
  regionalReleaseDate?: string; // Regional theatrical/digital release date
  regionalReleaseType?: string; // 'Theatrical', 'Digital', 'Premiere', 'Physical', etc.
  nextAirDate?: string; // TV next episode air date (YYYY-MM-DD)
  nextEpisode?: {
    seasonNumber: number;
    episodeNumber: number;
    name?: string;
    airDate?: string;
  };

  // Custom per-item notification override (optional)
  reminder?: ItemReminderConfig;

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

export type DensityPreset = 'compact' | 'default' | 'large';
export type ElementScale = 'small' | 'medium' | 'large' | 'xlarge';

export interface SizingConfig {
  preset: DensityPreset;
  textSize: ElementScale; // global text scaling across entire app
  castSize: ElementScale; // actor avatar size & card width
  tagSize: ElementScale;  // badge pills & chips
  rowDensity: ElementScale; // episode row heights & padding
  seasonEpisodeSize: ElementScale; // season header, episode title & thumbnail dimensions
  posterSize: ElementScale; // poster cards width/height in lists & grids
  buttonSize: ElementScale; // buttons, touch targets, icon buttons
  providerSize: ElementScale; // streaming provider chips & badges
  headerSize: ElementScale; // section headers, modal titles, screen titles
}

export const DEFAULT_SIZING_CONFIG: SizingConfig = {
  preset: 'default',
  textSize: 'medium',
  castSize: 'medium',
  tagSize: 'medium',
  rowDensity: 'medium',
  seasonEpisodeSize: 'medium',
  posterSize: 'medium',
  buttonSize: 'medium',
  providerSize: 'medium',
  headerSize: 'medium',
};

export const SIZING_PRESETS: Record<DensityPreset, SizingConfig> = {
  compact: {
    preset: 'compact',
    textSize: 'small',
    castSize: 'small',
    tagSize: 'small',
    rowDensity: 'small',
    seasonEpisodeSize: 'small',
    posterSize: 'small',
    buttonSize: 'small',
    providerSize: 'small',
    headerSize: 'small',
  },
  default: {
    preset: 'default',
    textSize: 'medium',
    castSize: 'medium',
    tagSize: 'medium',
    rowDensity: 'medium',
    seasonEpisodeSize: 'medium',
    posterSize: 'medium',
    buttonSize: 'medium',
    providerSize: 'medium',
    headerSize: 'medium',
  },
  large: {
    preset: 'large',
    textSize: 'large',
    castSize: 'large',
    tagSize: 'large',
    rowDensity: 'large',
    seasonEpisodeSize: 'large',
    posterSize: 'large',
    buttonSize: 'large',
    providerSize: 'large',
    headerSize: 'large',
  },
};

export type EntityType = 'person' | 'company' | 'network' | 'genre' | 'provider';

export interface EntitySelection {
  type: EntityType;
  id: number;
  name: string;
  role?: string;
  logoPath?: string | null;
  profilePath?: string | null;
}

export interface PersonFullDetails {
  id: number;
  name: string;
  biography?: string;
  birthday?: string | null;
  placeOfBirth?: string | null;
  deathday?: string | null;
  knownForDepartment?: string;
  profilePath?: string | null;
  knownWorks?: TMDBMediaItem[];
}

export interface CompanyFullDetails {
  id: number;
  name: string;
  description?: string;
  headquarters?: string;
  originCountry?: string;
  logoPath?: string | null;
  knownWorks?: TMDBMediaItem[];
}

export interface GenreFullDetails {
  id: number;
  name: string;
  knownWorks?: TMDBMediaItem[];
}

export interface DiscoverFilter {
  type: EntityType;
  id: number;
  name: string;
}

export type DiscoverReleaseWindow =
  | 'all'
  | 'upcoming_30'
  | 'upcoming_60'
  | 'upcoming_90'
  | 'in_theaters'
  | 'digital_premieres';

export type DiscoverSortOption =
  | 'popularity.desc'
  | 'primary_release_date.desc'
  | 'primary_release_date.asc'
  | 'vote_average.desc';

export interface MultiDiscoverFilter {
  mediaType: 'all' | 'movie' | 'tv';
  releaseWindow: DiscoverReleaseWindow;
  providerScope: 'none' | 'subscribed' | 'region' | 'worldwide';
  selectedProviders: number[];
  selectedProviderDetails?: WatchProvider[];
  selectedGenres: number[];
  minRating: number;
  selectedPeople: { id: number; name: string; profilePath?: string | null }[];
  selectedCompanies: { id: number; name: string; logoPath?: string | null }[];
  sortBy: DiscoverSortOption;
}

export const DEFAULT_MULTI_DISCOVER_FILTER: MultiDiscoverFilter = {
  mediaType: 'all',
  releaseWindow: 'all',
  providerScope: 'none',
  selectedProviders: [],
  selectedProviderDetails: [],
  selectedGenres: [],
  minRating: 0,
  selectedPeople: [],
  selectedCompanies: [],
  sortBy: 'primary_release_date.asc',
};

export const TMDB_GENRES: GenreInfo[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

export type DateFormatOption =
  | 'DD.MM.YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY-MM-DD'
  | 'DD/MM/YYYY'
  | 'MMM D, YYYY'
  | 'D MMM YYYY';

export interface DateFormatConfig {
  id: DateFormatOption;
  label: string;
  example: string;
  description: string;
}

export const DATE_FORMAT_OPTIONS: DateFormatConfig[] = [
  { id: 'DD.MM.YYYY', label: 'DD.MM.YYYY', example: '14.10.2026', description: 'European dot' },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '10/14/2026', description: 'US slash' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-10-14', description: 'ISO standard' },
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '14/10/2026', description: 'Global slash' },
  { id: 'MMM D, YYYY', label: 'MMM D, YYYY', example: 'Oct 14, 2026', description: 'Written month (US)' },
  { id: 'D MMM YYYY', label: 'D MMM YYYY', example: '14 Oct 2026', description: 'Written month (Global)' },
];

export const DEFAULT_DATE_FORMAT: DateFormatOption = 'DD.MM.YYYY';

export type AutoManualMode = 'auto' | 'manual';

export interface RegionOption {
  code: string; // ISO 3166-1 alpha-2 (e.g. 'US', 'DE', 'GB')
  name: string;
}

export const POPULAR_REGIONS: RegionOption[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
];

export interface TimezoneOption {
  id: string;
  label: string;
}

export const POPULAR_TIMEZONES: TimezoneOption[] = [
  { id: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { id: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { id: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { id: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { id: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { id: 'Europe/London', label: 'London, Dublin, Lisbon (GMT/BST)' },
  { id: 'Europe/Berlin', label: 'Berlin, Paris, Rome, Madrid (CET)' },
  { id: 'Europe/Helsinki', label: 'Helsinki, Athens, Istanbul (EET)' },
  { id: 'Asia/Tokyo', label: 'Tokyo, Seoul (JST/KST)' },
  { id: 'Asia/Shanghai', label: 'Beijing, Shanghai, Hong Kong (CST)' },
  { id: 'Australia/Sydney', label: 'Sydney, Melbourne (AEST)' },
];

export interface CountdownInfo {
  status: 'released' | 'today' | 'tomorrow' | 'upcoming';
  daysDiff: number;
  formattedCountdown: string;
  isUpcoming: boolean;
}

export type TimeFormatOption = '12h' | '24h';

export const DEFAULT_TIME_FORMAT: TimeFormatOption = '24h';

export type NotificationTimingOption = 'release_day' | 'advance' | 'both';

export interface ItemReminderConfig {
  enabled: boolean;
  timing: NotificationTimingOption;
  daysAhead: number; // e.g. 0, 1, 2, 3, 7, 14, or custom
  hour: number; // 0-23
  minute?: number; // 0-59
}

export interface NotificationHourPreset {
  hour: number;
  label24: string;
  label12: string;
  desc: string;
}

export const NOTIFICATION_HOUR_PRESETS: NotificationHourPreset[] = [
  { hour: 0, label24: '00:00', label12: '12:00 AM', desc: 'Midnight / Release Start' },
  { hour: 9, label24: '09:00', label12: '09:00 AM', desc: 'Morning' },
  { hour: 13, label24: '13:00', label12: '01:00 PM', desc: 'Afternoon' },
  { hour: 18, label24: '18:00', label12: '06:00 PM', desc: 'Evening' },
  { hour: 21, label24: '21:00', label12: '09:00 PM', desc: 'Night' },
];

export interface NotificationDaysAdvanceOption {
  days: number;
  label: string;
  shortLabel: string;
}

export const NOTIFICATION_DAYS_ADVANCE_OPTIONS: NotificationDaysAdvanceOption[] = [
  { days: 1, label: '1 Day Ahead', shortLabel: '1 Day' },
  { days: 2, label: '2 Days Ahead', shortLabel: '2 Days' },
  { days: 3, label: '3 Days Ahead', shortLabel: '3 Days' },
  { days: 7, label: '1 Week Ahead', shortLabel: '1 Week' },
  { days: 14, label: '2 Weeks Ahead', shortLabel: '2 Weeks' },
];

