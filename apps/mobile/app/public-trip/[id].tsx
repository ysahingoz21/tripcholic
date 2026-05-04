import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import {
  getSortedTripStops,
  getTripStopLabel,
} from '@/components/trip/tripMapUtils';
import TimelineItem from '@/components/ui/TimelineItem';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
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
} from '@/services/publicTrips';
import { followUser, unfollowUser } from '@/services/users';
import TripStopsMap from '../../components/trip/TripStopsMap';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCreatorName(displayName: string | null) {
  return displayName?.trim() || 'Tripcholic traveler';
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatCommentTimestamp(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isNotFoundErrorMessage(message: string) {
  return message.toLowerCase().includes('not found');
}

function buildRouteSummary(detail: PublicTripDetailResponse) {
  const { optimization } = detail;
  return `${optimization.stopCount} stops • ${
    optimization.routeTotalDurationMin !== null
      ? `${optimization.routeTotalDurationMin} min`
      : 'duration N/A'
  } • ${
    optimization.routeTotalCostTl !== null
      ? `${optimization.routeTotalCostTl} TL`
      : 'cost N/A'
  }`;
}

function buildPreferenceSummary(detail: PublicTripDetailResponse) {
  const { trip } = detail;
  return `Categories: ${trip.categories.join(', ') || 'None'} • Weather: ${
    trip.weather ?? 'Not set'
  } • Budget: ${trip.budgetTl !== null ? `${trip.budgetTl} TL` : 'Not set'}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroCard({
  detail,
  onBack,
}: {
  detail: PublicTripDetailResponse;
  onBack: () => void;
}) {
  const imageUrl = detail.preview.imageUrl?.trim() || null;
  const category = detail.preview.primaryCategory
    ? detail.preview.primaryCategory.charAt(0).toUpperCase() +
      detail.preview.primaryCategory.slice(1)
    : null;

  return (
    <View style={heroStyles.card}>
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

      {/* Top overlay row: back button left, badges right */}
      <View style={heroStyles.topRow}>
        <Pressable style={heroStyles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={heroStyles.topBadges}>
          {category && (
            <View style={heroStyles.categoryChip}>
              <Text style={heroStyles.categoryText}>{category}</Text>
            </View>
          )}
          <View style={heroStyles.publicBadge}>
            <Ionicons name="globe-outline" size={10} color="#166534" />
            <Text style={heroStyles.publicBadgeText}>Public</Text>
          </View>
        </View>
      </View>

      {/* Bottom content */}
      <View style={heroStyles.bottomContent}>
        <Text style={heroStyles.title} numberOfLines={3}>
          {detail.trip.title}
        </Text>
        <Text style={heroStyles.dateText}>
          {formatDateLabel(detail.trip.date)}
        </Text>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    aspectRatio: 3 / 2,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#DFF7F6',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    backgroundColor: 'rgba(11,36,48,0.82)',
  },
  topRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    backgroundColor: 'rgba(223,247,246,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00504F',
    letterSpacing: 0.3,
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F7EE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  publicBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function PublicTripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const [tripDetail, setTripDetail] = useState<PublicTripDetailResponse | null>(null);
  const [comments, setComments] = useState<PublicTripComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [engagement, setEngagement] = useState<PublicTripEngagement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLikePending, setIsLikePending] = useState(false);
  const [isSavePending, setIsSavePending] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [isCompletePending, setIsCompletePending] = useState(false);
  const [selectedFeedbackSignals, setSelectedFeedbackSignals] = useState<string[]>([]);
  const [isFeedbackPending, setIsFeedbackPending] = useState(false);
  const [isRemixPending, setIsRemixPending] = useState(false);
  const [isCommentPending, setIsCommentPending] = useState(false);

  const loadPublicTrip = useCallback(async () => {
    if (isAuthLoading) return;

    if (!token) {
      setScreenError('Authentication required. Please sign in again.');
      setIsLoading(false);
      return;
    }

    if (!id || typeof id !== 'string') {
      setScreenError('Missing public trip id.');
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
          : 'Unable to load public trip.'
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
    [tripDetail?.stops]
  );
  const creatorId = tripDetail?.creator.id ?? null;
  const isOwnCreatorTrip = creatorId !== null && creatorId === user?.id;
  const canToggleFollow = Boolean(token && creatorId && !isOwnCreatorTrip);

  const handleToggleFollow = async () => {
    if (!token || !tripDetail || !creatorId || isOwnCreatorTrip || isFollowPending) return;

    try {
      setIsFollowPending(true);
      const response = tripDetail.creator.isFollowedByMe
        ? await unfollowUser(creatorId, token)
        : await followUser(creatorId, token);
      setTripDetail((current) =>
        current
          ? { ...current, creator: { ...current.creator, ...response.creator } }
          : current
      );
      setActionError(null);
    } catch (followError) {
      setActionError(
        followError instanceof Error
          ? followError.message
          : 'Unable to update follow state.'
      );
    } finally {
      setIsFollowPending(false);
    }
  };

  const handleToggleLike = async () => {
    if (!token || !id || typeof id !== 'string' || !engagement || isLikePending) return;

    try {
      setIsLikePending(true);
      const response = engagement.likedByMe
        ? await unlikePublicTrip(id, token)
        : await likePublicTrip(id, token);
      setEngagement(response.engagement);
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update like.'
      );
    } finally {
      setIsLikePending(false);
    }
  };

  const handleToggleSave = async () => {
    if (!token || !id || typeof id !== 'string' || !engagement || isSavePending) return;

    try {
      setIsSavePending(true);
      const response = engagement.savedByMe
        ? await unsavePublicTrip(id, token)
        : await savePublicTrip(id, token);
      setEngagement(response.engagement);
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update saved state.'
      );
    } finally {
      setIsSavePending(false);
    }
  };

  const handleToggleCompletion = async () => {
    if (!token || !id || typeof id !== 'string' || !engagement || isCompletePending) return;

    try {
      setIsCompletePending(true);
      engagement.completedByMe
        ? await uncompletePublicTrip(id, token)
        : await completePublicTrip(id, token);
      const refreshedDetail = await getPublicTrip(id, token);
      setTripDetail(refreshedDetail);
      setComments(refreshedDetail.comments);
      setEngagement(refreshedDetail.engagement);
      setSelectedFeedbackSignals(refreshedDetail.feedback.mine);
      setActionError(null);
    } catch (completionError) {
      const message =
        completionError instanceof Error
          ? completionError.message
          : 'Unable to update completion state.';

      if (isNotFoundErrorMessage(message)) {
        setTripDetail(null);
        setComments([]);
        setEngagement(null);
        setSelectedFeedbackSignals([]);
        setScreenError(
          'This public trip is no longer available for completion.'
        );
        setActionError(null);
      } else {
        setActionError(message);
      }
    } finally {
      setIsCompletePending(false);
    }
  };

  const handleToggleFeedbackSignal = (signalKey: string) => {
    setSelectedFeedbackSignals((current) =>
      current.includes(signalKey)
        ? current.filter((s) => s !== signalKey)
        : [...current, signalKey]
    );
  };

  const handleSaveFeedback = async () => {
    if (
      !token ||
      !id ||
      typeof id !== 'string' ||
      !tripDetail ||
      !engagement?.completedByMe ||
      isFeedbackPending
    ) return;

    try {
      setIsFeedbackPending(true);
      const response = await updatePublicTripFeedback(id, token, selectedFeedbackSignals);
      setTripDetail((current) =>
        current ? { ...current, feedback: response.feedback } : current
      );
      setSelectedFeedbackSignals(response.feedback.mine);
      setActionError(null);
    } catch (feedbackError) {
      const message =
        feedbackError instanceof Error
          ? feedbackError.message
          : 'Unable to update structured feedback.';

      if (isNotFoundErrorMessage(message)) {
        setTripDetail(null);
        setComments([]);
        setEngagement(null);
        setSelectedFeedbackSignals([]);
        setScreenError('This public trip is no longer available.');
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

  const hasFeedbackChanges =
    tripDetail !== null &&
    selectedFeedbackSignals.length === tripDetail.feedback.mine.length &&
    selectedFeedbackSignals.every((s) => tripDetail.feedback.mine.includes(s))
      ? false
      : true;

  const handleCreateComment = async () => {
    if (!token || !id || typeof id !== 'string' || isCommentPending) return;

    const trimmedBody = commentInput.trim();
    if (!trimmedBody) {
      setActionError('Comment body cannot be empty.');
      return;
    }

    try {
      setIsCommentPending(true);
      setActionError(null);
      await createPublicTripComment(id, token, trimmedBody);
      const commentsResponse = await getPublicTripComments(id, token);
      setComments(commentsResponse.items);
      setEngagement(commentsResponse.engagement);
      setCommentInput('');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to post comment.'
      );
    } finally {
      setIsCommentPending(false);
    }
  };

  const handleRemixTrip = async () => {
    if (!token || !id || typeof id !== 'string' || isRemixPending) return;

    try {
      setIsRemixPending(true);
      setActionError(null);
      const response = await remixPublicTrip(id, token);
      router.push({
        pathname: '/trip/[id]/edit',
        params: { id: response.tripId, remix: '1' },
      });
    } catch (remixError) {
      setActionError(
        remixError instanceof Error
          ? remixError.message
          : 'Unable to remix this public trip.'
      );
    } finally {
      setIsRemixPending(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading trip…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (screenError || !tripDetail || !engagement) {
    const isUnavailable = screenError?.toLowerCase().includes('not found') ?? false;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>
            {isUnavailable ? 'Trip Unavailable' : "Couldn't load trip"}
          </Text>
          <Text style={styles.stateText}>
            {screenError ?? 'This public trip could not be loaded.'}
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/explore')}
          >
            <Text style={styles.primaryButtonText}>Back to Explore</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero (full-bleed, no horizontal margin, back button overlaid) ── */}
        <HeroCard detail={tripDetail} onBack={() => router.back()} />

        {/* ── Content area (16px horizontal padding) ── */}
        <View style={styles.contentArea}>

          {/* ── Action error ── */}
          {actionError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={14} color="#9A3412" />
              <Text style={styles.errorBannerText}>{actionError}</Text>
            </View>
          ) : null}

          {/* ── Creator card ── */}
          <View style={styles.creatorCard}>
            {/* CREATOR eyebrow label */}
            <Text style={styles.creatorEyebrow}>CREATOR</Text>
            <View style={styles.creatorDivider} />

            <View style={styles.creatorCardRow}>
              {/* Avatar */}
              <View style={styles.creatorAvatar}>
                <Ionicons name="person-outline" size={24} color="#0B3B4A" />
              </View>

              {/* Name + meta */}
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>
                  {formatCreatorName(tripDetail.creator.displayName)}
                </Text>
                <Text style={styles.creatorMeta}>
                  {formatCount(
                    tripDetail.creator.followerCount,
                    'follower',
                    'followers'
                  )}
                  {isOwnCreatorTrip ? ' · Your trip' : ''}
                </Text>
              </View>

              {/* Follow pill */}
              {canToggleFollow ? (
                <Pressable
                  style={[
                    styles.followPill,
                    tripDetail.creator.isFollowedByMe && styles.followPillActive,
                    isFollowPending && styles.disabledOp,
                  ]}
                  onPress={() => void handleToggleFollow()}
                  disabled={isFollowPending}
                >
                  <Text
                    style={[
                      styles.followPillText,
                      tripDetail.creator.isFollowedByMe && styles.followPillTextActive,
                    ]}
                  >
                    {isFollowPending
                      ? '…'
                      : tripDetail.creator.isFollowedByMe
                        ? 'Following'
                        : 'Follow'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* ── Engagement pills row ── */}
          <View style={styles.engagementBar}>
            {/* Like */}
            <Pressable
              style={[styles.engagementPill, isLikePending && styles.disabledOp]}
              onPress={() => void handleToggleLike()}
              disabled={isLikePending}
            >
              <Ionicons
                name={engagement.likedByMe ? 'heart' : 'heart-outline'}
                size={18}
                color={engagement.likedByMe ? '#EF4444' : '#64748B'}
              />
              <Text
                style={[
                  styles.engagementCount,
                  engagement.likedByMe && styles.engagementCountLiked,
                ]}
              >
                {engagement.likeCount}
              </Text>
            </Pressable>

            <View style={styles.engagementSep} />

            {/* Comments */}
            <View style={styles.engagementPill}>
              <Ionicons name="chatbubble-outline" size={18} color="#64748B" />
              <Text style={styles.engagementCount}>{engagement.commentCount}</Text>
            </View>

            <View style={styles.engagementSep} />

            {/* Save */}
            <Pressable
              style={[styles.engagementPill, isSavePending && styles.disabledOp]}
              onPress={() => void handleToggleSave()}
              disabled={isSavePending}
            >
              <Ionicons
                name={engagement.savedByMe ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={engagement.savedByMe ? '#006A69' : '#64748B'}
              />
              <Text
                style={[
                  styles.engagementCount,
                  engagement.savedByMe && styles.engagementCountSaved,
                ]}
              >
                {engagement.saveCount}
              </Text>
            </Pressable>

            <View style={styles.engagementSep} />

            {/* Tried */}
            <View style={styles.engagementPill}>
              <Ionicons name="footsteps-outline" size={18} color="#64748B" />
              <Text style={styles.engagementCount}>{engagement.completionCount}</Text>
            </View>
          </View>

          {/* ── Stats grid ── */}
          <View style={styles.statsGrid}>
            {[
              {
                icon: 'location-outline' as const,
                label: 'Stops',
                value: String(tripDetail.optimization.stopCount),
              },
              {
                icon: 'time-outline' as const,
                label: 'Duration',
                value:
                  tripDetail.optimization.routeTotalDurationMin !== null
                    ? `${tripDetail.optimization.routeTotalDurationMin} min`
                    : '—',
              },
              {
                icon: 'cash-outline' as const,
                label: 'Est. Cost',
                value:
                  tripDetail.optimization.routeTotalCostTl !== null
                    ? `${tripDetail.optimization.routeTotalCostTl} TL`
                    : '—',
              },
              {
                icon: 'walk-outline' as const,
                label: 'Distance',
                value:
                  tripDetail.optimization.routeTotalDistanceKm !== null
                    ? `${tripDetail.optimization.routeTotalDistanceKm} km`
                    : '—',
              },
            ].map(({ icon, label, value }) => (
              <View key={label} style={styles.statGridCell}>
                <View style={styles.statIconCircle}>
                  <Ionicons name={icon} size={16} color={theme.colors.primary} />
                </View>
                <Text style={styles.statGridValue}>{value}</Text>
                <Text style={styles.statGridLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* ── Remix CTA (below stats) ── */}
          <Pressable
            style={[styles.remixButton, isRemixPending && styles.disabledOp]}
            onPress={() => void handleRemixTrip()}
            disabled={isRemixPending}
          >
            <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
            <Text style={styles.remixButtonText}>
              {isRemixPending ? 'Creating Draft…' : 'Remix This Trip'}
            </Text>
          </Pressable>

          {/* ── Social rationale ── */}
          {tripDetail.socialRationale?.items.length ? (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Why people like this trip</Text>
              <Text style={styles.cardSub}>
                Real signals from travelers who reacted to this route.
              </Text>
              <View style={styles.rationaleList}>
                {tripDetail.socialRationale.items.map((item) => (
                  <View key={item.key} style={styles.rationaleRow}>
                    <View style={styles.rationaleIcon}>
                      <Ionicons name="sparkles-outline" size={14} color="#006A69" />
                    </View>
                    <View style={styles.rationaleText}>
                      <Text style={styles.rationaleTitle}>{item.title}</Text>
                      <Text style={styles.rationaleEvidence}>{item.evidence}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── Tried it ── */}
          <View style={[styles.card, styles.cardAmber]}>
            <View style={styles.completionRow}>
              <View style={styles.completionIcon}>
                <Ionicons
                  name={
                    engagement.completedByMe
                      ? 'checkmark-done'
                      : 'footsteps-outline'
                  }
                  size={18}
                  color="#92400E"
                />
              </View>
              <View style={styles.completionText}>
                <Text style={styles.completionTitle}>Actually Tried This Route?</Text>
                <Text style={styles.completionBody}>
                  Mark this when you have genuinely tried it in real life.
                </Text>
              </View>
            </View>

            <View style={styles.completionStats}>
              <Text style={styles.completionCount}>{engagement.completionCount}</Text>
              <Text style={styles.completionCountLabel}>
                {engagement.completionCount === 1
                  ? 'person marked it tried'
                  : 'people marked it tried'}
              </Text>
            </View>

            <Text style={styles.completionState}>
              {engagement.completedByMe
                ? 'You have marked this trip as tried.'
                : 'You have not marked this trip as tried yet.'}
            </Text>

            <Pressable
              style={[styles.amberButton, isCompletePending && styles.disabledOp]}
              onPress={() => void handleToggleCompletion()}
              disabled={isCompletePending}
            >
              <Text style={styles.amberButtonText}>
                {isCompletePending
                  ? engagement.completedByMe
                    ? 'Updating…'
                    : 'Marking…'
                  : engagement.completedByMe
                    ? 'Unmark Tried'
                    : 'Mark as Tried'}
              </Text>
            </Pressable>
          </View>

          {/* ── Feedback ── */}
          {engagement.completedByMe ? (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>How did it go?</Text>
              <Text style={styles.cardSub}>
                Pick signals that match your real-world experience.
              </Text>

              <View style={styles.feedbackChips}>
                {tripDetail.feedback.availableSignals.map((signal) => {
                  const isSelected = selectedFeedbackSignals.includes(signal.key);
                  return (
                    <Pressable
                      key={signal.key}
                      onPress={() => handleToggleFeedbackSignal(signal.key)}
                      style={[
                        styles.feedbackChip,
                        isSelected && styles.feedbackChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.feedbackChipText,
                          isSelected && styles.feedbackChipTextSelected,
                        ]}
                      >
                        {signal.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.feedbackHint}>
                Leave unchecked if no signals apply.
              </Text>

              <View style={styles.feedbackActions}>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    styles.feedbackClearBtn,
                    isFeedbackPending && styles.disabledOp,
                  ]}
                  onPress={handleClearFeedbackSelection}
                  disabled={isFeedbackPending}
                >
                  <Text style={styles.secondaryButtonText}>Clear</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryButton,
                    styles.feedbackSaveBtn,
                    (isFeedbackPending || !hasFeedbackChanges) && styles.disabledOp,
                  ]}
                  onPress={() => void handleSaveFeedback()}
                  disabled={isFeedbackPending || !hasFeedbackChanges}
                >
                  <Text style={styles.primaryButtonText}>
                    {isFeedbackPending ? 'Saving…' : 'Save Feedback'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* ── Route explanation ── */}
          {tripDetail.optimization.routeExplanation ? (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="sparkles-outline" size={14} color="#0B3B4A" />
                <Text style={styles.cardSectionTitle}>Why this route works</Text>
              </View>
              <Text style={styles.cardBodyText}>
                {tripDetail.optimization.routeExplanation}
              </Text>
            </View>
          ) : null}

          {/* ── Map ── */}
          <TripStopsMap stops={tripDetail.stops} />

          {/* ── Itinerary section ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionEyebrow}>ITINERARY</Text>
            <Text style={styles.sectionTitle}>Ordered Stops</Text>
            <Text style={styles.sectionSub}>Follow this route in order</Text>
          </View>

          {sortedStops.length > 0 ? (
            sortedStops.map((stop) => (
              <TimelineItem
                key={stop.id}
                time={stop.arrivalTime}
                title={getTripStopLabel(stop)}
                subtitle={`${stop.poi.category} • ${stop.poi.district ?? 'district N/A'} • ${stop.estimatedCostTl} TL`}
                icon="location"
                imageUrl={stop.poi.imageUrl}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No persisted stops available for this public trip yet.
              </Text>
            </View>
          )}

          {/* ── Discussion section ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionEyebrow}>DISCUSSION</Text>
            <Text style={styles.sectionTitle}>Comments</Text>
            <Text style={styles.sectionSub}>Discussion on this public trip</Text>
          </View>

          {/* Comment composer */}
          <View style={styles.card}>
            <Text style={styles.commentComposerLabel}>Add a comment</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="What stands out about this route?"
              placeholderTextColor={theme.colors.textSecondary}
              value={commentInput}
              onChangeText={setCommentInput}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.postButton, isCommentPending && styles.disabledOp]}
              onPress={() => void handleCreateComment()}
              disabled={isCommentPending}
            >
              <Text style={styles.primaryButtonText}>
                {isCommentPending ? 'Posting…' : 'Post Comment'}
              </Text>
            </Pressable>
          </View>

          {/* Comment list */}
          {comments.length > 0 ? (
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>
                      {formatCreatorName(comment.author.displayName)}
                    </Text>
                    <Text style={styles.commentDate}>
                      {formatCommentTimestamp(comment.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.commentBody}>{comment.body}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptyText}>
                Be the first to react to this public trip.
              </Text>
            </View>
          )}

          {/* ── Back to Explore ── */}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)/explore')}
          >
            <Text style={styles.secondaryButtonText}>Back to Explore</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },

  // Scroll
  scrollContent: {
    paddingBottom: 48,
  },

  // Content area (everything below hero gets horizontal padding)
  contentArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },

  // States
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
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

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#9A3412',
  },

  // Creator card
  creatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  creatorEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  creatorDivider: {
    height: 1,
    backgroundColor: '#DFF7F6',
    marginTop: -4,
  },
  creatorCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creatorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  creatorInfo: {
    flex: 1,
    gap: 3,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111C2C',
  },
  creatorMeta: {
    fontSize: 13,
    color: '#64748B',
  },

  // Follow pill
  followPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#0EA5A4',
    backgroundColor: 'transparent',
  },
  followPillActive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  followPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5A4',
  },
  followPillTextActive: {
    color: '#64748B',
  },

  // Engagement pills
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
  },
  engagementPill: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  engagementSep: {
    width: 1,
    height: 32,
    backgroundColor: '#E8ECF0',
  },
  engagementCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  engagementCountLiked: {
    color: '#EF4444',
  },
  engagementCountSaved: {
    color: '#006A69',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statGridCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGridValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111C2C',
    textAlign: 'center',
  },
  statGridLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },

  // Remix CTA button
  remixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#006A69',
    borderRadius: 16,
    height: 52,
  },
  remixButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Generic card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 16,
    gap: 12,
  },
  cardAmber: {
    backgroundColor: '#FFF8EB',
    borderColor: '#F2D39A',
  },
  cardTeal: {
    backgroundColor: '#F4FBFB',
    borderColor: '#BFEAE9',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: -4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardBodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },

  // Rationale
  rationaleList: {
    gap: 12,
  },
  rationaleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rationaleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  rationaleText: { flex: 1 },
  rationaleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111C2C',
    marginBottom: 2,
  },
  rationaleEvidence: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },

  // Completion
  completionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  completionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF1D8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  completionText: { flex: 1 },
  completionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111C2C',
    marginBottom: 3,
  },
  completionBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },
  completionStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  completionCount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#92400E',
  },
  completionCountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  completionState: {
    fontSize: 13,
    color: '#7C5A20',
    lineHeight: 19,
  },
  amberButton: {
    backgroundColor: '#92400E',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  amberButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Feedback
  feedbackChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feedbackChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    backgroundColor: '#F8FAFC',
  },
  feedbackChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#DFF7F6',
  },
  feedbackChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  feedbackChipTextSelected: {
    color: '#006A69',
    fontWeight: '700',
  },
  feedbackHint: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: -4,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 10,
  },
  feedbackClearBtn: {
    paddingHorizontal: 20,
    flex: 0,
  },
  feedbackSaveBtn: {
    flex: 1,
  },

  // Section headings
  sectionRow: {
    gap: 2,
    marginTop: 4,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0EA5A4',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  // Comments
  commentsList: {
    gap: 10,
  },
  commentCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 14,
    gap: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111C2C',
  },
  commentDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
  },
  commentComposerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111C2C',
  },
  commentInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111C2C',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A69',
    borderRadius: 12,
    paddingVertical: 13,
    width: '100%',
  },

  // Empty
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 20,
    gap: 6,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111C2C',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A69',
    borderRadius: 12,
    paddingVertical: 13,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B3B4A',
  },
  disabledOp: {
    opacity: 0.55,
  },
});
