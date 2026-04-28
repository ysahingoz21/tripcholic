import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import TripPreviewCard from '@/components/trip/TripPreviewCard';
import AppButton from '@/components/ui/AppButton';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
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

function formatCreatorName(displayName: string | null) {
  return displayName?.trim() || 'Tripcholic traveler';
}

function buildHeaderSubtitle(data: ForYouTripsResponse | null) {
  if (!data) {
    return 'Save what looks promising, pass on the rest, and open full trip detail when you need more context.';
  }

  if (data.meta.personalizationState === 'cold_start') {
    return 'We are still learning your taste, so these picks start broader. Save or pass to move quickly.';
  }

  return 'Fast personalized discovery based on the trips you already save, like, and complete.';
}

function buildDeckSummary(remainingCount: number, data: ForYouTripsResponse | null) {
  if (!data) {
    return `${remainingCount} public trip${remainingCount === 1 ? '' : 's'} left in this session.`;
  }

  if (data.meta.personalizationState === 'cold_start') {
    return `${remainingCount} public trip${remainingCount === 1 ? '' : 's'} left while we build a stronger taste signal.`;
  }

  return `${remainingCount} personalized public trip${remainingCount === 1 ? '' : 's'} left in this session.`;
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

export default function SwipeDiscoveryScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const { width } = useWindowDimensions();
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
      if (isAuthLoading) {
        return;
      }

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
        if (mode === 'replace') {
          setDeckItems([]);
        }
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
    if (!currentTrip || isSavePending || isAnimatingRef.current) {
      return;
    }

    commitPass(currentTrip.id);
  }, [commitPass, currentTrip, isSavePending]);

  const handleSave = useCallback(async () => {
    if (!currentTrip || isSavePending || isAnimatingRef.current) {
      return;
    }

    await commitSave(currentTrip.id);
  }, [commitSave, currentTrip, isSavePending]);

  const animateSwipeOut = useCallback(
    (direction: 'left' | 'right', trip: ForYouTripItem) => {
      if (isAnimatingRef.current) {
        return;
      }

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
    if (!currentTrip) {
      return;
    }

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
          if (isAnimatingRef.current) {
            return;
          }

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

  return (
    <ScreenContainer>
      <SectionTitle
        title="Swipe Discovery"
        subtitle={buildHeaderSubtitle(forYouData)}
      />

      {actionError ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Action unavailable</Text>
          <Text style={styles.messageText}>{actionError}</Text>
        </View>
      ) : null}

      {screenError ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Swipe discovery unavailable</Text>
          <Text style={styles.stateText}>{screenError}</Text>
          <AppButton title="Reload For You" onPress={() => void handleReloadSession()} />
          <Pressable
            onPress={() => router.replace('/(tabs)/explore' as any)}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Back to Explore</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Loading swipe discovery</Text>
          <Text style={styles.stateText}>
            Pulling the current For You public trips into a fast deck.
          </Text>
        </View>
      ) : currentTrip ? (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Current deck</Text>
            <Text style={styles.summaryText}>
              {buildDeckSummary(deckItems.length, forYouData)}
            </Text>
            {savedIds.length > 0 ? (
              <Text style={styles.summaryFootnote}>
                {savedIds.length} trip{savedIds.length === 1 ? '' : 's'} saved in this session.
              </Text>
            ) : null}
          </View>

          <View style={styles.deckArea}>
            {nextTrip ? (
              <View style={styles.peekCardWrap} pointerEvents="none">
                <TripPreviewCard preview={nextTrip.preview} variant="hero" />
              </View>
            ) : null}

            <Animated.View
              style={[styles.activeCardWrap, currentCardStyle]}
              {...panResponder.panHandlers}
            >
              <Pressable onPress={handleOpenDetails}>
                <TripPreviewCard preview={currentTrip.preview} variant="hero" />
                <View style={styles.cardMeta}>
                  <View style={styles.metaRow}>
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.creatorText}>
                      {formatCreatorName(currentTrip.creator.displayName)}
                    </Text>
                  </View>
                  <View style={styles.metaRowTop}>
                    <View style={styles.reasonBadge}>
                      <Text style={styles.reasonBadgeText}>
                        {currentTrip.recommendation.kind === 'personalized'
                          ? 'For You'
                          : 'Public'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reasonText}>
                    {currentTrip.recommendation.primaryReason}
                  </Text>
                  <Text style={styles.detailHintText}>
                    Swipe left to pass, swipe right to save, or open full trip detail.
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>

          <View style={styles.actionsRow}>
            <SwipeActionButton
              icon="close"
              label="Pass"
              variant="secondary"
              disabled={isSavePending}
              onPress={handlePass}
            />
            <SwipeActionButton
              icon="eye-outline"
              label="View details"
              variant="neutral"
              disabled={isSavePending}
              onPress={handleOpenDetails}
            />
            <SwipeActionButton
              icon="bookmark"
              label={isSavePending ? 'Saving...' : 'Save'}
              variant="primary"
              disabled={isSavePending}
              onPress={() => {
                if (currentTrip) {
                  void handleSave();
                }
              }}
            />
          </View>

          {isRefilling ? (
            <Text style={styles.refillText}>Loading more For You picks...</Text>
          ) : null}
        </>
      ) : (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>You’re out of picks for now</Text>
          <Text style={styles.stateText}>
            {hasReachedEnd
              ? 'We did not find any new public trips beyond the ones you already saved or passed in this session.'
              : 'There are no eligible public trips in the current deck right now.'}
          </Text>
          <AppButton title="Reload For You" onPress={() => void handleReloadSession()} />
          <Pressable
            onPress={() => router.replace('/(tabs)/explore' as any)}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Back to Explore</Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

function SwipeActionButton({
  icon,
  label,
  variant,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  variant: 'primary' | 'secondary' | 'neutral';
  disabled?: boolean;
  onPress: () => void;
}) {
  const backgroundStyle =
    variant === 'primary'
      ? styles.actionButtonPrimary
      : variant === 'secondary'
        ? styles.actionButtonSecondary
        : styles.actionButtonNeutral;
  const textStyle =
    variant === 'primary'
      ? styles.actionButtonTextPrimary
      : variant === 'secondary'
        ? styles.actionButtonTextSecondary
        : styles.actionButtonTextNeutral;
  const iconColor =
    variant === 'primary'
      ? theme.colors.white
      : variant === 'secondary'
        ? '#991B1B'
        : theme.colors.primaryDark;

  return (
    <Pressable
      style={[
        styles.actionButton,
        backgroundStyle,
        disabled && styles.actionButtonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.actionButtonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  messageCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9A3412',
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  summaryFootnote: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.primaryDark,
    fontWeight: '600',
  },
  deckArea: {
    flex: 1,
    minHeight: 430,
    marginBottom: theme.spacing.lg,
    justifyContent: 'center',
  },
  peekCardWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 20,
    opacity: 0.55,
    transform: [{ scale: 0.96 }],
  },
  activeCardWrap: {
    zIndex: 2,
  },
  cardMeta: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: -2,
  },
  metaRowTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  creatorText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  reasonBadge: {
    backgroundColor: '#E8F7EE',
    borderWidth: 1,
    borderColor: '#BBE7CA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reasonBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    marginBottom: 8,
  },
  detailHintText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionButtonNeutral: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButtonTextPrimary: {
    color: theme.colors.white,
  },
  actionButtonTextSecondary: {
    color: '#991B1B',
  },
  actionButtonTextNeutral: {
    color: theme.colors.primaryDark,
  },
  refillText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  stateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  secondaryAction: {
    marginTop: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
});
