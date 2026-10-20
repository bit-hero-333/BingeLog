import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import { AchievementTier } from '@/types/achievements';

export interface MetallicPalette {
  highlight: string;
  sheen: string;
  core: string;
  dark: string;
  deepShadow: string;
  glow: string;
  ringHighlight: string;
  ringBase: string;
  ringShadow: string;
  iconColor: string;
}

export const METALLIC_PALETTES: Record<AchievementTier, MetallicPalette> = {
  locked: {
    highlight: '#94a3b8',
    sheen: '#64748b',
    core: '#475569',
    dark: '#334155',
    deepShadow: '#1e293b',
    glow: 'transparent',
    ringHighlight: '#64748b',
    ringBase: '#475569',
    ringShadow: '#1e293b',
    iconColor: '#64748b',
  },
  bronze: {
    highlight: '#FFE8D6',
    sheen: '#E8A265',
    core: '#CD7F32',
    dark: '#9E4E18',
    deepShadow: '#4A1F06',
    glow: 'rgba(205, 127, 50, 0.75)',
    ringHighlight: '#FFF0E3',
    ringBase: '#CD7F32',
    ringShadow: '#3D1703',
    iconColor: '#FFF2E6',
  },
  silver: {
    highlight: '#FFFFFF',
    sheen: '#EAEFF2',
    core: '#C0C0C0',
    dark: '#7D8B99',
    deepShadow: '#2F3841',
    glow: 'rgba(215, 225, 235, 0.85)',
    ringHighlight: '#FFFFFF',
    ringBase: '#D8DEE4',
    ringShadow: '#485460',
    iconColor: '#FFFFFF',
  },
  gold: {
    highlight: '#FFFFE0',
    sheen: '#FFE57F',
    core: '#FFD700',
    dark: '#D4AF37',
    deepShadow: '#5C3E00',
    glow: 'rgba(255, 215, 0, 0.85)',
    ringHighlight: '#FFFFFF',
    ringBase: '#FFD700',
    ringShadow: '#6B4700',
    iconColor: '#FFFFF0',
  },
  platinum: {
    highlight: '#FFFFFF',
    sheen: '#E1F0FA',
    core: '#C0D8ED',
    dark: '#7B9EB8',
    deepShadow: '#223547',
    glow: 'rgba(192, 216, 237, 0.85)',
    ringHighlight: '#FFFFFF',
    ringBase: '#C0D8ED',
    ringShadow: '#31485E',
    iconColor: '#FFFFFF',
  },
  ruby: {
    highlight: '#FFD6E5',
    sheen: '#FF4583',
    core: '#E0115F',
    dark: '#910537',
    deepShadow: '#3D0013',
    glow: 'rgba(224, 17, 95, 0.85)',
    ringHighlight: '#FFE4EE',
    ringBase: '#FF3377',
    ringShadow: '#4A0219',
    iconColor: '#FFF0F5',
  },
  emerald: {
    highlight: '#D6FCE6',
    sheen: '#72E898',
    core: '#50C878',
    dark: '#1B8240',
    deepShadow: '#062B13',
    glow: 'rgba(80, 200, 120, 0.85)',
    ringHighlight: '#E3FDF0',
    ringBase: '#50C878',
    ringShadow: '#0B3819',
    iconColor: '#F0FFF6',
  },
  diamond: {
    highlight: '#FFFFFF',
    sheen: '#E4F5FD',
    core: '#B8D8E7',
    dark: '#6E9BB8',
    deepShadow: '#192E3F',
    glow: 'rgba(184, 216, 231, 0.9)',
    ringHighlight: '#FFFFFF',
    ringBase: '#CDE5F2',
    ringShadow: '#243C50',
    iconColor: '#FFFFFF',
  },
};

interface MetallicAchievementBadgeProps {
  tier: AchievementTier;
  iconName: string;
  size?: number;
  showGlow?: boolean;
  animateGlow?: boolean;
  scale?: number;
}

