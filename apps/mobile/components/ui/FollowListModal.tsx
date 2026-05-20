import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import {
  followUser,
  getUserFollowers,
  getUserFollowing,
  removeFollower,
  unfollowUser,
  type FollowListItem,
} from '@/services/users';

function getAvatarLabel(displayName: string | null): string {
  const source = displayName?.trim() || 'T';
  const parts = source.split(/[\s._-]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

type Props = {
  visible: boolean;
  onClose: () => void;
  type: 'followers' | 'following';
  targetUserId: string;
  isOwnProfile: boolean;
  token: string | null;
  currentUserId: string | null;
  onFollowerCountChange?: (delta: number) => void;
  onFollowingCountChange?: (delta: number) => void;
};

export default function FollowListModal({
  visible,
  onClose,
  type,
  targetUserId,
  isOwnProfile,
  token,
  currentUserId,
  onFollowerCountChange,
  onFollowingCountChange,
}: Props) {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  const [items, setItems] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // ── Frozen list type ───────────────────────────────────────────────────────
  // activeType is captured when the modal opens and never updated while it is
  // closing. This prevents the parent's `type ?? 'followers'` fallback from
  // flipping the content to "Followers" during the 160 ms close animation.
  const [activeType, setActiveType] = useState<'followers' | 'following'>(type);

  useEffect(() => {
    if (visible) setActiveType(type);
  }, [visible, type]);

  // ── Animation ──────────────────────────────────────────────────────────────
  const [modalMounted, setModalMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      setModalMounted(true);
      const id = requestAnimationFrame(() => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 210,
          useNativeDriver: true,
        }).start();
      });
      return () => cancelAnimationFrame(id);
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setModalMounted(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const data =
        activeType === 'followers'
          ? await getUserFollowers(targetUserId, token)
          : await getUserFollowing(targetUserId, token);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [activeType, targetUserId, token]);

  useEffect(() => {
    if (visible) {
      void loadList();
    }
  }, [visible, loadList]);

  const markPending = (id: string) =>
    setPendingIds((prev) => new Set(prev).add(id));

  const clearPending = (id: string) =>
    setPendingIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });

  const handleUnfollow = async (item: FollowListItem) => {
    if (!token || pendingIds.has(item.id)) return;
    markPending(item.id);
    try {
      await unfollowUser(item.id, token);
      if (isOwnProfile && activeType === 'following') {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onFollowingCountChange?.(-1);
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isFollowedByMe: false } : i)),
        );
      }
    } catch {
      /* keep existing state */
    } finally {
      clearPending(item.id);
    }
  };

  const handleFollow = async (item: FollowListItem) => {
    if (!token || pendingIds.has(item.id)) return;
    markPending(item.id);
    try {
      await followUser(item.id, token);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isFollowedByMe: true } : i)),
      );
    } catch {
      /* keep existing state */
    } finally {
      clearPending(item.id);
    }
  };

  const handleRemove = async (item: FollowListItem) => {
    if (!token || pendingIds.has(item.id)) return;
    markPending(item.id);
    try {
      await removeFollower(targetUserId, item.id, token);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onFollowerCountChange?.(-1);
    } catch {
      /* keep existing state */
    } finally {
      clearPending(item.id);
    }
  };

  const handleUserPress = (userId: string) => {
    onClose();
    setTimeout(() => {
      if (userId === currentUserId) {
        router.push('/(tabs)/profile' as any);
      } else {
        router.push(`/profile/${userId}` as any);
      }
    }, 50);
  };

  const renderItem = ({ item, index }: { item: FollowListItem; index: number }) => {
    const isPending = pendingIds.has(item.id);
    const isLast = index === items.length - 1;
    const isSelf = item.id === currentUserId;

    let buttonLabel: string;
    let buttonVariant: 'follow' | 'following' | 'remove';
    let onButtonPress: () => void;

    if (isOwnProfile) {
      if (activeType === 'following') {
        buttonLabel = isPending ? '…' : 'Following';
        buttonVariant = 'following';
        onButtonPress = () => void handleUnfollow(item);
      } else {
        buttonLabel = isPending ? '…' : 'Remove';
        buttonVariant = 'remove';
        onButtonPress = () => void handleRemove(item);
      }
    } else if (item.isFollowedByMe) {
      buttonLabel = isPending ? '…' : 'Following';
      buttonVariant = 'following';
      onButtonPress = () => void handleUnfollow(item);
    } else {
      buttonLabel = isPending ? '…' : 'Follow';
      buttonVariant = 'follow';
      onButtonPress = () => void handleFollow(item);
    }

    return (
      <View>
        <Pressable
          style={({ pressed }) => [rowStyles.row, pressed && { backgroundColor: '#F8FAFC' }]}
          onPress={() => handleUserPress(item.id)}
        >
          <View style={rowStyles.avatar}>
            <Text style={rowStyles.avatarText}>{getAvatarLabel(item.displayName)}</Text>
          </View>
          <Text style={rowStyles.name} numberOfLines={1}>
            {item.displayName?.trim() || 'Tripcholic Traveler'}
          </Text>
          {token && !isSelf && (
            <Pressable
              style={({ pressed }) => [
                rowStyles.btn,
                buttonVariant === 'follow' && rowStyles.btnFollow,
                buttonVariant === 'following' && rowStyles.btnFollowing,
                buttonVariant === 'remove' && rowStyles.btnRemove,
                (pressed || isPending) && { opacity: 0.7 },
              ]}
              onPress={onButtonPress}
              disabled={isPending}
              hitSlop={4}
            >
              <Text
                style={[
                  rowStyles.btnText,
                  buttonVariant === 'follow' && rowStyles.btnFollowText,
                  buttonVariant === 'following' && rowStyles.btnFollowingText,
                  buttonVariant === 'remove' && rowStyles.btnRemoveText,
                ]}
              >
                {buttonLabel}
              </Text>
            </Pressable>
          )}
        </Pressable>
        {!isLast && <View style={rowStyles.divider} />}
      </View>
    );
  };

  const title = activeType === 'followers' ? 'Followers' : 'Following';

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Single Animated.View controls opacity for both backdrop and card
          so the dark overlay and the card surface always move in lockstep. */}
      <Animated.View style={{ flex: 1, opacity: anim }}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { maxHeight: screenHeight * 0.65 }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.headerDivider} />

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.stateText}>Loading…</Text>
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <View style={styles.stateIconWrap}>
                <Ionicons name="alert-circle-outline" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.stateText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => void loadList()}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.stateBox}>
              <View style={styles.stateIconWrap}>
                <Ionicons name="people-outline" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeType === 'followers' ? 'No followers yet' : 'Not following anyone'}
              </Text>
              <Text style={styles.stateText}>
                {activeType === 'followers'
                  ? 'Followers will appear here.'
                  : 'Following users will appear here.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4 }}
            />
          )}
        </Pressable>
      </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  stateIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stateText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 4,
  },
  retryText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  name: {
    flex: 1,
    fontFamily: font.semiBold,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    flexShrink: 0,
  },
  btnFollow: {
    backgroundColor: theme.colors.primary,
  },
  btnFollowing: {
    backgroundColor: '#F1F5F9',
  },
  btnRemove: {
    backgroundColor: '#FEF2F2',
  },
  btnText: {
    fontFamily: font.semiBold,
    fontSize: 13,
  },
  btnFollowText: {
    color: '#FFFFFF',
  },
  btnFollowingText: {
    color: theme.colors.textSecondary,
  },
  btnRemoveText: {
    color: '#EF4444',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: 20,
  },
});
