import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import InfoCard from '@/components/ui/InfoCard';
import { theme } from '@/constants/theme';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <ScreenContainer>
      <SectionTitle
        title={`Trip #${id ?? '001'}`}
        subtitle="Detailed public trip view for duplication, rating, and comments."
      />

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Historic Istanbul Route</Text>
        <Text style={styles.heroSubtitle}>
          Shared by community • Compact city-day experience
        </Text>
      </View>

      <InfoCard title="Route Summary" description="4 POIs • 6 hours • medium budget • walk-friendly" />
      <InfoCard title="Duplicate" description="Save this public trip into your own planning space." />
      <InfoCard title="Rate & Comment" description="Share quick feedback and see other users’ opinions." />
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
});