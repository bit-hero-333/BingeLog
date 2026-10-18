import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDate,
  parseFormattedDateToIso,
  getTodayFormatted,
  getYesterdayFormatted,
} from '@/utils/date';
import { DateFormatOption, DEFAULT_DATE_FORMAT } from '@/types/media';
import { useMedia } from '@/context/MediaContext';
import { useAppTheme } from '@/context/ThemeContext';

function formatDigitsToMask(rawDigits: string, format: DateFormatOption): string {
  const digits = rawDigits.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';

  if (format === 'YYYY-MM-DD') {
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  const delimiter =
    format === 'MM/DD/YYYY' || format === 'DD/MM/YYYY' || format === 'MMM D, YYYY'
      ? '/'
      : '.';

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}${delimiter}${digits.slice(2)}`;
  return `${digits.slice(0, 2)}${delimiter}${digits.slice(2, 4)}${delimiter}${digits.slice(4, 8)}`;
}

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  initialDate?: string;
  dateFormat?: DateFormatOption;
  onClose: () => void;
  onSelectDate: (formattedDate: string) => void;
  onClearDate?: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

type PickerMode = 'calendar' | 'month' | 'year' | 'input';

function DatePickerContent({
  title,
  initialDate,
  dateFormat: propDateFormat,
  onClose,
  onSelectDate,
  onClearDate,
}: Omit<DatePickerModalProps, 'visible'>) {
  const { dateFormat: contextDateFormat, triggerHaptic } = useMedia();
  const { colors } = useAppTheme();
  const activeFormat = propDateFormat || contextDateFormat || DEFAULT_DATE_FORMAT;

  const parsed = useMemo(() => {
    if (initialDate && initialDate.trim()) {
      const iso = parseFormattedDateToIso(initialDate, activeFormat);
      if (iso) {
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          return { day: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
        }
      }
    }
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth(), year: now.getFullYear() };
  }, [initialDate, activeFormat]);

  const [selectedDay, setSelectedDay] = useState<number>(parsed.day);
  const [currentMonth, setCurrentMonth] = useState<number>(parsed.month);
  const [currentYear, setCurrentYear] = useState<number>(parsed.year);
  const [pickerMode, setPickerMode] = useState<PickerMode>('calendar');
  const [manualInputText, setManualInputText] = useState<string>(initialDate || '');

  // Calculate days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // Day of week of 1st day (0 = Sunday, 1 = Monday, ...) -> convert to Monday=0
  const firstDayWeekday = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  // List of years from now+6 down to 1920 (ensuring total count is a multiple of 3)
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const maxYear = currentY + 6;
    let minYear = 1920;
    while ((maxYear - minYear + 1) % 3 !== 0) {
      minYear--;
    }
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const handleManualTextChange = (text: string) => {
    const prevDigits = manualInputText.replace(/\D/g, '');
    const newDigits = text.replace(/\D/g, '');

    let targetDigits = newDigits;
    if (text.length < manualInputText.length && newDigits.length === prevDigits.length) {
      targetDigits = prevDigits.slice(0, -1);
    }

    const masked = formatDigitsToMask(targetDigits, activeFormat);
    setManualInputText(masked);

    if (targetDigits.length === 8) {
      const iso = parseFormattedDateToIso(masked, activeFormat);
      if (iso) {
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          setSelectedDay(d.getDate());
          setCurrentMonth(d.getMonth());
          setCurrentYear(d.getFullYear());
        }
      }
    }
  };

  const handlePrevMonth = () => {
    triggerHaptic('selection');
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    triggerHaptic('selection');
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleConfirm = () => {
    triggerHaptic('selection');
    Keyboard.dismiss();
    if (pickerMode === 'input') {
      const trimmed = manualInputText.trim();
      if (trimmed) {
        const iso = parseFormattedDateToIso(trimmed, activeFormat);
        if (iso) {
          onSelectDate(trimmed);
          onClose();
          return;
        }
      }
    }

    const validDay = Math.min(selectedDay, daysInMonth);
    const dateObj = new Date(currentYear, currentMonth, validDay, 12, 0, 0);
    onSelectDate(formatDate(dateObj, activeFormat));
    onClose();
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleQuickToday = () => {
    triggerHaptic('selection');
    Keyboard.dismiss();
    onSelectDate(getTodayFormatted(activeFormat));
    onClose();
  };

  const handleQuickYesterday = () => {
    triggerHaptic('selection');
    Keyboard.dismiss();
    onSelectDate(getYesterdayFormatted(activeFormat));
    onClose();
  };

  const handleQuickClear = () => {
    triggerHaptic('selection');
    Keyboard.dismiss();
    if (onClearDate) onClearDate();
    onClose();
  };

  // Preview formatted string according to user's preferred format
  const currentFormatted = useMemo(() => {
    const validDay = Math.min(selectedDay, daysInMonth);
    const dateObj = new Date(currentYear, currentMonth, validDay, 12, 0, 0);
    return formatDate(dateObj, activeFormat);
  }, [selectedDay, daysInMonth, currentMonth, currentYear, activeFormat]);

  return (
    <Pressable
      style={[
        styles.dialogContainer,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
      onPress={(e) => e.stopPropagation()}>
      {/* Header */}
      <View style={[styles.dialogHeader, { borderBottomColor: colors.divider }]}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.dialogTitle, { color: colors.textSecondary }]}>{title}</Text>
          <Text style={[styles.selectedDateBanner, { color: colors.primary }]} selectable={true}>
            {pickerMode === 'input' && manualInputText ? manualInputText : currentFormatted}
          </Text>
        </View>

        {/* Edit Pencil / Calendar Mode Toggle Button */}
        <Pressable
          style={[styles.headerModeToggle, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
          onPress={() => {
            triggerHaptic('selection');
            if (pickerMode === 'input') {
              Keyboard.dismiss();
              setPickerMode('calendar');
            } else {
              setManualInputText(formatDigitsToMask(currentFormatted, activeFormat));
              setPickerMode('input');
            }
          }}>
          <Ionicons
            name={pickerMode === 'input' ? 'calendar-outline' : 'pencil-outline'}
            size={18}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {/* Quick Shortcuts (visible in calendar mode) */}
      {pickerMode === 'calendar' && (
        <View style={styles.quickBar}>
          <Pressable
            style={[styles.quickBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
            onPress={handleQuickToday}>
            <Text style={[styles.quickBtnText, { color: colors.textSecondary }]}>Today</Text>
          </Pressable>
          <Pressable
            style={[styles.quickBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
            onPress={handleQuickYesterday}>
            <Text style={[styles.quickBtnText, { color: colors.textSecondary }]}>Yesterday</Text>
          </Pressable>
          {onClearDate && (
            <Pressable style={styles.quickBtnDanger} onPress={handleQuickClear}>
              <Text style={styles.quickBtnDangerText}>Clear Date</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* MODE 1: CALENDAR VIEW */}
      {pickerMode === 'calendar' && (
        <>
          {/* Month / Year Navigator */}
          <View style={styles.monthNavRow}>
            <Pressable
              style={[styles.navArrow, { backgroundColor: colors.inputBg }]}
              onPress={handlePrevMonth}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>

            {/* Clickable Month/Year to open Month View */}
            <Pressable
              style={[styles.monthYearSelectorBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
              onPress={() => {
                triggerHaptic('selection');
                setPickerMode('month');
              }}>
              <Text style={[styles.monthYearText, { color: colors.text }]}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
            </Pressable>

            <Pressable
              style={[styles.navArrow, { backgroundColor: colors.inputBg }]}
              onPress={handleNextMonth}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdaysRow}>
            {WEEKDAY_NAMES.map((w, idx) => (
              <Text key={idx} style={[styles.weekdayText, { color: colors.textMuted }]}>
                {w}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {/* Blank offset days */}
            {Array.from({ length: firstDayWeekday }).map((_, idx) => (
              <View key={`empty-${idx}`} style={styles.dayCell} />
            ))}

            {/* Month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isSelected = selectedDay === day;
              return (
                <Pressable
                  key={`day-${day}`}
                  style={[
                    styles.dayCell,
                    isSelected && [styles.dayCellSelected, { backgroundColor: colors.primary }],
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedDay(day);
                  }}>
                  <Text
                    style={[
                      styles.dayText,
                      { color: colors.text },
                      isSelected && styles.dayTextSelected,
                    ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* MODE 2: MONTH VIEW */}
      {pickerMode === 'month' && (
        <View style={styles.pickerSubViewContainer}>
          {/* Top Year Button in Month View */}
          <View style={styles.subViewHeaderRow}>
            <Pressable
              style={[styles.yearBadgeBtn, { backgroundColor: colors.inputBg, borderColor: colors.primary }]}
              onPress={() => {
                triggerHaptic('selection');
                setPickerMode('year');
              }}>
              <Text style={[styles.yearBadgeBtnText, { color: colors.primary }]}>{currentYear}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
            </Pressable>

            <Pressable
              style={[styles.backToCalBtn, { backgroundColor: colors.inputBg }]}
              onPress={() => {
                triggerHaptic('selection');
                setPickerMode('calendar');
              }}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.subViewHint, { color: colors.textMuted }]}>
            Select a month (or tap {currentYear} to change year)
          </Text>

          {/* 12 Months Grid */}
          <View style={styles.monthsGrid}>
            {MONTH_NAMES.map((name, idx) => {
              const isSelected = currentMonth === idx;
              return (
                <Pressable
                  key={name}
                  style={[
                    styles.monthGridCell,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setCurrentMonth(idx);
                    setPickerMode('calendar');
                  }}>
                  <Text
                    style={[
                      styles.monthGridCellText,
                      { color: isSelected ? '#ffffff' : colors.text },
                      isSelected && { fontWeight: '700' },
                    ]}
                    numberOfLines={1}>
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* MODE 3: YEAR VIEW */}
      {pickerMode === 'year' && (
        <View style={styles.pickerSubViewContainer}>
          {/* Top Header in Year View */}
          <View style={styles.subViewHeaderRow}>
            <Pressable
              style={[styles.yearBadgeBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
              onPress={() => {
                triggerHaptic('selection');
                setPickerMode('month');
              }}>
              <Text style={[styles.yearBadgeBtnText, { color: colors.primary }]}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
              <Ionicons name="chevron-up" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
            </Pressable>

            <Pressable
              style={[styles.backToCalBtn, { backgroundColor: colors.inputBg }]}
              onPress={() => {
                triggerHaptic('selection');
                setPickerMode('month');
              }}>
              <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.subViewHint, { color: colors.textMuted }]}>
            Choose year to return to months
          </Text>

          {/* Scrollable Years Grid (3 Columns) */}
          <ScrollView
            style={styles.yearsScrollView}
            contentContainerStyle={styles.yearsGridContent}
            showsVerticalScrollIndicator={true}>
            {availableYears.map((y) => {
              const isSelected = currentYear === y;
              return (
                <Pressable
                  key={y}
                  style={[
                    styles.yearGridCell,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setCurrentYear(y);
                    setPickerMode('month'); // Returns to months view with that year selected!
                  }}>
                  <Text
                    style={[
                      styles.yearGridCellText,
                      { color: isSelected ? '#ffffff' : colors.text },
                      isSelected && { fontWeight: '800' },
                    ]}>
                    {y}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* MODE 4: DIRECT MANUAL DATE INPUT */}
      {pickerMode === 'input' && (
        <View style={styles.inputModeContainer}>
          <Text style={[styles.inputModeLabel, { color: colors.textSecondary }]}>
            Enter Date ({activeFormat})
          </Text>
          <View style={[styles.textInputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              value={manualInputText}
              onChangeText={handleManualTextChange}
              placeholder={activeFormat}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus={true}
              maxLength={10}
            />
            {manualInputText ? (
              <Pressable
                onPress={() => {
                  triggerHaptic('selection');
                  setManualInputText('');
                }}
                style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.inputFormatHint, { color: colors.textMuted }]}>
            Digits only; delimiters fill automatically (e.g. {getTodayFormatted(activeFormat)})
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={[styles.actionRow, { borderTopColor: colors.divider }]}>
        <Pressable style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>Confirm Date</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export function DatePickerModal(props: DatePickerModalProps) {
  if (!props.visible) return null;

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        Keyboard.dismiss();
        props.onClose();
      }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingOverlay}>
        <ScrollView
          contentContainerStyle={styles.scrollOverlayContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}>
          <Pressable
            style={styles.backdropPressable}
            onPress={() => {
              Keyboard.dismiss();
              props.onClose();
            }}>
            <DatePickerContent
              key={props.initialDate || 'new'}
              title={props.title}
              initialDate={props.initialDate}
              dateFormat={props.dateFormat}
              onClose={() => {
                Keyboard.dismiss();
                props.onClose();
              }}
              onSelectDate={(formattedDate) => {
                Keyboard.dismiss();
                props.onSelectDate(formattedDate);
              }}
              onClearDate={
                props.onClearDate
                  ? () => {
                      Keyboard.dismiss();
                      props.onClearDate?.();
                    }
                  : undefined
              }
            />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  scrollOverlayContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropPressable: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogContainer: {
    backgroundColor: '#161922',
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#232838',
  },
  dialogTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selectedDateBanner: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  headerModeToggle: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  quickBtn: {
    backgroundColor: '#1f2432',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262d3d',
  },
  quickBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  quickBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  quickBtnDangerText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navArrow: {
    padding: 6,
    backgroundColor: '#1f2432',
    borderRadius: 8,
  },
  monthYearSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  monthYearText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    width: 38,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#2563eb',
  },
  dayText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  pickerSubViewContainer: {
    minHeight: 240,
    marginBottom: 12,
  },
  subViewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  yearBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  yearBadgeBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  backToCalBtn: {
    padding: 6,
    borderRadius: 8,
  },
  subViewHint: {
    fontSize: 11.5,
    marginBottom: 12,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  monthGridCell: {
    width: '31.2%',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGridCellText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  yearsScrollView: {
    maxHeight: 240,
  },
  yearsGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    paddingBottom: 8,
  },
  yearGridCell: {
    width: '31.2%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearGridCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputModeContainer: {
    minHeight: 180,
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 12,
  },
  inputModeLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 6,
  },
  inputFormatHint: {
    fontSize: 11.5,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#232838',
    paddingTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
