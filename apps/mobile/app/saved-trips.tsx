import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_COLLECTION_COVER } from '@/components/saved/collectionCovers';
import SavedTripPostCard from '@/components/saved/SavedTripPostCard';
import { theme } from '@/constants/theme';
import { font, type } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import {
  getSavedPublicTrips,
  type SavedPublicTripsResponse,
  type SavedTripCollectionSummary,
} from '@/services/publicTrips';

const H_PAD = 20;
const CARD_GAP = 12;

// ── Strip card sizes ──────────────────────────────────────────────────────────

const STRIP_W = 158;
const STRIP_IMG_H = 96;
const STRIP_INFO_H = 50;
const STRIP_H = STRIP_IMG_H + STRIP_INFO_H;

// ── CollectionStripCard ───────────────────────────────────────────────────────

function CollectionStripCard({
  collection,
  onPress,
}: {
  collection: SavedTripCollectionSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [stripStyles.card, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <Image
        source={collection.coverImageUrl ? { uri: collection.coverImageUrl } : DEFAULT_COLLECTION_COVER}
        style={stripStyles.cardImage}
        contentFit="cover"
      />
      <View style={stripStyles.cardInfo}>
        <Text style={stripStyles.cardName} numberOfLines={1}>
          {collection.name}
        </Text>
        <Text style={stripStyles.cardCount}>
          {collection.savedTripCount === 0
            ? 'Empty'
            : `${collection.savedTripCount} ${collection.savedTripCount === 1 ? 'trip' : 'trips'}`}
        </Text>
      </View>
    </Pressable>
  );
}

function NewCollectionStripCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [stripStyles.newCard, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      <Ionicons name="add-circle-outline" size={30} color={theme.colors.primary} />
      <Text style={stripStyles.newLabel}>{'New\nCollection'}</Text>
    </Pressable>
  );
}

const stripStyles = StyleSheet.create({
  card: {
    width: STRIP_W,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  cardImage: {
    width: STRIP_W,
    height: STRIP_IMG_H,
  },
  cardInfo: {
    height: STRIP_INFO_H,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: font.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: theme.colors.primaryDark,
  },
  cardCount: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  newCard: {
    width: STRIP_W,
    height: STRIP_H,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  newLabel: {
    fontFamily: font.semiBold,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.primary,
    textAlign: 'center',
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SavedTripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { token, user, isLoading: isAuthLoading } = useAuth();

  const cardWidth = Math.floor((screenWidth - H_PAD * 2 - CARD_GAP) / 2);

  const [data, setData] = useState<SavedPublicTripsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (isAuthLoading) return;
    if (!token) {
      setData(null);
      setError('Authentication required. Please sign in.');
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const result = await getSavedPublicTrips(token);
      setData(result);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Unable to load saved trips.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoading, token]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  // ── Derived ──────────────────────────────────────────────────────────────────

  const collections = data?.collections ?? [];
  const totalSaved = data?.filter.totalSavedCount ?? 0;

  const items = useMemo(() => {
    return (data?.items ?? []).slice().sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  }, [data?.items]);

  const rows = useMemo(() => {
    const result: typeof items[] = [];
    for (let i = 0; i < items.length; i += 2) {
      result.push(items.slice(i, i + 2));
    }
    return result;
  }, [items]);

  // Optimistic removal when a trip is unsaved from this page
  const handleUnsave = (savedTripId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item) => item.savedTripId !== savedTripId),
        filter: {
          ...prev.filter,
          totalSavedCount: Math.max(0, prev.filter.totalSavedCount - 1),
        },
      };
    });
  };

  // ── Header ─────────────────────────────────────────────────────────────────

  const headerNode = (
    <View style={[styles.pageHeader, { paddingTop: insets.top }]}>
      <View style={styles.pageHeaderInner}>
        <View style={styles.hdrSide}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.primaryDark} />
          </Pressable>
        </View>
        <Text style={styles.pageTitle}>Saved Trips</Text>
        <View style={[styles.hdrSide, styles.hdrSideRight]} />
      </View>
    </View>
  );

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <View style={styles.root}>
        {headerNode}
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading saved trips…</Text>
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {headerNode}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Summary */}
        <Text style={styles.summaryText}>
          {collections.length}{' '}
          {collections.length === 1 ? 'collection' : 'collections'} · {totalSaved} saved
        </Text>

        {/* Collections strip */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collections</Text>
            {collections.length > 0 && (
              <Pressable onPress={() => router.push('/all-collections' as any)} hitSlop={8}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
          >
            {collections.map((col) => (
              <CollectionStripCard
                key={col.id}
                collection={col}
                onPress={() => router.push(`/saved-collection/${col.id}` as any)}
              />
            ))}
            <NewCollectionStripCard onPress={() => router.push('/create-collection' as any)} />
          </ScrollView>
        </View>

        {/* My Saved Trips heading */}
        {items.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Saved Trips</Text>
          </View>
        )}

        {/* Trip grid */}
        {error ? (
          <View style={styles.feedState}>
            <View style={styles.stateIconWrap}>
              <Ionicons name="alert-circle-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.feedStateTitle}>Could not load saved trips</Text>
            <Text style={styles.feedStateBody}>{error}</Text>
            <Pressable style={styles.feedStateButton} onPress={() => void loadData()}>
              <Text style={styles.feedStateButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : items.length > 0 ? (
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
                    onPress={() => {
                      const isOwnTrip =
                        item.creator.id !== null && item.creator.id === user?.id;
                      router.push(
                        isOwnTrip
                          ? (`/trip/${item.trip.id}` as any)
                          : (`/public-trip/${item.trip.id}` as any),
                      );
                    }}
                    savedTripId={item.savedTripId}
                    currentCollectionIds={item.collections.map((c) => c.id)}
                    onUnsave={() => handleUnsave(item.savedTripId)}
                  />
                ))}
                {row.length === 1 && <View style={{ width: cardWidth }} />}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.feedState}>
            <View style={styles.stateIconWrap}>
              <Ionicons name="bookmark-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.feedStateTitle}>No saved trips yet</Text>
            <Text style={styles.feedStateBody}>
              Save interesting routes from Explore to revisit them here.
            </Text>
            <Pressable
              style={styles.feedStateButton}
              onPress={() => router.navigate('/(tabs)/explore')}
            >
              <Text style={styles.feedStateButtonText}>Open Explore</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    width: 44,
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

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  stateText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  scrollContent: {
    paddingTop: 16,
    paddingBottom: 48,
    gap: 14,
  },

  summaryText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    paddingHorizontal: H_PAD,
  },

  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
  },
  seeAll: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  stripContent: {
    paddingHorizontal: H_PAD,
    gap: 10,
  },

  feedState: {
    alignItems: 'center',
    paddingVertical: 52,
    paddingHorizontal: 32,
    gap: 10,
  },
  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  feedStateTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  feedStateBody: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  feedStateButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 4,
  },
  feedStateButtonText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  grid: {
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
