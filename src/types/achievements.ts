export type AchievementTier =
  | 'locked'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'ruby'
  | 'emerald'
  | 'diamond';

export type AchievementCategory =
  | 'all'
  | 'milestones'
  | 'binge_time'
  | 'habits'
  | 'ratings'
  | 'genres'
  | 'eras_cinema'
  | 'curation';

export interface TierVisualConfig {
  label: string;
  color: string;
  glow: string;
  order: number;
}

export const TIER_CONFIG: Record<AchievementTier, TierVisualConfig> = {
  locked: {
    label: 'Locked',
    color: '#475569',
    glow: 'rgba(71, 85, 105, 0.15)',
    order: 0,
  },
  bronze: {
    label: 'Bronze',
    color: '#CD7F32',
    glow: 'rgba(205, 127, 50, 0.22)',
    order: 1,
  },
  silver: {
    label: 'Silver',
    color: '#C0C0C0',
    glow: 'rgba(192, 192, 192, 0.25)',
    order: 2,
  },
  gold: {
    label: 'Gold',
    color: '#FFD700',
    glow: 'rgba(255, 215, 0, 0.25)',
    order: 3,
  },
  platinum: {
    label: 'Platinum',
    color: '#C0D8ED',
    glow: 'rgba(192, 216, 237, 0.28)',
    order: 4,
  },
  ruby: {
    label: 'Ruby',
    color: '#E0115F',
    glow: 'rgba(224, 17, 95, 0.28)',
    order: 5,
  },
  emerald: {
    label: 'Emerald',
    color: '#50C878',
    glow: 'rgba(80, 200, 120, 0.28)',
    order: 6,
  },
  diamond: {
    label: 'Diamond',
    color: '#B8D8E7',
    glow: 'rgba(184, 216, 231, 0.35)',
    order: 7,
  },
};

export type EarnedTier = Exclude<AchievementTier, 'locked'>;

export const TIER_ORDER: EarnedTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'ruby',
  'emerald',
  'diamond',
];

export interface TierThresholds {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  ruby: number;
  emerald: number;
  diamond: number;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  iconName: string; // Ionicons icon name
  metricLabel: string;
  thresholds: TierThresholds;
  // If true, metric is displayed as percentage
  isPercentage?: boolean;
}

export interface ContributingMediaItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  releaseYear?: string;
  userScore?: number;
  detailText?: string;
}

export interface AchievementProgress {
  definition: AchievementDefinition;
  currentTier: AchievementTier;
  currentValue: number;
  displayValue: string;
  nextTier: AchievementTier | null;
  nextTierTarget: number;
  progressPercent: number; // 0 to 1
  isMaxed: boolean;
  unlockedAt: Partial<Record<AchievementTier, string>>; // ISO timestamp
  contributingItems?: ContributingMediaItem[];
  contributingSubtext?: string;
}

export interface StoredAchievementTimestamps {
  [achievementId: string]: Partial<Record<AchievementTier, string>>;
}

export interface AchievementStatsSummary {
  totalAchievements: number;
  unlockedCount: number; // >= bronze
  maxedCount: number; // == diamond
  tierCounts: Record<AchievementTier, number>;
  completionScorePercent: number; // weighted or total progress
}
