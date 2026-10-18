import { Ionicons } from '@expo/vector-icons';

export type InsightCategory =
  | 'time_pace'
  | 'ratings_tastes'
  | 'cast_studios'
  | 'eras_geography'
  | 'habits_loyalty'
  | 'streaming';

export type InsightWidgetSize = 'auto' | 'full' | 'half' | 'compact';

export type InsightWidgetId =
  // Time & Pace
  | 'watch_time'
  | 'episodes_watched'
  | 'watchlist_debt'
  | 'biggest_time_sink'
  | 'avg_runtimes'
  | 'binge_velocity'
  | 'time_equivalents'
  | 'monthly_watch_time'
  // Ratings & Tastes
  | 'average_scores'
  | 'score_histogram'
  | 'hot_takes'
  | 'critic_persona'
  | 'perfect_tens'
  | 'guilty_pleasures'
  | 'score_by_status'
  | 'rating_spread'
  // Cast, Studios & Genres
  | 'top_genres'
  | 'top_directors'
  | 'top_actors'
  | 'top_studios'
  | 'franchise_progress'
  // Eras & Geography
  | 'decades_breakdown'
  | 'vintage_extremes'
  | 'fresh_vs_catalog'
  | 'country_origins'
  // Habits, Loyalty & Milestones
  | 'completion_rate'
  | 'format_split'
  | 'status_distribution'
  | 'rewatch_addiction'
  | 'drop_analysis'
  | 'limbo_shelf'
  | 'watchlist_conversion'
  | 'series_loyalty'
  | 'upcoming_drops_watchlist'
  | 'milestones_ahead'
  | 'library_health'
  | 'season_anticipation'
  // Streaming
  | 'streaming_mileage'
  | 'subscription_value';

export interface InsightWidgetConfig {
  id: InsightWidgetId;
  enabled: boolean;
  size: InsightWidgetSize;
  order: number;
}

export interface InsightWidgetDefinition {
  id: InsightWidgetId;
  title: string;
  subtitle: string;
  category: InsightCategory;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  defaultSize: InsightWidgetSize;
  defaultEnabled: boolean;
  allowedSizes: InsightWidgetSize[];
}

export const INSIGHT_CATEGORIES: { id: InsightCategory; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: 'time_pace', label: 'Time & Pace', icon: 'time-outline', color: '#38bdf8' },
  { id: 'ratings_tastes', label: 'Ratings & Tastes', icon: 'star-outline', color: '#fbbf24' },
  { id: 'cast_studios', label: 'Cast, Studios & Genres', icon: 'film-outline', color: '#a855f7' },
  { id: 'eras_geography', label: 'Eras & Geography', icon: 'globe-outline', color: '#06b6d4' },
  { id: 'habits_loyalty', label: 'Habits & Milestones', icon: 'trophy-outline', color: '#10b981' },
  { id: 'streaming', label: 'Streaming Mileage', icon: 'tv-outline', color: '#3b82f6' },
];

