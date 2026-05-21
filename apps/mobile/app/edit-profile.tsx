import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '@/components/ui/UserAvatar';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { updateProfile } from '@/services/users';
import { uploadImage } from '@/services/uploads';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_COVER = require('@/assets/images/profile/profile-cover.png');
const COVER_HEIGHT = 160;
const AVATAR_SIZE = 88;
const AVATAR_RING = 4;

const TRAVEL_VIBES = [
  'Food Hunter',
  'Culture Explorer',
  'Night Owl',
  'Nature Lover',
  'Budget Traveler',
  'Hidden Gem Seeker',
];

const CATEGORIES = [
  { key: 'FOOD', label: 'Food & Drink', emoji: '🍜' },
  { key: 'HISTORICAL', label: 'Historical', emoji: '🏛️' },
  { key: 'SCENIC', label: 'Scenic', emoji: '🌅' },
  { key: 'NATURE', label: 'Nature', emoji: '🌿' },
  { key: 'ENTERTAINMENT', label: 'Entertainment', emoji: '🎭' },
  { key: 'SHOPPING', label: 'Shopping', emoji: '🛍️' },
  { key: 'NEIGHBORHOOD', label: 'Neighborhoods', emoji: '🏘️' },
];

const BIO_MAX = 120;

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title}</Text>
      {subtitle ? <Text style={sectionStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 4, gap: 3 },
  title: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
});

// ── Chip ───────────────────────────────────────────────────────────────────────

function Chip({
  label,
  emoji,
  selected,
  onPress,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.chip,
        selected && chipStyles.chipSelected,
        pressed && { opacity: 0.75 },
      ]}
    >
      {emoji ? <Text style={chipStyles.emoji}>{emoji}</Text> : null}
      <Text style={[chipStyles.label, selected && chipStyles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    marginBottom: 10,
  },
  chipSelected: {
    backgroundColor: '#DFF7F6',
    borderColor: theme.colors.primary,
  },
  emoji: { fontSize: 14 },
  label: {
    fontFamily: font.medium,
    fontSize: 13,
    color: theme.colors.text,
  },
  labelSelected: {
    fontFamily: font.semiBold,
    color: theme.colors.primaryDark,
  },
});

// ── Discard Changes Modal ──────────────────────────────────────────────────────

