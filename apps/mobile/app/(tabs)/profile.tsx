import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TripPreviewCard from '@/components/trip/TripPreviewCard';
import AppButton from '@/components/ui/AppButton';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getTrips, type TripListItem } from '@/services/trips';

function getDisplayName(displayName: string | null | undefined, email: string) {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

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
  if (!date) {
    return 'Joined recently';
  }

  return `Joined ${new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function formatTripDate(date: string) {
  return new Date(date).toLocaleDateString();
}

function formatCategoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function buildIdentitySummary(trips: TripListItem[]) {
  if (trips.length === 0) {
    return 'New to Tripcholic. Your planned routes will start shaping this profile as you create trips.';
  }

  const publicReadyCount = trips.filter((trip) => trip.visibility === 'PUBLIC').length;
  const optimizedCount = trips.filter((trip) => trip.status === 'OPTIMIZED').length;
  const categoryCounts = new Map<string, number>();

  for (const trip of trips) {
    for (const category of trip.categories) {
      const normalized = category.trim().toLowerCase();
      if (!normalized) {
        continue;
      }

      categoryCounts.set(normalized, (categoryCounts.get(normalized) ?? 0) + 1);
    }
  }

  const topCategories = [...categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([category]) => formatCategoryLabel(category));

  const firstSentence = `${trips.length} trip${trips.length === 1 ? '' : 's'} created, ${publicReadyCount} public-ready.`;

  if (topCategories.length > 0) {
    return `${firstSentence} Mostly ${formatList(topCategories)} routes so far.`;
  }

  if (optimizedCount > 0) {
    return `${firstSentence} ${optimizedCount} optimized trip${optimizedCount === 1 ? '' : 's'} already saved.`;
  }

  return `${firstSentence} Still building the first shareable routes.`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, user, token, isLoading: isAuthLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isTripsLoading, setIsTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

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
      setTripsError(error instanceof Error ? error.message : 'Unable to load your trips.');
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
  const identitySummary = buildIdentitySummary(trips);

  const stats = useMemo(() => {
    const totalTrips = trips.length;
    const optimizedTrips = trips.filter((trip) => trip.status === 'OPTIMIZED').length;
    const publicTrips = trips.filter((trip) => trip.visibility === 'PUBLIC').length;
    const draftTrips = trips.filter((trip) => trip.visibility === 'DRAFT').length;
    const privateTrips = trips.filter((trip) => trip.visibility === 'PRIVATE').length;

    return {
      totalTrips,
      optimizedTrips,
      publicTrips,
      draftTrips,
      privateTrips,
    };
  }, [trips]);

  const publicReadyTrips = useMemo(
    () => trips.filter((trip) => trip.visibility === 'PUBLIC').slice(0, 3),
    [trips]
  );

  if (isAuthLoading) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="Profile"
          subtitle="Loading your identity and trip activity."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLabel}</Text>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.name}>{profileName}</Text>
              <Text style={styles.email}>{email}</Text>
              <Text style={styles.joinedText}>{formatJoinedDate(user?.createdAt)}</Text>
            </View>
          </View>
          <Text style={styles.summaryText}>{identitySummary}</Text>
        </View>

        <SectionTitle
          title="Creator Snapshot"
          subtitle="A simple view of the trips you have created and prepared for future sharing surfaces."
        />

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.optimizedTrips}</Text>
            <Text style={styles.statLabel}>Optimized</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.publicTrips}</Text>
            <Text style={styles.statLabel}>Public-ready</Text>
          </View>
        </View>

        <SectionTitle
          title="Visibility Snapshot"
          subtitle="These states describe your own trip library. Public-ready trips are not publicly browsable yet."
        />

        <View style={styles.visibilityGrid}>
          <View style={[styles.visibilityCard, styles.visibilityDraft]}>
            <Text style={styles.visibilityCount}>{stats.draftTrips}</Text>
            <Text style={styles.visibilityLabel}>Draft</Text>
          </View>
          <View style={[styles.visibilityCard, styles.visibilityPrivate]}>
            <Text style={styles.visibilityCount}>{stats.privateTrips}</Text>
            <Text style={styles.visibilityLabel}>Private</Text>
          </View>
          <View style={[styles.visibilityCard, styles.visibilityPublic]}>
            <Text style={styles.visibilityCount}>{stats.publicTrips}</Text>
            <Text style={styles.visibilityLabel}>Public</Text>
          </View>
        </View>

        <SectionTitle
          title="Public-ready Trips"
          subtitle="Trips marked Public can later feed profile grids and Explore-style surfaces when those features arrive."
        />

        {isTripsLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loading trips</Text>
            <Text style={styles.emptyText}>Building your profile shelf from saved trip data.</Text>
          </View>
        ) : tripsError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Trips unavailable</Text>
            <Text style={styles.emptyText}>{tripsError}</Text>
            <AppButton title="Try Again" onPress={() => void loadTrips()} />
          </View>
        ) : publicReadyTrips.length > 0 ? (
          publicReadyTrips.map((trip) => (
            <Pressable
              key={trip.id}
              style={styles.previewPressable}
              onPress={() =>
                router.push({
                  pathname: '/trip/[id]',
                  params: { id: trip.id },
                })
              }
            >
              <TripPreviewCard
                preview={trip.preview}
                dateLabel={formatTripDate(trip.date)}
                rightContent={
                  <View style={styles.publicBadge}>
                    <Ionicons name="globe-outline" size={14} color="#166534" />
                    <Text style={styles.publicBadgeText}>Public-ready</Text>
                  </View>
                }
              />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No public-ready trips yet</Text>
            <Text style={styles.emptyText}>
              Set a trip to Public when it is ready for future sharing surfaces. It will still remain owner-only for now.
            </Text>
          </View>
        )}

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Revisit saved public trips</Text>
          <Text style={styles.ctaText}>
            Saved Trips keeps public Explore posts separate from the trips you created yourself.
          </Text>
          <AppButton title="Open Saved Trips" onPress={() => router.push('/saved-trips' as any)} />
        </View>

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Manage your full trip library</Text>
          <Text style={styles.ctaText}>
            Reopen drafts, refine private plans, and review all of your optimized routes in My Trips.
          </Text>
          <AppButton title="Open My Trips" onPress={() => router.push('/(tabs)/trips')} />
        </View>

        <View style={styles.logoutContainer}>
          <AppButton
            title={isSigningOut ? 'Signing Out...' : 'Log Out'}
            onPress={handleLogout}
            disabled={isSigningOut}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xl,
  },
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  email: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  joinedText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  summaryText: {
    marginTop: theme.spacing.lg,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  visibilityGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  visibilityCard: {
    flex: 1,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  visibilityDraft: {
    backgroundColor: '#FFF7E8',
    borderColor: '#FCD89A',
  },
  visibilityPrivate: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  visibilityPublic: {
    backgroundColor: '#E8F7EE',
    borderColor: '#BBE7CA',
  },
  visibilityCount: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  visibilityLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  previewPressable: {
    marginBottom: theme.spacing.md,
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F7EE',
    borderColor: '#BBE7CA',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  publicBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
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
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  ctaCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginTop: theme.spacing.sm,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  logoutContainer: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
});
