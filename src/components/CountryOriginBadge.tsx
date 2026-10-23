import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useAppTheme } from '@/context/ThemeContext';
import { getCountryName, getCountryFlagUrl } from '@/utils/country';

export interface CountryOriginBadgeProps {
  countryCode?: string | null;
  onPress?: () => void;
  size?: 'small' | 'medium';
  style?: StyleProp<ViewStyle>;
  showName?: boolean;
}

export const CountryOriginBadge = React.memo(function CountryOriginBadge({
  countryCode,
  onPress,
  size = 'small',
  style,
  showName = false,
}: CountryOriginBadgeProps) {
  const { colors } = useAppTheme();
  const [imageError, setImageError] = useState(false);

  if (!countryCode || countryCode.trim().length === 0) {
    return null;
  }

  const code = countryCode.trim().toUpperCase();
  const flagUrl = getCountryFlagUrl(code);
  const countryName = getCountryName(code);

  const isMedium = size === 'medium';
  const flagSize = isMedium ? 16 : 13;
  const fontSize = isMedium ? 12 : 10.5;

  const content = (
    <View style={styles.snugRow}>
      {/* Country Code (and optional Name) Compartment */}
      <View style={[styles.codeCompartment, isMedium && styles.codeCompartmentMedium]}>
        <Text
          style={[
            styles.codeText,
            {
              color: colors.textSecondary,
              fontSize,
            },
          ]}
          numberOfLines={1}
          selectable={!onPress}>
          {showName ? `${countryName} (${code})` : code}
        </Text>
      </View>

      {/* Snug Touching Divider */}
      {flagUrl && !imageError && (
        <View style={[styles.snugDivider, { backgroundColor: colors.cardBorder }]} />
      )}

      {/* Square Flag Compartment */}
      {flagUrl && !imageError && (
        <View style={[styles.flagCompartment, isMedium && styles.flagCompartmentMedium]}>
          <Image
            source={{ uri: flagUrl }}
            style={{
              width: flagSize,
              height: flagSize,
              borderRadius: 2,
            }}
            contentFit="cover"
            transition={150}
            onError={() => setImageError(true)}
          />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Country of origin: ${countryName}. Tap to filter in Discover.`}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: pressed ? colors.cardSelected : colors.inputBg,
            borderColor: pressed ? colors.primary : colors.cardBorder,
          },
          isMedium && styles.containerMedium,
          style,
        ]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputBg,
          borderColor: colors.cardBorder,
        },
        isMedium && styles.containerMedium,
        style,
      ]}>
      {content}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  containerMedium: {
    borderRadius: 10,
  },
  snugRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeCompartment: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeCompartmentMedium: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
  },
  codeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  snugDivider: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
  },
  flagCompartment: {
    paddingHorizontal: 3.5,
    paddingVertical: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagCompartmentMedium: {
    paddingHorizontal: 6,
    paddingVertical: 4.5,
  },
});
