import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { renameSavedTripCollection } from '@/services/publicTrips';

const DEFAULT_COVER = require('@/assets/images/placeholders/default-collection.png');

export default function EditCollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { id, name: initialName } = useLocalSearchParams<{ id: string; name: string }>();

  const [name, setName] = useState(initialName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a collection name.');
      return;
    }
    if (!token || !id) {
      setError('Authentication required. Please sign in.');
      return;
    }
    if (trimmedName === initialName) {
      router.back();
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      await renameSavedTripCollection(token, id, trimmedName);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.pageHeader, { paddingTop: insets.top }]}>
        <View style={styles.pageHeaderInner}>
          <View style={styles.hdrSide}>
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color={theme.colors.primaryDark} />
            </Pressable>
          </View>
          <Text style={styles.pageTitle}>Edit Collection</Text>
          <View style={[styles.hdrSide, styles.hdrSideRight]} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover image area */}
        <View style={styles.coverWrap}>
          <Image source={DEFAULT_COVER} style={styles.coverImage} contentFit="cover" />
          <View style={styles.coverScrim} />
          <View style={styles.coverOverlay}>
            <Pressable style={styles.changeCoverBtn}>
              <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
              <Text style={styles.changeCoverText}>Change Cover</Text>
            </Pressable>
          </View>
        </View>

        {/* Name input */}
        <View style={styles.section}>
          <Text style={styles.label}>Collection Name</Text>
          <TextInput
            style={[styles.nameInput, !!error && styles.nameInputError]}
            placeholder="e.g. Weekend in Istanbul"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError(null);
            }}
            editable={!isSaving}
            returnKeyType="done"
            onSubmitEditing={() => void handleSave()}
            autoFocus
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* Save button */}
        <Pressable
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={isSaving}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  pageHeader: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  pageHeaderInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  hdrSide: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  hdrSideRight: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 0.5,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },

  scrollContent: {
    paddingBottom: 48,
    gap: 24,
  },

  coverWrap: {
    height: 220,
    backgroundColor: '#DFF7F6',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,59,74,0.45)',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  changeCoverText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  section: {
    paddingHorizontal: 20,
    gap: 8,
  },
  label: {
    fontFamily: font.bold,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },

  nameInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  nameInputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: '#EF4444',
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    marginHorizontal: 20,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
