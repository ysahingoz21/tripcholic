import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AuthScreenLayout from '@/components/ui/AuthScreenLayout';
import AuthInput from '@/components/ui/AuthInput';

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

      {/* Forgot password — visual only; no backend support yet */}
      <Pressable
        style={styles.forgotRow}
        onPress={() =>
          Alert.alert('Coming soon', 'Password reset will be available in a future update.')
        }
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

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
    fontSize: 26,
    fontWeight: '700',
    color: '#111C2C',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  form: {
    marginBottom: 4,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    paddingVertical: 2,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#006A69',
  },
  button: {
    backgroundColor: '#006A69',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    flexWrap: 'wrap',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
  },
  linkText: {
    color: '#006A69',
    fontSize: 14,
    fontWeight: '700',
  },
});
