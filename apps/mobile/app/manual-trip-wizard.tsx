import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Artwork, { PoiImageCard } from '@/components/ui/Artwork';
import TripStopsMap from '@/components/trip/TripStopsMap';
import { theme } from '@/constants/theme';
import { font, type } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { listPois, POI_CATEGORIES, type PoiItem } from '@/services/pois';
import { createManualTrip, type TripVisibility } from '@/services/trips';

// ── Types ──────────────────────────────────────────────────────────────────────

type SelectedStop = {
  poi: PoiItem;
  arrivalTime: string;   // HH:MM
  departureTime: string; // HH:MM
};

type Step = 1 | 2 | 3 | 4;

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseHHMM(hhmm: string): number {
  const parts = hhmm.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

function formatHHMM(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMin));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function distributeStopTimes(
  stops: PoiItem[],
  startTime: string,
  endTime: string,
): Array<{ arrivalTime: string; departureTime: string }> {
  if (stops.length === 0) return [];

  const startMin = parseHHMM(startTime);
  const endMin = parseHHMM(endTime);
  const window = Math.max(60, endMin - startMin);
  const n = stops.length;
  const slot = Math.floor(window / n);

  return stops.map((poi, i) => {
    const arrival = startMin + i * slot;
    const departure = Math.min(arrival + poi.suggestedVisitDurationMinutes, endMin, arrival + slot - 1);
    return {
      arrivalTime: formatHHMM(arrival),
      departureTime: formatHHMM(Math.max(departure, arrival + 1)),
    };
  });
}

