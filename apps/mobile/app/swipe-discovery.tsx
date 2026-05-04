import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getForYouPublicTrips,
  savePublicTrip,
  type ForYouTripItem,
  type ForYouTripsResponse,
} from '@/services/publicTrips';

const INITIAL_FETCH_LIMIT = 20;
const REFILL_THRESHOLD = 3;

function formatCreator(name: string | null) {
  return name?.trim() || 'Tripcholic traveler';
}

function getUniqueNewItems(
  nextItems: ForYouTripItem[],
  currentItems: ForYouTripItem[],
  dismissedIds: string[]
) {
  const existingIds = new Set(currentItems.map((item) => item.id));
  const dismissedIdSet = new Set(dismissedIds);
  return nextItems.filter(
    (item) => !existingIds.has(item.id) && !dismissedIdSet.has(item.id)
  );
}

function getCategoryEmoji(category: string | null): string {
  const map: Record<string, string> = {
    museums: '🏛',
    food: '🍽',
    culture: '🎭',
    shopping: '🛍',
    nature: '🌿',
    coffee: '☕',
    history: '🏺',
    nightlife: '🌙',
  };
  return map[category?.toLowerCase() ?? ''] ?? '🗺';
}

// ── SwipeCard ──────────────────────────────────────────────────────────────────

interface SwipeCardProps {
  trip: ForYouTripItem;
  cardHeight: number;
  saveOpacity?: Animated.AnimatedInterpolation<string | number>;
  passOpacity?: Animated.AnimatedInterpolation<string | number>;
}

