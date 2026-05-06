import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Artwork from '@/components/ui/Artwork';
import { theme } from '@/constants/theme';
import { type, font } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import {
  getTrips,
  type TripListItem,
  type TripVisibility,
} from '@/services/trips';

const H_PAD = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

type SortMode =
  | 'date-desc'
  | 'date-asc'
  | 'title-az'
  | 'title-za'
  | 'budget-asc'
  | 'budget-desc';

type BudgetFilter = 'any' | 'low' | 'mid' | 'high';

const SORT_MODES: { mode: SortMode; label: string }[] = [
  { mode: 'date-desc', label: 'Newest first' },
  { mode: 'date-asc', label: 'Oldest first' },
  { mode: 'title-az', label: 'Title A→Z' },
  { mode: 'title-za', label: 'Title Z→A' },
  { mode: 'budget-asc', label: 'Budget: Low' },
  { mode: 'budget-desc', label: 'Budget: High' },
];

const BUDGET_FILTERS: { filter: BudgetFilter; label: string }[] = [
  { filter: 'any', label: 'Any budget' },
  { filter: 'low', label: '< 500 ₺' },
  { filter: 'mid', label: '500–2K ₺' },
  { filter: 'high', label: '> 2K ₺' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

type VisibilityConfig = { label: string; icon: string };

function getVisibilityConfig(v: TripVisibility): VisibilityConfig {
  switch (v) {
    case 'PUBLIC':
      return { label: 'Public', icon: 'earth-outline' };
    case 'PRIVATE':
      return { label: 'Private', icon: 'lock-closed-outline' };
    case 'DRAFT':
    default:
      return { label: 'Draft', icon: 'create-outline' };
  }
}

function formatCategory(cat: string | null | undefined) {
  if (!cat) return null;
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Trip Card ─────────────────────────────────────────────────────────────────

type TripCardProps = {
  trip: TripListItem;
  onPress: () => void;
};

function TripCard({ trip, onPress }: TripCardProps) {
  const imageUrl = trip.preview?.imageUrl?.trim() || null;
  const stopCount = trip._count?.stops ?? 0;
  const vis = getVisibilityConfig(trip.visibility);

  const categoryLine = Array.from(
    new Set(
      [trip.preview?.primaryCategory, ...trip.categories].filter(Boolean)
    )
  )
    .map((c) => formatCategory(c))
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Full-bleed image */}
      <View style={styles.cardImageWrap}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Artwork kind="trip" variant="cover" label={trip.title} />
        )}
      </View>

      {/* Subtle full-card overlay for legibility */}
      <View style={styles.cardOverlay} />

      {/* Top-right: visibility badge */}
      <View style={styles.cardTop}>
        <View style={styles.visBadge}>
          <Ionicons
            name={vis.icon as any}
            size={11}
            color={theme.colors.primaryDark}
          />
          <Text style={styles.visText}>{vis.label}</Text>
        </View>
      </View>

      {/* Bottom info panel: title + date/stops + categories */}
      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {trip.title}
        </Text>
        <View style={styles.cardMeta}>
          <Ionicons
            name="calendar-outline"
            size={12}
            color="rgba(255,255,255,0.8)"
          />
          <Text style={styles.cardMetaText}>{formatShortDate(trip.date)}</Text>
          {stopCount > 0 && (
            <>
              <Text style={styles.cardMetaDot}>·</Text>
              <Ionicons
                name="location-outline"
                size={12}
                color="rgba(255,255,255,0.8)"
              />
              <Text style={styles.cardMetaText}>
                {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
              </Text>
            </>
          )}
        </View>
        {categoryLine ? (
          <Text style={styles.cardCategoryLine} numberOfLines={1}>
            {categoryLine}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TripsScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();

  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search / filter / sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('any');
  const [sortModeIdx, setSortModeIdx] = useState(0);

  const currentSort = SORT_MODES[sortModeIdx];
  const currentBudget = BUDGET_FILTERS.find((b) => b.filter === budgetFilter)!;

  const loadTrips = useCallback(async () => {
    if (isAuthLoading) return;
    if (!token) {
      setError('Authentication required. Please sign in again.');
      setTrips([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await getTrips(token);
      setTrips(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load your trips.'
      );
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, isAuthLoading]);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  // Derive unique categories from loaded trips
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    trips.forEach((t) => {
      if (t.preview?.primaryCategory) cats.add(t.preview.primaryCategory);
      t.categories.forEach((c) => cats.add(c));
    });
    return Array.from(cats).sort();
  }, [trips]);

  // Apply search, filter, and sort to trip list
  const filteredTrips = useMemo(() => {
    let result = trips;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    if (selectedCategory) {
      result = result.filter(
        (t) =>
          t.categories.includes(selectedCategory) ||
          t.preview?.primaryCategory === selectedCategory
      );
    }

    if (budgetFilter !== 'any') {
      result = result.filter((t) => {
        const b = t.budgetTl ?? 0;
        if (budgetFilter === 'low') return b < 500;
        if (budgetFilter === 'mid') return b >= 500 && b <= 2000;
        return b > 2000;
      });
    }

    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (currentSort.mode) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'title-az':
          return a.title.localeCompare(b.title);
        case 'title-za':
          return b.title.localeCompare(a.title);
        case 'budget-asc':
          return (a.budgetTl ?? 0) - (b.budgetTl ?? 0);
        case 'budget-desc':
          return (b.budgetTl ?? 0) - (a.budgetTl ?? 0);
      }
    });
    return sorted;
  }, [trips, searchQuery, selectedCategory, budgetFilter, currentSort.mode]);

  const isSpinning = isLoading || isAuthLoading;
  const showControls = !isSpinning && !error && trips.length > 0;

  function cycleSortMode() {
    setSortModeIdx((prev) => (prev + 1) % SORT_MODES.length);
  }

  function cycleBudgetFilter() {
    const idx = BUDGET_FILTERS.findIndex((b) => b.filter === budgetFilter);
    setBudgetFilter(BUDGET_FILTERS[(idx + 1) % BUDGET_FILTERS.length].filter);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Hero ─── */}
          <View style={styles.hero}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.heroEyebrow}>Istanbul</Text>
            </View>
            <Text style={styles.heroTitle}>My Trips</Text>
            <Text style={styles.heroSubtitle}>
              Your personal collection of Istanbul adventures.
            </Text>
          </View>

          {/* ─── Search + Filters ─── */}
          {showControls && (
            <View style={styles.controls}>
              {/* Search bar */}
              <View style={styles.searchBar}>
                <Ionicons
                  name="search-outline"
                  size={17}
                  color={theme.colors.textSecondary}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search trips…"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>

              {/* Category chips */}
              {availableCategories.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  <Pressable
                    style={[
                      styles.filterChip,
                      selectedCategory === null && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedCategory(null)}
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
                        setSelectedCategory(
                          selectedCategory === cat ? null : cat
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedCategory === cat &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {formatCategory(cat)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Sort + Budget row */}
              <View style={styles.controlRow}>
                <Pressable style={styles.controlPill} onPress={cycleSortMode}>
                  <Ionicons
                    name="swap-vertical-outline"
                    size={14}
                    color={theme.colors.primaryDark}
                  />
                  <Text style={styles.controlPillText}>
                    {currentSort.label}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.controlPill,
                    budgetFilter !== 'any' && styles.controlPillActive,
                  ]}
                  onPress={cycleBudgetFilter}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={14}
                    color={
                      budgetFilter !== 'any'
                        ? '#FFFFFF'
                        : theme.colors.primaryDark
                    }
                  />
                  <Text
                    style={[
                      styles.controlPillText,
                      budgetFilter !== 'any' && styles.controlPillTextActive,
                    ]}
                  >
                    {currentBudget.label}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ─── States & Trip List ─── */}
          {isSpinning ? (
            <View style={styles.centeredArea}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading trips…</Text>
            </View>
          ) : error ? (
            <View style={styles.centeredArea}>
              <Ionicons
                name="alert-circle-outline"
                size={44}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.stateTitle}>Couldn't load trips</Text>
              <Text style={styles.stateBody}>{error}</Text>
              <Pressable
                style={styles.actionButton}
                onPress={() => void loadTrips()}
              >
                <Text style={styles.actionButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : trips.length === 0 ? (
            <View style={styles.centeredArea}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="map-outline"
                  size={26}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.stateTitle}>No trips yet</Text>
              <Text style={styles.stateBody}>
                Trips you create with the planner will appear here, ready to
                revisit and share.
              </Text>
              <Pressable
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/planner')}
              >
                <Text style={styles.actionButtonText}>Plan your first trip</Text>
              </Pressable>
            </View>
          ) : filteredTrips.length === 0 ? (
            <View style={styles.centeredArea}>
              <Ionicons
                name="search-outline"
                size={36}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.stateTitle}>No results</Text>
              <Text style={styles.stateBody}>
                No trips match your filters. Try adjusting your search.
              </Text>
            </View>
          ) : (
            <View style={styles.tripList}>
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onPress={() =>
                    router.push(
                      trip.visibility === 'PUBLIC'
                        ? (`/public-trip/${trip.id}` as any)
                        : (`/trip/${trip.id}` as any)
                    )
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* ─── Floating action button ─── */}
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/(tabs)/planner')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // ── Hero ──
  hero: {
    paddingHorizontal: H_PAD,
    paddingTop: 28,
    paddingBottom: 32,
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  heroEyebrow: {
    ...type.labelCaps,
    color: theme.colors.primary,
  },
  heroTitle: {
    ...type.displayLg,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    ...type.bodyLg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // ── Controls ──
  controls: {
    paddingHorizontal: H_PAD,
    gap: 12,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  chipRow: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
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
  controlRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
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

  // ── Trip list ──
  tripList: {
    paddingHorizontal: H_PAD,
    gap: 20,
  },

  // ── Trip card ──
  card: {
    height: 272,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.93,
  },
  cardImageWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#DFF7F6',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  cardTop: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  visBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  visText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: theme.colors.primaryDark,
    letterSpacing: 0.1,
  },
  cardBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 18,
    backgroundColor: 'rgba(11,59,74,0.72)',
    gap: 5,
  },
  cardTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    lineHeight: 23,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardMetaText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  cardMetaDot: {
    fontFamily: font.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  cardCategoryLine: {
    fontFamily: font.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.1,
  },

  // ── States ──
  centeredArea: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  loadingText: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stateTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  stateBody: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 4,
  },
  actionButtonText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
