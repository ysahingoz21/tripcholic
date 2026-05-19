import ExploreTripCard from '@/components/discovery/ExploreTripCard';
import InlineSwipePanel from '@/components/discovery/InlineSwipePanel';
import {
  EXPLORE_PROMPTS,
  type ExplorePromptDefinition,
  type ExplorePromptId,
} from '@/constants/explorePrompts';
import { theme } from '@/constants/theme';
import { font, type } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import {
  getForYouPublicTrips,
  getSavedPublicTrips,
  type ForYouTripItem,
  type ForYouTripsResponse,
  type PublicTripEngagement,
} from '@/services/publicTrips';
import {
  getExploreTrips,
  type ExploreTripItem,
  type ExploreTripsResponse,
  type ExploreWeather,
} from '@/services/trips';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const H_PAD = 20;

// ── Types ───────────────────────────────────────────────────────────────────

type ExploreMode = 'explore' | 'for-you' | 'swipe';
type BudgetFilter = 'any' | 'under-2000' | '2000-6000' | '6000-plus';
type ExploreSortMode = 'default' | 'title-az' | 'title-za' | 'budget-low' | 'budget-high';

// ── Budget helpers ──────────────────────────────────────────────────────────

const BUDGET_OPTIONS: {
  value: BudgetFilter;
  label: string;
  budgetMinTl?: number;
  budgetMaxTl?: number;
}[] = [
  { value: 'any', label: 'Any budget' },
  { value: 'under-2000', label: '≤ ₺2K', budgetMaxTl: 2000 },
  { value: '2000-6000', label: '₺2K – ₺6K', budgetMinTl: 2000, budgetMaxTl: 6000 },
  { value: '6000-plus', label: '₺6K+', budgetMinTl: 6000 },
];

const EXPLORE_SORT_MODES: { mode: ExploreSortMode; label: string }[] = [
  { mode: 'default', label: 'Relevance' },
  { mode: 'title-az', label: 'Title A→Z' },
  { mode: 'title-za', label: 'Title Z→A' },
  { mode: 'budget-low', label: 'Budget: Low' },
  { mode: 'budget-high', label: 'Budget: High' },
];

