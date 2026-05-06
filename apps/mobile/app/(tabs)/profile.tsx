import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { font, type } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { getTrips, type TripListItem, type TripVisibility } from '@/services/trips';

// ── Constants ─────────────────────────────────────────────────────────────────

const COVER_HEIGHT = 180;
const AVATAR_SIZE = 80;
const AVATAR_RING = 4;
const H_PAD = 20;
const CARD_GAP = 12;

const COVER_IMAGE = require('@/assets/images/profile/profile-cover.png');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDisplayName(displayName: string | null | undefined, email: string) {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) return trimmedDisplayName;
  const localPart = email.split('@')[0]?.trim();
  return localPart || 'Traveler';
}

function getAvatarLabel(displayName: string | null | undefined, email: string) {
  const source = displayName?.trim() || email.split('@')[0] || 'Traveler';
  const parts = source
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildTagline(trips: TripListItem[]): string {
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
}

// ── Visibility badge ──────────────────────────────────────────────────────────

const VIS_CONFIG: Record<TripVisibility, { icon: string; label: string; color: string }> = {
  PUBLIC: { icon: 'globe-outline', label: 'Public', color: theme.colors.primary },
  PRIVATE: { icon: 'lock-closed-outline', label: 'Private', color: theme.colors.textSecondary },
  DRAFT: { icon: 'create-outline', label: 'Draft', color: '#F59E0B' },
};

function VisibilityBadge({ visibility }: { visibility: TripVisibility }) {
  const cfg = VIS_CONFIG[visibility];
  return (
    <View style={badgeStyles.pill}>
      <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[badgeStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});

// ── Journey card ──────────────────────────────────────────────────────────────

function JourneyCard({
  trip,
  cardWidth,
  showVisibility,
  onPress,
}: {
  trip: TripListItem;
  cardWidth: number;
  showVisibility: boolean;
  onPress: () => void;
}) {
  const imageUrl = trip.preview?.imageUrl?.trim() || null;
  const imageHeight = Math.round(cardWidth * 1.3);

  return (
    <Pressable
      style={({ pressed }) => [cardStyles.card, { width: cardWidth }, pressed && { opacity: 0.93 }]}
      onPress={onPress}
    >
      <View style={[cardStyles.imageWrap, { height: imageHeight }]}>
        <Artwork imageUrl={imageUrl} kind="trip" variant="cover" />
        {showVisibility && (
          <View style={cardStyles.badgeWrap}>
            <VisibilityBadge visibility={trip.visibility} />
          </View>
        )}
      </View>
      <View style={cardStyles.content}>
        <Text style={cardStyles.title} numberOfLines={2}>{trip.title}</Text>
        <Text style={cardStyles.date}>{formatShortDate(trip.date)}</Text>
        {/* Engagement row — display-only; counts placeholder until API exposes them */}
        <View style={cardStyles.metricsRow}>
          <View style={cardStyles.metricItem}>
            <Ionicons name="heart-outline" size={11} color={theme.colors.textSecondary} />
            <Text style={cardStyles.metricText}>0</Text>
          </View>
          <View style={cardStyles.metricItem}>
            <Ionicons name="chatbubble-outline" size={11} color={theme.colors.textSecondary} />
            <Text style={cardStyles.metricText}>0</Text>
          </View>
          <View style={cardStyles.metricItem}>
            <Ionicons name="bookmark-outline" size={11} color={theme.colors.textSecondary} />
            <Text style={cardStyles.metricText}>0</Text>
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
  badgeWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  date: {
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
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { signOut, user, token, isLoading: isAuthLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isTripsLoading, setIsTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (isAuthLoading) return;
    if (!token) {
      setTrips([]);
      setTripsError('Authentication required. Please sign in again.');
      setIsTripsLoading(false);
      return;
    }
    try {
      setIsTripsLoading(true);
      setTripsError(null);
      setTrips(await getTrips(token));
    } catch (error) {
      setTrips([]);
      setTripsError(error instanceof Error ? error.message : 'Unable to load your trips.');
    } finally {
      setIsTripsLoading(false);
    }
  }, [token, isAuthLoading]);

  useFocusEffect(useCallback(() => { void loadTrips(); }, [loadTrips]));

  const handleLogout = async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  };

  const email = user?.email ?? 'Not signed in';
  const profileName = getDisplayName(user?.displayName, email);
  const avatarLabel = getAvatarLabel(user?.displayName, email);
  const tagline = buildTagline(trips);

  // Social stats — followers/following are placeholders until social graph API is available
  const stats = useMemo(() => ({
    trips: trips.length,
    followers: 0,
    following: 0,
  }), [trips]);

  const journeyTrips = useMemo(
    () => trips.filter((t) => t.visibility === 'PUBLIC'),
    [trips]
  );

  const cardWidth = Math.floor((screenWidth - H_PAD * 2 - CARD_GAP) / 2);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Cover image — flush below AppHeader ── */}
        <View style={styles.coverWrap}>
          <Image
            source={COVER_IMAGE}
            style={styles.coverImage}
            contentFit="cover"
          />
        </View>

        {/* ── Avatar — overlaps lower edge of cover ── */}
        <View style={styles.avatarAnchor}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── Identity ── */}
        <View style={styles.identitySection}>
          <Text style={styles.name} numberOfLines={1}>{profileName}</Text>
          {!isAuthLoading && (
            <Text style={styles.tagline} numberOfLines={2}>{tagline}</Text>
          )}
        </View>

        {/* ── Social stats row ── */}
        <View style={styles.statsRow}>
          {(
            [
              { label: 'Trips', value: stats.trips },
              { label: 'Followers', value: stats.followers },
              { label: 'Following', value: stats.following },
            ] as const
          ).map(({ label, value }, index) => (
            <View key={label} style={styles.statCell}>
              {index > 0 && <View style={styles.statDivider} />}
              <View style={styles.statCellInner}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Action buttons (own-profile mode) ──
            When other-user profile is supported, swap to Follow + Message. */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.88 }]}
            onPress={() => router.push('/saved-trips' as any)}
          >
            <Ionicons name="bookmark" size={15} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>Saved Trips</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.88 }]}
            onPress={() => {}}
          >
            <Ionicons name="create-outline" size={15} color={theme.colors.textSecondary} />
            <Text style={styles.btnSecondaryText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* ── Journeys section header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Journeys</Text>
          {/* Grid-view toggle — non-functional placeholder */}
          <Pressable hitSlop={8}>
            <Ionicons name="grid-outline" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {/* ── Journey grid ── */}
        {isTripsLoading ? (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.stateText}>Loading journeys…</Text>
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
        ) : journeyTrips.length > 0 ? (
          <View style={styles.grid}>
            {journeyTrips.map((trip) => (
              <JourneyCard
                key={trip.id}
                trip={trip}
                cardWidth={cardWidth}
                showVisibility
                onPress={() =>
                  router.push(`/public-trip/${trip.id}` as any)
                }
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.stateIconWrap}>
              <Ionicons name="map-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.stateTitle}>No public journeys yet</Text>
            <Text style={styles.stateText}>
              Set a trip to Public from My Trips to share it here.
            </Text>
            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push('/(tabs)/trips')}
            >
              <Text style={styles.actionBtnText}>Go to My Trips</Text>
            </Pressable>
          </View>
        )}

        {/* ── Sign out ── */}
        <View style={styles.signOutWrap}>
          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
            onPress={() => void handleLogout()}
            disabled={isSigningOut}
          >
            <Ionicons name="log-out-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.signOutText, isSigningOut && { opacity: 0.45 }]}>
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const AVATAR_TOTAL = AVATAR_SIZE + AVATAR_RING * 2;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    flexDirection: 'row',
    marginHorizontal: H_PAD,
    gap: 12,
    marginBottom: 28,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnPrimaryText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnSecondaryText: {
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

  // ── Journey grid ──────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
    marginBottom: 8,
  },

  // ── States: loading / error / empty ──────────────────────────────────────
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

  // ── Sign out ──────────────────────────────────────────────────────────────
  signOutWrap: {
    alignItems: 'center',
    marginTop: 24,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  signOutText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
