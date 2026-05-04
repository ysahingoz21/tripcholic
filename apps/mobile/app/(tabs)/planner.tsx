import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { type } from '@/constants/typography';

const OPTIMIZED_IMG = require('@/assets/images/planner/planner-optimized-trip.png');
const MANUAL_IMG = require('@/assets/images/planner/planner-own-trip.png');

export default function PlannerEntryScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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

          {/* Manual trip — visual only, coming soon */}
          <Pressable
            style={styles.card}
            onPress={() =>
              Alert.alert(
                'Coming soon',
                'Manual trip creation will be available in a future update.'
              )
            }
          >
            <View style={styles.cardImageWrap}>
              <Image source={MANUAL_IMG} style={styles.cardImage} contentFit="cover" />
              <View style={styles.cardImageDim} />
              <View style={styles.badgeOverlay}>
                <View style={styles.soonBadge}>
                  <Ionicons name="time-outline" size={10} color={theme.colors.textSecondary} />
                  <Text style={styles.soonText}>Coming soon</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Build your own trip</Text>
              <Text style={styles.cardDesc}>
                Hand-pick every stop and craft your perfect itinerary from
                scratch — entirely on your terms.
              </Text>
              <View style={styles.secondaryBtn}>
                <Ionicons name="lock-closed-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.secondaryBtnText}>Available soon</Text>
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

  // ── Hero (centered) ──
  hero: {
    paddingHorizontal: 20,   // container-padding
    paddingTop: 32,
    paddingBottom: 40,       // xl
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,        // md
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
    marginBottom: 16,        // md
  },
  subtitle: {
    ...type.bodyLg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },

  // ── Cards ──
  cards: {
    paddingHorizontal: 20,   // container-padding
    gap: 16,                 // md
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,        // xl
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

  // Image band
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
    ...type.labelCaps,
    fontSize: 11,
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
    ...type.labelCaps,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },

  // Content below image
  cardContent: {
    padding: 20,             // container-padding
    gap: 12,                 // stack-gap
  },
  cardTitle: {
    ...type.headlineLg,
    fontSize: 22,
    color: theme.colors.primaryDark,
  },
  cardDesc: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
  },

  // CTA buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,        // lg
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
    borderRadius: 16,        // lg
    paddingVertical: 15,
    marginTop: 4,
  },
  secondaryBtnText: {
    ...type.headlineMd,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
