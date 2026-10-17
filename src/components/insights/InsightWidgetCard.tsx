import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import {
  InsightWidgetConfig,
  InsightWidgetId,
  INSIGHT_WIDGET_DEFINITIONS,
} from '@/types/insights';
import { InsightsEngine, WidgetSurfaceData } from '@/services/insightsEngine';
import { getTextScale, getHeaderScale } from '@/utils/sizing';
import { TrackedItem } from '@/types/media';

interface InsightWidgetCardProps {
  config: InsightWidgetConfig;
  items: TrackedItem[];
  onPress: (id: InsightWidgetId) => void;
  onLongPress: (config: InsightWidgetConfig) => void;
  isPair?: boolean;
}

export function InsightWidgetCard({
  config,
  items,
  onPress,
  onLongPress,
  isPair,
}: InsightWidgetCardProps) {
  const { colors } = useAppTheme();
  const { sizingConfig, triggerHaptic } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);

  const def = INSIGHT_WIDGET_DEFINITIONS[config.id];
  const surface: WidgetSurfaceData = InsightsEngine.computeSurface(config.id, items);

  const effectiveSize = config.size === 'auto' ? def.defaultSize : config.size;

  const handlePress = () => {
    triggerHaptic('selection');
    onPress(config.id);
  };

  const handleLongPress = () => {
    triggerHaptic('impact');
    onLongPress(config);
  };

  // Compact Banner Style
  if (effectiveSize === 'compact') {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compactCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}>
        <View style={[styles.compactIcon, { backgroundColor: colors.primaryBg }]}>
          <Ionicons name={def.icon} size={15 * textScale} color={colors.primary} />
        </View>
        <Text style={[styles.compactTitle, { color: colors.textSecondary, fontSize: 11.5 * textScale }]} numberOfLines={1}>
          {def.title}:
        </Text>
        <Text style={[styles.compactValue, { color: colors.text, fontSize: 12.5 * textScale }]} numberOfLines={1}>
          {surface.primaryValue}
        </Text>
        <Ionicons name="chevron-forward" size={13 * textScale} color={colors.textMuted} />
      </Pressable>
    );
  }

  // Half-Width Square Style
  if (effectiveSize === 'half') {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.halfCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}>
        <View style={styles.halfCardHeader}>
          <View style={[styles.halfIconBadge, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name={def.icon} size={16 * textScale} color={colors.primary} />
          </View>
          <Ionicons name="chevron-forward" size={13 * textScale} color={colors.textMuted} />
        </View>

        <View style={styles.halfCardBody}>
          <Text style={[styles.halfCardTitle, { color: colors.textSecondary, fontSize: 11 * headerScale }]} numberOfLines={1}>
            {def.title.toUpperCase()}
          </Text>
          <Text style={[styles.halfCardValue, { color: colors.text, fontSize: 19 * headerScale }]} numberOfLines={1}>
            {surface.primaryValue}
          </Text>
          {surface.secondaryValue && (
            <Text style={[styles.halfCardSub, { color: colors.textMuted, fontSize: 10.5 * textScale }]} numberOfLines={1}>
              {surface.secondaryValue}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  // Full-Width Card Style (Default)
  return (
    <Pressable
      style={({ pressed }) => [
        styles.fullCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}>
      <View style={styles.fullCardTop}>
        <View style={styles.fullCardTitleGroup}>
          <View style={[styles.fullIconBadge, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name={def.icon} size={18 * headerScale} color={colors.primary} />
          </View>
          <View style={styles.fullTitleCol}>
            <Text style={[styles.fullCardEyebrow, { color: colors.primary, fontSize: 10.5 * textScale }]}>
              {def.title.toUpperCase()}
            </Text>
            <Text style={[styles.fullCardMain, { color: colors.text, fontSize: 24 * headerScale }]} numberOfLines={1}>
              {surface.primaryValue}
            </Text>
          </View>
        </View>

        <View style={styles.fullCardTopRight}>
          {surface.badgeText && (
            <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.badgeText, { color: colors.primary, fontSize: 10.5 * textScale }]}>
                {surface.badgeText}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16 * textScale} color={colors.textSecondary} />
        </View>
      </View>

      {surface.secondaryValue && (
        <Text style={[styles.fullCardSubtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
          {surface.secondaryValue}
        </Text>
      )}

      {/* Mini Bar Chart if chartData exists */}
      {surface.chartData && surface.chartData.length > 0 && (
        <View style={styles.chartContainer}>
          {surface.chartData.map((bar, idx) => {
            const maxVal = Math.max(...surface.chartData!.map((c) => c.value), 1);
            const heightPct = Math.min(100, Math.max(14, Math.round((bar.value / maxVal) * 100)));
            return (
              <View key={idx} style={styles.chartBarCol}>
                <View style={[styles.chartBarBg, { backgroundColor: colors.inputBg }]}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        backgroundColor: colors.primary,
                        height: `${heightPct}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartBarLabel, { color: colors.textMuted, fontSize: 9.5 * textScale }]} numberOfLines={1}>
                  {bar.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Progress Bar if progress exists */}
      {surface.progress !== undefined && (
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.inputBg }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: colors.primary, width: `${Math.round(surface.progress * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  fullCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fullCardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  fullIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullTitleCol: {
    flex: 1,
  },
  fullCardEyebrow: {
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  fullCardMain: {
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  fullCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontWeight: '700',
  },
  fullCardSubtitle: {
    fontWeight: '500',
    lineHeight: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 48,
    gap: 6,
    marginTop: 6,
    paddingTop: 4,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    height: '100%',
  },
  chartBarBg: {
    width: '100%',
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  chartBarLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBarWrap: {
    marginTop: 4,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  halfCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    minHeight: 100,
  },
  halfCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  halfIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfCardBody: {
    gap: 2,
  },
  halfCardTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  halfCardValue: {
    fontWeight: '800',
  },
  halfCardSub: {
    fontWeight: '500',
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  compactIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    fontWeight: '700',
  },
  compactValue: {
    flex: 1,
    fontWeight: '800',
  },
});
