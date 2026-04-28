import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import TripPreviewCard from '@/components/trip/TripPreviewCard';
import AppButton from '@/components/ui/AppButton';
import InterestChip from '@/components/ui/InterestChip';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import {
  EXPLORE_PROMPTS,
  type ExplorePromptDefinition,
  type ExplorePromptId,
} from '@/constants/explorePrompts';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getForYouPublicTrips,
  type ForYouTripItem,
  type ForYouTripsResponse,
} from '@/services/publicTrips';
import {
  getExploreTrips,
  type ExploreTripItem,
  type ExploreTripsResponse,
  type ExploreWeather,
} from '@/services/trips';

type BudgetFilter = 'any' | 'under-2000' | '2000-6000' | '6000-plus';
type ExploreMode = 'for-you' | 'explore';

const budgetOptions: {
  value: BudgetFilter;
  label: string;
  budgetMinTl?: number;
  budgetMaxTl?: number;
}[] = [
  { value: 'any', label: 'Any' },
  { value: 'under-2000', label: 'Under 2000 TL', budgetMaxTl: 2000 },
  { value: '2000-6000', label: '2000-6000 TL', budgetMinTl: 2000, budgetMaxTl: 6000 },
  { value: '6000-plus', label: '6000+ TL', budgetMinTl: 6000 },
];

function getBudgetQuery(budgetFilter: BudgetFilter) {
  return budgetOptions.find((option) => option.value === budgetFilter) ?? budgetOptions[0];
}

function getBudgetFilterForPrompt(prompt: ExplorePromptDefinition): BudgetFilter {
  if (prompt.filters.budgetMinTl === 2000 && prompt.filters.budgetMaxTl === 6000) {
    return '2000-6000';
  }

  if (prompt.filters.budgetMinTl === 6000 && prompt.filters.budgetMaxTl === undefined) {
    return '6000-plus';
  }

  if (prompt.filters.budgetMinTl === undefined && prompt.filters.budgetMaxTl === 2000) {
    return 'under-2000';
  }

  return 'any';
}

function promptStillMatchesState(
  prompt: ExplorePromptDefinition,
  selectedCategory: string | null,
  selectedWeather: ExploreWeather | null,
  selectedBudgetQuery: ReturnType<typeof getBudgetQuery>
) {
  const matchesCategory =
    prompt.filters.category === undefined || prompt.filters.category === selectedCategory;
  const matchesWeather =
    prompt.filters.weather === undefined || prompt.filters.weather === selectedWeather;
  const matchesBudgetMin = prompt.filters.budgetMinTl === undefined
    || prompt.filters.budgetMinTl === selectedBudgetQuery.budgetMinTl;
  const matchesBudgetMax = prompt.filters.budgetMaxTl === undefined
    || prompt.filters.budgetMaxTl === selectedBudgetQuery.budgetMaxTl;

  return matchesCategory && matchesWeather && matchesBudgetMin && matchesBudgetMax;
}

function formatCreatorName(displayName: string | null) {
  return displayName?.trim() || 'Tripcholic traveler';
}

function formatOptimizedDate(value: string | null) {
  if (!value) {
    return 'Recently optimized';
  }

  return `Optimized ${new Date(value).toLocaleDateString()}`;
}

function buildExploreResultSummary(total: number, category: string | null) {
  if (total === 0) {
    return 'No public trips match the current search and filters.';
  }

  if (category) {
    return `${total} public trip${total === 1 ? '' : 's'} found in ${category}.`;
  }

  return `${total} public trip${total === 1 ? '' : 's'} ready to explore.`;
}

function buildForYouSubtitle(data: ForYouTripsResponse | null) {
  if (!data) {
    return 'Based on trips you save, like, and complete.';
  }

  if (data.meta.personalizationState === 'cold_start') {
    return 'Based on trips you save, like, and complete. We are still learning your taste, so these start with broader public picks.';
  }

  return 'Based on trips you save, like, and complete.';
}

