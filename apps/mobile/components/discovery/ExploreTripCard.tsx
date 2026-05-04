import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Artwork from '@/components/ui/Artwork';
import { type TripPreview } from '@/services/trips';

type Props = {
  title: string;
  preview: TripPreview;
  creatorName: string | null;
  dateLabel?: string;
  /** Badge text shown top-right (e.g. "For You" or "Public") */
  badgeLabel?: string;
  /** Controls badge color — For You gets teal tint, public gets glass */
  isForYou?: boolean;
  /** Optional recommendation rationale line (For You only) */
  recommendationLine?: string;
  onPress: () => void;
};

function formatCreator(name: string | null) {
  return name?.trim() || 'Tripcholic traveler';
}

function formatCategory(cat: string | null) {
  if (!cat) return null;
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export default function ExploreTripCard({
  title,
  preview,
  creatorName,
  dateLabel,
  badgeLabel,
  isForYou,
  recommendationLine,
  onPress,
}: Props) {
  const imageUrl = preview.imageUrl?.trim() || null;
  const category = formatCategory(preview.primaryCategory ?? null);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageArea}>
        {/* Background: real image or branded placeholder */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Artwork kind="trip" variant="cover" label={title} />
        )}

        {/* Gradient simulation — dark scrim over bottom 70% */}
        <View style={styles.scrimBottom} />

        {/* Creator badge — top left */}
        <View style={styles.creatorBadge}>
          <Ionicons
            name="person-outline"
            size={11}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.creatorName} numberOfLines={1}>
            {formatCreator(creatorName)}
          </Text>
        </View>

        {/* Type badge — top right */}
        {badgeLabel ? (
          <View style={[styles.typeBadge, isForYou && styles.typeBadgeForYou]}>
            {isForYou && (
              <Ionicons name="sparkles" size={9} color="#00504F" />
            )}
            <Text
              style={[
                styles.typeBadgeText,
                isForYou && styles.typeBadgeTextForYou,
              ]}
            >
              {badgeLabel}
            </Text>
          </View>
        ) : null}

        {/* Bottom content area */}
        <View style={styles.bottomContent}>
          {/* Chips */}
          {(category || dateLabel) && (
            <View style={styles.chipsRow}>
              {category && (
                <View style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{category}</Text>
                </View>
              )}
              {dateLabel && (
                <View style={styles.dateChip}>
                  <Ionicons
                    name="calendar-outline"
                    size={9}
                    color="rgba(255,255,255,0.8)"
                  />
                  <Text style={styles.dateChipText}>{dateLabel}</Text>
                </View>
              )}
            </View>
          )}

          {/* Title */}
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>

          {/* Recommendation line */}
          {recommendationLine ? (
            <View style={styles.recRow}>
              <Ionicons
                name="sparkles-outline"
                size={11}
                color="rgba(125,245,244,0.9)"
              />
              <Text style={styles.recText} numberOfLines={2}>
                {recommendationLine}
              </Text>
            </View>
          ) : null}

          {/* Footer: district + open button */}
          <View style={styles.footer}>
            {preview.districtLabel ? (
              <View style={styles.districtRow}>
                <Ionicons
                  name="location-outline"
                  size={11}
                  color="rgba(255,255,255,0.6)"
                />
                <Text style={styles.districtText} numberOfLines={1}>
                  {preview.districtLabel}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <View style={styles.openButton}>
              <Ionicons name="arrow-forward" size={14} color="#006A69" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  imageArea: {
    height: 340,
    backgroundColor: '#DFF7F6',
  },

  // Gradient simulation
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '72%',
    backgroundColor: 'rgba(11,36,48,0.84)',
  },

  // Creator badge
  creatorBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 180,
  },
  creatorName: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  // Type badge
  typeBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeBadgeForYou: {
    backgroundColor: '#DFF7F6',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.9)',
  },
  typeBadgeTextForYou: {
    color: '#00504F',
  },

  // Bottom content
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryChip: {
    backgroundColor: 'rgba(223,247,246,0.88)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00504F',
    letterSpacing: 0.3,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dateChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  recText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(125,245,244,0.9)',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  districtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  districtText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  openButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
