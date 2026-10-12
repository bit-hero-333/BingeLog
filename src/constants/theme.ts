import { Platform } from 'react-native';

export type ThemeMode = 'dark' | 'light';

export type ThemePresetId = 'midnight' | 'amoled' | 'emerald' | 'crimson' | 'ochre' | 'tmdb' | 'custom';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  cardSelected: string;
  primary: string;
  primaryBg: string;
  primaryText: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  headerBg: string;
  tabBg: string;
  tabBorder: string;
  divider: string;
  danger: string;
  warning: string;
  success: string;
}

export interface ThemePresetMeta {
  id: ThemePresetId;
  label: string;
  description: string;
  accentPreview: string;
  darkBgPreview: string;
  lightBgPreview: string;
}

export const THEME_PRESET_METAS: ThemePresetMeta[] = [
  {
    id: 'midnight',
    label: 'Midnight Slate',
    description: 'Deep navy-slate with sky blue accents',
    accentPreview: '#38bdf8',
    darkBgPreview: '#0d1017',
    lightBgPreview: '#f8fafc',
  },
  {
    id: 'tmdb',
    label: 'TMDB Deep Ocean',
    description: 'Official TMDB dark blue (#0d253f), cyan (#01b4e4) & mint (#90cea1)',
    accentPreview: '#01b4e4',
    darkBgPreview: '#0d253f',
    lightBgPreview: '#f0f9ff',
  },
  {
    id: 'amoled',
    label: 'Pure AMOLED',
    description: 'True pitch black (#000000) for OLED displays',
    accentPreview: '#60a5fa',
    darkBgPreview: '#000000',
    lightBgPreview: '#ffffff',
  },
  {
    id: 'emerald',
    label: 'Forest Emerald',
    description: 'Lush dark evergreen with vibrant mint accents',
    accentPreview: '#10b981',
    darkBgPreview: '#06130d',
    lightBgPreview: '#f0fdf4',
  },
  {
    id: 'crimson',
    label: 'Wine Crimson',
    description: 'Rich dark ruby and elegant rose tones',
    accentPreview: '#f43f5e',
    darkBgPreview: '#15080e',
    lightBgPreview: '#fff1f2',
  },
  {
    id: 'ochre',
    label: 'Sand Ochre',
    description: 'Warm desert dunes and golden amber highlights',
    accentPreview: '#f59e0b',
    darkBgPreview: '#141008',
    lightBgPreview: '#fefce8',
  },
  {
    id: 'custom',
    label: 'Custom Accent',
    description: 'Pick your own custom accent and surface colors',
    accentPreview: '#a855f7',
    darkBgPreview: '#0d1017',
    lightBgPreview: '#ffffff',
  },
];

