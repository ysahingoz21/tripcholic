/**
 * InlineSwipePanel — embeds the full swipe deck experience inside the Explore tab.
 * All logic is identical to swipe-discovery.tsx; visual is updated to match Stitch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
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
  const existingIds = new Set(currentItems.map((i) => i.id));
  const dismissedSet = new Set(dismissedIds);
  return nextItems.filter(
    (item) => !existingIds.has(item.id) && !dismissedSet.has(item.id)
  );
}

type Props = {
  token: string | null;
  isAuthLoading: boolean;
};

export default function InlineSwipePanel({ token, isAuthLoading }: Props) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // Card height: screen height minus approximate header + tab bar + action area
  const CARD_HEIGHT = Math.min(height - 280, 520);
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
        setScreenError('Sign in to access personalized swipe discovery.');
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
          const freshItems = getUniqueNewItems(
            data.items,
            [],
            dismissedIdsRef.current
          );
          setDeckItems(freshItems);
          setHasReachedEnd(freshItems.length === 0);
          resetCardPosition();
          return;
        }

        setDeckItems((current) => {
          const filtered = getUniqueNewItems(
            data.items,
            current,
            dismissedIdsRef.current
          );
          if (filtered.length === 0 && current.length === 0) {
            setHasReachedEnd(true);
            return current;
          }
          if (filtered.length === 0) {
            setHasReachedEnd(current.length <= REFILL_THRESHOLD);
            return current;
          }
          setHasReachedEnd(false);
          return [...current, ...filtered];
        });
      } catch (err) {
        setScreenError(
          err instanceof Error ? err.message : 'Unable to load swipe discovery.'
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
        const next = current.includes(tripId) ? current : [...current, tripId];
        dismissedIdsRef.current = next;
        return next;
      });
      if (action === 'save') {
        setSavedIds((current) =>
          current.includes(tripId) ? current : [...current, tripId]
        );
      }
      setDeckItems((current) => current.filter((t) => t.id !== tripId));
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
        setActionError('Authentication required.');
        resetCardPosition();
        return;
      }
      try {
        setIsSavePending(true);
        setActionError(null);
        await savePublicTrip(tripId, token);
        dismissCurrentTrip(tripId, 'save');
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Unable to save this trip.'
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

  const handleReload = async () => {
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
        onMoveShouldSetPanResponder: (_, g) =>
          !isSavePending &&
          !!currentTrip &&
          Math.abs(g.dx) > 12 &&
          Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (isAnimatingRef.current) return;
          cardTranslate.setValue({ x: g.dx, y: g.dy * 0.1 });
        },
        onPanResponderRelease: (_, g) => {
          if (!currentTrip) {
            resetCardPosition();
            return;
          }
          if (g.dx >= swipeThreshold) {
            animateSwipeOut('right', currentTrip);
            return;
          }
          if (g.dx <= -swipeThreshold) {
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

  const currentCardAnimStyle = {
    transform: [
      { translateX: cardTranslate.x },
      { translateY: cardTranslate.y },
      { rotate },
    ],
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.stateText}>Loading your picks…</Text>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (screenError) {
    return (
      <View style={styles.centerState}>
        <Ionicons
          name="alert-circle-outline"
          size={44}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.stateTitle}>Swipe unavailable</Text>
        <Text style={styles.stateText}>{screenError}</Text>
        <Pressable style={styles.stateButton} onPress={() => void handleReload()}>
          <Text style={styles.stateButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // ── End of deck ────────────────────────────────────────────────────────────

  if (!currentTrip) {
    return (
      <View style={styles.centerState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="checkmark-circle-outline" size={32} color="#006A69" />
        </View>
        <Text style={styles.stateTitle}>All caught up</Text>
        <Text style={styles.stateText}>
          {hasReachedEnd
            ? 'No new picks beyond what you already saved or passed this session.'
            : 'No trips in the current deck right now.'}
        </Text>
        {savedIds.length > 0 && (
          <Text style={styles.savedNote}>
            {savedIds.length} trip{savedIds.length === 1 ? '' : 's'} saved this
            session.
          </Text>
        )}
        <Pressable style={styles.stateButton} onPress={() => void handleReload()}>
          <Text style={styles.stateButtonText}>Reload deck</Text>
        </Pressable>
      </View>
    );
  }

  // ── Active deck ────────────────────────────────────────────────────────────

  return (
    <View style={styles.deckContainer}>
      {/* Counter strip */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          {deckItems.length} trip{deckItems.length === 1 ? '' : 's'} left
        </Text>
        {savedIds.length > 0 && (
          <View style={styles.savedChip}>
            <Ionicons name="bookmark" size={10} color="#006A69" />
            <Text style={styles.savedChipText}>
              {savedIds.length} saved
            </Text>
          </View>
        )}
      </View>

      {/* Action error toast */}
      {actionError ? (
        <View style={styles.actionErrorBanner}>
          <Text style={styles.actionErrorText}>{actionError}</Text>
        </View>
      ) : null}

      {/* Card stack */}
      <View style={[styles.deckArea, { height: CARD_HEIGHT }]}>
        {/* Peek card (next trip) */}
        {nextTrip ? (
          <View
            style={[styles.peekCard, { height: CARD_HEIGHT }]}
            pointerEvents="none"
          >
            <SwipeCard trip={nextTrip} cardHeight={CARD_HEIGHT} />
          </View>
        ) : null}

        {/* Active (top) card */}
        <Animated.View
          style={[styles.activeCard, currentCardAnimStyle]}
          {...panResponder.panHandlers}
        >
          <Pressable onPress={handleOpenDetails}>
            <SwipeCard trip={currentTrip} cardHeight={CARD_HEIGHT} />
          </Pressable>
        </Animated.View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {/* Pass */}
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPass]}
          onPress={handlePass}
          disabled={isSavePending}
        >
          <Ionicons name="close" size={26} color="#B91C1C" />
        </Pressable>

        {/* View details */}
        <Pressable
          style={[styles.actionBtn, styles.actionBtnDetails]}
          onPress={handleOpenDetails}
          disabled={isSavePending}
        >
          <Ionicons name="information-circle-outline" size={20} color="#0B3B4A" />
        </Pressable>

        {/* Save */}
        <Pressable
          style={[styles.actionBtn, styles.actionBtnSave]}
          onPress={() => void handleSave()}
          disabled={isSavePending}
        >
          {isSavePending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="heart" size={26} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {/* Hint */}
      <Text style={styles.hint}>
        Swipe right to save · Swipe left to pass · Tap for details
      </Text>

      {isRefilling ? (
        <Text style={styles.refillText}>Loading more picks…</Text>
      ) : null}
    </View>
  );
}

