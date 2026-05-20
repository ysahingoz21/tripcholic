import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Artwork from "@/components/ui/Artwork";
import { getSortedTripStops } from "@/components/trip/tripMapUtils";
import { theme } from "@/constants/theme";
import { font } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import {
  completePublicTrip,
  createPublicTripComment,
  getPublicTrip,
  getPublicTripComments,
  likePublicTrip,
  remixPublicTrip,
  savePublicTrip,
  unlikePublicTrip,
  uncompletePublicTrip,
  unsavePublicTrip,
  updatePublicTripFeedback,
  type PublicTripComment,
  type PublicTripDetailResponse,
  type PublicTripEngagement,
} from "@/services/publicTrips";
import { followUser, unfollowUser } from "@/services/users";
import TripStopsMap from "../../components/trip/TripStopsMap";
import TripDescriptionSection from "../../components/ui/TripDescriptionSection";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name?.trim()) return "T";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (name[0] ?? "T").toUpperCase();
}

function formatCreatorName(displayName: string | null) {
  return displayName?.trim() || "Tripcholic traveler";
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCommentDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isNotFoundErrorMessage(message: string) {
  return message.toLowerCase().includes("not found");
}

// ── PageHeader ────────────────────────────────────────────────────────────────
// Back button (left) · TRIPCHOLIC wordmark (center) · initials avatar (right).
// Handles safe-area top inset internally so SafeAreaView can skip edges: top.

function PageHeader({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "T");

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
          <View style={hdrStyles.avatar}>
            <Text style={hdrStyles.avatarText}>{initials}</Text>
          </View>
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
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    color: "#FFFFFF",
  },
});

// ── HeroSection ───────────────────────────────────────────────────────────────

type HeroProps = {
  detail: PublicTripDetailResponse;
  canToggleFollow: boolean;
  isFollowPending: boolean;
  onToggleFollow: () => void;
  isOwnTrip: boolean;
  onCreatorPress?: () => void;
};

