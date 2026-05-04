import { useAuth } from '@/context/AuthContext';
import {
  getSortedTripStops,
  getTripStopLabel,
} from '@/components/trip/tripMapUtils';
import { getTrip, type TripDetailResponse } from '@/services/trips';
import { Ionicons } from '@expo/vector-icons';
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
import TripStopsMap from '../components/trip/TripStopsMap';
import TimelineItem from '../components/ui/TimelineItem';
import { theme } from '../constants/theme';
import { buildTripDetailParams } from '../utils/tripNavigation';

export default function ResultsScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrip() {
      if (isAuthLoading) return;

      if (!token) {
        setError('Authentication required. Please sign in again.');
        setIsLoading(false);
        return;
      }

      if (!tripId || typeof tripId !== 'string') {
        setError('Missing trip id.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await getTrip(token, tripId);
        setTripDetail(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load trip results.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadTrip();
  }, [token, tripId, isAuthLoading]);

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Preparing your route…</Text>
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
          <Text style={styles.stateTitle}>Route unavailable</Text>
          <Text style={styles.stateText}>
            {error ?? 'Trip result could not be loaded.'}
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/planner')}
          >
            <Text style={styles.primaryButtonText}>Back to Planner</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { trip, optimization, stops } = tripDetail;
  const sortedStops = getSortedTripStops(stops);

  const metrics = [
    {
      icon: 'location-outline' as const,
      value: String(optimization.stopCount),
      label: 'Stops',
    },
    {
      icon: 'walk-outline' as const,
      value:
        optimization.routeTotalDistanceKm !== null
          ? `${optimization.routeTotalDistanceKm}`
          : '—',
      unit: optimization.routeTotalDistanceKm !== null ? 'km' : undefined,
      label: 'Distance',
    },
    {
      icon: 'time-outline' as const,
      value:
        optimization.routeTotalDurationMin !== null
          ? `${optimization.routeTotalDurationMin}`
          : '—',
      unit: optimization.routeTotalDurationMin !== null ? 'min' : undefined,
      label: 'Duration',
    },
    {
      icon: 'cash-outline' as const,
      value:
        optimization.routeTotalCostTl !== null
          ? `${optimization.routeTotalCostTl}`
          : '—',
      unit: optimization.routeTotalCostTl !== null ? 'TL' : undefined,
      label: 'Est. Cost',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#0B3B4A" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>GENERATED ROUTE</Text>
          <Text style={styles.title} numberOfLines={2}>
            {trip.title}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Metrics row ── */}
        <View style={styles.metricsRow}>
          {metrics.map(({ icon, value, unit, label }) => (
            <View key={label} style={styles.metricCell}>
              <Ionicons
                name={icon}
                size={16}
                color={theme.colors.primary}
                style={styles.metricIcon}
              />
              <Text style={styles.metricValue}>
                {value}
                {unit ? (
                  <Text style={styles.metricUnit}> {unit}</Text>
                ) : null}
              </Text>
              <Text style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Map ── */}
        <View style={styles.mapCard}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="map-outline" size={16} color="#0B3B4A" />
            <Text style={styles.cardTitle}>Route Map</Text>
          </View>
          <TripStopsMap stops={stops} />
        </View>

        {/* ── Route explanation ── */}
        {optimization.routeExplanation ? (
          <View style={styles.explanationCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="sparkles-outline" size={16} color="#0B3B4A" />
              <Text style={styles.cardTitle}>Why this route works</Text>
            </View>
            <Text style={styles.explanationText}>
              {optimization.routeExplanation}
            </Text>
          </View>
        ) : null}

        {/* ── Timeline ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Text style={styles.sectionSub}>
            {new Date(trip.date).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>

        {sortedStops.length > 0 ? (
          <View style={styles.timelineWrap}>
            {sortedStops.map((stop) => (
              <TimelineItem
                key={stop.id}
                time={stop.arrivalTime}
                title={getTripStopLabel(stop)}
                subtitle={`${stop.poi.category} • ${stop.departureTime} departure • ${stop.estimatedCostTl} TL`}
                icon="location"
                imageUrl={stop.poi.imageUrl}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No feasible route was returned for this trip yet.
            </Text>
          </View>
        )}

        {/* ── Trip settings ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Trip Settings</Text>
          <Text style={styles.sectionSub}>Preferences used to shape this route</Text>
        </View>

        <View style={styles.settingsCard}>
          {[
            {
              label: 'Categories',
              value: trip.categories.join(', ') || 'None',
            },
            {
              label: 'Budget',
              value:
                trip.budgetTl !== null ? `${trip.budgetTl} TL` : 'Not set',
            },
            {
              label: 'Time window',
              value: `${trip.timeStart ?? 'N/A'} – ${trip.timeEnd ?? 'N/A'}`,
            },
            { label: 'Max stops', value: String(trip.maxPois ?? 'N/A') },
            {
              label: 'Walking tolerance',
              value:
                trip.walkingToleranceKm !== null
                  ? `${trip.walkingToleranceKm} km`
                  : 'N/A',
            },
          ].map(({ label, value }, i) => (
            <View key={label}>
              {i > 0 && <View style={styles.settingsDivider} />}
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>{label}</Text>
                <Text style={styles.settingsValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── CTAs ── */}
        <View style={styles.ctaGroup}>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push(
                buildTripDetailParams(trip.id, {
                  source: 'results',
                  returnTripId: trip.id,
                })
              )
            }
          >
            <Text style={styles.primaryButtonText}>Open Trip Detail</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
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

// ── Styles ─────────────────────────────────────────────────────────────────

const H_PAD = 24;

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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: theme.colors.primary,
    marginBottom: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.4,
    lineHeight: 30,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 48,
    gap: 16,
  },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  metricIcon: {
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111C2C',
    textAlign: 'center',
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Cards
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
    padding: 16,
    gap: 12,
  },
  explanationCard: {
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
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111C2C',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },

  // Section label
  sectionRow: {
    gap: 2,
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

  // Timeline
  timelineWrap: {
    gap: 0,
  },

  // Settings card
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  settingsLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  settingsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111C2C',
    textAlign: 'right',
    flex: 1,
  },

  // Empty
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // CTAs
  ctaGroup: {
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A69',
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B3B4A',
  },
});
