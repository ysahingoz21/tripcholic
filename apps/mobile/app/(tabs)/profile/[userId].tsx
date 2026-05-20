import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import FollowListModal from '@/components/ui/FollowListModal';
import { theme } from '@/constants/theme';
import { font, type } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { getExploreTrips, type ExploreTripItem } from '@/services/trips';
import {
  followUser,
  getUserProfile,
  unfollowUser,
  type PublicUserProfile,
} from '@/services/users';

// ── Constants ──────────────────────────────────────────────────────────────────

const COVER_HEIGHT = 180;
const AVATAR_SIZE = 80;
const AVATAR_RING = 4;
const H_PAD = 20;
const CARD_GAP = 12;
const AVATAR_TOTAL = AVATAR_SIZE + AVATAR_RING * 2;

const COVER_IMAGE = require('@/assets/images/profile/profile-cover.png');

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDisplayName(displayName: string | null | undefined): string {
  return displayName?.trim() || 'Tripcholic Traveler';
}

function getAvatarLabel(displayName: string | null | undefined): string {
  const source = displayName?.trim() || 'Traveler';
  const parts = source.split(/[\s._-]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Header ────────────────────────────────────────────────────────────────────

function ProfilePageHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((w) => w[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'T');

  return (
    <View style={[hdrStyles.header, { paddingTop: insets.top }]}>
      <View style={hdrStyles.inner}>
        <View style={hdrStyles.side}>
          <Pressable
            style={({ pressed }) => [hdrStyles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={onBack}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.primaryDark} />
          </Pressable>
        </View>

        <Text style={hdrStyles.title} numberOfLines={1}>{title}</Text>

        <View style={[hdrStyles.side, hdrStyles.sideRight]}>
          <Pressable
            style={({ pressed }) => [hdrStyles.avatar, pressed && { opacity: 0.75 }]}
            onPress={() => router.push('/(tabs)/profile' as any)}
            hitSlop={8}
          >
            <Text style={hdrStyles.avatarText}>{initials}</Text>
          </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: -0.1,
    color: theme.colors.primaryDark,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    color: '#FFFFFF',
  },
});

// ── Trip card ──────────────────────────────────────────────────────────────────

function TripCard({
  trip,
  cardWidth,
  onPress,
}: {
  trip: ExploreTripItem;
  cardWidth: number;
  onPress: () => void;
}) {
  const imageUrl = trip.preview?.imageUrl?.trim() || null;
  const imageHeight = Math.round(cardWidth * 1.3);

  const categoryLine = Array.from(
    new Set([trip.preview.primaryCategory, ...trip.categories].filter(Boolean)),
  )
    .map((c) => cap(c!))
    .join(', ');

  const likedByMe = trip.engagement?.likedByMe ?? false;
  const savedByMe = trip.engagement?.savedByMe ?? false;

  return (
    <Pressable
      style={({ pressed }) => [cardStyles.card, { width: cardWidth }, pressed && { opacity: 0.93 }]}
      onPress={onPress}
    >
      <View style={[cardStyles.imageWrap, { height: imageHeight }]}>
        <Artwork imageUrl={imageUrl} kind="trip" variant="cover" />
      </View>
      <View style={cardStyles.content}>
        <Text style={cardStyles.title} numberOfLines={2}>{trip.title}</Text>
        {categoryLine ? (
          <Text style={cardStyles.category} numberOfLines={1}>{categoryLine}</Text>
        ) : null}
        <View style={cardStyles.metricsRow}>
          <View style={cardStyles.metricItem}>
            <Ionicons
              name={likedByMe ? 'heart' : 'heart-outline'}
              size={14}
              color={likedByMe ? '#EF4444' : theme.colors.textSecondary}
            />
            <Text style={cardStyles.metricText}>{trip.engagement?.likeCount ?? 0}</Text>
          </View>
          <View style={cardStyles.metricItem}>
            <Ionicons name="chatbubble-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={cardStyles.metricText}>{trip.engagement?.commentCount ?? 0}</Text>
          </View>
          <View style={cardStyles.metricItem}>
            <Ionicons
              name={savedByMe ? 'bookmark' : 'bookmark-outline'}
              size={14}
              color={savedByMe ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={cardStyles.metricText}>{trip.engagement?.saveCount ?? 0}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  imageWrap: {
    width: '100%',
    position: 'relative',
  },
  content: {
    padding: 10,
    gap: 3,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primaryDark,
  },
  category: {
    fontFamily: font.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 3,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const { token, user: currentUser } = useAuth();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [trips, setTrips] = useState<ExploreTripItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const [isFollowPending, setIsFollowPending] = useState(false);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);

  const targetUserId = typeof userId === 'string' ? userId : null;

  const loadProfile = useCallback(async () => {
    if (!targetUserId) {
      setProfileError('Invalid user ID.');
      setProfileLoading(false);
      return;
    }
    try {
      setProfileLoading(true);
      setProfileError(null);
      const data = await getUserProfile(targetUserId, token);
      setProfile(data);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to load profile.');
    } finally {
      setProfileLoading(false);
    }
  }, [targetUserId, token]);

  const loadTrips = useCallback(async () => {
    if (!targetUserId) return;
    try {
      setTripsLoading(true);
      setTripsError(null);
      const data = await getExploreTrips({ creatorId: targetUserId, limit: 50 }, token ?? undefined);
      setTrips(data.items);
    } catch (err) {
      setTripsError(err instanceof Error ? err.message : 'Unable to load trips.');
    } finally {
      setTripsLoading(false);
    }
  }, [targetUserId, token]);

  useEffect(() => {
    void loadProfile();
    void loadTrips();
  }, [loadProfile, loadTrips]);

  const handleToggleFollow = async () => {
    if (!token || !profile || !targetUserId || isFollowPending) return;
    setIsFollowPending(true);
    const wasFollowing = profile.isFollowedByMe;
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            isFollowedByMe: !wasFollowing,
            followerCount: wasFollowing ? prev.followerCount - 1 : prev.followerCount + 1,
          }
        : prev,
    );
    try {
      if (wasFollowing) {
        const result = await unfollowUser(targetUserId, token);
        setProfile((prev) =>
          prev ? { ...prev, isFollowedByMe: false, followerCount: result.creator.followerCount } : prev,
        );
      } else {
        const result = await followUser(targetUserId, token);
        setProfile((prev) =>
          prev ? { ...prev, isFollowedByMe: true, followerCount: result.creator.followerCount } : prev,
        );
      }
    } catch {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowedByMe: wasFollowing,
              followerCount: wasFollowing ? prev.followerCount + 1 : prev.followerCount - 1,
            }
          : prev,
      );
    } finally {
      setIsFollowPending(false);
    }
  };

  const isOwnProfile = currentUser?.id != null && currentUser.id === targetUserId;
  const cardWidth = Math.floor((screenWidth - H_PAD * 2 - CARD_GAP) / 2);

  const displayName = getDisplayName(profile?.displayName);
  const avatarLabel = getAvatarLabel(profile?.displayName);

  const tagline = useMemo(() => {
    if (trips.length === 0) return 'Tripcholic Traveler';
    const counts = new Map<string, number>();
    for (const trip of trips) {
      for (const cat of trip.categories) {
        const n = cat.trim().toLowerCase();
        if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([cat]) => `${cap(cat)} Enthusiast`);
    return top.length ? top.join(' • ') : 'Tripcholic Traveler';
  }, [trips]);

  const headerTitle = profileLoading ? 'Profile' : displayName;

  return (
    <View style={styles.root}>
      <ProfilePageHeader title={headerTitle} onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Cover ── */}
        <View style={styles.coverWrap}>
          <Image
            source={COVER_IMAGE}
            style={styles.coverImage}
            contentFit="cover"
          />
        </View>

        {/* ── Avatar ── */}
        <View style={styles.avatarAnchor}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profileLoading ? '…' : avatarLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Identity ── */}
        {profileLoading ? (
          <View style={styles.identitySection}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : profileError ? (
          <View style={styles.identitySection}>
            <Text style={styles.errorText}>{profileError}</Text>
            <Pressable style={styles.actionBtn} onPress={() => void loadProfile()}>
              <Text style={styles.actionBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : profile ? (
          <>
            <View style={styles.identitySection}>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.tagline} numberOfLines={2}>{tagline}</Text>
            </View>

            {/* ── Stats row ── */}
            <View style={styles.statsRow}>
              {[
                { label: 'Trips', value: tripsLoading ? '…' : trips.length, tappable: false },
                { label: 'Followers', value: profile.followerCount, tappable: true },
                { label: 'Following', value: profile.followingCount, tappable: true },
              ].map(({ label, value, tappable }, index) => (
                <View key={label} style={styles.statCell}>
                  {index > 0 && <View style={styles.statDivider} />}
                  {tappable && targetUserId ? (
                    <Pressable
                      style={({ pressed }) => [styles.statCellInner, pressed && { opacity: 0.6 }]}
                      onPress={() => setFollowModal(label === 'Followers' ? 'followers' : 'following')}
                    >
                      <Text style={styles.statValue}>{value}</Text>
                      <Text style={styles.statLabel}>{label}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.statCellInner}>
                      <Text style={styles.statValue}>{value}</Text>
                      <Text style={styles.statLabel}>{label}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* ── Follow button — only for other users when authenticated ── */}
            {!isOwnProfile && token && (
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [
                    profile.isFollowedByMe ? styles.btnFollowing : styles.btnFollow,
                    pressed && { opacity: 0.85 },
                    isFollowPending && { opacity: 0.55 },
                  ]}
                  onPress={() => void handleToggleFollow()}
                  disabled={isFollowPending}
                >
                  <Ionicons
                    name={profile.isFollowedByMe ? 'checkmark' : 'person-add-outline'}
                    size={15}
                    color={profile.isFollowedByMe ? theme.colors.textSecondary : '#FFFFFF'}
                  />
                  <Text style={profile.isFollowedByMe ? styles.btnFollowingText : styles.btnFollowText}>
                    {isFollowPending ? '…' : profile.isFollowedByMe ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        ) : null}

        {/* ── Journeys section header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Journeys</Text>
          {/* Non-functional grid toggle, matches own-profile */}
          <Pressable hitSlop={8}>
            <Ionicons name="grid-outline" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {/* ── Trip grid ── */}
        {tripsLoading ? (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.stateText}>Loading trips…</Text>
          </View>
        ) : tripsError ? (
          <View style={styles.stateCenter}>
            <View style={styles.stateIconWrap}>
              <Ionicons name="alert-circle-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.stateTitle}>Couldn't load trips</Text>
            <Text style={styles.stateText}>{tripsError}</Text>
            <Pressable style={styles.actionBtn} onPress={() => void loadTrips()}>
              <Text style={styles.actionBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : trips.length > 0 ? (
          <View style={styles.grid}>
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                cardWidth={cardWidth}
                onPress={() => router.push(`/public-trip/${trip.id}` as any)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.stateIconWrap}>
              <Ionicons name="map-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.stateTitle}>No public trips yet</Text>
            <Text style={styles.stateText}>
              This traveler hasn't shared any public trips yet.
            </Text>
          </View>
        )}
      </ScrollView>

      {targetUserId && (
        <FollowListModal
          visible={followModal !== null}
          onClose={() => setFollowModal(null)}
          type={followModal ?? 'followers'}
          targetUserId={targetUserId}
          isOwnProfile={isOwnProfile}
          token={token}
          currentUserId={currentUser?.id ?? null}
          onFollowerCountChange={(delta) =>
            setProfile((prev) => prev ? { ...prev, followerCount: prev.followerCount + delta } : prev)
          }
          onFollowingCountChange={(delta) =>
            setProfile((prev) => prev ? { ...prev, followingCount: prev.followingCount + delta } : prev)
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Cover ────────────────────────────────────────────────────────────────
  coverWrap: {
    height: COVER_HEIGHT,
    backgroundColor: theme.colors.primaryDark,
  },
  coverImage: {
    width: '100%',
    height: COVER_HEIGHT,
  },

  // ── Avatar ───────────────────────────────────────────────────────────────
  avatarAnchor: {
    alignItems: 'center',
    marginTop: -(AVATAR_TOTAL / 2),
  },
  avatarRing: {
    width: AVATAR_TOTAL,
    height: AVATAR_TOTAL,
    borderRadius: AVATAR_TOTAL / 2,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ── Identity ─────────────────────────────────────────────────────────────
  identitySection: {
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 5,
  },
  name: {
    fontFamily: font.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  tagline: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // ── Stats row ────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: H_PAD,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 16,
  },
  statCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  statCellInner: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontFamily: font.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: theme.colors.primaryDark,
  },
  statLabel: {
    fontFamily: font.medium,
    fontSize: 11,
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
  },

  // ── Action buttons ────────────────────────────────────────────────────────
  actionRow: {
    marginHorizontal: H_PAD,
    marginBottom: 28,
  },
  btnFollow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnFollowText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  btnFollowing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnFollowingText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: theme.colors.primaryDark,
  },

  // ── Grid ──────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
    marginBottom: 8,
  },

  // ── States ────────────────────────────────────────────────────────────────
  stateCenter: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: H_PAD,
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 10,
    marginHorizontal: H_PAD,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  stateIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stateTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  stateText: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  actionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 2,
  },
  actionBtnText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
