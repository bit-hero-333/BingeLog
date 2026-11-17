import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';

export interface AppAlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface DialogItem {
  id: number;
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
}

type Listener = (item: DialogItem) => void;

let nextDialogId = 1;
let activeListener: Listener | null = null;
const pendingQueue: DialogItem[] = [];

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[]): void {
    const item: DialogItem = {
      id: nextDialogId++,
      title,
      message,
      buttons,
    };
    if (activeListener) {
      activeListener(item);
    } else {
      pendingQueue.push(item);
    }
  },
};

export function AppDialogHost() {
  const { colors } = useAppTheme();
  const { triggerHaptic } = useMedia();
  const [queue, setQueue] = useState<DialogItem[]>(() => {
    if (pendingQueue.length > 0) {
      const initial = [...pendingQueue];
      pendingQueue.length = 0;
      return initial;
    }
    return [];
  });

  useEffect(() => {
    const listener: Listener = (item) => {
      setQueue((prev) => [...prev, item]);
    };
    activeListener = listener;
    return () => {
      if (activeListener === listener) {
        activeListener = null;
      }
    };
  }, []);

  const current = queue[0] || null;

  const dismissCurrentAndRun = useCallback(
    (callback?: () => void) => {
      triggerHaptic('selection');
      setQueue((prev) => prev.slice(1));
      if (callback) {
        setTimeout(() => {
          callback();
        }, 40);
      }
    },
    [triggerHaptic]
  );

  if (!current) return null;

  const rawButtons: AppAlertButton[] =
    current.buttons && current.buttons.length > 0
      ? current.buttons
      : [{ text: 'OK', style: 'default' }];

  const hasDestructive = rawButtons.some((b) => b.style === 'destructive');
  const titleLower = current.title.toLowerCase();
  const isError =
    titleLower.includes('error') ||
    titleLower.includes('failed') ||
    titleLower.includes('empty') ||
    titleLower.includes('invalid');
  const isSuccess =
    titleLower.includes('success') ||
    titleLower.includes('complete') ||
    titleLower.includes('saved') ||
    titleLower.includes('replaced') ||
    titleLower.includes('cleared');

  const badgeColor =
    hasDestructive || isError ? '#ef4444' : isSuccess ? '#10b981' : colors.primary;
  const badgeBg =
    hasDestructive || isError
      ? 'rgba(239, 68, 68, 0.14)'
      : isSuccess
      ? 'rgba(16, 185, 129, 0.14)'
      : colors.primaryBg;
  const badgeIcon: keyof typeof Ionicons.glyphMap = hasDestructive
    ? 'warning-outline'
    : isError
    ? 'alert-circle-outline'
    : isSuccess
    ? 'checkmark-circle-outline'
    : 'information-circle-outline';

  const cancelBtn = rawButtons.find((b) => b.style === 'cancel');
  const actionBtns = rawButtons.filter((b) => b.style !== 'cancel');
  const isStacked = rawButtons.length >= 3;

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (cancelBtn) {
          dismissCurrentAndRun(cancelBtn.onPress);
        } else if (rawButtons.length === 1) {
          dismissCurrentAndRun(rawButtons[0].onPress);
        } else {
          dismissCurrentAndRun();
        }
      }}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (cancelBtn) {
              dismissCurrentAndRun(cancelBtn.onPress);
            } else if (rawButtons.length === 1) {
              dismissCurrentAndRun(rawButtons[0].onPress);
            }
          }}
        />

        <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
              <Ionicons name={badgeIcon} size={22} color={badgeColor} />
            </View>
            <Text style={[styles.titleText, { color: colors.text }]}>{current.title}</Text>
          </View>

          {/* Message Body */}
          {current.message ? (
            <ScrollView
              style={styles.messageScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              <Text style={[styles.messageText, { color: colors.textSecondary }]}>
                {current.message}
              </Text>
            </ScrollView>
          ) : null}

          {/* Buttons */}
          {isStacked ? (
            <View style={styles.stackedButtonsCol}>
              {[...actionBtns].reverse().map((btn, idx) => {
                const isDestructive = btn.style === 'destructive';
                const isPrimary = idx === 0 && !isDestructive;
                return (
                  <Pressable
                    key={`act-${idx}-${btn.text}`}
                    style={({ pressed }) => [
                      styles.stackedBtn,
                      isPrimary && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                      isDestructive && {
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        borderColor: '#ef4444',
                      },
                      !isPrimary &&
                        !isDestructive && {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.cardBorder,
                        },
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => dismissCurrentAndRun(btn.onPress)}>
                    <Text
                      style={[
                        styles.btnText,
                        {
                          color: isPrimary
                            ? '#ffffff'
                            : isDestructive
                            ? '#ef4444'
                            : colors.text,
                        },
                      ]}>
                      {btn.text || 'OK'}
                    </Text>
                  </Pressable>
                );
              })}

              {cancelBtn && (
                <Pressable
                  style={({ pressed }) => [
                    styles.stackedBtn,
                    {
                      backgroundColor: 'transparent',
                      borderColor: colors.cardBorder,
                      marginTop: 2,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => dismissCurrentAndRun(cancelBtn.onPress)}>
                  <Text style={[styles.btnText, { color: colors.textSecondary }]}>
                    {cancelBtn.text || 'Cancel'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.rowButtons}>
              {cancelBtn && (
                <Pressable
                  style={({ pressed }) => [
                    styles.rowBtn,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.cardBorder,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => dismissCurrentAndRun(cancelBtn.onPress)}>
                  <Text style={[styles.btnText, { color: colors.textSecondary }]}>
                    {cancelBtn.text || 'Cancel'}
                  </Text>
                </Pressable>
              )}

              {actionBtns.map((btn, idx) => {
                const isDestructive = btn.style === 'destructive';
                return (
                  <Pressable
                    key={`row-act-${idx}-${btn.text}`}
                    style={({ pressed }) => [
                      styles.rowBtn,
                      isDestructive
                        ? {
                            backgroundColor: '#ef4444',
                            borderColor: '#ef4444',
                          }
                        : {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => dismissCurrentAndRun(btn.onPress)}>
                    <Text style={[styles.btnText, { color: '#ffffff' }]}>
                      {btn.text || 'OK'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
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
    padding: 22,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  messageScroll: {
    maxHeight: 260,
    marginBottom: 18,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  rowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  rowBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedButtonsCol: {
    gap: 8,
    marginTop: 2,
  },
  stackedBtn: {
    width: '100%',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 13.5,
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
