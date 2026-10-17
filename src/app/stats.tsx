import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';
import { getTextScale, getHeaderScale, getButtonScale } from '@/utils/sizing';
import { TrackModal } from '@/components/TrackModal';
import { TrackedItem } from '@/types/media';
import {
  InsightWidgetConfig,
  InsightWidgetId,
  InsightDrillDownPayload,
  INSIGHT_WIDGET_DEFINITIONS,
} from '@/types/insights';
import { InsightsEngine } from '@/services/insightsEngine';
import { InsightWidgetCard } from '@/components/insights/InsightWidgetCard';
import { InsightDrillDownModal } from '@/components/insights/InsightDrillDownModal';
import { InsightQuickConfigModal } from '@/components/insights/InsightQuickConfigModal';
import { CustomizeInsightsModal } from '@/components/insights/CustomizeInsightsModal';

export default function StatsScreen() {
  const { trackedItems, triggerHaptic, sizingConfig, insightsLayout, resetInsightsLayout, saveItem, removeItem } = useMedia();
  const { colors } = useAppTheme();
  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const buttonScale = getButtonScale(sizingConfig?.buttonSize);
  const { width } = useWindowDimensions();
  const isTablet = width >= 720;

  // Modals state
  const [drillDownPayload, setDrillDownPayload] = useState<InsightDrillDownPayload | null>(null);
  const [quickConfigWidget, setQuickConfigWidget] = useState<InsightWidgetConfig | null>(null);
  const [fullCustomizerVisible, setFullCustomizerVisible] = useState(false);
  const [selectedTrackItem, setSelectedTrackItem] = useState<TrackedItem | null>(null);
  const [trackModalVisible, setTrackModalVisible] = useState(false);

  // Hardware back button support
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (trackModalVisible) {
          setTrackModalVisible(false);
          setSelectedTrackItem(null);
          return true;
        }
        if (drillDownPayload) {
          setDrillDownPayload(null);
          return true;
        }
        if (quickConfigWidget) {
          setQuickConfigWidget(null);
          return true;
        }
        if (fullCustomizerVisible) {
          setFullCustomizerVisible(false);
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [trackModalVisible, drillDownPayload, quickConfigWidget, fullCustomizerVisible])
  );

  // Group widgets into single full-width rows vs 2-column paired half-width rows
  const groupedRows = useMemo(() => {
    const active = insightsLayout.filter((w) => w.enabled);
    const rows: { type: 'single' | 'pair'; items: InsightWidgetConfig[] }[] = [];
    let currentPair: InsightWidgetConfig[] = [];

    for (const w of active) {
      const def = INSIGHT_WIDGET_DEFINITIONS[w.id];
      const effectiveSize = w.size === 'auto' ? def.defaultSize : w.size;

      if (effectiveSize === 'half') {
        currentPair.push(w);
        if (currentPair.length === 2) {
          rows.push({ type: 'pair', items: [...currentPair] });
          currentPair = [];
        }
      } else {
        if (currentPair.length > 0) {
          rows.push({ type: 'single', items: [...currentPair] });
          currentPair = [];
        }
        rows.push({ type: 'single', items: [w] });
      }
    }

    if (currentPair.length > 0) {
      rows.push({ type: 'single', items: [...currentPair] });
    }

    return rows;
  }, [insightsLayout]);

  const handlePressWidget = (widgetId: InsightWidgetId) => {
    triggerHaptic('selection');
    // Lazy on-demand computation for deep drill-down payload
    const payload = InsightsEngine.computeDrillDown(widgetId, trackedItems);
    setDrillDownPayload(payload);
  };

  const handleLongPressWidget = (config: InsightWidgetConfig) => {
    setQuickConfigWidget(config);
  };

  const handleSelectItemFromDrillDown = (item: TrackedItem) => {
    setSelectedTrackItem(item);
    setTrackModalVisible(true);
  };

  const activeCount = insightsLayout.filter((w) => w.enabled).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.headerBar, { borderBottomColor: colors.cardBorder }]}>
        <View style={styles.headerTitleCol}>
          <Text
            numberOfLines={1}
            style={[styles.screenTitle, { color: colors.text, fontSize: 24 * headerScale }]}>
            Media Insights
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.screenSubtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
            {activeCount} active modules • Tap for insights, hold to customize
          </Text>
        </View>

        <Pressable
          style={[
            styles.customizeIconBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          onPress={() => {
            triggerHaptic('selection');
            setFullCustomizerVisible(true);
          }}
          hitSlop={8}>
          <Ionicons name="options-outline" size={19 * textScale} color={colors.primary} />
        </Pressable>
      </View>

      {/* Widgets Scroll Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.tabletScrollContent,
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Zero Widgets Active Warning */}
        {groupedRows.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="analytics-outline" size={38 * headerScale} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text, fontSize: 16 * headerScale }]}>
              No Insights Modules Enabled
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary, fontSize: 13 * textScale }]}>
              All data widgets are currently hidden in your settings.
            </Text>
            <Pressable
              style={[
                styles.restoreBtn,
                { backgroundColor: colors.primary, minHeight: Math.round(42 * buttonScale) },
              ]}
              onPress={() => {
                triggerHaptic('success');
                resetInsightsLayout();
              }}>
              <Ionicons name="refresh-outline" size={16} color="#ffffff" />
              <Text style={[styles.restoreBtnText, { fontSize: 13 * textScale }]}>
                Restore Default Layout
              </Text>
            </Pressable>
          </View>
        ) : (
          groupedRows.map((row, rowIdx) => {
            if (row.type === 'pair') {
              return (
                <View key={`row_${rowIdx}`} style={styles.pairRow}>
                  {row.items.map((w) => (
                    <InsightWidgetCard
                      key={w.id}
                      config={w}
                      items={trackedItems}
                      onPress={handlePressWidget}
                      onLongPress={handleLongPressWidget}
                      isPair={true}
                    />
                  ))}
                </View>
              );
            }

            return (
              <View key={`row_${rowIdx}`} style={styles.singleRow}>
                {row.items.map((w) => (
                  <InsightWidgetCard
                    key={w.id}
                    config={w}
                    items={trackedItems}
                    onPress={handlePressWidget}
                    onLongPress={handleLongPressWidget}
                    isPair={false}
                  />
                ))}
              </View>
            );
          })
        )}

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Drill-down In-depth Detail Modal */}
      <InsightDrillDownModal
        visible={Boolean(drillDownPayload)}
        payload={drillDownPayload}
        onClose={() => setDrillDownPayload(null)}
        onSelectItem={handleSelectItemFromDrillDown}
      />

      {/* Quick Config Modal (Long-Press Direct Manipulation) */}
      <InsightQuickConfigModal
        visible={Boolean(quickConfigWidget)}
        widgetConfig={quickConfigWidget}
        onClose={() => setQuickConfigWidget(null)}
        onOpenFullCustomizer={() => setFullCustomizerVisible(true)}
      />

      {/* Full Settings Customizer Hub */}
      <CustomizeInsightsModal
        visible={fullCustomizerVisible}
        onClose={() => setFullCustomizerVisible(false)}
      />

      {/* Direct Item Track Modal */}
      {selectedTrackItem && (
        <TrackModal
          visible={trackModalVisible}
          item={selectedTrackItem}
          existingRecord={selectedTrackItem}
          onClose={() => {
            setTrackModalVisible(false);
            setSelectedTrackItem(null);
          }}
          onSave={(record) => {
            void saveItem(record);
          }}
          onRemove={(id, mediaType) => {
            void removeItem(id, mediaType);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleCol: {
    flex: 1,
    marginRight: 12,
  },
  screenTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontWeight: '500',
    marginTop: 2,
  },
  customizeIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  tabletScrollContent: {
    maxWidth: 880,
    alignSelf: 'center',
    width: '100%',
  },
  singleRow: {
    width: '100%',
  },
  pairRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  emptyContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
  },
  emptyTitle: {
    fontWeight: '700',
  },
  emptySub: {
    textAlign: 'center',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  restoreBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
