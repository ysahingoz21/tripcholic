import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getTrip,
  optimizeTrip,
  type TripVisibility,
  updateTrip,
  type TripDetailResponse,
  type UpdateTripPayload,
} from '@/services/trips';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  buildTripDetailParams,
  buildTripReturnTarget,
  getTripRouteSource,
} from '@/utils/tripNavigation';

const H_PAD = 20;

const interestOptions = [
  'Culture',
  'Food',
  'Museums',
  'Shopping',
  'Nature',
  'Coffee',
  'History',
  'Nightlife',
] as const;

const weatherOptions = ['clear', 'cloudy', 'rainy'] as const;
const visibilityOptions: {
  value: TripVisibility;
  label: string;
  description: string;
}[] = [
  { value: 'DRAFT', label: 'Draft', description: 'Still being prepared.' },
  { value: 'PRIVATE', label: 'Private', description: 'Visible only to you.' },
  {
    value: 'PUBLIC',
    label: 'Public',
    description: 'Eligible for future explore surfaces.',
  },
] as const;

type NormalizedTripEditState = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  categories: string[];
  budgetTl: number | null;
  maxWalkingDistanceKm: number | null;
  maxStops: number | null;
  weather: string;
  visibility: TripVisibility;
};

function formatDateForApi(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeForApi(value: Date) {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function toDateValue(date: string) {
  return new Date(`${date}T12:00:00`);
}

function toTimeValue(value: string | null, fallback: string) {
  const [hours, minutes] = (value ?? fallback).split(':').map(Number);
  const base = new Date();
  base.setHours(hours, minutes, 0, 0);
  return base;
}

function normalizeCategories(values: string[]) {
  return [...new Set(values.map((item) => item.toLowerCase().trim()).filter(Boolean))].sort();
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function getNormalizedTripEditState(params: {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  categories: string[];
  budgetTl: string;
  maxWalkingDistanceKm: string;
  maxStops: string;
  weather: string;
  visibility: TripVisibility;
}): NormalizedTripEditState {
  return {
    title: params.title.trim(),
    description: params.description.trim(),
    date: params.date.trim(),
    startTime: params.startTime.trim(),
    endTime: params.endTime.trim(),
    categories: normalizeCategories(params.categories),
    budgetTl: parseOptionalNumber(params.budgetTl),
    maxWalkingDistanceKm: parseOptionalNumber(params.maxWalkingDistanceKm),
    maxStops: parseOptionalNumber(params.maxStops),
    weather: params.weather.trim(),
    visibility: params.visibility,
  };
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export default function EditTripScreen() {
  const router = useRouter();
  const { id, remix, source, returnTripId } = useLocalSearchParams<{
    id?: string;
    remix?: string;
    source?: string;
    returnTripId?: string;
  }>();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [originalValues, setOriginalValues] = useState<NormalizedTripEditState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [budgetTl, setBudgetTl] = useState('');
  const [maxWalkingDistanceKm, setMaxWalkingDistanceKm] = useState('');
  const [maxStops, setMaxStops] = useState('');
  const [weather, setWeather] = useState('');
  const [visibility, setVisibility] = useState<TripVisibility>('DRAFT');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    async function loadTripDetail() {
      if (isAuthLoading) return;

      if (!token) {
        setError('Authentication required. Please sign in again.');
        setIsLoading(false);
        return;
      }

      if (!id || typeof id !== 'string') {
        setError('Missing trip id.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await getTrip(token, id);
        setTripDetail(data);
        setTitle(data.trip.title);
        setDescription(data.trip.description ?? '');
        setDate(data.trip.date.slice(0, 10));
        setStartTime(data.trip.timeStart ?? '');
        setEndTime(data.trip.timeEnd ?? '');
        setCategories(data.trip.categories.map((item) => item.toLowerCase()));
        setBudgetTl(data.trip.budgetTl !== null ? String(Math.round(data.trip.budgetTl)) : '');
        setMaxWalkingDistanceKm(
          data.trip.walkingToleranceKm !== null ? String(data.trip.walkingToleranceKm) : ''
        );
        setMaxStops(data.trip.maxPois !== null ? String(data.trip.maxPois) : '');
        setWeather(data.trip.weather ?? '');
        setVisibility(data.trip.visibility);
        setOriginalValues(
          getNormalizedTripEditState({
            title: data.trip.title,
            description: data.trip.description ?? '',
            date: data.trip.date.slice(0, 10),
            startTime: data.trip.timeStart ?? '',
            endTime: data.trip.timeEnd ?? '',
            categories: data.trip.categories,
            budgetTl:
              data.trip.budgetTl !== null ? String(Math.round(data.trip.budgetTl)) : '',
            maxWalkingDistanceKm:
              data.trip.walkingToleranceKm !== null ? String(data.trip.walkingToleranceKm) : '',
            maxStops: data.trip.maxPois !== null ? String(data.trip.maxPois) : '',
            weather: data.trip.weather ?? '',
            visibility: data.trip.visibility,
          })
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load trip detail.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadTripDetail();
  }, [token, id, isAuthLoading]);

  const toggleCategory = (interest: string) => {
    const normalized = interest.toLowerCase();
    setCategories((previous) =>
      previous.includes(normalized)
        ? previous.filter((item) => item !== normalized)
        : [...previous, normalized]
    );
  };

  const normalizedCurrentValues = useMemo(
    () =>
      getNormalizedTripEditState({
        title,
        description,
        date,
        startTime,
        endTime,
        categories,
        budgetTl,
        maxWalkingDistanceKm,
        maxStops,
        weather,
        visibility,
      }),
    [
      title,
      description,
      date,
      startTime,
      endTime,
      categories,
      budgetTl,
      maxWalkingDistanceKm,
      maxStops,
      weather,
      visibility,
    ]
  );

  const changedFields = useMemo(() => {
    if (!originalValues) {
      return {
        title: false,
        description: false,
        date: false,
        startTime: false,
        endTime: false,
        categories: false,
        budgetTl: false,
        maxWalkingDistanceKm: false,
        maxStops: false,
        weather: false,
        visibility: false,
      };
    }

    return {
      title: originalValues.title !== normalizedCurrentValues.title,
      description: originalValues.description !== normalizedCurrentValues.description,
      date: originalValues.date !== normalizedCurrentValues.date,
      startTime: originalValues.startTime !== normalizedCurrentValues.startTime,
      endTime: originalValues.endTime !== normalizedCurrentValues.endTime,
      categories: !areStringArraysEqual(
        originalValues.categories,
        normalizedCurrentValues.categories
      ),
      budgetTl: originalValues.budgetTl !== normalizedCurrentValues.budgetTl,
      maxWalkingDistanceKm:
        originalValues.maxWalkingDistanceKm !== normalizedCurrentValues.maxWalkingDistanceKm,
      maxStops: originalValues.maxStops !== normalizedCurrentValues.maxStops,
      weather: originalValues.weather !== normalizedCurrentValues.weather,
      visibility: originalValues.visibility !== normalizedCurrentValues.visibility,
    };
  }, [originalValues, normalizedCurrentValues]);

  const changeState = useMemo(() => {
    const hasMetadataChanges =
      changedFields.title || changedFields.description || changedFields.visibility;
    const hasOptimizationChanges =
      changedFields.date ||
      changedFields.startTime ||
      changedFields.endTime ||
      changedFields.categories ||
      changedFields.budgetTl ||
      changedFields.maxWalkingDistanceKm ||
      changedFields.maxStops ||
      changedFields.weather;

    return {
      hasChanges: hasMetadataChanges || hasOptimizationChanges,
      hasMetadataChanges,
      hasOptimizationChanges,
    };
  }, [changedFields]);

  const primaryActionLabel = changeState.hasOptimizationChanges
    ? 'Save & Re-optimize'
    : 'Save Changes';
  const tripReturnTarget = buildTripReturnTarget({ source, returnTripId });
  const routeSource = getTripRouteSource(source);

  const handleSave = async () => {
    if (!token || !id || typeof id !== 'string') {
      Alert.alert('Unable to save', 'Authentication or trip context is missing.');
      return;
    }

    if (!changeState.hasChanges) return;

    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a trip title.');
      return;
    }

    if (
      normalizedCurrentValues.budgetTl !== null &&
      Number.isNaN(normalizedCurrentValues.budgetTl)
    ) {
      Alert.alert(
        'Invalid numeric input',
        'Budget, walking distance, and max stops must be valid numbers.'
      );
      return;
    }

    if (
      normalizedCurrentValues.maxWalkingDistanceKm !== null &&
      Number.isNaN(normalizedCurrentValues.maxWalkingDistanceKm)
    ) {
      Alert.alert(
        'Invalid numeric input',
        'Budget, walking distance, and max stops must be valid numbers.'
      );
      return;
    }

    if (
      normalizedCurrentValues.maxStops !== null &&
      Number.isNaN(normalizedCurrentValues.maxStops)
    ) {
      Alert.alert(
        'Invalid numeric input',
        'Budget, walking distance, and max stops must be valid numbers.'
      );
      return;
    }

    if (
      !normalizedCurrentValues.date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(normalizedCurrentValues.date)
    ) {
      Alert.alert('Invalid date', 'Please provide a valid trip date.');
      return;
    }

    const payload: UpdateTripPayload = {
      title: normalizedCurrentValues.title,
      description: normalizedCurrentValues.description || undefined,
      date: normalizedCurrentValues.date,
      startTime: normalizedCurrentValues.startTime || undefined,
      endTime: normalizedCurrentValues.endTime || undefined,
      categories: normalizedCurrentValues.categories,
      budgetTl: normalizedCurrentValues.budgetTl ?? undefined,
      maxWalkingDistanceKm: normalizedCurrentValues.maxWalkingDistanceKm ?? undefined,
      maxStops: normalizedCurrentValues.maxStops ?? undefined,
      weather: normalizedCurrentValues.weather || undefined,
      visibility: normalizedCurrentValues.visibility,
    };

    try {
      setIsSaving(true);
      setError(null);
      await updateTrip(token, id, payload);

      if (changeState.hasOptimizationChanges) {
        await optimizeTrip(token, id);
        router.replace({ pathname: '/results', params: { tripId: id } });
        return;
      }

      router.replace(
        buildTripDetailParams(id, {
          ...(routeSource ? { source: routeSource } : {}),
          ...(returnTripId ? { returnTripId } : {}),
        })
      );
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update and optimize trip.';
      setError(message);
      Alert.alert('Unable to save and re-optimize', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.replace(
      buildTripDetailParams(tripDetail?.trip.id ?? id ?? '', {
        ...(routeSource ? { source: routeSource } : {}),
        ...(returnTripId ? { returnTripId } : {}),
      })
    );
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.navBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0B3B4A" />
          </Pressable>
          <Text style={styles.navTitle}>Edit Trip</Text>
          <View style={styles.navSpacer} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading trip editor…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !tripDetail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.navBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0B3B4A" />
          </Pressable>
          <Text style={styles.navTitle}>Edit Trip</Text>
          <View style={styles.navSpacer} />
        </View>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={44} color={theme.colors.textSecondary} />
          <Text style={styles.stateTitle}>Trip editor unavailable</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={handleCancel}>
            <Text style={styles.primaryButtonText}>Back to Trip</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const subtitle = changeState.hasOptimizationChanges
    ? `Update preferences for ${tripDetail?.trip.title ?? 'this trip'}, then re-run optimization.`
    : `Update trip details for ${tripDetail?.trip.title ?? 'this trip'}.`;

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ── Nav bar ── */}
      <View style={styles.navBar}>
        <Pressable style={styles.backButton} onPress={handleCancel}>
          <Ionicons name="arrow-back" size={20} color="#0B3B4A" />
        </Pressable>
        <Text style={styles.navTitle}>Edit Trip</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.eyebrow}>EDIT TRIP</Text>
          <Text style={styles.pageTitle}>
            {tripDetail?.trip.title ?? 'Edit Trip'}
          </Text>
          <Text style={styles.pageSub}>{subtitle}</Text>
        </View>

        {/* ── Remix notice ── */}
        {remix === '1' ? (
          <View style={styles.remixNotice}>
            <Ionicons name="copy-outline" size={15} color="#0B3B4A" />
            <Text style={styles.remixNoticeText}>
              This is your own draft copy. Changes here only affect your remixed trip.
            </Text>
          </View>
        ) : null}

        {/* ── Form card ── */}
        <View style={styles.formCard}>
          {/* Title */}
          <Text style={styles.label}>Title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Trip title"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Trip description"
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />

          {/* Visibility */}
          <Text style={styles.label}>Visibility</Text>
          <View style={styles.optionRow}>
            {visibilityOptions.map((item) => {
              const isSelected = visibility === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setVisibility(item.value)}
                  style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      isSelected && styles.optionChipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.helperText}>
            {visibilityOptions.find((item) => item.value === visibility)?.description}
          </Text>

          {/* Date */}
          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={{ color: date ? theme.colors.text : '#94A3B8', fontSize: 15 }}>
              {date || 'Select date'}
            </Text>
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={date ? toDateValue(date) : new Date()}
              mode="date"
              display="default"
              onChange={(_, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(formatDateForApi(selectedDate));
              }}
            />
          ) : null}

          {/* Time window */}
          <Text style={styles.label}>Available Time</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity
              style={[styles.input, styles.timeInput]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text style={{ color: startTime ? theme.colors.text : '#94A3B8', fontSize: 15 }}>
                {startTime || 'Start time'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.input, styles.timeInput]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text style={{ color: endTime ? theme.colors.text : '#94A3B8', fontSize: 15 }}>
                {endTime || 'End time'}
              </Text>
            </TouchableOpacity>
          </View>
          {showStartTimePicker ? (
            <DateTimePicker
              value={toTimeValue(startTime || null, '10:00')}
              mode="time"
              display="default"
              onChange={(_, selectedTime) => {
                setShowStartTimePicker(false);
                if (selectedTime) setStartTime(formatTimeForApi(selectedTime));
              }}
            />
          ) : null}
          {showEndTimePicker ? (
            <DateTimePicker
              value={toTimeValue(endTime || null, '18:00')}
              mode="time"
              display="default"
              onChange={(_, selectedTime) => {
                setShowEndTimePicker(false);
                if (selectedTime) setEndTime(formatTimeForApi(selectedTime));
              }}
            />
          ) : null}

          {/* Interests */}
          <Text style={styles.label}>Interests</Text>
          <View style={styles.chipContainer}>
            {interestOptions.map((interest) => {
              const isSelected = categories.includes(interest.toLowerCase());
              return (
                <Pressable
                  key={interest}
                  onPress={() => toggleCategory(interest)}
                  style={[styles.interestChip, isSelected && styles.interestChipSelected]}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      isSelected && styles.interestChipTextSelected,
                    ]}
                  >
                    {interest}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Budget */}
          <Text style={styles.label}>Budget (TL)</Text>
          <TextInput
            value={budgetTl}
            onChangeText={setBudgetTl}
            placeholder="e.g. 3000"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            keyboardType="numeric"
          />

          {/* Walking distance */}
          <Text style={styles.label}>Max Walking Distance (km)</Text>
          <TextInput
            value={maxWalkingDistanceKm}
            onChangeText={setMaxWalkingDistanceKm}
            placeholder="e.g. 3.5"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            keyboardType="numeric"
          />

          {/* Max stops */}
          <Text style={styles.label}>Max Stops</Text>
          <TextInput
            value={maxStops}
            onChangeText={setMaxStops}
            placeholder="e.g. 6"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            keyboardType="numeric"
          />

          {/* Weather */}
          <Text style={styles.label}>Weather</Text>
          <View style={styles.optionRow}>
            {weatherOptions.map((item) => {
              const isSelected = weather === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setWeather(isSelected ? '' : item)}
                  style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      isSelected && styles.optionChipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Inline error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* ── CTA group ── */}
        <View style={styles.ctaGroup}>
          <Pressable
            style={[
              styles.primaryButton,
              (!changeState.hasChanges || isSaving) && styles.primaryButtonDisabled,
            ]}
            onPress={() => void handleSave()}
            disabled={isSaving || !changeState.hasChanges}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving
                ? changeState.hasOptimizationChanges
                  ? 'Saving & Re-optimizing…'
                  : 'Saving Changes…'
                : primaryActionLabel}
            </Text>
            {!isSaving && (
              <Ionicons
                name={changeState.hasOptimizationChanges ? 'flash-outline' : 'checkmark'}
                size={16}
                color="#FFFFFF"
              />
            )}
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, isSaving && styles.secondaryButtonDisabled]}
            onPress={handleCancel}
            disabled={isSaving}
          >
            <Text style={styles.secondaryButtonText}>
              {tripReturnTarget.label === 'Back to Results' ? 'Back to Trip' : 'Cancel'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111C2C',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111C2C',
    textAlign: 'center',
  },
  navSpacer: {
    width: 40,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 48,
    gap: 16,
  },

  // Page header
  pageHeader: {
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111C2C',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  pageSub: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },

  // Remix notice
  remixNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F4FBFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFEAE9',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  remixNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#0B3B4A',
    fontWeight: '600',
  },

  // Form card
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    padding: 18,
    gap: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 16,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
  },
  textArea: {
    minHeight: 100,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8ECF0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeInput: {
    flex: 1,
  },

  // Option chips (visibility, weather)
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  optionChipSelected: {
    backgroundColor: '#006A69',
    borderColor: '#006A69',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Interest chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  interestChipSelected: {
    backgroundColor: '#DFF7F6',
    borderColor: '#006A69',
  },
  interestChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  interestChipTextSelected: {
    fontWeight: '700',
    color: '#006A69',
  },

  // Error
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },

  // CTAs
  ctaGroup: {
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A69',
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B3B4A',
  },
});
