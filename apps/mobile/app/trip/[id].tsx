import {
  getSortedTripStops,
  getTripStopLabel,
} from '@/components/trip/tripMapUtils';
import TimelineItem from '@/components/ui/TimelineItem';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getTrip,
  type TripDetailResponse,
  type TripVisibility,
} from '@/services/trips';
import {
  buildTripEditParams,
  buildTripReturnTarget,
  getTripRouteSource,
} from '@/utils/tripNavigation';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import TripStopsMap from '../../components/trip/TripStopsMap';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVisibilityConfig(visibility: TripVisibility) {
  switch (visibility) {
    case 'PUBLIC':
      return { bg: '#E8F7EE', border: '#BBE7CA', text: '#166534', label: 'Public' };
    case 'PRIVATE':
      return { bg: '#F1F5F9', border: '#CBD5E1', text: '#475569', label: 'Private' };
    case 'DRAFT':
    default:
      return { bg: '#FFF7E8', border: '#FCD89A', text: '#9A6700', label: 'Draft' };
  }
}

function formatVisibilityLabel(visibility: TripVisibility) {
  return visibility.charAt(0) + visibility.slice(1).toLowerCase();
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const router = useRouter();
  const { id, source, returnTripId } = useLocalSearchParams<{
    id?: string;
    source?: string;
    returnTripId?: string;
  }>();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const returnTarget = buildTripReturnTarget({ source, returnTripId });
  const routeSource = getTripRouteSource(source);

  useEffect(() => {
    async function loadTripDetail() {
      if (isAuthLoading) return;

      if (!token) {
        setError('Authentication required. Please sign in again.');
        setIsLoading(false);
        return;
      }

      if (!id || typeof id !== 'string') {
        setError('Missing trip id.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await getTrip(token, id);
        setTripDetail(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load trip detail.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadTripDetail();
  }, [token, id, isAuthLoading]);

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

  if (error || !tripDetail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>Trip Unavailable</Text>
          <Text style={styles.stateText}>
            {error ?? 'Trip detail could not be loaded.'}
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace(returnTarget.href)}
          >
            <Text style={styles.primaryButtonText}>{returnTarget.label}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { trip, optimization, stops } = tripDetail;
  const sortedStops = getSortedTripStops(stops);
  const tripDate = new Date(trip.date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const visConfig = getVisibilityConfig(trip.visibility);
  const imageUrl = tripDetail.preview?.imageUrl?.trim() || null;
  const category = tripDetail.preview?.primaryCategory
    ? tripDetail.preview.primaryCategory.charAt(0).toUpperCase() +
      tripDetail.preview.primaryCategory.slice(1)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Nav */}
      <View style={styles.navRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#0B3B4A" />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          Trip Detail
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Artwork kind="trip" variant="cover" label={trip.title} />
          )}

          <View style={styles.heroScrim} />

          {/* Top row */}
          <View style={styles.heroTopRow}>
            {category && (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{category}</Text>
              </View>
            )}
            <View
              style={[
                styles.visBadge,
                { backgroundColor: visConfig.bg, borderColor: visConfig.border },
              ]}
            >
              <Text style={[styles.visBadgeText, { color: visConfig.text }]}>
                {formatVisibilityLabel(trip.visibility)}
              </Text>
            </View>
          </View>

          {/* Bottom */}
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle} numberOfLines={3}>
              {trip.title}
            </Text>
            <Text style={styles.heroDate}>{tripDate}</Text>
          </View>
        </View>

        {/* Info grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoCellLabel}>ROUTE SUMMARY</Text>
            <Text style={styles.infoCellValue}>
              {optimization.stopCount} stops
              {optimization.routeTotalDurationMin !== null
                ? ` • ${optimization.routeTotalDurationMin} min`
                : ''}
              {optimization.routeTotalCostTl !== null
                ? ` • ${optimization.routeTotalCostTl} TL`
                : ''}
            </Text>
          </View>
          <View style={styles.infoCellDivider} />
          <View style={styles.infoCell}>
            <Text style={styles.infoCellLabel}>PREFERENCES</Text>
            <Text style={styles.infoCellValue}>
              {trip.categories.join(', ') || 'No categories'} •{' '}
              {trip.budgetTl !== null ? `${trip.budgetTl} TL` : 'No budget set'}
            </Text>
          </View>
        </View>

        {/* Route explanation */}
        {optimization.routeExplanation ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="sparkles-outline" size={14} color="#0B3B4A" />
              <Text style={styles.cardTitle}>Why this route works</Text>
            </View>
            <Text style={styles.cardBodyText}>
              {optimization.routeExplanation}
            </Text>
          </View>
        ) : null}

        {/* Map */}
        <TripStopsMap stops={stops} />

        {/* Timeline */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Ordered Stops</Text>
          <Text style={styles.sectionSub}>Follow your trip in order</Text>
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
              No persisted stops available for this trip yet.
            </Text>
          </View>
        )}

        {/* Stop details */}
        {sortedStops.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Stop Details</Text>
              <Text style={styles.sectionSub}>Hours and addresses</Text>
            </View>

            <View style={styles.stopDetailsCard}>
              {sortedStops.map((stop, index) => (
                <View key={`${stop.id}-detail`}>
                  {index > 0 && <View style={styles.stopDetailsDivider} />}
                  <View style={styles.stopDetailRow}>
                    <View style={styles.stopDetailThumb}>
                      <Artwork
                        imageUrl={stop.poi.imageUrl}
                        kind="poi"
                        variant="thumbnail"
                        label={stop.poi.title}
                      />
                    </View>
                    <View style={styles.stopDetailText}>
                      <Text style={styles.stopDetailTitle} numberOfLines={1}>
                        {stop.poi.title}
                      </Text>
                      <Text style={styles.stopDetailCategory}>
                        {stop.poi.category}
                      </Text>
                      <Text style={styles.stopDetailMeta} numberOfLines={1}>
                        {stop.poi.address ??
                          stop.poi.district ??
                          'Location unavailable'}{' '}
                        • {stop.poi.openingHours.open}–
                        {stop.poi.openingHours.close}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Actions */}
        <View style={styles.ctaGroup}>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push(
                buildTripEditParams(trip.id, {
                  ...(routeSource ? { source: routeSource } : {}),
                  ...(typeof returnTripId === 'string' ? { returnTripId } : {}),
                })
              )
            }
          >
            <Ionicons name="pencil-outline" size={15} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Edit Trip</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace(returnTarget.href)}
          >
            <Text style={styles.secondaryButtonText}>{returnTarget.label}</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)/trips')}
          >
            <Text style={styles.secondaryButtonText}>Go to My Trips</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const H_PAD = 20;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
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

  // Nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111C2C',
  },
  navSpacer: {
    width: 38,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 48,
    gap: 14,
  },

  // Hero
  heroCard: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#DFF7F6',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    backgroundColor: 'rgba(11,36,48,0.82)',
  },
  heroTopRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: 'rgba(223,247,246,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00504F',
    letterSpacing: 0.3,
  },
  visBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  visBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  heroDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },

  // Info grid
  infoGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
  },
  infoCell: {
    padding: 16,
    gap: 4,
  },
  infoCellDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  infoCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: theme.colors.textSecondary,
  },
  infoCellValue: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111C2C',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 16,
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111C2C',
  },
  cardBodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },

  // Section
  sectionRow: {
    gap: 2,
    marginTop: 4,
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

  // Empty
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Stop details
  stopDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
  },
  stopDetailsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },
  stopDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  stopDetailThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#DFF7F6',
    flexShrink: 0,
  },
  stopDetailText: {
    flex: 1,
    gap: 3,
  },
  stopDetailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111C2C',
  },
  stopDetailCategory: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  stopDetailMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },

  // CTAs
  ctaGroup: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A69',
    borderRadius: 14,
    paddingVertical: 14,
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
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B3B4A',
  },
});
