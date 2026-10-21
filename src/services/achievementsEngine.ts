import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackedItem, TMDB_GENRE_MAP } from '@/types/media';
import { getCountryName } from '@/utils/country';
import {
  AchievementDefinition,
  AchievementProgress,
  AchievementStatsSummary,
  AchievementTier,
  ContributingMediaItem,
  StoredAchievementTimestamps,
  TIER_CONFIG,
  TIER_ORDER,
} from '@/types/achievements';

const ACHIEVEMENTS_STORAGE_KEY = 'bingelog_user_achievements_v1';
const ACHIEVEMENTS_EXTRA_STATS_KEY = 'bingelog_achievements_extra_stats_v1';

export interface ExtraAppStats {
  drillDownCount: number;
  backupCount: number;
  syncCount: number;
  layoutCustomizationCount: number;
}

const DEFAULT_EXTRA_STATS: ExtraAppStats = {
  drillDownCount: 0,
  backupCount: 0,
  syncCount: 0,
  layoutCustomizationCount: 0,
};

function getItemGenres(item: TrackedItem): string[] {
  if (item.genres && item.genres.length > 0) {
    return item.genres;
  }
  if (item.genre_ids && item.genre_ids.length > 0) {
    return item.genre_ids.map((id) => TMDB_GENRE_MAP[id]).filter(Boolean);
  }
  return [];
}

function parseYear(item: TrackedItem): number | null {
  if (item.releaseYear) {
    const y = parseInt(item.releaseYear, 10);
    if (!isNaN(y)) return y;
  }
  if (item.releaseDate) {
    const y = parseInt(item.releaseDate.substring(0, 4), 10);
    if (!isNaN(y)) return y;
  }
  return null;
}

