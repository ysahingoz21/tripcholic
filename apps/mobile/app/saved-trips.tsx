import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CollectionManagerModal from '@/components/saved/CollectionManagerModal';
import TripPreviewCard from '@/components/trip/TripPreviewCard';
import AppButton from '@/components/ui/AppButton';
import InterestChip from '@/components/ui/InterestChip';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  createSavedTripCollection,
  deleteSavedTripCollection,
  getSavedPublicTrips,
  updateSavedTripCollections,
  type SavedPublicTripItem,
  type SavedPublicTripsResponse,
  type SavedTripCollectionSummary,
} from '@/services/publicTrips';

type SavedTripsFilter = 'all' | 'ungrouped' | `collection:${string}`;

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
  if (filter === 'all') {
    return undefined;
  }

  if (filter === 'ungrouped') {
    return 'ungrouped';
  }

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
  return `${collectionCount} collection${collectionCount === 1 ? '' : 's'} • ${totalSavedCount} saved public trip${
    totalSavedCount === 1 ? '' : 's'
  } • ${ungroupedCount} ungrouped`;
}

function buildFilterDescription(
  activeFilter: SavedTripsFilter,
  data: SavedPublicTripsResponse | null
) {
  if (!data) {
    return 'Choose a grouping lens for the public trips you saved from Explore.';
  }

  if (activeFilter === 'all') {
    return 'All saved public trips, including grouped and ungrouped items.';
  }

  if (activeFilter === 'ungrouped') {
    return 'Saved public trips that are not assigned to any collection yet.';
  }

  return data.filter.selectedCollection
    ? `${data.filter.selectedCollection.name} collection`
    : 'Saved public trip collection';
}

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
      if (isAuthLoading) {
        return;
      }

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
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load saved public trips.'
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
    ? collections.find((collection) => collection.id === activeCollectionId) ?? null
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

    if (!trimmedName) {
      throw new Error('Collection name cannot be empty.');
    }

    if (!token) {
      throw new Error('Authentication required. Please sign in again.');
    }

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
        creationError instanceof Error
          ? creationError.message
          : 'Unable to create collection.'
      );
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleDeleteCollection = () => {
    if (!activeCollection || !token || isDeletingCollection) {
      return;
    }

    Alert.alert(
      'Delete Collection',
      `Delete ${activeCollection.name}? Trips will stay saved and move out of this collection.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
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

  const handleSaveMemberships = async (
    savedTripId: string,
    collectionIds: string[]
  ) => {
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
    if (isUpdatingCollections) {
      return;
    }

    setSelectedItem(null);
    setModalError(null);
  };

  if (isLoading || isAuthLoading) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="Saved Trips"
          subtitle="Loading the public trips and collections you chose to keep."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <SectionTitle
          title="Saved Trips"
          subtitle="A separate hub for public Explore trips you saved. This stays distinct from the trips you created yourself."
        />

        <View style={styles.filterCard}>
          <View style={styles.filterHeaderRow}>
            <View style={styles.filterHeaderTextWrap}>
              <Text style={styles.filterTitle}>Collections and Filters</Text>
              <Text style={styles.filterSubtitle}>{collectionSummaryLine}</Text>
            </View>
            {activeCollection ? (
              <Pressable
                onPress={handleDeleteCollection}
                hitSlop={8}
                disabled={isDeletingCollection}
              >
                <Text style={styles.deleteCollectionText}>
                  {isDeletingCollection ? 'Deleting...' : 'Delete Collection'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.chipRow}>
            <InterestChip
              label="All"
              selected={activeFilter === 'all'}
              onPress={() => void handleFilterPress('all')}
            />
            <InterestChip
              label="Ungrouped"
              selected={activeFilter === 'ungrouped'}
              onPress={() => void handleFilterPress('ungrouped')}
            />
            {collections.map((collection) => (
              <InterestChip
                key={collection.id}
                label={collection.name}
                selected={activeFilter === getCollectionFilterValue(collection.id)}
                onPress={() =>
                  void handleFilterPress(getCollectionFilterValue(collection.id))
                }
              />
            ))}
          </View>

          <Text style={styles.filterDescription}>
            {buildFilterDescription(activeFilter, savedTripsData)}
          </Text>
        </View>

        <View style={styles.createCollectionCard}>
          <Text style={styles.createCollectionTitle}>New Collection</Text>
          <Text style={styles.createCollectionText}>
            Add a grouping bucket for saved public trips. Trips can belong to more than one collection.
          </Text>
          <TextInput
            style={styles.createCollectionInput}
            placeholder="Weekend ideas"
            placeholderTextColor={theme.colors.textSecondary}
            value={newCollectionName}
            onChangeText={setNewCollectionName}
            editable={!isCreatingCollection}
            returnKeyType="done"
            onSubmitEditing={() => void handleTopLevelCreateCollection()}
          />
          {createCollectionError ? (
            <Text style={styles.inlineErrorText}>{createCollectionError}</Text>
          ) : null}
          <AppButton
            title={isCreatingCollection ? 'Creating...' : 'Create Collection'}
            onPress={() => void handleTopLevelCreateCollection()}
            disabled={isCreatingCollection}
          />
        </View>

        {error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Saved trips unavailable</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <AppButton title="Try Again" onPress={() => void loadSavedTrips()} />
          </View>
        ) : items.length > 0 ? (
          items.map((item) => (
            <View key={item.savedTripId} style={styles.tripCard}>
              <Pressable
                onPress={() => router.push(`/public-trip/${item.trip.id}` as any)}
              >
                <TripPreviewCard
                  preview={item.preview}
                  dateLabel={formatSavedDate(item.trip.date)}
                  rightContent={
                    <View style={styles.savedBadge}>
                      <Ionicons
                        name="bookmark"
                        size={14}
                        color={theme.colors.primaryDark}
                      />
                      <Text style={styles.savedBadgeText}>Saved</Text>
                    </View>
                  }
                />
              </Pressable>

              <View style={styles.cardFooter}>
                <View style={styles.creatorRow}>
                  <Ionicons
                    name="person-outline"
                    size={14}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.creatorText}>
                    {formatCreatorName(item.creator.displayName)}
                  </Text>
                </View>
                <Text style={styles.savedAtText}>
                  Saved {formatSavedDate(item.savedAt)}
                </Text>
              </View>

              <View style={styles.metaCard}>
                <Text style={styles.metaTitle}>Public trip snapshot</Text>
                <Text style={styles.metaText}>{buildMetaLine(item)}</Text>
              </View>

              <View style={styles.collectionsCard}>
                <View style={styles.collectionsHeaderRow}>
                  <View style={styles.collectionsHeaderText}>
                    <Text style={styles.collectionsTitle}>Collections</Text>
                    <Text style={styles.collectionsSubtitle}>
                      {item.collections.length > 0
                        ? 'This saved trip appears in these groups.'
                        : 'This saved trip is currently ungrouped.'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleOpenManageCollections(item)}
                    hitSlop={8}
                  >
                    <Text style={styles.manageCollectionsText}>
                      Manage Collections
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.membershipRow}>
                  {item.collections.length > 0 ? (
                    item.collections.map((collection) => (
                      <View key={collection.id} style={styles.membershipBadge}>
                        <Text style={styles.membershipBadgeText}>
                          {collection.name}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.ungroupedBadge}>
                      <Text style={styles.ungroupedBadgeText}>Ungrouped</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
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
                : 'Adjust collection memberships or save more public trips from Explore to fill this view.'}
            </Text>
            <AppButton
              title="Open Explore"
              onPress={() => router.replace('/(tabs)/explore')}
            />
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xl,
  },
  filterCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  filterHeaderTextWrap: {
    flex: 1,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  filterSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  deleteCollectionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.md,
  },
  filterDescription: {
    marginTop: theme.spacing.sm,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  createCollectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  createCollectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  createCollectionText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  createCollectionInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  inlineErrorText: {
    marginTop: -4,
    marginBottom: theme.spacing.sm,
    fontSize: 13,
    color: '#991B1B',
  },
  tripCard: {
    marginBottom: theme.spacing.xl,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DFF7F6',
    borderColor: theme.colors.primary,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  cardFooter: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  savedAtText: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metaCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  metaTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  collectionsCard: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  collectionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  collectionsHeaderText: {
    flex: 1,
  },
  collectionsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  collectionsSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  manageCollectionsText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  membershipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  membershipBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#E6FBFA',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  membershipBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  ungroupedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ungroupedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
});
