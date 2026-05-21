import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import AppDrawer from './AppDrawer';
import UserAvatar from './UserAvatar';

export default function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.inner}>

          {/* Left — menu icon opens drawer */}
          <View style={styles.side}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              onPress={() => setDrawerOpen(true)}
              hitSlop={8}
            >
              <Ionicons name="menu" size={22} color={theme.colors.primaryDark} />
            </Pressable>
          </View>

          {/* Center — app wordmark */}
          <Text style={styles.wordmark} numberOfLines={1}>
            TRIPCHOLIC
          </Text>

          {/* Right — profile avatar → navigates to Profile */}
          <View style={[styles.side, styles.sideRight]}>
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={8}
            >
              <UserAvatar
                avatarUrl={user?.avatarUrl}
                displayName={user?.displayName}
                email={user?.email}
                size={32}
                variant="header"
              />
            </Pressable>
          </View>

        </View>
      </View>

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
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

});
