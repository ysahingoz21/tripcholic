import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import CollectionManagerModal from '@/components/saved/CollectionManagerModal';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  createSavedTripCollection,
  deleteSavedTripCollection,
  getSavedPublicTrips,
  updateSavedTripCollections,
  type SavedPublicTripItem,
  type SavedPublicTripsResponse,
} from '@/services/publicTrips';

type SavedTripsFilter = 'all' | 'ungrouped' | `collection:${string}`;

const H_PAD = 20;

function formatCreatorName(displayName: string | null) {
  return displayName?.trim() || 'Tripcholic traveler';
}

function formatSavedDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildMetaLine(item: SavedPublicTripItem) {
  const durationLabel =
    item.optimization.routeTotalDurationMin !== null
      ? `${item.optimization.routeTotalDurationMin} min`
      : 'duration N/A';
  const costLabel =
    item.optimization.routeTotalCostTl !== null
      ? `${item.optimization.routeTotalCostTl} TL`
      : 'cost N/A';

  return `${durationLabel} • ${costLabel}`;
}

function getFilterQueryValue(filter: SavedTripsFilter) {
  if (filter === 'all') return undefined;
  if (filter === 'ungrouped') return 'ungrouped';
  return filter.replace('collection:', '');
}

function getCollectionFilterValue(collectionId: string) {
  return `collection:${collectionId}` as const;
}

function buildCollectionSummaryText(
  collectionCount: number,
  totalSavedCount: number,
  ungroupedCount: number
) {
  return `${collectionCount} collection${collectionCount === 1 ? '' : 's'} · ${totalSavedCount} saved · ${ungroupedCount} ungrouped`;
}

function buildFilterDescription(
  activeFilter: SavedTripsFilter,
  data: SavedPublicTripsResponse | null
) {
  if (!data) return 'Choose a grouping lens for the public trips you saved from Explore.';
  if (activeFilter === 'all') return 'All saved public trips, including grouped and ungrouped items.';
  if (activeFilter === 'ungrouped') return 'Saved public trips not assigned to any collection yet.';
  return data.filter.selectedCollection
    ? `${data.filter.selectedCollection.name} collection`
    : 'Saved public trip collection';
}

// ── SavedTripCard ─────────────────────────────────────────────────────────────

