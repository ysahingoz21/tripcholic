import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Artwork from "@/components/ui/Artwork";
import UserAvatar from "@/components/ui/UserAvatar";
import { getSortedTripStops } from "@/components/trip/tripMapUtils";
import { theme } from "@/constants/theme";
import { font } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import {
  getTrip,
  type TripDetailResponse,
  type TripVisibility,
} from "@/services/trips";
import {
  createPublicTripComment,
  getPublicTrip,
  getPublicTripComments,
  likePublicTrip,
  savePublicTrip,
  unlikePublicTrip,
  unsavePublicTrip,
  type PublicTripComment,
  type PublicTripEngagement,
} from "@/services/publicTrips";
import {
  buildTripEditParams,
  buildTripReturnTarget,
  getTripRouteSource,
} from "@/utils/tripNavigation";
import TripStopsMap from "../../components/trip/TripStopsMap";
import TripDescriptionSection from "../../components/ui/TripDescriptionSection";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getVisibilityConfig(visibility: TripVisibility) {
  if (visibility === "PUBLIC")
    return { label: "Public", icon: "earth-outline" as const };
  return { label: "Private", icon: "lock-closed-outline" as const };
}

function formatCreatorName(displayName: string | null) {
  return displayName?.trim() || "Tripcholic traveler";
}

function formatCommentDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── CommentsModal ─────────────────────────────────────────────────────────────

type CommentsModalProps = {
  visible: boolean;
  onClose: () => void;
  comments: PublicTripComment[];
  commentCount: number;
  tripId: string;
  token: string | null;
  onCommentCreated: (
    comments: PublicTripComment[],
    engagement: PublicTripEngagement,
  ) => void;
};