function HeroSection({
  detail,
  canToggleFollow,
  isFollowPending,
  onToggleFollow,
  isOwnTrip,
  onCreatorPress,
}: HeroProps) {
  const imageUrl = detail.preview.imageUrl?.trim() || null;

  const categories = Array.from(
    new Set(
      [detail.preview.primaryCategory, ...detail.trip.categories].filter(
        (c): c is string => Boolean(c),
      ),
    ),
  ).map(capFirst);

  const creatorName = formatCreatorName(detail.creator.displayName);
  const creatorInitials = getInitials(detail.creator.displayName);

  return (
    <View style={heroStyles.container}>
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

      <View style={heroStyles.scrim} />

      {/* Visibility badge — top right, owner only */}
      {isOwnTrip && (
        <View style={heroStyles.visBadgeWrap}>
          <View style={heroStyles.visBadge}>
            <Ionicons name="earth-outline" size={11} color={theme.colors.primaryDark} />
            <Text style={heroStyles.visText}>Public</Text>
          </View>
        </View>
      )}

      <View style={heroStyles.bottomContent}>
        <Text style={heroStyles.title} numberOfLines={3}>
          {detail.trip.title}
        </Text>

        {categories.length > 0 && (
          <Text style={heroStyles.categories}>{categories.join(", ")}</Text>
        )}

        {/* Creator bar (follow inside) + trip date pill on the right */}
        <View style={heroStyles.creatorRow}>
          <Pressable
            style={heroStyles.creatorBar}
            onPress={onCreatorPress}
            disabled={!onCreatorPress}
          >
            <View style={heroStyles.creatorAvatar}>
              <Text style={heroStyles.creatorInitials}>{creatorInitials}</Text>
            </View>
            <View style={heroStyles.creatorInfo}>
              <Text style={heroStyles.creatorName} numberOfLines={1}>
                {creatorName}
              </Text>
              <Text style={heroStyles.creatorFollowers}>
                {detail.creator.followerCount}{" "}
                {detail.creator.followerCount === 1 ? "Follower" : "Followers"}
              </Text>
            </View>

            {isOwnTrip ? (
              <View style={heroStyles.youPill}>
                <Text style={heroStyles.youPillText}>You</Text>
              </View>
            ) : canToggleFollow ? (
              <Pressable
                style={[
                  heroStyles.followBtn,
                  detail.creator.isFollowedByMe && heroStyles.followBtnActive,
                  isFollowPending && heroStyles.followBtnDimmed,
                ]}
                onPress={onToggleFollow}
                disabled={isFollowPending}
              >
                <Text
                  style={[
                    heroStyles.followBtnText,
                    detail.creator.isFollowedByMe &&
                      heroStyles.followBtnTextActive,
                  ]}
                >
                  {isFollowPending
                    ? "…"
                    : detail.creator.isFollowedByMe
                      ? "Following"
                      : "Follow"}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>

          <View style={heroStyles.datePill}>
            <Text style={heroStyles.datePillText}>
              {formatDateLabel(detail.trip.date)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
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
    height: "40%",
    backgroundColor: "rgba(11,36,48,0.80)",
  },
  visBadgeWrap: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
  },
  visBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  visText: {
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
  creatorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  creatorFollowers: {
    fontFamily: font.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
  },
  followBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  followBtnActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  followBtnDimmed: { opacity: 0.55 },
  followBtnText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  followBtnTextActive: {
    color: "rgba(255,255,255,0.85)",
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

// ── CommentsModal ─────────────────────────────────────────────────────────────

type CommentsModalProps = {
  visible: boolean;
  onClose: () => void;
  comments: PublicTripComment[];
  commentCount: number;
  tripId: string;
  token: string | null;
  currentUserId?: string | null;
  onCommentCreated: (
    comments: PublicTripComment[],
    engagement: PublicTripEngagement,
  ) => void;
  onAuthorPress?: (authorId: string) => void;
};

function CommentsModal({
  visible,
  onClose,
  comments,
  commentCount,
  tripId,
  token,
  currentUserId,
  onCommentCreated,
  onAuthorPress,
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
          {/* Header */}
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

          {/* Comment list */}
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
                  <Pressable
                    style={modalStyles.commentAvatar}
                    onPress={comment.author.id && onAuthorPress ? () => onAuthorPress(comment.author.id!) : undefined}
                    disabled={!comment.author.id || !onAuthorPress}
                  >
                    <Text style={modalStyles.commentAvatarText}>
                      {getInitials(comment.author.displayName)}
                    </Text>
                  </Pressable>
                  <View style={modalStyles.commentCard}>
                    <View style={modalStyles.commentMeta}>
                      <Pressable
                        onPress={comment.author.id && onAuthorPress ? () => onAuthorPress(comment.author.id!) : undefined}
                        disabled={!comment.author.id || !onAuthorPress}
                      >
                        <Text style={modalStyles.commentAuthor}>
                          {formatCreatorName(comment.author.displayName)}
                        </Text>
                      </Pressable>
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

          {/* Composer */}
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 17,
    color: theme.colors.primaryDark,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    paddingBottom: 16,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    gap: 12,
  },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  commentAvatarText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  commentCard: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentAuthor: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },
  commentDate: {
    fontFamily: font.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  commentText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "#334155",
  },
  errorRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#FFF7ED",
  },
  errorText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: "#9A3412",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.primaryDark,
    backgroundColor: "#F8FAFC",
  },
  postBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  postBtnDisabled: { opacity: 0.45 },
});

// ── NewTimelineItem ───────────────────────────────────────────────────────────
// Left column: continuous teal line + circular marker dot.
// Right card: time in green · category badge · POI name · image · description.

type StopData = PublicTripDetailResponse["stops"][number];

function NewTimelineItem({
  stop,
  isLast,
}: {
  stop: StopData;
  isLast: boolean;
}) {
  const imageUrl = stop.poi.imageUrl?.trim() || null;
  const poiName =
    stop.poi.title.trim() || stop.title.trim() || `Stop ${stop.order}`;
  const description =
    stop.poi.description?.trim() ||
    `${capFirst(stop.poi.category)} spot${stop.poi.district ? ` in ${stop.poi.district}` : ""}.`;

  return (
    <View style={tlStyles.row}>
      {/* Marker column */}
      <View style={tlStyles.markerCol}>
        <View style={tlStyles.dot}>
          <Ionicons name="location" size={11} color="#FFFFFF" />
        </View>
        {!isLast && <View style={tlStyles.line} />}
      </View>

      {/* Content */}
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
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  markerCol: {
    width: 28,
    alignItems: "center",
    alignSelf: "stretch",
  },
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
  card: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 24,
    gap: 8,
  },
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
  poiImage: {
    height: 252,
    borderRadius: 12,
  },
  description: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PublicTripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [tripDetail, setTripDetail] = useState<PublicTripDetailResponse | null>(
    null,
  );
  const [comments, setComments] = useState<PublicTripComment[]>([]);
  const [engagement, setEngagement] = useState<PublicTripEngagement | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLikePending, setIsLikePending] = useState(false);
  const [isSavePending, setIsSavePending] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [isCompletePending, setIsCompletePending] = useState(false);
  const [selectedFeedbackSignals, setSelectedFeedbackSignals] = useState<
    string[]
  >([]);
  const [isFeedbackPending, setIsFeedbackPending] = useState(false);
  const [isRemixPending, setIsRemixPending] = useState(false);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);

  const loadPublicTrip = useCallback(async () => {
    if (isAuthLoading) return;

    if (!token) {
      setScreenError("Authentication required. Please sign in again.");
      setIsLoading(false);
      return;
    }

    if (!id || typeof id !== "string") {
      setScreenError("Missing public trip id.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setScreenError(null);
      setActionError(null);
      const detail = await getPublicTrip(id, token);
      setTripDetail(detail);
      setComments(detail.comments);
      setEngagement(detail.engagement);
      setSelectedFeedbackSignals(detail.feedback.mine);
    } catch (loadError) {
      setTripDetail(null);
      setComments([]);
      setEngagement(null);
      setSelectedFeedbackSignals([]);
      setScreenError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load public trip.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthLoading, token]);

  useEffect(() => {
    void loadPublicTrip();
  }, [loadPublicTrip]);

  const sortedStops = useMemo(
    () => getSortedTripStops(tripDetail?.stops ?? []),
    [tripDetail?.stops],
  );

  const creatorId = tripDetail?.creator.id ?? null;
  const isOwnCreatorTrip = creatorId !== null && creatorId === user?.id;
  const canToggleFollow = Boolean(token && creatorId && !isOwnCreatorTrip);

  const hasFeedbackChanges =
    tripDetail !== null &&
    selectedFeedbackSignals.length === tripDetail.feedback.mine.length &&
    selectedFeedbackSignals.every((s) => tripDetail.feedback.mine.includes(s))
      ? false
      : true;

  const handleToggleFollow = async () => {
    if (
      !token ||
      !tripDetail ||
      !creatorId ||
      isOwnCreatorTrip ||
      isFollowPending
    )
      return;
    try {
      setIsFollowPending(true);
      const response = tripDetail.creator.isFollowedByMe
        ? await unfollowUser(creatorId, token)
        : await followUser(creatorId, token);
      setTripDetail((cur) =>
        cur
          ? { ...cur, creator: { ...cur.creator, ...response.creator } }
          : cur,
      );
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to update follow state.",
      );
    } finally {
      setIsFollowPending(false);
    }
  };

  const handleToggleLike = async () => {
    if (!token || !id || typeof id !== "string" || !engagement || isLikePending)
      return;
    try {
      setIsLikePending(true);
      const response = engagement.likedByMe
        ? await unlikePublicTrip(id, token)
        : await likePublicTrip(id, token);
      setEngagement(response.engagement);
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to update like.",
      );
    } finally {
      setIsLikePending(false);
    }
  };

  const handleToggleSave = async () => {
    if (!token || !id || typeof id !== "string" || !engagement || isSavePending)
      return;
    try {
      setIsSavePending(true);
      const response = engagement.savedByMe
        ? await unsavePublicTrip(id, token)
        : await savePublicTrip(id, token);
      setEngagement(response.engagement);
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to update saved state.",
      );
    } finally {
      setIsSavePending(false);
    }
  };

  const handleToggleCompletion = async () => {
    if (
      !token ||
      !id ||
      typeof id !== "string" ||
      !engagement ||
      isCompletePending
    )
      return;
    try {
      setIsCompletePending(true);
      engagement.completedByMe
        ? await uncompletePublicTrip(id, token)
        : await completePublicTrip(id, token);
      const refreshed = await getPublicTrip(id, token);
      setTripDetail(refreshed);
      setComments(refreshed.comments);
      setEngagement(refreshed.engagement);
      setSelectedFeedbackSignals(refreshed.feedback.mine);
      setActionError(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to update completion state.";
      if (isNotFoundErrorMessage(message)) {
        setTripDetail(null);
        setComments([]);
        setEngagement(null);
        setSelectedFeedbackSignals([]);
        setScreenError(
          "This public trip is no longer available for completion.",
        );
        setActionError(null);
      } else {
        setActionError(message);
      }
    } finally {
      setIsCompletePending(false);
    }
  };

  const handleToggleFeedbackSignal = (key: string) => {
    setSelectedFeedbackSignals((cur) =>
      cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key],
    );
  };

  const handleSaveFeedback = async () => {
    if (
      !token ||
      !id ||
      typeof id !== "string" ||
      !tripDetail ||
      !engagement?.completedByMe ||
      isFeedbackPending
    )
      return;
    try {
      setIsFeedbackPending(true);
      const response = await updatePublicTripFeedback(
        id,
        token,
        selectedFeedbackSignals,
      );
      setTripDetail((cur) =>
        cur ? { ...cur, feedback: response.feedback } : cur,
      );
      setSelectedFeedbackSignals(response.feedback.mine);
      setActionError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to update feedback.";
      if (isNotFoundErrorMessage(message)) {
        setTripDetail(null);
        setComments([]);
        setEngagement(null);
        setSelectedFeedbackSignals([]);
        setScreenError("This public trip is no longer available.");
        setActionError(null);
      } else {
        setActionError(message);
      }
    } finally {
      setIsFeedbackPending(false);
    }
  };

  const handleClearFeedbackSelection = () => {
    setSelectedFeedbackSignals([]);
    setActionError(null);
  };

  const handleRemixTrip = async () => {
    if (!token || !id || typeof id !== "string" || isRemixPending) return;
    try {
      setIsRemixPending(true);
      setActionError(null);
      const response = await remixPublicTrip(id, token);
      router.push({
        pathname: "/trip/[id]/edit",
        params: { id: response.tripId, remix: "1" },
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to remix this trip.",
      );
    } finally {
      setIsRemixPending(false);
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

  if (screenError || !tripDetail || !engagement) {
    const isUnavailable =
      screenError?.toLowerCase().includes("not found") ?? false;
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <PageHeader onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>
            {isUnavailable ? "Trip Unavailable" : "Couldn't load trip"}
          </Text>
          <Text style={styles.stateText}>
            {screenError ?? "This public trip could not be loaded."}
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace("/(tabs)/explore")}
          >
            <Text style={styles.primaryBtnText}>Back to Explore</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const recentComments = comments.slice(0, 2);
  const tripIdStr = typeof id === "string" ? id : "";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      {/* 1. Header */}
      <PageHeader onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2 + 3. Hero image + creator bar */}
        <HeroSection
          detail={tripDetail}
          canToggleFollow={canToggleFollow}
          isFollowPending={isFollowPending}
          onToggleFollow={() => void handleToggleFollow()}
          isOwnTrip={isOwnCreatorTrip}
          onCreatorPress={!isOwnCreatorTrip && creatorId ? () => router.push(`/profile/${creatorId}` as any) : undefined}
        />

        {/* Edit Trip button — owner only, between hero and details */}
        {isOwnCreatorTrip ? (
          <View style={styles.editBtnWrapper}>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.82 }]}
              onPress={() =>
                router.push({
                  pathname: "/trip/[id]/edit",
                  params: { id: tripIdStr },
                })
              }
            >
              <Ionicons name="pencil-outline" size={17} color="#FFFFFF" />
              <Text style={styles.editBtnText}>Edit Trip</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Content block 1 ─────────────────────────────────────────────── */}
        <View style={styles.content}>
          {actionError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={14} color="#9A3412" />
              <Text style={styles.errorBannerText}>{actionError}</Text>
            </View>
          ) : null}

          {/* 4. Trip metrics grid */}
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

          {/* 5. Social interaction row */}
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
              <Text style={styles.socialCount}>{engagement.commentCount}</Text>
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

          {/* 7. Recent comments — above the Mark as tried button */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>Recent comments</Text>

            {recentComments.length > 0
              ? recentComments.map((comment) => (
                  <View key={comment.id} style={styles.commentRow}>
                    <Pressable
                      style={styles.commentAvatar}
                      onPress={comment.author.id
                        ? comment.author.id === user?.id
                          ? () => router.push('/(tabs)/profile' as any)
                          : () => router.push(`/profile/${comment.author.id}` as any)
                        : undefined}
                      disabled={!comment.author.id}
                    >
                      <Text style={styles.commentAvatarText}>
                        {getInitials(comment.author.displayName)}
                      </Text>
                    </Pressable>
                    <View style={styles.commentCard}>
                      <Pressable
                        onPress={comment.author.id
                          ? comment.author.id === user?.id
                            ? () => router.push('/(tabs)/profile' as any)
                            : () => router.push(`/profile/${comment.author.id}` as any)
                          : undefined}
                        disabled={!comment.author.id}
                      >
                        <Text style={styles.commentAuthor}>
                          {formatCreatorName(comment.author.displayName)}
                        </Text>
                      </Pressable>
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

          {/* 6. Mark as actually tried */}
          <Pressable
            style={[
              styles.triedBtn,
              engagement.completedByMe && styles.triedBtnDone,
              isCompletePending && styles.dimmed,
            ]}
            onPress={() => void handleToggleCompletion()}
            disabled={isCompletePending}
          >
            <Ionicons
              name={
                engagement.completedByMe
                  ? "checkmark-done-circle"
                  : "checkmark-circle-outline"
              }
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.triedBtnText}>
              {isCompletePending
                ? "…"
                : engagement.completedByMe
                  ? "Marked as actually tried"
                  : "Mark as actually tried"}
            </Text>
          </Pressable>

          {/* Feedback signals — shown after marking as tried */}
          {engagement.completedByMe &&
            tripDetail.feedback.availableSignals.length > 0 && (
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackTitle}>How did it go?</Text>
                <View style={styles.feedbackChips}>
                  {tripDetail.feedback.availableSignals.map((signal) => {
                    const isOn = selectedFeedbackSignals.includes(signal.key);
                    return (
                      <Pressable
                        key={signal.key}
                        style={[
                          styles.feedbackChip,
                          isOn && styles.feedbackChipOn,
                        ]}
                        onPress={() => handleToggleFeedbackSignal(signal.key)}
                      >
                        <Text
                          style={[
                            styles.feedbackChipText,
                            isOn && styles.feedbackChipTextOn,
                          ]}
                        >
                          {signal.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.feedbackActions}>
                  <Pressable
                    style={styles.feedbackClearBtn}
                    onPress={handleClearFeedbackSelection}
                    disabled={isFeedbackPending}
                  >
                    <Text style={styles.feedbackClearText}>Clear</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.feedbackSaveBtn,
                      (isFeedbackPending || !hasFeedbackChanges) &&
                        styles.dimmed,
                    ]}
                    onPress={() => void handleSaveFeedback()}
                    disabled={isFeedbackPending || !hasFeedbackChanges}
                  >
                    <Text style={styles.feedbackSaveText}>
                      {isFeedbackPending ? "Saving…" : "Save feedback"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

          {/* 8. Remix */}
          <Pressable
            style={[styles.remixBtn, isRemixPending && styles.dimmed]}
            onPress={() => void handleRemixTrip()}
            disabled={isRemixPending}
          >
            <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
            <Text style={styles.remixBtnText}>
              {isRemixPending ? "Creating draft…" : "Remix this trip"}
            </Text>
          </Pressable>
        </View>

        {/* Trip Description */}
        {tripDetail.trip.description?.trim() ? (
          <View style={styles.content}>
            <TripDescriptionSection description={tripDetail.trip.description} />
          </View>
        ) : null}

        {/* 9. Trip stop map — full-width, no horizontal padding */}
        <View style={styles.mapSection}>
          <TripStopsMap stops={tripDetail.stops} />
        </View>

        {/* ── Content block 2 ─────────────────────────────────────────────── */}
        <View style={styles.content}>
          {/* 10. Timeline */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>ITINERARY</Text>
            <Text style={styles.sectionTitle}>Trip stops</Text>
          </View>

          {sortedStops.length > 0 ? (
            <View>
              {sortedStops.map((stop, index) => (
                <NewTimelineItem
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

          {/* 11. Why people like this trip */}
          {tripDetail.socialRationale?.items.length ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Why people like this trip
                </Text>
              </View>
              <View style={styles.card}>
                {tripDetail.socialRationale.items.map((item) => (
                  <View key={item.key} style={styles.rationaleRow}>
                    <View style={styles.rationaleIcon}>
                      <Ionicons
                        name="sparkles-outline"
                        size={14}
                        color="#006A69"
                      />
                    </View>
                    <View style={styles.rationaleBody}>
                      <Text style={styles.rationaleTitle}>{item.title}</Text>
                      <Text style={styles.rationaleEvidence}>
                        {item.evidence}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* 12. Why this route works */}
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

      {/* Comments modal */}
      <CommentsModal
        visible={commentsModalOpen}
        onClose={() => setCommentsModalOpen(false)}
        comments={comments}
        commentCount={engagement.commentCount}
        tripId={tripIdStr}
        token={token}
        currentUserId={user?.id ?? null}
        onCommentCreated={(newComments, newEngagement) => {
          setComments(newComments);
          setEngagement(newEngagement);
        }}
        onAuthorPress={(authorId) => {
          setCommentsModalOpen(false);
          if (authorId === user?.id) {
            router.push('/(tabs)/profile' as any);
          } else {
            router.push(`/profile/${authorId}` as any);
          }
        }}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // Edit Trip strip — owner only
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
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    height: 50,
  },
  editBtnText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  // Content sections (horizontal padding + gap between children)
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },

  // Map section — padded strip
  mapSection: {
    marginTop: 24,
    marginBottom: 4,
    marginHorizontal: 16,
  },

  // Loading / error states
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

  // Action error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#9A3412",
  },

  // Metrics grid
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
  },
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

  // Social bar
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

  // Mark as tried
  triedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    height: 52,
  },
  triedBtnDone: {
    backgroundColor: "#10B981",
  },
  triedBtnText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  // Feedback section
  feedbackSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 16,
    gap: 12,
  },
  feedbackTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  feedbackChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feedbackChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    backgroundColor: "#F8FAFC",
  },
  feedbackChipOn: {
    borderColor: theme.colors.primary,
    backgroundColor: "#DFF7F6",
  },
  feedbackChipText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  feedbackChipTextOn: { color: "#006A69" },
  feedbackActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: -4,
  },
  feedbackClearBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  feedbackClearText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  feedbackSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#006A69",
    alignItems: "center",
  },
  feedbackSaveText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Recent comments card
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
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  commentAvatarText: {
    fontFamily: font.bold,
    fontSize: 11,
    color: "#FFFFFF",
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

  // Remix button
  remixBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    height: 52,
  },
  remixBtnText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  // Section headers
  sectionHeader: {
    gap: 2,
    marginTop: 4,
  },
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

  // Generic card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 16,
    gap: 12,
  },

  // Social rationale
  rationaleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rationaleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DFF7F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  rationaleBody: { flex: 1, gap: 2 },
  rationaleTitle: {
    fontFamily: font.bold,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },
  rationaleEvidence: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },

  // Route explanation
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

  // Shared buttons
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
  dimmed: { opacity: 0.55 },
});