// ── SwipeCard sub-component ────────────────────────────────────────────────

function SwipeCard({
  trip,
  cardHeight,
}: {
  trip: ForYouTripItem;
  cardHeight: number;
}) {
  const imageUrl = trip.preview.imageUrl?.trim() || null;
  const category = trip.preview.primaryCategory
    ? trip.preview.primaryCategory.charAt(0).toUpperCase() +
      trip.preview.primaryCategory.slice(1)
    : null;
  const isPersonalized = trip.recommendation.kind === 'personalized';

  return (
    <View style={[styles.swipeCard, { height: cardHeight }]}>
      {/* Image */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Artwork kind="trip" variant="cover" label={trip.title} />
      )}

      {/* Gradient simulation */}
      <View style={styles.swipeScrimBottom} />

      {/* Top badge */}
      <View style={styles.swipeTopRow}>
        {category && (
          <View style={styles.swipeCategoryChip}>
            <Text style={styles.swipeCategoryText}>{category}</Text>
          </View>
        )}
        <View
          style={[
            styles.swipeTypeBadge,
            isPersonalized && styles.swipeTypeBadgeForYou,
          ]}
        >
          {isPersonalized && (
            <Ionicons name="sparkles" size={9} color="#00504F" />
          )}
          <Text
            style={[
              styles.swipeTypeText,
              isPersonalized && styles.swipeTypeTextForYou,
            ]}
          >
            {isPersonalized ? 'For You' : 'Public'}
          </Text>
        </View>
      </View>

      {/* Bottom content */}
      <View style={styles.swipeBottomContent}>
        <Text style={styles.swipeTitle} numberOfLines={3}>
          {trip.title}
        </Text>

        <View style={styles.swipeCreatorRow}>
          <Ionicons
            name="person-outline"
            size={12}
            color="rgba(255,255,255,0.75)"
          />
          <Text style={styles.swipeCreatorText}>
            {formatCreator(trip.creator.displayName)}
          </Text>
        </View>

        {trip.recommendation.primaryReason ? (
          <View style={styles.swipeRecRow}>
            <Ionicons
              name="sparkles-outline"
              size={11}
              color="rgba(125,245,244,0.85)"
            />
            <Text style={styles.swipeRecText} numberOfLines={2}>
              {trip.recommendation.primaryReason}
            </Text>
          </View>
        ) : null}

        <Text style={styles.swipeHintOverlay}>Tap to open full trip →</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // States
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    paddingVertical: 40,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111C2C',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  stateButton: {
    backgroundColor: '#006A69',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  stateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  savedNote: {
    fontSize: 13,
    fontWeight: '600',
    color: '#006A69',
  },

  // Active deck
  deckContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  counterText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DFF7F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  savedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006A69',
  },
  actionErrorBanner: {
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  actionErrorText: {
    fontSize: 13,
    color: '#9A3412',
  },

  // Card stack
  deckArea: {
    position: 'relative',
    marginBottom: 16,
  },
  peekCard: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    opacity: 0.5,
    transform: [{ scale: 0.96 }],
  },
  activeCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },

  // Swipe card visual
  swipeCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#DFF7F6',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  swipeScrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '68%',
    backgroundColor: 'rgba(11,36,48,0.86)',
  },
  swipeTopRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swipeCategoryChip: {
    backgroundColor: 'rgba(223,247,246,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  swipeCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00504F',
    letterSpacing: 0.3,
  },
  swipeTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  swipeTypeBadgeForYou: {
    backgroundColor: '#DFF7F6',
  },
  swipeTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  swipeTypeTextForYou: {
    color: '#00504F',
  },
  swipeBottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 8,
  },
  swipeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  swipeCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swipeCreatorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  swipeRecRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  swipeRecText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(125,245,244,0.9)',
    fontWeight: '500',
  },
  swipeHintOverlay: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 10,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  actionBtnPass: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionBtnDetails: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F1F5F9',
  },
  actionBtnSave: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#006A69',
  },

  // Footer
  hint: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  refillText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
});