function SwipeCard({
  trip,
  cardHeight,
  saveOpacity,
  passOpacity,
}: SwipeCardProps) {
  const imageUrl = trip.preview.imageUrl?.trim() || null;
  const category = trip.preview.primaryCategory ?? null;
  const categoryLabel = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : null;
  const isPersonalized = trip.recommendation.kind === 'personalized';
  const reason = trip.recommendation.primaryReason ?? null;
  const destination = trip.preview.primaryCategory ?? 'Istanbul';
  const stopCount = (trip.preview as any).stopCount as number | undefined;

  // Build feature pills
  const pills: { key: string; label: string }[] = [];
  if (categoryLabel) {
    pills.push({ key: 'category', label: `${getCategoryEmoji(category)} ${categoryLabel}` });
  }
  if (reason) {
    const truncated = reason.length > 25 ? reason.slice(0, 25) + '…' : reason;
    pills.push({ key: 'reason', label: truncated });
  }
  if (isPersonalized) {
    pills.push({ key: 'foryou', label: '✦ For You' });
  }
  if (stopCount != null && stopCount > 0) {
    pills.push({ key: 'stops', label: `${stopCount} stops` });
  }

  return (
    <View style={[cardStyles.card, { height: cardHeight }]}>
      {/* Background */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Artwork kind="trip" variant="cover" label={trip.title} />
      )}

      {/* Gradient overlay - strong dark at bottom */}
      <View style={cardStyles.gradientOverlay} />

      {/* Top row: category badge + type badge */}
      <View style={cardStyles.topRow}>
        <View style={cardStyles.categoryBadge}>
          <Text style={cardStyles.categoryBadgeText}>
            {categoryLabel ?? 'EXPLORE'}
          </Text>
        </View>
        <View
          style={[
            cardStyles.typeBadge,
            isPersonalized && cardStyles.typeBadgeForYou,
          ]}
        >
          {isPersonalized && (
            <Ionicons name="sparkles" size={9} color="#00504F" />
          )}
          <Text
            style={[
              cardStyles.typeBadgeText,
              isPersonalized && cardStyles.typeBadgeTextForYou,
            ]}
          >
            {isPersonalized ? 'For You' : 'Public'}
          </Text>
        </View>
      </View>

      {/* Swipe overlay: SAVE (right swipe) */}
      {saveOpacity != null && (
        <Animated.View style={[cardStyles.swipeOverlay, cardStyles.swipeOverlaySave, { opacity: saveOpacity }]}>
          <Text style={[cardStyles.swipeOverlayText, cardStyles.swipeOverlayTextSave]}>SAVE ♥</Text>
        </Animated.View>
      )}

      {/* Swipe overlay: PASS (left swipe) */}
      {passOpacity != null && (
        <Animated.View style={[cardStyles.swipeOverlay, cardStyles.swipeOverlayPass, { opacity: passOpacity }]}>
          <Text style={[cardStyles.swipeOverlayText, cardStyles.swipeOverlayTextPass]}>PASS ✕</Text>
        </Animated.View>
      )}

      {/* Bottom content */}
      <View style={cardStyles.bottomContent}>
        {/* Location row */}
        <View style={cardStyles.locationRow}>
          <Ionicons name="location" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={cardStyles.locationText} numberOfLines={1}>
            {destination}
          </Text>
        </View>

        {/* Title */}
        <Text style={cardStyles.title} numberOfLines={2}>
          {trip.title}
        </Text>

        {/* Creator */}
        <View style={cardStyles.creatorRow}>
          <Ionicons
            name="person-outline"
            size={12}
            color="rgba(255,255,255,0.65)"
          />
          <Text style={cardStyles.creatorText} numberOfLines={1}>
            {formatCreator(trip.creator.displayName)}
          </Text>
        </View>

        {/* Feature pills */}
        {pills.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={cardStyles.pillsRow}
            style={cardStyles.pillsScroll}
          >
            {pills.map((pill) => (
              <View key={pill.key} style={cardStyles.featurePill}>
                <Text style={cardStyles.featurePillText}>{pill.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0B2D3A',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    backgroundColor: 'rgba(2,24,34,0.88)',
  },
  topRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7DF5F4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00504F',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  typeBadgeForYou: {
    backgroundColor: '#DFF7F6',
    borderColor: '#7DF5F4',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  typeBadgeTextForYou: {
    color: '#00504F',
  },
  // Swipe overlays
  swipeOverlay: {
    position: 'absolute',
    top: 28,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 3,
    zIndex: 10,
  },
  swipeOverlaySave: {
    left: 18,
    borderColor: '#0EA5A4',
    backgroundColor: 'rgba(14,165,164,0.1)',
    transform: [{ rotate: '-12deg' }],
  },
  swipeOverlayPass: {
    right: 18,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.1)',
    transform: [{ rotate: '12deg' }],
  },
  swipeOverlayText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  swipeOverlayTextSave: {
    color: '#0EA5A4',
  },
  swipeOverlayTextPass: {
    color: '#EF4444',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  creatorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    flex: 1,
  },
  pillsScroll: {
    marginTop: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  featurePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  featurePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function SwipeDiscoveryScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const { width, height } = useWindowDimensions();

  const CARD_HEIGHT = height - 220; // nearly full screen minus header + safe area
  const swipeThreshold = Math.max(width * 0.24, 90);

  const cardTranslate = useRef(new Animated.ValueXY()).current;
  const isAnimatingRef = useRef(false);
  const dismissedIdsRef = useRef<string[]>([]);

  const [deckItems, setDeckItems] = useState<ForYouTripItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [forYouData, setForYouData] = useState<ForYouTripsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefilling, setIsRefilling] = useState(false);
  const [isSavePending, setIsSavePending] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const currentTrip = deckItems[0] ?? null;
  const nextTrip = deckItems[1] ?? null;

  useEffect(() => {
    dismissedIdsRef.current = dismissedIds;
  }, [dismissedIds]);

  const resetCardPosition = useCallback(() => {
    cardTranslate.setValue({ x: 0, y: 0 });
    isAnimatingRef.current = false;
  }, [cardTranslate]);

  const loadDeck = useCallback(
    async (mode: 'replace' | 'append' = 'replace') => {
      if (isAuthLoading) return;

      if (!token) {
        setDeckItems([]);
        setScreenError('Authentication required. Please sign in again.');
        setIsLoading(false);
        setIsRefilling(false);
        setHasReachedEnd(true);
        return;
      }

      try {
        if (mode === 'replace') {
          setIsLoading(true);
        } else {
          setIsRefilling(true);
        }
        setScreenError(null);
        setActionError(null);

        const data = await getForYouPublicTrips(token, INITIAL_FETCH_LIMIT);
        setForYouData(data);

        if (mode === 'replace') {
          const freshItems = getUniqueNewItems(data.items, [], dismissedIdsRef.current);
          setDeckItems(freshItems);
          setHasReachedEnd(freshItems.length === 0);
          resetCardPosition();
          return;
        }

        setDeckItems((currentItems) => {
          const filteredItems = getUniqueNewItems(
            data.items,
            currentItems,
            dismissedIdsRef.current
          );

          if (filteredItems.length === 0 && currentItems.length === 0) {
            setHasReachedEnd(true);
            return currentItems;
          }

          if (filteredItems.length === 0) {
            setHasReachedEnd(currentItems.length <= REFILL_THRESHOLD);
            return currentItems;
          }

          setHasReachedEnd(false);
          return [...currentItems, ...filteredItems];
        });
      } catch (loadError) {
        setScreenError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load swipe discovery.'
        );
        if (mode === 'replace') setDeckItems([]);
      } finally {
        setIsLoading(false);
        setIsRefilling(false);
      }
    },
    [isAuthLoading, resetCardPosition, token]
  );

  useEffect(() => {
    void loadDeck('replace');
  }, [loadDeck]);

  useEffect(() => {
    if (
      deckItems.length <= REFILL_THRESHOLD &&
      !isLoading &&
      !isRefilling &&
      !hasReachedEnd
    ) {
      void loadDeck('append');
    }
  }, [deckItems.length, hasReachedEnd, isLoading, isRefilling, loadDeck]);

  const dismissCurrentTrip = useCallback(
    (tripId: string, action: 'pass' | 'save') => {
      setDismissedIds((current) => {
        const nextValue = current.includes(tripId) ? current : [...current, tripId];
        dismissedIdsRef.current = nextValue;
        return nextValue;
      });

      if (action === 'save') {
        setSavedIds((current) =>
          current.includes(tripId) ? current : [...current, tripId]
        );
      }

      setDeckItems((current) => current.filter((trip) => trip.id !== tripId));
      setHasReachedEnd(false);
      resetCardPosition();
    },
    [resetCardPosition]
  );

  const commitPass = useCallback(
    (tripId: string) => {
      setActionError(null);
      dismissCurrentTrip(tripId, 'pass');
    },
    [dismissCurrentTrip]
  );

  const commitSave = useCallback(
    async (tripId: string) => {
      if (!token) {
        setActionError('Authentication required. Please sign in again.');
        resetCardPosition();
        return;
      }

      try {
        setIsSavePending(true);
        setActionError(null);
        await savePublicTrip(tripId, token);
        dismissCurrentTrip(tripId, 'save');
      } catch (saveError) {
        setActionError(
          saveError instanceof Error
            ? saveError.message
            : 'Unable to save this public trip.'
        );
        resetCardPosition();
      } finally {
        setIsSavePending(false);
        isAnimatingRef.current = false;
      }
    },
    [dismissCurrentTrip, resetCardPosition, token]
  );

  const handlePass = useCallback(() => {
    if (!currentTrip || isSavePending || isAnimatingRef.current) return;
    commitPass(currentTrip.id);
  }, [commitPass, currentTrip, isSavePending]);

  const handleSave = useCallback(async () => {
    if (!currentTrip || isSavePending || isAnimatingRef.current) return;
    await commitSave(currentTrip.id);
  }, [commitSave, currentTrip, isSavePending]);

  const animateSwipeOut = useCallback(
    (direction: 'left' | 'right', trip: ForYouTripItem) => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;
      const targetX = direction === 'right' ? width + 120 : -width - 120;

      Animated.timing(cardTranslate, {
        toValue: { x: targetX, y: 24 },
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        if (direction === 'right') {
          void commitSave(trip.id);
        } else {
          commitPass(trip.id);
        }
      });
    },
    [cardTranslate, commitPass, commitSave, width]
  );

  const handleOpenDetails = useCallback(() => {
    if (!currentTrip) return;
    router.push(`/public-trip/${currentTrip.id}` as any);
  }, [currentTrip, router]);

  const handleReloadSession = async () => {
    dismissedIdsRef.current = [];
    setDismissedIds([]);
    setSavedIds([]);
    setHasReachedEnd(false);
    setScreenError(null);
    setActionError(null);
    await loadDeck('replace');
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isSavePending &&
          !!currentTrip &&
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          if (isAnimatingRef.current) return;
          cardTranslate.setValue({
            x: gestureState.dx,
            y: gestureState.dy * 0.12,
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!currentTrip) {
            resetCardPosition();
            return;
          }

          if (gestureState.dx >= swipeThreshold) {
            animateSwipeOut('right', currentTrip);
            return;
          }

          if (gestureState.dx <= -swipeThreshold) {
            animateSwipeOut('left', currentTrip);
            return;
          }

          Animated.spring(cardTranslate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 6,
            tension: 90,
          }).start();
        },
      }),
    [
      animateSwipeOut,
      cardTranslate,
      currentTrip,
      isSavePending,
      resetCardPosition,
      swipeThreshold,
    ]
  );

  const rotate = cardTranslate.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const currentCardStyle = {
    transform: [
      { translateX: cardTranslate.x },
      { translateY: cardTranslate.y },
      { rotate },
    ],
  };

  // Swipe overlay opacities
  const saveOpacity = cardTranslate.x.interpolate({
    inputRange: [20, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = cardTranslate.x.interpolate({
    inputRange: [-100, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const isPersonalized =
    forYouData?.meta.personalizationState !== 'cold_start' &&
    forYouData !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Minimal header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#0B3B4A" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Swipe Discovery</Text>
          {currentTrip && (
            <View style={styles.headerMeta}>
              <View
                style={[
                  styles.personalizationPill,
                  isPersonalized && styles.personalizationPillActive,
                ]}
              >
                <Ionicons
                  name={isPersonalized ? 'sparkles' : 'globe-outline'}
                  size={10}
                  color={isPersonalized ? '#006A69' : '#64748B'}
                />
                <Text
                  style={[
                    styles.personalizationPillText,
                    isPersonalized && styles.personalizationPillTextActive,
                  ]}
                >
                  {isPersonalized ? 'Personalized' : 'Public feed'}
                </Text>
              </View>
              {savedIds.length > 0 && (
                <View style={styles.savedPill}>
                  <Ionicons name="bookmark" size={10} color="#006A69" />
                  <Text style={styles.savedPillText}>
                    {savedIds.length} saved
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Count badge */}
        {currentTrip ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{deckItems.length} left</Text>
          </View>
        ) : (
          <View style={styles.countBadgePlaceholder} />
        )}
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.centerState}>
          <View style={styles.stateIconWrap}>
            <ActivityIndicator size="large" color="#006A69" />
          </View>
          <Text style={styles.stateTitle}>Finding your picks…</Text>
          <Text style={styles.stateText}>
            Curating public trips tailored to your taste.
          </Text>
        </View>
      ) : screenError ? (
        <View style={styles.centerState}>
          <View style={[styles.stateIconWrap, styles.stateIconError]}>
            <Ionicons name="alert-circle-outline" size={28} color="#B91C1C" />
          </View>
          <Text style={styles.stateTitle}>Swipe unavailable</Text>
          <Text style={styles.stateText}>{screenError}</Text>
          <Pressable
            style={styles.primaryCta}
            onPress={() => void handleReloadSession()}
          >
            <Text style={styles.primaryCtaText}>Try again</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(tabs)/explore' as any)}
            style={styles.ghostCta}
          >
            <Text style={styles.ghostCtaText}>Back to Explore</Text>
          </Pressable>
        </View>
      ) : !currentTrip ? (
        <View style={styles.centerState}>
          <View style={[styles.stateIconWrap, styles.stateIconSuccess]}>
            <Ionicons name="checkmark-circle-outline" size={28} color="#006A69" />
          </View>
          <Text style={styles.stateTitle}>All caught up</Text>
          <Text style={styles.stateText}>
            {hasReachedEnd
              ? 'No new picks beyond what you already saved or passed.'
              : 'No trips in the current deck right now.'}
          </Text>
          {savedIds.length > 0 && (
            <View style={styles.savedSummaryPill}>
              <Ionicons name="bookmark" size={14} color="#006A69" />
              <Text style={styles.savedSummaryText}>
                {savedIds.length} trip{savedIds.length === 1 ? '' : 's'} saved this session
              </Text>
            </View>
          )}
          <Pressable
            style={styles.primaryCta}
            onPress={() => void handleReloadSession()}
          >
            <Text style={styles.primaryCtaText}>Reload deck</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(tabs)/explore' as any)}
            style={styles.ghostCta}
          >
            <Text style={styles.ghostCtaText}>Back to Explore</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.deckContainer}>
          {/* Action error */}
          {actionError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={13} color="#9A3412" />
              <Text style={styles.errorBannerText}>{actionError}</Text>
            </View>
          ) : null}

          {/* Card stack */}
          <View style={[styles.deckArea, { height: CARD_HEIGHT }]}>
            {/* Peek card behind */}
            {nextTrip ? (
              <View
                style={[styles.peekCard, { height: CARD_HEIGHT }]}
                pointerEvents="none"
              >
                <SwipeCard trip={nextTrip} cardHeight={CARD_HEIGHT} />
              </View>
            ) : null}

            {/* Active card */}
            <Animated.View
              style={[styles.activeCard, currentCardStyle]}
              {...panResponder.panHandlers}
            >
              <Pressable onPress={handleOpenDetails} style={{ flex: 1 }}>
                <SwipeCard
                  trip={currentTrip}
                  cardHeight={CARD_HEIGHT}
                  saveOpacity={saveOpacity}
                  passOpacity={passOpacity}
                />
              </Pressable>
            </Animated.View>
          </View>

          {/* Action buttons row outside card */}
          <View style={styles.actionButtonsRow}>
            {/* Pass */}
            <Pressable
              onPress={handlePass}
              disabled={isSavePending}
              style={styles.passBtn}
            >
              <Ionicons name="close" size={28} color="#EF4444" />
            </Pressable>

            {/* Details */}
            <Pressable onPress={handleOpenDetails} style={styles.detailsBtn}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#64748B"
              />
              <Text style={styles.detailsBtnText}>Details</Text>
            </Pressable>

            {/* Save */}
            <Pressable
              onPress={() => void handleSave()}
              disabled={isSavePending}
              style={styles.saveBtn}
            >
              {isSavePending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="heart" size={28} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          {/* Refill indicator */}
          {isRefilling ? (
            <Text style={styles.refillText}>Loading more…</Text>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.2,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personalizationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  personalizationPillActive: {
    backgroundColor: '#DFF7F6',
  },
  personalizationPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  personalizationPillTextActive: {
    color: '#006A69',
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DFF7F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006A69',
  },
  countBadge: {
    backgroundColor: '#111C2C',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  countBadgePlaceholder: {
    width: 38,
    flexShrink: 0,
  },

  // States
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    paddingBottom: 40,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stateIconError: {
    backgroundColor: '#FEF2F2',
  },
  stateIconSuccess: {
    backgroundColor: '#DFF7F6',
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111C2C',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  savedSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DFF7F6',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  savedSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006A69',
  },
  primaryCta: {
    backgroundColor: '#006A69',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ghostCta: {
    paddingVertical: 8,
  },
  ghostCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B3B4A',
  },

  // Deck
  deckContainer: {
    flex: 1,
    paddingBottom: 8,
    gap: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#9A3412',
  },
  deckArea: {
    flex: 1,
    position: 'relative',
  },
  peekCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 10,
    opacity: 0.5,
    transform: [{ scale: 0.96 }],
  },
  activeCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 2,
  },

  // Action buttons below deck
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
    paddingVertical: 8,
  },
  passBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  detailsBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailsBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  saveBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#006A69',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#006A69',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  refillText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
