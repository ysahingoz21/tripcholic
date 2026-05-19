import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import { type TripListItem, type TripVisibility } from '@/services/trips';

function getVisibilityConfig(v: TripVisibility) {
  if (v === 'PUBLIC') return { label: 'Public', icon: 'earth-outline' as const };
  return { label: 'Private', icon: 'lock-closed-outline' as const };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  trip: TripListItem;
  onPress: () => void;
};

export default function TripSnapshotCard({ trip, onPress }: Props) {
  const stopCount = trip._count?.stops ?? 0;
  const vis = getVisibilityConfig(trip.visibility);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Image band — rounded, image-first */}
      <View style={styles.imageWrap}>
        <Artwork
          imageUrl={trip.preview?.imageUrl}
          kind="trip"
          variant="cover"
          label={trip.title}
        />
        <View style={styles.visBadge}>
          <Ionicons name={vis.icon} size={11} color={theme.colors.primaryDark} />
          <Text style={styles.visText}>{vis.label}</Text>
        </View>
      </View>

      {/* Caption below image — light, no box */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {trip.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{formatDate(trip.date)}</Text>
          {stopCount > 0 && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>
                {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 216,
  },
  cardPressed: {
    opacity: 0.82,
  },

  imageWrap: {
    height: 259,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#DFF7F6',
  },
  visBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  visText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: theme.colors.primaryDark,
    letterSpacing: 0.1,
  },

  info: {
    paddingTop: 8,
    paddingHorizontal: 2,
    gap: 3,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  metaDot: {
    fontFamily: font.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
