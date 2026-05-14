import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, memo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SavedTripPostCardBase from '@/components/saved/SavedTripPostCard';
import ActionSheet from '@/components/ui/ActionSheet';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import { theme } from '@/constants/theme';
import { font, type } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import {
  deleteSavedTripCollection,
  getSavedPublicTrips,
  type SavedPublicTripsResponse,
  updateSavedTripCollections,
} from '@/services/publicTrips';

const SavedTripPostCard = memo(SavedTripPostCardBase);

const H_PAD = 20;
const CARD_GAP = 12;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SavedCollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();

  const cardWidth = Math.floor((screenWidth - H_PAD * 2 - CARD_GAP) / 2);

  const [data, setData] = useState<SavedPublicTripsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Selection mode (for "Remove from Collection")
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRemoving, setIsRemoving] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const result = await getSavedPublicTrips(token, id);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load collection.');
    } finally {
      setIsLoading(false);
    }
  }, [token, id]);

  useFocusEffect(useCallback(() => {
    void loadData();
    // Exit any leftover selection mode on focus
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [loadData]));

  // ── Derived ──────────────────────────────────────────────────────────────────

  const collectionName = data?.filter.selectedCollection?.name ?? 'Collection';

  const items = useMemo(() => {
    return (data?.items ?? []).slice().sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  }, [data?.items]);

  const rows = useMemo(() => {
    const result: typeof items[] = [];
    for (let i = 0; i < items.length; i += 2) {
      result.push(items.slice(i, i + 2));
    }
    return result;
  }, [items]);

  // Stable per-card navigation callbacks — only recreated when items change,
  // not on every selectedIds update. This prevents flicker in selection mode.
  const pressHandlers = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const item of items) {
      const isOwnTrip = item.creator.id !== null && item.creator.id === user?.id;
      map.set(item.savedTripId, () =>
        router.push(
          isOwnTrip
            ? (`/trip/${item.trip.id}` as any)
            : (`/public-trip/${item.trip.id}` as any),
        ),
      );
    }
    return map;
  }, [items, router, user]);

  // ── Selection mode handlers ───────────────────────────────────────────────

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = useCallback((savedTripId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(savedTripId)) next.delete(savedTripId);
      else next.add(savedTripId);
      return next;
    });
  }, []);

  const handleRemoveSelected = async () => {
    if (!token || !id || selectedIds.size === 0 || isRemoving) return;
    try {
      setIsRemoving(true);
      const toRemove = items.filter((item) => selectedIds.has(item.savedTripId));
      await Promise.all(
        toRemove.map((item) =>
          updateSavedTripCollections(
            token,
            item.savedTripId,
            item.collections.filter((c) => c.id !== id).map((c) => c.id)
          )
        )
      );
      // Optimistically remove from local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter((item) => !selectedIds.has(item.savedTripId)),
        };
      });
      exitSelectionMode();
    } catch (e) {
      Alert.alert(
        'Could not remove trips',
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    } finally {
      setIsRemoving(false);
    }
  };

  // ── Unsave handler (optimistic removal from local state) ──────────────────

  const handleUnsave = useCallback((savedTripId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item) => item.savedTripId !== savedTripId),
      };
    });
  }, []);

  const unsaveHandlers = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const item of items) {
      map.set(item.savedTripId, () => handleUnsave(item.savedTripId));
    }
    return map;
  }, [items, handleUnsave]);

  const collectionIdsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      map.set(item.savedTripId, item.collections.map((c) => c.id));
    }
    return map;
  }, [items]);

  // ── 3-dots menu ───────────────────────────────────────────────────────────

  const handleMenuPress = () => setMenuVisible(true);

  const confirmDelete = () => {
    setDeleteConfirmVisible(true);
  };

  const handleDelete = async () => {
    if (!token || !id || isDeleting) return;
    try {
      setIsDeleting(true);
      await deleteSavedTripCollection(token, id);
      router.back();
    } catch (e) {
      setIsDeleting(false);
      Alert.alert('Delete failed', e instanceof Error ? e.message : 'Unable to delete collection.');
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────

  const headerNode = (
    <View style={[styles.pageHeader, { paddingTop: insets.top }]}>
      <View style={styles.pageHeaderInner}>
        <View style={styles.hdrSide}>
          {selectionMode ? (
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={exitSelectionMode}
              hitSlop={8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color={theme.colors.primaryDark} />
            </Pressable>
          )}
        </View>

        <Text style={styles.pageTitle} numberOfLines={1}>
          {selectionMode
            ? selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : 'Choose trips'
            : collectionName}
        </Text>

        <View style={[styles.hdrSide, styles.hdrSideRight]}>
          {!selectionMode && (
            isDeleting ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                onPress={handleMenuPress}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.primaryDark} />
              </Pressable>
            )
          )}
        </View>
      </View>
    </View>
  );

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.root}>
        {headerNode}
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {headerNode}

      <View style={styles.contentArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            selectionMode && styles.scrollContentWithBar,
          ]}
        >
          {/* Eyebrow (only outside selection mode) */}
          {!selectionMode && (
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrowText}>{collectionName.toUpperCase()}</Text>
            </View>
          )}

          {/* Results */}
          {error ? (
            <View style={styles.feedState}>
              <View style={styles.stateIconWrap}>
                <Ionicons name="alert-circle-outline" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.feedStateTitle}>Could not load collection</Text>
              <Text style={styles.feedStateBody}>{error}</Text>
              <Pressable style={styles.feedStateButton} onPress={() => void loadData()}>
                <Text style={styles.feedStateButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : items.length > 0 ? (
            <View style={styles.grid}>
              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={[styles.row, { gap: CARD_GAP }]}>
                  {row.map((item) => (
                    <SavedTripPostCard
                      key={item.savedTripId}
                      tripId={item.trip.id}
                      title={item.trip.title}
                      date={item.trip.date}
                      imageUrl={item.preview.imageUrl ?? null}
                      likeCount={item.engagement.likeCount}
                      saveCount={item.engagement.saveCount}
                      commentCount={item.engagement.commentCount}
                      likedByMe={item.engagement.likedByMe}
                      savedByMe={item.engagement.savedByMe}
                      token={token}
                      cardWidth={cardWidth}
                      onPress={pressHandlers.get(item.savedTripId)!}
                      onSelectToggle={toggleSelect}
                      savedTripId={item.savedTripId}
                      currentCollectionIds={collectionIdsMap.get(item.savedTripId)}
                      onUnsave={unsaveHandlers.get(item.savedTripId)}
                      selected={selectedIds.has(item.savedTripId)}
                      selectable={selectionMode}
                    />
                  ))}
                  {row.length === 1 && <View style={{ width: cardWidth }} />}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.feedState}>
              <View style={styles.stateIconWrap}>
                <Ionicons name="folder-open-outline" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.feedStateTitle}>Collection is empty</Text>
              <Text style={styles.feedStateBody}>
                Tap the menu above to add trips to this collection.
              </Text>
              <Pressable
                style={styles.feedStateButton}
                onPress={() => router.push(`/collection-add-trips/${id}` as any)}
              >
                <Text style={styles.feedStateButtonText}>Add Trips</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Bottom action bar — only in selection mode */}
        {selectionMode && (
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
            <Pressable
              style={[
                styles.removeBtn,
                (selectedIds.size === 0 || isRemoving) && styles.removeBtnDisabled,
              ]}
              onPress={() => void handleRemoveSelected()}
              disabled={selectedIds.size === 0 || isRemoving}
            >
              {isRemoving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.removeBtnText}>
                  {selectedIds.size > 0
                    ? `Remove ${selectedIds.size} ${selectedIds.size === 1 ? 'trip' : 'trips'} from Collection`
                    : 'Select trips to remove'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <ActionSheet
        visible={menuVisible}
        title={collectionName}
        onClose={() => setMenuVisible(false)}
        options={[
          { label: 'Choose Trips to Remove', onPress: enterSelectionMode },
          { label: 'Add Trips to Collection', onPress: () => router.push(`/collection-add-trips/${id}` as any) },
          {
            label: 'Edit Collection',
            onPress: () => router.push(`/edit-collection/${id}?name=${encodeURIComponent(collectionName)}` as any),
          },
          { label: 'Delete Collection', destructive: true, onPress: confirmDelete },
          { label: 'Cancel', cancel: true },
        ]}
      />

      <ConfirmSheet
        visible={deleteConfirmVisible}
        title="Delete Collection"
        message={`Delete "${collectionName}"? All saved trips will stay saved but move out of this collection.`}
        confirmLabel="Delete"
        destructive
        isLoading={isDeleting}
        onConfirm={() => { setDeleteConfirmVisible(false); void handleDelete(); }}
        onCancel={() => setDeleteConfirmVisible(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    width: 80,
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
  cancelBtn: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cancelText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  pageTitle: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 0.5,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  contentArea: {
    flex: 1,
  },

  scrollContent: {
    paddingTop: 16,
    paddingBottom: 48,
    gap: 14,
  },
  scrollContentWithBar: {
    paddingBottom: 100,
  },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: H_PAD,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  eyebrowText: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },

  feedState: {
    alignItems: 'center',
    paddingVertical: 52,
    paddingHorizontal: 32,
    gap: 10,
  },
  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  feedStateTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  feedStateBody: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  feedStateButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 4,
  },
  feedStateButtonText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  grid: {
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Bottom action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: H_PAD,
    paddingTop: 16,
  },
  removeBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnDisabled: {
    backgroundColor: theme.colors.border,
  },
  removeBtnText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
