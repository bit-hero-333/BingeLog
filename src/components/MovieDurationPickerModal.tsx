import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';

interface MovieDurationPickerModalProps {
  visible: boolean;
  initialTotalSeconds: number;
  maxRuntimeMinutes: number | null;
  onClose: () => void;
  onConfirm: (totalSeconds: number) => void;
}

type ActiveField = 'hours' | 'minutes' | 'seconds';

export function MovieDurationPickerModal({
  visible,
  initialTotalSeconds,
  maxRuntimeMinutes,
  onClose,
  onConfirm,
}: MovieDurationPickerModalProps) {
  const { colors } = useAppTheme();
  const { triggerHaptic } = useMedia();

  const maxTotalSeconds =
    maxRuntimeMinutes && maxRuntimeMinutes > 0 ? maxRuntimeMinutes * 60 : 99 * 3600 + 59 * 60 + 59;

  const [hoursInput, setHoursInput] = useState<string>('00');
  const [minutesInput, setMinutesInput] = useState<string>('00');
  const [secondsInput, setSecondsInput] = useState<string>('00');
  const [activeField, setActiveField] = useState<ActiveField>('hours');
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const hoursRef = useRef<TextInput | null>(null);
  const minutesRef = useRef<TextInput | null>(null);
  const secondsRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [prevVisible, setPrevVisible] = useState<boolean>(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      const clamped = Math.max(0, Math.min(Math.floor(initialTotalSeconds), maxTotalSeconds));
      const h = Math.floor(clamped / 3600);
      const m = Math.floor((clamped % 3600) / 60);
      const s = clamped % 60;
      setHoursInput(String(h).padStart(2, '0'));
      setMinutesInput(String(m).padStart(2, '0'));
      setSecondsInput(String(s).padStart(2, '0'));
      setActiveField('hours');
    }
  }

  const formatSecondsToHHMMSS = (totalSec: number): string => {
    const safe = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleHoursChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 2);
    setHoursInput(clean);
    if (clean.length === 2) {
      setActiveField('minutes');
      minutesRef.current?.focus();
    }
  };

  const handleMinutesChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 2);
    setMinutesInput(clean);
    if (clean.length === 2) {
      const num = parseInt(clean, 10);
      if (num > 59) {
        setMinutesInput('59');
      }
      setActiveField('seconds');
      secondsRef.current?.focus();
    }
  };

  const handleSecondsChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 2);
    if (clean.length === 2) {
      const num = parseInt(clean, 10);
      if (num > 59) {
        setSecondsInput('59');
        return;
      }
    }
    setSecondsInput(clean);
  };

  const handleConfirm = () => {
    triggerHaptic('selection');
    const h = Math.max(0, parseInt(hoursInput || '0', 10) || 0);
    const m = Math.max(0, Math.min(59, parseInt(minutesInput || '0', 10) || 0));
    const s = Math.max(0, Math.min(59, parseInt(secondsInput || '0', 10) || 0));
    const totalSec = Math.max(0, Math.min(h * 3600 + m * 60 + s, maxTotalSeconds));
    onConfirm(totalSec);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          keyboardHeight > 0 && {
            justifyContent: 'flex-start',
            paddingTop: 36,
            paddingBottom: keyboardHeight + 12,
          },
        ]}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />

        <ScrollView
          style={{ width: '100%', maxHeight: '100%' }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.dialogTitle, { color: colors.textSecondary }]}>
              Enter Watched Time
            </Text>
            {maxRuntimeMinutes && maxRuntimeMinutes > 0 ? (
              <Text style={[styles.dialogSubtitle, { color: colors.textMuted }]}>
                Total Runtime: {formatSecondsToHHMMSS(maxTotalSeconds)} ({maxRuntimeMinutes}m)
              </Text>
            ) : null}

            {/* HH : MM : SS Input Row */}
            <View style={styles.inputsRow}>
              {/* Hours */}
              <View style={styles.inputColumn}>
                <TextInput
                  ref={hoursRef}
                  style={[
                    styles.timeInputBox,
                    {
                      backgroundColor: activeField === 'hours' ? colors.primaryBg : colors.inputBg,
                      borderColor: activeField === 'hours' ? colors.primary : colors.cardBorder,
                      color: activeField === 'hours' ? colors.primary : colors.text,
                    },
                  ]}
                  value={hoursInput}
                  onChangeText={handleHoursChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  autoFocus
                  onFocus={() => setActiveField('hours')}
                  onBlur={() => setHoursInput((prev) => String(parseInt(prev || '0', 10) || 0).padStart(2, '0'))}
                />
                <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>Hours</Text>
              </View>

              <Text style={[styles.colonText, { color: colors.text }]}>:</Text>

              {/* Minutes */}
              <View style={styles.inputColumn}>
                <TextInput
                  ref={minutesRef}
                  style={[
                    styles.timeInputBox,
                    {
                      backgroundColor: activeField === 'minutes' ? colors.primaryBg : colors.inputBg,
                      borderColor: activeField === 'minutes' ? colors.primary : colors.cardBorder,
                      color: activeField === 'minutes' ? colors.primary : colors.text,
                    },
                  ]}
                  value={minutesInput}
                  onChangeText={handleMinutesChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  onFocus={() => setActiveField('minutes')}
                  onBlur={() =>
                    setMinutesInput((prev) =>
                      String(Math.min(59, parseInt(prev || '0', 10) || 0)).padStart(2, '0')
                    )
                  }
                />
                <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>Minutes</Text>
              </View>

              <Text style={[styles.colonText, { color: colors.text }]}>:</Text>

              {/* Seconds */}
              <View style={styles.inputColumn}>
                <TextInput
                  ref={secondsRef}
                  style={[
                    styles.timeInputBox,
                    {
                      backgroundColor: activeField === 'seconds' ? colors.primaryBg : colors.inputBg,
                      borderColor: activeField === 'seconds' ? colors.primary : colors.cardBorder,
                      color: activeField === 'seconds' ? colors.primary : colors.text,
                    },
                  ]}
                  value={secondsInput}
                  onChangeText={handleSecondsChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  onFocus={() => setActiveField('seconds')}
                  onBlur={() =>
                    setSecondsInput((prev) =>
                      String(Math.min(59, parseInt(prev || '0', 10) || 0)).padStart(2, '0')
                    )
                  }
                />
                <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>Seconds</Text>
              </View>
            </View>

            {/* Footer Actions */}
            <View style={styles.footerRow}>
              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  triggerHaptic('selection');
                  setHoursInput('00');
                  setMinutesInput('00');
                  setSecondsInput('00');
                }}>
                <Text style={[styles.resetBtnText, { color: colors.textSecondary }]}>Reset</Text>
              </Pressable>

              <View style={styles.footerActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    triggerHaptic('selection');
                    onClose();
                  }}>
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={handleConfirm}>
                  <Text style={[styles.actionBtnText, { color: colors.primary, fontWeight: '700' }]}>
                    OK
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dialogTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  dialogSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 14,
  },
  inputColumn: {
    alignItems: 'center',
  },
  timeInputBox: {
    width: 78,
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontSize: 11,
    marginTop: 5,
    fontWeight: '600',
  },
  colonText: {
    fontSize: 28,
    fontWeight: '700',
    marginHorizontal: 8,
    marginBottom: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
