import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import UserAvatar from '@/components/ui/UserAvatar';
import TripSnapshotCard from '@/components/trip/TripSnapshotCard';
import { DEFAULT_COLLECTION_COVER } from '@/components/saved/collectionCovers';
import { theme } from '@/constants/theme';
import { type, font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { getTrip, getTrips, getTrendingTrips, type TripListItem, type ExploreTripItem } from '@/services/trips';
import { getSavedTripCollectionSummaries, type SavedTripCollectionSummary, likePublicTrip, unlikePublicTrip, savePublicTrip, unsavePublicTrip, getPublicTrip } from '@/services/publicTrips';
import { getRecentlyViewedTrips, pruneStaleRecentlyViewedTrips, type RecentlyViewedTrip } from '@/services/recentlyViewedTrips';

const H_PAD = 20;

// ── Constants ──────────────────────────────────────────────────────────────────

const TUTORIAL_CARDS = [
  {
    id: 'plan',
    icon: 'map-outline' as const,
    title: 'Plan a route',
    description: 'Build a custom single-day itinerary around your time, budget, and interests.',
    route: '/(tabs)/planner' as const,
  },
  {
    id: 'explore',
    icon: 'compass-outline' as const,
    title: 'Discover trips',
    description: 'Browse trending public itineraries from the Tripcholic community.',
    route: '/(tabs)/explore' as const,
  },
  {
    id: 'swipe',
    icon: 'layers-outline' as const,
    title: 'Swipe to discover',
    description: 'Swipe through curated trips and find your next Istanbul adventure.',
    route: '/swipe-discovery' as const,
  },
  {
    id: 'saved',
    icon: 'bookmark-outline' as const,
    title: 'Save & collect',
    description: 'Save trips you love and organize them into personal collections.',
    route: '/saved-trips' as const,
  },
  {
    id: 'profile',
    icon: 'person-outline' as const,
    title: 'Build your profile',
    description: 'Set your travel style, vibes, and interests to personalize your feed.',
    route: '/edit-profile' as const,
  },
] as const;

const DISCOVER_CATEGORIES = [
  { key: 'food', icon: 'restaurant-outline' as const, label: 'Food' },
  { key: 'historical', icon: 'business-outline' as const, label: 'Historical' },
  { key: 'nature', icon: 'leaf-outline' as const, label: 'Nature' },
  { key: 'scenic', icon: 'camera-outline' as const, label: 'Scenic' },
  { key: 'entertainment', icon: 'musical-notes-outline' as const, label: 'Entertainment' },
  { key: 'shopping', icon: 'bag-handle-outline' as const, label: 'Shopping' },
  { key: 'neighborhood', icon: 'map-outline' as const, label: 'Neighborhood' },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatOptimizedDate(optimizedAt: string | null | undefined): string | undefined {
  if (!optimizedAt) return undefined;
  const d = new Date(optimizedAt);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Compact discovery card ─────────────────────────────────────────────────────

const CARD_W = 268;
const CARD_H = 348;

type HomeDiscoveryCardProps = {
  tripId: string;
  title: string;
  categories: string[];
  imageUrl: string | null;
  stopCount: number;
  creatorName: string | null;
  creatorAvatarUrl?: string | null;
  dateLabel?: string;
  token: string | null;
  onPress: () => void;
  onCreatorPress?: () => void;
  initialLiked?: boolean;
  initialSaved?: boolean;
  initialLikeCount?: number;
  initialSaveCount?: number;
  initialCommentCount?: number;
};

function HomeDiscoveryCard({
  tripId,
  title,
  imageUrl,
  stopCount,
  creatorName,
  creatorAvatarUrl,
  dateLabel,
  token,
  onPress,
  onCreatorPress,
  initialLiked = false,
  initialSaved = false,
  initialLikeCount = 0,
  initialSaveCount = 0,
  initialCommentCount = 0,
}: HomeDiscoveryCardProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [saveCount, setSaveCount] = useState(initialSaveCount);

  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setSaved(initialSaved); }, [initialSaved]);
  useEffect(() => { setLikeCount(initialLikeCount); }, [initialLikeCount]);
  useEffect(() => { setSaveCount(initialSaveCount); }, [initialSaveCount]);

  const handleLike = async () => {
    if (!token) { onPress(); return; }
    const prev = liked;
    setLiked(!prev);
    setLikeCount((c) => (prev ? c - 1 : c + 1));
    try {
      if (prev) await unlikePublicTrip(tripId, token);
      else await likePublicTrip(tripId, token);
    } catch {
      setLiked(prev);
      setLikeCount((c) => (prev ? c + 1 : c - 1));
    }
  };

  const handleSave = async () => {
    if (!token) { onPress(); return; }
    const prev = saved;
    setSaved(!prev);
    setSaveCount((c) => (prev ? c - 1 : c + 1));
    try {
      if (prev) await unsavePublicTrip(tripId, token);
      else await savePublicTrip(tripId, token);
    } catch {
      setSaved(prev);
      setSaveCount((c) => (prev ? c + 1 : c - 1));
    }
  };

  const displayCreator = creatorName?.trim() || 'Tripcholic traveler';

  return (
    <Pressable
      style={({ pressed }) => [dcStyles.card, pressed && { opacity: 0.93 }]}
      onPress={onPress}
    >
      {/* Background image */}
      <View style={StyleSheet.absoluteFill}>
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
      </View>

      {/* Bottom scrim */}
      <View style={dcStyles.scrim} />

      {/* Creator block */}
      <Pressable
        style={dcStyles.creatorBlock}
        onPress={onCreatorPress}
        disabled={!onCreatorPress}
        hitSlop={4}
      >
        <UserAvatar
          avatarUrl={creatorAvatarUrl}
          displayName={creatorName}
          size={22}
          ringSize={0}
        />
        <Text style={dcStyles.creatorName} numberOfLines={1}>{displayCreator}</Text>
      </Pressable>

      {/* Bottom content */}
      <View style={dcStyles.bottom}>
        <Text style={dcStyles.title} numberOfLines={2}>{title}</Text>
        {(dateLabel || stopCount > 0) && (
          <View style={dcStyles.metaRow}>
            {dateLabel && (
              <>
                <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.72)" />
                <Text style={dcStyles.metaText}>{dateLabel}</Text>
              </>
            )}
            {dateLabel && stopCount > 0 && <Text style={dcStyles.metaDot}> · </Text>}
            {stopCount > 0 && (
              <>
                <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.72)" />
                <Text style={dcStyles.metaText}>{stopCount} {stopCount === 1 ? 'stop' : 'stops'}</Text>
              </>
            )}
          </View>
        )}
        <View style={dcStyles.footer}>
          <View style={dcStyles.engRow}>
            <Pressable style={dcStyles.engItem} onPress={handleLike} hitSlop={8}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={15} color="#fff" />
              <Text style={dcStyles.engCount}>{likeCount}</Text>
            </Pressable>
            <Pressable style={dcStyles.engItem} onPress={onPress} hitSlop={8}>
              <Ionicons name="chatbubble-outline" size={14} color="#fff" />
              <Text style={dcStyles.engCount}>{initialCommentCount}</Text>
            </Pressable>
            <Pressable style={dcStyles.engItem} onPress={handleSave} hitSlop={8}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={14} color="#fff" />
              <Text style={dcStyles.engCount}>{saveCount}</Text>
            </Pressable>
          </View>
          <Pressable style={dcStyles.arrowBtn} onPress={onPress}>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const dcStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(11,36,48,0.68)',
  },
  creatorBlock: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: CARD_W - 24,
  },
  creatorName: {
    fontFamily: font.semiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    flexShrink: 1,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 5,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 22,
    color: '#fff',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
  },
  metaDot: {
    fontFamily: font.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  engRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  engItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  engCount: {
    fontFamily: font.medium,
    fontSize: 12,
    color: '#fff',
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Collection strip card ──────────────────────────────────────────────────────

const STRIP_W = 152;
const STRIP_IMG_H = 92;
const STRIP_INFO_H = 48;

function HomeCollectionCard({
  collection,
  onPress,
}: {
  collection: SavedTripCollectionSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [colStyles.card, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <Image
        source={collection.coverImageUrl ? { uri: collection.coverImageUrl } : DEFAULT_COLLECTION_COVER}
        style={colStyles.cardImage}
        contentFit="cover"
      />
      <View style={colStyles.cardInfo}>
        <Text style={colStyles.cardName} numberOfLines={1}>{collection.name}</Text>
        <Text style={colStyles.cardCount}>
          {collection.savedTripCount === 0
            ? 'Empty'
            : `${collection.savedTripCount} ${collection.savedTripCount === 1 ? 'trip' : 'trips'}`}
        </Text>
      </View>
    </Pressable>
  );
}

const colStyles = StyleSheet.create({
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
    paddingVertical: 8,
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: font.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.primaryDark,
  },
  cardCount: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  allCard: {
    width: STRIP_W,
    height: STRIP_IMG_H + STRIP_INFO_H,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  allCardText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
});

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  viewAll,
  onViewAll,
}: {
  title: string;
  subtitle?: string;
  viewAll?: boolean;
  onViewAll?: () => void;
}) {
  return (
    <View style={shStyles.wrap}>
      <View style={shStyles.left}>
        <Text style={shStyles.title}>{title}</Text>
        {subtitle ? <Text style={shStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {viewAll && onViewAll ? (
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={shStyles.viewAll}>View all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const shStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: 14,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  viewAll: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { token, user, isLoading: isAuthLoading } = useAuth();

  // My Recent Trips
  const [myTrips, setMyTrips] = useState<TripListItem[]>([]);
  const [myTripsLoading, setMyTripsLoading] = useState(true);

  // Trending
  const [trending, setTrending] = useState<ExploreTripItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Recently viewed
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedTrip[]>([]);

  // Collections
  const [collections, setCollections] = useState<SavedTripCollectionSummary[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (isAuthLoading) return;

    const userId = user?.id ?? null;

    // Recently viewed (AsyncStorage — render immediately, then validate in background)
    const stored = await getRecentlyViewedTrips(userId);
    setRecentlyViewed(stored);

    if (!token) {
      setMyTripsLoading(false);
      setTrendingLoading(false);
      setCollectionsLoading(false);
      return;
    }

    // Background: validate the displayed recently viewed trips against backend
    // to auto-remove stale IDs after a DB reset/reseed.
    void (async () => {
      if (stored.length === 0) return;
      const toCheck = stored.slice(0, 4);
      const results = await Promise.allSettled(
        toCheck.map((trip) =>
          trip.isOwnTrip
            ? getTrip(token, trip.id)
            : getPublicTrip(trip.id, token),
        ),
      );
      const staleIds: string[] = [];
      results.forEach((result, i) => {
        if (result.status === 'rejected') staleIds.push(toCheck[i].id);
      });
      if (staleIds.length > 0) {
        await pruneStaleRecentlyViewedTrips(staleIds, userId);
        setRecentlyViewed((prev) => {
          const staleSet = new Set(staleIds);
          return prev.filter((t) => !staleSet.has(t.id));
        });
      }
    })();

    // Parallel loads
    void (async () => {
      try {
        setMyTripsLoading(true);
        const data = await getTrips(token);
        setMyTrips(data.slice(0, 5));
      } catch { setMyTrips([]); }
      finally { setMyTripsLoading(false); }
    })();

    void (async () => {
      try {
        setTrendingLoading(true);
        const data = await getTrendingTrips(token, 8);
        setTrending(data.items);
      } catch { setTrending([]); }
      finally { setTrendingLoading(false); }
    })();

    void (async () => {
      try {
        setCollectionsLoading(true);
        const data = await getSavedTripCollectionSummaries(token, 4);
        setCollections(data);
      } catch { setCollections([]); }
      finally { setCollectionsLoading(false); }
    })();
  }, [token, isAuthLoading, user?.id]);

  useFocusEffect(useCallback(() => { void loadAll(); }, [loadAll]));

  const handleTripPress = (trip: ExploreTripItem) => {
    if (trip.creator.id && trip.creator.id === user?.id) {
      // own trip — but for explore items we open public trip page
      router.push(`/public-trip/${trip.id}` as any);
    } else {
      router.push(`/public-trip/${trip.id}` as any);
    }
  };

  const handleRecentTripPress = (trip: RecentlyViewedTrip) => {
    if (trip.isOwnTrip) {
      router.push(`/trip/${trip.id}` as any);
    } else {
      router.push(`/public-trip/${trip.id}` as any);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Hero ─── */}
          <View style={styles.hero}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.heroEyebrow}>Istanbul</Text>
            </View>
            <Text style={styles.heroTitle}>{'Discover\nIstanbul.'}</Text>
            <Text style={styles.heroSubtitle}>
              Curated single-day itineraries built around your time, budget, and travel style.
            </Text>
          </View>

          {/* ─── Get started ─── */}
          <Text style={[styles.sectionTitle, styles.sectionPadded]}>Get started</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            style={styles.carousel}
          >
            {TUTORIAL_CARDS.map((card) => (
              <Pressable
                key={card.id}
                style={({ pressed }) => [styles.tutorialCard, pressed && { opacity: 0.82 }]}
                onPress={() => router.push(card.route as any)}
              >
                <View style={styles.tutorialIconWrap}>
                  <Ionicons name={card.icon} size={20} color={theme.colors.primaryDark} />
                </View>
                <Text style={styles.tutorialTitle}>{card.title}</Text>
                <Text style={styles.tutorialBody}>{card.description}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ─── Continue Exploring Istanbul ─── */}
          {recentlyViewed.length > 0 && (
            <>
              <SectionHeader
                title="Continue Exploring Istanbul"
                subtitle="Recently viewed trips"
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                style={styles.carousel}
              >
                {recentlyViewed.slice(0, 4).map((trip) => (
                  <HomeDiscoveryCard
                    key={trip.id}
                    tripId={trip.id}
                    title={trip.title}
                    categories={trip.categories}
                    imageUrl={trip.preview?.imageUrl?.trim() || null}
                    stopCount={trip.preview?.stopCount ?? 0}
                    creatorName={trip.creatorName}
                    creatorAvatarUrl={trip.creatorAvatarUrl}
                    dateLabel={formatOptimizedDate(trip.optimizedAt)}
                    token={token}
                    onPress={() => handleRecentTripPress(trip)}
                    initialLiked={trip.engagement.likedByMe}
                    initialSaved={trip.engagement.savedByMe}
                    initialLikeCount={trip.engagement.likeCount}
                    initialSaveCount={trip.engagement.saveCount}
                    initialCommentCount={trip.engagement.commentCount}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {/* ─── Trending This Week ─── */}
          <SectionHeader
            title="Trending This Week"
            viewAll
            onViewAll={() => router.push('/(tabs)/explore' as any)}
          />
          {trendingLoading ? (
            <View style={styles.carouselLoader}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : trending.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
              style={styles.carousel}
            >
              {trending.map((trip) => (
                <HomeDiscoveryCard
                  key={trip.id}
                  tripId={trip.id}
                  title={trip.title}
                  categories={trip.categories}
                  imageUrl={trip.preview?.imageUrl?.trim() || null}
                  stopCount={trip.preview?.stopCount ?? 0}
                  creatorName={trip.creator?.displayName ?? null}
                  creatorAvatarUrl={trip.creator?.avatarUrl}
                  dateLabel={formatOptimizedDate(trip.optimizedAt)}
                  token={token}
                  onPress={() => handleTripPress(trip)}
                  onCreatorPress={
                    trip.creator.id
                      ? () => {
                          if (trip.creator.id === user?.id) {
                            router.push('/(tabs)/profile' as any);
                          } else {
                            router.push(`/profile/${trip.creator.id}` as any);
                          }
                        }
                      : undefined
                  }
                  initialLiked={trip.engagement?.likedByMe ?? false}
                  initialSaved={trip.engagement?.savedByMe ?? false}
                  initialLikeCount={trip.engagement?.likeCount ?? 0}
                  initialSaveCount={trip.engagement?.saveCount ?? 0}
                  initialCommentCount={trip.engagement?.commentCount ?? 0}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptySmall}>
              <Text style={styles.emptySmallText}>No trending trips yet — check back soon.</Text>
            </View>
          )}

          {/* ─── What are you looking for today? ─── */}
          <SectionHeader title="What are you looking for today?" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
            style={styles.carousel}
          >
            {DISCOVER_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={({ pressed }) => [styles.categoryChip, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/explore' as any,
                    params: { category: cat.key },
                  })
                }
              >
                <Ionicons name={cat.icon} size={15} color={theme.colors.primaryDark} />
                <Text style={styles.chipLabel}>{cat.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ─── My Recent Trips ─── */}
          <View style={[styles.sectionRow, styles.sectionPadded]}>
            <Text style={styles.sectionTitle}>My Recent Trips</Text>
            <Pressable onPress={() => router.push('/(tabs)/trips')} hitSlop={8}>
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          </View>

          {myTripsLoading ? (
            <View style={styles.tripsLoader}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : myTrips.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
              style={styles.carousel}
            >
              {myTrips.map((trip) => (
                <TripSnapshotCard
                  key={trip.id}
                  trip={trip}
                  onPress={() => router.push(`/trip/${trip.id}` as any)}
                />
              ))}
              <Pressable
                style={styles.viewAllCard}
                onPress={() => router.push('/(tabs)/trips')}
              >
                <Ionicons name="grid-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.viewAllCardText}>All trips</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={styles.emptyTrips}>
              <Ionicons name="map-outline" size={28} color={theme.colors.primary} />
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptyBody}>Trips you create will appear here.</Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/planner')}
              >
                <Text style={styles.emptyButtonText}>Plan your first trip</Text>
              </Pressable>
            </View>
          )}

          {/* ─── Your Collections ─── */}
          {token && (
            <>
              <SectionHeader
                title="Your Collections"
                viewAll
                onViewAll={() => router.push('/all-collections' as any)}
              />
              {collectionsLoading ? (
                <View style={styles.carouselLoader}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : collections.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                  style={styles.carousel}
                >
                  {collections.map((col) => (
                    <HomeCollectionCard
                      key={col.id}
                      collection={col}
                      onPress={() => router.push(`/saved-collection/${col.id}` as any)}
                    />
                  ))}
                  <Pressable
                    style={({ pressed }) => [colStyles.allCard, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push('/all-collections' as any)}
                  >
                    <Ionicons name="grid-outline" size={22} color={theme.colors.primary} />
                    <Text style={colStyles.allCardText}>All Collections</Text>
                  </Pressable>
                </ScrollView>
              ) : (
                <View style={styles.emptySmall}>
                  <Text style={styles.emptySmallText}>No collections yet.</Text>
                  <Pressable
                    onPress={() => router.push('/create-collection' as any)}
                    hitSlop={8}
                  >
                    <Text style={styles.emptySmallLink}>Create one →</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* ─── Floating + button ─── */}
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/(tabs)/planner')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Hero ──
  hero: {
    paddingHorizontal: H_PAD,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  heroEyebrow: {
    ...type.labelCaps,
    color: theme.colors.primary,
  },
  heroTitle: {
    ...type.displayLg,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginBottom: 14,
  },
  heroSubtitle: {
    ...type.bodyLg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },

  // ── Sections ──
  sectionPadded: {
    paddingHorizontal: H_PAD,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewAllText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.primary,
  },

  // ── Carousel shared ──
  carousel: {
    marginBottom: 28,
  },
  carouselContent: {
    paddingHorizontal: H_PAD,
    gap: 12,
  },
  carouselLoader: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },

  // ── Category chips ──
  chipsContent: {
    paddingHorizontal: H_PAD,
    gap: 8,
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14,165,164,0.09)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(14,165,164,0.22)',
  },
  chipLabel: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },

  // ── Tutorial cards ──
  tutorialCard: {
    width: 152,
    backgroundColor: '#EBEEF0',
    borderRadius: 16,
    padding: 16,
  },
  tutorialIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11,59,74,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tutorialTitle: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primaryDark,
    marginBottom: 5,
  },
  tutorialBody: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },

  // ── Trips loading ──
  tripsLoader: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },

  // ── "All trips" ghost tile ──
  viewAllCard: {
    width: 216,
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewAllCardText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // ── Empty states ──
  emptyTrips: {
    marginHorizontal: H_PAD,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  emptyTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
    marginTop: 4,
  },
  emptyBody: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  emptyButtonText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  emptySmall: {
    marginHorizontal: H_PAD,
    marginBottom: 28,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptySmallText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  emptySmallLink: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primary,
  },

  // ── Floating action button ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0B3B4A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
