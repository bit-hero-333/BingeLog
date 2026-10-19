import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import {
  InsightCategory,
  InsightWidgetConfig,
  InsightWidgetSize,
  InsightWidgetDefinition,
  INSIGHT_CATEGORIES,
  INSIGHT_WIDGET_DEFINITIONS,
  DEFAULT_INSIGHTS_LAYOUT,
} from '@/types/insights';
import { getTextScale, getHeaderScale, getButtonScale } from '@/utils/sizing';
import { AchievementsEngine } from '@/services/achievementsEngine';

interface CustomizeInsightsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CustomizeInsightsModal({ visible, onClose }: CustomizeInsightsModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <CustomizeInsightsModalContent onClose={onClose} />
    </Modal>
  );
}

interface WidgetRowItemProps {
  item: InsightWidgetConfig;
  def?: InsightWidgetDefinition;
  colors: any;
  headerScale: number;
  textScale: number;
  canUp: boolean;
  canDown: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onSetSize: (id: string, size: InsightWidgetSize) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const WidgetRowItem = React.memo(function WidgetRowItem({
  item,
  def,
  colors,
  headerScale,
  textScale,
  canUp,
  canDown,
  onToggle,
  onSetSize,
  onMoveUp,
  onMoveDown,
}: WidgetRowItemProps) {
  return (
    <View
      style={[
        styles.widgetRow,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
        !item.enabled && { opacity: 0.6 },
      ]}>
      <View style={styles.widgetRowTop}>
        <View style={styles.widgetInfoLeft}>
          <View
            style={[
              styles.widgetIconBadge,
              { backgroundColor: item.enabled ? colors.primaryBg : colors.inputBg },
            ]}>
            <Ionicons
              name={def?.icon || 'analytics'}
              size={18 * headerScale}
              color={item.enabled ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.widgetTextCol}>
            <Text
              style={[styles.widgetTitle, { color: colors.text, fontSize: 13.5 * textScale }]}
              numberOfLines={1}>
              {def?.title || item.id}
            </Text>
            <Text
              style={[
                styles.widgetSubtitle,
                { color: colors.textSecondary, fontSize: 11.5 * textScale },
              ]}
              numberOfLines={1}>
              {def?.subtitle || ''}
            </Text>
          </View>
        </View>

        <Switch
          value={item.enabled}
          onValueChange={(val) => onToggle(item.id, val)}
          thumbColor="#ffffff"
          trackColor={{ false: colors.cardBorder, true: colors.primary }}
        />
      </View>

      {item.enabled && (
        <View style={[styles.widgetControlsRow, { borderTopColor: colors.cardBorder }]}>
          {/* Size Selector */}
          <View style={styles.sizePillsGroup}>
            {(['auto', 'full', 'half', 'compact'] as InsightWidgetSize[]).map((s) => {
              const isSizeSelected = item.size === s;
              return (
                <Pressable
                  key={s}
                  style={[
                    styles.sizePill,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                    isSizeSelected && {
                      backgroundColor: colors.primaryBg,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => onSetSize(item.id, s)}>
                  <Text
                    style={[
                      styles.sizePillText,
                      {
                        color: isSizeSelected ? colors.primary : colors.textSecondary,
                        fontSize: 10.5 * textScale,
                      },
                      isSizeSelected && { fontWeight: '700' },
                    ]}>
                    {s.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Reorder Buttons */}
          <View style={styles.reorderButtons}>
            <Pressable
              style={[
                styles.reorderBtn,
                { borderColor: colors.cardBorder },
                !canUp && { opacity: 0.3 },
              ]}
              disabled={!canUp}
              onPress={onMoveUp}>
              <Ionicons name="chevron-up" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              style={[
                styles.reorderBtn,
                { borderColor: colors.cardBorder },
                !canDown && { opacity: 0.3 },
              ]}
              disabled={!canDown}
              onPress={onMoveDown}>
              <Ionicons name="chevron-down" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
});

function CustomizeInsightsModalContent({ onClose }: { onClose: () => void }) {
  const { colors } = useAppTheme();
  const {
    sizingConfig,
    triggerHaptic,
    insightsLayout,
    updateInsightsLayout,
    resetInsightsLayout,
  } = useMedia();
  const { height } = useWindowDimensions();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const buttonScale = getButtonScale(sizingConfig?.buttonSize);
  const sheetHeight = Math.round(height * 0.9);

  // Local draft of layout
  const [draftLayout, setDraftLayout] = useState<InsightWidgetConfig[]>(insightsLayout);
  const [selectedCategory, setSelectedCategory] = useState<InsightCategory | 'all'>('all');

  const filteredWidgets = useMemo(() => {
    return draftLayout.filter((w) => {
      if (selectedCategory === 'all') return true;
      const def = INSIGHT_WIDGET_DEFINITIONS[w.id];
      return def && def.category === selectedCategory;
    });
  }, [draftLayout, selectedCategory]);

  const enabledCount = useMemo(() => {
    return draftLayout.filter((w) => w.enabled).length;
  }, [draftLayout]);

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      triggerHaptic('selection');
      setDraftLayout((prev) =>
        prev.map((w) => (w.id === id ? { ...w, enabled } : w))
      );
    },
    [triggerHaptic]
  );

  const handleSetSize = useCallback(
    (id: string, size: InsightWidgetSize) => {
      triggerHaptic('selection');
      setDraftLayout((prev) =>
        prev.map((w) => (w.id === id ? { ...w, size } : w))
      );
    },
    [triggerHaptic]
  );

  const handleMove = useCallback(
    (indexInFiltered: number, direction: 'up' | 'down') => {
      triggerHaptic('selection');
      setDraftLayout((prev) => {
        const filtered = prev.filter((w) => {
          if (selectedCategory === 'all') return true;
          const def = INSIGHT_WIDGET_DEFINITIONS[w.id];
          return def && def.category === selectedCategory;
        });
        const targetItem = filtered[indexInFiltered];
        if (!targetItem) return prev;

        const fullIndex = prev.findIndex((w) => w.id === targetItem.id);
        if (fullIndex < 0) return prev;

        const targetSwapIndex = direction === 'up' ? fullIndex - 1 : fullIndex + 1;
        if (targetSwapIndex < 0 || targetSwapIndex >= prev.length) return prev;

        const copy = [...prev];
        const [moved] = copy.splice(fullIndex, 1);
        copy.splice(targetSwapIndex, 0, moved);
        return copy.map((item, idx) => ({ ...item, order: idx }));
      });
    },
    [selectedCategory, triggerHaptic]
  );

  const handleSave = async () => {
    triggerHaptic('success');
    void AchievementsEngine.recordExtraStat('layoutCustomizationCount');
    await updateInsightsLayout(draftLayout);
    onClose();
  };

  const handleReset = async () => {
    triggerHaptic('warning');
    setDraftLayout(DEFAULT_INSIGHTS_LAYOUT);
    await resetInsightsLayout();
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            height: sheetHeight,
            borderColor: colors.cardBorder,
          },
        ]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIconBadge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="options-outline" size={20 * headerScale} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text, fontSize: 16 * headerScale }]}>
                Customize Media Insights
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                {enabledCount} of {draftLayout.length} active widgets
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Categories Bar */}
        <View style={styles.categoriesBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}>
            <Pressable
              style={[
                styles.categoryChip,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                selectedCategory === 'all' && {
                  backgroundColor: colors.primaryBg,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setSelectedCategory('all');
              }}>
              <Text
                style={[
                  styles.categoryChipText,
                  {
                    color: selectedCategory === 'all' ? colors.primary : colors.text,
                    fontSize: 11.5 * textScale,
                  },
                  selectedCategory === 'all' && { fontWeight: '700' },
                ]}>
                All ({draftLayout.length})
              </Text>
            </Pressable>

            {INSIGHT_CATEGORIES.map((cat) => {
              const count = draftLayout.filter(
                (w) => INSIGHT_WIDGET_DEFINITIONS[w.id]?.category === cat.id
              ).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isSelected && {
                      backgroundColor: colors.primaryBg,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedCategory(cat.id);
                  }}>
                  <Ionicons
                    name={cat.icon}
                    size={12 * textScale}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color: isSelected ? colors.primary : colors.text,
                        fontSize: 11.5 * textScale,
                      },
                      isSelected && { fontWeight: '700' },
                    ]}>
                    {cat.label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Widgets List */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled">
          {filteredWidgets.map((item, index) => {
            const def = INSIGHT_WIDGET_DEFINITIONS[item.id];
            const fullIndex = draftLayout.findIndex((w) => w.id === item.id);
            const canUp = fullIndex > 0;
            const canDown = fullIndex >= 0 && fullIndex < draftLayout.length - 1;

            return (
              <WidgetRowItem
                key={item.id}
                item={item}
                def={def}
                colors={colors}
                headerScale={headerScale}
                textScale={textScale}
                canUp={canUp}
                canDown={canDown}
                onToggle={handleToggle}
                onSetSize={handleSetSize}
                onMoveUp={() => handleMove(index, 'up')}
                onMoveDown={() => handleMove(index, 'down')}
              />
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.cardBorder }]}>
          <Pressable
            style={[
              styles.resetBtn,
              { borderColor: colors.cardBorder, minHeight: Math.round(44 * buttonScale) },
            ]}
            onPress={handleReset}>
            <Ionicons name="refresh-outline" size={16 * textScale} color={colors.textSecondary} />
            <Text
              style={[
                styles.resetBtnText,
                { color: colors.textSecondary, fontSize: 13 * textScale },
              ]}>
              Reset
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary, minHeight: Math.round(44 * buttonScale) },
            ]}
            onPress={handleSave}>
            <Ionicons name="checkmark" size={18 * textScale} color="#ffffff" />
            <Text style={[styles.saveBtnText, { fontSize: 13.5 * textScale }]}>
              Apply Layout ({enabledCount})
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  categoriesBar: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  categoriesScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    paddingBottom: 30,
  },
  widgetRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  widgetRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  widgetIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetTextCol: {
    flex: 1,
    gap: 2,
  },
  widgetTitle: {
    fontWeight: '700',
  },
  widgetSubtitle: {
    fontWeight: '500',
  },
  widgetControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  sizePillsGroup: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  sizePill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sizePillText: {
    fontWeight: '600',
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetBtnText: {
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
