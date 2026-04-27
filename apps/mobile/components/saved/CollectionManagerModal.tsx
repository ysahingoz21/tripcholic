import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppButton from '@/components/ui/AppButton';
import { theme } from '@/constants/theme';
import type {
  SavedPublicTripItem,
  SavedTripCollectionSummary,
} from '@/services/publicTrips';

type Props = {
  visible: boolean;
  item: SavedPublicTripItem | null;
  collections: SavedTripCollectionSummary[];
  isSaving: boolean;
  isCreatingCollection: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (savedTripId: string, collectionIds: string[]) => Promise<void>;
  onCreateCollection: (name: string) => Promise<SavedTripCollectionSummary>;
};

function formatCollectionSummary(count: number) {
  if (count === 0) {
    return 'Empty collection';
  }

  return `${count} saved trip${count === 1 ? '' : 's'}`;
}

export default function CollectionManagerModal({
  visible,
  item,
  collections,
  isSaving,
  isCreatingCollection,
  error,
  onClose,
  onSave,
  onCreateCollection,
}: Props) {
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) {
      setSelectedCollectionIds([]);
      setNewCollectionName('');
      setCreateError(null);
      return;
    }

    setSelectedCollectionIds(item.collections.map((collection) => collection.id));
    setNewCollectionName('');
    setCreateError(null);
  }, [item]);

  const toggleCollection = (collectionId: string) => {
    setSelectedCollectionIds((current) =>
      current.includes(collectionId)
        ? current.filter((id) => id !== collectionId)
        : [...current, collectionId]
    );
  };

  const handleCreateCollection = async () => {
    const trimmedName = newCollectionName.trim();

    if (!trimmedName) {
      setCreateError('Collection name cannot be empty.');
      return;
    }

    try {
      setCreateError(null);
      const createdCollection = await onCreateCollection(trimmedName);
      setSelectedCollectionIds((current) =>
        current.includes(createdCollection.id)
          ? current
          : [...current, createdCollection.id]
      );
      setNewCollectionName('');
    } catch (creationError) {
      setCreateError(
        creationError instanceof Error
          ? creationError.message
          : 'Unable to create collection.'
      );
    }
  };

  const handleSave = async () => {
    if (!item || isSaving) {
      return;
    }

    await onSave(item.savedTripId, selectedCollectionIds);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Manage Collections</Text>
              <Text style={styles.subtitle}>
                {item
                  ? `Choose where ${item.trip.title} should appear inside Saved Trips.`
                  : 'Choose where this saved trip should appear.'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Memberships</Text>
              <Text style={styles.sectionText}>
                Leave everything unchecked to keep the trip saved but ungrouped.
              </Text>
            </View>

            {collections.length > 0 ? (
              collections.map((collection) => {
                const isSelected = selectedCollectionIds.includes(collection.id);

                return (
                  <Pressable
                    key={collection.id}
                    style={[
                      styles.collectionRow,
                      isSelected && styles.collectionRowSelected,
                    ]}
                    onPress={() => toggleCollection(collection.id)}
                  >
                    <View style={styles.collectionInfo}>
                      <Text style={styles.collectionName}>{collection.name}</Text>
                      <Text style={styles.collectionSummary}>
                        {formatCollectionSummary(collection.savedTripCount)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}
                    >
                      {isSelected ? (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={theme.colors.white}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyCollectionsCard}>
                <Text style={styles.emptyCollectionsTitle}>
                  No collections yet
                </Text>
                <Text style={styles.emptyCollectionsText}>
                  Create the first collection below to start organizing saved public trips.
                </Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Create</Text>
              <Text style={styles.sectionText}>
                Add a new collection without leaving this trip.
              </Text>
            </View>

            <View style={styles.createCard}>
              <TextInput
                style={styles.input}
                placeholder="Weekend ideas"
                placeholderTextColor={theme.colors.textSecondary}
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                editable={!isCreatingCollection}
                returnKeyType="done"
                onSubmitEditing={() => void handleCreateCollection()}
              />
              {createError ? (
                <Text style={styles.inlineErrorText}>{createError}</Text>
              ) : null}
              <AppButton
                title={isCreatingCollection ? 'Creating...' : 'Create Collection'}
                onPress={() => void handleCreateCollection()}
                disabled={isCreatingCollection}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <View style={styles.saveButtonWrap}>
              <AppButton
                title={isSaving ? 'Saving...' : 'Save Memberships'}
                onPress={() => void handleSave()}
                disabled={isSaving}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: '86%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  closeButton: {
    paddingTop: 2,
  },
  errorBanner: {
    marginTop: theme.spacing.md,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#991B1B',
  },
  scroll: {
    marginTop: theme.spacing.lg,
  },
  scrollContent: {
    paddingBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: '#F8FAFC',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  collectionRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#E6FBFA',
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  collectionSummary: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  emptyCollectionsCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: '#F8FAFC',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  emptyCollectionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  emptyCollectionsText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  createCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  input: {
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  saveButtonWrap: {
    flex: 1,
  },
});
