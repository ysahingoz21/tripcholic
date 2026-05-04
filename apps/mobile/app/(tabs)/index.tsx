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
import { SafeAreaView } from 'react-native-safe-area-context';
import TripSnapshotCard from '@/components/trip/TripSnapshotCard';
import { theme } from '@/constants/theme';
import { type, font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { getTrips, type TripListItem } from '@/services/trips';
import { buildTripDetailParams } from '@/utils/tripNavigation';

const H_PAD = 20;

const TUTORIAL_CARDS = [
  {
    id: 'plan',
    icon: 'map-outline' as const,
    title: 'Plan a route',
    description:
      'Build feasible single-day paths around your time, budget, and interests.',
  },
  {
    id: 'nlp',
    icon: 'chatbubbles-outline' as const,
    title: 'Talk to the planner',
    description:
      'Describe your trip naturally and let AI suggest the best route for you.',
  },
  {
    id: 'explore',
    icon: 'compass-outline' as const,
    title: 'Explore the city',
    description:
      'Browse public itineraries created by the Tripcholic community.',
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();

  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  const loadTrips = useCallback(async () => {
    if (isAuthLoading || !token) {
      setTripsLoading(false);
      return;
    }
    try {
      setTripsLoading(true);
      const data = await getTrips(token);
      setTrips(data.slice(0, 5));
    } catch {
      setTrips([]);
    } finally {
      setTripsLoading(false);
    }
  }, [token, isAuthLoading]);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Hero ─── */}
          <View style={styles.hero}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.heroEyebrow}>Istanbul</Text>
            </View>
            <Text style={styles.heroTitle}>{'Discover\nIstanbul.'}</Text>
            <Text style={styles.heroSubtitle}>
              Curated single-day itineraries built around your time, budget,
              and travel style.
            </Text>
          </View>

          {/* ─── Get started ─── */}
          <Text style={[styles.sectionTitle, styles.sectionPadded]}>
            Get started
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            style={styles.carousel}
          >
            {TUTORIAL_CARDS.map((card) => (
              <View key={card.id} style={styles.tutorialCard}>
                <View style={styles.tutorialIconWrap}>
                  <Ionicons
                    name={card.icon}
                    size={20}
                    color={theme.colors.primaryDark}
                  />
                </View>
                <Text style={styles.tutorialTitle}>{card.title}</Text>
                <Text style={styles.tutorialBody}>{card.description}</Text>
              </View>
            ))}
          </ScrollView>

          {/* ─── My Recent Trips ─── */}
          <View style={[styles.sectionRow, styles.sectionPadded]}>
            <Text style={styles.sectionTitle}>My Recent Trips</Text>
            <Pressable onPress={() => router.push('/(tabs)/trips')} hitSlop={8}>
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          </View>

          {tripsLoading ? (
            <View style={styles.tripsLoader}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : trips.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
              style={styles.carousel}
            >
              {trips.map((trip) => (
                <TripSnapshotCard
                  key={trip.id}
                  trip={trip}
                  onPress={() =>
                    router.push(
                      buildTripDetailParams(trip.id, { source: 'my-trips' })
                    )
                  }
                />
              ))}
              <Pressable
                style={styles.viewAllCard}
                onPress={() => router.push('/(tabs)/trips')}
              >
                <Ionicons
                  name="grid-outline"
                  size={22}
                  color={theme.colors.primary}
                />
                <Text style={styles.viewAllCardText}>All trips</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={styles.emptyTrips}>
              <Ionicons
                name="map-outline"
                size={28}
                color={theme.colors.primary}
              />
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptyBody}>
                Trips you create will appear here.
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/planner')}
              >
                <Text style={styles.emptyButtonText}>Plan your first trip</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* ─── Floating + button ─── */}
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/(tabs)/planner')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Hero (centered) ──
  hero: {
    paddingHorizontal: H_PAD,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  heroEyebrow: {
    ...type.labelCaps,
    color: theme.colors.primary,
  },
  heroTitle: {
    ...type.displayLg,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginBottom: 14,
  },
  heroSubtitle: {
    ...type.bodyLg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },

  // ── Sections ──
  sectionPadded: {
    paddingHorizontal: H_PAD,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewAllText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.primary,
  },

  // ── Carousel shared ──
  carousel: {
    marginBottom: 28,
  },
  carouselContent: {
    paddingHorizontal: H_PAD,
    gap: 12,
  },

  // ── Tutorial cards ──
  tutorialCard: {
    width: 152,
    backgroundColor: '#EBEEF0',
    borderRadius: 16,
    padding: 16,
  },
  tutorialIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11,59,74,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tutorialTitle: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primaryDark,
    marginBottom: 5,
  },
  tutorialBody: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },

  // ── Trips loading ──
  tripsLoader: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },

  // ── "All trips" ghost tile — matches TripSnapshotCard image dimensions ──
  viewAllCard: {
    width: 216,
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewAllCardText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // ── Empty trips ──
  emptyTrips: {
    marginHorizontal: H_PAD,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  emptyTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
    marginTop: 4,
  },
  emptyBody: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  emptyButtonText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Floating action button ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0B3B4A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
