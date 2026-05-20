import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Artwork from "@/components/ui/Artwork";
import { theme } from "@/constants/theme";
import { font } from "@/constants/typography";
import {
  getForYouPublicTrips,
  getPublicTrip,
  savePublicTrip,
  type ForYouTripItem,
  type ForYouTripsResponse,
  type PublicTripDetailResponse,
} from "@/services/publicTrips";

const INITIAL_FETCH_LIMIT = 20;
const REFILL_THRESHOLD = 3;
const HERO_HEIGHT = 434;
const EXPAND_CTA_HEIGHT = 52; // height of the "See stops" strip in collapsed mode

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name?.trim()) return "T";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

function formatCreator(name: string | null) {
  return name?.trim() || "Tripcholic traveler";
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getUniqueNewItems(
  nextItems: ForYouTripItem[],
  currentItems: ForYouTripItem[],
  dismissedIds: string[],
) {
  const existingIds = new Set(currentItems.map((i) => i.id));
  const dismissedSet = new Set(dismissedIds);
  return nextItems.filter(
    (item) => !existingIds.has(item.id) && !dismissedSet.has(item.id),
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  token: string | null;
  isAuthLoading: boolean;
};

export default function InlineSwipePanel({ token, isAuthLoading }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const swipeThreshold = Math.max(width * 0.24, 90);

  const cardTranslate = useRef(new Animated.ValueXY()).current;
  // Native Animated.Value for opacity so hide/show travels through the same
  // native animation channel as cardTranslate, guaranteeing ordering.
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const isAnimatingRef = useRef(false);
  const dismissedIdsRef = useRef<string[]>([]);

  const [deckItems, setDeckItems] = useState<ForYouTripItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefilling, setIsRefilling] = useState(false);
  const [isSavePending, setIsSavePending] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  // Lifted from SwipeCard so (a) the panel can render the collapse button above
  // the action buttons, and (b) deckArea height can be keyed on expand state.
  const [isExpanded, setIsExpanded] = useState(false);

  const currentTrip = deckItems[0] ?? null;

  useEffect(() => {
    dismissedIdsRef.current = dismissedIds;
  }, [dismissedIds]);

  const resetCardPosition = useCallback(() => {
    cardTranslate.setValue({ x: 0, y: 0 });
    isAnimatingRef.current = false;
  }, [cardTranslate]);

  const loadDeck = useCallback(
    async (mode: "replace" | "append" = "replace") => {
      if (isAuthLoading) return;
      if (!token) {
        setDeckItems([]);
        setScreenError("Sign in to access personalized swipe discovery.");
        setIsLoading(false);
        setIsRefilling(false);
        setHasReachedEnd(true);
        return;
      }
      try {
        if (mode === "replace") setIsLoading(true);
        else setIsRefilling(true);
        setScreenError(null);
        setActionError(null);
        const data = await getForYouPublicTrips(token, INITIAL_FETCH_LIMIT);
        if (mode === "replace") {
          const freshItems = getUniqueNewItems(
            data.items,
            [],
            dismissedIdsRef.current,
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
            dismissedIdsRef.current,
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
          err instanceof Error
            ? err.message
            : "Unable to load swipe discovery.",
        );
        if (mode === "replace") setDeckItems([]);
      } finally {
        setIsLoading(false);
        setIsRefilling(false);
      }
    },
    [isAuthLoading, resetCardPosition, token],
  );

  useEffect(() => {
    void loadDeck("replace");
  }, [loadDeck]);

  useEffect(() => {
    if (
      deckItems.length <= REFILL_THRESHOLD &&
      !isLoading &&
      !isRefilling &&
      !hasReachedEnd
    ) {
      void loadDeck("append");
    }
  }, [deckItems.length, hasReachedEnd, isLoading, isRefilling, loadDeck]);

  // Safety reset when the active trip changes (covers button-triggered pass/save
  // where cardTranslate was not pre-reset in the swipe callback).
  const currentTripId = currentTrip?.id ?? null;
  useLayoutEffect(() => {
    cardTranslate.setValue({ x: 0, y: 0 });
    isAnimatingRef.current = false;
    setIsExpanded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTripId]);

  // Reveal the card after the new SwipeCard content is committed to the React
  // tree. useEffect fires after commit so native has already received the new
  // content by the time opacity is restored.
  useEffect(() => {
    cardOpacity.setValue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTripId]);

  const dismissCurrentTrip = useCallback(
    (tripId: string, action: "pass" | "save") => {
      setDismissedIds((current) => {
        const next = current.includes(tripId) ? current : [...current, tripId];
        dismissedIdsRef.current = next;
        return next;
      });
      if (action === "save") {
        setSavedIds((current) =>
          current.includes(tripId) ? current : [...current, tripId],
        );
      }
      setDeckItems((current) => current.filter((t) => t.id !== tripId));
      setHasReachedEnd(false);
      // Position reset is handled by useLayoutEffect when currentTrip.id changes,
      // preventing the dismissed card from briefly re-appearing at center.
    },
    [],
  );

  const commitPass = useCallback(
    (tripId: string) => {
      setActionError(null);
      dismissCurrentTrip(tripId, "pass");
    },
    [dismissCurrentTrip],
  );

  const commitSave = useCallback(
    async (tripId: string) => {
      if (!token) {
        setActionError("Authentication required.");
        cardOpacity.setValue(1);
        resetCardPosition();
        return;
      }
      try {
        setIsSavePending(true);
        setActionError(null);
        await savePublicTrip(tripId, token);
        dismissCurrentTrip(tripId, "save");
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Unable to save this trip.",
        );
        cardOpacity.setValue(1);
        resetCardPosition();
      } finally {
        setIsSavePending(false);
        isAnimatingRef.current = false;
      }
    },
    [dismissCurrentTrip, resetCardPosition, token],
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
    (direction: "left" | "right", trip: ForYouTripItem) => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;
      const targetX = direction === "right" ? width + 120 : -width - 120;
      Animated.timing(cardTranslate, {
        toValue: { x: targetX, y: 0 },
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        // Hide first so native processes opacity=0 before anything else.
        cardOpacity.setValue(0);
        // Reset position while invisible. Crucially this runs before the state
        // updates that change currentTripId, so when the new Animated.View
        // mounts (new key) the native animated module registers it at {x:0,y:0}
        // instead of at targetX — eliminating the blank-center gap.
        cardTranslate.setValue({ x: 0, y: 0 });
        cardTranslate.stopAnimation();
        if (direction === "right") void commitSave(trip.id);
        else commitPass(trip.id);
      });
    },
    [cardTranslate, commitPass, commitSave, width],
  );

  const handleReload = async () => {
    dismissedIdsRef.current = [];
    setDismissedIds([]);
    setSavedIds([]);
    setHasReachedEnd(false);
    setScreenError(null);
    setActionError(null);
    await loadDeck("replace");
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
          cardTranslate.setValue({ x: g.dx, y: 0 });
        },
        onPanResponderRelease: (_, g) => {
          if (!currentTrip) {
            resetCardPosition();
            return;
          }
          if (g.dx >= swipeThreshold) {
            animateSwipeOut("right", currentTrip);
            return;
          }
          if (g.dx <= -swipeThreshold) {
            animateSwipeOut("left", currentTrip);
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
    ],
  );

  const rotate = cardTranslate.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-10deg", "0deg", "10deg"],
    extrapolate: "clamp",
  });

  const currentCardAnimStyle = {
    transform: [{ translateX: cardTranslate.x }, { rotate }],
    opacity: cardOpacity,
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
        <View style={styles.stateIconWrap}>
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.stateTitle}>Swipe unavailable</Text>
        <Text style={styles.stateText}>{screenError}</Text>
        <Pressable
          style={styles.stateButton}
          onPress={() => void handleReload()}
        >
          <Text style={styles.stateButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Refilling — don't flash the empty state while more cards are fetching ──

  if (!currentTrip && isRefilling) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.stateText}>Loading more trips…</Text>
      </View>
    );
  }

  // ── End of deck ────────────────────────────────────────────────────────────

  if (!currentTrip) {
    return (
      <View style={styles.centerState}>
        <View style={styles.stateIconWrap}>
          <Ionicons
            name="checkmark-circle-outline"
            size={28}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.stateTitle}>All caught up</Text>
        <Text style={styles.stateText}>
          {hasReachedEnd
            ? "No new picks beyond what you already saved or passed this session."
            : "No trips in the current deck right now."}
        </Text>
        {savedIds.length > 0 && (
          <Text style={styles.savedNote}>
            {savedIds.length} trip{savedIds.length === 1 ? "" : "s"} saved this
            session.
          </Text>
        )}
        <Pressable
          style={styles.stateButton}
          onPress={() => void handleReload()}
        >
          <Text style={styles.stateButtonText}>Reload deck</Text>
        </Pressable>
      </View>
    );
  }

  // ── Active deck ────────────────────────────────────────────────────────────

  // Collapsed: explicit height so the absolutely-positioned activeCard fills correctly.
  // Expanded: flex:1 so the card stretches to fill available space.
  const deckAreaStyle = isExpanded
    ? styles.deckAreaExpanded
    : [styles.deckAreaCollapsed, { height: HERO_HEIGHT + EXPAND_CTA_HEIGHT }];

  return (
    <View style={styles.deckContainer}>
      {/* Action error */}
      {actionError ? (
        <View style={styles.actionErrorBanner}>
          <Text style={styles.actionErrorText}>{actionError}</Text>
        </View>
      ) : null}

      {/* Card deck area */}
      <View style={deckAreaStyle}>
        {/* Active card — swipeable.
            key=currentTrip.id destroys the old native wrapper on trip change.
            cardOpacity hides the wrapper during the swipe→handoff window so
            the center never appears blank while the new wrapper initialises. */}
        <Animated.View
          key={currentTrip.id}
          style={[styles.activeCard, currentCardAnimStyle]}
          {...panResponder.panHandlers}
        >
          <SwipeCard
            key={currentTrip.id}
            trip={currentTrip}
            token={token}
            isExpanded={isExpanded}
            onExpand={() => setIsExpanded(true)}
            onCreatorPress={currentTrip.creator.id ? () => router.push(`/profile/${currentTrip.creator.id}` as any) : undefined}
          />
        </Animated.View>
      </View>

      {/* Collapse button — rendered at panel level above the action buttons
          so it never gets covered by them (z-index doesn't cross stacking contexts) */}
      {isExpanded && (
        <Pressable
          style={styles.collapseBtnPanel}
          onPress={() => setIsExpanded(false)}
        >
          <Ionicons name="chevron-up" size={16} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPass]}
          onPress={handlePass}
          disabled={isSavePending}
        >
          <Ionicons name="close" size={28} color="#B91C1C" />
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.actionBtnSave]}
          onPress={() => void handleSave()}
          disabled={isSavePending}
        >
          {isSavePending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="heart" size={28} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── SwipeCard: scrollable trip preview ────────────────────────────────────

type StopDetail = PublicTripDetailResponse["stops"][number];

type SwipeCardProps = {
  trip: ForYouTripItem;
  token: string | null;
  isExpanded: boolean;
  onExpand: () => void;
  onCreatorPress?: () => void;
};

function SwipeCard({ trip, token, isExpanded, onExpand, onCreatorPress }: SwipeCardProps) {
  const imageUrl = trip.preview.imageUrl?.trim() || null;

  const [stops, setStops] = useState<StopDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    setDetailLoading(true);
    getPublicTrip(trip.id, token)
      .then((detail) => {
        if (!mounted) return;
        setStops(detail.stops ?? []);
        setLikeCount(detail.engagement.likeCount);
        setSaveCount(detail.engagement.saveCount);
        setCommentCount(detail.engagement.commentCount);
      })
      .catch(() => {
        /* keep defaults */
      })
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [trip.id, token]);

  const dateLabel = formatDate(trip.optimizedAt);
  const categoryLine = Array.from(
    new Set([trip.preview.primaryCategory, ...trip.categories].filter(Boolean)),
  )
    .map((c) => cap(c!))
    .join(", ");

  // ScrollView is always outer.children[0] so Image never remounts on expand/collapse.
  // In collapsed mode scrollEnabled=false keeps the ScrollView as a neutral wrapper.
  // In expanded mode scrollEnabled=true + flex:1 makes the whole card one scroll surface.
  return (
    <View style={[cardStyles.outer, isExpanded && { flex: 1 }]}>
      <ScrollView
        scrollEnabled={isExpanded}
        style={isExpanded ? cardStyles.scroll : undefined}
        showsVerticalScrollIndicator={false}
        bounces={isExpanded}
        scrollEventThrottle={16}
      >
        {/* Hero — always ScrollView.children[0], stable tree position */}
        <View style={cardStyles.heroArea}>
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

          <View style={cardStyles.heroScrim} />

          <View style={cardStyles.heroTopRow}>
            <Pressable
              style={cardStyles.creatorBlock}
              onPress={onCreatorPress}
              disabled={!onCreatorPress}
              hitSlop={4}
            >
              <View style={cardStyles.creatorAvatar}>
                <Text style={cardStyles.creatorAvatarText}>
                  {getInitials(trip.creator.displayName)}
                </Text>
              </View>
              <Text style={cardStyles.creatorName} numberOfLines={1}>
                {formatCreator(trip.creator.displayName)}
              </Text>
            </Pressable>
            <View style={cardStyles.menuButton}>
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </View>

          <View style={cardStyles.heroBottom}>
            <Text style={cardStyles.heroTitle} numberOfLines={2}>
              {trip.title}
            </Text>

            {dateLabel || trip.preview.stopCount > 0 ? (
              <View style={cardStyles.heroMeta}>
                {dateLabel && (
                  <>
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color="rgba(255,255,255,0.75)"
                    />
                    <Text style={cardStyles.heroMetaText}>{dateLabel}</Text>
                  </>
                )}
                {dateLabel && trip.preview.stopCount > 0 && (
                  <Text style={cardStyles.heroMetaDot}>·</Text>
                )}
                {trip.preview.stopCount > 0 && (
                  <>
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color="rgba(255,255,255,0.75)"
                    />
                    <Text style={cardStyles.heroMetaText}>
                      {trip.preview.stopCount}{" "}
                      {trip.preview.stopCount === 1 ? "stop" : "stops"}
                    </Text>
                  </>
                )}
              </View>
            ) : null}

            {categoryLine ? (
              <Text style={cardStyles.heroCategoryLine} numberOfLines={1}>
                {categoryLine}
              </Text>
            ) : null}

            <View style={cardStyles.engagementRow}>
              <View style={cardStyles.engagementItem}>
                <Ionicons
                  name="heart-outline"
                  size={14}
                  color="rgba(255,255,255,0.55)"
                />
                <Text style={cardStyles.engagementCount}>{likeCount}</Text>
              </View>
              <View style={cardStyles.engagementItem}>
                <Ionicons
                  name="chatbubble-outline"
                  size={14}
                  color="rgba(255,255,255,0.55)"
                />
                <Text style={cardStyles.engagementCount}>{commentCount}</Text>
              </View>
              <View style={cardStyles.engagementItem}>
                <Ionicons
                  name="bookmark-outline"
                  size={14}
                  color="rgba(255,255,255,0.55)"
                />
                <Text style={cardStyles.engagementCount}>{saveCount}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Timeline — only rendered in expanded mode, scrolls with the hero */}
        {isExpanded && (
          <>
            <View style={cardStyles.timeline}>
              <Text style={cardStyles.timelineHeading}>Stops on this trip</Text>
              {detailLoading ? (
                <View style={cardStyles.timelineLoader}>
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                  <Text style={cardStyles.timelineLoaderText}>
                    Loading stops…
                  </Text>
                </View>
              ) : stops.length > 0 ? (
                stops.map((stop, idx) => (
                  <StopItem
                    key={stop.id}
                    stop={stop}
                    index={idx}
                    isLast={idx === stops.length - 1}
                  />
                ))
              ) : (
                <Text style={cardStyles.timelineEmpty}>
                  {token
                    ? "No stop details available."
                    : "Sign in to see stop details."}
                </Text>
              )}
            </View>
            <View style={cardStyles.bottomSpacer} />
          </>
        )}
      </ScrollView>

      {/* Expand strip — only in collapsed mode, sits below the ScrollView */}
      {!isExpanded && (
        <Pressable style={cardStyles.expandCta} onPress={onExpand}>
          <Ionicons
            name="chevron-down"
            size={18}
            color={theme.colors.primaryDark}
          />
          <Text style={cardStyles.expandCtaText}>
            See the stops on this trip
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Stop timeline item ─────────────────────────────────────────────────────

function StopItem({
  stop,
  index,
  isLast,
}: {
  stop: StopDetail;
  index: number;
  isLast: boolean;
}) {
  const poiImageUrl = stop.poi.imageUrl?.trim() || null;
  const description = stop.poi.description?.trim() || null;
  const category = stop.poi.category ? cap(stop.poi.category) : null;

  return (
    <View style={stopStyles.row}>
      {/* Left connector */}
      <View style={stopStyles.connector}>
        <View style={stopStyles.dot} />
        {!isLast && <View style={stopStyles.line} />}
      </View>

      {/* POI card */}
      <View style={stopStyles.card}>
        <View style={stopStyles.poiImageWrap}>
          <Artwork imageUrl={poiImageUrl} kind="poi" variant="cover" />
        </View>

        <View style={stopStyles.poiContent}>
          <Text style={stopStyles.stopIndex}>Stop {index + 1}</Text>
          <Text style={stopStyles.poiTitle}>{stop.poi.title}</Text>
          {description ? (
            <Text style={stopStyles.poiDescription} numberOfLines={3}>
              {description}
            </Text>
          ) : (
            <Text style={stopStyles.poiDescriptionFallback} numberOfLines={2}>
              Explore this location on your trip.
            </Text>
          )}
          {category || stop.poi.district ? (
            <View style={stopStyles.tagsRow}>
              {category ? (
                <View style={stopStyles.tag}>
                  <Text style={stopStyles.tagText}>{category}</Text>
                </View>
              ) : null}
              {stop.poi.district ? (
                <View style={stopStyles.tag}>
                  <Text style={stopStyles.tagText}>{stop.poi.district}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // States
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
    paddingVertical: 40,
  },
  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DFF7F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.colors.primaryDark,
    textAlign: "center",
  },
  stateText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 4,
  },
  stateButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 4,
  },
  stateButtonText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  savedNote: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primary,
  },

  // Deck container
  deckContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 8,
    position: "relative",
  },
  actionErrorBanner: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  actionErrorText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: "#9A3412",
  },

  // Card stack — two variants:
  // collapsed: explicit height so the abs-positioned activeCard fills it correctly
  // expanded:  flex:1 to fill available space
  deckAreaCollapsed: {
    position: "relative",
  },
  deckAreaExpanded: {
    flex: 1,
    position: "relative",
  },
  activeCard: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 2,
  },

  // Action buttons
  actionsRow: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
    zIndex: 10,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionBtnPass: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  actionBtnSave: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
  },

  // Collapse button — rendered at panel level so it sits above actionsRow
  collapseBtnPanel: {
    position: "absolute",
    bottom: 24,
    right: 28,
    width: 48,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});

