import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AuthScreenLayout from '@/components/ui/AuthScreenLayout';
import AuthInput from '@/components/ui/AuthInput';

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
    marginBottom: 8,
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