function formatOptimizedDate(optimizedAt: string | null | undefined): string | undefined {
  if (!optimizedAt) return undefined;
  const d = new Date(optimizedAt);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getBudgetQuery(value: BudgetFilter) {
  return BUDGET_OPTIONS.find((o) => o.value === value) ?? BUDGET_OPTIONS[0];
}

function getBudgetFilterForPrompt(
  prompt: ExplorePromptDefinition
): BudgetFilter {
  if (
    prompt.filters.budgetMinTl === 2000 &&
    prompt.filters.budgetMaxTl === 6000
  )
    return '2000-6000';
  if (
    prompt.filters.budgetMinTl === 6000 &&
    prompt.filters.budgetMaxTl === undefined
  )
    return '6000-plus';
  if (
    prompt.filters.budgetMinTl === undefined &&
    prompt.filters.budgetMaxTl === 2000
  )
    return 'under-2000';
  return 'any';
}

function promptStillMatchesState(
  prompt: ExplorePromptDefinition,
  selectedCategory: string | null,
  selectedWeather: ExploreWeather | null,
  selectedBudgetQuery: ReturnType<typeof getBudgetQuery>
) {
  const matchesCategory =
    prompt.filters.category === undefined ||
    prompt.filters.category === selectedCategory;
  const matchesWeather =
    prompt.filters.weather === undefined ||
    prompt.filters.weather === selectedWeather;
  const matchesBudgetMin =
    prompt.filters.budgetMinTl === undefined ||
    prompt.filters.budgetMinTl === selectedBudgetQuery.budgetMinTl;
  const matchesBudgetMax =
    prompt.filters.budgetMaxTl === undefined ||
    prompt.filters.budgetMaxTl === selectedBudgetQuery.budgetMaxTl;
  return (
    matchesCategory && matchesWeather && matchesBudgetMin && matchesBudgetMax
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();

  const [mode, setMode] = useState<ExploreMode>('explore');

  // ── Explore state ──
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [activePromptId, setActivePromptId] =
    useState<ExplorePromptId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWeather, setSelectedWeather] =
    useState<ExploreWeather | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetFilter>('any');
  const [exploreSortIdx, setExploreSortIdx] = useState(0);
  const [exploreData, setExploreData] =
    useState<ExploreTripsResponse | null>(null);
  const [isExploreLoading, setIsExploreLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);

  // ── Saved trip engagement map (seeded from saved-trips; keyed by trip.id) ──
  const [engagementMap, setEngagementMap] = useState<Map<string, PublicTripEngagement>>(new Map());

  // ── For You state ──
  const [forYouData, setForYouData] =
    useState<ForYouTripsResponse | null>(null);
  const [isForYouLoading, setIsForYouLoading] = useState(true);
  const [forYouError, setForYouError] = useState<string | null>(null);

  // ── Derived ──
  const selectedBudgetQuery = useMemo(
    () => getBudgetQuery(selectedBudget),
    [selectedBudget]
  );
  const activePrompt = useMemo(
    () =>
      activePromptId === null
        ? null
        : (EXPLORE_PROMPTS.find((p) => p.id === activePromptId) ?? null),
    [activePromptId]
  );

  // ── Auto-clear prompt when filters diverge ──
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

  // ── Data loaders ──
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
    } catch (err) {
      setExploreError(
        err instanceof Error ? err.message : 'Unable to load explore trips.'
      );
      setExploreData(null);
    } finally {
      setIsExploreLoading(false);
    }
  }, [
    appliedQuery,
    selectedBudgetQuery,
    selectedCategory,
    selectedWeather,
  ]);

  const loadForYouTrips = useCallback(async () => {
    if (isAuthLoading) return;
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
    } catch (err) {
      setForYouError(
        err instanceof Error
          ? err.message
          : 'Unable to load personalized trips.'
      );
      setForYouData(null);
    } finally {
      setIsForYouLoading(false);
    }
  }, [isAuthLoading, token]);

  // Clear engagement map on sign-out
  useEffect(() => {
    if (!token) setEngagementMap(new Map());
  }, [token]);

  const loadEngagement = useCallback(() => {
    if (!token) return;
    getSavedPublicTrips(token)
      .then((result) => {
        const map = new Map<string, PublicTripEngagement>();
        for (const item of result.items) {
          map.set(item.trip.id, item.engagement);
        }
        setEngagementMap(map);
      })
      .catch(() => {});
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (mode === 'for-you') {
        void loadForYouTrips();
      } else if (mode === 'explore') {
        void loadExploreTrips();
      }
      // Always refresh engagement data on focus so save/like state stays current
      loadEngagement();
      // swipe mode loads itself inside InlineSwipePanel
    }, [loadExploreTrips, loadForYouTrips, loadEngagement, mode])
  );

  // ── Filter handlers ──
  const handleApplySearch = () => setAppliedQuery(searchInput.trim());

  const clearPromptFilters = useCallback(
    (prompt: ExplorePromptDefinition | null) => {
      if (!prompt) return;
      if (prompt.filters.category !== undefined) setSelectedCategory(null);
      if (prompt.filters.weather !== undefined) setSelectedWeather(null);
      if (
        prompt.filters.budgetMinTl !== undefined ||
        prompt.filters.budgetMaxTl !== undefined
      )
        setSelectedBudget('any');
    },
    []
  );

  const handlePromptPress = (prompt: ExplorePromptDefinition) => {
    if (activePrompt?.id === prompt.id) {
      clearPromptFilters(activePrompt);
      setActivePromptId(null);
      return;
    }
    clearPromptFilters(activePrompt);
    if (prompt.filters.category !== undefined)
      setSelectedCategory(prompt.filters.category);
    if (prompt.filters.weather !== undefined)
      setSelectedWeather(prompt.filters.weather);
    if (
      prompt.filters.budgetMinTl !== undefined ||
      prompt.filters.budgetMaxTl !== undefined
    )
      setSelectedBudget(getBudgetFilterForPrompt(prompt));
    setActivePromptId(prompt.id);
  };

  const handleReset = () => {
    setActivePromptId(null);
    setSearchInput('');
    setAppliedQuery('');
    setSelectedCategory(null);
    setSelectedWeather(null);
    setSelectedBudget('any');
    setExploreSortIdx(0);
  };

  const availableCategories = exploreData?.meta.availableCategories ?? [];
  const exploreItems = exploreData?.items ?? [];
  const forYouItems = forYouData?.items ?? [];

  const hasActiveFilters =
    !!activePromptId ||
    !!selectedCategory ||
    selectedBudget !== 'any' ||
    !!searchInput.trim() ||
    exploreSortIdx !== 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {/* ─── Mode switch (centered, full-width) ─── */}
      <View style={styles.modeArea}>
        <View style={styles.modeSwitch}>
          <ModeTab
            label="Explore"
            active={mode === 'explore'}
            onPress={() => setMode('explore')}
          />
          <ModeTab
            label="For You"
            active={mode === 'for-you'}
            onPress={() => setMode('for-you')}
          />
          <ModeTab
            label="Swipe"
            active={mode === 'swipe'}
            onPress={() => setMode('swipe')}
          />
        </View>
      </View>

      {/* ─── Swipe mode fills full height ─── */}
      {mode === 'swipe' ? (
        <InlineSwipePanel token={token} isAuthLoading={isAuthLoading} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {mode === 'explore' ? (
            <ExploreContent
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              onApplySearch={handleApplySearch}
              onReset={handleReset}
              hasActiveFilters={hasActiveFilters}
              activePromptId={activePromptId}
              activePrompt={activePrompt}
              onPromptPress={handlePromptPress}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedBudget={selectedBudget}
              onBudgetChange={setSelectedBudget}
              sortModeIdx={exploreSortIdx}
              onSortChange={setExploreSortIdx}
              availableCategories={availableCategories}
              isLoading={isExploreLoading}
              error={exploreError}
              items={exploreItems}
              onRetry={() => void loadExploreTrips()}
              onTripPress={(id) => router.push(`/public-trip/${id}` as any)}
              token={token}
              engagementMap={engagementMap}
            />
          ) : (
            <ForYouContent
              data={forYouData}
              isLoading={isForYouLoading}
              error={forYouError}
              items={forYouItems}
              onRetry={() => void loadForYouTrips()}
              onTripPress={(id) => router.push(`/public-trip/${id}` as any)}
              onSwitchToExplore={() => setMode('explore')}
              onSwitchToSwipe={() => setMode('swipe')}
              token={token}
              engagementMap={engagementMap}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Mode switch tab ────────────────────────────────────────────────────────

function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.modeTab, active && styles.modeTabActive]}
      onPress={onPress}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Explore content ────────────────────────────────────────────────────────

type ExploreContentProps = {
  searchInput: string;
  onSearchChange: (v: string) => void;
  onApplySearch: () => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  activePromptId: ExplorePromptId | null;
  activePrompt: ExplorePromptDefinition | null;
  onPromptPress: (p: ExplorePromptDefinition) => void;
  selectedCategory: string | null;
  onCategoryChange: (c: string | null) => void;
  selectedBudget: BudgetFilter;
  onBudgetChange: (b: BudgetFilter) => void;
  sortModeIdx: number;
  onSortChange: (idx: number) => void;
  availableCategories: string[];
  isLoading: boolean;
  error: string | null;
  items: ExploreTripItem[];
  onRetry: () => void;
  onTripPress: (id: string) => void;
  token: string | null;
  engagementMap: Map<string, PublicTripEngagement>;
};

function ExploreContent({
  searchInput,
  onSearchChange,
  onApplySearch,
  onReset,
  hasActiveFilters,
  activePromptId,
  activePrompt,
  onPromptPress,
  selectedCategory,
  onCategoryChange,
  selectedBudget,
  onBudgetChange,
  sortModeIdx,
  onSortChange,
  availableCategories,
  isLoading,
  error,
  items,
  onRetry,
  onTripPress,
  token,
  engagementMap,
}: ExploreContentProps) {
  const currentSort = EXPLORE_SORT_MODES[sortModeIdx];
  const currentBudget = BUDGET_OPTIONS.find((b) => b.value === selectedBudget)!;

  const sortedItems = useMemo(() => {
    if (currentSort.mode === 'default') return items;
    const sorted = [...items];
    switch (currentSort.mode) {
      case 'title-az':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-za':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'budget-low':
        sorted.sort(
          (a, b) => (a.routeTotalCostTl ?? 0) - (b.routeTotalCostTl ?? 0)
        );
        break;
      case 'budget-high':
        sorted.sort(
          (a, b) => (b.routeTotalCostTl ?? 0) - (a.routeTotalCostTl ?? 0)
        );
        break;
    }
    return sorted;
  }, [items, currentSort.mode]);

  function cycleSortMode() {
    onSortChange((sortModeIdx + 1) % EXPLORE_SORT_MODES.length);
  }

  function cycleBudgetFilter() {
    const idx = BUDGET_OPTIONS.findIndex((b) => b.value === selectedBudget);
    onBudgetChange(BUDGET_OPTIONS[(idx + 1) % BUDGET_OPTIONS.length].value);
  }

  return (
    <>
      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={17}
            color={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trips, creators…"
            placeholderTextColor={theme.colors.textSecondary}
            value={searchInput}
            onChangeText={onSearchChange}
            onSubmitEditing={onApplySearch}
            returnKeyType="search"
          />
          {searchInput.length > 0 && (
            <Pressable
              onPress={() => {
                onSearchChange('');
                onApplySearch();
              }}
              hitSlop={8}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
        {hasActiveFilters && (
          <Pressable onPress={onReset} hitSlop={8}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        )}
      </View>

      {/* ── Mood prompts ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {EXPLORE_PROMPTS.map((prompt) => (
          <Pressable
            key={prompt.id}
            style={[
              styles.filterChip,
              activePromptId === prompt.id && styles.filterChipActive,
            ]}
            onPress={() => onPromptPress(prompt)}
          >
            <Text
              style={[
                styles.filterChipText,
                activePromptId === prompt.id && styles.filterChipTextActive,
              ]}
            >
              {prompt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Category chips (dynamic from API) ── */}
      {availableCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          <Pressable
            style={[
              styles.filterChip,
              selectedCategory === null && styles.filterChipActive,
            ]}
            onPress={() => onCategoryChange(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === null && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {availableCategories.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.filterChip,
                selectedCategory === cat && styles.filterChipActive,
              ]}
              onPress={() =>
                onCategoryChange(selectedCategory === cat ? null : cat)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === cat && styles.filterChipTextActive,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Sort + Budget control row ── */}
      <View style={styles.controlRow}>
        <Pressable style={styles.controlPill} onPress={cycleSortMode}>
          <Ionicons
            name="swap-vertical-outline"
            size={14}
            color={theme.colors.primaryDark}
          />
          <Text style={styles.controlPillText}>{currentSort.label}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.controlPill,
            selectedBudget !== 'any' && styles.controlPillActive,
          ]}
          onPress={cycleBudgetFilter}
        >
          <Ionicons
            name="wallet-outline"
            size={14}
            color={
              selectedBudget !== 'any' ? '#FFFFFF' : theme.colors.primaryDark
            }
          />
          <Text
            style={[
              styles.controlPillText,
              selectedBudget !== 'any' && styles.controlPillTextActive,
            ]}
          >
            {currentBudget.label}
          </Text>
        </Pressable>
      </View>

      {/* ── Active prompt banner ── */}
      {activePrompt && (
        <View style={styles.promptBanner}>
          <View style={styles.promptBannerLeft}>
            <Text style={styles.promptBannerLabel}>ACTIVE PRESET</Text>
            <Text style={styles.promptBannerTitle}>{activePrompt.label}</Text>
            <Text style={styles.promptBannerDesc}>
              {activePrompt.description}
            </Text>
          </View>
          <Pressable onPress={onReset} hitSlop={8}>
            <Ionicons
              name="close"
              size={18}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </View>
      )}

      {/* ── Results ── */}
      {isLoading ? (
        <View style={styles.feedState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.feedStateBody}>Loading trips…</Text>
        </View>
      ) : error ? (
        <View style={styles.feedState}>
          <View style={styles.stateIconWrap}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.feedStateTitle}>Couldn't load trips</Text>
          <Text style={styles.feedStateBody}>{error}</Text>
          <Pressable style={styles.feedStateButton} onPress={onRetry}>
            <Text style={styles.feedStateButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.feedState}>
          <View style={styles.stateIconWrap}>
            <Ionicons
              name="search-outline"
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.feedStateTitle}>No trips found</Text>
          <Text style={styles.feedStateBody}>
            Try a broader keyword or clear one of the filters.
          </Text>
          <Pressable style={styles.feedStateButton} onPress={onReset}>
            <Text style={styles.feedStateButtonText}>Clear filters</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.feedList}>
          {sortedItems.map((trip) => {
            const eng = engagementMap.get(trip.id);
            return (
              <ExploreTripCard
                key={trip.id}
                tripId={trip.id}
                title={trip.title}
                categories={trip.categories}
                preview={trip.preview}
                creatorName={trip.creator.displayName}
                dateLabel={formatOptimizedDate(trip.optimizedAt)}
                token={token}
                onPress={() => onTripPress(trip.id)}
                initialSaved={eng?.savedByMe ?? false}
                initialLiked={eng?.likedByMe ?? false}
                initialLikeCount={eng?.likeCount ?? 0}
                initialSaveCount={eng?.saveCount ?? 0}
              />
            );
          })}
        </View>
      )}
    </>
  );
}

// ── For You content ────────────────────────────────────────────────────────

type ForYouContentProps = {
  data: ForYouTripsResponse | null;
  isLoading: boolean;
  error: string | null;
  items: ForYouTripItem[];
  onRetry: () => void;
  onTripPress: (id: string) => void;
  onSwitchToExplore: () => void;
  onSwitchToSwipe: () => void;
  token: string | null;
  engagementMap: Map<string, PublicTripEngagement>;
};

function ForYouContent({
  data,
  isLoading,
  error,
  items,
  onRetry,
  onTripPress,
  onSwitchToExplore,
  onSwitchToSwipe,
  token,
  engagementMap,
}: ForYouContentProps) {
  const isColdStart = data?.meta.personalizationState === 'cold_start';

  return (
    <>
      {/* Cold-start notice */}
      {isColdStart && (
        <View style={styles.coldStartBanner}>
          <Ionicons name="sparkles-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.coldStartText}>
            Still learning your taste — results improve as you save, like, and
            complete trips.
          </Text>
        </View>
      )}

      {/* Swipe mode CTA */}
      <Pressable style={styles.swipeCta} onPress={onSwitchToSwipe}>
        <View style={styles.swipeCtaIcon}>
          <Ionicons name="swap-horizontal" size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.swipeCtaText}>
          <Text style={styles.swipeCtaTitle}>Try Swipe mode</Text>
          <Text style={styles.swipeCtaSubtitle}>
            Move through picks faster — save or pass in one swipe.
          </Text>
        </View>
        <Ionicons
          name="arrow-forward"
          size={15}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      {/* Results */}
      {isLoading ? (
        <View style={styles.feedState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.feedStateBody}>Personalizing your feed…</Text>
        </View>
      ) : error ? (
        <View style={styles.feedState}>
          <View style={styles.stateIconWrap}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.feedStateTitle}>For You unavailable</Text>
          <Text style={styles.feedStateBody}>{error}</Text>
          <Pressable style={styles.feedStateButton} onPress={onRetry}>
            <Text style={styles.feedStateButtonText}>Try again</Text>
          </Pressable>
          <Pressable onPress={onSwitchToExplore} hitSlop={8}>
            <Text style={styles.feedStateLinkText}>Switch to Explore</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.feedState}>
          <View style={styles.stateIconWrap}>
            <Ionicons
              name="compass-outline"
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.feedStateTitle}>No For You picks yet</Text>
          <Text style={styles.feedStateBody}>
            We couldn't find eligible public trips right now. Try Explore for
            the full catalog.
          </Text>
          <Pressable style={styles.feedStateButton} onPress={onSwitchToExplore}>
            <Text style={styles.feedStateButtonText}>Open Explore</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.feedList}>
          {items.map((trip) => {
            const eng = engagementMap.get(trip.id);
            return (
              <ExploreTripCard
                key={trip.id}
                tripId={trip.id}
                title={trip.title}
                categories={trip.categories}
                preview={trip.preview}
                creatorName={trip.creator.displayName}
                dateLabel={formatOptimizedDate(trip.optimizedAt)}
                token={token}
                onPress={() => onTripPress(trip.id)}
                initialSaved={eng?.savedByMe ?? false}
                initialLiked={eng?.likedByMe ?? false}
                initialLikeCount={eng?.likeCount ?? 0}
                initialSaveCount={eng?.saveCount ?? 0}
              />
            );
          })}
        </View>
      )}
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ── Mode switch ──
  modeArea: {
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    paddingBottom: 10,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#E8ECEE',
    borderRadius: 14,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: theme.colors.primaryDark,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  modeTabText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.primaryDark,
    padding: 0,
  },
  resetText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primary,
  },

  // ── Chips ──
  chipScroll: {
    marginBottom: 10,
  },
  chipRow: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Sort + Budget control row ──
  controlRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  controlPillActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryDark,
  },
  controlPillText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },
  controlPillTextActive: {
    color: '#FFFFFF',
  },

  // ── Active prompt banner ──
  promptBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BEEDE7',
    padding: 14,
    marginBottom: 14,
  },
  promptBannerLeft: {
    flex: 1,
    gap: 3,
  },
  promptBannerLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  promptBannerTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  promptBannerDesc: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
  },

  // ── Feed states ──
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
  feedStateLinkText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    marginTop: 4,
  },

  // ── Feed list ──
  feedList: {
    gap: 20,
  },

  // ── For You specifics ──
  coldStartBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BEEDE7',
    padding: 14,
    marginBottom: 12,
  },
  coldStartText: {
    flex: 1,
    ...type.bodySm,
    color: '#065F46',
  },
  swipeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 16,
  },
  swipeCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeCtaText: {
    flex: 1,
    gap: 2,
  },
  swipeCtaTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  swipeCtaSubtitle: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
