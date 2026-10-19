import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Path,
  Circle,
  G,
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
    glow: 'rgba(205, 127, 50, 0.55)',
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
    glow: 'rgba(215, 225, 235, 0.65)',
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
    glow: 'rgba(255, 215, 0, 0.65)',
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
    glow: 'rgba(192, 216, 237, 0.65)',
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
    glow: 'rgba(224, 17, 95, 0.65)',
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
    glow: 'rgba(80, 200, 120, 0.65)',
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
    glow: 'rgba(184, 216, 231, 0.7)',
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
  animate?: boolean;
  scale?: number;
}

export function MetallicAchievementBadge({
  tier,
  iconName,
  size = 136,
  animate = true,
  scale = 1,
}: MetallicAchievementBadgeProps) {
  const isLocked = tier === 'locked';
  const palette = METALLIC_PALETTES[tier];

  // Continuous rotation of the sunburst rays (slow, majestic solar spin)
  const [spinAnim] = useState(() => new Animated.Value(0));
  // Twinkling glint shimmer animation
  const [shimmerAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!animate || isLocked) {
      spinAnim.setValue(0);
      shimmerAnim.setValue(0);
      return;
    }

    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinLoop.start();
    shimmerLoop.start();

    return () => {
      spinLoop.stop();
      shimmerLoop.stop();
      spinAnim.setValue(0);
      shimmerAnim.setValue(0);
    };
  }, [animate, isLocked, spinAnim, shimmerAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  // Radii dimensions for Sun Rays, Ring, and Inner Dish
  const cx = size / 2;
  const cy = size / 2;
  const rOuterRay = size * 0.485;
  const rInnerRay = size * 0.33;
  const rRing = size * 0.32;
  const rDish = size * 0.30;
  const iconSize = Math.round(size * 0.33 * scale);

  // 8-Ray Concave Sunburst Path matching the user sketch
  const sunburstPath = useMemo(() => {
    const numRays = 8;
    const angleStep = (Math.PI * 2) / numRays;
    const halfStep = angleStep / 2;
    const rValley = rInnerRay;
    const rCtrl = rInnerRay * 1.05; // pulled close to base circle for dramatic concave scoops

    let d = '';
    for (let i = 0; i < numRays; i++) {
      const tipAngle = i * angleStep - Math.PI / 2; // Ray 0 at 12 o'clock
      const prevValAngle = tipAngle - halfStep;
      const nextValAngle = tipAngle + halfStep;

      const tipX = cx + rOuterRay * Math.cos(tipAngle);
      const tipY = cy + rOuterRay * Math.sin(tipAngle);

      const valX = cx + rValley * Math.cos(nextValAngle);
      const valY = cy + rValley * Math.sin(nextValAngle);

      const ctrlInAngle = tipAngle - halfStep * 0.48;
      const ctrlInX = cx + rCtrl * Math.cos(ctrlInAngle);
      const ctrlInY = cy + rCtrl * Math.sin(ctrlInAngle);

      const ctrlOutAngle = tipAngle + halfStep * 0.48;
      const ctrlOutX = cx + rCtrl * Math.cos(ctrlOutAngle);
      const ctrlOutY = cy + rCtrl * Math.sin(ctrlOutAngle);

      if (i === 0) {
        const startValX = cx + rValley * Math.cos(prevValAngle);
        const startValY = cy + rValley * Math.sin(prevValAngle);
        d += `M ${startValX.toFixed(2)} ${startValY.toFixed(2)} `;
      }

      d += `Q ${ctrlInX.toFixed(2)} ${ctrlInY.toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)} `;
      d += `Q ${ctrlOutX.toFixed(2)} ${ctrlOutY.toFixed(2)} ${valX.toFixed(2)} ${valY.toFixed(2)} `;
    }

    d += 'Z';
    return d;
  }, [cx, cy, rOuterRay, rInnerRay]);

  // Diamond Star Sparkle coordinates at the 8 ray tips
  const sparkleCoordinates = useMemo(() => {
    const coords: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 - Math.PI / 2;
      coords.push({
        x: cx + (rOuterRay - 3) * Math.cos(angle),
        y: cy + (rOuterRay - 3) * Math.sin(angle),
      });
    }
    return coords;
  }, [cx, cy, rOuterRay]);

  return (
    <View style={[styles.badgeWrapper, { width: size, height: size }]}>
      {/* Layer 1: Ambient Outer Glow Halo */}
      {!isLocked && (
        <View style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={palette.core} stopOpacity="0.65" />
                <Stop offset="55%" stopColor={palette.core} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={palette.core} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={size * 0.49} fill="url(#haloGrad)" />
          </Svg>
        </View>
      )}

      {/* Layer 2: Rotating Sunburst Rays & Twinkling Sparkles */}
      {!isLocked && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ rotate: spinInterpolate }],
            },
          ]}>
          <Svg width={size} height={size}>
            <Defs>
              {/* Metallic Gradient for Sunburst Rays */}
              <LinearGradient id="sunRaysGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={palette.highlight} stopOpacity="1" />
                <Stop offset="28%" stopColor={palette.sheen} stopOpacity="0.95" />
                <Stop offset="55%" stopColor={palette.core} stopOpacity="0.9" />
                <Stop offset="82%" stopColor={palette.sheen} stopOpacity="0.85" />
                <Stop offset="100%" stopColor={palette.dark} stopOpacity="0.8" />
              </LinearGradient>

              {/* Sparkle Glint Gradient */}
              <RadialGradient id="sparkleGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="60%" stopColor={palette.highlight} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={palette.sheen} stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* 8 Flared Sunburst Rays */}
            <Path d={sunburstPath} fill="url(#sunRaysGrad)" />

            {/* Radiant Sparkle Glints at the 8 Sun Ray Tips */}
            <G>
              {sparkleCoordinates.map((pt, idx) => (
                <Path
                  key={idx}
                  d={`M ${pt.x} ${pt.y - 4} Q ${pt.x} ${pt.y} ${pt.x + 4} ${pt.y} Q ${pt.x} ${pt.y} ${pt.x} ${pt.y + 4} Q ${pt.x} ${pt.y} ${pt.x - 4} ${pt.y} Q ${pt.x} ${pt.y} ${pt.x} ${pt.y - 4} Z`}
                  fill="url(#sparkleGrad)"
                />
              ))}
            </G>
          </Svg>
        </Animated.View>
      )}

      {/* Layer 3: Central Specular Ring and Metallic Dish (Static Base) */}
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
              <Stop offset="0%" stopColor={palette.sheen} stopOpacity="0.9" />
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

          {/* Crisp Specular Border Ring (White / Specular Bevel as drawn in user diagram) */}
          <Circle
            cx={cx}
            cy={cy}
            r={rRing}
            fill="none"
            stroke={isLocked ? '#475569' : 'url(#metallicRingGrad)'}
            strokeWidth={3.5}
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

      {/* Layer 4: Centered Metallic Icon */}
      <View style={styles.centerIconWrapper}>
        <Ionicons
          name={isLocked ? 'lock-closed' : (iconName as any)}
          size={iconSize}
          color={isLocked ? '#64748b' : palette.iconColor}
        />
      </View>

      {/* Layer 5: Dynamic Sparkle Shimmer Overlay */}
      {!isLocked && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmerGlint,
            {
              top: cy - rDish * 0.7,
              left: cx - rDish * 0.7,
              opacity: shimmerOpacity,
            },
          ]}>
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M 7 0 Q 7 7 14 7 Q 7 7 7 14 Q 7 7 0 7 Q 7 7 7 0 Z"
              fill="#FFFFFF"
            />
          </Svg>
        </Animated.View>
      )}
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
  shimmerGlint: {
    position: 'absolute',
    width: 14,
    height: 14,
  },
});
