import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import {
  likePublicTrip,
  savePublicTrip,
  unlikePublicTrip,
  unsavePublicTrip,
  updateSavedTripCollections,
} from '@/services/publicTrips';

type Props = {
  tripId: string;
  title: string;
  date: string;
  imageUrl: string | null;
  likeCount: number;
  saveCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  token: string | null;
  cardWidth: number;
  onPress?: () => void;
  // Optional: for collection-aware unsave behaviour
  savedTripId?: string;
  currentCollectionIds?: string[];
  onUnsave?: () => void;
  // Optional: for multi-select picker
  selected?: boolean;
  selectable?: boolean;
  // Stable toggle callback — avoids re-creating onPress on every parent render
  onSelectToggle?: (savedTripId: string) => void;
};

function formatShortDate(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SavedTripPostCard({
  tripId,
  title,
  date,
  imageUrl,
  likeCount: initialLikeCount,
  saveCount: initialSaveCount,
  commentCount,
  likedByMe: initialLiked,
  savedByMe: initialSaved,
  token,
  cardWidth,
  onPress,
  savedTripId,
  currentCollectionIds,
  onUnsave,
  selected = false,
  selectable = false,
  onSelectToggle,
}: Props) {
  const imageHeight = Math.round(cardWidth * 1.3);

  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [saveCount, setSaveCount] = useState(initialSaveCount);

  const handleLike = async () => {
    if (!token) return;
    const prev = liked;
    const prevCount = likeCount;
    setLiked(!prev);
    setLikeCount(prev ? prevCount - 1 : prevCount + 1);
    try {
      if (prev) await unlikePublicTrip(tripId, token);
      else await likePublicTrip(tripId, token);
    } catch {
      setLiked(prev);
      setLikeCount(prevCount);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    const prev = saved;
    const prevCount = saveCount;
    setSaved(!prev);
    setSaveCount(prev ? prevCount - 1 : prevCount + 1);
    try {
      if (prev) {
        // Clear collection memberships before unsaving so the trip is
        // removed from collections even if the server doesn't cascade.
        if (savedTripId && currentCollectionIds && currentCollectionIds.length > 0) {
          await updateSavedTripCollections(token, savedTripId, []);
        }
        await unsavePublicTrip(tripId, token);
        onUnsave?.();
      } else {
        await savePublicTrip(tripId, token);
      }
    } catch {
      setSaved(prev);
      setSaveCount(prevCount);
    }
  };

  const handlePress = () => {
    if (selectable && savedTripId && onSelectToggle) {
      onSelectToggle(savedTripId);
    } else {
      onPress?.();
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cardWrap,
        { width: cardWidth },
        pressed && !selectable && { opacity: 0.93 },
      ]}
      onPress={handlePress}
    >
      {selectable && selected && (
        <View pointerEvents="none" style={styles.selectionRing} />
      )}
      <View style={styles.card}>
        <View style={[styles.imageWrap, { height: imageHeight }]}>
          <Artwork imageUrl={imageUrl} kind="trip" variant="cover" />
          {selectable && selected && (
            <View style={styles.selectionOverlay}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            </View>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.date}>{formatShortDate(date)}</Text>
          {!selectable && (
            <View style={styles.metricsRow}>
              <Pressable style={styles.metricItem} onPress={() => void handleLike()} hitSlop={8}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={14}
                  color={liked ? '#EF4444' : theme.colors.textSecondary}
                />
                <Text style={styles.metricText}>{likeCount}</Text>
              </Pressable>
              <View style={styles.metricItem}>
                <Ionicons name="chatbubble-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.metricText}>{commentCount}</Text>
              </View>
              <Pressable style={styles.metricItem} onPress={() => void handleSave()} hitSlop={8}>
                <Ionicons
                  name={saved ? 'bookmark' : 'bookmark-outline'}
                  size={14}
                  color={saved ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text style={styles.metricText}>{saveCount}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    // Outer pressable — no overflow:hidden so the selection ring can expand outside
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  selectionRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  imageWrap: {
    width: '100%',
    position: 'relative',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,165,164,0.30)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 8,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 10,
    gap: 3,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primaryDark,
  },
  date: {
    fontFamily: font.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 3,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
