import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import {
  InsightWidgetConfig,
  InsightWidgetSize,
  INSIGHT_WIDGET_DEFINITIONS,
} from '@/types/insights';
import { getTextScale, getHeaderScale } from '@/utils/sizing';

interface InsightQuickConfigModalProps {
  visible: boolean;
  widgetConfig: InsightWidgetConfig | null;
  onClose: () => void;
  onOpenFullCustomizer: () => void;
}

export function InsightQuickConfigModal({
  visible,
  widgetConfig,
  onClose,
  onOpenFullCustomizer,
}: InsightQuickConfigModalProps) {
  if (!visible || !widgetConfig) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}>
      <InsightQuickConfigModalContent
        widgetConfig={widgetConfig}
        onClose={onClose}
        onOpenFullCustomizer={onOpenFullCustomizer}
      />
    </Modal>
  );
}

function InsightQuickConfigModalContent({
  widgetConfig,
  onClose,
  onOpenFullCustomizer,
}: {
  widgetConfig: InsightWidgetConfig;
  onClose: () => void;
  onOpenFullCustomizer: () => void;
}) {
  const { colors } = useAppTheme();
  const {
    sizingConfig,
    triggerHaptic,
    insightsLayout,
    setInsightWidgetSize,
    toggleInsightWidget,
    reorderInsightWidget,
  } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);

  const def = INSIGHT_WIDGET_DEFINITIONS[widgetConfig.id];
  const currentIndex = insightsLayout.findIndex((w) => w.id === widgetConfig.id);
  const canMoveUp = currentIndex > 0;
  const canMoveDown = currentIndex >= 0 && currentIndex < insightsLayout.length - 1;

  const handleSelectSize = async (size: InsightWidgetSize) => {
    triggerHaptic('selection');
    await setInsightWidgetSize(widgetConfig.id, size);
    onClose();
  };

  const handleMoveUp = async () => {
    if (!canMoveUp) return;
    triggerHaptic('selection');
    await reorderInsightWidget(currentIndex, currentIndex - 1);
    onClose();
  };

  const handleMoveDown = async () => {
    if (!canMoveDown) return;
    triggerHaptic('selection');
    await reorderInsightWidget(currentIndex, currentIndex + 1);
    onClose();
  };

  const handleHide = async () => {
    triggerHaptic('warning');
    await toggleInsightWidget(widgetConfig.id, false);
    onClose();
  };

  const SIZES: { id: InsightWidgetSize; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'auto', label: 'Auto Size', icon: 'sparkles-outline' },
    { id: 'full', label: 'Full Width', icon: 'tablet-landscape-outline' },
    { id: 'half', label: 'Half Width', icon: 'grid-outline' },
    { id: 'compact', label: 'Compact', icon: 'remove-outline' },
  ];

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable
        style={[
          styles.container,
          { backgroundColor: colors.background, borderColor: colors.cardBorder },
        ]}
        onPress={(e) => e.stopPropagation()}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name={def?.icon || 'analytics'} size={20 * headerScale} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text, fontSize: 16 * headerScale }]}>
              {def?.title || 'Widget Options'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
              Customize size and positioning
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Size Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 11 * headerScale }]}>
            CARD SIZE
          </Text>
          <View style={styles.sizeRow}>
            {SIZES.map((s) => {
              const isSelected = widgetConfig.size === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[
                    styles.sizeBtn,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    isSelected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                  ]}
                  onPress={() => handleSelectSize(s.id)}>
                  <Ionicons
                    name={s.icon}
                    size={16 * textScale}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sizeBtnText,
                      { color: isSelected ? colors.primary : colors.text, fontSize: 11 * textScale },
                      isSelected && { fontWeight: '700' },
                    ]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Reordering Row */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 11 * headerScale }]}>
            POSITIONING
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                !canMoveUp && { opacity: 0.4 },
              ]}
              disabled={!canMoveUp}
              onPress={handleMoveUp}>
              <Ionicons name="arrow-up" size={16 * textScale} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text, fontSize: 12.5 * textScale }]}>
                Move Up
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                !canMoveDown && { opacity: 0.4 },
              ]}
              disabled={!canMoveDown}
              onPress={handleMoveDown}>
              <Ionicons name="arrow-down" size={16 * textScale} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text, fontSize: 12.5 * textScale }]}>
                Move Down
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom Actions: Hide + Full Customizer */}
        <View style={[styles.footer, { borderTopColor: colors.cardBorder }]}>
          <Pressable
            style={[styles.hideBtn, { borderColor: '#ef4444' }]}
            onPress={handleHide}>
            <Ionicons name="eye-off-outline" size={15 * textScale} color="#ef4444" />
            <Text style={[styles.hideBtnText, { fontSize: 12.5 * textScale }]}>
              Hide from Insights
            </Text>
          </Pressable>

          <Pressable
            style={[styles.fullCustomizerBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              triggerHaptic('selection');
              onClose();
              onOpenFullCustomizer();
            }}>
            <Ionicons name="options-outline" size={15 * textScale} color="#ffffff" />
            <Text style={[styles.fullCustomizerBtnText, { fontSize: 12.5 * textScale }]}>
              All Widgets...
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  sizeBtnText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  hideBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  hideBtnText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  fullCustomizerBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  fullCustomizerBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
