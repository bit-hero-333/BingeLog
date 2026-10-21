import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { useMedia } from '@/context/MediaContext';
import { ALL_COUNTRIES, CountryItem } from '@/utils/country';
import { getTextScale, getHeaderScale, getButtonScale } from '@/utils/sizing';

interface CountryPickerModalProps {
  visible: boolean;
  selectedCountries: string[];
  onToggleCountry: (code: string) => void;
  onClose: () => void;
}

export function CountryPickerModal({
  visible,
  selectedCountries,
  onToggleCountry,
  onClose,
}: CountryPickerModalProps) {
  const { colors } = useAppTheme();
  const { sizingConfig, triggerHaptic } = useMedia();

  const textScale = getTextScale(sizingConfig?.textSize);
  const headerScale = getHeaderScale(sizingConfig?.headerSize);
  const buttonScale = getButtonScale(sizingConfig?.buttonSize);

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);

  const renderItem = ({ item }: { item: CountryItem }) => {
    const isSelected = selectedCountries.includes(item.code);

    return (
      <Pressable
        style={[
          styles.rowItem,
          { borderBottomColor: colors.cardBorder },
          isSelected && { backgroundColor: colors.primaryBg },
        ]}
        onPress={() => {
          triggerHaptic('selection');
          onToggleCountry(item.code);
        }}>
        <View style={styles.rowLeft}>
          <Image
            source={{ uri: `https://flagcdn.com/w40/${item.code.toLowerCase()}.png` }}
            style={styles.flag}
            contentFit="cover"
          />
          <Text
            style={[
              styles.countryName,
              { color: isSelected ? colors.primary : colors.text, fontSize: 13 * textScale },
              isSelected && { fontWeight: '700' },
            ]}
            numberOfLines={1}>
            {item.name} ({item.code})
          </Text>
        </View>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={isSelected ? colors.primary : colors.cardBorder}
        />
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.dialogSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text, fontSize: 15 * headerScale }]}>
                Countries of Origin
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontSize: 11 * textScale }]}>
                {selectedCountries.length > 0
                  ? `${selectedCountries.length} selected`
                  : 'All 252 world countries & territories'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={[
                styles.searchInput,
                { color: colors.text, fontSize: 12.5 * textScale },
              ]}
              placeholder="Search country or code (e.g. Turkey, JP)..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              multiline={false}
              numberOfLines={1}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* FlatList */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={25}
            windowSize={10}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 12 * textScale }]}>
                  No countries found matching &ldquo;{query}&rdquo;.
                </Text>
              </View>
            }
          />

          {/* Footer Done */}
          <View style={[styles.footer, { borderTopColor: colors.cardBorder }]}>
            <Pressable
              style={[styles.doneBtn, { backgroundColor: colors.primary, minHeight: Math.round(40 * buttonScale) }]}
              onPress={onClose}>
              <Text style={[styles.doneBtnText, { fontSize: 13.5 * textScale }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  dialogSheet: {
    width: '90%',
    maxHeight: '82%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  list: {
    flexGrow: 1,
    maxHeight: 380,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  flag: {
    width: 20,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  countryName: {
    flex: 1,
  },
  emptyWrap: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
  },
  doneBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