export const PRESET_THEMES: Record<Exclude<ThemePresetId, 'custom'>, { dark: ThemeColors; light: ThemeColors }> = {
  midnight: {
    dark: {
      background: '#0d1017',
      card: '#161b26',
      cardBorder: '#263043',
      cardSelected: '#222d42',
      primary: '#38bdf8',
      primaryBg: 'rgba(56, 189, 248, 0.16)',
      primaryText: '#0369a1',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      inputBg: '#111622',
      headerBg: '#0d1017',
      tabBg: '#0d1017',
      tabBorder: '#1e2433',
      divider: '#1e2433',
      danger: '#ef4444',
      warning: '#f59e0b',
      success: '#22c55e',
    },
    light: {
      background: '#f8fafc',
      card: '#ffffff',
      cardBorder: '#e2e8f0',
      cardSelected: '#f1f5f9',
      primary: '#0284c7',
      primaryBg: 'rgba(2, 132, 199, 0.12)',
      primaryText: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      inputBg: '#ffffff',
      headerBg: '#ffffff',
      tabBg: '#ffffff',
      tabBorder: '#e2e8f0',
      divider: '#e2e8f0',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    },
  },
  amoled: {
    dark: {
      background: '#000000',
      card: '#0c0c0e',
      cardBorder: '#27272a',
      cardSelected: '#18181b',
      primary: '#60a5fa',
      primaryBg: 'rgba(96, 165, 250, 0.16)',
      primaryText: '#1d4ed8',
      text: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      inputBg: '#141416',
      headerBg: '#000000',
      tabBg: '#000000',
      tabBorder: '#1f1f23',
      divider: '#27272a',
      danger: '#f87171',
      warning: '#fbbf24',
      success: '#4ade80',
    },
    light: {
      background: '#ffffff',
      card: '#f4f4f5',
      cardBorder: '#d4d4d8',
      cardSelected: '#e4e4e7',
      primary: '#2563eb',
      primaryBg: 'rgba(37, 99, 235, 0.12)',
      primaryText: '#ffffff',
      text: '#09090b',
      textSecondary: '#52525b',
      textMuted: '#71717a',
      inputBg: '#ffffff',
      headerBg: '#ffffff',
      tabBg: '#ffffff',
      tabBorder: '#e4e4e7',
      divider: '#e4e4e7',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    },
  },
  emerald: {
    dark: {
      background: '#06130d',
      card: '#0e2218',
      cardBorder: '#193f2c',
      cardSelected: '#163827',
      primary: '#10b981',
      primaryBg: 'rgba(16, 185, 129, 0.16)',
      primaryText: '#047857',
      text: '#f0fdf4',
      textSecondary: '#86efac',
      textMuted: '#4ade80',
      inputBg: '#0b1a13',
      headerBg: '#06130d',
      tabBg: '#06130d',
      tabBorder: '#163926',
      divider: '#193f2c',
      danger: '#f87171',
      warning: '#fbbf24',
      success: '#34d399',
    },
    light: {
      background: '#f0fdf4',
      card: '#ffffff',
      cardBorder: '#bbf7d0',
      cardSelected: '#dcfce7',
      primary: '#059669',
      primaryBg: 'rgba(5, 150, 105, 0.12)',
      primaryText: '#ffffff',
      text: '#064e3b',
      textSecondary: '#15803d',
      textMuted: '#16a34a',
      inputBg: '#f7fee7',
      headerBg: '#ffffff',
      tabBg: '#ffffff',
      tabBorder: '#bbf7d0',
      divider: '#bbf7d0',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    },
  },
  crimson: {
    dark: {
      background: '#15080e',
      card: '#240f1a',
      cardBorder: '#471e35',
      cardSelected: '#381628',
      primary: '#f43f5e',
      primaryBg: 'rgba(244, 63, 94, 0.16)',
      primaryText: '#be123c',
      text: '#fff1f2',
      textSecondary: '#fda4af',
      textMuted: '#fb7185',
      inputBg: '#1c0b15',
      headerBg: '#15080e',
      tabBg: '#15080e',
      tabBorder: '#3d182c',
      divider: '#471e35',
      danger: '#f43f5e',
      warning: '#fbbf24',
      success: '#4ade80',
    },
    light: {
      background: '#fff1f2',
      card: '#ffffff',
      cardBorder: '#fecdd3',
      cardSelected: '#ffe4e6',
      primary: '#e11d48',
      primaryBg: 'rgba(225, 29, 72, 0.12)',
      primaryText: '#ffffff',
      text: '#881337',
      textSecondary: '#9f1239',
      textMuted: '#be123c',
      inputBg: '#fff5f7',
      headerBg: '#ffffff',
      tabBg: '#ffffff',
      tabBorder: '#fecdd3',
      divider: '#fecdd3',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    },
  },
  ochre: {
    dark: {
      background: '#141008',
      card: '#231c10',
      cardBorder: '#453a20',
      cardSelected: '#362d19',
      primary: '#f59e0b',
      primaryBg: 'rgba(245, 158, 11, 0.16)',
      primaryText: '#b45309',
      text: '#fffbeb',
      textSecondary: '#fde68a',
      textMuted: '#fbbf24',
      inputBg: '#1b160d',
      headerBg: '#141008',
      tabBg: '#141008',
      tabBorder: '#3b311b',
      divider: '#453a20',
      danger: '#ef4444',
      warning: '#f59e0b',
      success: '#22c55e',
    },
    light: {
      background: '#fefce8',
      card: '#ffffff',
      cardBorder: '#fde047',
      cardSelected: '#fef9c3',
      primary: '#d97706',
      primaryBg: 'rgba(217, 119, 6, 0.12)',
      primaryText: '#ffffff',
      text: '#78350f',
      textSecondary: '#92400e',
      textMuted: '#b45309',
      inputBg: '#fffdf5',
      headerBg: '#ffffff',
      tabBg: '#ffffff',
      tabBorder: '#fde047',
      divider: '#fde047',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    },
  },
  tmdb: {
    dark: {
      background: '#0d253f',
      card: '#13385c',
      cardBorder: '#1c4d7e',
      cardSelected: '#19426c',
      primary: '#01b4e4',
      primaryBg: 'rgba(1, 180, 228, 0.16)',
      primaryText: '#01b4e4',
      text: '#f0f9ff',
      textSecondary: '#90cea1',
      textMuted: '#67a3b6',
      inputBg: '#091c30',
      headerBg: '#0d253f',
      tabBg: '#0d253f',
      tabBorder: '#173c62',
      divider: '#1c4d7e',
      danger: '#ef4444',
      warning: '#f59e0b',
      success: '#90cea1',
    },
    light: {
      background: '#f0f9ff',
      card: '#ffffff',
      cardBorder: '#bae6fd',
      cardSelected: '#e0f2fe',
      primary: '#01b4e4',
      primaryBg: 'rgba(1, 180, 228, 0.12)',
      primaryText: '#ffffff',
      text: '#0d253f',
      textSecondary: '#0284c7',
      textMuted: '#51869e',
      inputBg: '#f8fafc',
      headerBg: '#ffffff',
      tabBg: '#ffffff',
      tabBorder: '#bae6fd',
      divider: '#bae6fd',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#10b981',
    },
  },
};

export const QUICK_ACCENTS = [
  { name: 'TMDB Cyan', hex: '#01b4e4' },
  { name: 'TMDB Mint', hex: '#90cea1' },
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Royal Blue', hex: '#3b82f6' },
  { name: 'Neon Purple', hex: '#a855f7' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Rose Pink', hex: '#ec4899' },
  { name: 'Wine Crimson', hex: '#f43f5e' },
  { name: 'Sunset Orange', hex: '#f97316' },
  { name: 'Amber Ochre', hex: '#f59e0b' },
  { name: 'Forest Emerald', hex: '#10b981' },
  { name: 'Teal Cyan', hex: '#06b6d4' },
];

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Colors = {
  light: {
    text: PRESET_THEMES.midnight.light.text,
    background: PRESET_THEMES.midnight.light.background,
    backgroundElement: PRESET_THEMES.midnight.light.card,
    backgroundSelected: PRESET_THEMES.midnight.light.cardSelected,
    textSecondary: PRESET_THEMES.midnight.light.textSecondary,
  },
  dark: {
    text: PRESET_THEMES.midnight.dark.text,
    background: PRESET_THEMES.midnight.dark.background,
    backgroundElement: PRESET_THEMES.midnight.dark.card,
    backgroundSelected: PRESET_THEMES.midnight.dark.cardSelected,
    textSecondary: PRESET_THEMES.midnight.dark.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
