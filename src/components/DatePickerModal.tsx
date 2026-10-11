import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTodayDDMMYYYY, getYesterdayDDMMYYYY } from '@/utils/date';

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  initialDate?: string; // in DD.MM.YYYY
  onClose: () => void;
  onSelectDate: (dateDDMMYYYY: string) => void;
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

function DatePickerContent({
  title,
  initialDate,
  onClose,
  onSelectDate,
  onClearDate,
}: Omit<DatePickerModalProps, 'visible'>) {
  const parsed = useMemo(() => {
    if (initialDate && initialDate.includes('.')) {
      const parts = initialDate.split('.');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return { day: d, month: m, year: y };
        }
      }
    }
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth(), year: now.getFullYear() };
  }, [initialDate]);

  const [selectedDay, setSelectedDay] = useState<number>(parsed.day);
  const [currentMonth, setCurrentMonth] = useState<number>(parsed.month);
  const [currentYear, setCurrentYear] = useState<number>(parsed.year);

  // Calculate days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // Day of week of 1st day (0 = Sunday, 1 = Monday, ...) -> convert to Monday=0
  const firstDayWeekday = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleConfirm = () => {
    const d = String(Math.min(selectedDay, daysInMonth)).padStart(2, '0');
    const m = String(currentMonth + 1).padStart(2, '0');
    const y = currentYear;
    onSelectDate(`${d}.${m}.${y}`);
    onClose();
  };

  const handleQuickToday = () => {
    onSelectDate(getTodayDDMMYYYY());
    onClose();
  };

  const handleQuickYesterday = () => {
    onSelectDate(getYesterdayDDMMYYYY());
    onClose();
  };

  const handleQuickClear = () => {
    if (onClearDate) onClearDate();
    onClose();
  };

  // Preview formatted string
  const currentFormatted = `${String(selectedDay).padStart(2, '0')}.${String(
    currentMonth + 1
  ).padStart(2, '0')}.${currentYear}`;

  return (
    <Pressable style={styles.dialogContainer} onPress={(e) => e.stopPropagation()}>
      {/* Header */}
      <View style={styles.dialogHeader}>
        <Text style={styles.dialogTitle}>{title}</Text>
        <Text style={styles.selectedDateBanner}>{currentFormatted}</Text>
      </View>

      {/* Quick Shortcuts */}
      <View style={styles.quickBar}>
        <Pressable style={styles.quickBtn} onPress={handleQuickToday}>
          <Text style={styles.quickBtnText}>Today</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={handleQuickYesterday}>
          <Text style={styles.quickBtnText}>Yesterday</Text>
        </Pressable>
        {onClearDate && (
          <Pressable style={styles.quickBtnDanger} onPress={handleQuickClear}>
            <Text style={styles.quickBtnDangerText}>Clear Date</Text>
          </Pressable>
        )}
      </View>

      {/* Month / Year Navigator */}
      <View style={styles.monthNavRow}>
        <Pressable style={styles.navArrow} onPress={handlePrevMonth}>
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
        </Pressable>

        <View style={styles.monthYearLabelContainer}>
          <Text style={styles.monthYearText}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>
        </View>

        <Pressable style={styles.navArrow} onPress={handleNextMonth}>
          <Ionicons name="chevron-forward" size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdaysRow}>
        {WEEKDAY_NAMES.map((w, idx) => (
          <Text key={idx} style={styles.weekdayText}>
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
              style={[styles.dayCell, isSelected && styles.dayCellSelected]}
              onPress={() => setSelectedDay(day)}>
              <Text
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                ]}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>Confirm Date</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export function DatePickerModal(props: DatePickerModalProps) {
  if (!props.visible) return null;

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable style={styles.overlay} onPress={props.onClose}>
        <DatePickerContent
          key={props.initialDate || 'new'}
          title={props.title}
          initialDate={props.initialDate}
          onClose={props.onClose}
          onSelectDate={props.onSelectDate}
          onClearDate={props.onClearDate}
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  monthYearLabelContainer: {
    alignItems: 'center',
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
