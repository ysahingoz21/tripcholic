import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';

type Props = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Local asset from require() — e.g. require('@/assets/images/planner/categories/...'). Falls back to placeholderBg if omitted. */
  localImage?: number;
  placeholderBg: string;
  selected: boolean;
  onPress: () => void;
};

export default function CategoryCard({
  label,
  icon,
  localImage,
  placeholderBg,
  selected,
  onPress,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      android_ripple={{ color: 'transparent' }}
    >
      {selected && <View pointerEvents="none" style={styles.selectionRing} />}

      <View style={styles.card}>
        {/* Background: local asset or solid colour placeholder */}
        {localImage != null ? (
          <Image
            source={localImage}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: placeholderBg }]}
          />
        )}

        {/* Dark scrim at the bottom for overlay legibility */}
        <View style={styles.scrim} />

        {/* Icon + label — white, bottom-left */}
        <View style={styles.overlay}>
          <Ionicons name={icon} size={15} color="#FFFFFF" />
          <Text style={styles.overlayLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>

        {/* Selected indicator — green badge with white check, top-right */}
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    height: 224,
    position: 'relative',
  },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0a1a1a',
  },
  selectionRing: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: '#006A69',
  },
  cardPressed: {
    opacity: 0.96,
  },

  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },

  overlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  overlayLabel: {
    fontFamily: font.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
    flexShrink: 1,
  },

  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#006A69',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
