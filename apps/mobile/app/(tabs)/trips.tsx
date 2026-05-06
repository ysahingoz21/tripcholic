import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getTrips,
  type TripListItem,
  type TripVisibility,
} from '@/services/trips';
import { buildTripDetailParams } from '@/utils/tripNavigation';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type VisibilityConfig = { bg: string; text: string; label: string };

function getVisibilityConfig(v: TripVisibility): VisibilityConfig {
  switch (v) {
    case 'PUBLIC':
      return { bg: '#E8F7EE', text: '#166534', label: 'Public' };
    case 'PRIVATE':
      return { bg: '#F1F5F9', text: '#475569', label: 'Private' };
    case 'DRAFT':
    default:
      return { bg: '#FFF7E8', text: '#9A6700', label: 'Draft' };
  }
}

function formatCategory(cat: string | null) {
  if (!cat) return null;
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Trip Card ─────────────────────────────────────────────────────────────────

type TripCardProps = {
  trip: TripListItem;
  onPress: () => void;
};

function TripCard({ trip, onPress }: TripCardProps) {
  const imageUrl = trip.preview?.imageUrl?.trim() || null;
  const category = formatCategory(trip.preview?.primaryCategory ?? null);
  const stopCount = trip._count?.stops ?? 0;
  const vis = getVisibilityConfig(trip.visibility);
  const district = trip.preview?.districtLabel ?? null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* ── Image area ── */}
      <View style={styles.imageArea}>
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

        {/* Dark scrim over image */}
        <View style={styles.imageScrim} />

        {/* Overlaid badges */}
        <View style={styles.imageBadgeRow}>
          {category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText} numberOfLines={1}>
                {category}
              </Text>
            </View>
          )}
          <View style={styles.dateBadge}>
            <Ionicons
              name="calendar-outline"
              size={10}
              color="rgba(255,255,255,0.9)"
            />
            <Text style={styles.dateBadgeText}>{formatShortDate(trip.date)}</Text>
          </View>
        </View>
      </View>

      {/* ── Info area ── */}
      <View style={styles.infoArea}>
        <Text style={styles.tripTitle} numberOfLines={2}>
          {trip.title}
        </Text>

        {/* Meta row */}
        {(stopCount > 0 || district || trip.optimizedAt) && (
          <View style={styles.metaRow}>
            {stopCount > 0 && (
              <View style={styles.metaItem}>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.metaText}>
                  {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
                </Text>
              </View>
            )}
            {district && (
              <View style={styles.metaItem}>
                <Ionicons
                  name="map-outline"
                  size={12}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.metaText} numberOfLines={1}>
                  {district}
                </Text>
              </View>
            )}
            {trip.optimizedAt && (
              <View style={styles.metaItem}>
                <Ionicons
                  name="flash-outline"
                  size={12}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.metaText}>Optimized</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer row */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <View style={[styles.visBadge, { backgroundColor: vis.bg }]}>
              <Text style={[styles.visText, { color: vis.text }]}>
                {vis.label}
              </Text>
            </View>
            <Text style={styles.footerDate}>
              {trip.optimizedAt
                ? `Optimized ${formatFullDate(trip.optimizedAt)}`
                : `Created ${formatFullDate(trip.createdAt)}`}
            </Text>
          </View>
          <View style={styles.openCta}>
            <Text style={styles.openText}>Open</Text>
            <Ionicons name="arrow-forward" size={13} color="#006A69" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TripsScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (isAuthLoading) return;

    if (!token) {
      setError('Authentication required. Please sign in again.');
      setTrips([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getTrips(token);
      setTrips(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load your trips.'
      );
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, isAuthLoading]);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  const isSpinning = isLoading || isAuthLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ISTANBUL</Text>
          <Text style={styles.title}>My Trips</Text>
        </View>
        <View style={styles.headerRight}>
          {!isSpinning && trips.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{trips.length}</Text>
            </View>
          )}
          <Pressable
            style={styles.newButton}
            onPress={() => router.push('/(tabs)/planner')}
          >
            <Ionicons name="add" size={16} color="#006A69" />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </View>
      </View>

      {/* ─── Content ─── */}
      {isSpinning ? (
        <View style={styles.centeredArea}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading trips…</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredArea}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>Couldn't load trips</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <Pressable style={styles.actionButton} onPress={() => void loadTrips()}>
            <Text style={styles.actionButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centeredArea}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="map-outline" size={26} color="#006A69" />
          </View>
          <Text style={styles.stateTitle}>No trips yet</Text>
          <Text style={styles.stateBody}>
            Trips you create with the planner will appear here, ready to revisit
            and share.
          </Text>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/planner')}
          >
            <Text style={styles.actionButtonText}>Plan your first trip</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onPress={() =>
                router.push(
                  buildTripDetailParams(trip.id, { source: 'my-trips' })
                )
              }
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 3,
  },
  countBadge: {
    backgroundColor: '#DFF7F6',
    borderRadius: 999,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006A69',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DFF7F6',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006A69',
  },

  // ── Loading / Error / Empty ──
  centeredArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111C2C',
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#006A69',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── List ──
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },

  // ── Trip card ──
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  // Image area
  imageArea: {
    height: 164,
    backgroundColor: '#DFF7F6',
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,59,74,0.28)',
  },
  imageBadgeRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B3B4A',
    letterSpacing: 0.2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },

  // Info area
  infoArea: {
    padding: 16,
    gap: 10,
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111C2C',
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  visBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerDate: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  openCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006A69',
  },
});
