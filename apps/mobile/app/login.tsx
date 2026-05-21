import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AuthScreenLayout from '@/components/ui/AuthScreenLayout';
import AuthInput from '@/components/ui/AuthInput';
import { font, type } from '@/constants/typography';
import { theme } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (error) {
      Alert.alert(
        'Login failed',
        error instanceof Error ? error.message : 'Unable to sign in.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenLayout tagline="Your journey through the soul of Istanbul begins here.">
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue to Tripcholic</Text>

      <View style={styles.form}>
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
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />
      </View>

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </Text>
      </Pressable>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <Link href="/register" asChild>
          <Pressable>
            <Text style={styles.linkText}>Create Account</Text>
          </Pressable>
        </Link>
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
    marginBottom: 24,
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
