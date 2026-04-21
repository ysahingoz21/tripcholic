import AppButton from '@/components/ui/AppButton';
import TripStopsMap from '@/components/trip/TripStopsMap';
import { getSortedTripStops } from '@/components/trip/tripMapUtils';
import InfoCard from '@/components/ui/InfoCard';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import TimelineItem from '@/components/ui/TimelineItem';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getTrip, type TripDetailResponse } from '@/services/trips';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTripDetail() {
      if (isAuthLoading) {
        return;
      }

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
      <ScreenContainer>
        <SectionTitle
          title="Loading Trip"
          subtitle="Fetching persisted trip detail from the backend."
        />
      </ScreenContainer>
    );
  }

  if (error || !tripDetail) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="Trip Unavailable"
          subtitle={error ?? 'Trip detail could not be loaded.'}
        />
        <AppButton
          title="Back to Results"
          onPress={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const { trip, optimization, stops } = tripDetail;
  const sortedStops = getSortedTripStops(stops);
  const tripDate = new Date(trip.date).toLocaleDateString();

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <SectionTitle
          title={trip.title}
          subtitle={`Trip #${trip.id} • ${trip.status.toLowerCase()}`}
        />

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>
            {optimization.routeName ?? trip.title}
          </Text>
          <Text style={styles.heroSubtitle}>
            {tripDate} • {optimization.stopCount} stop
            {optimization.stopCount === 1 ? '' : 's'}
          </Text>
        </View>

        <InfoCard
          title="Route Summary"
          description={`${optimization.stopCount} stops • ${
            optimization.routeTotalDurationMin !== null
              ? `${optimization.routeTotalDurationMin} min`
              : 'duration N/A'
          } • ${
            optimization.routeTotalCostTl !== null
              ? `${optimization.routeTotalCostTl} TL`
              : 'cost N/A'
          }`}
        />
        <InfoCard
          title="Optimizer"
          description={optimization.routeAlgorithmUsed ?? 'Algorithm unavailable'}
        />
        <InfoCard
          title="Trip Preferences"
          description={`Categories: ${
            trip.categories.join(', ') || 'None'
          } • Budget: ${
            trip.budgetTl !== null ? `${trip.budgetTl} TL` : 'Not set'
          }`}
        />

        <TripStopsMap
          stops={stops}
        />

        <SectionTitle
          title="Ordered Stops"
          subtitle="The persisted backend route sequence for this trip."
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
              No persisted stops are available for this trip yet.
            </Text>
          </View>
        )}

        <SectionTitle
          title="Stop Details"
          subtitle="POI metadata returned by the backend for each persisted stop."
        />

        {sortedStops.map((stop) => (
          <InfoCard
            key={`${stop.id}-detail`}
            title={stop.poi.title}
            description={`${stop.poi.category} • ${
              stop.poi.address ?? stop.poi.district ?? 'Location unavailable'
            } • ${stop.poi.openingHours.open}-${stop.poi.openingHours.close}`}
          />
        ))}

        <View style={styles.actions}>
          <AppButton title="Back to Results" onPress={() => router.back()} />
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
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
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
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    marginBottom: theme.spacing.xl,
  },
  buttonSpacer: {
    height: 12,
  },
});
