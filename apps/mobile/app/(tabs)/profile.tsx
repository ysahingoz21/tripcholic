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
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getTrips, type TripListItem } from '@/services/trips';
import { buildTripDetailParams } from '@/utils/tripNavigation';

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatJoinedDate(date: string | undefined) {
  if (!date) return 'Joined recently';
  return `Joined ${new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCategoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}



// Derives a short "Istanbul Enthusiast • Digital Nomad"-style tagline
function buildTagline(trips: TripListItem[]): string {
  if (trips.length === 0) return 'Tripcholic Traveler';

  const categoryCounts = new Map<string, number>();
  for (const trip of trips) {
    for (const category of trip.categories) {
      const normalized = category.trim().toLowerCase();
      if (!normalized) continue;
      categoryCounts.set(normalized, (categoryCounts.get(normalized) ?? 0) + 1);
    }
  }

  const top = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([cat]) => `${formatCategoryLabel(cat)} Enthusiast`);

  if (top.length === 0) return 'Tripcholic Traveler';
  return top.join(' • ');
}

// ── Grid card (public routes 2-column grid) ───────────────────────────────

function GridTripCard({
  trip,
  size,
  onPress,
}: {
  trip: TripListItem;
  size: number;
  onPress: () => void;
}) {
  const imageUrl = trip.preview?.imageUrl?.trim() || null;

  return (
    <Pressable
      style={[styles.gridCard, { width: size, height: size }]}
      onPress={onPress}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <Artwork kind="trip" variant="cover" label={trip.title} />
        </View>
      )}
      {/* Scrim overlay */}
      <View style={styles.gridCardScrim} />
      {/* Text overlay */}
      <View style={styles.gridCardTextWrap}>
        <Text style={styles.gridCardTitle} numberOfLines={2}>
          {trip.title}
        </Text>
        <Text style={styles.gridCardDate}>{formatShortDate(trip.date)}</Text>
      </View>
    </Pressable>
  );
}

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
      const data = await getTrips(token);
      setTrips(data);
    } catch (error) {
      setTrips([]);
      setTripsError(
        error instanceof Error ? error.message : 'Unable to load your trips.'
      );
    } finally {
      setIsTripsLoading(false);
    }
  }, [token, isAuthLoading]);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

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

  const stats = useMemo(() => ({
    totalTrips: trips.length,
    optimizedTrips: trips.filter((t) => t.status === 'OPTIMIZED').length,
    publicTrips: trips.filter((t) => t.visibility === 'PUBLIC').length,
    draftTrips: trips.filter((t) => t.visibility === 'DRAFT').length,
    privateTrips: trips.filter((t) => t.visibility === 'PRIVATE').length,
  }), [trips]);

  const publicReadyTrips = useMemo(
    () => trips.filter((t) => t.visibility === 'PUBLIC').slice(0, 6),
    [trips]
  );

  // Grid: 2 columns, gap 2px, full bleed
  const GRID_GAP = 2;
  const gridCellSize = Math.floor((screenWidth - GRID_GAP) / 2);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Cover band (teal-to-dark-navy gradient simulation) ── */}
        <View style={styles.coverBand}>
          {/* Top teal half */}
          <View style={styles.coverTop} />
          {/* Bottom dark-navy half */}
          <View style={styles.coverBottom} />
          {/* Avatar — floats at the bottom edge of the band */}
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── Identity section ── */}
        <View style={styles.identitySection}>
          <Text style={styles.name} numberOfLines={1}>
            {profileName}
          </Text>
          {!isAuthLoading && (
            <Text style={styles.tagline} numberOfLines={1}>
              {tagline}
            </Text>
          )}
          <Text style={styles.joinedText}>
            {formatJoinedDate(user?.createdAt)}
          </Text>
        </View>

        {/* ── Social stats row ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'TRIPS', value: stats.totalTrips },
            { label: 'PUBLIC', value: stats.publicTrips },
            { label: 'OPTIMIZED', value: stats.optimizedTrips },
          ].map(({ label, value }, index) => (
            <View key={label} style={styles.statCell}>
              {index > 0 && <View style={styles.statDivider} />}
              <View style={styles.statCellInner}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── CTA buttons ── */}
        <View style={styles.ctaRow}>
          <Pressable
            style={styles.ctaButton}
            onPress={() => router.push('/(tabs)/trips')}
          >
            <Text style={styles.ctaButtonText}>My Trips</Text>
          </Pressable>
          <Pressable
            style={styles.ctaButton}
            onPress={() => router.push('/saved-trips' as any)}
          >
            <Text style={styles.ctaButtonText}>Saved Trips</Text>
          </Pressable>
        </View>

        {/* ── Public Routes section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Public Routes</Text>
          <Text style={styles.sectionSub}>Shared with the community</Text>
        </View>

        {isTripsLoading ? (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.stateCenterText}>Loading trips…</Text>
          </View>
        ) : tripsError ? (
          <View style={styles.stateCenter}>
            <Text style={styles.stateCenterText}>{tripsError}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void loadTrips()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : publicReadyTrips.length > 0 ? (
          <View style={styles.grid}>
            {publicReadyTrips.map((trip) => (
              <GridTripCard
                key={trip.id}
                trip={trip}
                size={gridCellSize}
                onPress={() =>
                  router.push(
                    buildTripDetailParams(trip.id, { source: 'profile' })
                  )
                }
              />
            ))}
          </View>
        ) : (
          <View style={styles.stateCenter}>
            <Text style={styles.stateCenterText}>
              No public routes yet. Set a trip to Public to see it here.
            </Text>
          </View>
        )}

        {/* ── Sign out ── */}
        <Pressable
          style={styles.signOutLink}
          onPress={() => void handleLogout()}
          disabled={isSigningOut}
        >
          <Text style={[styles.signOutText, isSigningOut && styles.signOutDisabled]}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const COVER_HEIGHT = 140;
const AVATAR_SIZE = 88;
const AVATAR_OVERFLOW = AVATAR_SIZE / 2; // how far avatar hangs below band
const H_PAD = 24;

// Gradient simulation: teal (#006A69) on top blending toward dark navy (#0B1929)
// We use a two-tone approach: teal occupies ~60% of the band height,
// and a transitional dark strip at the bottom creates the gradient feel.
const TEAL = '#006A69';
const NAVY = '#0B1929';
const MID = '#004E5A'; // midpoint for a smoother visual transition

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ── Cover band ──────────────────────────────────────────────────────────
  coverBand: {
    height: COVER_HEIGHT + AVATAR_OVERFLOW, // extra height for avatar overflow
    position: 'relative',
    overflow: 'visible',
  },
  coverTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: COVER_HEIGHT * 0.55,
    backgroundColor: TEAL,
  },
  coverBottom: {
    position: 'absolute',
    top: COVER_HEIGHT * 0.55,
    left: 0,
    right: 0,
    height: COVER_HEIGHT * 0.45,
    backgroundColor: NAVY,
    // Soft midpoint strip at the seam via a border trick
    borderTopWidth: COVER_HEIGHT * 0.18,
    borderTopColor: MID,
  },
  // White ring around avatar to float it out of the band
  avatarRing: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#006A69',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Identity section ────────────────────────────────────────────────────
  identitySection: {
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 5,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  joinedText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // ── Stats row ───────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: H_PAD,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8ECF0',
    paddingVertical: 16,
  },
  statCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E8ECF0',
    marginVertical: 4,
  },
  statCellInner: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 0.8,
  },

  // ── CTA row ─────────────────────────────────────────────────────────────
  ctaRow: {
    flexDirection: 'row',
    marginHorizontal: H_PAD,
    gap: 12,
    marginBottom: 28,
  },
  ctaButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#006A69',
    borderRadius: 14,
    paddingVertical: 14,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },

  // ── Section header ──────────────────────────────────────────────────────
  sectionHeader: {
    paddingHorizontal: H_PAD,
    marginBottom: 14,
    gap: 3,
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

  // ── Trip grid ───────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginBottom: 8,
  },
  gridCard: {
    backgroundColor: '#DFF7F6',
    overflow: 'hidden',
  },
  gridCardScrim: {
    ...StyleSheet.absoluteFillObject,
    // Bottom-to-top dark scrim for text legibility
    backgroundColor: 'transparent',
    // We use a nested View for the gradient scrim effect
  },
  gridCardTextWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 2,
  },
  gridCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  gridCardDate: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },

  // ── State: loading / error / empty ─────────────────────────────────────
  stateCenter: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: H_PAD,
    gap: 10,
  },
  stateCenterText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#006A69',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Sign out ────────────────────────────────────────────────────────────
  signOutLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  signOutText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  signOutDisabled: {
    opacity: 0.45,
  },
});
