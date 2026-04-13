import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenContainer from '@/components/ui/ScreenContainer';
import InfoCard from '@/components/ui/InfoCard';
import SectionTitle from '@/components/ui/SectionTitle';
import AppButton from '@/components/ui/AppButton';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  };

  const email = user?.email ?? 'Not signed in';
  const avatarLetter = email.charAt(0).toUpperCase() || 'U';

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.name}>Signed In</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        <SectionTitle
          title="Your Space"
          subtitle="Account surfaces beyond the core trip flow are still limited in the current MVP."
        />

        <InfoCard
          title="Saved Trips"
          description="Bookmarking or saving trips is a future feature and is not connected yet."
        />
        <InfoCard title="Favorites" description="Review your liked places and bookmarked plans." />
        <InfoCard title="Shared Routes" description="Manage routes you published to the community." />
        <InfoCard title="Settings" description="Update account, privacy, and notification preferences." />

        <View style={styles.logoutContainer}>
          <AppButton
            title={isSigningOut ? 'Signing Out...' : 'Log Out'}
            onPress={handleLogout}
            disabled={isSigningOut}
          />
        </View>
      </ScrollView>
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
  logoutContainer: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
});
