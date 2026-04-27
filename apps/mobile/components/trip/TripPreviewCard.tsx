import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';
import { type TripPreview } from '@/services/trips';

type Props = {
  preview: TripPreview;
  dateLabel?: string;
  rightContent?: ReactNode;
  variant?: 'card' | 'hero';
};

function formatCategoryLabel(category: string | null) {
  if (!category) {
    return 'Trip';
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function TripPreviewCard({
  preview,
  dateLabel,
  rightContent,
  variant = 'card',
}: Props) {
  const isHero = variant === 'hero';
  const hasImage = preview.imageUrl !== null;
  const headlineColor = hasImage ? theme.colors.white : theme.colors.text;
  const secondaryTextColor = hasImage ? 'rgba(255,255,255,0.88)' : theme.colors.textSecondary;

  return (
    <View style={[styles.container, isHero ? styles.containerHero : styles.containerCard]}>
      {preview.imageUrl ? (
        <Image
          source={{ uri: preview.imageUrl }}
          style={styles.backgroundImage}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View
        style={[
          styles.overlay,
          preview.imageUrl ? styles.overlayWithImage : styles.overlayWithoutImage,
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.kickerRow}>
          <View style={styles.kickerChip}>
            <Text style={styles.kickerText}>
              {formatCategoryLabel(preview.primaryCategory)}
            </Text>
          </View>
            {dateLabel ? (
              <Text style={[styles.dateText, { color: secondaryTextColor }]}>
                {dateLabel}
              </Text>
            ) : null}
          </View>
          {rightContent ? <View>{rightContent}</View> : null}
        </View>

        <View style={styles.textBlock}>
          <Text
            style={[
              styles.headline,
              isHero && styles.headlineHero,
              { color: headlineColor },
            ]}
          >
            {preview.headline}
          </Text>
          {preview.subheadline ? (
            <Text style={[styles.subheadline, { color: secondaryTextColor }]}>
              {preview.subheadline}
            </Text>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          {preview.districtLabel ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>{preview.districtLabel}</Text>
            </View>
          ) : null}

          {preview.hasMapData ? (
            <View style={styles.metaItem}>
              <Ionicons name="map-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>Route ready</Text>
            </View>
          ) : null}

          {preview.hasPoiImage ? (
            <View style={styles.metaItem}>
              <Ionicons name="image-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>Photo available</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  containerCard: {
    minHeight: 180,
    marginBottom: theme.spacing.md,
  },
  containerHero: {
    minHeight: 220,
    marginBottom: theme.spacing.xl,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
  },
  overlayWithImage: {
    backgroundColor: 'rgba(15, 23, 42, 0.40)',
  },
  overlayWithoutImage: {
    backgroundColor: '#F8FBFC',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  kickerRow: {
    gap: theme.spacing.xs,
    flex: 1,
  },
  kickerChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kickerText: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 13,
  },
  textBlock: {
    gap: theme.spacing.xs,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
  },
  headlineHero: {
    fontSize: 24,
  },
  subheadline: {
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
