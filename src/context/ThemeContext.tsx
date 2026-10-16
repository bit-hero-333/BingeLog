import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  ThemeMode,
  ThemePresetId,
  ThemeColors,
  PRESET_THEMES,
  getDynamicThemeColors,
} from '@/constants/theme';
import { StorageService, SavedThemeConfig } from '@/services/storage';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  preset: ThemePresetId;
  colors: ThemeColors;
  customAccent: string;
  customCardColor: string;
  setMode: (mode: ThemeMode) => Promise<void>;
  setPreset: (preset: ThemePresetId) => Promise<void>;
  setCustomAccent: (hex: string) => Promise<void>;
  setCustomCardColor: (hex: string) => Promise<void>;
  resetTheme: () => Promise<void>;
}

const DEFAULT_THEME_CONFIG: SavedThemeConfig = {
  mode: 'dark',
  preset: 'midnight',
  customAccent: '#a855f7',
  customCardColor: '#161b26',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(56, 189, 248, ${alpha})`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_CONFIG.mode);
  const [preset, setPresetState] = useState<ThemePresetId>(DEFAULT_THEME_CONFIG.preset);
  const [customAccent, setCustomAccentState] = useState<string>(DEFAULT_THEME_CONFIG.customAccent || '#a855f7');
  const [customCardColor, setCustomCardColorState] = useState<string>(DEFAULT_THEME_CONFIG.customCardColor || '#161b26');

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const saved = await StorageService.getThemeConfig();
        if (saved) {
          if (saved.mode) setModeState(saved.mode);
          if (saved.preset) setPresetState(saved.preset);
          if (saved.customAccent) setCustomAccentState(saved.customAccent);
          if (saved.customCardColor) setCustomCardColorState(saved.customCardColor);
        }
      } catch (e) {
        console.error('Failed to load theme config', e);
      }
    }
    loadSavedTheme();
  }, []);

  const saveConfig = async (updated: Partial<SavedThemeConfig>) => {
    const nextConfig: SavedThemeConfig = {
      mode: updated.mode ?? mode,
      preset: updated.preset ?? preset,
      customAccent: updated.customAccent ?? customAccent,
      customCardColor: updated.customCardColor ?? customCardColor,
    };
    await StorageService.saveThemeConfig(nextConfig);
  };

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await saveConfig({ mode: newMode });
  };

  const setPreset = async (newPreset: ThemePresetId) => {
    setPresetState(newPreset);
    await saveConfig({ preset: newPreset });
  };

  const setCustomAccent = async (hex: string) => {
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;
    setCustomAccentState(cleanHex);
    setPresetState('custom');
    await saveConfig({ customAccent: cleanHex, preset: 'custom' });
  };

  const setCustomCardColor = async (hex: string) => {
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;
    setCustomCardColorState(cleanHex);
    setPresetState('custom');
    await saveConfig({ customCardColor: cleanHex, preset: 'custom' });
  };

  const resetTheme = async () => {
    setModeState('dark');
    setPresetState('midnight');
    setCustomAccentState('#a855f7');
    setCustomCardColorState('#161b26');
    await StorageService.saveThemeConfig(DEFAULT_THEME_CONFIG);
  };

  const isDark = mode === 'dark';

  const colors = useMemo<ThemeColors>(() => {
    if (preset === 'dynamic') {
      return getDynamicThemeColors(mode);
    }

    if (preset !== 'custom' && PRESET_THEMES[preset as keyof typeof PRESET_THEMES]) {
      return PRESET_THEMES[preset as keyof typeof PRESET_THEMES][mode];
    }

    // Custom theme: derive base from midnight, customize with user's accent and card colors
    const base = PRESET_THEMES.midnight[mode];
    const accent = customAccent || (isDark ? '#a855f7' : '#9333ea');
    const cardColor = customCardColor || base.card;

    return {
      ...base,
      card: cardColor,
      primary: accent,
      primaryBg: hexToRgba(accent, isDark ? 0.16 : 0.12),
      primaryText: isDark ? accent : '#ffffff',
    };
  }, [preset, mode, customAccent, customCardColor, isDark]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        preset,
        colors,
        customAccent,
        customCardColor,
        setMode,
        setPreset,
        setCustomAccent,
        setCustomCardColor,
        resetTheme,
      }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
