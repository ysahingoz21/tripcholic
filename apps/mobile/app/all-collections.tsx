import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { DEFAULT_COLLECTION_COVER } from '@/components/saved/collectionCovers';
import ActionSheet from '@/components/ui/ActionSheet';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import {
  deleteSavedTripCollection,
  getSavedPublicTrips,
  type SavedTripCollectionSummary,
} from '@/services/publicTrips';

// ── GridCard ──────────────────────────────────────────────────────────────────

function GridCollectionCard({
  collection,
  cardWidth,
  onPress,
  onMenuPress,
}: {
  collection: SavedTripCollectionSummary;
  cardWidth: number;
  onPress: () => void;
  onMenuPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [gridStyles.card, { width: cardWidth }, pressed && { opacity: 0.88 }]}
      onPress={onPress}
    >
      <Image
        source={collection.coverImageUrl ? { uri: collection.coverImageUrl } : DEFAULT_COLLECTION_COVER}
        style={[gridStyles.image, { width: cardWidth }]}
        contentFit="cover"
      />
      <View style={gridStyles.info}>
        <Text style={gridStyles.name} numberOfLines={1}>{collection.name}</Text>
        <Text style={gridStyles.count}>
          {collection.savedTripCount === 0
            ? 'Empty'
            : `${collection.savedTripCount} ${collection.savedTripCount === 1 ? 'trip' : 'trips'}`}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [gridStyles.menuBtn, pressed && { opacity: 0.6 }]}
        onPress={(e) => { e.stopPropagation?.(); onMenuPress(); }}
        hitSlop={8}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.9)" />
      </Pressable>
    </Pressable>
  );
}

const gridStyles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  image: {
    height: 110,
  },
  info: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  name: {
    fontFamily: font.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: theme.colors.text,
  },
  count: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  menuBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AllCollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { token } = useAuth();

  const [collections, setCollections] = useState<SavedTripCollectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [menuCollection, setMenuCollection] = useState<SavedTripCollectionSummary | null>(null);
  const [confirmDeleteCollection, setConfirmDeleteCollection] = useState<SavedTripCollectionSummary | null>(null);

  const H_PAD = 20;
  const GAP = 12;
  const cardWidth = (screenWidth - H_PAD * 2 - GAP) / 2;

  const loadData = useCallback(async () => {
    if (!token) {
      setError('Authentication required.');
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const result = await getSavedPublicTrips(token);
      setCollections(result.collections);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load collections.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const handleMenuPress = (collection: SavedTripCollectionSummary) => {
    setMenuCollection(collection);
  };

  const confirmDelete = (collection: SavedTripCollectionSummary) => {
    setConfirmDeleteCollection(collection);
  };

  const deleteCollection = async (collection: SavedTripCollectionSummary) => {
    if (!token || isDeletingId) return;
    try {
      setIsDeletingId(collection.id);
      await deleteSavedTripCollection(token, collection.id);
      setCollections((prev) => prev.filter((c) => c.id !== collection.id));
    } catch (e) {
      Alert.alert(
        'Delete failed',
        e instanceof Error ? e.message : 'Unable to delete collection.'
      );
    } finally {
      setIsDeletingId(null);
    }
  };

  // Build 2-column rows
  const rows: SavedTripCollectionSummary[][] = [];
  for (let i = 0; i < collections.length; i += 2) {
    rows.push(collections.slice(i, i + 2));
  }

  const headerNode = (
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
        <Text style={styles.pageTitle}>All Collections</Text>
        <View style={[styles.hdrSide, styles.hdrSideRight]}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/create-collection' as any)}
            hitSlop={8}
          >
            <Ionicons name="add" size={24} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );

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

  return (
    <View style={styles.root}>
      {headerNode}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>Could not load collections</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => void loadData()}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </Pressable>
          </View>
        ) : collections.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="folder-open-outline" size={40} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No collections yet</Text>
            <Text style={styles.emptyText}>
              Create your first collection to start organizing saved trips.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push('/create-collection' as any)}
            >
              <Text style={styles.primaryBtnText}>New Collection</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={[styles.row, { gap: GAP }]}>
                {row.map((col) => (
                  <GridCollectionCard
                    key={col.id}
                    collection={col}
                    cardWidth={cardWidth}
                    onPress={() => router.push(`/saved-collection/${col.id}` as any)}
                    onMenuPress={() => handleMenuPress(col)}
                  />
                ))}
                {row.length === 1 && <View style={{ width: cardWidth }} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ActionSheet
        visible={menuCollection !== null}
        title={menuCollection?.name}
        onClose={() => setMenuCollection(null)}
        options={[
          {
            label: 'Add Trips to Collection',
            onPress: () => menuCollection && router.push(`/collection-add-trips/${menuCollection.id}` as any),
          },
          {
            label: 'Edit Collection',
            onPress: () => menuCollection && router.push(`/edit-collection/${menuCollection.id}?name=${encodeURIComponent(menuCollection.name)}&coverImageUrl=${encodeURIComponent(menuCollection.coverImageUrl ?? '')}` as any),
          },
          {
            label: 'Delete Collection',
            destructive: true,
            onPress: () => menuCollection && confirmDelete(menuCollection),
          },
          { label: 'Cancel', cancel: true },
        ]}
      />

      <ConfirmSheet
        visible={confirmDeleteCollection !== null}
        title="Delete Collection"
        message={`Delete "${confirmDeleteCollection?.name ?? ''}"? Saved trips will stay saved but move out of this collection.`}
        confirmLabel="Delete"
        destructive
        isLoading={isDeletingId === confirmDeleteCollection?.id}
        onConfirm={() => {
          if (confirmDeleteCollection) {
            setConfirmDeleteCollection(null);
            void deleteCollection(confirmDeleteCollection);
          }
        }}
        onCancel={() => setConfirmDeleteCollection(null)}
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 14,
  },
  grid: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
