import { ElementScale } from '@/types/media';

/**
 * Universal scale multipliers for granular UI sizing.
 * Strictly zero emojis.
 */
export function getTextScale(textSize: ElementScale = 'medium'): number {
  switch (textSize) {
    case 'small':
      return 0.88;
    case 'large':
      return 1.14;
    case 'xlarge':
      return 1.28;
    case 'medium':
    default:
      return 1.0;
  }
}

export function getHeaderScale(headerSize: ElementScale = 'medium'): number {
  switch (headerSize) {
    case 'small':
      return 0.88;
    case 'large':
      return 1.15;
    case 'xlarge':
      return 1.30;
    case 'medium':
    default:
      return 1.0;
  }
}

export function getButtonScale(buttonSize: ElementScale = 'medium'): number {
  switch (buttonSize) {
    case 'small':
      return 0.85;
    case 'large':
      return 1.15;
    case 'xlarge':
      return 1.28;
    case 'medium':
    default:
      return 1.0;
  }
}

export function getPosterScale(posterSize: ElementScale = 'medium'): number {
  switch (posterSize) {
    case 'small':
      return 0.85;
    case 'large':
      return 1.15;
    case 'xlarge':
      return 1.30;
    case 'medium':
    default:
      return 1.0;
  }
}

export function getProviderScale(providerSize: ElementScale = 'medium'): number {
  switch (providerSize) {
    case 'small':
      return 0.85;
    case 'large':
      return 1.18;
    case 'xlarge':
      return 1.35;
    case 'medium':
    default:
      return 1.0;
  }
}

export function scaleValue(base: number, multiplier: number, min?: number, max?: number): number {
  const scaled = Math.round(base * multiplier);
  if (min !== undefined && scaled < min) return min;
  if (max !== undefined && scaled > max) return max;
  return scaled;
}
