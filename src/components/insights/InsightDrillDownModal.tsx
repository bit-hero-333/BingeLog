import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { InsightDrillDownPayload, DrillDownContributingItem } from '@/types/insights';
import { getTextScale, getHeaderScale } from '@/utils/sizing';
import { TMDBService } from '@/services/tmdb';
import { TrackedItem } from '@/types/media';

interface InsightDrillDownModalProps {
  visible: boolean;
  payload: InsightDrillDownPayload | null;
  onClose: () => void;
  onSelectItem?: (item: TrackedItem) => void;
}

export function InsightDrillDownModal({
  visible,
  payload,
  onClose,
  onSelectItem,
}: InsightDrillDownModalProps) {
  if (!visible || !payload) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <InsightDrillDownModalContent
        payload={payload}
        onClose={onClose}
        onSelectItem={onSelectItem}
      />
    </Modal>
  );
}

function InsightDrillDownModalContent({
  payload,
  onClose,
  onSelectItem,
}: {
  payload: InsightDrillDownPayload;
  onClose: () => void;
  onSelectItem?: (item: TrackedItem) => void;
}) {
  const { colors } = useAppTheme();
  const { sizingConfig, triggerHaptic, trackedItems } = useMedia();
  const { height } = useWindowDimensions();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const sheetHeight = Math.round(height * 0.85);
  const widgetColor: string = payload.color || (typeof colors.primary === 'string' ? colors.primary : '#3b82f6');

  const handlePressItem = (cItem: DrillDownContributingItem) => {
    triggerHaptic('selection');
    const full = trackedItems.find((i) => i.id === cItem.id && i.mediaType === cItem.mediaType);
    if (full && onSelectItem) {
      onClose();
      onSelectItem(full);
    }
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
            <View style={[styles.iconBadge, { backgroundColor: payload.color ? `${payload.color}20` : colors.primaryBg }]}>
              <Ionicons name={payload.icon} size={20 * headerScale} color={widgetColor} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { color: colors.text, fontSize: 16 * headerScale }]}>
                {payload.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                {payload.subtitle}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Scrollable Body */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}>
          {/* Summary Highlights */}
          {payload.summaryHighlights.length > 0 && (
            <View style={styles.highlightsRow}>
              {payload.summaryHighlights.map((h, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.highlightCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}>
                  <Text style={[styles.highlightLabel, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                    {h.label.toUpperCase()}
                  </Text>
                  <Text style={[styles.highlightValue, { color: widgetColor, fontSize: 18 * headerScale }]}>
                    {h.value}
                  </Text>
                  {h.hint && (
                    <Text style={[styles.highlightHint, { color: colors.textMuted, fontSize: 10 * textScale }]}>
                      {h.hint}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Notes description */}
          {payload.notes && (
            <View style={[styles.notesCard, { backgroundColor: payload.color ? `${payload.color}12` : colors.cardSelected, borderColor: colors.cardBorder }]}>
              <Ionicons name="information-circle-outline" size={16} color={widgetColor} />
              <Text style={[styles.notesText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                {payload.notes}
              </Text>
            </View>
          )}

          {/* Contributing Items Section */}
          {payload.items && payload.items.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 13 * headerScale }]}>
                CONTRIBUTING TITLES ({payload.items.length})
              </Text>

              {payload.items.map((item) => {
                const posterUrl = item.posterPath
                  ? TMDBService.getImageUrl(item.posterPath, 'w92')
                  : null;

                const metaParts: string[] = [];
                if (item.releaseYear) metaParts.push(item.releaseYear);
                metaParts.push(item.mediaType === 'tv' ? 'TV' : 'Movie');
                if (item.extraInfo) metaParts.push(item.extraInfo);
                const metaString = metaParts.join(' • ');

                return (
                  <Pressable
                    key={`${item.mediaType}_${item.id}`}
                    style={[
                      styles.itemRow,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                    onPress={() => handlePressItem(item)}>
                    {posterUrl ? (
                      <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
                    ) : (
                      <View style={[styles.posterPlaceholder, { backgroundColor: colors.inputBg }]}>
                        <Ionicons name="film-outline" size={16} color={colors.textSecondary} />
                      </View>
                    )}

                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemTitle, { color: colors.text, fontSize: 13.5 * textScale }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text
                        style={[styles.itemMeta, { color: colors.textSecondary, fontSize: 11.5 * textScale }]}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {metaString}
                      </Text>
                    </View>

                    <View style={styles.itemRight}>
                      <View style={[styles.metricBadge, { backgroundColor: payload.color ? `${payload.color}1A` : colors.primaryBg }]}>
                        <Text style={[styles.metricBadgeText, { color: widgetColor, fontSize: 11.5 * textScale }]}>
                          {item.highlightMetric}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
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
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  highlightsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  highlightCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  highlightLabel: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  highlightValue: {
    fontWeight: '800',
  },
  highlightHint: {
    marginTop: 2,
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notesText: {
    flex: 1,
    lineHeight: 17,
  },
  itemsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  poster: {
    width: 38,
    height: 54,
    borderRadius: 6,
  },
  posterPlaceholder: {
    width: 38,
    height: 54,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
    gap: 3,
  },
  itemTitle: {
    fontWeight: '700',
  },
  itemMeta: {
    fontWeight: '500',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  metricBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metricBadgeText: {
    fontWeight: '700',
  },
});
