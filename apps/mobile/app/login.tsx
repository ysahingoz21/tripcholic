import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) return;
    signIn(username, password);
    router.replace('/(tabs)');
  };

  return (
    <ImageBackground
      source={require('../assets/images/login-bg.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>
            Sign in to continue to Tripcholic
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email or Username"
            placeholderTextColor="#000"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#000"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Sign In</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Don’t have an account?{' '}
            </Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text style={styles.linkText}>Create Account</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  // 🔥 Arka planı hafif karartıyoruz (çok önemli)
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    color: '#111827',
  },

  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  button: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },

  footerText: {
    color: '#6B7280',
    fontSize: 14,
  },

  linkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
});