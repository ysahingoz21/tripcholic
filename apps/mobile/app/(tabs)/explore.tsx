import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import ExploreTripCard from '@/components/discovery/ExploreTripCard';
import InlineSwipePanel from '@/components/discovery/InlineSwipePanel';
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

// ── Types ──────────────────────────────────────────────────────────────────

type ExploreMode = 'explore' | 'for-you' | 'swipe';
type BudgetFilter = 'any' | 'under-2000' | '2000-6000' | '6000-plus';

// ── Budget helpers ─────────────────────────────────────────────────────────

const BUDGET_OPTIONS: {
  value: BudgetFilter;
  label: string;
  budgetMinTl?: number;
  budgetMaxTl?: number;
}[] = [
  { value: 'any', label: 'Any budget' },
  { value: 'under-2000', label: 'Budget  ≤₺2K', budgetMaxTl: 2000 },
  {
    value: '2000-6000',
    label: '₺2K – ₺6K',
    budgetMinTl: 2000,
    budgetMaxTl: 6000,
  },
  { value: '6000-plus', label: 'Premium  ₺6K+', budgetMinTl: 6000 },
];

function getBudgetQuery(value: BudgetFilter) {
  return BUDGET_OPTIONS.find((o) => o.value === value) ?? BUDGET_OPTIONS[0];
}

function getBudgetFilterForPrompt(prompt: ExplorePromptDefinition): BudgetFilter {
  if (prompt.filters.budgetMinTl === 2000 && prompt.filters.budgetMaxTl === 6000)
    return '2000-6000';
  if (prompt.filters.budgetMinTl === 6000 && prompt.filters.budgetMaxTl === undefined)
    return '6000-plus';
  if (prompt.filters.budgetMinTl === undefined && prompt.filters.budgetMaxTl === 2000)
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
  return matchesCategory && matchesWeather && matchesBudgetMin && matchesBudgetMax;
}

// ── Display helpers ────────────────────────────────────────────────────────

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatCreatorName(name: string | null) {
  return name?.trim() || 'Tripcholic traveler';
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const initialModeResolvedRef = useRef(false);

  const [mode, setMode] = useState<ExploreMode>('explore');

  // ── Explore state ──
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [activePromptId, setActivePromptId] = useState<ExplorePromptId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<ExploreWeather | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetFilter>('any');
  const [exploreData, setExploreData] = useState<ExploreTripsResponse | null>(null);
  const [isExploreLoading, setIsExploreLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);

  // ── For You state ──
  const [forYouData, setForYouData] = useState<ForYouTripsResponse | null>(null);
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

  // ── Auth-based mode default ──
  useEffect(() => {
    if (!initialModeResolvedRef.current && !isAuthLoading) {
      setMode(token ? 'for-you' : 'explore');
      initialModeResolvedRef.current = true;
    }
  }, [isAuthLoading, token]);

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
  }, [appliedQuery, selectedBudgetQuery, selectedCategory, selectedWeather]);

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
        err instanceof Error ? err.message : 'Unable to load personalized trips.'
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
      } else if (mode === 'explore') {
        void loadExploreTrips();
      }
      // swipe mode loads itself inside InlineSwipePanel
    }, [loadExploreTrips, loadForYouTrips, mode])
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
  };

  const availableCategories = exploreData?.meta.availableCategories ?? [];
  const exploreItems = exploreData?.items ?? [];
  const forYouItems = forYouData?.items ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ISTANBUL</Text>
          <Text style={styles.title}>Discover</Text>
        </View>

        {/* 3-way tab pill */}
        <View style={styles.tabPill}>
          <TabButton
            label="Explore"
            active={mode === 'explore'}
            onPress={() => setMode('explore')}
          />
          <TabButton
            label="For You"
            active={mode === 'for-you'}
            onPress={() => setMode('for-you')}
          />
          <TabButton
            label="Swipe"
            active={mode === 'swipe'}
            onPress={() => setMode('swipe')}
          />
        </View>
      </View>

      {/* ─── Swipe mode (no ScrollView — deck takes full height) ─── */}
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
              activePromptId={activePromptId}
              activePrompt={activePrompt}
              onPromptPress={handlePromptPress}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedBudget={selectedBudget}
              onBudgetChange={setSelectedBudget}
              availableCategories={availableCategories}
              isLoading={isExploreLoading}
              error={exploreError}
              items={exploreItems}
              onRetry={() => void loadExploreTrips()}
              onTripPress={(id) => router.push(`/public-trip/${id}` as any)}
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
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Tab button ─────────────────────────────────────────────────────────────

