import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AuthScreenLayout from '@/components/ui/AuthScreenLayout';
import AuthInput from '@/components/ui/AuthInput';
import { font, type } from '@/constants/typography';
import { theme } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateAccount = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Missing information', 'Please fill in email and password fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await signUp(
        email.trim(),
        password,
        fullName.trim() ? fullName.trim() : undefined
      );
      router.replace('/');
    } catch (error) {
      Alert.alert(
        'Registration failed',
        error instanceof Error ? error.message : 'Unable to create account.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenLayout tagline="Start your curated journey across the globe.">
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>
        Join Tripcholic and start planning smarter trips.
      </Text>

      <View style={styles.form}>
        <AuthInput
          icon="person-outline"
          placeholder="Full Name (Optional)"
          value={fullName}
          onChangeText={setFullName}
          returnKeyType="next"
        />
        <AuthInput
          icon="mail-outline"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />
        <AuthInput
          icon="lock-closed-outline"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="next"
        />
        <AuthInput
          icon="lock-closed-outline"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleCreateAccount}
        />
      </View>

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleCreateAccount}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? 'Creating Account…' : 'Create Account'}
        </Text>
      </Pressable>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={styles.linkText}>Sign In</Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.headlineLg,
    fontSize: 26,
    color: theme.colors.primaryDark,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },
  form: {
    marginBottom: 8,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.surface,
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    flexWrap: 'wrap',
  },
  footerText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  linkText: {
    fontFamily: font.bold,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.primary,
  },
});