export const INSIGHT_WIDGET_DEFINITIONS: Record<InsightWidgetId, InsightWidgetDefinition> = {
  // Time & Pace
  watch_time: {
    id: 'watch_time',
    title: 'Watch Time Analytics',
    subtitle: 'Total estimated days, hours, and minutes watched',
    category: 'time_pace',
    icon: 'time',
    color: '#38bdf8',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half', 'compact'],
  },
  episodes_watched: {
    id: 'episodes_watched',
    title: 'Episodes Watched',
    subtitle: 'Total episodic TV progress across all seasons',
    category: 'time_pace',
    icon: 'play-circle',
    color: '#818cf8',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  watchlist_debt: {
    id: 'watchlist_debt',
    title: 'Watchlist Backlog Debt',
    subtitle: 'Estimated time needed to finish unwatched watchlist items',
    category: 'time_pace',
    icon: 'hourglass-outline',
    color: '#f97316',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  biggest_time_sink: {
    id: 'biggest_time_sink',
    title: 'Top Time Investment',
    subtitle: 'Single show or franchise with the most cumulative hours',
    category: 'time_pace',
    icon: 'flame-outline',
    color: '#ec4899',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  avg_runtimes: {
    id: 'avg_runtimes',
    title: 'Average Runtimes',
    subtitle: 'Average movie duration vs TV episode length',
    category: 'time_pace',
    icon: 'timer-outline',
    color: '#06b6d4',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  binge_velocity: {
    id: 'binge_velocity',
    title: 'Binge Velocity',
    subtitle: 'Average days from starting a series to completion',
    category: 'time_pace',
    icon: 'speedometer-outline',
    color: '#f43f5e',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  time_equivalents: {
    id: 'time_equivalents',
    title: 'Relatable Milestones',
    subtitle: 'Fun real-world comparisons for your watch time',
    category: 'time_pace',
    icon: 'planet-outline',
    color: '#6366f1',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half', 'compact'],
  },
  monthly_watch_time: {
    id: 'monthly_watch_time',
    title: 'Monthly Watch Pace',
    subtitle: 'Estimated viewing hours logged across recent months',
    category: 'time_pace',
    icon: 'calendar-outline',
    color: '#3b82f6',
    defaultSize: 'full',
    defaultEnabled: false,
    allowedSizes: ['full', 'half'],
  },

  // Ratings & Tastes
  average_scores: {
    id: 'average_scores',
    title: 'Score Comparison',
    subtitle: 'Your average user score vs TMDB community consensus',
    category: 'ratings_tastes',
    icon: 'analytics-outline',
    color: '#f59e0b',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half', 'compact'],
  },
  score_histogram: {
    id: 'score_histogram',
    title: 'User Score Distribution',
    subtitle: 'Histogram breakdown of ratings awarded from 1 to 10',
    category: 'ratings_tastes',
    icon: 'bar-chart-outline',
    color: '#eab308',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full'],
  },
  hot_takes: {
    id: 'hot_takes',
    title: 'Hot Takes & Divergences',
    subtitle: 'Titles where your score diverges most from TMDB',
    category: 'ratings_tastes',
    icon: 'trending-up-outline',
    color: '#f43f5e',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half'],
  },
  critic_persona: {
    id: 'critic_persona',
    title: 'Critic Persona',
    subtitle: 'Whether you rate more strictly or generously than consensus',
    category: 'ratings_tastes',
    icon: 'ribbon-outline',
    color: '#d97706',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  perfect_tens: {
    id: 'perfect_tens',
    title: 'Perfect 10 Hall of Fame',
    subtitle: 'Showcase of every masterpiece rated 10/10',
    category: 'ratings_tastes',
    icon: 'sparkles-outline',
    color: '#fbbf24',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half'],
  },
  guilty_pleasures: {
    id: 'guilty_pleasures',
    title: 'Guilty Pleasures',
    subtitle: 'High personal ratings on low community rated media',
    category: 'ratings_tastes',
    icon: 'heart-outline',
    color: '#fb7185',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full'],
  },
  score_by_status: {
    id: 'score_by_status',
    title: 'Score by Status',
    subtitle: 'Average ratings across completed, on hold, and dropped',
    category: 'ratings_tastes',
    icon: 'pie-chart-outline',
    color: '#10b981',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  rating_spread: {
    id: 'rating_spread',
    title: 'Rating Spread',
    subtitle: 'Statistical deviation and distribution width',
    category: 'ratings_tastes',
    icon: 'git-commit-outline',
    color: '#8b5cf6',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },

  // Cast, Studios & Genres
  top_genres: {
    id: 'top_genres',
    title: 'Top Genres Ranked',
    subtitle: 'Most frequent genres across your tracked library',
    category: 'cast_studios',
    icon: 'color-palette-outline',
    color: '#a855f7',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full'],
  },
  top_directors: {
    id: 'top_directors',
    title: 'Most Watched Directors',
    subtitle: 'Filmmakers appearing most across completed titles',
    category: 'cast_studios',
    icon: 'videocam-outline',
    color: '#6366f1',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half'],
  },
  top_actors: {
    id: 'top_actors',
    title: 'Recurring Cast Members',
    subtitle: 'Actors appearing most across your library',
    category: 'cast_studios',
    icon: 'people-outline',
    color: '#ec4899',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half'],
  },
  top_studios: {
    id: 'top_studios',
    title: 'Production Studios & Networks',
    subtitle: 'Studios and networks behind your tracked titles',
    category: 'cast_studios',
    icon: 'business-outline',
    color: '#14b8a6',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full'],
  },
  franchise_progress: {
    id: 'franchise_progress',
    title: 'Franchise Completion',
    subtitle: 'Completion percentage of detected movie collections',
    category: 'cast_studios',
    icon: 'layers-outline',
    color: '#f59e0b',
    defaultSize: 'full',
    defaultEnabled: false,
    allowedSizes: ['full', 'half'],
  },

  // Eras & Geography
  decades_breakdown: {
    id: 'decades_breakdown',
    title: 'Release Decades',
    subtitle: 'Distribution of titles from the 70s to the 2020s',
    category: 'eras_geography',
    icon: 'newspaper-outline',
    color: '#06b6d4',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half'],
  },
  vintage_extremes: {
    id: 'vintage_extremes',
    title: 'Oldest vs Newest Media',
    subtitle: 'The vintage classic vs the newest release in your library',
    category: 'eras_geography',
    icon: 'trail-sign-outline',
    color: '#d97706',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  fresh_vs_catalog: {
    id: 'fresh_vs_catalog',
    title: 'Fresh Releases vs Catalog',
    subtitle: 'Titles watched in release year vs older archive titles',
    category: 'eras_geography',
    icon: 'sparkles',
    color: '#10b981',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  country_origins: {
    id: 'country_origins',
    title: 'Global Cinema Origins',
    subtitle: 'Titles categorized by primary production country',
    category: 'eras_geography',
    icon: 'earth-outline',
    color: '#3b82f6',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full'],
  },

  // Habits, Loyalty & Milestones
  completion_rate: {
    id: 'completion_rate',
    title: 'Completion Rate',
    subtitle: 'Overall percentage of library titles marked Completed',
    category: 'habits_loyalty',
    icon: 'checkmark-circle-outline',
    color: '#22c55e',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  format_split: {
    id: 'format_split',
    title: 'Format Breakdown',
    subtitle: 'Movies count vs TV series count and completion',
    category: 'habits_loyalty',
    icon: 'film-outline',
    color: '#818cf8',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half'],
  },
  status_distribution: {
    id: 'status_distribution',
    title: 'Status Distribution',
    subtitle: 'Full status breakdown across all 5 tracking states',
    category: 'habits_loyalty',
    icon: 'list-outline',
    color: '#38bdf8',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full'],
  },
  rewatch_addiction: {
    id: 'rewatch_addiction',
    title: 'Rewatch Addiction Index',
    subtitle: 'Total rewatch loops and hours spent re-enjoying favorites',
    category: 'habits_loyalty',
    icon: 'repeat-outline',
    color: '#ec4899',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  drop_analysis: {
    id: 'drop_analysis',
    title: 'Drop Rate & Point',
    subtitle: 'Percentage of dropped shows and average drop episode',
    category: 'habits_loyalty',
    icon: 'close-circle-outline',
    color: '#ef4444',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  limbo_shelf: {
    id: 'limbo_shelf',
    title: 'The Limbo Shelf',
    subtitle: 'Titles waiting on hold and average hold duration',
    category: 'habits_loyalty',
    icon: 'pause-circle-outline',
    color: '#f97316',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  watchlist_conversion: {
    id: 'watchlist_conversion',
    title: 'Watchlist Conversion',
    subtitle: 'Ratio of planned titles transitioned into active viewing',
    category: 'habits_loyalty',
    icon: 'swap-horizontal-outline',
    color: '#10b981',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  series_loyalty: {
    id: 'series_loyalty',
    title: 'Series Loyalty Depth',
    subtitle: 'Average seasons completed per started TV series',
    category: 'habits_loyalty',
    icon: 'medal-outline',
    color: '#8b5cf6',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  upcoming_drops_watchlist: {
    id: 'upcoming_drops_watchlist',
    title: 'Upcoming Watchlist Drops',
    subtitle: 'Countdowns to unreleased titles tracked on your list',
    category: 'habits_loyalty',
    icon: 'alarm-outline',
    color: '#06b6d4',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },
  milestones_ahead: {
    id: 'milestones_ahead',
    title: 'Next Milestones Ahead',
    subtitle: 'Gamified progress towards next round number milestones',
    category: 'habits_loyalty',
    icon: 'flag-outline',
    color: '#eab308',
    defaultSize: 'full',
    defaultEnabled: true,
    allowedSizes: ['full', 'half'],
  },
  library_health: {
    id: 'library_health',
    title: 'Library Metadata Health',
    subtitle: 'Percentage of items with ratings, notes, and reminders',
    category: 'habits_loyalty',
    icon: 'shield-checkmark-outline',
    color: '#14b8a6',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  season_anticipation: {
    id: 'season_anticipation',
    title: 'Season Anticipation & Rewatch Queue',
    subtitle: 'Completed TV shows queued on Plan to Watch for new seasons or rewatching',
    category: 'habits_loyalty',
    icon: 'hourglass-outline',
    color: '#a855f7',
    defaultSize: 'half',
    defaultEnabled: true,
    allowedSizes: ['half', 'full', 'compact'],
  },

  // Streaming Mileage
  streaming_mileage: {
    id: 'streaming_mileage',
    title: 'Most Utilized Streaming Service',
    subtitle: 'Platform accounting for the highest share of your media',
    category: 'streaming',
    icon: 'tv-outline',
    color: '#3b82f6',
    defaultSize: 'half',
    defaultEnabled: false,
    allowedSizes: ['half', 'full', 'compact'],
  },
  subscription_value: {
    id: 'subscription_value',
    title: 'Subscription Value Index',
    subtitle: 'Completed titles per subscribed streaming service',
    category: 'streaming',
    icon: 'wallet-outline',
    color: '#06b6d4',
    defaultSize: 'full',
    defaultEnabled: false,
    allowedSizes: ['full', 'half'],
  },
};

export const DEFAULT_INSIGHTS_LAYOUT: InsightWidgetConfig[] = [
  { id: 'watch_time', enabled: true, size: 'full', order: 0 },
  { id: 'episodes_watched', enabled: true, size: 'half', order: 1 },
  { id: 'completion_rate', enabled: true, size: 'half', order: 2 },
  { id: 'format_split', enabled: true, size: 'full', order: 3 },
  { id: 'status_distribution', enabled: true, size: 'full', order: 4 },
  { id: 'average_scores', enabled: true, size: 'full', order: 5 },
  { id: 'score_histogram', enabled: true, size: 'full', order: 6 },
  { id: 'top_genres', enabled: true, size: 'full', order: 7 },
  { id: 'watchlist_debt', enabled: true, size: 'half', order: 8 },
  { id: 'biggest_time_sink', enabled: true, size: 'half', order: 9 },
  { id: 'hot_takes', enabled: true, size: 'full', order: 10 },
  { id: 'critic_persona', enabled: true, size: 'half', order: 11 },
  { id: 'rewatch_addiction', enabled: true, size: 'half', order: 12 },
  { id: 'perfect_tens', enabled: true, size: 'full', order: 13 },
  { id: 'top_directors', enabled: true, size: 'full', order: 14 },
  { id: 'top_actors', enabled: true, size: 'full', order: 15 },
  { id: 'decades_breakdown', enabled: true, size: 'full', order: 16 },
  { id: 'vintage_extremes', enabled: true, size: 'half', order: 17 },
  { id: 'upcoming_drops_watchlist', enabled: true, size: 'half', order: 18 },
  { id: 'time_equivalents', enabled: true, size: 'full', order: 19 },
  { id: 'milestones_ahead', enabled: true, size: 'full', order: 20 },
  { id: 'season_anticipation', enabled: true, size: 'half', order: 21 },
  // Available but off by default for clean start
  { id: 'avg_runtimes', enabled: false, size: 'half', order: 22 },
  { id: 'binge_velocity', enabled: false, size: 'half', order: 23 },
  { id: 'monthly_watch_time', enabled: false, size: 'full', order: 24 },
  { id: 'guilty_pleasures', enabled: false, size: 'half', order: 25 },
  { id: 'score_by_status', enabled: false, size: 'half', order: 26 },
  { id: 'rating_spread', enabled: false, size: 'half', order: 27 },
  { id: 'top_studios', enabled: false, size: 'half', order: 28 },
  { id: 'franchise_progress', enabled: false, size: 'full', order: 29 },
  { id: 'fresh_vs_catalog', enabled: false, size: 'half', order: 30 },
  { id: 'country_origins', enabled: false, size: 'half', order: 31 },
  { id: 'drop_analysis', enabled: false, size: 'half', order: 32 },
  { id: 'limbo_shelf', enabled: false, size: 'half', order: 33 },
  { id: 'watchlist_conversion', enabled: false, size: 'half', order: 34 },
  { id: 'series_loyalty', enabled: false, size: 'half', order: 35 },
  { id: 'library_health', enabled: false, size: 'half', order: 36 },
  { id: 'streaming_mileage', enabled: false, size: 'half', order: 37 },
  { id: 'subscription_value', enabled: false, size: 'full', order: 38 },
];

export const INSIGHT_WIDGET_CATALOG: InsightWidgetDefinition[] = Object.values(INSIGHT_WIDGET_DEFINITIONS);

export interface DrillDownContributingItem {
  id: number;
  title: string;
  mediaType: 'movie' | 'tv';
  posterPath: string | null;
  releaseYear?: string;
  status: string;
  userScore?: number;
  voteAverage?: number;
  highlightMetric: string;
  extraInfo?: string;
}

export interface InsightDrillDownPayload {
  widgetId: InsightWidgetId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  summaryHighlights: { label: string; value: string; hint?: string }[];
  items?: DrillDownContributingItem[];
  customBreakdown?: { label: string; value: string | number; percentage?: number; color?: string }[];
  notes?: string;
}