// Card-level styles (outer + scroll + hero + timeline)
const cardStyles = StyleSheet.create({
  outer: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  scroll: {
    flex: 1,
  },

  // Hero
  heroArea: {
    height: HERO_HEIGHT,
    backgroundColor: "#DFF7F6",
  },
  heroScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: "rgba(11,36,48,0.65)",
  },
  heroTopRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creatorBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: 220,
    flexShrink: 1,
  },
  creatorAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  creatorAvatarText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  creatorName: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: "rgba(255,255,255,0.92)",
    flexShrink: 1,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 18,
    gap: 6,
  },
  heroTitle: {
    fontFamily: font.bold,
    fontSize: 24,
    lineHeight: 30,
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  heroMetaText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  heroMetaDot: {
    fontFamily: font.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  heroCategoryLine: {
    fontFamily: font.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.1,
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 2,
  },
  engagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  engagementCount: {
    fontFamily: font.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },

  // Timeline
  timeline: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  timelineHeading: {
    fontFamily: font.bold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  timelineLoader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  timelineLoaderText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  timelineEmpty: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    paddingVertical: 16,
  },
  bottomSpacer: {
    height: 100,
    backgroundColor: theme.colors.background,
  },

  // Expand / collapse
  expandCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: EXPAND_CTA_HEIGHT,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  expandCtaText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
});

// Stop item styles
const stopStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 14,
  },
  connector: {
    width: 20,
    alignItems: "center",
    paddingTop: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    flexShrink: 0,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginTop: 4,
    marginBottom: -4,
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  poiImageWrap: {
    width: "100%",
    height: 120,
    overflow: "hidden",
  },
  poiContent: {
    padding: 14,
    gap: 5,
  },
  stopIndex: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1.0,
    color: theme.colors.primary,
    textTransform: "uppercase",
  },
  poiTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  poiDescription: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  poiDescriptionFallback: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
});