function DiscardModal({
  visible,
  onKeep,
  onDiscard,
}: {
  visible: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={modalStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onKeep} />
        <View style={modalStyles.card}>
          <View style={modalStyles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={32} color={theme.colors.primary} />
          </View>
          <Text style={modalStyles.title}>Discard changes?</Text>
          <Text style={modalStyles.body}>
            You have unsaved changes. If you leave now they'll be lost.
          </Text>
          <View style={modalStyles.actions}>
            <Pressable
              style={({ pressed }) => [modalStyles.btnSecondary, pressed && { opacity: 0.7 }]}
              onPress={onKeep}
            >
              <Text style={modalStyles.btnSecondaryText}>Keep Editing</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [modalStyles.btnDestructive, pressed && { opacity: 0.7 }]}
              onPress={onDiscard}
            >
              <Text style={modalStyles.btnDestructiveText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  body: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  btnDestructive: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDestructiveText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#DC2626',
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, setUser } = useAuth();

  // ── Form state ────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(
    user?.avatarUrl ?? null,
  );
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(
    user?.coverImageUrl ?? null,
  );
  const [selectedVibes, setSelectedVibes] = useState<string[]>(user?.travelVibes ?? []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    user?.favoriteCategories ?? [],
  );

  // ── Upload / save state ───────────────────────────────────────────────────
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Guard state ───────────────────────────────────────────────────────────
  const [showDiscard, setShowDiscard] = useState(false);

  // Track initial values for dirty check
  const initial = useRef({
    displayName: user?.displayName ?? '',
    bio: user?.bio ?? '',
    avatarUrl: user?.avatarUrl ?? null,
    coverImageUrl: user?.coverImageUrl ?? null,
    travelVibes: user?.travelVibes ?? [],
    favoriteCategories: user?.favoriteCategories ?? [],
  });

  const isDirty = useCallback(() => {
    const i = initial.current;
    return (
      displayName !== i.displayName ||
      bio !== i.bio ||
      pendingAvatarUrl !== i.avatarUrl ||
      pendingCoverUrl !== i.coverImageUrl ||
      JSON.stringify(selectedVibes) !== JSON.stringify(i.travelVibes) ||
      JSON.stringify(selectedCategories) !== JSON.stringify(i.favoriteCategories)
    );
  }, [displayName, bio, pendingAvatarUrl, pendingCoverUrl, selectedVibes, selectedCategories]);

  const handleBack = useCallback(() => {
    if (isDirty()) {
      setShowDiscard(true);
    } else {
      router.navigate('/(tabs)/profile');
    }
  }, [isDirty, router]);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleChangeAvatar = async () => {
    if (!token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow photo library access to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      setIsUploadingAvatar(true);
      const uploaded = await uploadImage(token, asset.uri, asset.mimeType ?? 'image/jpeg');
      setPendingAvatarUrl(uploaded.url);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload photo.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ── Cover upload ──────────────────────────────────────────────────────────
  const handleChangeCover = async () => {
    if (!token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow photo library access to change the cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.88,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      setIsUploadingCover(true);
      const uploaded = await uploadImage(token, asset.uri, asset.mimeType ?? 'image/jpeg');
      setPendingCoverUrl(uploaded.url);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload cover image.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!token) return;
    if (isSaving || isUploadingAvatar || isUploadingCover) return;

    if (!isDirty()) {
      router.navigate('/(tabs)/profile');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      const updated = await updateProfile(token, {
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: pendingAvatarUrl,
        coverImageUrl: pendingCoverUrl,
        travelVibes: selectedVibes,
        favoriteCategories: selectedCategories,
      });
      setUser(updated);
      router.navigate('/(tabs)/profile');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVibe = (vibe: string) => {
    setSelectedVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe],
    );
  };

  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const isActionDisabled = isSaving || isUploadingAvatar || isUploadingCover;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={handleBack}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.primaryDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.iconBtn} />
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── SECTION 1 — VISUAL IDENTITY ── */}

        {/* Cover photo */}
        <View style={styles.coverWrap}>
          <Image
            source={pendingCoverUrl ? { uri: pendingCoverUrl } : DEFAULT_COVER}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <View style={styles.coverScrim} />
          <Pressable
            style={({ pressed }) => [styles.changeCoverBtn, pressed && { opacity: 0.8 }]}
            onPress={() => void handleChangeCover()}
            disabled={isActionDisabled}
          >
            {isUploadingCover ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.changeCoverLabel}>Uploading…</Text>
              </>
            ) : (
              <>
                <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
                <Text style={styles.changeCoverLabel}>Change Cover</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Avatar (overlaps cover bottom) */}
        <View style={styles.avatarAnchor}>
          <View style={styles.avatarWrap}>
            <UserAvatar
              avatarUrl={pendingAvatarUrl}
              displayName={displayName || user?.displayName}
              email={user?.email}
              size={AVATAR_SIZE}
              ringSize={AVATAR_RING}
            />
            <Pressable
              style={({ pressed }) => [styles.avatarOverlay, pressed && { opacity: 0.85 }]}
              onPress={() => void handleChangeAvatar()}
              disabled={isActionDisabled}
            >
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
          <Text style={styles.changePhotoLabel}>
            {isUploadingAvatar ? 'Uploading…' : 'Change Photo'}
          </Text>
        </View>

        {/* ── SECTION 2 — PUBLIC PROFILE ── */}
        <SectionHeader title="Public Profile" />

        <View style={styles.card}>
          {/* Display Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your Name"
              placeholderTextColor={theme.colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              editable={!isActionDisabled}
              returnKeyType="next"
              maxLength={100}
            />
            <Text style={styles.fieldHelper}>How travelers see you</Text>
          </View>

          <View style={styles.fieldDivider} />

          {/* Bio */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <Text style={[styles.charCounter, bio.length > BIO_MAX && styles.charCounterOver]}>
                {bio.length}/{BIO_MAX}
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Coffee enthusiast exploring hidden gems."
              placeholderTextColor={theme.colors.textSecondary}
              value={bio}
              onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
              editable={!isActionDisabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={BIO_MAX}
            />
          </View>
        </View>

        {/* ── SECTION 3 — TRAVEL VIBE ── */}
        <SectionHeader
          title="Travel Vibe"
          subtitle="Pick the tags that describe your travel style."
        />

        <View style={styles.chipsCard}>
          <View style={styles.chipsWrap}>
            {TRAVEL_VIBES.map((vibe) => (
              <Chip
                key={vibe}
                label={vibe}
                selected={selectedVibes.includes(vibe)}
                onPress={() => toggleVibe(vibe)}
              />
            ))}
          </View>
        </View>

        {/* ── SECTION 4 — FAVORITE CATEGORIES ── */}
        <SectionHeader
          title="Favorite Categories"
          subtitle="Used to personalize your For You feed."
        />

        <View style={styles.chipsCard}>
          <View style={styles.chipsWrap}>
            {CATEGORIES.map(({ key, label, emoji }) => (
              <Chip
                key={key}
                label={label}
                emoji={emoji}
                selected={selectedCategories.includes(key)}
                onPress={() => toggleCategory(key)}
              />
            ))}
          </View>
        </View>

        {/* ── SECTION 5 — ACCOUNT ── */}
        <SectionHeader title="Account" />

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.emailText}>{user?.email ?? ''}</Text>
            </View>
          </View>
        </View>

        {/* Error */}
        {saveError ? (
          <View style={styles.errorWrap}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky Save Button ── */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            isActionDisabled && styles.saveBtnDisabled,
            pressed && !isActionDisabled && { opacity: 0.88 },
          ]}
          onPress={() => void handleSave()}
          disabled={isActionDisabled}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Discard Guard Modal ── */}
      <DiscardModal
        visible={showDiscard}
        onKeep={() => setShowDiscard(false)}
        onDiscard={() => {
          setShowDiscard(false);
          router.navigate('/(tabs)/profile');
        }}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const AVATAR_TOTAL = AVATAR_SIZE + AVATAR_RING * 2;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // ── Cover ─────────────────────────────────────────────────────────────────
  coverWrap: {
    height: COVER_HEIGHT,
    backgroundColor: theme.colors.primaryDark,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,59,74,0.40)',
  },
  changeCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  changeCoverLabel: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarAnchor: {
    alignItems: 'center',
    marginTop: -(AVATAR_TOTAL / 2),
    marginBottom: 4,
    zIndex: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: AVATAR_RING,
    right: AVATAR_RING,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  changePhotoLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },

  // ── Card / input ──────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  fieldGroup: {
    padding: 16,
    gap: 8,
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    letterSpacing: 0.1,
  },
  charCounter: {
    fontFamily: font.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  charCounterOver: {
    color: '#DC2626',
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  bioInput: {
    minHeight: 88,
    paddingTop: 12,
  },

  // ── Email info row ────────────────────────────────────────────────────────
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  emailText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  fieldHelper: {
    fontFamily: font.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },

  // ── Chips ─────────────────────────────────────────────────────────────────
  chipsCard: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // ── Error ─────────────────────────────────────────────────────────────────
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
  },

  // ── Sticky footer ─────────────────────────────────────────────────────────
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