export function MetallicAchievementBadge({
  tier,
  iconName,
  size = 136,
  showGlow = true,
  animateGlow = true,
  scale = 1,
}: MetallicAchievementBadgeProps) {
  const isLocked = tier === 'locked';
  const palette = METALLIC_PALETTES[tier];

  // Breathing animation for the pure circular glow halo
  const [glowAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!showGlow || !animateGlow || isLocked) {
      glowAnim.setValue(0);
      return;
    }

    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    breathingLoop.start();

    return () => {
      breathingLoop.stop();
      glowAnim.setValue(0);
    };
  }, [showGlow, animateGlow, isLocked, glowAnim]);

  // The glow effect grows more intense (less transparent / more color) and expands from inwards to outwards
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.18],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.90],
  });

  const cx = size / 2;
  const cy = size / 2;

  // When showGlow is false (e.g. list cards), the medal tightly fills the container
  const rRing = showGlow ? size * 0.33 : size * 0.46;
  const rDish = showGlow ? size * 0.31 : size * 0.43;
  const iconSize = Math.round(size * (showGlow ? 0.34 : 0.46) * scale);
  const ringStrokeWidth = showGlow ? 3.5 : 2.5;

  return (
    <View style={[styles.badgeWrapper, { width: size, height: size }]}>
      {/* Layer 1: Pure Breathing Circular Glow Halo (Zero shapes, zero rays, zero spinning) */}
      {showGlow && !isLocked && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="breathingHaloGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={palette.core} stopOpacity="0.85" />
                <Stop offset="45%" stopColor={palette.core} stopOpacity="0.60" />
                <Stop offset="75%" stopColor={palette.sheen} stopOpacity="0.30" />
                <Stop offset="100%" stopColor={palette.core} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={size * 0.48} fill="url(#breathingHaloGrad)" />
          </Svg>
        </Animated.View>
      )}

      {/* Layer 2: Central Metallic Circle (100% static, solid, no scaling) */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Defs>
            {/* Specular Metallic Ring Gradient (Beveled Rim) */}
            <LinearGradient id="metallicRingGrad" x1="15%" y1="15%" x2="85%" y2="85%">
              <Stop offset="0%" stopColor={palette.ringHighlight} stopOpacity="1" />
              <Stop offset="30%" stopColor={palette.ringBase} stopOpacity="1" />
              <Stop offset="70%" stopColor={palette.ringShadow} stopOpacity="1" />
              <Stop offset="100%" stopColor={palette.ringHighlight} stopOpacity="0.8" />
            </LinearGradient>

            {/* Polished Metallic Inner Dish Radial Gradient */}
            <RadialGradient id="metallicDishGrad" cx="38%" cy="32%" r="62%">
              <Stop offset="0%" stopColor={palette.sheen} stopOpacity="0.95" />
              <Stop offset="35%" stopColor={palette.core} stopOpacity="0.95" />
              <Stop offset="75%" stopColor={palette.dark} stopOpacity="1" />
              <Stop offset="100%" stopColor={palette.deepShadow} stopOpacity="1" />
            </RadialGradient>
          </Defs>

          {/* Inner Metallic Dish */}
          <Circle
            cx={cx}
            cy={cy}
            r={rDish}
            fill={isLocked ? '#1e293b' : 'url(#metallicDishGrad)'}
          />

          {/* Crisp Specular Border Ring (White / Metallic Bevel Rim) */}
          <Circle
            cx={cx}
            cy={cy}
            r={rRing}
            fill="none"
            stroke={isLocked ? '#475569' : 'url(#metallicRingGrad)'}
            strokeWidth={ringStrokeWidth}
          />

          {/* Inner Specular Highlight Rim */}
          {!isLocked && (
            <Circle
              cx={cx}
              cy={cy}
              r={rDish}
              fill="none"
              stroke={palette.highlight}
              strokeWidth={1}
              strokeOpacity={0.4}
            />
          )}
        </Svg>
      </View>

      {/* Layer 3: Centered Metallic Icon */}
      <View style={styles.centerIconWrapper}>
        <Ionicons
          name={isLocked ? 'lock-closed' : (iconName as any)}
          size={iconSize}
          color={isLocked ? '#64748b' : palette.iconColor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerIconWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
