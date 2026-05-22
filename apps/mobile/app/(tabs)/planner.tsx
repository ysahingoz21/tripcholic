import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { font, type } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import InfoCard from '@/components/ui/InfoCard';
import {
  getIstanbulWeather,
  type WeatherSummary,
} from '@/services/weather';
import {
  createTrip,
  optimizeTrip,
  updateTrip,
  type TripDetailResponse,
} from '@/services/trips';
import {
  buildFatihFallbackTripPayload,
  buildManualWorkingFallbackTripPayload,
  buildSmartTripPayloadsFromText,
} from '@/utils/tripPlanningPayload';

const OPTIMIZED_IMG = require('@/assets/images/planner/planner-optimized-trip.png');
const MANUAL_IMG = require('@/assets/images/planner/planner-own-trip.png');

function getRouteStopCount(tripResponse: TripDetailResponse) {
  if (Array.isArray(tripResponse.stops)) {
    return tripResponse.stops.length;
  }

  return tripResponse.optimization?.stopCount ?? 0;
}

function logPlanFromTextResponse(label: string, tripResponse: TripDetailResponse) {
  const stopCount = getRouteStopCount(tripResponse);

  console.log(label, {
    tripId: tripResponse.trip?.id,
    status: tripResponse.trip?.status,
    stopCount,
    optimizationStopCount: tripResponse.optimization?.stopCount,
    stopsLength: Array.isArray(tripResponse.stops)
      ? tripResponse.stops.length
      : undefined,
    routeName: tripResponse.optimization?.routeName,
    routeExplanation: tripResponse.optimization?.routeExplanation,
  });
}

