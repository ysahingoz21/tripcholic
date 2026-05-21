import { getSortedTripStops } from '@/components/trip/tripMapUtils';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { getTrip, type TripDetailResponse } from '@/services/trips';
import {
  getIstanbulWeather,
  type WeatherSummary,
} from '@/services/weather';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import TripStopsMap from '../components/trip/TripStopsMap';

// ── Helpers ───────────────────────────────────────────────────────────────────

function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateLabel(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    undefined,
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    },
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────
// Back → Home · TRIPCHOLIC wordmark · initials avatar.

function PageHeader({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((w) => w[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'T');

  return (
    <View style={[hdrStyles.header, { paddingTop: insets.top }]}>
      <View style={hdrStyles.inner}>
        <View style={hdrStyles.side}>
          <Pressable
            style={({ pressed }) => [
              hdrStyles.iconBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={onBack}
            hitSlop={8}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={theme.colors.primaryDark}
            />
          </Pressable>
        </View>

        <Text style={hdrStyles.wordmark} numberOfLines={1}>
          TRIPCHOLIC
        </Text>

        <View style={[hdrStyles.side, hdrStyles.sideRight]}>
          <View style={hdrStyles.avatar}>
            <Text style={hdrStyles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  inner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  side: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 3,
    color: theme.colors.primaryDark,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    color: '#FFFFFF',
  },
});

// ── NewTimelineItem ───────────────────────────────────────────────────────────
// Matches the timeline style used on the post pages.

type StopData = TripDetailResponse['stops'][number];

function NewTimelineItem({
  stop,
  isLast,
}: {
  stop: StopData;
  isLast: boolean;
}) {
  const imageUrl = stop.poi.imageUrl?.trim() || null;
  const poiName =
    stop.poi.title.trim() || stop.title.trim() || `Stop ${stop.order}`;
  const description =
    stop.poi.description?.trim() ||
    `${capFirst(stop.poi.category)} spot${stop.poi.district ? ` in ${stop.poi.district}` : ''}.`;

  return (
    <View style={tlStyles.row}>
      {/* Marker column */}
      <View style={tlStyles.markerCol}>
        <View style={tlStyles.dot}>
          <Ionicons name="location" size={11} color="#FFFFFF" />
        </View>
        {!isLast && <View style={tlStyles.line} />}
      </View>

      {/* Card */}
      <View style={[tlStyles.card, isLast && tlStyles.cardLast]}>
        <View style={tlStyles.topRow}>
          <Text style={tlStyles.stopTime}>{stop.arrivalTime}</Text>
          <View style={tlStyles.categoryBadge}>
            <Text style={tlStyles.categoryText}>
              {capFirst(stop.poi.category)}
            </Text>
          </View>
        </View>

        <Text style={tlStyles.poiName} numberOfLines={2}>
          {poiName}
        </Text>

        <Image
          source={
            imageUrl
              ? { uri: imageUrl }
              : require('../assets/images/placeholders/default-poi.png')
          }
          style={tlStyles.poiImage}
          contentFit="cover"
          transition={150}
        />

        <Text style={tlStyles.description} numberOfLines={3}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  markerCol: {
    width: 28,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    flexShrink: 0,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.primary,
    opacity: 0.25,
    marginTop: 4,
  },
  card: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 24,
    gap: 8,
  },
  cardLast: { paddingBottom: 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stopTime: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 0.1,
  },
  categoryBadge: {
    backgroundColor: '#DFF7F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: '#006A69',
    letterSpacing: 0.2,
  },
  poiName: {
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    marginTop: -2,
  },
  poiImage: {
    height: 252,
    borderRadius: 12,
  },
  description: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherSummary | null>(null);

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
            : 'Unable to load trip results.',
        );
      } finally {
        setIsLoading(false);
      }
    }
    void loadTrip();
  }, [token, tripId, isAuthLoading]);

  useEffect(() => {
  async function loadWeather() {
    try {
      const data = await getIstanbulWeather();
      setWeather(data);
    } catch (error) {
      console.error('Weather fetch failed', error);
    }
  }

  loadWeather();
}, []);

  const handleGoHome = () => router.replace('/(tabs)');

  // These must be unconditional — computed from tripDetail when available.
  const sortedStops = useMemo(
    () => getSortedTripStops(tripDetail?.stops ?? []),
    [tripDetail?.stops],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          [
            tripDetail?.preview.primaryCategory,
            ...(tripDetail?.trip.categories ?? []),
          ].filter((c): c is string => Boolean(c)),
        ),
      ).map(capFirst),
    [tripDetail?.preview.primaryCategory, tripDetail?.trip.categories],
  );

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <PageHeader onBack={handleGoHome} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateTitle}>Preparing your route…</Text>
          <Text style={styles.stateBody}>
            We're pulling together your optimized trip.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error || !tripDetail) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <PageHeader onBack={handleGoHome} />
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>Route unavailable</Text>
          <Text style={styles.stateBody}>
            {error ?? 'Trip result could not be loaded.'}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={handleGoHome}>
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  const { trip, optimization, preview, stops } = tripDetail;
  const coverImageUrl = preview.imageUrl?.trim() || null;

  const routeDescription =
    optimization.routeExplanation?.trim() ||
    `An AI-optimized route with ${optimization.stopCount} stop${optimization.stopCount === 1 ? '' : 's'} across Istanbul, built around your time and preferences.`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <PageHeader onBack={handleGoHome} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1 ── Trip title ────────────────────────────────────────────────── */}
        <View style={styles.titleBlock}>
          <Text style={styles.readyEyebrow}>YOUR TRIP IS READY</Text>
          <Text style={styles.tripTitle}>{trip.title}</Text>
        </View>

        {/* 2 ── Hero / cover ────────────────────────────────────────────── */}
        <View style={styles.heroContainer}>
          {coverImageUrl ? (
            <Image
              source={{ uri: coverImageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Artwork kind="trip" variant="cover" label={trip.title} />
          )}

          {/* Dark scrim over the lower portion */}
          <View style={styles.heroScrim} />

          {/* AI badge + description */}
          <View style={styles.heroContent}>
            <View style={styles.aiPill}>
              <Ionicons name="flash" size={12} color="#FFFFFF" />
              <Text style={styles.aiPillText}>AI RECOMMENDED</Text>
            </View>
            <Text style={styles.heroDesc} numberOfLines={4}>
              {routeDescription}
            </Text>
          </View>
        </View>

        {/* 3 ── Metrics grid ──────────────────────────────────────────────── */}
        <View style={styles.metricsGrid}>
          {(
            [
              {
                icon: 'location-outline' as const,
                label: 'Stops',
                value: String(optimization.stopCount),
              },
              {
                icon: 'time-outline' as const,
                label: 'Duration',
                value:
                  optimization.routeTotalDurationMin !== null
                    ? `${optimization.routeTotalDurationMin} min`
                    : '—',
              },
              {
                icon: 'cash-outline' as const,
                label: 'Est. Cost',
                value:
                  optimization.routeTotalCostTl !== null
                    ? `${optimization.routeTotalCostTl} TL`
                    : '—',
              },
              {
                icon: 'walk-outline' as const,
                label: 'Distance',
                value:
                  optimization.routeTotalDistanceKm !== null
                    ? `${optimization.routeTotalDistanceKm} km`
                    : '—',
              },
            ] as const
          ).map(({ icon, label, value }) => (
            <View key={label} style={styles.metricCell}>
              <View style={styles.metricIconCircle}>
                <Ionicons name={icon} size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>
       

       {weather ? (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>AI CONTEXT</Text>
      <Text style={styles.sectionTitle}>Weather Insight</Text>
    </View>

    <View style={styles.weatherInsightCard}>
      <View style={styles.weatherInsightTop}>
        <Ionicons
          name={
            weather.isOutdoorFriendly ? 'partly-sunny' : 'rainy'
          }
          size={18}
          color={theme.colors.primary}
        />

        <Text style={styles.weatherInsightTitle}>
          {weather.condition} · {weather.temperature}°C
        </Text>
      </View>

      <Text style={styles.weatherInsightText}>
        {weather.suggestion}
      </Text>

      <Text style={styles.weatherInsightMeta}>
        Rain probability: {weather.precipitationProbability}%
      </Text>

      <Text style={styles.weatherInsightMeta}>
        Route strategy:{' '}
        {weather.isOutdoorFriendly
          ? 'Outdoor-focused recommendations enabled.'
          : 'Indoor-friendly alternatives prioritized.'}
      </Text>
    </View>
  </View>
  ) : null}
      
        {/* 4 ── Categories ────────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>HIGHLIGHTS</Text>
              <Text style={styles.sectionTitle}>Categories</Text>
            </View>
            <View style={styles.categoryChips}>
              {categories.map((cat) => (
                <View key={cat} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{cat}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 5 ── Date & Time ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>WHEN</Text>
            <Text style={styles.sectionTitle}>Date & Time</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconCircle}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.infoTextBlock}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{formatDateLabel(trip.date)}</Text>
              </View>
            </View>

            {(trip.timeStart || trip.timeEnd) ? (
              <>
                <View style={styles.infoSep} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconCircle}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={styles.infoTextBlock}>
                    <Text style={styles.infoLabel}>Available Time</Text>
                    <Text style={styles.infoValue}>
                      {trip.timeStart ?? '—'} – {trip.timeEnd ?? '—'}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* 6 ── Trip Stop Map ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>ROUTE</Text>
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name="map-outline"
                size={16}
                color={theme.colors.primaryDark}
              />
              <Text style={styles.sectionTitle}>Trip Stop Map</Text>
            </View>
          </View>
          <TripStopsMap stops={stops} hideTitle />
        </View>

        {/* 7 ── Timeline ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>ITINERARY</Text>
            <Text style={styles.sectionTitle}>Timeline</Text>
          </View>

          {sortedStops.length > 0 ? (
            <View>
              {sortedStops.map((stop, index) => (
                <NewTimelineItem
                  key={stop.id}
                  stop={stop}
                  isLast={index === sortedStops.length - 1}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons
                name="map-outline"
                size={28}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.emptyText}>
                No stops available for this trip yet.
              </Text>
            </View>
          )}
        </View>

        {/* 8 ── Why this route works ──────────────────────────────────────── */}
        {optimization.routeExplanation ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Why this route works</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.explanationText}>
                {optimization.routeExplanation}
              </Text>
            </View>
          </View>
        ) : null}

        {/* 9 ── CTAs ──────────────────────────────────────────────────────── */}
        <View style={styles.ctaGroup}>
          {/* Primary: Open trip */}
          <Pressable
            style={({ pressed }) => [
              styles.openTripBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={() =>
              router.push(
                trip.visibility === 'PUBLIC'
                  ? (`/public-trip/${trip.id}` as any)
                  : (`/trip/${trip.id}` as any),
              )
            }
          >
            <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
            <Text style={styles.openTripBtnText}>Open trip</Text>
          </Pressable>

          {/* Secondary row: My Trips + Home */}
          <View style={styles.secondaryRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.82 },
              ]}
              onPress={() => router.replace('/(tabs)/trips')}
            >
              <Ionicons
                name="map-outline"
                size={15}
                color={theme.colors.primaryDark}
              />
              <Text style={styles.secondaryBtnText}>Go to My Trips</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.82 },
              ]}
              onPress={handleGoHome}
            >
              <Ionicons
                name="home-outline"
                size={15}
                color={theme.colors.primaryDark}
              />
              <Text style={styles.secondaryBtnText}>Go to Home Page</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 56,
    gap: 24,
  },

  // ── Loading / error states ──
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  stateTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: font.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Trip title block ──
  titleBlock: {
    paddingTop: 20,
    gap: 6,
  },
  readyEyebrow: {
    fontFamily: font.bold,
    fontSize: 10,
    color: theme.colors.primary,
    letterSpacing: 1.5,
  },
  tripTitle: {
    fontFamily: font.bold,
    fontSize: 28,
    lineHeight: 34,
    color: theme.colors.primaryDark,
    letterSpacing: -0.4,
  },

  // ── Hero cover ──
  heroContainer: {
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.primaryDark,
  },
  heroScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(11,36,48,0.82)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    gap: 10,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  aiPillText: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  heroDesc: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.88)',
  },

  // ── Metrics grid ──
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontFamily: font.bold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  metricLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // ── Section wrapper ──
  section: {
    gap: 12,
  },

  // ── Section header ──
  sectionHeader: {
    gap: 2,
  },
  sectionEyebrow: {
    fontFamily: font.bold,
    fontSize: 10,
    color: theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ── Categories ──
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#DFF7F6',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,106,105,0.18)',
  },
  categoryChipText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: '#006A69',
  },

  // ── Date & Time info card ──
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoTextBlock: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontFamily: font.medium,
    fontSize: 11,
    color: theme.colors.textSecondary,
    letterSpacing: 0.1,
  },
  infoValue: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  infoSep: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // ── Generic card (explanation) ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 16,
  },
  explanationText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },

  // ── Empty state ──
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // ── CTAs ──
  ctaGroup: {
    gap: 10,
    marginTop: 4,
  },
  openTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    height: 54,
  },
  openTripBtnText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    paddingHorizontal: 6,
  },
  secondaryBtnText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: theme.colors.primaryDark,
  },

  weatherInsightCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  borderWidth: 1,
  borderColor: '#E8ECF0',
  padding: 16,
  gap: 10,
},

weatherInsightTop: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},

weatherInsightTitle: {
  fontFamily: font.bold,
  fontSize: 15,
  color: theme.colors.primaryDark,
},

weatherInsightText: {
  fontFamily: font.regular,
  fontSize: 14,
  lineHeight: 21,
  color: theme.colors.textSecondary,
},

weatherInsightMeta: {
  fontFamily: font.medium,
  fontSize: 12,
  color: theme.colors.primary,
},
});
