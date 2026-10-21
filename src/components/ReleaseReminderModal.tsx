import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import {
  TrackedItem,
  TMDBMediaItem,
  ItemReminderConfig,
  NotificationTimingOption,
  NOTIFICATION_DAYS_ADVANCE_OPTIONS,
  NOTIFICATION_TIMING_CONFIGS,

} from '@/types/media';
import { formatDate, formatTime } from '@/utils/date';
import { MaterialTimePickerModal } from '@/components/MaterialTimePickerModal';
import { CountryOriginBadge } from '@/components/CountryOriginBadge';

interface ReleaseReminderModalProps {
  visible: boolean;
  item: TrackedItem | TMDBMediaItem | null;
  existingRecord?: TrackedItem;
  targetDate?: string;
  dateLabel?: string;
  countdownText?: string;
  onClose: () => void;
  onSaveReminder: (config: ItemReminderConfig) => void;
  onRemoveReminder: () => void;
}

function ReleaseReminderSheetContent({
  item,
  existingRecord,
  targetDate,
  dateLabel,
  countdownText,
  onClose,
  onSaveReminder,
  onRemoveReminder,
}: Omit<ReleaseReminderModalProps, 'visible'>) {
  const { colors } = useAppTheme();
  const {
    notificationHour: globalHour,
    notificationMinute: globalMinute,
    notificationDaysAhead: globalDaysAhead,
    notificationTiming: globalTiming,
    timeFormat,
    dateFormat,
    selectedTimezone,
    triggerHaptic,
  } = useMedia();

  const title =
    item && 'title' in item && item.title
      ? item.title
      : item && 'name' in item && item.name
      ? item.name
      : 'Title';

  const existingConfig = existingRecord?.reminder;
  const originCountry = existingRecord?.originCountry || (item as any)?.originCountry || (item as any)?.origin_country?.[0];

  const [enabled, setEnabled] = useState<boolean>(existingConfig?.enabled ?? true);
  const [timing, setTiming] = useState<NotificationTimingOption>(
    existingConfig?.timing ?? globalTiming
  );
  const [daysAhead, setDaysAhead] = useState<number>(
    existingConfig?.daysAhead ?? (globalDaysAhead > 0 ? globalDaysAhead : 1)
  );
  const [hour, setHour] = useState<number>(existingConfig?.hour ?? globalHour);
  const [minute, setMinute] = useState<number>(existingConfig?.minute ?? globalMinute ?? 0);
  const [showStrategyModal, setShowStrategyModal] = useState<boolean>(false);

  // Time picker modal & custom days modal state
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [showCustomDaysModal, setShowCustomDaysModal] = useState<boolean>(false);
  const [customDaysInput, setCustomDaysInput] = useState<string>(String(daysAhead));

  const currentTimingConfig =
    NOTIFICATION_TIMING_CONFIGS.find((c) => c.id === (timing === 'both' ? 'release_and_advance' : timing)) ||
    NOTIFICATION_TIMING_CONFIGS[0];
  const isPresetDays = NOTIFICATION_DAYS_ADVANCE_OPTIONS.some((o) => o.days === daysAhead);

  const handleSave = () => {
    triggerHaptic('success');
    onSaveReminder({
      enabled,
      timing,
      daysAhead,
      hour,
      minute,
    });
    onClose();
  };

  const handleDisable = () => {
    triggerHaptic('warning');
    onRemoveReminder();
    onClose();
  };

  const handleApplyCustomDays = () => {
    const parsed = parseInt(customDaysInput, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 365) {
      triggerHaptic('selection');
      setDaysAhead(parsed);
      setShowCustomDaysModal(false);
    }
  };

  const tzShort =
    selectedTimezone.split('/').pop()?.replace(/_/g, ' ') || selectedTimezone;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {/* Header */}
        <View style={[styles.headerRow, { borderBottomColor: colors.divider }]}>
          <View style={styles.headerTitleWrap}>
            <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="notifications" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Release Alert</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Customize device notifications
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
          {/* Title & Release Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.infoMetaRow}>
              <Text style={[styles.infoDateText, { color: colors.textSecondary }]}>
                {dateLabel || 'Release'}: {targetDate ? formatDate(targetDate, dateFormat) : 'Upcoming'}
              </Text>
              {originCountry ? (
                <CountryOriginBadge countryCode={originCountry} />
              ) : null}
              {countdownText ? (
                <View style={[styles.countdownBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.countdownBadgeText}>{countdownText}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Master Alert Toggle */}
          <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.toggleTextWrap}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Device Alert Active</Text>
              <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                Trigger local offline notifications on this device.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setEnabled(val);
              }}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          {enabled && (
            <>
              {/* Alert Strategy Dropdown Trigger */}
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                ALERT TIMING STRATEGY
              </Text>
              <Pressable
                style={[
                  styles.dropdownTrigger,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setShowStrategyModal(true);
                }}>
                <View style={styles.dropdownTriggerLeft}>
                  <Text style={[styles.dropdownTriggerTitle, { color: colors.text }]}>
                    {currentTimingConfig.label}
                  </Text>
                  <Text style={[styles.dropdownTriggerDesc, { color: colors.textSecondary }]}>
                    {currentTimingConfig.description}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </Pressable>

              {/* Advance Days Selection (only if strategy includes advance notice) */}
              {currentTimingConfig.hasAdvance && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                    ADVANCE NOTICE
                  </Text>
                  <View style={styles.advanceChipsRow}>
                    {NOTIFICATION_DAYS_ADVANCE_OPTIONS.map((opt) => {
                      const isSelected = daysAhead === opt.days;
                      return (
                        <Pressable
                          key={opt.days}
                          style={[
                            styles.advanceChip,
                            { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                            isSelected && [styles.advanceChipActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
                          ]}
                          onPress={() => {
                            triggerHaptic('selection');
                            setDaysAhead(opt.days);
                          }}>
                          <Text
                            style={[
                              styles.advanceChipText,
                              { color: isSelected ? colors.primary : colors.textSecondary },
                            ]}>
                            {opt.shortLabel}
                          </Text>
                        </Pressable>
                      );
                    })}

                    {/* Custom Days Chip */}
                    <Pressable
                      style={[
                        styles.advanceChip,
                        { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                        !isPresetDays && [styles.advanceChipActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
                      ]}
                      onPress={() => {
                        triggerHaptic('selection');
                        setCustomDaysInput(String(daysAhead));
                        setShowCustomDaysModal(true);
                      }}>
                      <Ionicons
                        name="create-outline"
                        size={13}
                        color={!isPresetDays ? colors.primary : colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.advanceChipText,
                          { color: !isPresetDays ? colors.primary : colors.textSecondary },
                        ]}>
                        {!isPresetDays ? `${daysAhead} Days` : 'Custom...'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}

              {/* Alert Time of Day - Google Keep Dynamic Clock Dial */}
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                ALERT TIME ({tzShort})
              </Text>
              <Pressable
                style={[
                  styles.customTimeRow,
                  { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setShowTimePicker(true);
                }}>
                <View style={styles.customTimeInfo}>
                  <View style={[styles.clockIconWrap, { backgroundColor: colors.primaryBg }]}>
                    <Ionicons name="time" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.customTimeLabel, { color: colors.text }]}>Selected Exact Time</Text>
                    <Text style={[styles.customTimeSub, { color: colors.textSecondary }]}>
                      Tap to open circular clock picker
                    </Text>
                  </View>
                </View>
                <View style={[styles.timeBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.timeBadgeText, { color: colors.primary }]}>
                    {formatTime(hour, minute, timeFormat)}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                </View>
              </Pressable>
            </>
          )}

          {!existingRecord && (
            <Text style={[styles.untrackedNote, { color: colors.textSecondary }]}>
              Saving an alert for an unreleased title will automatically place it in your Plan to Watch list.
            </Text>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actionsRow, { borderTopColor: colors.divider }]}>
          {existingConfig ? (
            <Pressable
              style={[styles.removeBtn, { borderColor: colors.cardBorder }]}
              onPress={handleDisable}>
              <Ionicons name="notifications-off-outline" size={16} color="#ef4444" />
              <Text style={styles.removeBtnText}>Turn Off</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}>
            <Ionicons name="checkmark" size={16} color="#ffffff" />
            <Text style={styles.saveBtnText}>Save Alert</Text>
          </Pressable>
        </View>

        {/* Material Design 3 Time Picker Modal */}
              {/* Strategy Selector Sheet Modal */}
      <Modal
        visible={showStrategyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStrategyModal(false)}>
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowStrategyModal(false)} />
          <View style={[styles.strategySheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.pickerHeaderTitle, { color: colors.text }]}>Alert Timing Strategy</Text>
              <Pressable onPress={() => setShowStrategyModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.strategyScroll} showsVerticalScrollIndicator={false}>
              {NOTIFICATION_TIMING_CONFIGS.map((config) => {
                const isSelected = currentTimingConfig.id === config.id;
                return (
                  <Pressable
                    key={config.id}
                    style={[
                      styles.strategyOptionItem,
                      { borderBottomColor: colors.divider },
                      isSelected && { backgroundColor: colors.primaryBg },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setTiming(config.id);
                      setShowStrategyModal(false);
                    }}>
                    <View style={styles.strategyOptionLeft}>
                      <Text style={[styles.strategyOptionTitle, { color: isSelected ? colors.primary : colors.text }]}>
                        {config.label}
                      </Text>
                      <Text style={[styles.strategyOptionDesc, { color: colors.textSecondary }]}>
                        {config.description}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={20} color={colors.cardBorder} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <MaterialTimePickerModal
          visible={showTimePicker}
          initialHour={hour}
          initialMinute={minute}
          timeFormat={timeFormat}
          onClose={() => setShowTimePicker(false)}
          onConfirm={(h, m) => {
            setHour(h);
            setMinute(m);
          }}
        />

        {/* Custom Days Ahead Input Modal */}
        {showCustomDaysModal && (
          <Modal
            visible={showCustomDaysModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCustomDaysModal(false)}>
            <View style={styles.dialogOverlay}>
              <Pressable
                style={styles.backdrop}
                onPress={() => setShowCustomDaysModal(false)}
              />
              <View
                style={[
                  styles.customDaysDialog,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}>
                <Text style={[styles.customDaysTitle, { color: colors.text }]}>
                  Custom Advance Notice
                </Text>
                <Text style={[styles.customDaysDesc, { color: colors.textSecondary }]}>
                  Enter the number of days prior to premiere or broadcast to receive this reminder:
                </Text>
                <TextInput
                  style={[
                    styles.customDaysInput,
                    {
                      backgroundColor: colors.inputBg,
                      color: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  value={customDaysInput}
                  onChangeText={setCustomDaysInput}
                  keyboardType="number-pad"
                  maxLength={3}
                  autoFocus
                  selectTextOnFocus
                />
                <View style={styles.dialogButtonsRow}>
                  <Pressable
                    style={styles.dialogBtn}
                    onPress={() => setShowCustomDaysModal(false)}>
                    <Text style={[styles.dialogBtnText, { color: colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dialogBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}
                    onPress={handleApplyCustomDays}>
                    <Text style={[styles.dialogBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                      Set Days
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </View>
  );
}

export function ReleaseReminderModal(props: ReleaseReminderModalProps) {
  if (!props.visible || !props.item) return null;
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}>
      <ReleaseReminderSheetContent {...props} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  dropdownTriggerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  dropdownTriggerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownTriggerDesc: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  clockIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  strategySheet: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  strategyScroll: {
    maxHeight: 460,
  },
  strategyOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  strategyOptionLeft: {
    flex: 1,
    paddingRight: 12,
  },
  strategyOptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  strategyOptionDesc: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  bodyScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  infoDateText: {
    fontSize: 12,
  },
  originBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  countdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countdownBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  strategyContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 8,
  },
  strategyBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strategyBtnActive: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
  },
  strategyBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  advanceChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  advanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  advanceChipActive: {
    borderWidth: 1.5,
  },
  advanceChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  hourChip: {
    width: '31%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  hourChipActive: {
    borderWidth: 1.5,
  },
  hourChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hourChipSub: {
    fontSize: 9.5,
    marginTop: 2,
  },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 14,
  },
  customTimeRowActive: {
    borderWidth: 1.5,
  },
  customTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customTimeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  customTimeSub: {
    fontSize: 11,
    marginTop: 1,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  untrackedNote: {
    fontSize: 11.5,
    lineHeight: 16,
    marginVertical: 10,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  customDaysDialog: {
    width: 300,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
  },
  customDaysTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  customDaysDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  customDaysInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  dialogBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