function buildForYouSummary(data: ForYouTripsResponse | null) {
  if (!data) {
    return 'Personalized public picks using your activity on shared trips.';
  }

  const { total, signalSummary } = data.meta;
  const signalCount =
    signalSummary.saves +
    signalSummary.completions +
    signalSummary.likes +
    signalSummary.feedbackSubmissions;

  if (data.meta.personalizationState === 'cold_start') {
    return `${total} public trip${total === 1 ? '' : 's'} available while we build a stronger taste signal.`;
  }

  return `${total} public trip${total === 1 ? '' : 's'} shaped by ${signalCount} saved, liked, completed, and feedback-based signal${
    signalCount === 1 ? '' : 's'
  }.`;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [mode, setMode] = useState<ExploreMode>('explore');
  const initialModeResolvedRef = useRef(false);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [activePromptId, setActivePromptId] = useState<ExplorePromptId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<ExploreWeather | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetFilter>('any');
  const [exploreData, setExploreData] = useState<ExploreTripsResponse | null>(null);
  const [isExploreLoading, setIsExploreLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [forYouData, setForYouData] = useState<ForYouTripsResponse | null>(null);
  const [isForYouLoading, setIsForYouLoading] = useState(true);
  const [forYouError, setForYouError] = useState<string | null>(null);

  const selectedBudgetQuery = useMemo(
    () => getBudgetQuery(selectedBudget),
    [selectedBudget]
  );
  const activePrompt = useMemo(
    () =>
      activePromptId === null
        ? null
        : EXPLORE_PROMPTS.find((prompt) => prompt.id === activePromptId) ?? null,
    [activePromptId]
  );

  useEffect(() => {
    if (!initialModeResolvedRef.current && !isAuthLoading) {
      setMode(token ? 'for-you' : 'explore');
      initialModeResolvedRef.current = true;
    }
  }, [isAuthLoading, token]);

  useEffect(() => {
    if (
      activePrompt &&
      !promptStillMatchesState(
        activePrompt,
        selectedCategory,
        selectedWeather,
        selectedBudgetQuery
      )
    ) {
      setActivePromptId(null);
    }
  }, [activePrompt, selectedBudgetQuery, selectedCategory, selectedWeather]);

  const loadExploreTrips = useCallback(async () => {
    try {
      setIsExploreLoading(true);
      setExploreError(null);
      const data = await getExploreTrips({
        q: appliedQuery.trim() || undefined,
        category: selectedCategory ?? undefined,
        budgetMinTl: selectedBudgetQuery.budgetMinTl,
        budgetMaxTl: selectedBudgetQuery.budgetMaxTl,
        weather: selectedWeather ?? undefined,
        limit: 20,
      });
      setExploreData(data);
    } catch (loadError) {
      setExploreError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load explore trips.'
      );
      setExploreData(null);
    } finally {
      setIsExploreLoading(false);
    }
  }, [appliedQuery, selectedBudgetQuery, selectedCategory, selectedWeather]);

  const loadForYouTrips = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!token) {
      setForYouData(null);
      setForYouError('Sign in to view personalized public trip picks.');
      setIsForYouLoading(false);
      return;
    }

    try {
      setIsForYouLoading(true);
      setForYouError(null);
      const data = await getForYouPublicTrips(token, 20);
      setForYouData(data);
    } catch (loadError) {
      setForYouError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load personalized trips.'
      );
      setForYouData(null);
    } finally {
      setIsForYouLoading(false);
    }
  }, [isAuthLoading, token]);

  useFocusEffect(
    useCallback(() => {
      if (mode === 'for-you') {
        void loadForYouTrips();
        return;
      }

      void loadExploreTrips();
    }, [loadExploreTrips, loadForYouTrips, mode])
  );

  const availableCategories = exploreData?.meta.availableCategories ?? [];
  const exploreItems = exploreData?.items ?? [];
  const exploreTotal = exploreData?.meta.total ?? 0;
  const forYouItems = forYouData?.items ?? [];

  const handleApplySearch = () => {
    setAppliedQuery(searchInput.trim());
  };

  const clearPromptFilters = useCallback((prompt: ExplorePromptDefinition | null) => {
    if (!prompt) {
      return;
    }

    if (prompt.filters.category !== undefined) {
      setSelectedCategory(null);
    }

    if (prompt.filters.weather !== undefined) {
      setSelectedWeather(null);
    }

    if (prompt.filters.budgetMinTl !== undefined || prompt.filters.budgetMaxTl !== undefined) {
      setSelectedBudget('any');
    }
  }, []);

  const handlePromptPress = (prompt: ExplorePromptDefinition) => {
    if (activePrompt?.id === prompt.id) {
      clearPromptFilters(activePrompt);
      setActivePromptId(null);
      return;
    }

    clearPromptFilters(activePrompt);

    if (prompt.filters.category !== undefined) {
      setSelectedCategory(prompt.filters.category);
    }

    if (prompt.filters.weather !== undefined) {
      setSelectedWeather(prompt.filters.weather);
    }

    if (prompt.filters.budgetMinTl !== undefined || prompt.filters.budgetMaxTl !== undefined) {
      setSelectedBudget(getBudgetFilterForPrompt(prompt));
    }

    setActivePromptId(prompt.id);
  };

  const handleClearPrompt = () => {
    clearPromptFilters(activePrompt);
    setActivePromptId(null);
  };

  const handleReset = () => {
    setActivePromptId(null);
    setSearchInput('');
    setAppliedQuery('');
    setSelectedCategory(null);
    setSelectedWeather(null);
    setSelectedBudget('any');
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle
          title="Explore Trips"
          subtitle={
            mode === 'for-you'
              ? buildForYouSubtitle(forYouData)
              : 'Browse optimized public itineraries and narrow them down with simple search and filters.'
          }
        />

        <View style={styles.modeSwitchCard}>
          <View style={styles.modeSwitch}>
            <ModeButton
              label="For You"
              selected={mode === 'for-you'}
              onPress={() => setMode('for-you')}
            />
            <ModeButton
              label="Explore"
              selected={mode === 'explore'}
              onPress={() => setMode('explore')}
            />
          </View>
          <Text style={styles.modeSwitchHelper}>
            {mode === 'for-you'
              ? 'Personalized public picks from your existing activity.'
              : 'Search and filter the broader public trip catalog.'}
          </Text>
        </View>

        {mode === 'for-you' ? (
          <>
            <SectionTitle
              title="For You"
              subtitle={buildForYouSummary(forYouData)}
            />

            <View style={styles.swipeCtaCard}>
              <View style={styles.swipeCtaTextWrap}>
                <Text style={styles.swipeCtaTitle}>Quick swipe discovery</Text>
                <Text style={styles.swipeCtaText}>
                  Move through personalized public trips faster with save or pass.
                </Text>
              </View>
              <View style={styles.swipeCtaAction}>
                <AppButton
                  title="Start swiping"
                  onPress={() => router.push('/swipe-discovery' as any)}
                />
              </View>
            </View>

            {forYouError ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>For You unavailable</Text>
                <Text style={styles.emptyText}>{forYouError}</Text>
                <AppButton title="Try Again" onPress={() => void loadForYouTrips()} />
                <Pressable onPress={() => setMode('explore')} style={styles.secondaryAction}>
                  <Text style={styles.secondaryActionText}>Open generic Explore instead</Text>
                </Pressable>
              </View>
            ) : isForYouLoading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading For You</Text>
                <Text style={styles.emptyText}>
                  Pulling personalized public trips from your saved, liked, and completed activity.
                </Text>
              </View>
            ) : forYouItems.length > 0 ? (
              forYouItems.map((trip) => (
                <TripFeedCard
                  key={trip.id}
                  preview={trip.preview}
                  creatorName={trip.creator.displayName}
                  optimizedAt={trip.optimizedAt}
                  onPress={() => router.push(`/public-trip/${trip.id}` as any)}
                  badgeLabel={trip.recommendation.kind === 'personalized' ? 'For You' : 'Public'}
                  recommendationLine={trip.recommendation.primaryReason}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No For You trips yet</Text>
                <Text style={styles.emptyText}>
                  We could not find any eligible public trips for a personalized feed right now.
                </Text>
                <AppButton title="Open Explore" onPress={() => setMode('explore')} />
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.searchCard}>
              <View style={styles.promptHeaderRow}>
                <View style={styles.promptHeaderText}>
                  <Text style={styles.fieldLabel}>Seasonal and mood prompts</Text>
                  <Text style={styles.promptHelperText}>
                    Quick Explore presets that apply real filters.
                  </Text>
                </View>
                {activePrompt ? (
                  <Pressable onPress={handleClearPrompt} hitSlop={8}>
                    <Text style={styles.clearPromptText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.chipRow}>
                {EXPLORE_PROMPTS.map((prompt) => (
                  <InterestChip
                    key={prompt.id}
                    label={prompt.label}
                    selected={activePromptId === prompt.id}
                    onPress={() => handlePromptPress(prompt)}
                  />
                ))}
              </View>
              {activePrompt ? (
                <View style={styles.promptAppliedBanner}>
                  <Text style={styles.promptAppliedLabel}>Prompt applied</Text>
                  <Text style={styles.promptAppliedTitle}>{activePrompt.label}</Text>
                  <Text style={styles.promptAppliedDescription}>
                    {activePrompt.description}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.searchCard}>
              <Text style={styles.fieldLabel}>Keyword search</Text>
              <View style={styles.searchRow}>
                <View style={styles.searchInputWrap}>
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search title, route name, or creator"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={searchInput}
                    onChangeText={setSearchInput}
                    onSubmitEditing={handleApplySearch}
                    returnKeyType="search"
                  />
                </View>
              </View>
              <View style={styles.searchActions}>
                <View style={styles.searchActionPrimary}>
                  <AppButton title="Search" onPress={handleApplySearch} />
                </View>
                <View style={styles.searchActionSecondary}>
                  <AppButton title="Reset" onPress={handleReset} />
                </View>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipRow}>
                <InterestChip
                  label="All"
                  selected={selectedCategory === null}
                  onPress={() => setSelectedCategory(null)}
                />
                {availableCategories.map((category) => (
                  <InterestChip
                    key={category}
                    label={category.charAt(0).toUpperCase() + category.slice(1)}
                    selected={selectedCategory === category}
                    onPress={() =>
                      setSelectedCategory((current) =>
                        current === category ? null : category
                      )
                    }
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.fieldLabel}>Budget</Text>
              <View style={styles.chipRow}>
                {budgetOptions.map((option) => (
                  <InterestChip
                    key={option.value}
                    label={option.label}
                    selected={selectedBudget === option.value}
                    onPress={() => setSelectedBudget(option.value)}
                  />
                ))}
              </View>
            </View>

            <SectionTitle
              title="Discoverable Trips"
              subtitle={buildExploreResultSummary(exploreTotal, selectedCategory)}
            />

            {exploreError ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Explore unavailable</Text>
                <Text style={styles.emptyText}>{exploreError}</Text>
                <AppButton title="Try Again" onPress={() => void loadExploreTrips()} />
              </View>
            ) : isExploreLoading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading trips</Text>
                <Text style={styles.emptyText}>
                  Fetching optimized public itineraries for Explore.
                </Text>
              </View>
            ) : exploreItems.length > 0 ? (
              exploreItems.map((trip) => (
                <TripFeedCard
                  key={trip.id}
                  preview={trip.preview}
                  creatorName={trip.creator.displayName}
                  optimizedAt={trip.optimizedAt}
                  onPress={() => router.push(`/public-trip/${trip.id}` as any)}
                  badgeLabel="Public"
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No trips found</Text>
                <Text style={styles.emptyText}>
                  Try a broader keyword or clear one of the filters to see more public trips.
                </Text>
                <AppButton title="Clear Filters" onPress={handleReset} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function ModeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.modeButton, selected && styles.modeButtonSelected]}
      onPress={onPress}
    >
      <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TripFeedCard({
  preview,
  creatorName,
  optimizedAt,
  onPress,
  badgeLabel,
  recommendationLine,
}: {
  preview: ExploreTripItem['preview'] | ForYouTripItem['preview'];
  creatorName: string | null;
  optimizedAt: string | null;
  onPress: () => void;
  badgeLabel: string;
  recommendationLine?: string;
}) {
  return (
    <Pressable style={styles.resultCard} onPress={onPress}>
      <TripPreviewCard
        preview={preview}
        rightContent={
          <View style={styles.resultBadge}>
            <Text style={styles.resultBadgeText}>{badgeLabel}</Text>
          </View>
        }
      />

      <View style={styles.resultMeta}>
        <View style={styles.creatorRow}>
          <Ionicons
            name="person-outline"
            size={14}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.creatorText}>
            {formatCreatorName(creatorName)}
          </Text>
        </View>
        {recommendationLine ? (
          <View style={styles.recommendationRow}>
            <Ionicons
              name="sparkles-outline"
              size={14}
              color={theme.colors.primaryDark}
            />
            <Text style={styles.recommendationText}>{recommendationLine}</Text>
          </View>
        ) : null}
        <Text style={styles.optimizedText}>{formatOptimizedDate(optimizedAt)}</Text>
        <Text style={styles.openPostText}>Open public trip</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xl,
  },
  modeSwitchCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#EAF1F5',
    borderRadius: 999,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonSelected: {
    backgroundColor: theme.colors.primaryDark,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  modeButtonTextSelected: {
    color: theme.colors.white,
  },
  modeSwitchHelper: {
    marginTop: theme.spacing.sm,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  swipeCtaCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: '#BEEDE7',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  swipeCtaTextWrap: {
    marginBottom: theme.spacing.md,
  },
  swipeCtaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginBottom: 6,
  },
  swipeCtaText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  swipeCtaAction: {
    marginTop: 4,
  },
  searchCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  promptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  promptHeaderText: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  promptHelperText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  clearPromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  promptAppliedBanner: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#BEEDE7',
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  promptAppliedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  promptAppliedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  promptAppliedDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  searchRow: {
    marginBottom: theme.spacing.md,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: theme.colors.text,
    fontSize: 15,
  },
  searchActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  searchActionPrimary: {
    flex: 1,
  },
  searchActionSecondary: {
    flex: 1,
  },
  filterSection: {
    marginBottom: theme.spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  resultCard: {
    marginBottom: theme.spacing.lg,
  },
  resultBadge: {
    backgroundColor: '#E8F7EE',
    borderColor: '#BBE7CA',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  resultMeta: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: -2,
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
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  recommendationText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  optimizedText: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  openPostText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
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
  secondaryAction: {
    marginTop: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
});
