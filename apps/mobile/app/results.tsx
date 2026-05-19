import { useAuth } from '@/context/AuthContext';
import { getTrip, type TripDetailResponse } from '@/services/trips';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/ui/AppButton';
import ScreenContainer from '../components/ui/ScreenContainer';
import SectionTitle from '../components/ui/SectionTitle';
import TimelineItem from '../components/ui/TimelineItem';
import { theme } from '../constants/theme';

export default function ResultsScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrip() {
      if (isAuthLoading) {
        return;
      }

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
      <ScreenContainer>
        <SectionTitle
          title="Loading Route"
          subtitle="Fetching your persisted trip result from the backend."
        />
      </ScreenContainer>
    );
  }

  if (error || !tripDetail) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="Route Unavailable"
          subtitle={error ?? 'Trip result could not be loaded.'}
        />
        <AppButton title="Back to Planner" onPress={() => router.replace('/(tabs)/planner')} />
      </ScreenContainer>
    );
  }

  const { trip, optimization, stops } = tripDetail;
  const routeSummary = [
    `${optimization.stopCount} stop${optimization.stopCount === 1 ? '' : 's'}`,
    optimization.routeTotalDurationMin
      ? `${optimization.routeTotalDurationMin} min`
      : 'duration pending',
    optimization.routeTotalCostTl
      ? `${optimization.routeTotalCostTl} TL`
      : 'cost pending',
  ].join(' • ');

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <SectionTitle
          title={optimization.routeName ?? trip.title}
          subtitle={`Trip status: ${trip.status.toLowerCase()} • ${routeSummary}`}
        />

        <View style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <Ionicons name="map" size={18} color={theme.colors.primaryDark} />
            <Text style={styles.mapTitle}>Route Summary</Text>
          </View>

          <View style={styles.fakeMap}>
            <Text style={styles.summaryTitle}>{trip.title}</Text>
            <Text style={styles.summaryLine}>
              Date: {new Date(trip.date).toLocaleDateString()}
            </Text>
            <Text style={styles.summaryLine}>
              Distance:{' '}
              {optimization.routeTotalDistanceKm !== null
                ? `${optimization.routeTotalDistanceKm} km`
                : 'N/A'}
            </Text>
            <Text style={styles.summaryLine}>
              Duration:{' '}
              {optimization.routeTotalDurationMin !== null
                ? `${optimization.routeTotalDurationMin} min`
                : 'N/A'}
            </Text>
            <Text style={styles.summaryLine}>
              Cost:{' '}
              {optimization.routeTotalCostTl !== null
                ? `${optimization.routeTotalCostTl} TL`
                : 'N/A'}
            </Text>
            <Text style={styles.summaryLine}>
              Algorithm: {optimization.routeAlgorithmUsed ?? 'N/A'}
            </Text>
          </View>

          <Text style={styles.mapCaption}>
            Optimized backend result for persisted trip `{trip.id}`.
          </Text>
        </View>

        <SectionTitle
          title="Timeline View"
          subtitle="A time-ordered display of the generated day plan."
        />

        {stops.length > 0 ? (
          stops.map((stop) => (
            <TimelineItem
              key={stop.id}
              time={stop.arrivalTime}
              title={stop.title}
              subtitle={`${stop.poi.category} • ${stop.departureTime} departure • ${stop.estimatedCostTl} TL`}
              icon="location"
              imageUrl={
                (stop.poi as { imageUrl?: string; image_url?: string }).imageUrl ??
                (stop.poi as { imageUrl?: string; image_url?: string }).image_url
              }
            />
          ))
        ) : (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationText}>
              No feasible route was returned for this trip yet.
            </Text>
          </View>
        )}

        <SectionTitle
          title="Stop Details"
          subtitle="POI metadata returned by the backend for each persisted stop."
        />

        {stops.map((stop) => (
          <View key={`detail-${stop.id}`} style={styles.stopDetailCard}>
            <TimelineItem
              time=""
              title={stop.title}
              subtitle={`${stop.poi.category} • ${stop.poi.address ?? 'Location unavailable'} • ${stop.poi.openingHours?.open ?? '00:00'}-${stop.poi.openingHours?.close ?? '23:59'}`}
              icon="sparkles"
              imageUrl={stop.poi.imageUrl ?? undefined}
            />
          </View>
        ))}

        <SectionTitle
          title="Trip Settings"
          subtitle="Persisted trip preferences used by the backend optimizer."
        />

        <View style={styles.explanationCard}>
          <Text style={styles.explanationText}>
            Categories: {trip.categories.join(', ') || 'None'}{'\n'}
            Budget: {trip.budgetTl !== null ? `${trip.budgetTl} TL` : 'Not set'}{'\n'}
            Time window: {trip.timeStart ?? 'N/A'} - {trip.timeEnd ?? 'N/A'}{'\n'}
            Max stops: {trip.maxPois ?? 'N/A'}{'\n'}
            Walking tolerance: {trip.walkingToleranceKm ?? 'N/A'} km
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <AppButton
            title="Open Trip Detail"
            onPress={() =>
              router.push({
                pathname: '/trip/[id]',
                params: { id: trip.id },
              })
            }
          />

          <View style={styles.buttonSpacer} />

          <AppButton
            title="Go to My Trips"
            onPress={() => router.replace('/(tabs)/trips')}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: 8,
  },
  fakeMap: {
    minHeight: 220,
    borderRadius: theme.radius.lg,
    backgroundColor: '#EAF6F5',
    padding: theme.spacing.lg,
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginBottom: 12,
  },
  summaryLine: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 6,
  },
  mapCaption: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  explanationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  stopDetailCard: {
    marginBottom: theme.spacing.lg,
  },
  buttonGroup: {
    marginBottom: theme.spacing.xl,
  },
  buttonSpacer: {
    height: 12,
  },
});