function capFirst(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function buildTimeFromString(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function formatDateForApi(value: Date) {
  const year  = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day   = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeForApi(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  historical: 'Historical',
  scenic: 'Scenic',
  food: 'Food',
  shopping: 'Shopping',
  nature: 'Nature',
  neighborhood: 'Neighborhood',
  entertainment: 'Entertainment',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  historical: 'business-outline',
  scenic: 'telescope-outline',
  food: 'restaurant-outline',
  shopping: 'bag-handle-outline',
  nature: 'leaf-outline',
  neighborhood: 'home-outline',
  entertainment: 'musical-notes-outline',
};

// ── POI Card ──────────────────────────────────────────────────────────────────

function PoiCard({
  poi,
  isSelected,
  onToggle,
}: {
  poi: PoiItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const imageUrl = poi.imageUrl?.trim() || null;

  const budgetStr = (() => {
    const { minTl, maxTl, budgetLevel } = poi.pricing;
    if (minTl !== null && maxTl !== null) return `₺${minTl} – ₺${maxTl}`;
    if (minTl !== null) return `From ₺${minTl}`;
    if (budgetLevel) return capFirst(budgetLevel);
    return null;
  })();

  const hoursStr =
    poi.openingHours?.open && poi.openingHours?.close
      ? `${poi.openingHours.open} – ${poi.openingHours.close}`
      : null;

  return (
    <Pressable
      style={({ pressed }) => [
        poiCardStyles.card,
        isSelected && poiCardStyles.cardSelected,
        pressed && { opacity: 0.88 },
      ]}
      onPress={onToggle}
    >
      {/* Selection ring — absolutely positioned outside card bounds, no layout effect */}
      {isSelected && <View pointerEvents="none" style={poiCardStyles.selectionRing} />}

      {/* Thumbnail */}
      <View style={poiCardStyles.thumb}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={poiCardStyles.thumbImage}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <PoiImageCard
            imageUrl={null}
            category={poi.category}
            style={poiCardStyles.thumbImage}
          />
        )}
      </View>

      {/* Info column — name → category → district → budget → hours */}
      <View style={poiCardStyles.info}>
        <Text style={poiCardStyles.name} numberOfLines={3}>
          {poi.title}
        </Text>

        <View style={poiCardStyles.badge}>
          <Text style={poiCardStyles.badgeText}>{capFirst(poi.category)}</Text>
        </View>

        {poi.district ? (
          <View style={poiCardStyles.metaRow}>
            <Ionicons name="location-outline" size={10} color={theme.colors.textSecondary} />
            <Text style={poiCardStyles.metaText} numberOfLines={1}>{poi.district}</Text>
          </View>
        ) : null}

        {budgetStr ? (
          <View style={poiCardStyles.metaRow}>
            <Ionicons name="cash-outline" size={10} color={theme.colors.textSecondary} />
            <Text style={poiCardStyles.metaText}>{budgetStr}</Text>
          </View>
        ) : null}

        {hoursStr ? (
          <View style={poiCardStyles.metaRow}>
            <Ionicons name="time-outline" size={10} color={theme.colors.textSecondary} />
            <Text style={poiCardStyles.metaText}>{hoursStr}</Text>
          </View>
        ) : null}
      </View>

      {/* Add / check badge — top-right of the whole card */}
      <Pressable
        style={({ pressed }) => [
          poiCardStyles.addBtn,
          isSelected && poiCardStyles.addBtnSelected,
          pressed && { opacity: 0.75 },
        ]}
        onPress={onToggle}
        hitSlop={8}
      >
        <Ionicons
          name={isSelected ? 'checkmark' : 'add'}
          size={16}
          color={isSelected ? '#FFFFFF' : theme.colors.primary}
        />
      </Pressable>
    </Pressable>
  );
}

const poiCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 10,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: '#F0FFFE',
  },
  // Negative-offset ring identical to CategoryCard — sits outside the card,
  // never affects layout dimensions.
  selectionRing: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#006A69',
  },
  thumb: {
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: '#DFF7F6',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  // Positioned relative to the whole card, not just the thumb
  addBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontFamily: font.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primaryDark,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DFF7F6',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: '#006A69',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontFamily: font.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ManualTripWizardScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [step, setStep] = useState<Step>(1);

  // ── Step 1: Basics ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [visibility, setVisibility] = useState<TripVisibility>('PRIVATE');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // ── Step 2: POI Selection ──────────────────────────────────────────────────
  const [poiList, setPoiList] = useState<PoiItem[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiError, setPoiError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [selectedStops, setSelectedStops] = useState<SelectedStop[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Step 3: Order & Times ──────────────────────────────────────────────────
  const [timePickerTarget, setTimePickerTarget] = useState<{
    index: number;
    field: 'arrival' | 'departure';
  } | null>(null);
  const [timeErrors, setTimeErrors] = useState<string[]>([]);

  // ── Step 4: Submit ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Error modal ────────────────────────────────────────────────────────────
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const showError = (title: string, message: string) =>
    setErrorModal({ title, message });

  // ── Avatar initials ────────────────────────────────────────────────────────
  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'T');

  // ── POI Loading ────────────────────────────────────────────────────────────

  const loadPois = useCallback(
    async (categoryFilter: string, searchQuery: string) => {
      setPoiLoading(true);
      setPoiError(null);
      try {
        const result = await listPois({
          category: categoryFilter || undefined,
          search: searchQuery || undefined,
          limit: 80,
        });
        setPoiList(result.items);
      } catch (err) {
        setPoiError(err instanceof Error ? err.message : 'Failed to load POIs');
      } finally {
        setPoiLoading(false);
      }
    },
    [],
  );

  // Load POIs when entering step 2
  useEffect(() => {
    if (step === 2) {
      void loadPois(activeCategory, search);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload on category change
  useEffect(() => {
    if (step !== 2) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void loadPois(activeCategory, search);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [activeCategory, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-validate whenever stops or trip bounds change in step 3
  useEffect(() => {
    if (step === 3 && selectedStops.length > 0) {
      setTimeErrors(validateTimes(selectedStops));
    }
  }, [selectedStops, step, startTime, endTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Time validation ────────────────────────────────────────────────────────

  const validateTimes = (stops: SelectedStop[]): string[] => {
    const errors: string[] = [];
    const startMin = parseHHMM(startTime);
    const endMin = parseHHMM(endTime);

    stops.forEach((stop, i) => {
      const arrival = parseHHMM(stop.arrivalTime);
      const departure = parseHHMM(stop.departureTime);

      if (arrival < startMin) {
        errors.push(`Stop ${i + 1}: arrival (${stop.arrivalTime}) is before trip start (${startTime}).`);
      }
      if (departure > endMin) {
        errors.push(`Stop ${i + 1}: departure (${stop.departureTime}) exceeds trip end (${endTime}).`);
      }
      if (departure <= arrival) {
        errors.push(`Stop ${i + 1}: departure must be after arrival.`);
      }
      if (i > 0) {
        const prevDeparture = parseHHMM(stops[i - 1]!.departureTime);
        if (arrival <= prevDeparture) {
          errors.push(`Stop ${i + 1}: arrival (${stop.arrivalTime}) overlaps with stop ${i} departure (${stops[i - 1]!.departureTime}).`);
        }
      }
    });

    return errors;
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleBack = () => {
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as Step);
  };

  const handleStep1Continue = () => {
    const missing: string[] = [];
    if (!title.trim()) missing.push('Trip title');
    if (!date.trim()) missing.push('Date');

    if (missing.length > 0) {
      showError('Missing fields', `Please fill in: ${missing.join(', ')}`);
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      showError('Invalid date', 'Please select a date using the calendar.');
      return;
    }

    const startMin = parseHHMM(startTime);
    const endMin = parseHHMM(endTime);
    if (endMin <= startMin) {
      showError('Invalid time range', 'End time must be after start time.');
      return;
    }

    setStep(2);
  };

  const handleStep2Continue = () => {
    if (selectedStops.length === 0) {
      showError('No places selected', 'Please add at least one place to your trip.');
      return;
    }

    // Auto-distribute times when entering step 3
    const times = distributeStopTimes(
      selectedStops.map((s) => s.poi),
      startTime,
      endTime,
    );
    setSelectedStops((prev) =>
      prev.map((s, i) => ({
        ...s,
        arrivalTime: times[i]?.arrivalTime ?? s.arrivalTime,
        departureTime: times[i]?.departureTime ?? s.departureTime,
      })),
    );
    setTimeErrors([]);
    setStep(3);
  };

  const handleStep3Continue = () => {
    const errors = validateTimes(selectedStops);
    setTimeErrors(errors);
    if (errors.length > 0) {
      showError(
        'Time conflicts',
        'Please fix the highlighted stops before continuing.\n\n' + errors.slice(0, 3).join('\n'),
      );
      return;
    }
    setStep(4);
  };

  const handleSave = async () => {
    if (!token) {
      showError('Sign in required', 'Please sign in again to save your trip.');
      return;
    }
    if (isSubmitting) return;

    const errors = validateTimes(selectedStops);
    if (errors.length > 0) {
      showError('Time conflicts', 'Please go back and fix the time errors before saving.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createManualTrip(token, {
        title: title.trim(),
        date: date.trim(),
        startTime,
        endTime,
        visibility,
        stops: selectedStops.map((s) => ({
          poiId: s.poi.id,
          arrivalTime: s.arrivalTime,
          departureTime: s.departureTime,
        })),
      });

      router.push({
        pathname: '/results',
        params: { tripId: result.trip.id },
      });
    } catch (err) {
      showError(
        'Trip not saved',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Stop management ─────────────────────────────────────────────────────────

  const toggleStop = (poi: PoiItem) => {
    const exists = selectedStops.some((s) => s.poi.id === poi.id);
    if (exists) {
      setSelectedStops((prev) => prev.filter((s) => s.poi.id !== poi.id));
    } else {
      setSelectedStops((prev) => [
        ...prev,
        {
          poi,
          arrivalTime: startTime,
          departureTime: formatHHMM(
            parseHHMM(startTime) + poi.suggestedVisitDurationMinutes,
          ),
        },
      ]);
    }
  };

  const removeStop = (index: number) => {
    setSelectedStops((prev) => prev.filter((_, i) => i !== index));
    setTimeErrors([]);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    setSelectedStops((prev) => {
      const next = [...prev];
      const a = next[index - 1]!;
      const b = next[index]!;
      // Swap POIs, keep times assigned to positions
      next[index - 1] = { poi: b.poi, arrivalTime: a.arrivalTime, departureTime: a.departureTime };
      next[index] = { poi: a.poi, arrivalTime: b.arrivalTime, departureTime: b.departureTime };
      return next;
    });
  };

  const moveStopDown = (index: number) => {
    if (index === selectedStops.length - 1) return;
    setSelectedStops((prev) => {
      const next = [...prev];
      const a = next[index]!;
      const b = next[index + 1]!;
      next[index] = { poi: b.poi, arrivalTime: a.arrivalTime, departureTime: a.departureTime };
      next[index + 1] = { poi: a.poi, arrivalTime: b.arrivalTime, departureTime: b.departureTime };
      return next;
    });
  };

  const updateStopTime = (
    index: number,
    field: 'arrivalTime' | 'departureTime',
    value: string,
  ) => {
    setSelectedStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  // ── Progress ───────────────────────────────────────────────────────────────

  const TOTAL_STEPS = 4;
  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  const stepLabels: Record<Step, string> = {
    1: 'Trip basics',
    2: 'Select places',
    3: 'Order & times',
    4: 'Preview & save',
  };

  // ── Map stops shape ────────────────────────────────────────────────────────

  const mapStops = selectedStops.map((s, i) => ({
    id: s.poi.id + '_' + i,
    order: i + 1,
    title: s.poi.title,
    arrivalTime: s.arrivalTime,
    departureTime: s.departureTime,
    travelTimeToNextMin: null,
    estimatedCostTl: s.poi.pricing.minTl ?? 0,
    poi: {
      id: s.poi.id,
      title: s.poi.title,
      category: s.poi.category,
      description: s.poi.description,
      district: s.poi.district,
      address: s.poi.address,
      imageUrl: s.poi.imageUrl,
      source: s.poi.source,
      coordinates: s.poi.coordinates,
      suggestedVisitDurationMinutes: s.poi.suggestedVisitDurationMinutes,
      pricing: s.poi.pricing,
      openingHours: s.poi.openingHours,
    },
  }));

  const estimatedCost = selectedStops.reduce(
    (sum, s) => sum + (s.poi.pricing.minTl ?? 0),
    0,
  );

  // ── Step renders ───────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>Step 1 — Trip basics</Text>
      <Text style={styles.stepTitle}>Name your trip</Text>
      <Text style={styles.stepSubtitle}>
        Set the title, date, and time window for your manual itinerary.
      </Text>

      {/* Title */}
      <Text style={styles.fieldLabel}>Trip title *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. Golden Horn Morning Walk"
        placeholderTextColor="#A0ADB4"
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
        autoCorrect={false}
        maxLength={120}
      />

      {/* Date */}
      <Text style={styles.fieldLabel}>Date *</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="calendar-outline"
          size={17}
          color={date ? theme.colors.primaryDark : '#A0ADB4'}
          style={styles.pickerIcon}
        />
        <Text style={[styles.pickerText, !date && styles.pickerTextPlaceholder]}>
          {date || 'Select a date'}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={date ? new Date(`${date}T12:00:00`) : new Date()}
          mode="date"
          display="default"
          onChange={(_, selected) => {
            setShowDatePicker(false);
            if (selected) setDate(formatDateForApi(selected));
          }}
        />
      )}

      {/* Time window */}
      <Text style={styles.fieldLabel}>Available time *</Text>
      <View style={styles.timeRow}>
        <TouchableOpacity
          style={[styles.pickerButton, styles.timeBtn]}
          onPress={() => setShowStartPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={17} color={theme.colors.primaryDark} style={styles.pickerIcon} />
          <Text style={styles.pickerText}>{startTime}</Text>
        </TouchableOpacity>
        <View style={styles.timeDash} />
        <TouchableOpacity
          style={[styles.pickerButton, styles.timeBtn]}
          onPress={() => setShowEndPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={17} color={theme.colors.primaryDark} style={styles.pickerIcon} />
          <Text style={styles.pickerText}>{endTime}</Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={buildTimeFromString(startTime)}
          mode="time"
          display="default"
          onChange={(_, selected) => {
            setShowStartPicker(false);
            if (selected) setStartTime(formatTimeForApi(selected));
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={buildTimeFromString(endTime)}
          mode="time"
          display="default"
          onChange={(_, selected) => {
            setShowEndPicker(false);
            if (selected) setEndTime(formatTimeForApi(selected));
          }}
        />
      )}

      {/* Visibility */}
      <Text style={styles.fieldLabel}>Visibility</Text>
      <View style={styles.visibilityRow}>
        <Pressable
          style={[styles.visibilityBtn, visibility === 'PRIVATE' && styles.visibilityBtnActive]}
          onPress={() => setVisibility('PRIVATE')}
        >
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={visibility === 'PRIVATE' ? '#FFFFFF' : theme.colors.primaryDark}
          />
          <Text style={[styles.visibilityBtnText, visibility === 'PRIVATE' && styles.visibilityBtnTextActive]}>
            Private
          </Text>
        </Pressable>
        <Pressable
          style={[styles.visibilityBtn, visibility === 'PUBLIC' && styles.visibilityBtnActive]}
          onPress={() => setVisibility('PUBLIC')}
        >
          <Ionicons
            name="earth-outline"
            size={16}
            color={visibility === 'PUBLIC' ? '#FFFFFF' : theme.colors.primaryDark}
          />
          <Text style={[styles.visibilityBtnText, visibility === 'PUBLIC' && styles.visibilityBtnTextActive]}>
            Public
          </Text>
        </Pressable>
      </View>
      <Text style={styles.fieldHint}>
        Public trips are discoverable by other Tripcholic travelers.
      </Text>
    </View>
  );

  const renderStep2 = () => {
    const selectedIds = new Set(selectedStops.map((s) => s.poi.id));

    return (
      <View style={styles.step2Wrap}>
        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <Pressable
            style={[styles.catChip, !activeCategory && styles.catChipActive]}
            onPress={() => setActiveCategory('')}
          >
            <Text style={[styles.catChipText, !activeCategory && styles.catChipTextActive]}>
              All
            </Text>
          </Pressable>
          {POI_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
              onPress={() => setActiveCategory(activeCategory === cat ? '' : cat)}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat] ?? 'location-outline'}
                size={12}
                color={activeCategory === cat ? '#FFFFFF' : theme.colors.textSecondary}
              />
              <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>
                {CATEGORY_LABELS[cat] ?? capFirst(cat)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search places…"
            placeholderTextColor="#A0ADB4"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* Selected strip */}
        {selectedStops.length > 0 && (
          <View style={styles.selectedStrip}>
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
            <Text style={styles.selectedStripText}>
              {selectedStops.length} {selectedStops.length === 1 ? 'place' : 'places'} selected
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedChipsContent}
            >
              {selectedStops.map((s) => (
                <Pressable
                  key={s.poi.id}
                  style={styles.selectedChip}
                  onPress={() => toggleStop(s.poi)}
                >
                  <Text style={styles.selectedChipText} numberOfLines={1}>
                    {s.poi.title}
                  </Text>
                  <Ionicons name="close" size={11} color={theme.colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* POI list */}
        {poiLoading ? (
          <View style={styles.poiStateBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.poiStateText}>Loading places…</Text>
          </View>
        ) : poiError ? (
          <View style={styles.poiStateBox}>
            <Ionicons name="alert-circle-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.poiStateText}>{poiError}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void loadPois(activeCategory, search)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : poiList.length === 0 ? (
          <View style={styles.poiStateBox}>
            <Ionicons name="location-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.poiStateText}>No places found. Try a different search or category.</Text>
          </View>
        ) : (
          <FlatList
            data={poiList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PoiCard
                poi={item}
                isSelected={selectedIds.has(item.id)}
                onToggle={() => toggleStop(item)}
              />
            )}
            contentContainerStyle={styles.poiListContent}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Disable scroll so outer ScrollView manages scrolling
            scrollEnabled={false}
            nestedScrollEnabled={false}
          />
        )}
      </View>
    );
  };

  const renderStep3 = () => {
    const tripDurationMin = parseHHMM(endTime) - parseHHMM(startTime);
    const minNeededMin = selectedStops.reduce(
      (sum, s) => sum + Math.max(30, s.poi.suggestedVisitDurationMinutes),
      0,
    );
    const isTimetableTight = tripDurationMin < minNeededMin;

    return (
    <View style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>Step 3 — Order & times</Text>
      <Text style={styles.stepTitle}>Plan your route</Text>
      <Text style={styles.stepSubtitle}>
        Reorder stops and adjust arrival and departure times for each stop.
      </Text>

      {isTimetableTight && timeErrors.length === 0 && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={16} color="#92400E" />
          <Text style={styles.warningBannerText}>
            Trip window may be tight for {selectedStops.length} stops. Consider extending your time or removing a stop.
          </Text>
        </View>
      )}

      {timeErrors.length > 0 && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={styles.errorBannerText}>
            {timeErrors.length} time {timeErrors.length === 1 ? 'conflict' : 'conflicts'} — fix before continuing.
          </Text>
        </View>
      )}

      {selectedStops.map((stop, index) => {
        const stopErrors = timeErrors.filter((e) => e.startsWith(`Stop ${index + 1}:`));
        const hasError = stopErrors.length > 0;

        return (
          <View
            key={stop.poi.id + '_' + index}
            style={[styles.stopCard, hasError && styles.stopCardError]}
          >
            {/* Order badge */}
            <View style={styles.stopOrderBadge}>
              <Text style={styles.stopOrderText}>{index + 1}</Text>
            </View>

            {/* POI info */}
            <View style={styles.stopInfo}>
              <Text style={styles.stopName} numberOfLines={2}>{stop.poi.title}</Text>
              <Text style={styles.stopCategory}>{capFirst(stop.poi.category)}</Text>
              {stop.poi.district ? (
                <Text style={styles.stopDistrict}>{stop.poi.district}</Text>
              ) : null}

              {/* Time controls */}
              <View style={styles.stopTimesRow}>
                <TouchableOpacity
                  style={[styles.timeChip, hasError && styles.timeChipError]}
                  onPress={() => setTimePickerTarget({ index, field: 'arrival' })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="enter-outline" size={12} color={theme.colors.primary} />
                  <Text style={styles.timeChipText}>{stop.arrivalTime}</Text>
                </TouchableOpacity>

                <Ionicons name="arrow-forward-outline" size={12} color={theme.colors.textSecondary} />

                <TouchableOpacity
                  style={[styles.timeChip, hasError && styles.timeChipError]}
                  onPress={() => setTimePickerTarget({ index, field: 'departure' })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="exit-outline" size={12} color={theme.colors.primary} />
                  <Text style={styles.timeChipText}>{stop.departureTime}</Text>
                </TouchableOpacity>
              </View>

              {hasError && (
                <Text style={styles.stopErrorText}>{stopErrors[0]}</Text>
              )}
            </View>

            {/* Reorder + remove controls */}
            <View style={styles.stopActions}>
              <Pressable
                style={[styles.stopActionBtn, index === 0 && styles.stopActionBtnDisabled]}
                onPress={() => moveStopUp(index)}
                disabled={index === 0}
                hitSlop={6}
              >
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={index === 0 ? '#CBD5E1' : theme.colors.primaryDark}
                />
              </Pressable>
              <Pressable
                style={[styles.stopActionBtn, index === selectedStops.length - 1 && styles.stopActionBtnDisabled]}
                onPress={() => moveStopDown(index)}
                disabled={index === selectedStops.length - 1}
                hitSlop={6}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={index === selectedStops.length - 1 ? '#CBD5E1' : theme.colors.primaryDark}
                />
              </Pressable>
              <Pressable style={styles.stopRemoveBtn} onPress={() => removeStop(index)} hitSlop={6}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        );
      })}

      {/* Time picker overlay */}
      {timePickerTarget !== null && (
        <DateTimePicker
          value={buildTimeFromString(
            timePickerTarget.field === 'arrival'
              ? selectedStops[timePickerTarget.index]!.arrivalTime
              : selectedStops[timePickerTarget.index]!.departureTime,
          )}
          mode="time"
          display="default"
          onChange={(_, selected) => {
            if (selected && timePickerTarget !== null) {
              const hhmm = formatTimeForApi(selected);
              const { index, field } = timePickerTarget;
              if (field === 'arrival') {
                // Auto-recalc departure = arrival + visit duration
                const poi = selectedStops[index]!.poi;
                const depMin = parseHHMM(hhmm) + poi.suggestedVisitDurationMinutes;
                updateStopTime(index, 'arrivalTime', hhmm);
                updateStopTime(index, 'departureTime', formatHHMM(depMin));
              } else {
                // User explicitly sets departure — respect it
                updateStopTime(index, 'departureTime', hhmm);
              }
            }
            setTimePickerTarget(null);
          }}
        />
      )}
    </View>
  );
  };

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>Step 4 — Preview</Text>
      <Text style={styles.stepTitle}>Your route</Text>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
            </View>
            <Text style={styles.summaryValue}>{selectedStops.length}</Text>
            <Text style={styles.summaryLabel}>Stops</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryCell}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
            </View>
            <Text style={styles.summaryValue}>{startTime} – {endTime}</Text>
            <Text style={styles.summaryLabel}>Time window</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryCell}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="cash-outline" size={16} color={theme.colors.primary} />
            </View>
            <Text style={styles.summaryValue}>
              {estimatedCost > 0 ? `~₺${Math.round(estimatedCost)}` : '—'}
            </Text>
            <Text style={styles.summaryLabel}>Est. cost</Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.previewSection}>
        <Text style={styles.previewSectionTitle}>Timeline</Text>
        {selectedStops.map((stop, index) => {
          const isLast = index === selectedStops.length - 1;
          const imageUrl = stop.poi.imageUrl?.trim() || null;
          return (
            <View key={stop.poi.id + '_' + index} style={styles.tlRow}>
              <View style={styles.tlMarkerCol}>
                <View style={styles.tlDot}>
                  <Ionicons name="location" size={10} color="#FFFFFF" />
                </View>
                {!isLast && <View style={styles.tlLine} />}
              </View>
              <View style={[styles.tlCard, isLast && styles.tlCardLast]}>
                <View style={styles.tlTopRow}>
                  <Text style={styles.tlTime}>{stop.arrivalTime}</Text>
                  <View style={styles.tlBadge}>
                    <Text style={styles.tlBadgeText}>{capFirst(stop.poi.category)}</Text>
                  </View>
                </View>
                <Text style={styles.tlName} numberOfLines={2}>{stop.poi.title}</Text>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.tlImage}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <PoiImageCard imageUrl={null} category={stop.poi.category} style={styles.tlImage} />
                )}
                {stop.poi.district ? (
                  <Text style={styles.tlDistrict}>{stop.poi.district}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Map */}
      {mapStops.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.previewSectionTitle}>Trip Route Map</Text>
          <TripStopsMap stops={mapStops} hideTitle />
        </View>
      )}
    </View>
  );

  // ── CTA label ─────────────────────────────────────────────────────────────

  const ctaLabel = (() => {
    if (step === 1) return 'Continue';
    if (step === 2) return `Continue  (${selectedStops.length} selected)`;
    if (step === 3) return 'Preview route';
    return isSubmitting ? 'Saving…' : 'Save trip';
  })();

  const handleCta = () => {
    if (step === 1) handleStep1Continue();
    else if (step === 2) handleStep2Continue();
    else if (step === 3) handleStep3Continue();
    else void handleSave();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.flex}>

          {/* Header */}
          <View style={styles.wizardHeader}>
            <View style={styles.headerInner}>
              <View style={styles.headerSide}>
                <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
                  <Ionicons name="arrow-back" size={20} color={theme.colors.primaryDark} />
                </Pressable>
              </View>
              <Text style={styles.headerWordmark} numberOfLines={1}>TRIPCHOLIC</Text>
              <View style={[styles.headerSide, styles.headerSideRight]}>
                <Pressable
                  style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.75 }]}
                  onPress={() => router.navigate('/(tabs)/profile' as any)}
                  hitSlop={8}
                >
                  <Text style={styles.avatarText}>{initials}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {stepLabels[step]} · {progressPct}%
            </Text>
          </View>

          {/* Scrollable content — step 2 has its own internal scroll managed differently */}
          {step === 2 ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.step2ScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderStep2()}
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {step === 1 && renderStep1()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
            </ScrollView>
          )}

          {/* Bottom CTA */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.ctaButton,
                  (step === 4 && isSubmitting) && styles.ctaButtonDisabled,
                  pressed && styles.ctaButtonPressed,
                ]}
                onPress={handleCta}
                disabled={step === 4 && isSubmitting}
              >
                {step === 4 && isSubmitting ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.ctaButtonText}>Saving…</Text>
                  </>
                ) : step === 4 ? (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.ctaButtonText}>Save trip</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </>
                )}
              </Pressable>
            </SafeAreaView>
          </KeyboardAvoidingView>

        {/* Error modal overlay */}
        {errorModal !== null && (
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setErrorModal(null)}
          >
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="warning-outline" size={26} color="#B45309" />
              </View>
              <Text style={styles.modalTitle}>{errorModal.title}</Text>
              <Text style={styles.modalMessage}>{errorModal.message}</Text>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setErrorModal(null)}
              >
                <Text style={styles.modalBtnText}>Got it</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        </View>
      </SafeAreaView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  step2ScrollContent: { paddingBottom: 24 },

  // Header
  wizardHeader: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerSide: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerWordmark: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 3,
    color: theme.colors.primaryDark,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.bold, fontSize: 13, lineHeight: 15, color: '#FFFFFF' },

  // Progress
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 5,
    backgroundColor: theme.colors.background,
  },
  progressTrack: {
    height: 3,
    borderRadius: 99,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 99, backgroundColor: '#006A69' },
  progressLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  // Step content
  stepContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 },
  stepEyebrow: {
    ...type.labelCaps,
    fontSize: 11,
    color: theme.colors.primary,
    marginBottom: 8,
  },
  stepTitle: {
    fontFamily: font.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: theme.colors.primaryDark,
    marginBottom: 8,
  },
  stepSubtitle: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },

  // Fields
  fieldLabel: {
    fontFamily: font.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primaryDark,
    marginBottom: 8,
    marginTop: 4,
  },
  fieldHint: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.primaryDark,
    marginBottom: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  pickerIcon: { marginRight: 10 },
  pickerText: { fontFamily: font.regular, fontSize: 15, color: theme.colors.primaryDark, flex: 1 },
  pickerTextPlaceholder: { color: '#A0ADB4' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  timeBtn: { flex: 1, marginBottom: 0 },
  timeDash: { width: 12, height: 1.5, backgroundColor: theme.colors.border },

  // Visibility
  visibilityRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  visibilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  visibilityBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  visibilityBtnText: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  visibilityBtnTextActive: { color: '#FFFFFF' },

  // Step 2 wrap
  step2Wrap: { flex: 1 },

  // Category chips
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  catChipText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  catChipTextActive: { color: '#FFFFFF' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
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

  // Selected strip
  selectedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexWrap: 'nowrap',
  },
  selectedStripText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
    flexShrink: 0,
  },
  selectedChipsContent: { flexDirection: 'row', gap: 6 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DFF7F6',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,106,105,0.2)',
  },
  selectedChipText: {
    fontFamily: font.semiBold,
    fontSize: 11,
    color: '#006A69',
    maxWidth: 120,
  },

  // POI states
  poiStateBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  poiStateText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  retryText: { fontFamily: font.semiBold, fontSize: 13, color: '#FFFFFF' },

  // POI list
  poiListContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Step 3 — stop cards
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(180,83,9,0.18)',
    padding: 12,
    marginBottom: 16,
  },
  warningBannerText: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(180,83,9,0.22)',
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 19,
    color: '#B45309',
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  stopCardError: {
    borderColor: 'rgba(180,83,9,0.35)',
    backgroundColor: '#FFFDF5',
  },
  stopOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stopOrderText: { fontFamily: font.bold, fontSize: 13, color: '#FFFFFF' },
  stopInfo: { flex: 1, gap: 3 },
  stopName: { fontFamily: font.semiBold, fontSize: 14, lineHeight: 18, color: theme.colors.primaryDark },
  stopCategory: { fontFamily: font.regular, fontSize: 12, color: theme.colors.textSecondary },
  stopDistrict: { fontFamily: font.regular, fontSize: 12, color: theme.colors.textSecondary },
  stopTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DFF7F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,106,105,0.2)',
  },
  timeChipError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  timeChipText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: '#006A69',
  },
  stopErrorText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: '#B45309',
    marginTop: 3,
    lineHeight: 15,
  },
  stopActions: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  stopActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopActionBtnDisabled: { backgroundColor: '#F8FAFC' },
  stopRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  // Step 4 — preview
  previewSection: { gap: 12, marginBottom: 20 },
  previewSectionTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    marginBottom: 20,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  summarySep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  summaryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DFF7F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  summaryValue: {
    fontFamily: font.bold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  summaryLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Timeline
  tlRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tlMarkerCol: { width: 28, alignItems: 'center', alignSelf: 'stretch' },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    flexShrink: 0,
  },
  tlLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.primary,
    opacity: 0.25,
    marginTop: 4,
  },
  tlCard: { flex: 1, paddingLeft: 12, paddingBottom: 20, gap: 6 },
  tlCardLast: { paddingBottom: 4 },
  tlTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tlTime: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 0.1,
  },
  tlBadge: {
    backgroundColor: '#DFF7F6',
    borderRadius: 9999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tlBadgeText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: '#006A69',
    letterSpacing: 0.2,
  },
  tlName: {
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  tlImage: { height: 180, borderRadius: 10 },
  tlDistrict: {
    fontFamily: font.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  // Error modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,36,48,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0B3B4A',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  modalTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  modalMessage: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 36,
    alignItems: 'center',
    marginTop: 4,
  },
  modalBtnText: {
    fontFamily: font.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Bottom CTA
  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 4,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#006A69',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  ctaButtonDisabled: { opacity: 0.6 },
  ctaButtonPressed: { opacity: 0.9 },
  ctaButtonText: {
    fontFamily: font.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
