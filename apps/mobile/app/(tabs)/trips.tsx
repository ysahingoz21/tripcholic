import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TripPreviewCard from '@/components/trip/TripPreviewCard';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import AppButton from '@/components/ui/AppButton';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getTrips,
  type TripListItem,
  type TripVisibility,
} from '@/services/trips';

function formatTripDate(date: string) {
  return new Date(date).toLocaleDateString();
}

function getVisibilityBadgeStyle(visibility: TripVisibility) {
  switch (visibility) {
    case 'PUBLIC':
      return {
        backgroundColor: '#E8F7EE',
        borderColor: '#BBE7CA',
        textColor: '#166534',
      };
    case 'PRIVATE':
      return {
        backgroundColor: '#F3F4F6',
        borderColor: '#D1D5DB',
        textColor: '#374151',
      };
    case 'DRAFT':
    default:
      return {
        backgroundColor: '#FFF7E8',
        borderColor: '#FCD89A',
        textColor: '#9A6700',
      };
  }
}

function formatVisibilityLabel(visibility: TripVisibility) {
  return visibility.charAt(0) + visibility.slice(1).toLowerCase();
}

export default function TripsScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

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
        loadError instanceof Error ? loadError.message : 'Unable to load your trips.'
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

  if (isLoading || isAuthLoading) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="My Trips"
          subtitle="Loading trips created from your account."
        />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="My Trips"
          subtitle={error}
        />
        <AppButton title="Try Again" onPress={() => void loadTrips()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionTitle
          title="My Trips"
          subtitle="Reopen trips you created and their persisted optimization results."
        />

        {trips.length > 0 ? (
          trips.map((trip) => (
            <Pressable
              key={trip.id}
              style={styles.tripCard}
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
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{trip.status}</Text>
                  </View>
                }
              />

              <View style={styles.cardFooter}>
                <View style={styles.footerLeft}>
                  <View
                    style={[
                      styles.visibilityBadge,
                      {
                        backgroundColor: getVisibilityBadgeStyle(trip.visibility)
                          .backgroundColor,
                        borderColor: getVisibilityBadgeStyle(trip.visibility).borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.visibilityText,
                        {
                          color: getVisibilityBadgeStyle(trip.visibility).textColor,
                        },
                      ]}
                    >
                      {formatVisibilityLabel(trip.visibility)}
                    </Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.footerText}>
                      {trip.optimizedAt ? 'Optimized' : 'Created'}{' '}
                      {formatTripDate(trip.optimizedAt ?? trip.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.openText}>Open</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No trips created yet</Text>
            <Text style={styles.emptyText}>
              Create a trip in the planner to start building your personal trip history.
            </Text>
            <AppButton
              title="Open Planner"
              onPress={() => router.push('/(tabs)/planner')}
            />
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tripCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  statusBadge: {
    backgroundColor: '#E7F6F4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  visibilityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    marginLeft: 6,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  openText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
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
});
