import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import InfoCard from '@/components/ui/InfoCard';
import AppButton from '@/components/ui/AppButton';
import { theme } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.badge}>Tripcholic</Text>
          <Text style={styles.heroTitle}>Smarter Istanbul trips, planned around you.</Text>
          <Text style={styles.heroSubtitle}>
            Build feasible single-day routes with preference-based planning,
            natural language input, and optimization-aware suggestions.
          </Text>

          <View style={styles.heroButtons}>
            <AppButton title="Start Planning" onPress={() => router.push('/(tabs)/planner')} />
          </View>
        </View>

      <SectionTitle
        title="What makes it different?"
        subtitle="A modular planning experience designed around real travel constraints."
      />

      <InfoCard
        icon="map"
        title="Constraint-Aware Planning"
        description="Routes are designed around time, budget, travel duration, and venue availability."
      />
      <InfoCard
        icon="chatbubbles"
        title="Natural Language Input"
        description='Describe your trip naturally, like "a relaxed afternoon with good food and culture."'
      />
      <InfoCard
        icon="partly-sunny"
        title="Weather-Aware Suggestions"
        description="Get context-driven route updates and human-readable plan explanations."
      />
      <InfoCard
        icon="people"
        title="Community Discovery"
        description="Browse public routes, duplicate plans, and discover popular itineraries."
      />

              <SectionTitle
                title="Quick actions"
                subtitle="Jump into the core product flow."
              />

              <InfoCard
                title="Plan a new trip"
                description="Start a personalized route using form-based inputs or natural language."
                rightContent={
                  <Text style={styles.linkText} onPress={() => router.push('/(tabs)/planner')}>
                    Open
                  </Text>
                }
              />
              <InfoCard
                title="Explore shared plans"
                description="Browse community-created public routes and inspiration."
                rightContent={
                  <Text style={styles.linkText} onPress={() => router.push('/(tabs)/explore')}>
                    Browse
                  </Text>
                }
              />
            </ScrollView>
          </ScreenContainer>
        );
      }

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  heroTitle: {
    color: theme.colors.white,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
    marginBottom: theme.spacing.sm,
  },
  heroSubtitle: {
    color: '#D7E6EC',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  heroButtons: {
    marginTop: 4,
  },
  linkText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});