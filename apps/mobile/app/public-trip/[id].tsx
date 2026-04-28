import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSortedTripStops } from '@/components/trip/tripMapUtils';
import TripPreviewCard from '@/components/trip/TripPreviewCard';
import AppButton from '@/components/ui/AppButton';
import InfoCard from '@/components/ui/InfoCard';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
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

function formatCreatorName(displayName: string | null) {
  return displayName?.trim() || 'Tripcholic traveler';
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString();
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

type EngagementActionButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function EngagementActionButton({
  icon,
  label,
  active = false,
  disabled = false,
  onPress,
}: EngagementActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        active && styles.actionButtonActive,
        disabled && styles.actionButtonDisabled,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? theme.colors.primaryDark : theme.colors.textSecondary}
      />
      <Text
        style={[
          styles.actionButtonText,
          active && styles.actionButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
    if (isAuthLoading) {
      return;
    }

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
    if (!token || !tripDetail || !creatorId || isOwnCreatorTrip || isFollowPending) {
      return;
    }

    try {
      setIsFollowPending(true);
      const response = tripDetail.creator.isFollowedByMe
        ? await unfollowUser(creatorId, token)
        : await followUser(creatorId, token);
      setTripDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              creator: {
                ...currentDetail.creator,
                ...response.creator,
              },
            }
          : currentDetail
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
    if (!token || !id || typeof id !== 'string' || !engagement || isLikePending) {
      return;
    }

    try {
      setIsLikePending(true);
      const response = engagement.likedByMe
        ? await unlikePublicTrip(id, token)
        : await likePublicTrip(id, token);
      setEngagement(response.engagement);
      setActionError(null);
    } catch (actionError) {
      setActionError(
        actionError instanceof Error
          ? actionError.message
          : 'Unable to update like.'
      );
    } finally {
      setIsLikePending(false);
    }
  };

  const handleToggleSave = async () => {
    if (!token || !id || typeof id !== 'string' || !engagement || isSavePending) {
      return;
    }

    try {
      setIsSavePending(true);
      const response = engagement.savedByMe
        ? await unsavePublicTrip(id, token)
        : await savePublicTrip(id, token);
      setEngagement(response.engagement);
      setActionError(null);
    } catch (actionError) {
      setActionError(
        actionError instanceof Error
          ? actionError.message
          : 'Unable to update saved state.'
      );
    } finally {
      setIsSavePending(false);
    }
  };

  const handleToggleCompletion = async () => {
    if (
      !token ||
      !id ||
      typeof id !== 'string' ||
      !engagement ||
      isCompletePending
    ) {
      return;
    }

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
          'This public trip is no longer available for completion because it is no longer public or optimized.'
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
    setSelectedFeedbackSignals((currentSignals) =>
      currentSignals.includes(signalKey)
        ? currentSignals.filter((currentSignal) => currentSignal !== signalKey)
        : [...currentSignals, signalKey]
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
    ) {
      return;
    }

    try {
      setIsFeedbackPending(true);
      const response = await updatePublicTripFeedback(
        id,
        token,
        selectedFeedbackSignals
      );
      setTripDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              feedback: response.feedback,
            }
          : currentDetail
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
    selectedFeedbackSignals.every((signal) => tripDetail.feedback.mine.includes(signal))
      ? false
      : true;

  const handleCreateComment = async () => {
    if (!token || !id || typeof id !== 'string' || isCommentPending) {
      return;
    }

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
    } catch (actionError) {
      setActionError(
        actionError instanceof Error
          ? actionError.message
          : 'Unable to post comment.'
      );
    } finally {
      setIsCommentPending(false);
    }
  };

  const handleRemixTrip = async () => {
    if (!token || !id || typeof id !== 'string' || isRemixPending) {
      return;
    }

    try {
      setIsRemixPending(true);
      setActionError(null);
      const response = await remixPublicTrip(id, token);
      router.push({
        pathname: '/trip/[id]/edit',
        params: {
          id: response.tripId,
          remix: '1',
        },
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

  if (isLoading || isAuthLoading) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="Loading Public Trip"
          subtitle="Fetching the shared trip post and its engagement state."
        />
      </ScreenContainer>
    );
  }

  if (screenError || !tripDetail || !engagement) {
    const isUnavailable = screenError?.toLowerCase().includes('not found') ?? false;

    return (
      <ScreenContainer>
        <SectionTitle
          title={isUnavailable ? 'Public Trip Unavailable' : 'Trip Unavailable'}
          subtitle={
            screenError ??
            'This public trip could not be loaded.'
          }
        />
        <AppButton
          title="Back to Explore"
          onPress={() => router.replace('/(tabs)/explore')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title={tripDetail.trip.title}
          subtitle="A shared public route from the Explore surface."
        />

        <TripPreviewCard
          preview={tripDetail.preview}
          dateLabel={formatDateLabel(tripDetail.trip.date)}
          variant="hero"
          rightContent={
            <View style={styles.publicBadge}>
              <Ionicons name="globe-outline" size={14} color="#166534" />
              <Text style={styles.publicBadgeText}>Public</Text>
            </View>
          }
        />

        <View style={styles.creatorCard}>
          <View style={styles.creatorHeaderRow}>
            <View style={styles.creatorRow}>
              <View style={styles.creatorAvatar}>
                <Ionicons name="person-outline" size={18} color={theme.colors.primaryDark} />
              </View>
              <View style={styles.creatorTextWrap}>
                <Text style={styles.creatorLabel}>Creator</Text>
                <Text style={styles.creatorName}>
                  {formatCreatorName(tripDetail.creator.displayName)}
                </Text>
                <Text style={styles.creatorMeta}>
                  {formatCount(
                    tripDetail.creator.followerCount,
                    'follower',
                    'followers'
                  )}
                </Text>
              </View>
            </View>
            {canToggleFollow ? (
              <Pressable
                onPress={() => void handleToggleFollow()}
                disabled={isFollowPending}
                style={[
                  styles.followButton,
                  tripDetail.creator.isFollowedByMe && styles.followButtonActive,
                  isFollowPending && styles.actionButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    tripDetail.creator.isFollowedByMe && styles.followButtonTextActive,
                  ]}
                >
                  {isFollowPending
                    ? tripDetail.creator.isFollowedByMe
                      ? 'Updating...'
                      : 'Following...'
                    : tripDetail.creator.isFollowedByMe
                      ? 'Following'
                      : 'Follow'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.creatorSubtext}>
            {creatorId
              ? isOwnCreatorTrip
                ? 'This is your own public optimized trip post.'
                : 'Shared as a public optimized trip post.'
              : 'Creator details are unavailable for this public trip.'}
          </Text>
        </View>

        <View style={styles.engagementCard}>
          <Text style={styles.engagementTitle}>Trip engagement</Text>
          {actionError ? (
            <View style={styles.actionErrorBanner}>
              <Text style={styles.actionErrorText}>{actionError}</Text>
            </View>
          ) : null}
          <View style={styles.engagementSummaryRow}>
            <View style={styles.engagementPill}>
              <Text style={styles.engagementPillValue}>{engagement.likeCount}</Text>
              <Text style={styles.engagementPillLabel}>Likes</Text>
            </View>
            <View style={styles.engagementPill}>
              <Text style={styles.engagementPillValue}>{engagement.commentCount}</Text>
              <Text style={styles.engagementPillLabel}>Comments</Text>
            </View>
            <View style={styles.engagementPill}>
              <Text style={styles.engagementPillValue}>{engagement.saveCount}</Text>
              <Text style={styles.engagementPillLabel}>Saves</Text>
            </View>
            <View style={styles.engagementPill}>
              <Text style={styles.engagementPillValue}>
                {engagement.completionCount}
              </Text>
              <Text style={styles.engagementPillLabel}>Tried</Text>
            </View>
          </View>
          <View style={styles.engagementActionRow}>
            <EngagementActionButton
              icon={engagement.likedByMe ? 'heart' : 'heart-outline'}
              label={engagement.likedByMe ? 'Liked' : 'Like'}
              active={engagement.likedByMe}
              disabled={isLikePending}
              onPress={() => void handleToggleLike()}
            />
            <EngagementActionButton
              icon={engagement.savedByMe ? 'bookmark' : 'bookmark-outline'}
              label={engagement.savedByMe ? 'Saved' : 'Save'}
              active={engagement.savedByMe}
              disabled={isSavePending}
              onPress={() => void handleToggleSave()}
            />
          </View>
          <Text style={styles.engagementCaption}>
            {formatCount(engagement.likeCount, 'like', 'likes')} •{' '}
            {formatCount(engagement.commentCount, 'comment', 'comments')} •{' '}
            {formatCount(engagement.saveCount, 'save', 'saves')} •{' '}
            {formatCount(engagement.completionCount, 'person tried it', 'people tried it')}
          </Text>
        </View>

        {tripDetail.socialRationale?.items.length ? (
          <View style={styles.rationaleCard}>
            <Text style={styles.rationaleTitle}>Why people liked this trip</Text>
            <Text style={styles.rationaleSubtitle}>
              Real signals from travelers who reacted to or tried this route.
            </Text>
            <View style={styles.rationaleList}>
              {tripDetail.socialRationale.items.map((item) => (
                <View key={item.key} style={styles.rationaleRow}>
                  <View style={styles.rationaleIconWrap}>
                    <Ionicons
                      name="sparkles-outline"
                      size={16}
                      color={theme.colors.primaryDark}
                    />
                  </View>
                  <View style={styles.rationaleTextWrap}>
                    <Text style={styles.rationaleItemTitle}>{item.title}</Text>
                    <Text style={styles.rationaleEvidence}>{item.evidence}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.completionCard}>
          <View style={styles.completionHeaderRow}>
            <View style={styles.completionIconWrap}>
              <Ionicons
                name={engagement.completedByMe ? 'checkmark-done' : 'footsteps-outline'}
                size={18}
                color="#92400E"
              />
            </View>
            <View style={styles.completionTextWrap}>
              <Text style={styles.completionTitle}>Actually Tried This Route?</Text>
              <Text style={styles.completionText}>
                Mark this public trip when you have genuinely tried it in real life. This stays separate from likes and saves.
              </Text>
            </View>
          </View>
          <View style={styles.completionStatsRow}>
            <Text style={styles.completionCountValue}>
              {engagement.completionCount}
            </Text>
            <Text style={styles.completionCountLabel}>
              {engagement.completionCount === 1 ? 'person marked it tried' : 'people marked it tried'}
            </Text>
          </View>
          <Text style={styles.completionStateText}>
            {engagement.completedByMe
              ? 'You have marked this trip as tried.'
              : 'You have not marked this trip as tried yet.'}
          </Text>
          <AppButton
            title={
              isCompletePending
                ? engagement.completedByMe
                  ? 'Updating...'
                  : 'Marking as Tried...'
                : engagement.completedByMe
                  ? 'Unmark Tried'
                  : 'Mark as Tried'
            }
            onPress={() => void handleToggleCompletion()}
            disabled={isCompletePending}
          />
        </View>

        {engagement.completedByMe ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>How did it go?</Text>
            <Text style={styles.feedbackText}>
              Pick the signals that best match your real-world experience with this route.
            </Text>
            <View style={styles.feedbackChipsWrap}>
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
              Leave everything unchecked if none of these signals apply. Clearing all feedback keeps the trip marked as tried.
            </Text>
            <View style={styles.feedbackActionsRow}>
              <Pressable
                onPress={handleClearFeedbackSelection}
                disabled={isFeedbackPending}
                style={[
                  styles.feedbackSecondaryButton,
                  isFeedbackPending && styles.actionButtonDisabled,
                ]}
              >
                <Text style={styles.feedbackSecondaryButtonText}>Clear</Text>
              </Pressable>
              <View style={styles.feedbackPrimaryButtonWrap}>
                <AppButton
                  title={isFeedbackPending ? 'Saving...' : 'Save Feedback'}
                  onPress={() => void handleSaveFeedback()}
                  disabled={isFeedbackPending || !hasFeedbackChanges}
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.remixCard}>
          <View style={styles.remixHeaderRow}>
            <View style={styles.remixIconWrap}>
              <Ionicons name="copy-outline" size={18} color={theme.colors.primaryDark} />
            </View>
            <View style={styles.remixTextWrap}>
              <Text style={styles.remixTitle}>Remix This Trip</Text>
              <Text style={styles.remixText}>
                Create your own draft copy of this public route and continue editing it in your owner flow.
              </Text>
            </View>
          </View>
          <Text style={styles.remixHint}>
            The remixed trip becomes your private starting point in My Trips.
          </Text>
          <AppButton
            title={isRemixPending ? 'Creating Draft Copy...' : 'Remix Trip'}
            onPress={() => void handleRemixTrip()}
            disabled={isRemixPending}
          />
        </View>

        <InfoCard
          title="Route Summary"
          description={buildRouteSummary(tripDetail)}
        />
        <InfoCard
          title="Optimizer"
          description={tripDetail.optimization.routeAlgorithmUsed ?? 'Algorithm unavailable'}
        />
        <InfoCard
          title="Trip Preferences"
          description={buildPreferenceSummary(tripDetail)}
        />

        {tripDetail.optimization.routeExplanation ? (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>Why this route works</Text>
            <Text style={styles.explanationText}>
              {tripDetail.optimization.routeExplanation}
            </Text>
          </View>
        ) : null}

        <TripStopsMap stops={tripDetail.stops} />

        <SectionTitle
          title="Ordered Stops"
          subtitle="The stop sequence shared in this public trip."
        />

        {sortedStops.length > 0 ? (
          sortedStops.map((stop) => (
            <TimelineItem
              key={stop.id}
              time={stop.arrivalTime}
              title={stop.title}
              subtitle={`${stop.poi.category} • ${stop.poi.district ?? 'district N/A'} • ${stop.estimatedCostTl} TL`}
              icon="location"
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No persisted stops are available for this public trip yet.
            </Text>
          </View>
        )}

        <SectionTitle
          title="Comments"
          subtitle="Lightweight discussion on this public trip post."
        />

        <View style={styles.commentComposerCard}>
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
          <AppButton
            title={isCommentPending ? 'Posting...' : 'Post Comment'}
            onPress={() => void handleCreateComment()}
            disabled={isCommentPending}
          />
        </View>

        {comments.length > 0 ? (
          comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View>
                  <Text style={styles.commentAuthor}>
                    {formatCreatorName(comment.author.displayName)}
                  </Text>
                  <Text style={styles.commentDate}>
                    {formatCommentTimestamp(comment.createdAt)}
                  </Text>
                </View>
              </View>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No comments yet</Text>
            <Text style={styles.emptyText}>
              Be the first person to react to this public trip.
            </Text>
          </View>
        )}

        <View style={styles.bottomActions}>
          <AppButton
            title="Back to Explore"
            onPress={() => router.replace('/(tabs)/explore')}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 100,
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F7EE',
    borderColor: '#BBE7CA',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  publicBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  creatorCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  creatorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  creatorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  creatorTextWrap: {
    flex: 1,
  },
  creatorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  creatorMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  creatorSubtext: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  followButton: {
    minWidth: 96,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#E6FBFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonActive: {
    backgroundColor: '#F8FAFC',
    borderColor: theme.colors.border,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  followButtonTextActive: {
    color: theme.colors.text,
  },
  engagementCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  engagementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  actionErrorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  actionErrorText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#991B1B',
    fontWeight: '600',
  },
  engagementSummaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    flexWrap: 'wrap',
  },
  engagementPill: {
    flex: 1,
    minWidth: 72,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  engagementPillValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  engagementPillLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  engagementActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    gap: 8,
  },
  actionButtonActive: {
    backgroundColor: '#DFF7F6',
    borderColor: theme.colors.primary,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  actionButtonTextActive: {
    color: theme.colors.primaryDark,
  },
  engagementCaption: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  rationaleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  rationaleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  rationaleSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  rationaleList: {
    gap: theme.spacing.md,
  },
  rationaleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  rationaleIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E6FBFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rationaleTextWrap: {
    flex: 1,
  },
  rationaleItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  rationaleEvidence: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  completionCard: {
    backgroundColor: '#FFF8EB',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#F2D39A',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  completionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF1D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  completionTextWrap: {
    flex: 1,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  completionText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  completionStatsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: theme.spacing.xs,
  },
  completionCountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#92400E',
  },
  completionCountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  completionStateText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#7C5A20',
    marginBottom: theme.spacing.md,
  },
  feedbackCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  feedbackChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  feedbackChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  feedbackChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#DFF7F6',
  },
  feedbackChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  feedbackChipTextSelected: {
    color: theme.colors.primaryDark,
  },
  feedbackHint: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  feedbackActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  feedbackSecondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  feedbackSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  feedbackPrimaryButtonWrap: {
    flex: 1,
  },
  remixCard: {
    backgroundColor: '#F4FBFB',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#BFEAE9',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  remixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  remixIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6FBFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  remixTextWrap: {
    flex: 1,
  },
  remixTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  remixText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  remixHint: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.md,
  },
  explanationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  explanationText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  commentComposerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  commentComposerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  commentInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  commentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  commentDate: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  bottomActions: {
    marginBottom: theme.spacing.xl,
  },
});