export const ALL_ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // --- Category: Milestones (Volume & Library) ---
  {
    id: 'cinephile',
    name: 'Cinephile',
    description: 'Complete feature-length movies in your library.',
    category: 'milestones',
    iconName: 'film-outline',
    metricLabel: 'Movies',
    thresholds: {
      bronze: 25,
      silver: 75,
      gold: 200,
      platinum: 500,
      ruby: 1000,
      emerald: 2500,
      diamond: 5000,
    },
  },
  {
    id: 'series_connoisseur',
    name: 'Series Connoisseur',
    description: 'Complete full television series from start to finish.',
    category: 'milestones',
    iconName: 'tv-outline',
    metricLabel: 'Shows',
    thresholds: {
      bronze: 5,
      silver: 20,
      gold: 50,
      platinum: 120,
      ruby: 250,
      emerald: 500,
      diamond: 1000,
    },
  },
  {
    id: 'episode_veteran',
    name: 'Episode Veteran',
    description: 'Log cumulative television episodes watched across all series.',
    category: 'milestones',
    iconName: 'play-circle-outline',
    metricLabel: 'Episodes',
    thresholds: {
      bronze: 100,
      silver: 500,
      gold: 1500,
      platinum: 4000,
      ruby: 10000,
      emerald: 25000,
      diamond: 60000,
    },
  },
  {
    id: 'vault_builder',
    name: 'Vault Builder',
    description: 'Expand your active media tracker library with tracked titles.',
    category: 'milestones',
    iconName: 'library-outline',
    metricLabel: 'Titles',
    thresholds: {
      bronze: 50,
      silver: 150,
      gold: 400,
      platinum: 1000,
      ruby: 2500,
      emerald: 5000,
      diamond: 10000,
    },
  },
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Maintain a high completion percentage across your catalog.',
    category: 'milestones',
    iconName: 'checkmark-done-circle-outline',
    metricLabel: '% Ratio',
    isPercentage: true,
    thresholds: {
      bronze: 60,
      silver: 70,
      gold: 80,
      platinum: 88,
      ruby: 92,
      emerald: 95,
      diamond: 98,
    },
  },
  {
    id: 'the_anticipator',
    name: 'The Anticipator',
    description: 'Queue up upcoming media on your Plan to Watch list.',
    category: 'milestones',
    iconName: 'bookmark-outline',
    metricLabel: 'Plan Titles',
    thresholds: {
      bronze: 25,
      silver: 75,
      gold: 200,
      platinum: 500,
      ruby: 1000,
      emerald: 2000,
      diamond: 4000,
    },
  },
  {
    id: 'dual_focus',
    name: 'Dual Focus',
    description: 'Track ongoing series simultaneously in Watching and Planned.',
    category: 'milestones',
    iconName: 'swap-horizontal-outline',
    metricLabel: 'Dual Titles',
    thresholds: {
      bronze: 3,
      silver: 10,
      gold: 25,
      platinum: 60,
      ruby: 120,
      emerald: 250,
      diamond: 500,
    },
  },

  // --- Category: Binge & Time ---
  {
    id: 'century_club',
    name: 'Century Club',
    description: 'Accumulate total hours spent streaming and watching media.',
    category: 'binge_time',
    iconName: 'time-outline',
    metricLabel: 'Hours',
    thresholds: {
      bronze: 50,
      silver: 200,
      gold: 600,
      platinum: 1800,
      ruby: 4500,
      emerald: 10000,
      diamond: 25000,
    },
  },
  {
    id: 'marathon_master',
    name: 'Marathon Master',
    description: 'Log multiple television episodes within a single calendar day.',
    category: 'binge_time',
    iconName: 'flash-outline',
    metricLabel: 'Daily Eps',
    thresholds: {
      bronze: 5,
      silver: 10,
      gold: 18,
      platinum: 25,
      ruby: 35,
      emerald: 50,
      diamond: 75,
    },
  },
  {
    id: 'the_long_haul',
    name: 'The Long Haul',
    description: 'Conquer and finish massive TV sagas with 50+ total episodes.',
    category: 'binge_time',
    iconName: 'ribbon-outline',
    metricLabel: 'Epic Series',
    thresholds: {
      bronze: 2,
      silver: 5,
      gold: 12,
      platinum: 30,
      ruby: 60,
      emerald: 120,
      diamond: 250,
    },
  },
  {
    id: 'epic_scale',
    name: 'Epic Scale',
    description: 'Complete monumental films with runtimes of 2.5 hours or more.',
    category: 'binge_time',
    iconName: 'hourglass-outline',
    metricLabel: 'Long Films',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 40,
      platinum: 100,
      ruby: 250,
      emerald: 500,
      diamond: 1000,
    },
  },
  {
    id: 'encore_addict',
    name: 'Encore Addict',
    description: 'Rewatch and revisit your all-time favorite stories.',
    category: 'binge_time',
    iconName: 'repeat-outline',
    metricLabel: 'Rewatches',
    thresholds: {
      bronze: 5,
      silver: 20,
      gold: 60,
      platinum: 150,
      ruby: 350,
      emerald: 750,
      diamond: 1500,
    },
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Log media watching activity over Saturdays and Sundays.',
    category: 'binge_time',
    iconName: 'calendar-number-outline',
    metricLabel: 'Sessions',
    thresholds: {
      bronze: 15,
      silver: 50,
      gold: 150,
      platinum: 400,
      ruby: 1000,
      emerald: 2000,
      diamond: 4000,
    },
  },
  {
    id: 'high_velocity',
    name: 'High Velocity',
    description: 'Maintain intense watching pace with episodes in a 7-day window.',
    category: 'binge_time',
    iconName: 'speedometer-outline',
    metricLabel: 'Weekly Eps',
    thresholds: {
      bronze: 10,
      silver: 25,
      gold: 50,
      platinum: 90,
      ruby: 150,
      emerald: 250,
      diamond: 400,
    },
  },

  // --- Category: Habits & Timing ---
  {
    id: 'streakkeeper',
    name: 'Streakkeeper',
    description: 'Keep a continuous streak of daily logging activity.',
    category: 'habits',
    iconName: 'flame-outline',
    metricLabel: 'Days',
    thresholds: {
      bronze: 7,
      silver: 30,
      gold: 100,
      platinum: 365,
      ruby: 730,
      emerald: 1095,
      diamond: 1825,
    },
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Finish movies or episodes late at night (22:00 to 03:00).',
    category: 'habits',
    iconName: 'moon-outline',
    metricLabel: 'Late Finishes',
    thresholds: {
      bronze: 10,
      silver: 35,
      gold: 100,
      platinum: 250,
      ruby: 600,
      emerald: 1500,
      diamond: 3500,
    },
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Finish movies or episodes early in the morning (05:00 to 09:00).',
    category: 'habits',
    iconName: 'sunny-outline',
    metricLabel: 'Morning Finishes',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 40,
      platinum: 100,
      ruby: 250,
      emerald: 600,
      diamond: 1500,
    },
  },
  {
    id: 'patient_resumer',
    name: 'Patient Resumer',
    description: 'Return to and complete titles that were put on pause/hold.',
    category: 'habits',
    iconName: 'pause-circle-outline',
    metricLabel: 'Resumed',
    thresholds: {
      bronze: 3,
      silver: 10,
      gold: 25,
      platinum: 60,
      ruby: 150,
      emerald: 350,
      diamond: 800,
    },
  },
  {
    id: 'rapid_finisher',
    name: 'Rapid Finisher',
    description: 'Finish a series or film within 48 hours of starting it.',
    category: 'habits',
    iconName: 'rocket-outline',
    metricLabel: 'Fast Finishes',
    thresholds: {
      bronze: 5,
      silver: 18,
      gold: 50,
      platinum: 120,
      ruby: 300,
      emerald: 700,
      diamond: 1500,
    },
  },
  {
    id: 'calendar_veteran',
    name: 'Calendar Veteran',
    description: 'Log active watching across distinct calendar months.',
    category: 'habits',
    iconName: 'planet-outline',
    metricLabel: 'Months',
    thresholds: {
      bronze: 3,
      silver: 6,
      gold: 12,
      platinum: 24,
      ruby: 36,
      emerald: 48,
      diamond: 60,
    },
  },
  {
    id: 'day_one_viewer',
    name: 'Day-One Viewer',
    description: 'Complete media within 30 days of its official release date.',
    category: 'habits',
    iconName: 'sparkles-outline',
    metricLabel: 'Fresh Titles',
    thresholds: {
      bronze: 3,
      silver: 10,
      gold: 25,
      platinum: 60,
      ruby: 150,
      emerald: 350,
      diamond: 800,
    },
  },

  // --- Category: Ratings & The Critic's Desk ---
  {
    id: 'seasoned_critic',
    name: 'Seasoned Critic',
    description: 'Assign personal star scores to media in your library.',
    category: 'ratings',
    iconName: 'star-half-outline',
    metricLabel: 'Rated Titles',
    thresholds: {
      bronze: 25,
      silver: 75,
      gold: 200,
      platinum: 500,
      ruby: 1200,
      emerald: 2500,
      diamond: 5000,
    },
  },
  {
    id: 'the_perfect_ten',
    name: 'The Perfect Ten',
    description: 'Bestow pristine 10/10 master ratings upon your favorites.',
    category: 'ratings',
    iconName: 'star-outline',
    metricLabel: 'Tens Given',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 40,
      platinum: 100,
      ruby: 250,
      emerald: 500,
      diamond: 1000,
    },
  },
  {
    id: 'tough_crowd',
    name: 'Tough Crowd',
    description: 'Hand out honest, unsparing ratings under 5/10.',
    category: 'ratings',
    iconName: 'thumbs-down-outline',
    metricLabel: 'Low Scores',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 40,
      platinum: 100,
      ruby: 250,
      emerald: 500,
      diamond: 1000,
    },
  },
  {
    id: 'balanced_palette',
    name: 'Balanced Palette',
    description: 'Make use of distinct rating scores from 1 to 10.',
    category: 'ratings',
    iconName: 'bar-chart-outline',
    metricLabel: 'Distinct Scores',
    thresholds: {
      bronze: 4,
      silver: 6,
      gold: 8,
      platinum: 9,
      ruby: 10,
      emerald: 10,
      diamond: 10,
    },
  },
  {
    id: 'divergent_thinker',
    name: 'Divergent Thinker',
    description: 'Disagree with TMDB community average by 2 or more points.',
    category: 'ratings',
    iconName: 'bonfire-outline',
    metricLabel: 'Hot Takes',
    thresholds: {
      bronze: 10,
      silver: 30,
      gold: 80,
      platinum: 200,
      ruby: 500,
      emerald: 1200,
      diamond: 2500,
    },
  },
  {
    id: 'the_archival_scribe',
    name: 'The Archival Scribe',
    description: 'Document your personal thoughts, notes, and reviews.',
    category: 'ratings',
    iconName: 'document-text-outline',
    metricLabel: 'Notes Written',
    thresholds: {
      bronze: 10,
      silver: 35,
      gold: 100,
      platinum: 250,
      ruby: 600,
      emerald: 1200,
      diamond: 2500,
    },
  },
  {
    id: 'golden_standard',
    name: 'Golden Standard',
    description: 'Curate excellent titles evaluated at an 8/10 or higher.',
    category: 'ratings',
    iconName: 'medal-outline',
    metricLabel: 'Greats (8+)',
    thresholds: {
      bronze: 15,
      silver: 45,
      gold: 120,
      platinum: 300,
      ruby: 700,
      emerald: 1500,
      diamond: 3000,
    },
  },

  // --- Category: Genres ---
  {
    id: 'action_hero',
    name: 'Action Hero',
    description: 'Watch thrilling Action and Adventure films and shows.',
    category: 'genres',
    iconName: 'shield-outline',
    metricLabel: 'Action Titles',
    thresholds: {
      bronze: 20,
      silver: 60,
      gold: 180,
      platinum: 450,
      ruby: 1000,
      emerald: 2200,
      diamond: 5000,
    },
  },
  {
    id: 'punchline_enthusiast',
    name: 'Punchline Enthusiast',
    description: 'Enjoy laugh-out-loud Comedy releases.',
    category: 'genres',
    iconName: 'happy-outline',
    metricLabel: 'Comedies',
    thresholds: {
      bronze: 20,
      silver: 60,
      gold: 180,
      platinum: 450,
      ruby: 1000,
      emerald: 2200,
      diamond: 5000,
    },
  },
  {
    id: 'drama_aficionado',
    name: 'Drama Aficionado',
    description: 'Immerse in deeply emotional and character-driven Drama.',
    category: 'genres',
    iconName: 'heart-outline',
    metricLabel: 'Dramas',
    thresholds: {
      bronze: 20,
      silver: 60,
      gold: 180,
      platinum: 450,
      ruby: 1000,
      emerald: 2200,
      diamond: 5000,
    },
  },
  {
    id: 'cosmic_explorer',
    name: 'Cosmic Explorer',
    description: 'Journey across space, science fiction, and fantasy realms.',
    category: 'genres',
    iconName: 'telescope-outline',
    metricLabel: 'Sci-Fi/Fantasy',
    thresholds: {
      bronze: 20,
      silver: 60,
      gold: 180,
      platinum: 450,
      ruby: 1000,
      emerald: 2200,
      diamond: 5000,
    },
  },
  {
    id: 'fearless_spook',
    name: 'Fearless Spook',
    description: 'Brave spine-chilling Horror and edge-of-seat Thrillers.',
    category: 'genres',
    iconName: 'skull-outline',
    metricLabel: 'Horror/Thriller',
    thresholds: {
      bronze: 15,
      silver: 45,
      gold: 120,
      platinum: 300,
      ruby: 700,
      emerald: 1500,
      diamond: 3500,
    },
  },
  {
    id: 'anime_virtuoso',
    name: 'Anime Virtuoso',
    description: 'Watch captivating Animation and Anime productions.',
    category: 'genres',
    iconName: 'color-palette-outline',
    metricLabel: 'Anime/Animation',
    thresholds: {
      bronze: 20,
      silver: 60,
      gold: 180,
      platinum: 450,
      ruby: 1000,
      emerald: 2200,
      diamond: 5000,
    },
  },
  {
    id: 'truth_seeker',
    name: 'Truth Seeker',
    description: 'Explore real-world facts, histories, and Documentaries.',
    category: 'genres',
    iconName: 'videocam-outline',
    metricLabel: 'Documentaries',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 40,
      platinum: 100,
      ruby: 250,
      emerald: 500,
      diamond: 1200,
    },
  },
  {
    id: 'romanticist',
    name: 'Romanticist',
    description: 'Watch heartwarming tales of passion, love, and Romance.',
    category: 'genres',
    iconName: 'rose-outline',
    metricLabel: 'Romances',
    thresholds: {
      bronze: 10,
      silver: 30,
      gold: 80,
      platinum: 200,
      ruby: 500,
      emerald: 1100,
      diamond: 2500,
    },
  },
  {
    id: 'detective_eye',
    name: 'Detective Eye',
    description: 'Solve puzzling Crime investigations and gripping Mysteries.',
    category: 'genres',
    iconName: 'search-outline',
    metricLabel: 'Mystery/Crime',
    thresholds: {
      bronze: 15,
      silver: 45,
      gold: 120,
      platinum: 300,
      ruby: 700,
      emerald: 1500,
      diamond: 3500,
    },
  },

  // --- Category: Cinema Eras & Decades ---
  {
    id: 'retro_rewind',
    name: 'Retro Rewind',
    description: 'Relive classic entertainment released between 1980 and 1999.',
    category: 'eras_cinema',
    iconName: 'radio-outline',
    metricLabel: '80s & 90s Titles',
    thresholds: {
      bronze: 10,
      silver: 30,
      gold: 80,
      platinum: 200,
      ruby: 500,
      emerald: 1100,
      diamond: 2500,
    },
  },
  {
    id: 'golden_classic',
    name: 'Golden Classic',
    description: 'Experience vintage silver-screen cinema from before 1970.',
    category: 'eras_cinema',
    iconName: 'disc-outline',
    metricLabel: 'Pre-1970 Classics',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 40,
      platinum: 100,
      ruby: 250,
      emerald: 500,
      diamond: 1200,
    },
  },
  {
    id: 'modern_wave',
    name: 'Modern Wave',
    description: 'Keep pace with modern cinema and TV released from 2020 onward.',
    category: 'eras_cinema',
    iconName: 'hardware-chip-outline',
    metricLabel: '2020+ Titles',
    thresholds: {
      bronze: 20,
      silver: 60,
      gold: 180,
      platinum: 450,
      ruby: 1000,
      emerald: 2200,
      diamond: 5000,
    },
  },
  {
    id: 'decade_hopper',
    name: 'Decade Hopper',
    description: 'Watch titles spanning across distinct historical decades.',
    category: 'eras_cinema',
    iconName: 'infinite-outline',
    metricLabel: 'Decades',
    thresholds: {
      bronze: 3,
      silver: 5,
      gold: 7,
      platinum: 8,
      ruby: 9,
      emerald: 10,
      diamond: 11,
    },
  },
  {
    id: 'world_explorer',
    name: 'World Explorer',
    description: 'Watch international productions and foreign language titles.',
    category: 'eras_cinema',
    iconName: 'globe-outline',
    metricLabel: 'World Titles',
    thresholds: {
      bronze: 10,
      silver: 30,
      gold: 80,
      platinum: 200,
      ruby: 500,
      emerald: 1100,
      diamond: 2500,
    },
  },
  {
    id: 'mr_worldwide',
    name: 'Mr. Worldwide',
    description: 'Track media originating from distinct countries across the globe.',
    category: 'eras_cinema',
    iconName: 'earth-outline',
    metricLabel: 'Distinct Countries',
    thresholds: {
      bronze: 3,
      silver: 7,
      gold: 15,
      platinum: 25,
      ruby: 40,
      emerald: 65,
      diamond: 100,
    },
  },
  {
    id: 'studio_loyal',
    name: 'Studio Loyal',
    description: 'Watch titles from your single most-frequented production studio.',
    category: 'eras_cinema',
    iconName: 'business-outline',
    metricLabel: 'Top Studio Titles',
    thresholds: {
      bronze: 10,
      silver: 25,
      gold: 60,
      platinum: 150,
      ruby: 350,
      emerald: 750,
      diamond: 1500,
    },
  },

  // --- Category: Curation & App Mastery ---
  {
    id: 'granular_logger',
    name: 'Granular Logger',
    description: 'Track TV progress down to specific season and episode keys.',
    category: 'curation',
    iconName: 'grid-outline',
    metricLabel: 'Shows Key-Tracked',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 40,
      platinum: 100,
      ruby: 250,
      emerald: 600,
      diamond: 1500,
    },
  },
  {
    id: 'alert_specialist',
    name: 'Alert Specialist',
    description: 'Set custom reminders for upcoming release and air dates.',
    category: 'curation',
    iconName: 'notifications-outline',
    metricLabel: 'Reminders Set',
    thresholds: {
      bronze: 3,
      silver: 8,
      gold: 20,
      platinum: 50,
      ruby: 100,
      emerald: 200,
      diamond: 400,
    },
  },
  {
    id: 'insights_scholar',
    name: 'Insights Scholar',
    description: 'Open and inspect detailed module drill-down analytics.',
    category: 'curation',
    iconName: 'stats-chart-outline',
    metricLabel: 'Drill-Downs Viewed',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 35,
      platinum: 75,
      ruby: 150,
      emerald: 300,
      diamond: 600,
    },
  },
  {
    id: 'data_guardian',
    name: 'Data Guardian',
    description: 'Perform and export full JSON database backups of your library.',
    category: 'curation',
    iconName: 'cloud-upload-outline',
    metricLabel: 'Backups Created',
    thresholds: {
      bronze: 1,
      silver: 3,
      gold: 8,
      platinum: 20,
      ruby: 50,
      emerald: 100,
      diamond: 250,
    },
  },
  {
    id: 'sync_pioneer',
    name: 'Sync Pioneer',
    description: 'Perform device-to-device local wireless library synchronizations.',
    category: 'curation',
    iconName: 'sync-outline',
    metricLabel: 'Sync Sessions',
    thresholds: {
      bronze: 1,
      silver: 3,
      gold: 8,
      platinum: 20,
      ruby: 50,
      emerald: 100,
      diamond: 250,
    },
  },
  {
    id: 'dashboard_architect',
    name: 'Dashboard Architect',
    description: 'Customize and arrange widgets on your Media Insights screen.',
    category: 'curation',
    iconName: 'options-outline',
    metricLabel: 'Layout Edits',
    thresholds: {
      bronze: 1,
      silver: 4,
      gold: 10,
      platinum: 25,
      ruby: 50,
      emerald: 100,
      diamond: 200,
    },
  },
  {
    id: 'grand_champion',
    name: 'Grand Champion',
    description: 'Ascend the peak by earning high tiers across other achievements.',
    category: 'curation',
    iconName: 'diamond-outline',
    metricLabel: 'Top Achievements',
    thresholds: {
      bronze: 5,
      silver: 15,
      gold: 10,
      platinum: 25,
      ruby: 15,
      emerald: 25,
      diamond: 35,
    },
  },
];

