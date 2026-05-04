import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';

export default function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((w) => w[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'T');

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.inner}>

        {/* Left — menu icon (non-functional placeholder for future drawer) */}
        <View style={styles.side}>
          <View style={styles.iconBtn}>
            <Ionicons name="menu" size={22} color={theme.colors.primaryDark} />
          </View>
        </View>

        {/* Center — app wordmark */}
        <Text style={styles.wordmark} numberOfLines={1}>
          TRIPCHOLIC
        </Text>

        {/* Right — profile avatar → navigates to Profile */}
        <View style={[styles.side, styles.sideRight]}>
          <Pressable
            style={({ pressed }) => [
              styles.avatar,
              pressed && styles.avatarPressed,
            ]}
            onPress={() => router.push('/(tabs)/profile')}
            hitSlop={8}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  inner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  // ── Left / right slots ──
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Wordmark ──
  wordmark: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 3,
    color: theme.colors.primaryDark,
  },

  // ── Avatar ──
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: {
    opacity: 0.75,
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    color: '#FFFFFF',
  },
});
