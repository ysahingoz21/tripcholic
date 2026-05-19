import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, memo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SavedTripPostCardBase from '@/components/saved/SavedTripPostCard';

const SavedTripPostCard = memo(SavedTripPostCardBase);
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import {
  getSavedPublicTrips,
  type SavedPublicTripItem,
  updateSavedTripCollections,
} from '@/services/publicTrips';

const H_PAD = 20;
const CARD_GAP = 12;

export default function CollectionAddTripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { id: collectionId } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const cardWidth = Math.floor((screenWidth - H_PAD * 2 - CARD_GAP) / 2);

  const [items, setItems] = useState<SavedPublicTripItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !collectionId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const result = await getSavedPublicTrips(token);
      // Only show trips not already in this collection
      const eligible = result.items.filter(
        (item) => !item.collections.some((c) => c.id === collectionId)
      );
      setItems(eligible);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load saved trips.');
    } finally {
      setIsLoading(false);
    }
  }, [token, collectionId]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const toggleSelect = useCallback((savedTripId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(savedTripId)) {
        next.delete(savedTripId);
      } else {
        next.add(savedTripId);
      }
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    if (selectedIds.size === 0 || !token || !collectionId) {
      router.back();
      return;
    }

    try {
      setIsConfirming(true);
      const toUpdate = items.filter((item) => selectedIds.has(item.savedTripId));
      await Promise.all(
        toUpdate.map((item) =>
          updateSavedTripCollections(token, item.savedTripId, [
            ...item.collections.map((c) => c.id),
            collectionId,
          ])
        )
      );
      router.back();
    } catch (e) {
      setIsConfirming(false);
      Alert.alert(
        'Could not add trips',
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    }
  };

  // Build 2-column rows
  const rows: SavedPublicTripItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.pageHeader, { paddingTop: insets.top }]}>
        <View style={styles.pageHeaderInner}>
          <View style={styles.hdrSide}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={theme.colors.primaryDark} />
            </Pressable>
          </View>

          <Text style={styles.pageTitle}>Add from Saved Trips</Text>

          <View style={[styles.hdrSide, styles.hdrSideRight]}>
            {isConfirming ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  selectedIds.size === 0 && styles.confirmBtnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => void handleConfirm()}
                hitSlop={8}
              >
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={selectedIds.size > 0 ? theme.colors.primary : theme.colors.textSecondary}
                />
                {selectedIds.size > 0 && (
                  <Text style={styles.confirmCount}>{selectedIds.size}</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={32} color={theme.colors.textSecondary} />
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void loadData()}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="checkmark-circle-outline" size={40} color={theme.colors.primary} />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.stateText}>All your saved trips are already in this collection.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.hintText}>
            {selectedIds.size === 0
              ? 'Tap trips to select them'
              : `${selectedIds.size} trip${selectedIds.size === 1 ? '' : 's'} selected`}
          </Text>
          <View style={styles.grid}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={[styles.row, { gap: CARD_GAP }]}>
                {row.map((item) => (
                  <SavedTripPostCard
                    key={item.savedTripId}
                    tripId={item.trip.id}
                    title={item.trip.title}
                    date={item.trip.date}
                    imageUrl={item.preview.imageUrl ?? null}
                    likeCount={item.engagement.likeCount}
                    saveCount={item.engagement.saveCount}
                    commentCount={item.engagement.commentCount}
                    likedByMe={item.engagement.likedByMe}
                    savedByMe={item.engagement.savedByMe}
                    token={token}
                    cardWidth={cardWidth}
                    savedTripId={item.savedTripId}
                    onSelectToggle={toggleSelect}
                    selected={selectedIds.has(item.savedTripId)}
                    selectable
                  />
                ))}
                {row.length === 1 && <View style={{ width: cardWidth }} />}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  pageHeader: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  pageHeaderInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  hdrSide: {
    width: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  hdrSideRight: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 0.5,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmCount: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primary,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryBtnText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 12,
  },
  hintText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  grid: {
    gap: CARD_GAP,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
