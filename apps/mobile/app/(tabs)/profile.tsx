import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '@/components/ui/ScreenContainer';
import InfoCard from '@/components/ui/InfoCard';
import SectionTitle from '@/components/ui/SectionTitle';
import { theme } from '@/constants/theme';

export default function ProfileScreen() {
  return (
    <ScreenContainer>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>T</Text>
        </View>
        <Text style={styles.name}>Tuğçe Tepe</Text>
        <Text style={styles.email}>tripcholic.user@example.com</Text>
      </View>

      <SectionTitle title="Your Space" subtitle="Manage saved plans, favorites, and account preferences." />

      <InfoCard title="Saved Trips" description="Access previously generated or duplicated routes." />
      <InfoCard title="Favorites" description="Review your liked places and bookmarked plans." />
      <InfoCard title="Shared Routes" description="Manage routes you published to the community." />
      <InfoCard title="Settings" description="Update account, privacy, and notification preferences." />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});