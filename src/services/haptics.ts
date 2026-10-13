import * as Haptics from 'expo-haptics';

export type HapticIntensity = 'off' | 'light' | 'medium' | 'heavy';

export const HAPTIC_INTENSITY_LABELS: Record<HapticIntensity, string> = {
  off: 'Off',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
};

let activeIntensity: HapticIntensity = 'medium';

export const HapticsService = {
  setIntensity(intensity: HapticIntensity) {
    activeIntensity = intensity;
  },

  getIntensity(): HapticIntensity {
    return activeIntensity;
  },

  trigger(type: 'selection' | 'impact' | 'success' | 'warning' | 'error' = 'impact') {
    if (activeIntensity === 'off') return;

    try {
      if (type === 'selection') {
        void Haptics.selectionAsync();
        return;
      }
      if (type === 'success') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      if (type === 'warning') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      if (type === 'error') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // 'impact'
      switch (activeIntensity) {
        case 'light':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } catch {
      // Fail silently if vibration hardware is missing or disabled
    }
  },

  triggerTest(intensity: HapticIntensity) {
    if (intensity === 'off') return;

    try {
      switch (intensity) {
        case 'light':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } catch {
      // Fail silently
    }
  },
};
