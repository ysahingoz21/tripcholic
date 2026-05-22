import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/ui/UserAvatar';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AppDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = screenWidth * 0.72;

  const [mounted, setMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      setMounted(true);
      const id = requestAnimationFrame(() => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
      return () => cancelAnimationFrame(id);
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const overlayOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] });

  function navigate(path: string) {
    onClose();
    const isTab = path.startsWith('/(tabs)');
    setTimeout(() => isTab ? router.navigate(path as any) : router.push(path as any), 180);
  }

  async function handleSignOut() {
    onClose();
    await signOut();
    router.replace('/login');
  }

  const displayName = user?.displayName?.trim() || user?.email || 'Traveller';

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
        {/* Header: avatar + name */}
        <View style={styles.profileSection}>
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            displayName={user?.displayName}
            email={user?.email}
            size={56}
            variant="drawer"
          />
          <Text style={styles.displayName} numberOfLines={2}>{displayName}</Text>
        </View>

        <View style={styles.divider} />

        {/* Menu items */}
        <View style={styles.menu}>
          <MenuItem
            icon="person-outline"
            label="View Profile"
            onPress={() => navigate('/(tabs)/profile')}
          />
          <MenuItem
            icon="create-outline"
            label="Edit Profile"
            onPress={() => navigate('/edit-profile')}
          />
          <MenuItem
            icon="bookmark-outline"
            label="Saved Trips"
            onPress={() => navigate('/saved-trips')}
          />

          <View style={styles.menuDivider} />

          <MenuItem
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
        </View>

      </Animated.View>
    </Modal>
  );
}

type MenuItemProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

function MenuItem({ icon, label, onPress, destructive = false }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? '#EF4444' : theme.colors.primaryDark}
        style={styles.menuItemIcon}
      />
      <Text style={[styles.menuItemLabel, destructive && styles.menuItemLabelDestructive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },

  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },

  profileSection: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 12,
  },
  displayName: {
    fontFamily: font.semiBold,
    fontSize: 16,
    color: theme.colors.primaryDark,
    lineHeight: 22,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: 0,
  },

  menu: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 14,
  },
  menuItemPressed: {
    backgroundColor: theme.colors.background,
  },
  menuItemIcon: {
    width: 22,
    textAlign: 'center',
  },
  menuItemLabel: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  menuItemLabelDestructive: {
    color: '#EF4444',
  },

  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
    marginHorizontal: 8,
  },

});