function TabButton({
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
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
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
  activePromptId: ExplorePromptId | null;
  activePrompt: ExplorePromptDefinition | null;
  onPromptPress: (p: ExplorePromptDefinition) => void;
  selectedCategory: string | null;
  onCategoryChange: (c: string | null) => void;
  selectedBudget: BudgetFilter;
  onBudgetChange: (b: BudgetFilter) => void;
  availableCategories: string[];
  isLoading: boolean;
  error: string | null;
  items: ExploreTripItem[];
  onRetry: () => void;
  onTripPress: (id: string) => void;
};

function ExploreContent({
  searchInput,
  onSearchChange,
  onApplySearch,
  onReset,
  activePromptId,
  activePrompt,
  onPromptPress,
  selectedCategory,
  onCategoryChange,
  selectedBudget,
  onBudgetChange,
  availableCategories,
  isLoading,
  error,
  items,
  onRetry,
  onTripPress,
}: ExploreContentProps) {
  const hasActiveFilters =
    !!activePromptId ||
    !!selectedCategory ||
    selectedBudget !== 'any' ||
    !!searchInput.trim();

  return (
    <>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={17}
            color={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trips, routes, creators…"
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
          <Pressable style={styles.resetButton} onPress={onReset} hitSlop={8}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        )}
      </View>

      {/* Mood prompts (horizontal scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScrollContent}
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

      {/* Category chips (only once data loaded) */}
      {availableCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollContent}
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

      {/* Budget chips (horizontal scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScrollContent}
        style={[styles.chipScroll, styles.chipScrollLast]}
      >
        {BUDGET_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[
              styles.filterChip,
              selectedBudget === opt.value && styles.filterChipActive,
            ]}
            onPress={() => onBudgetChange(opt.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedBudget === opt.value && styles.filterChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Active prompt banner */}
      {activePrompt && (
        <View style={styles.promptBanner}>
          <View style={styles.promptBannerLeft}>
            <Text style={styles.promptBannerLabel}>ACTIVE PROMPT</Text>
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

      {/* Results */}
      {isLoading ? (
        <View style={styles.feedLoader}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.feedLoaderText}>Loading trips…</Text>
        </View>
      ) : error ? (
        <View style={styles.feedState}>
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.feedStateTitle}>Couldn't load trips</Text>
          <Text style={styles.feedStateBody}>{error}</Text>
          <Pressable style={styles.feedStateButton} onPress={onRetry}>
            <Text style={styles.feedStateButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.feedState}>
          <Ionicons
            name="search-outline"
            size={36}
            color={theme.colors.textSecondary}
          />
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
          {items.map((trip) => (
            <ExploreTripCard
              key={trip.id}
              title={trip.title}
              preview={trip.preview}
              creatorName={trip.creator.displayName}
              dateLabel={trip.date ? formatShortDate(trip.date) : undefined}
              badgeLabel="Public"
              isForYou={false}
              onPress={() => onTripPress(trip.id)}
            />
          ))}
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
}: ForYouContentProps) {
  const isColdStart = data?.meta.personalizationState === 'cold_start';

  return (
    <>
      {/* Cold-start notice */}
      {isColdStart && (
        <View style={styles.coldStartBanner}>
          <Ionicons name="sparkles-outline" size={16} color="#006A69" />
          <Text style={styles.coldStartText}>
            Still learning your taste — these start broader and improve as you
            save, like, and complete trips.
          </Text>
        </View>
      )}

      {/* Swipe CTA */}
      <Pressable style={styles.swipeCta} onPress={onSwitchToSwipe}>
        <View style={styles.swipeCtaIcon}>
          <Ionicons name="swap-horizontal" size={18} color="#006A69" />
        </View>
        <View style={styles.swipeCtaText}>
          <Text style={styles.swipeCtaTitle}>Try Swipe mode</Text>
          <Text style={styles.swipeCtaSubtitle}>
            Move through picks faster — save or pass in one swipe.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#006A69" />
      </Pressable>

      {/* Results */}
      {isLoading ? (
        <View style={styles.feedLoader}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.feedLoaderText}>Personalizing your feed…</Text>
        </View>
      ) : error ? (
        <View style={styles.feedState}>
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.feedStateTitle}>For You unavailable</Text>
          <Text style={styles.feedStateBody}>{error}</Text>
          <Pressable style={styles.feedStateButton} onPress={onRetry}>
            <Text style={styles.feedStateButtonText}>Try again</Text>
          </Pressable>
          <Pressable
            style={styles.feedStateSecondary}
            onPress={onSwitchToExplore}
          >
            <Text style={styles.feedStateSecondaryText}>
              Switch to Explore instead
            </Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.feedState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="compass-outline" size={26} color="#006A69" />
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
          {items.map((trip) => (
            <ExploreTripCard
              key={trip.id}
              title={trip.title}
              preview={trip.preview}
              creatorName={trip.creator.displayName}
              dateLabel={trip.date ? formatShortDate(trip.date) : undefined}
              badgeLabel={
                trip.recommendation.kind === 'personalized'
                  ? 'For You'
                  : 'Public'
              }
              isForYou={trip.recommendation.kind === 'personalized'}
              recommendationLine={
                trip.recommendation.primaryReason ?? undefined
              }
              onPress={() => onTripPress(trip.id)}
            />
          ))}
        </View>
      )}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: theme.colors.primary,
    marginBottom: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.4,
  },

  // ── Tab pill ──
  tabPill: {
    flexDirection: 'row',
    backgroundColor: '#EBEEF0',
    borderRadius: 999,
    padding: 3,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  tabButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabButtonActive: {
    backgroundColor: '#0B3B4A',
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#7DF5F4',
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111C2C',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  // ── Chip scrolls ──
  chipScroll: {
    marginBottom: 8,
  },
  chipScrollLast: {
    marginBottom: 16,
  },
  chipScrollContent: {
    paddingRight: 4,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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

  // ── Prompt banner ──
  promptBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BEEDE7',
    padding: 14,
    marginBottom: 16,
  },
  promptBannerLeft: {
    flex: 1,
    gap: 3,
  },
  promptBannerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#006A69',
  },
  promptBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111C2C',
  },
  promptBannerDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },

  // ── Feed states ──
  feedLoader: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  feedLoaderText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  feedState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  feedStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111C2C',
    textAlign: 'center',
  },
  feedStateBody: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  feedStateButton: {
    backgroundColor: '#006A69',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },
  feedStateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedStateSecondary: {
    marginTop: 4,
  },
  feedStateSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B3B4A',
  },

  // ── Feed list ──
  feedList: {
    gap: 16,
  },

  // ── For You specifics ──
  coldStartBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BEEDE7',
    padding: 12,
    marginBottom: 12,
  },
  coldStartText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#065F46',
  },
  swipeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#DFF7F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BEEDE7',
    padding: 14,
    marginBottom: 16,
  },
  swipeCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,106,105,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeCtaText: {
    flex: 1,
    gap: 2,
  },
  swipeCtaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111C2C',
  },
  swipeCtaSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#0B3B4A',
  },
});