export default function PlannerEntryScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();

  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [planText, setPlanText] = useState('');
  const [isParsingPlanText, setIsParsingPlanText] = useState(false);
  const [planTextError, setPlanTextError] = useState('');

  useEffect(() => {
    async function loadWeather() {
      try {
        const data = await getIstanbulWeather();
        setWeather(data);
      } catch (error) {
        console.error('Weather fetch failed', error);
      } finally {
        setLoadingWeather(false);
      }
    }

    loadWeather();
  }, []);

  const handleCreatePlanFromText = async () => {
    const input = planText.trim();

    if (!input) {
      setPlanTextError('Type a short trip idea first.');
      return;
    }

    if (!token) {
      setPlanTextError(
        isAuthLoading
          ? 'Restoring session. Please try again in a moment.'
          : 'Please sign in again before creating an itinerary.'
      );
      return;
    }

    setIsParsingPlanText(true);
    setPlanTextError('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const { extractedPayload, adjustedPayload, fallbackPayload } =
        buildSmartTripPayloadsFromText(input);
      console.log('Plan from Text extracted payload', extractedPayload);
      console.log('Plan from Text completed payload after defaults', adjustedPayload);

      const createdTrip = await createTrip(token, adjustedPayload);
      let optimizedTrip = await optimizeTrip(token, createdTrip.trip.id);
      logPlanFromTextResponse('Plan from Text optimizer response', optimizedTrip);

      if (getRouteStopCount(optimizedTrip) === 0) {
        console.log('Plan from Text fallback payload 1', fallbackPayload);
        await updateTrip(token, createdTrip.trip.id, fallbackPayload);
        optimizedTrip = await optimizeTrip(token, createdTrip.trip.id);
        logPlanFromTextResponse(
          'Plan from Text fallback 1 optimizer response',
          optimizedTrip
        );
      }

      if (getRouteStopCount(optimizedTrip) === 0) {
        const secondFallbackPayload =
          buildFatihFallbackTripPayload(adjustedPayload);
        console.log('Plan from Text fallback payload 2', secondFallbackPayload);
        await updateTrip(token, createdTrip.trip.id, secondFallbackPayload);
        optimizedTrip = await optimizeTrip(token, createdTrip.trip.id);
        logPlanFromTextResponse(
          'Plan from Text fallback 2 optimizer response',
          optimizedTrip
        );
      }

      if (getRouteStopCount(optimizedTrip) === 0) {
        const manualWorkingPayload = buildManualWorkingFallbackTripPayload();
        console.log('Plan from Text manual working payload', manualWorkingPayload);
        const fallbackTrip = await createTrip(token, manualWorkingPayload);
        optimizedTrip = await optimizeTrip(token, fallbackTrip.trip.id);
        logPlanFromTextResponse(
          'Plan from Text hard fallback optimizer response',
          optimizedTrip
        );
      }

      const finalStopCount = getRouteStopCount(optimizedTrip);

      if (finalStopCount === 0) {
        console.log('Plan from Text all attempts returned zero stops', {
          input,
          extractedPayload,
          adjustedPayload,
          fallbackPayload,
          manualWorkingPayload: buildManualWorkingFallbackTripPayload(),
          finalOptimization: optimizedTrip.optimization,
          finalStops: optimizedTrip.stops,
        });
        throw new Error(
          'Backend returned zero route stops. Check the Plan from Text logs for the payload and optimizer response.'
        );
      }

      console.log('Plan from Text final successful route', {
        tripId: optimizedTrip.trip.id,
        stopCount: finalStopCount,
        optimizationStopCount: optimizedTrip.optimization?.stopCount,
        routeName: optimizedTrip.optimization?.routeName,
        routeExplanation: optimizedTrip.optimization?.routeExplanation,
      });

      router.push({
        pathname: '/results',
        params: { tripId: optimizedTrip.trip.id },
      });
    } catch (error) {
      setPlanTextError(
        error instanceof Error
          ? error.message
          : 'Could not create an itinerary from that text.'
      );
    } finally {
      setIsParsingPlanText(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero ─── */}
        <View style={styles.hero}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>Istanbul</Text>
          </View>
          <Text style={styles.title}>Design your{'\n'}perfect day.</Text>
          <Text style={styles.subtitle}>
            Tell us your interests and we'll craft the ideal route — tuned to
            your pace, budget, and schedule.
          </Text>
        </View>

        <View style={styles.weatherWrap}>
          {loadingWeather ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : weather ? (
            <InfoCard
            icon={weather.isOutdoorFriendly ? 'partly-sunny' : 'rainy'}
            title={`${weather.condition} · ${weather.temperature}°C in ${weather.city}`}
            description={`${weather.suggestion}\n\nRain chance: ${weather.precipitationProbability}%.`}
            />
          ) : null}
        </View>

        <View style={styles.smartCardWrap}>
          <View style={styles.smartCard}>
            <View style={styles.smartHeaderRow}>
              <View style={styles.smartIconCircle}>
                <Ionicons name="sparkles-outline" size={18} color="#006A69" />
              </View>
              <View style={styles.smartHeaderText}>
                <Text style={styles.smartTitle}>Plan from Text</Text>
                <Text style={styles.smartDesc}>
                  Describe your trip in one sentence and we will create the itinerary.
                </Text>
              </View>
            </View>

            <TextInput
              style={styles.smartInput}
              placeholder="22 Mayıs Cuma günü saat 18:00’de Kadıköy’de kültürel bir gezi planlamak istiyorum."
              placeholderTextColor="#A0ADB4"
              value={planText}
              onChangeText={(value) => {
                setPlanText(value);
                if (planTextError) setPlanTextError('');
              }}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
              autoCorrect
              maxLength={220}
            />

            {planTextError ? (
              <Text style={styles.smartError}>{planTextError}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.smartButton,
                (isParsingPlanText || isAuthLoading) && styles.smartButtonDisabled,
                pressed && styles.smartButtonPressed,
              ]}
              onPress={handleCreatePlanFromText}
              disabled={isParsingPlanText || isAuthLoading}
            >
              {isParsingPlanText ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.smartButtonText}>
                {isParsingPlanText ? 'Creating your itinerary...' : 'Create Plan from Text'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ─── Mode cards ─── */}
        <View style={styles.cards}>
          {/* Optimised trip — primary, fully wired */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push('/planner-wizard')}
          >
            <View style={styles.cardImageWrap}>
              <Image source={OPTIMIZED_IMG} style={styles.cardImage} contentFit="cover" />
              <View style={styles.badgeOverlay}>
                <View style={styles.recommendedBadge}>
                  <Ionicons name="flash" size={10} color="#006A69" />
                  <Text style={styles.recommendedText}>Recommended</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Smart trip planner</Text>
              <Text style={styles.cardDesc}>
                Share your interests and travel style — our engine builds a
                perfect route around your schedule.
              </Text>
              <View style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Generate itinerary</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </View>
            </View>
          </Pressable>

          {/* Manual trip — fully wired */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push('/manual-trip-wizard' as any)}
          >
            <View style={styles.cardImageWrap}>
              <Image source={MANUAL_IMG} style={styles.cardImage} contentFit="cover" />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Build your own trip</Text>
              <Text style={styles.cardDesc}>
                Hand-pick every stop and craft your perfect itinerary from
                scratch — entirely on your terms.
              </Text>
              <View style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Build trip</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  eyebrow: {
    ...type.labelCaps,
    color: theme.colors.primary,
  },
  title: {
    ...type.displayLg,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    ...type.bodyLg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  weatherWrap: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  smartCardWrap: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  smartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  smartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  smartIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartHeaderText: {
    flex: 1,
    gap: 2,
  },
  smartTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.primaryDark,
  },
  smartDesc: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
  smartInput: {
    minHeight: 88,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primaryDark,
    marginBottom: 12,
  },
  smartError: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 17,
    color: '#B42318',
    marginTop: -4,
    marginBottom: 10,
  },
  smartButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#006A69',
    borderRadius: 13,
    gap: 8,
  },
  smartButtonDisabled: {
    opacity: 0.7,
  },
  smartButtonPressed: {
    opacity: 0.9,
  },
  smartButtonText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  cards: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.93,
  },
  cardImageWrap: {
    height: 180,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  recommendedText: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: '#006A69',
  },
  soonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  soonText: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: theme.colors.textSecondary,
  },
  cardContent: {
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    ...type.headlineLg,
    fontSize: 19,
    color: theme.colors.primaryDark,
  },
  cardDesc: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 4,
  },
  primaryBtnText: {
    ...type.headlineMd,
    fontSize: 15,
    color: '#fff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 4,
  },
  secondaryBtnText: {
    ...type.headlineMd,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  selectorChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  selectorChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectorChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  selectorChipTextSelected: {
    color: '#FFFFFF',
  },
});
