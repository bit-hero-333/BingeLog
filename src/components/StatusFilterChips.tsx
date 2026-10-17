import React from 'react';
import { ScrollView, Text, StyleSheet, Pressable, View, ColorValue } from 'react-native';
import { MediaStatus, STATUS_CONFIG } from '@/types/media';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { getTextScale } from '@/utils/sizing';

export type FilterStatus = 'all' | MediaStatus;

interface StatusFilterChipsProps {
  selectedStatus: FilterStatus;
  onSelect: (status: FilterStatus) => void;
  counts: Record<FilterStatus, number>;
}

export function StatusFilterChips({
  selectedStatus,
  onSelect,
  counts,
}: StatusFilterChipsProps) {
  const { colors } = useAppTheme();
  const { triggerHaptic, sizingConfig } = useMedia();
  const textScale = getTextScale(sizingConfig?.textSize);

  const options: { id: FilterStatus; label: string; color: ColorValue }[] = [
    { id: 'all', label: 'All', color: colors.primary },
    { id: 'watching', label: 'Watching', color: STATUS_CONFIG.watching.color },
    { id: 'plan_to_watch', label: 'Plan to Watch', color: STATUS_CONFIG.plan_to_watch.color },
    { id: 'completed', label: 'Completed', color: STATUS_CONFIG.completed.color },
    { id: 'on_hold', label: 'On Hold', color: STATUS_CONFIG.on_hold.color },
    { id: 'dropped', label: 'Dropped', color: STATUS_CONFIG.dropped.color },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {options.map((opt) => {
        const isSelected = selectedStatus === opt.id;
        const count = counts[opt.id] ?? 0;

        return (
          <Pressable
            key={opt.id}
            style={[
              styles.chip,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              isSelected && {
                backgroundColor: opt.color,
                borderColor: opt.color,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              onSelect(opt.id);
            }}>
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? '#ffffff' : colors.textSecondary, fontSize: Math.round(13 * textScale) },
                isSelected && styles.chipTextSelected,
              ]}>
              {opt.label}
            </Text>
            <View
              style={[
                styles.badge,
                isSelected ? styles.badgeSelected : { backgroundColor: colors.cardSelected },
              ]}>
              <Text
                style={[
                  styles.badgeText,
                  { color: isSelected ? '#ffffff' : colors.textSecondary, fontSize: Math.round(11 * textScale) },
                  isSelected && styles.badgeTextSelected,
                ]}>
                {count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextSelected: {
    color: '#ffffff',
  },
});