function CommentsModal({
  visible,
  onClose,
  comments,
  commentCount,
  tripId,
  token,
  onCommentCreated,
}: CommentsModalProps) {
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const handlePost = async () => {
    if (!token || !input.trim() || isPending) return;
    try {
      setIsPending(true);
      setPostError(null);
      await createPublicTripComment(tripId, token, input.trim());
      const response = await getPublicTripComments(tripId, token);
      onCommentCreated(response.items, response.engagement);
      setInput("");
    } catch (err) {
      setPostError(
        err instanceof Error ? err.message : "Unable to post comment.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <View style={modalStyles.dragHandle} />
            <View style={modalStyles.headerRow}>
              <Text style={modalStyles.headerTitle}>
                Comments ({commentCount})
              </Text>
              <Pressable
                style={modalStyles.closeBtn}
                onPress={onClose}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={theme.colors.primaryDark}
                />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={modalStyles.list}
            contentContainerStyle={modalStyles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {comments.length === 0 ? (
              <View style={modalStyles.empty}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={36}
                  color={theme.colors.textSecondary}
                />
                <Text style={modalStyles.emptyText}>
                  No comments yet. Be the first!
                </Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={modalStyles.commentRow}>
                  <UserAvatar
                    avatarUrl={comment.author.avatarUrl}
                    displayName={comment.author.displayName}
                    size={36}
                    ringSize={0}
                  />
                  <View style={modalStyles.commentCard}>
                    <View style={modalStyles.commentMeta}>
                      <Text style={modalStyles.commentAuthor}>
                        {formatCreatorName(comment.author.displayName)}
                      </Text>
                      <Text style={modalStyles.commentDate}>
                        {formatCommentDate(comment.createdAt)}
                      </Text>
                    </View>
                    <Text style={modalStyles.commentText}>{comment.body}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {postError ? (
            <View style={modalStyles.errorRow}>
              <Text style={modalStyles.errorText}>{postError}</Text>
            </View>
          ) : null}

          <View style={modalStyles.composer}>
            <TextInput
              style={modalStyles.composerInput}
              placeholder="Add a comment…"
              placeholderTextColor={theme.colors.textSecondary}
              value={input}
              onChangeText={setInput}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              style={[
                modalStyles.postBtn,
                (!input.trim() || isPending) && modalStyles.postBtnDisabled,
              ]}
              onPress={() => void handlePost()}
              disabled={!input.trim() || isPending}
            >
              <Ionicons name="send" size={17} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  commentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  commentCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 4,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentAuthor: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primaryDark,
  },
  commentDate: {
    fontFamily: font.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  commentText: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  errorRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: "#EF4444",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.primaryDark,
    backgroundColor: theme.colors.background,
  },
  postBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  postBtnDisabled: { opacity: 0.45 },
});

// ── PageHeader ────────────────────────────────────────────────────────────────

function PageHeader({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();


  return (
    <View style={[hdrStyles.header, { paddingTop: insets.top }]}>
      <View style={hdrStyles.inner}>
        <View style={hdrStyles.side}>
          <Pressable
            style={({ pressed }) => [
              hdrStyles.iconBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={onBack}
            hitSlop={8}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={theme.colors.primaryDark}
            />
          </Pressable>
        </View>
        <Text style={hdrStyles.wordmark} numberOfLines={1}>
          TRIPCHOLIC
        </Text>
        <View style={[hdrStyles.side, hdrStyles.sideRight]}>
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            displayName={user?.displayName}
            email={user?.email}
            size={32}
            ringSize={0}
          />
        </View>
      </View>
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  inner: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  side: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideRight: { alignItems: "flex-end" },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    flex: 1,
    textAlign: "center",
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 3,
    color: theme.colors.primaryDark,
  },
});

// ── OwnerHeroSection ──────────────────────────────────────────────────────────

type OwnerHeroProps = {
  detail: TripDetailResponse;
  ownerName: string | null;
  ownerAvatarUrl?: string | null;
};

function OwnerHeroSection({
  detail,
  ownerName,
  ownerAvatarUrl,
}: OwnerHeroProps) {
  const imageUrl = detail.preview.imageUrl?.trim() || null;
  const visConfig = getVisibilityConfig(detail.trip.visibility);

  const categories = Array.from(
    new Set(
      [detail.preview.primaryCategory, ...detail.trip.categories].filter(
        (c): c is string => Boolean(c),
      ),
    ),
  ).map(capFirst);

  const creatorName = ownerName?.trim() || "Tripcholic traveler";

  return (
    <View style={ownerHeroStyles.container}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Artwork kind="trip" variant="cover" label={detail.trip.title} />
      )}

      {/* Visibility badge — top right */}
      <View style={ownerHeroStyles.visBadge}>
        <View style={ownerHeroStyles.visPill}>
          <Ionicons
            name={visConfig.icon}
            size={11}
            color={theme.colors.primaryDark}
          />
          <Text style={ownerHeroStyles.visPillText}>{visConfig.label}</Text>
        </View>
      </View>

      <View style={ownerHeroStyles.scrim} />

      <View style={ownerHeroStyles.bottomContent}>
        <Text style={ownerHeroStyles.title} numberOfLines={3}>
          {detail.trip.title}
        </Text>

        {categories.length > 0 && (
          <Text style={ownerHeroStyles.categories}>
            {categories.join(", ")}
          </Text>
        )}

        {/* Creator bar + You pill + date */}
        <View style={ownerHeroStyles.creatorRow}>
          <View style={ownerHeroStyles.creatorBar}>
            <UserAvatar
              avatarUrl={ownerAvatarUrl}
              displayName={ownerName}
              size={30}
              ringSize={0}
            />
            <View style={ownerHeroStyles.creatorInfo}>
              <Text style={ownerHeroStyles.creatorName} numberOfLines={1}>
                {creatorName}
              </Text>
              <Text style={ownerHeroStyles.creatorSub}>Your trip</Text>
            </View>
            {/* "You" pill — mirrors the Following button style */}
            <View style={ownerHeroStyles.youPill}>
              <Text style={ownerHeroStyles.youPillText}>You</Text>
            </View>
          </View>

          <View style={ownerHeroStyles.datePill}>
            <Text style={ownerHeroStyles.datePillText}>
              {formatDateLabel(detail.trip.date)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const ownerHeroStyles = StyleSheet.create({
  container: {
    height: 432,
    overflow: "hidden",
    backgroundColor: theme.colors.primaryDark,
  },
  scrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: "rgba(11,36,48,0.80)",
  },
  visBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
  },
  visPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  visPillText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: theme.colors.primaryDark,
    letterSpacing: 0.1,
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    gap: 4,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 26,
    lineHeight: 32,
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  categories: {
    fontFamily: font.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 0.1,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  creatorBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 0,
  },
  creatorInitials: {
    fontFamily: font.bold,
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  creatorInfo: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  creatorName: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: "rgba(255,255,255,0.92)",
  },
  creatorSub: {
    fontFamily: font.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
  },
  youPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  youPillText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  datePill: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 64,
  },
  datePillText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    textAlign: "right",
    lineHeight: 16,
  },
});

// ── TimelineItem ──────────────────────────────────────────────────────────────

type StopData = TripDetailResponse["stops"][number];

function TimelineItem({ stop, isLast }: { stop: StopData; isLast: boolean }) {
  const imageUrl = stop.poi.imageUrl?.trim() || null;
  const poiName =
    stop.poi.title.trim() || stop.title.trim() || `Stop ${stop.order}`;
  const description =
    stop.poi.description?.trim() ||
    `${capFirst(stop.poi.category)} spot${stop.poi.district ? ` in ${stop.poi.district}` : ""}.`;

  return (
    <View style={tlStyles.row}>
      <View style={tlStyles.markerCol}>
        <View style={tlStyles.dot}>
          <Ionicons name="location" size={11} color="#FFFFFF" />
        </View>
        {!isLast && <View style={tlStyles.line} />}
      </View>
      <View style={[tlStyles.card, isLast && tlStyles.cardLast]}>
        <View style={tlStyles.topRow}>
          <Text style={tlStyles.stopTime}>{stop.arrivalTime}</Text>
          <View style={tlStyles.categoryBadge}>
            <Text style={tlStyles.categoryText}>
              {capFirst(stop.poi.category)}
            </Text>
          </View>
        </View>
        <Text style={tlStyles.poiName} numberOfLines={2}>
          {poiName}
        </Text>
        <Image
          source={
            imageUrl
              ? { uri: imageUrl }
              : require("../../assets/images/placeholders/default-poi.png")
          }
          style={tlStyles.poiImage}
          contentFit="cover"
          transition={150}
        />
        <Text style={tlStyles.description} numberOfLines={3}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  markerCol: { width: 28, alignItems: "center", alignSelf: "stretch" },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    flexShrink: 0,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.primary,
    opacity: 0.25,
    marginTop: 4,
  },
  card: { flex: 1, paddingLeft: 14, paddingBottom: 24, gap: 8 },
  cardLast: { paddingBottom: 4 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stopTime: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 0.1,
  },
  categoryBadge: {
    backgroundColor: "#DFF7F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: "#006A69",
    letterSpacing: 0.2,
  },
  poiName: {
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    marginTop: -2,
  },
  poiImage: { height: 252, borderRadius: 12 },
  description: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

const DEFAULT_ENGAGEMENT: PublicTripEngagement = {
  likeCount: 0,
  commentCount: 0,
  saveCount: 0,
  completionCount: 0,
  likedByMe: false,
  savedByMe: false,
  completedByMe: false,
};

export default function OwnerTripDetailScreen() {
  const router = useRouter();
  const { id, source, returnTripId } = useLocalSearchParams<{
    id?: string;
    source?: string;
    returnTripId?: string;
  }>();
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engagement, setEngagement] =
    useState<PublicTripEngagement>(DEFAULT_ENGAGEMENT);
  const [isPublicTrip, setIsPublicTrip] = useState(false);
  const [comments, setComments] = useState<PublicTripComment[]>([]);
  const [isLikePending, setIsLikePending] = useState(false);
  const [isSavePending, setIsSavePending] = useState(false);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);

  const returnTarget = buildTripReturnTarget({ source, returnTripId });
  const routeSource = getTripRouteSource(source);

  const loadTrip = useCallback(async () => {
    if (isAuthLoading) return;
    if (!token) {
      setError("Authentication required. Please sign in again.");
      setIsLoading(false);
      return;
    }
    if (!id || typeof id !== "string") {
      setError("Missing trip id.");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      setEngagement(DEFAULT_ENGAGEMENT);
      setIsPublicTrip(false);
      setComments([]);
      const data = await getTrip(token, id);
      setTripDetail(data);
      if (data.trip.visibility === "PUBLIC") {
        setIsPublicTrip(true);
        try {
          const publicData = await getPublicTrip(data.trip.id, token);
          setEngagement(publicData.engagement);
          setComments(publicData.comments);
        } catch {
          // Keep default 0 counts; social bar still renders
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trip.");
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthLoading, token]);

  useFocusEffect(
    useCallback(() => {
      void loadTrip();
    }, [loadTrip]),
  );

  const sortedStops = useMemo(
    () => getSortedTripStops(tripDetail?.stops ?? []),
    [tripDetail?.stops],
  );

  const ownerName = user?.displayName ?? null;

  const recentComments = useMemo(() => comments.slice(0, 3), [comments]);

  const handleToggleLike = async () => {
    if (
      !token ||
      !id ||
      typeof id !== "string" ||
      !isPublicTrip ||
      isLikePending
    )
      return;
    try {
      setIsLikePending(true);
      const response = engagement.likedByMe
        ? await unlikePublicTrip(id, token)
        : await likePublicTrip(id, token);
      setEngagement(response.engagement);
    } catch {
      // ignore
    } finally {
      setIsLikePending(false);
    }
  };

  const handleToggleSave = async () => {
    if (
      !token ||
      !id ||
      typeof id !== "string" ||
      !isPublicTrip ||
      isSavePending
    )
      return;
    try {
      setIsSavePending(true);
      const response = engagement.savedByMe
        ? await unsavePublicTrip(id, token)
        : await savePublicTrip(id, token);
      setEngagement(response.engagement);
    } catch {
      // ignore
    } finally {
      setIsSavePending(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <PageHeader onBack={() => router.back()} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading trip…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error || !tripDetail) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <PageHeader onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>Trip Unavailable</Text>
          <Text style={styles.stateText}>
            {error ?? "This trip could not be loaded."}
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace(returnTarget.href)}
          >
            <Text style={styles.primaryBtnText}>{returnTarget.label}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const tripIdStr = typeof id === "string" ? id : "";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <PageHeader onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <OwnerHeroSection
          detail={tripDetail}
          ownerName={ownerName}
          ownerAvatarUrl={user?.avatarUrl}
        />

        {/* Edit Trip CTA — between hero and details */}
        <View style={styles.editBtnWrapper}>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              pressed && { opacity: 0.82 },
            ]}
            onPress={() =>
              router.push(
                buildTripEditParams(tripIdStr, {
                  ...(routeSource ? { source: routeSource } : {}),
                  ...(typeof returnTripId === "string" ? { returnTripId } : {}),
                }),
              )
            }
          >
            <Ionicons name="pencil-outline" size={17} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Edit Trip</Text>
          </Pressable>
        </View>

        {isPublicTrip ? (
          /* ── Public own trip — social section identical to public-trip/[id].tsx ── */
          <View style={styles.content}>
            <View style={styles.socialBar}>
              <Pressable
                style={[styles.socialItem, isLikePending && styles.dimmed]}
                onPress={() => void handleToggleLike()}
                disabled={isLikePending}
              >
                <Ionicons
                  name={engagement.likedByMe ? "heart" : "heart-outline"}
                  size={22}
                  color={engagement.likedByMe ? "#EF4444" : "#64748B"}
                />
                <Text
                  style={[
                    styles.socialCount,
                    engagement.likedByMe && styles.socialCountLiked,
                  ]}
                >
                  {engagement.likeCount}
                </Text>
              </Pressable>
              <View style={styles.socialSep} />

              <Pressable
                style={styles.socialItem}
                onPress={() => setCommentsModalOpen(true)}
              >
                <Ionicons name="chatbubble-outline" size={21} color="#64748B" />
                <Text style={styles.socialCount}>
                  {engagement.commentCount}
                </Text>
              </Pressable>
              <View style={styles.socialSep} />

              <Pressable
                style={[styles.socialItem, isSavePending && styles.dimmed]}
                onPress={() => void handleToggleSave()}
                disabled={isSavePending}
              >
                <Ionicons
                  name={engagement.savedByMe ? "bookmark" : "bookmark-outline"}
                  size={21}
                  color={engagement.savedByMe ? "#006A69" : "#64748B"}
                />
                <Text
                  style={[
                    styles.socialCount,
                    engagement.savedByMe && styles.socialCountSaved,
                  ]}
                >
                  {engagement.saveCount}
                </Text>
              </Pressable>
              <View style={styles.socialSep} />

              <View style={styles.socialItem}>
                <Ionicons name="footsteps-outline" size={21} color="#64748B" />
                <Text style={styles.socialCount}>
                  {engagement.completionCount}
                </Text>
              </View>
            </View>

            <View style={styles.commentsSection}>
              <Text style={styles.commentsSectionTitle}>Recent comments</Text>

              {recentComments.length > 0
                ? recentComments.map((comment) => (
                    <View key={comment.id} style={styles.commentRow}>
                      <UserAvatar
                        avatarUrl={comment.author.avatarUrl}
                        displayName={comment.author.displayName}
                        size={32}
                        ringSize={0}
                      />
                      <View style={styles.commentCard}>
                        <Text style={styles.commentAuthor}>
                          {formatCreatorName(comment.author.displayName)}
                        </Text>
                        <Text style={styles.commentBody} numberOfLines={3}>
                          {comment.body}
                        </Text>
                      </View>
                    </View>
                  ))
                : null}

              <Pressable
                style={styles.viewAllBtn}
                onPress={() => setCommentsModalOpen(true)}
              >
                <Text style={styles.viewAllBtnText}>
                  {engagement.commentCount > 0
                    ? `View all ${engagement.commentCount} ${engagement.commentCount === 1 ? "comment" : "comments"}`
                    : "Add the first comment"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── Private own trip — informational card, no social UI ── */
          <View style={styles.content}>
            <View style={styles.privateCard}>
              <View style={styles.privateCardIconWrap}>
                <Ionicons
                  name="lock-closed"
                  size={22}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.privateCardTitle}>This trip is private</Text>
              <Text style={styles.privateCardBody}>
                Set your trip to Public to enable likes, comments, saves, and
                community discovery.
              </Text>
            </View>
          </View>
        )}

        {/* ── Trip Description ─────────────────────────────────────────────── */}
        {tripDetail.trip.description?.trim() ? (
          <View style={styles.content}>
            <TripDescriptionSection description={tripDetail.trip.description} />
          </View>
        ) : null}

        {/* ── Content block 1 ─────────────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Metrics grid */}
          <View style={styles.metricsGrid}>
            {(
              [
                {
                  icon: "location-outline" as const,
                  label: "Stops",
                  value: String(tripDetail.optimization.stopCount),
                },
                {
                  icon: "time-outline" as const,
                  label: "Duration",
                  value:
                    tripDetail.optimization.routeTotalDurationMin !== null
                      ? `${tripDetail.optimization.routeTotalDurationMin} min`
                      : "—",
                },
                {
                  icon: "cash-outline" as const,
                  label: "Est. Cost",
                  value:
                    tripDetail.optimization.routeTotalCostTl !== null
                      ? `${tripDetail.optimization.routeTotalCostTl} TL`
                      : "—",
                },
                {
                  icon: "walk-outline" as const,
                  label: "Distance",
                  value:
                    tripDetail.optimization.routeTotalDistanceKm !== null
                      ? `${tripDetail.optimization.routeTotalDistanceKm} km`
                      : "—",
                },
              ] as const
            ).map(({ icon, label, value }) => (
              <View key={label} style={styles.metricCell}>
                <View style={styles.metricIconCircle}>
                  <Ionicons
                    name={icon}
                    size={16}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.metricValue}>{value}</Text>
                <Text style={styles.metricLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapSection}>
          <TripStopsMap stops={tripDetail.stops} />
        </View>

        {/* ── Content block 2 ─────────────────────────────────────────────── */}
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>ITINERARY</Text>
            <Text style={styles.sectionTitle}>Trip stops</Text>
          </View>

          {sortedStops.length > 0 ? (
            <View>
              {sortedStops.map((stop, index) => (
                <TimelineItem
                  key={stop.id}
                  stop={stop}
                  isLast={index === sortedStops.length - 1}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No stops available for this trip yet.
              </Text>
            </View>
          )}

          {tripDetail.optimization.routeExplanation ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>ROUTE</Text>
                <Text style={styles.sectionTitle}>Why this route works</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.routeCardHeader}>
                  <View style={styles.routeIconBubble}>
                    <Ionicons name="bulb-outline" size={15} color="#006A69" />
                  </View>
                  <Text style={styles.routeCardLabel}>Route rationale</Text>
                </View>
                <Text style={styles.routeText}>
                  {tripDetail.optimization.routeExplanation}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {isPublicTrip && (
        <CommentsModal
          visible={commentsModalOpen}
          onClose={() => setCommentsModalOpen(false)}
          comments={comments}
          commentCount={engagement.commentCount}
          tripId={tripIdStr}
          token={token}
          onCommentCreated={(updatedComments, updatedEngagement) => {
            setComments(updatedComments);
            setEngagement(updatedEngagement);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: 48 },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },

  mapSection: {
    marginTop: 24,
    marginBottom: 4,
    marginHorizontal: 16,
  },

  // Edit button strip
  editBtnWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 16,
    height: 50,
  },
  editBtnText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  // States
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
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
  },

  // Metrics
  metricsGrid: { flexDirection: "row", gap: 8 },
  metricCell: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 6,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DFF7F6",
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontFamily: font.bold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    textAlign: "center",
  },
  metricLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  // Section headers
  sectionHeader: { gap: 2, marginTop: 4 },
  sectionEyebrow: {
    fontFamily: font.bold,
    fontSize: 10,
    color: theme.colors.primary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 16,
    gap: 12,
  },
  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8ECF0",
  },
  routeIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DFF7F6",
    alignItems: "center",
    justifyContent: "center",
  },
  routeCardLabel: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: "#006A69",
    letterSpacing: 0.2,
  },
  routeText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },

  // Empty state
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 20,
    alignItems: "center",
  },
  emptyStateText: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  // Primary button
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  primaryBtnText: {
    fontFamily: font.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  // Social bar — matches public-trip/[id].tsx exactly
  socialBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    overflow: "hidden",
  },
  socialItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    gap: 4,
  },
  socialSep: {
    width: 1,
    height: 32,
    backgroundColor: "#E8ECF0",
  },
  socialCount: {
    fontFamily: font.bold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  socialCountLiked: { color: "#EF4444" },
  socialCountSaved: { color: "#006A69" },
  dimmed: { opacity: 0.45 },

  // Comments section — matches public-trip/[id].tsx exactly
  commentsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 16,
    gap: 12,
  },
  commentsSectionTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    letterSpacing: -0.1,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  commentCard: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  commentAuthor: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },
  commentBody: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  viewAllBtn: {
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8ECF0",
  },
  viewAllBtnText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primary,
    textAlign: "center",
  },

  // Private trip social placeholder
  privateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  privateCardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#DFF7F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  privateCardTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    textAlign: "center",
  },
  privateCardBody: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
});
