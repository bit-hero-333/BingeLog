import React from 'react';
import { ScrollView, Text, StyleSheet, Pressable, View } from 'react-native';
import { MediaStatus, STATUS_CONFIG } from '@/types/media';

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
  const options: { id: FilterStatus; label: string; color: string }[] = [
    { id: 'all', label: 'All', color: '#38bdf8' },
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
              isSelected && {
                backgroundColor: opt.color,
                borderColor: opt.color,
              },
            ]}
            onPress={() => onSelect(opt.id)}>
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
              ]}>
              {opt.label}
            </Text>
            <View
              style={[
                styles.badge,
                isSelected ? styles.badgeSelected : { backgroundColor: '#262d3d' },
              ]}>
              <Text
                style={[
                  styles.badgeText,
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
    backgroundColor: '#161922',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#000000',
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
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextSelected: {
    color: '#000000',
  },
});