export const AchievementsEngine = {
  /**
   * Retrieves persisted unlock timestamps from storage.
   */
  async getStoredTimestamps(): Promise<StoredAchievementTimestamps> {
    try {
      const raw = await AsyncStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  /**
   * Saves updated unlock timestamps to storage.
   */
  async saveStoredTimestamps(data: StoredAchievementTimestamps): Promise<void> {
    try {
      await AsyncStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage write error
    }
  },

  /**
   * Retrieves extra app stats (drill-downs, backups, syncs, layouts).
   */
  async getExtraStats(): Promise<ExtraAppStats> {
    try {
      const raw = await AsyncStorage.getItem(ACHIEVEMENTS_EXTRA_STATS_KEY);
      if (!raw) return { ...DEFAULT_EXTRA_STATS };
      return { ...DEFAULT_EXTRA_STATS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_EXTRA_STATS };
    }
  },

  /**
   * Increments an extra app stat counter and updates storage.
   */
  async recordExtraStat(key: keyof ExtraAppStats, amount = 1): Promise<void> {
    try {
      const current = await this.getExtraStats();
      current[key] = (current[key] || 0) + amount;
      await AsyncStorage.setItem(ACHIEVEMENTS_EXTRA_STATS_KEY, JSON.stringify(current));
    } catch {
      // Ignore write error
    }
  },

  /**
   * Full retroactive evaluation of all achievements against current library and stored data.
   */
  async evaluateAll(items: TrackedItem[]): Promise<{
    progressList: AchievementProgress[];
    summary: AchievementStatsSummary;
  }> {
    const storedTimestamps = await this.getStoredTimestamps();
    const extraStats = await this.getExtraStats();
    let timestampsModified = false;
    const nowIso = new Date().toISOString();

    // Precompute common item filters
    const completedItems = items.filter((i) => i.status === 'completed');
    const planItems = items.filter((i) => i.status === 'plan_to_watch');

    // Build raw metric calculator per achievement
    const intermediateValues: Record<string, { value: number; contributing: ContributingMediaItem[]; subtext?: string }> = {};

    for (const def of ALL_ACHIEVEMENT_DEFINITIONS) {
      if (def.id === 'grand_champion') continue; // Evaluated in second pass

      let val = 0;
      const contributing: ContributingMediaItem[] = [];
      let subtext: string | undefined;

      switch (def.id) {
        case 'cinephile': {
          const movies = completedItems.filter((i) => i.mediaType === 'movie');
          val = movies.length;
          movies.slice(0, 50).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: 'movie',
              title: m.title,
              posterPath: m.posterPath,
              releaseYear: m.releaseYear,
              userScore: m.userScore,
            });
          });
          subtext = `${val} feature-length movies finished`;
          break;
        }

        case 'series_connoisseur': {
          const series = completedItems.filter((i) => i.mediaType === 'tv');
          val = series.length;
          series.slice(0, 50).forEach((s) => {
            contributing.push({
              id: s.id,
              mediaType: 'tv',
              title: s.title,
              posterPath: s.posterPath,
              releaseYear: s.releaseYear,
              userScore: s.userScore,
            });
          });
          subtext = `${val} complete television series finished`;
          break;
        }

        case 'episode_veteran': {
          let eps = 0;
          for (const item of items) {
            if (item.mediaType === 'tv') {
              const watched = (item.watchedEpisodeKeys && item.watchedEpisodeKeys.length > 0)
                ? item.watchedEpisodeKeys.length
                : (item.currentProgress || 0);
              const rewatches = item.rewatchCount || 0;
              const totalForShow = watched + rewatches * (item.totalEpisodes || watched);
              if (totalForShow > 0) {
                eps += totalForShow;
                contributing.push({
                  id: item.id,
                  mediaType: 'tv',
                  title: item.title,
                  posterPath: item.posterPath,
                  detailText: `${totalForShow} eps watched`,
                });
              }
            }
          }
          val = eps;
          subtext = `${eps.toLocaleString()} total episodes logged`;
          break;
        }

        case 'vault_builder': {
          val = items.length;
          items.slice(0, 40).forEach((i) => {
            contributing.push({
              id: i.id,
              mediaType: i.mediaType,
              title: i.title,
              posterPath: i.posterPath,
              releaseYear: i.releaseYear,
            });
          });
          subtext = `${val} titles tracked in library`;
          break;
        }

        case 'completionist': {
          const totalValid = items.filter((i) => i.status !== 'plan_to_watch').length;
          if (totalValid >= 10) {
            val = Math.round((completedItems.length / totalValid) * 100);
          } else {
            val = completedItems.length > 0 ? 50 : 0;
          }
          completedItems.slice(0, 30).forEach((i) => {
            contributing.push({
              id: i.id,
              mediaType: i.mediaType,
              title: i.title,
              posterPath: i.posterPath,
              detailText: 'Completed',
            });
          });
          subtext = `${val}% completion rate (${completedItems.length}/${totalValid} non-planned items)`;
          break;
        }

        case 'the_anticipator': {
          val = planItems.length;
          planItems.slice(0, 40).forEach((p) => {
            contributing.push({
              id: p.id,
              mediaType: p.mediaType,
              title: p.title,
              posterPath: p.posterPath,
            });
          });
          subtext = `${val} titles in Plan to Watch list`;
          break;
        }

        case 'dual_focus': {
          const duals = items.filter((i) => i.isAlsoPlanned);
          val = duals.length;
          duals.forEach((d) => {
            contributing.push({
              id: d.id,
              mediaType: d.mediaType,
              title: d.title,
              posterPath: d.posterPath,
            });
          });
          subtext = `${val} titles active across watching & planned`;
          break;
        }

        case 'century_club': {
          let mins = 0;
          for (const item of items) {
            if (item.mediaType === 'movie') {
              const rt = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : 100;
              const rewatches = item.rewatchCount || 0;
              if (item.status === 'completed') mins += rt * (1 + rewatches);
              else if (item.status === 'watching') mins += item.minutesWatched || Math.round(rt * 0.4);
            } else {
              const eps = (item.watchedEpisodeKeys && item.watchedEpisodeKeys.length > 0)
                ? item.watchedEpisodeKeys.length
                : (item.currentProgress || 0);
              const isAnime = item.genres?.some((g) => g.toLowerCase().includes('anim'));
              const epDuration = item.runtimeMinutes && item.runtimeMinutes > 0 ? item.runtimeMinutes : isAnime ? 24 : 42;
              const rewatches = item.rewatchCount || 0;
              mins += (eps + rewatches * (item.totalEpisodes || eps)) * epDuration;
            }
          }
          val = Math.floor(mins / 60);
          subtext = `${val.toLocaleString()} total hours of watch time`;
          break;
        }

        case 'marathon_master': {
          // Derived from highest watched episodes on single TV shows or daily velocity
          let maxSingleDay = 0;
          for (const i of items) {
            if (i.mediaType === 'tv') {
              const progress = i.currentProgress || 0;
              if (progress > maxSingleDay) {
                // Realistic proxy cap for single day
                const estimatedDaily = Math.min(progress, 30);
                if (estimatedDaily > maxSingleDay) maxSingleDay = estimatedDaily;
              }
            }
          }
          val = Math.max(maxSingleDay, extraStats.drillDownCount > 0 ? 5 : 0);
          subtext = `${val} max daily episodes logged`;
          break;
        }

        case 'the_long_haul': {
          const longShows = completedItems.filter(
            (i) => i.mediaType === 'tv' && (i.totalEpisodes || i.currentProgress || 0) >= 50
          );
          val = longShows.length;
          longShows.forEach((s) => {
            contributing.push({
              id: s.id,
              mediaType: 'tv',
              title: s.title,
              posterPath: s.posterPath,
              detailText: `${s.totalEpisodes || s.currentProgress} episodes`,
            });
          });
          subtext = `${val} shows completed with 50+ episodes`;
          break;
        }

        case 'epic_scale': {
          const longMovies = completedItems.filter(
            (i) => i.mediaType === 'movie' && (i.runtimeMinutes || 0) >= 150
          );
          val = longMovies.length;
          longMovies.forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: 'movie',
              title: m.title,
              posterPath: m.posterPath,
              detailText: `${m.runtimeMinutes} mins`,
            });
          });
          subtext = `${val} films completed with 150+ min runtimes`;
          break;
        }

        case 'encore_addict': {
          let totalRewatches = 0;
          for (const i of items) {
            if ((i.rewatchCount || 0) > 0) {
              totalRewatches += i.rewatchCount || 0;
              contributing.push({
                id: i.id,
                mediaType: i.mediaType,
                title: i.title,
                posterPath: i.posterPath,
                detailText: `${i.rewatchCount} rewatches`,
              });
            }
          }
          val = totalRewatches;
          subtext = `${val} cumulative rewatches recorded`;
          break;
        }

        case 'weekend_warrior': {
          let weekendCount = 0;
          for (const i of items) {
            const dateStr = i.finishedAt || i.lastWatchedAt || i.addedAt;
            if (dateStr) {
              const day = new Date(dateStr).getDay();
              if (day === 0 || day === 6) {
                weekendCount++;
                if (contributing.length < 30) {
                  contributing.push({
                    id: i.id,
                    mediaType: i.mediaType,
                    title: i.title,
                    posterPath: i.posterPath,
                  });
                }
              }
            }
          }
          val = weekendCount;
          subtext = `${val} weekend tracking sessions`;
          break;
        }

        case 'high_velocity': {
          // Rolling weekly episode count proxy based on recently active series
          let weeklyEps = 0;
          for (const i of items) {
            if (i.mediaType === 'tv' && i.status === 'watching') {
              weeklyEps += Math.min(i.currentProgress || 0, 15);
            }
          }
          val = Math.max(weeklyEps, completedItems.length > 5 ? 12 : 0);
          subtext = `${val} peak weekly episodes paced`;
          break;
        }

        case 'streakkeeper': {
          // Compute distinct active dates from library activity
          const uniqueDates = new Set<string>();
          for (const i of items) {
            if (i.finishedAt) uniqueDates.add(i.finishedAt.substring(0, 10));
            if (i.lastWatchedAt) uniqueDates.add(i.lastWatchedAt.substring(0, 10));
            if (i.addedAt) uniqueDates.add(i.addedAt.substring(0, 10));
          }
          val = Math.max(uniqueDates.size, items.length > 0 ? 3 : 0);
          subtext = `${val} distinct active days logged`;
          break;
        }

        case 'night_owl': {
          const nightFinishes = completedItems.filter((i) => {
            const dateStr = i.finishedAt || i.lastWatchedAt;
            if (!dateStr) return false;
            try {
              const hour = new Date(dateStr).getHours();
              return hour >= 22 || hour < 3;
            } catch {
              return false;
            }
          });
          val = nightFinishes.length;
          nightFinishes.slice(0, 30).forEach((n) => {
            contributing.push({
              id: n.id,
              mediaType: n.mediaType,
              title: n.title,
              posterPath: n.posterPath,
              detailText: 'Finished late night',
            });
          });
          subtext = `${val} titles finished between 22:00 and 03:00`;
          break;
        }

        case 'early_bird': {
          const morningFinishes = completedItems.filter((i) => {
            const dateStr = i.finishedAt || i.lastWatchedAt;
            if (!dateStr) return false;
            try {
              const hour = new Date(dateStr).getHours();
              return hour >= 5 && hour < 9;
            } catch {
              return false;
            }
          });
          val = morningFinishes.length;
          morningFinishes.slice(0, 30).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
              detailText: 'Finished early morning',
            });
          });
          subtext = `${val} titles finished between 05:00 and 09:00`;
          break;
        }

        case 'patient_resumer': {
          const resumed = completedItems.filter((i) => (i.onHoldDays || 0) > 0);
          val = resumed.length;
          resumed.slice(0, 30).forEach((r) => {
            contributing.push({
              id: r.id,
              mediaType: r.mediaType,
              title: r.title,
              posterPath: r.posterPath,
              detailText: `Paused for ${r.onHoldDays}d`,
            });
          });
          subtext = `${val} titles finished after being on hold`;
          break;
        }

        case 'rapid_finisher': {
          const rapid = completedItems.filter((i) => {
            if (!i.startedAt || !i.finishedAt) return false;
            try {
              const start = new Date(i.startedAt).getTime();
              const finish = new Date(i.finishedAt).getTime();
              const diffHours = (finish - start) / (1000 * 60 * 60);
              return diffHours >= 0 && diffHours <= 48;
            } catch {
              return false;
            }
          });
          val = rapid.length;
          rapid.slice(0, 30).forEach((r) => {
            contributing.push({
              id: r.id,
              mediaType: r.mediaType,
              title: r.title,
              posterPath: r.posterPath,
              detailText: 'Finished in under 48h',
            });
          });
          subtext = `${val} titles finished within 48h of starting`;
          break;
        }

        case 'calendar_veteran': {
          const uniqueMonths = new Set<string>();
          for (const i of items) {
            if (i.finishedAt) uniqueMonths.add(i.finishedAt.substring(0, 7));
            if (i.lastWatchedAt) uniqueMonths.add(i.lastWatchedAt.substring(0, 7));
            if (i.addedAt) uniqueMonths.add(i.addedAt.substring(0, 7));
          }
          val = uniqueMonths.size;
          subtext = `${val} unique calendar months active`;
          break;
        }

        case 'day_one_viewer': {
          const dayOne = completedItems.filter((i) => {
            if (!i.releaseDate || !i.finishedAt) return false;
            try {
              const rel = new Date(i.releaseDate).getTime();
              const fin = new Date(i.finishedAt).getTime();
              const diffDays = (fin - rel) / (1000 * 60 * 60 * 24);
              return diffDays >= 0 && diffDays <= 30;
            } catch {
              return false;
            }
          });
          val = dayOne.length;
          dayOne.slice(0, 30).forEach((d) => {
            contributing.push({
              id: d.id,
              mediaType: d.mediaType,
              title: d.title,
              posterPath: d.posterPath,
              detailText: 'Day-one completion',
            });
          });
          subtext = `${val} titles completed within 30 days of release`;
          break;
        }

        case 'seasoned_critic': {
          const rated = items.filter((i) => i.userScore > 0);
          val = rated.length;
          rated.slice(0, 40).forEach((r) => {
            contributing.push({
              id: r.id,
              mediaType: r.mediaType,
              title: r.title,
              posterPath: r.posterPath,
              userScore: r.userScore,
            });
          });
          subtext = `${val} titles awarded personal star ratings`;
          break;
        }

        case 'the_perfect_ten': {
          const tens = items.filter((i) => i.userScore === 10);
          val = tens.length;
          tens.slice(0, 40).forEach((t) => {
            contributing.push({
              id: t.id,
              mediaType: t.mediaType,
              title: t.title,
              posterPath: t.posterPath,
              userScore: 10,
            });
          });
          subtext = `${val} titles given pristine 10/10 scores`;
          break;
        }

        case 'tough_crowd': {
          const lowScores = items.filter((i) => i.userScore > 0 && i.userScore < 5);
          val = lowScores.length;
          lowScores.slice(0, 40).forEach((l) => {
            contributing.push({
              id: l.id,
              mediaType: l.mediaType,
              title: l.title,
              posterPath: l.posterPath,
              userScore: l.userScore,
            });
          });
          subtext = `${val} titles scored below 5/10`;
          break;
        }

        case 'balanced_palette': {
          const distinctScores = new Set<number>();
          items.forEach((i) => {
            if (i.userScore > 0) distinctScores.add(i.userScore);
          });
          val = distinctScores.size;
          subtext = `${val} distinct scores used from 1 to 10`;
          break;
        }

        case 'divergent_thinker': {
          const hotTakes = items.filter(
            (i) => i.userScore > 0 && i.voteAverage && Math.abs(i.userScore - i.voteAverage) >= 2
          );
          val = hotTakes.length;
          hotTakes.slice(0, 40).forEach((h) => {
            contributing.push({
              id: h.id,
              mediaType: h.mediaType,
              title: h.title,
              posterPath: h.posterPath,
              userScore: h.userScore,
              detailText: `You: ${h.userScore}★ | TMDB: ${h.voteAverage?.toFixed(1)}★`,
            });
          });
          subtext = `${val} scores divergent by 2+ stars from TMDB`;
          break;
        }

        case 'the_archival_scribe': {
          const withNotes = items.filter((i) => Boolean(i.notes && i.notes.trim().length > 0));
          val = withNotes.length;
          withNotes.slice(0, 40).forEach((n) => {
            contributing.push({
              id: n.id,
              mediaType: n.mediaType,
              title: n.title,
              posterPath: n.posterPath,
              detailText: 'Personal note attached',
            });
          });
          subtext = `${val} titles documented with personal notes`;
          break;
        }

        case 'golden_standard': {
          const greats = items.filter((i) => i.userScore >= 8);
          val = greats.length;
          greats.slice(0, 40).forEach((g) => {
            contributing.push({
              id: g.id,
              mediaType: g.mediaType,
              title: g.title,
              posterPath: g.posterPath,
              userScore: g.userScore,
            });
          });
          subtext = `${val} titles scored 8/10 or higher`;
          break;
        }

        // --- Genre Handlers ---
        case 'action_hero': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('action') || g.toLowerCase().includes('adventure'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Action & Adventure titles logged`;
          break;
        }

        case 'punchline_enthusiast': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('comed'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Comedy titles logged`;
          break;
        }

        case 'drama_aficionado': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('dram'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Drama titles logged`;
          break;
        }

        case 'cosmic_explorer': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('sci-fi') || g.toLowerCase().includes('science fiction') || g.toLowerCase().includes('fantas'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Sci-Fi & Fantasy titles logged`;
          break;
        }

        case 'fearless_spook': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('horror') || g.toLowerCase().includes('thrill'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Horror & Thriller titles logged`;
          break;
        }

        case 'anime_virtuoso': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('anim'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Anime & Animation titles logged`;
          break;
        }

        case 'truth_seeker': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('docum'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Documentaries logged`;
          break;
        }

        case 'romanticist': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('roman'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Romance titles logged`;
          break;
        }

        case 'detective_eye': {
          const matches = items.filter((i) =>
            getItemGenres(i).some((g) => g.toLowerCase().includes('myster') || g.toLowerCase().includes('crime'))
          );
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
            });
          });
          subtext = `${val} Mystery & Crime titles logged`;
          break;
        }

        // --- Cinema Eras & Decades ---
        case 'retro_rewind': {
          const matches = items.filter((i) => {
            const y = parseYear(i);
            return y !== null && y >= 1980 && y <= 1999;
          });
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
              releaseYear: m.releaseYear,
            });
          });
          subtext = `${val} 80s & 90s releases tracked`;
          break;
        }

        case 'golden_classic': {
          const matches = items.filter((i) => {
            const y = parseYear(i);
            return y !== null && y < 1970;
          });
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
              releaseYear: m.releaseYear,
            });
          });
          subtext = `${val} pre-1970 vintage titles tracked`;
          break;
        }

        case 'modern_wave': {
          const matches = items.filter((i) => {
            const y = parseYear(i);
            return y !== null && y >= 2020;
          });
          val = matches.length;
          matches.slice(0, 40).forEach((m) => {
            contributing.push({
              id: m.id,
              mediaType: m.mediaType,
              title: m.title,
              posterPath: m.posterPath,
              releaseYear: m.releaseYear,
            });
          });
          subtext = `${val} modern 2020+ releases tracked`;
          break;
        }

        case 'decade_hopper': {
          const decades = new Set<number>();
          items.forEach((i) => {
            const y = parseYear(i);
            if (y) decades.add(Math.floor(y / 10) * 10);
          });
          val = decades.size;
          subtext = `${val} unique decades represented in library`;
          break;
        }

        case 'world_explorer': {
          const worldTitles = items.filter((i) => {
            const isAnime = getItemGenres(i).some((g) => g.toLowerCase().includes('anim'));
            const hasForeignChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u0400-\u04FF\u0600-\u06FF\u0900-\u097F]/.test(i.title || '');
            return isAnime || hasForeignChars;
          });
          val = worldTitles.length;
          worldTitles.slice(0, 40).forEach((w) => {
            contributing.push({
              id: w.id,
              mediaType: w.mediaType,
              title: w.title,
              posterPath: w.posterPath,
            });
          });
          subtext = `${val} world & international titles tracked`;
          break;
        }

        case 'mr_worldwide': {
          const countryMap = new Map<string, TrackedItem>();
          const LANG_TO_COUNTRY: Record<string, string> = {
            ja: 'JP',
            ko: 'KR',
            fr: 'FR',
            de: 'DE',
            it: 'IT',
            es: 'ES',
            zh: 'CN',
            hi: 'IN',
            ru: 'RU',
            pt: 'BR',
            tr: 'TR',
            sv: 'SE',
            nl: 'NL',
            da: 'DK',
            no: 'NO',
            fi: 'FI',
            pl: 'PL',
            th: 'TH',
          };

          items.forEach((i) => {
            const rawList: string[] = Array.isArray(i.originCountries) && i.originCountries.length > 0
              ? i.originCountries
              : i.originCountry
              ? [i.originCountry]
              : Array.isArray((i as any).origin_country)
              ? (i as any).origin_country
              : [];

            if (rawList.length === 0) {
              const lang = (i as any).original_language || (i as any).originalLanguage;
              if (lang && LANG_TO_COUNTRY[lang]) {
                rawList.push(LANG_TO_COUNTRY[lang]);
              }
            }

            rawList.forEach((c) => {
              const code = (c || '').trim().toUpperCase();
              if (code && !countryMap.has(code)) {
                countryMap.set(code, i);
              }
            });
          });

          val = countryMap.size;
          Array.from(countryMap.entries())
            .slice(0, 50)
            .forEach(([code, item]) => {
              contributing.push({
                id: item.id,
                mediaType: item.mediaType,
                title: item.title,
                posterPath: item.posterPath,
                releaseYear: item.releaseYear,
                userScore: item.userScore,
                detailText: `${getCountryName(code)} (${code})`,
              });
            });
          subtext = `${val} distinct countries of origin in library`;
          break;
        }

        case 'studio_loyal': {
          const studioCounts: Record<string, number> = {};
          items.forEach((i) => {
            if (i.studios) {
              i.studios.forEach((s) => {
                studioCounts[s] = (studioCounts[s] || 0) + 1;
              });
            }
          });
          let maxCount = 0;
          let topStudio = 'Top Studio';
          for (const [st, c] of Object.entries(studioCounts)) {
            if (c > maxCount) {
              maxCount = c;
              topStudio = st;
            }
          }
          val = maxCount;
          subtext = `${maxCount} titles from your top studio (${topStudio})`;
          break;
        }

        // --- Curation & Mastery ---
        case 'granular_logger': {
          const granular = items.filter((i) => (i.watchedEpisodeKeys?.length || 0) > 0);
          val = granular.length;
          granular.slice(0, 30).forEach((g) => {
            contributing.push({
              id: g.id,
              mediaType: g.mediaType,
              title: g.title,
              posterPath: g.posterPath,
              detailText: `${g.watchedEpisodeKeys?.length} episode keys`,
            });
          });
          subtext = `${val} series tracked with granular episode keys`;
          break;
        }

        case 'alert_specialist': {
          const alerts = items.filter((i) => i.reminder?.enabled);
          val = alerts.length;
          alerts.forEach((a) => {
            contributing.push({
              id: a.id,
              mediaType: a.mediaType,
              title: a.title,
              posterPath: a.posterPath,
              detailText: 'Reminder active',
            });
          });
          subtext = `${val} active air date notifications configured`;
          break;
        }

        case 'insights_scholar': {
          val = extraStats.drillDownCount;
          subtext = `${val} module drill-down details inspected`;
          break;
        }

        case 'data_guardian': {
          val = extraStats.backupCount;
          subtext = `${val} full library JSON backups exported`;
          break;
        }

        case 'sync_pioneer': {
          val = extraStats.syncCount;
          subtext = `${val} wireless device syncs executed`;
          break;
        }

        case 'dashboard_architect': {
          val = extraStats.layoutCustomizationCount;
          subtext = `${val} insight dashboard layouts customized`;
          break;
        }

        default:
          val = 0;
          break;
      }

      intermediateValues[def.id] = { value: val, contributing, subtext };
    }

    // First pass to determine tiers for standard 49 achievements
    const progressList: AchievementProgress[] = [];
    let highTierCount = 0;

    for (const def of ALL_ACHIEVEMENT_DEFINITIONS) {
      if (def.id === 'grand_champion') continue;

      const inter = intermediateValues[def.id] || { value: 0, contributing: [] };
      const val = inter.value;
      const th = def.thresholds;

      // Determine current tier
      let currentTier: AchievementTier = 'locked';
      if (val >= th.diamond) currentTier = 'diamond';
      else if (val >= th.emerald) currentTier = 'emerald';
      else if (val >= th.ruby) currentTier = 'ruby';
      else if (val >= th.platinum) currentTier = 'platinum';
      else if (val >= th.gold) currentTier = 'gold';
      else if (val >= th.silver) currentTier = 'silver';
      else if (val >= th.bronze) currentTier = 'bronze';

      if (currentTier === 'gold' || currentTier === 'platinum' || currentTier === 'ruby' || currentTier === 'emerald' || currentTier === 'diamond') {
        highTierCount++;
      }

      // Next tier target and progress
      let nextTier: AchievementTier | null = null;
      let nextTierTarget = th.bronze;
      let prevTarget = 0;

      if (currentTier === 'locked') {
        nextTier = 'bronze';
        nextTierTarget = th.bronze;
        prevTarget = 0;
      } else if (currentTier === 'bronze') {
        nextTier = 'silver';
        nextTierTarget = th.silver;
        prevTarget = th.bronze;
      } else if (currentTier === 'silver') {
        nextTier = 'gold';
        nextTierTarget = th.gold;
        prevTarget = th.silver;
      } else if (currentTier === 'gold') {
        nextTier = 'platinum';
        nextTierTarget = th.platinum;
        prevTarget = th.gold;
      } else if (currentTier === 'platinum') {
        nextTier = 'ruby';
        nextTierTarget = th.ruby;
        prevTarget = th.platinum;
      } else if (currentTier === 'ruby') {
        nextTier = 'emerald';
        nextTierTarget = th.emerald;
        prevTarget = th.ruby;
      } else if (currentTier === 'emerald') {
        nextTier = 'diamond';
        nextTierTarget = th.diamond;
        prevTarget = th.emerald;
      } else {
        nextTier = null;
        nextTierTarget = th.diamond;
        prevTarget = th.emerald;
      }

      let progressPercent = 0;
      if (currentTier === 'diamond') {
        progressPercent = 1;
      } else if (nextTierTarget > prevTarget) {
        progressPercent = Math.min(1, Math.max(0, (val - prevTarget) / (nextTierTarget - prevTarget)));
      }

      // Record unlock timestamps retroactively
      const currentTimestamps = storedTimestamps[def.id] || {};
      for (const t of TIER_ORDER) {
        const threshold = th[t];
        if (val >= threshold && !currentTimestamps[t]) {
          currentTimestamps[t] = nowIso;
          timestampsModified = true;
        }
      }
      storedTimestamps[def.id] = currentTimestamps;

      progressList.push({
        definition: def,
        currentTier,
        currentValue: val,
        displayValue: def.isPercentage ? `${val}%` : val.toLocaleString(),
        nextTier,
        nextTierTarget,
        progressPercent,
        isMaxed: currentTier === 'diamond',
        unlockedAt: currentTimestamps,
        contributingItems: inter.contributing,
        contributingSubtext: inter.subtext,
      });
    }

    // Second pass: Evaluate 'grand_champion'
    const grandChampDef = ALL_ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'grand_champion')!;
    const grandVal = highTierCount;
    const gcTh = grandChampDef.thresholds;

    let gcTier: AchievementTier = 'locked';
    if (grandVal >= gcTh.diamond) gcTier = 'diamond';
    else if (grandVal >= gcTh.emerald) gcTier = 'emerald';
    else if (grandVal >= gcTh.ruby) gcTier = 'ruby';
    else if (grandVal >= gcTh.platinum) gcTier = 'platinum';
    else if (grandVal >= gcTh.gold) gcTier = 'gold';
    else if (grandVal >= gcTh.silver) gcTier = 'silver';
    else if (grandVal >= gcTh.bronze) gcTier = 'bronze';

    let gcNext: AchievementTier | null = null;
    let gcTarget = gcTh.bronze;
    let gcPrev = 0;
    if (gcTier === 'locked') { gcNext = 'bronze'; gcTarget = gcTh.bronze; gcPrev = 0; }
    else if (gcTier === 'bronze') { gcNext = 'silver'; gcTarget = gcTh.silver; gcPrev = gcTh.bronze; }
    else if (gcTier === 'silver') { gcNext = 'gold'; gcTarget = gcTh.gold; gcPrev = gcTh.silver; }
    else if (gcTier === 'gold') { gcNext = 'platinum'; gcTarget = gcTh.platinum; gcPrev = gcTh.gold; }
    else if (gcTier === 'platinum') { gcNext = 'ruby'; gcTarget = gcTh.ruby; gcPrev = gcTh.platinum; }
    else if (gcTier === 'ruby') { gcNext = 'emerald'; gcTarget = gcTh.emerald; gcPrev = gcTh.ruby; }
    else if (gcTier === 'emerald') { gcNext = 'diamond'; gcTarget = gcTh.diamond; gcPrev = gcTh.emerald; }

    const gcPercent = gcTier === 'diamond' ? 1 : Math.min(1, Math.max(0, (grandVal - gcPrev) / (gcTarget - gcPrev)));

    const gcTimestamps = storedTimestamps.grand_champion || {};
    for (const t of TIER_ORDER) {
      if (grandVal >= gcTh[t] && !gcTimestamps[t]) {
        gcTimestamps[t] = nowIso;
        timestampsModified = true;
      }
    }
    storedTimestamps.grand_champion = gcTimestamps;

    progressList.push({
      definition: grandChampDef,
      currentTier: gcTier,
      currentValue: grandVal,
      displayValue: grandVal.toString(),
      nextTier: gcNext,
      nextTierTarget: gcTarget,
      progressPercent: gcPercent,
      isMaxed: gcTier === 'diamond',
      unlockedAt: gcTimestamps,
      contributingSubtext: `${grandVal} achievements reached Gold or higher`,
    });

    if (timestampsModified) {
      await this.saveStoredTimestamps(storedTimestamps);
    }

    // Compute Overall Stats Summary
    const tierCounts: Record<AchievementTier, number> = {
      locked: 0,
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      ruby: 0,
      emerald: 0,
      diamond: 0,
    };

    let totalTierPoints = 0;
    const maxPossiblePoints = progressList.length * 7;

    for (const p of progressList) {
      tierCounts[p.currentTier]++;
      totalTierPoints += TIER_CONFIG[p.currentTier].order;
    }

    const unlockedCount = progressList.filter((p) => p.currentTier !== 'locked').length;
    const maxedCount = tierCounts.diamond;
    const completionScorePercent = Math.round((totalTierPoints / maxPossiblePoints) * 100);

    return {
      progressList,
      summary: {
        totalAchievements: progressList.length,
        unlockedCount,
        maxedCount,
        tierCounts,
        completionScorePercent,
      },
    };
  },
};
