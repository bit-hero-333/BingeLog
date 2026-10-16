import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { TimeFormatOption } from '@/types/media';

interface MaterialTimePickerModalProps {
  visible: boolean;
  initialHour: number; // 0-23
  initialMinute?: number; // 0-59
  timeFormat?: TimeFormatOption;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
}

type PickerDisplayMode = 'dial' | 'keypad';
type ActiveUnit = 'hour' | 'minute';

const DIAL_SIZE = 256;
const CENTER = DIAL_SIZE / 2;
const OUTER_RADIUS = 96;
const INNER_RADIUS = 58;
const MINUTE_RADIUS = 92;

export function MaterialTimePickerModal({
  visible,
  initialHour,
  initialMinute = 0,
  timeFormat = '24h',
  onClose,
  onConfirm,
}: MaterialTimePickerModalProps) {
  const { colors } = useAppTheme();
  const { triggerHaptic } = useMedia();

  const is24h = timeFormat === '24h';

  // Internal 24h state
  const [selectedHour, setSelectedHour] = useState<number>(initialHour);
  const [selectedMinute, setSelectedMinute] = useState<number>(initialMinute);
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>('hour');
  const [displayMode, setDisplayMode] = useState<PickerDisplayMode>('dial');

  // Keypad string inputs
  const [hourInput, setHourInput] = useState<string>(String(initialHour).padStart(2, '0'));
  const [minuteInput, setMinuteInput] = useState<string>(String(initialMinute).padStart(2, '0'));
  const minuteInputRef = useRef<TextInput | null>(null);

  // Sync state during render whenever modal opens
  const [prevVisible, setPrevVisible] = useState<boolean>(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      const h = Math.max(0, Math.min(23, initialHour));
      const m = Math.max(0, Math.min(59, initialMinute));
      setSelectedHour(h);
      setSelectedMinute(m);
      setActiveUnit('hour');
      setDisplayMode('dial');

      if (is24h) {
        setHourInput(String(h).padStart(2, '0'));
      } else {
        const display12 = h % 12 === 0 ? 12 : h % 12;
        setHourInput(String(display12).padStart(2, '0'));
      }
      setMinuteInput(String(m).padStart(2, '0'));
    }
  }

  // 12-hour AM/PM calculation
  const isPM = selectedHour >= 12;
  const hour12Display = selectedHour % 12 === 0 ? 12 : selectedHour % 12;

  const togglePeriod = (targetPM: boolean) => {
    triggerHaptic('selection');
    if (targetPM && !isPM) {
      setSelectedHour((prev) => prev + 12);
    } else if (!targetPM && isPM) {
      setSelectedHour((prev) => prev - 12);
    }
  };

  // Dial layout position tracking for touch coordinates
  const dialLayoutRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: DIAL_SIZE,
    height: DIAL_SIZE,
  });

  const onDialLayout = (e: LayoutChangeEvent) => {
    e.target.measure((_x, _y, width, height, pageX, pageY) => {
      dialLayoutRef.current = { x: pageX, y: pageY, width, height };
    });
  };

  // Dial touch calculation
  const handleDialTouch = useCallback(
    (touchX: number, touchY: number, isRelease = false) => {
      const dx = touchX - CENTER;
      const dy = touchY - CENTER;
      const dist = Math.hypot(dx, dy);

      // Angle in degrees where 0 deg is 12 o'clock, clockwise
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      if (activeUnit === 'hour') {
        const idx = Math.round(deg / 30) % 12; // 0 to 11

        let nextHour = 0;
        if (is24h) {
          // Inner circle (< 76px) is 1-12, Outer circle is 13-23, 00
          if (dist < 76) {
            nextHour = idx === 0 ? 12 : idx;
          } else {
            nextHour = idx === 0 ? 0 : idx + 12;
          }
        } else {
          const raw12 = idx === 0 ? 12 : idx;
          nextHour = isPM ? (raw12 === 12 ? 12 : raw12 + 12) : raw12 === 12 ? 0 : raw12;
        }

        if (nextHour !== selectedHour) {
          setSelectedHour(nextHour);
          setHourInput(
            String(is24h ? nextHour : nextHour % 12 === 0 ? 12 : nextHour % 12).padStart(2, '0')
          );
          triggerHaptic('selection');
        }

        // Automatically advance to minute mode on touch release
        if (isRelease) {
          setActiveUnit('minute');
        }
      } else {
        // Minute mode: 0-59
        const nextMinute = Math.round(deg / 6) % 60;
        if (nextMinute !== selectedMinute) {
          setSelectedMinute(nextMinute);
          setMinuteInput(String(nextMinute).padStart(2, '0'));
          triggerHaptic('selection');
        }
      }
    },
    [activeUnit, is24h, isPM, selectedHour, selectedMinute, triggerHaptic]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          handleDialTouch(locationX, locationY, false);
        },
        onPanResponderMove: (evt: GestureResponderEvent, _gesture: PanResponderGestureState) => {
          const { locationX, locationY } = evt.nativeEvent;
          handleDialTouch(locationX, locationY, false);
        },
        onPanResponderRelease: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          handleDialTouch(locationX, locationY, true);
        },
      }),
    [handleDialTouch]
  );

  // Compute pointer needle rotation angle and length
  const { needleAngle, needleRadius } = useMemo(() => {
    if (activeUnit === 'hour') {
      if (is24h) {
        const isInner = selectedHour >= 1 && selectedHour <= 12;
        const idx = selectedHour % 12;
        return {
          needleAngle: idx * 30,
          needleRadius: isInner ? INNER_RADIUS : OUTER_RADIUS,
        };
      } else {
        const idx = selectedHour % 12;
        return {
          needleAngle: idx * 30,
          needleRadius: OUTER_RADIUS,
        };
      }
    } else {
      return {
        needleAngle: selectedMinute * 6,
        needleRadius: MINUTE_RADIUS,
      };
    }
  }, [activeUnit, selectedHour, selectedMinute, is24h]);

  // Keypad text change handlers
  const handleHourTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setHourInput(cleaned);

    const val = parseInt(cleaned, 10);
    if (!isNaN(val)) {
      if (is24h) {
        if (val >= 0 && val <= 23) {
          setSelectedHour(val);
          if (cleaned.length === 2 && minuteInputRef.current) {
            minuteInputRef.current.focus();
          }
        }
      } else {
        if (val >= 1 && val <= 12) {
          const actual24 = isPM ? (val === 12 ? 12 : val + 12) : val === 12 ? 0 : val;
          setSelectedHour(actual24);
          if (cleaned.length === 2 && minuteInputRef.current) {
            minuteInputRef.current.focus();
          }
        }
      }
    }
  };

  const handleMinuteTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setMinuteInput(cleaned);

    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val >= 0 && val <= 59) {
      setSelectedMinute(val);
    }
  };

  const handleConfirm = () => {
    triggerHaptic('success');
    onConfirm(selectedHour, selectedMinute);
    onClose();
  };

  // Dial numbers generation
  const hourNumbers = useMemo(() => {
    if (!is24h) {
      // 12-hour: 1 to 12
      return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        const x = CENTER + OUTER_RADIUS * Math.cos(rad);
        const y = CENTER + OUTER_RADIUS * Math.sin(rad);
        const isSelected = selectedHour % 12 === num % 12;
        return { label: String(num), x, y, isSelected, isSmall: false };
      });
    }

    // 24-hour: Outer ring 00, 13-23; Inner ring 12, 1-11
    const outer = ['00', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'].map(
      (lbl, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        const x = CENTER + OUTER_RADIUS * Math.cos(rad);
        const y = CENTER + OUTER_RADIUS * Math.sin(rad);
        const val = i === 0 ? 0 : i + 12;
        return { label: lbl, x, y, isSelected: selectedHour === val, isSmall: false };
      }
    );

    const inner = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map((lbl, i) => {
      const rad = ((i * 30 - 90) * Math.PI) / 180;
      const x = CENTER + INNER_RADIUS * Math.cos(rad);
      const y = CENTER + INNER_RADIUS * Math.sin(rad);
      const val = i === 0 ? 12 : i;
      return { label: lbl, x, y, isSelected: selectedHour === val, isSmall: true };
    });

    return [...outer, ...inner];
  }, [is24h, selectedHour]);

  const minuteNumbers = useMemo(() => {
    return ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(
      (lbl, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        const x = CENTER + MINUTE_RADIUS * Math.cos(rad);
        const y = CENTER + MINUTE_RADIUS * Math.sin(rad);
        const val = i * 5;
        const isSelected = selectedMinute === val;
        return { label: lbl, x, y, isSelected };
      }
    );
  }, [selectedMinute]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <Text style={[styles.dialogTitle, { color: colors.textSecondary }]}>Select time</Text>

          {/* Time Display Header Box */}
          <View style={styles.timeDisplayRow}>
            {/* Hour Card */}
            <Pressable
              style={[
                styles.timeBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                activeUnit === 'hour' && [
                  styles.timeBoxActive,
                  { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                ],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setActiveUnit('hour');
              }}>
              <Text
                style={[
                  styles.timeBoxText,
                  { color: activeUnit === 'hour' ? colors.primary : colors.text },
                ]}>
                {String(is24h ? selectedHour : hour12Display).padStart(2, '0')}
              </Text>
            </Pressable>

            {/* Colon Separator */}
            <Text style={[styles.colonText, { color: colors.text }]}>:</Text>

            {/* Minute Card */}
            <Pressable
              style={[
                styles.timeBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                activeUnit === 'minute' && [
                  styles.timeBoxActive,
                  { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                ],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setActiveUnit('minute');
              }}>
              <Text
                style={[
                  styles.timeBoxText,
                  { color: activeUnit === 'minute' ? colors.primary : colors.text },
                ]}>
                {String(selectedMinute).padStart(2, '0')}
              </Text>
            </Pressable>

            {/* 12-Hour AM/PM Toggle */}
            {!is24h && (
              <View style={[styles.periodCol, { borderColor: colors.cardBorder }]}>
                <Pressable
                  style={[
                    styles.periodBtn,
                    !isPM && [styles.periodBtnActive, { backgroundColor: colors.primaryBg }],
                  ]}
                  onPress={() => togglePeriod(false)}>
                  <Text
                    style={[
                      styles.periodText,
                      { color: !isPM ? colors.primary : colors.textSecondary },
                    ]}>
                    AM
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.periodBtn,
                    isPM && [styles.periodBtnActive, { backgroundColor: colors.primaryBg }],
                  ]}
                  onPress={() => togglePeriod(true)}>
                  <Text
                    style={[
                      styles.periodText,
                      { color: isPM ? colors.primary : colors.textSecondary },
                    ]}>
                    PM
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Mode 1: Dial Face */}
          {displayMode === 'dial' ? (
            <View
              style={[styles.dialContainer, { backgroundColor: colors.inputBg }]}
              onLayout={onDialLayout}
              {...panResponder.panHandlers}>
              {/* Pointer Needle & Selector Thumb */}
              <View
                style={[
                  styles.needlePivot,
                  {
                    transform: [{ rotate: `${needleAngle}deg` }],
                  },
                ]}>
                <View
                  style={[
                    styles.needleArm,
                    {
                      height: needleRadius,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.needleThumb,
                    {
                      bottom: needleRadius - 16,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>

              {/* Center Dot */}
              <View style={[styles.centerPivotDot, { backgroundColor: colors.primary }]} />

              {/* Numbers */}
              {activeUnit === 'hour'
                ? hourNumbers.map((item, idx) => (
                    <View
                      key={`hour-${idx}-${item.label}`}
                      pointerEvents="none"
                      style={[
                        styles.numberWrap,
                        {
                          left: item.x - 16,
                          top: item.y - 16,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.numberText,
                          {
                            color: item.isSelected ? '#ffffff' : colors.text,
                            fontSize: item.isSmall ? 11 : 13.5,
                            fontWeight: item.isSelected ? '700' : '500',
                          },
                        ]}>
                        {item.label}
                      </Text>
                    </View>
                  ))
                : minuteNumbers.map((item, idx) => (
                    <View
                      key={`minute-${idx}-${item.label}`}
                      pointerEvents="none"
                      style={[
                        styles.numberWrap,
                        {
                          left: item.x - 16,
                          top: item.y - 16,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.numberText,
                          {
                            color: item.isSelected ? '#ffffff' : colors.text,
                            fontSize: 13,
                            fontWeight: item.isSelected ? '700' : '500',
                          },
                        ]}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
            </View>
          ) : (
            /* Mode 2: Digital Keypad Input */
            <View style={styles.keypadContainer}>
              <View style={styles.keypadInputsRow}>
                <View style={styles.keypadInputGroup}>
                  <TextInput
                    style={[
                      styles.keypadTextInput,
                      {
                        backgroundColor: colors.inputBg,
                        color: colors.primary,
                        borderColor: activeUnit === 'hour' ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    value={hourInput}
                    onChangeText={handleHourTextChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    onFocus={() => setActiveUnit('hour')}
                  />
                  <Text style={[styles.keypadSubLabel, { color: colors.textSecondary }]}>Hour</Text>
                </View>

                <Text style={[styles.keypadColon, { color: colors.text }]}>:</Text>

                <View style={styles.keypadInputGroup}>
                  <TextInput
                    ref={minuteInputRef}
                    style={[
                      styles.keypadTextInput,
                      {
                        backgroundColor: colors.inputBg,
                        color: colors.primary,
                        borderColor: activeUnit === 'minute' ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    value={minuteInput}
                    onChangeText={handleMinuteTextChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    onFocus={() => setActiveUnit('minute')}
                  />
                  <Text style={[styles.keypadSubLabel, { color: colors.textSecondary }]}>Minute</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Row */}
          <View style={styles.footerRow}>
            {/* Toggle Mode Button (Clock <-> Keyboard) */}
            <Pressable
              style={styles.modeToggleBtn}
              onPress={() => {
                triggerHaptic('selection');
                setDisplayMode((m) => (m === 'dial' ? 'keypad' : 'dial'));
              }}
              hitSlop={8}>
              <Ionicons
                name={displayMode === 'dial' ? 'keypad-outline' : 'time-outline'}
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>

            {/* Cancel and OK Buttons */}
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
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogCard: {
    width: 320,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dialogTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timeBox: {
    width: 86,
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBoxActive: {
    borderWidth: 2,
  },
  timeBoxText: {
    fontSize: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  colonText: {
    fontSize: 32,
    fontWeight: '700',
    marginHorizontal: 10,
    marginBottom: 4,
  },
  periodCol: {
    marginLeft: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  periodBtnActive: {
    elevation: 1,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dialContainer: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  needlePivot: {
    position: 'absolute',
    left: CENTER,
    top: CENTER,
    width: 0,
    height: 0,
    alignItems: 'center',
  },
  needleArm: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    left: -1,
  },
  needleThumb: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    left: -16,
  },
  centerPivotDot: {
    position: 'absolute',
    left: CENTER - 4,
    top: CENTER - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  numberWrap: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontVariant: ['tabular-nums'],
  },
  keypadContainer: {
    height: DIAL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadInputGroup: {
    alignItems: 'center',
  },
  keypadTextInput: {
    width: 90,
    height: 72,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
  },
  keypadSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  keypadColon: {
    fontSize: 36,
    fontWeight: '700',
    marginHorizontal: 10,
    marginBottom: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 10,
  },
  modeToggleBtn: {
    padding: 8,
    borderRadius: 20,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