function SavedTripCard({
  item,
  onPress,
  onManageCollections,
}: {
  item: SavedPublicTripItem;
  onPress: () => void;
  onManageCollections: () => void;
}) {
  const imageUrl = item.preview.imageUrls?.[0] ?? null;
  const category = item.preview.primaryCategory ?? null;

  return (
    <View style={cardStyles.wrap}>
      {/* ── Thumbnail ── */}
      <Pressable onPress={onPress} style={cardStyles.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Artwork />
        )}
        <View style={cardStyles.scrim} />

        {/* top row: category chip + saved badge */}
        <View style={cardStyles.topRow}>
          {category ? (
            <View style={cardStyles.categoryChip}>
              <Text style={cardStyles.categoryChipText}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </View>
          ) : null}
          <View style={cardStyles.savedBadge}>
            <Ionicons name="bookmark" size={11} color="#006A69" />
            <Text style={cardStyles.savedBadgeText}>Saved</Text>
          </View>
        </View>

        {/* bottom: title */}
        <View style={cardStyles.bottomContent}>
          <Text style={cardStyles.tripTitle} numberOfLines={2}>
            {item.trip.title}
          </Text>
          <Text style={cardStyles.tripDate}>
            {new Date(item.trip.date).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      </Pressable>

      {/* ── Meta strip ── */}
      <View style={cardStyles.metaStrip}>
        <View style={cardStyles.creatorRow}>
          <Ionicons name="person-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={cardStyles.creatorText} numberOfLines={1}>
            {formatCreatorName(item.creator.displayName)}
          </Text>
        </View>
        <View style={cardStyles.metaPills}>
          <View style={cardStyles.metaPill}>
            <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
            <Text style={cardStyles.metaPillText}>
              {item.optimization.routeTotalDurationMin !== null
                ? `${item.optimization.routeTotalDurationMin} min`
                : 'N/A'}
            </Text>
          </View>
          <View style={cardStyles.metaPill}>
            <Ionicons name="cash-outline" size={12} color={theme.colors.textSecondary} />
            <Text style={cardStyles.metaPillText}>
              {item.optimization.routeTotalCostTl !== null
                ? `${item.optimization.routeTotalCostTl} TL`
                : 'N/A'}
            </Text>
          </View>
          <Text style={cardStyles.savedAtText}>Saved {formatSavedDate(item.savedAt)}</Text>
        </View>
      </View>

      {/* ── Collections row ── */}
      <View style={cardStyles.collectionsWrap}>
        <View style={cardStyles.collectionsHeaderRow}>
          <Text style={cardStyles.collectionsLabel}>Collections</Text>
          <Pressable onPress={onManageCollections} hitSlop={8}>
            <Text style={cardStyles.manageText}>Manage</Text>
          </Pressable>
        </View>
        <View style={cardStyles.badgesRow}>
          {item.collections.length > 0 ? (
            item.collections.map((col) => (
              <View key={col.id} style={cardStyles.memberBadge}>
                <Text style={cardStyles.memberBadgeText}>{col.name}</Text>
              </View>
            ))
          ) : (
            <View style={cardStyles.ungroupedBadge}>
              <Text style={cardStyles.ungroupedBadgeText}>Ungrouped</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  imageWrap: {
    height: 160,
    backgroundColor: '#E2E8F0',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,36,48,0.52)',
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DFF7F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  savedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006A69',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  tripDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 3,
    fontWeight: '500',
  },
  metaStrip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  creatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111C2C',
    flex: 1,
  },
  metaPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaPillText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  savedAtText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  collectionsWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  collectionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  collectionsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  manageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006A69',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#006A69',
    backgroundColor: '#DFF7F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memberBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006A69',
  },
  ungroupedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ungroupedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SavedTripsScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [savedTripsData, setSavedTripsData] = useState<SavedPublicTripsResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<SavedTripsFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [createCollectionError, setCreateCollectionError] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isDeletingCollection, setIsDeletingCollection] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SavedPublicTripItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isUpdatingCollections, setIsUpdatingCollections] = useState(false);
  const [isCreatingCollectionFromModal, setIsCreatingCollectionFromModal] = useState(false);

  const loadSavedTrips = useCallback(
    async (filterOverride?: SavedTripsFilter) => {
      if (isAuthLoading) return;

      if (!token) {
        setSavedTripsData(null);
        setError('Authentication required. Please sign in again.');
        setIsLoading(false);
        return;
      }

      const nextFilter = filterOverride ?? activeFilter;

      try {
        setIsLoading(true);
        setError(null);
        const data = await getSavedPublicTrips(token, getFilterQueryValue(nextFilter));
        setSavedTripsData(data);
      } catch (loadError) {
        setSavedTripsData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load saved public trips.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilter, isAuthLoading, token]
  );

  useFocusEffect(
    useCallback(() => {
      void loadSavedTrips();
    }, [loadSavedTrips])
  );

  const items = savedTripsData?.items ?? [];
  const collections = savedTripsData?.collections ?? [];
  const filterMeta = savedTripsData?.filter ?? null;
  const activeCollectionId =
    activeFilter.startsWith('collection:') ? activeFilter.replace('collection:', '') : null;
  const activeCollection = activeCollectionId
    ? collections.find((c) => c.id === activeCollectionId) ?? null
    : null;

  const collectionSummaryLine = useMemo(() => {
    if (!filterMeta) {
      return 'Saved Trips stays separate from My Trips and focuses only on public Explore posts.';
    }
    return buildCollectionSummaryText(
      collections.length,
      filterMeta.totalSavedCount,
      filterMeta.ungroupedCount
    );
  }, [collections.length, filterMeta]);

  const handleFilterPress = async (filter: SavedTripsFilter) => {
    setActiveFilter(filter);
    await loadSavedTrips(filter);
  };

  const handleCreateCollection = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Collection name cannot be empty.');
    if (!token) throw new Error('Authentication required. Please sign in again.');
    const response = await createSavedTripCollection(token, trimmedName);
    return response.collection;
  };

  const handleTopLevelCreateCollection = async () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) {
      setCreateCollectionError('Collection name cannot be empty.');
      return;
    }
    if (!token) {
      setCreateCollectionError('Authentication required. Please sign in again.');
      return;
    }
    try {
      setIsCreatingCollection(true);
      setCreateCollectionError(null);
      const createdCollection = await handleCreateCollection(trimmedName);
      setNewCollectionName('');
      const nextFilter = getCollectionFilterValue(createdCollection.id);
      setActiveFilter(nextFilter);
      await loadSavedTrips(nextFilter);
    } catch (creationError) {
      setCreateCollectionError(
        creationError instanceof Error ? creationError.message : 'Unable to create collection.'
      );
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleDeleteCollection = () => {
    if (!activeCollection || !token || isDeletingCollection) return;

    Alert.alert(
      'Delete Collection',
      `Delete ${activeCollection.name}? Trips will stay saved and move out of this collection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setIsDeletingCollection(true);
                await deleteSavedTripCollection(token, activeCollection.id);
                setActiveFilter('all');
                await loadSavedTrips('all');
              } catch (deleteError) {
                setError(
                  deleteError instanceof Error
                    ? deleteError.message
                    : 'Unable to delete collection.'
                );
              } finally {
                setIsDeletingCollection(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleOpenManageCollections = (item: SavedPublicTripItem) => {
    setModalError(null);
    setSelectedItem(item);
  };

  const handleSaveMemberships = async (savedTripId: string, collectionIds: string[]) => {
    if (!token) {
      setModalError('Authentication required. Please sign in again.');
      return;
    }
    try {
      setIsUpdatingCollections(true);
      setModalError(null);
      await updateSavedTripCollections(token, savedTripId, collectionIds);
      await loadSavedTrips();
      setSelectedItem(null);
    } catch (updateError) {
      setModalError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update trip collections.'
      );
    } finally {
      setIsUpdatingCollections(false);
    }
  };

  const handleCreateCollectionFromModal = async (name: string) => {
    try {
      setIsCreatingCollectionFromModal(true);
      const collection = await handleCreateCollection(name);
      await loadSavedTrips();
      return collection;
    } finally {
      setIsCreatingCollectionFromModal(false);
    }
  };

  const closeModal = () => {
    if (isUpdatingCollections) return;
    setSelectedItem(null);
    setModalError(null);
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>SAVED TRIPS</Text>
            <Text style={styles.title}>Saved Trips</Text>
          </View>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading your saved trips…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SAVED TRIPS</Text>
          <Text style={styles.title}>Saved Trips</Text>
          <Text style={styles.headerSub}>{collectionSummaryLine}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Filter chips ── */}
        <View style={styles.filtersCard}>
          <View style={styles.filtersHeaderRow}>
            <Text style={styles.filtersCardTitle}>Collections</Text>
            {activeCollection ? (
              <Pressable onPress={handleDeleteCollection} hitSlop={8} disabled={isDeletingCollection}>
                <Text style={styles.deleteText}>
                  {isDeletingCollection ? 'Deleting…' : 'Delete'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {(['all', 'ungrouped'] as const).map((f) => (
              <Pressable
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => void handleFilterPress(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === f && styles.filterChipTextActive,
                  ]}
                >
                  {f === 'all' ? 'All' : 'Ungrouped'}
                </Text>
              </Pressable>
            ))}
            {collections.map((col) => {
              const filterVal = getCollectionFilterValue(col.id);
              const isActive = activeFilter === filterVal;
              return (
                <Pressable
                  key={col.id}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => void handleFilterPress(filterVal)}
                >
                  <Text
                    style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                  >
                    {col.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.filterDesc}>
            {buildFilterDescription(activeFilter, savedTripsData)}
          </Text>
        </View>

        {/* ── Create Collection card ── */}
        <View style={styles.createCard}>
          <View style={styles.createCardHeader}>
            <Ionicons name="add-circle-outline" size={18} color="#006A69" />
            <Text style={styles.createCardTitle}>New Collection</Text>
          </View>
          <Text style={styles.createCardDesc}>
            Group saved public trips into buckets. A trip can belong to multiple collections.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Weekend ideas"
            placeholderTextColor={theme.colors.textSecondary}
            value={newCollectionName}
            onChangeText={setNewCollectionName}
            editable={!isCreatingCollection}
            returnKeyType="done"
            onSubmitEditing={() => void handleTopLevelCreateCollection()}
          />
          {createCollectionError ? (
            <Text style={styles.inlineError}>{createCollectionError}</Text>
          ) : null}
          <Pressable
            style={[styles.createButton, isCreatingCollection && styles.createButtonDisabled]}
            onPress={() => void handleTopLevelCreateCollection()}
            disabled={isCreatingCollection}
          >
            <Text style={styles.createButtonText}>
              {isCreatingCollection ? 'Creating…' : 'Create Collection'}
            </Text>
          </Pressable>
        </View>

        {/* ── Trip list / error / empty ── */}
        {error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={36} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>Saved trips unavailable</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable style={styles.primaryButton} onPress={() => void loadSavedTrips()}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : items.length > 0 ? (
          items.map((item) => (
            <SavedTripCard
              key={item.savedTripId}
              item={item}
              onPress={() => router.push(`/public-trip/${item.trip.id}` as any)}
              onManageCollections={() => handleOpenManageCollections(item)}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="bookmark-outline" size={36} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {activeFilter === 'all'
                ? 'No saved public trips yet'
                : activeFilter === 'ungrouped'
                ? 'No ungrouped saved trips'
                : 'No trips in this collection'}
            </Text>
            <Text style={styles.emptyText}>
              {activeFilter === 'all'
                ? 'Save interesting routes from Explore to revisit them here later.'
                : 'Adjust collection memberships or save more public trips from Explore.'}
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)/explore')}
            >
              <Text style={styles.primaryButtonText}>Open Explore</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <CollectionManagerModal
        visible={selectedItem !== null}
        item={selectedItem}
        collections={collections}
        isSaving={isUpdatingCollections}
        isCreatingCollection={isCreatingCollectionFromModal}
        error={modalError}
        onClose={closeModal}
        onSave={handleSaveMemberships}
        onCreateCollection={handleCreateCollectionFromModal}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // States
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  stateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Header
  header: {
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerText: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 48,
    gap: 14,
  },

  // Filters card
  filtersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 16,
    gap: 12,
  },
  filtersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111C2C',
  },
  deleteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  chipScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  filterChipActive: {
    backgroundColor: '#DFF7F6',
    borderColor: '#006A69',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  filterChipTextActive: {
    fontWeight: '700',
    color: '#006A69',
  },
  filterDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },

  // Create collection card
  createCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 16,
    gap: 10,
  },
  createCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111C2C',
  },
  createCardDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E8ECF0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#111C2C',
  },
  inlineError: {
    fontSize: 13,
    color: '#991B1B',
    marginTop: -4,
  },
  createButton: {
    backgroundColor: '#006A69',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.55,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Empty / error
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111C2C',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A69',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
