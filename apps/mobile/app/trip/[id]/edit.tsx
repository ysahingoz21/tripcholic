import AppButton from '@/components/ui/AppButton';
import InterestChip from '@/components/ui/InterestChip';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
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
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
  {
    value: 'DRAFT',
    label: 'Draft',
    description: 'Still being prepared.',
  },
  {
    value: 'PRIVATE',
    label: 'Private',
    description: 'Visible only to you.',
  },
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

  if (!trimmed) {
    return null;
  }

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
  const { id, remix } = useLocalSearchParams<{ id?: string; remix?: string }>();
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
      if (isAuthLoading) {
        return;
      }

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
        setBudgetTl(
          data.trip.budgetTl !== null ? String(Math.round(data.trip.budgetTl)) : ''
        );
        setMaxWalkingDistanceKm(
          data.trip.walkingToleranceKm !== null
            ? String(data.trip.walkingToleranceKm)
            : ''
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
              data.trip.walkingToleranceKm !== null
                ? String(data.trip.walkingToleranceKm)
                : '',
            maxStops: data.trip.maxPois !== null ? String(data.trip.maxPois) : '',
            weather: data.trip.weather ?? '',
            visibility: data.trip.visibility,
          })
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load trip detail.'
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
      description:
        originalValues.description !== normalizedCurrentValues.description,
      date: originalValues.date !== normalizedCurrentValues.date,
      startTime:
        originalValues.startTime !== normalizedCurrentValues.startTime,
      endTime: originalValues.endTime !== normalizedCurrentValues.endTime,
      categories: !areStringArraysEqual(
        originalValues.categories,
        normalizedCurrentValues.categories
      ),
      budgetTl: originalValues.budgetTl !== normalizedCurrentValues.budgetTl,
      maxWalkingDistanceKm:
        originalValues.maxWalkingDistanceKm !==
        normalizedCurrentValues.maxWalkingDistanceKm,
      maxStops: originalValues.maxStops !== normalizedCurrentValues.maxStops,
      weather: originalValues.weather !== normalizedCurrentValues.weather,
      visibility: originalValues.visibility !== normalizedCurrentValues.visibility,
    };
  }, [originalValues, normalizedCurrentValues]);

  const changeState = useMemo(() => {
    const hasMetadataChanges =
      changedFields.title ||
      changedFields.description ||
      changedFields.visibility;
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

  const handleSave = async () => {
    if (!token || !id || typeof id !== 'string') {
      Alert.alert('Unable to save', 'Authentication or trip context is missing.');
      return;
    }

    if (!changeState.hasChanges) {
      return;
    }

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
      maxWalkingDistanceKm:
        normalizedCurrentValues.maxWalkingDistanceKm ?? undefined,
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
        router.replace({
          pathname: '/results',
          params: { tripId: id },
        });
        return;
      }

      router.replace({
        pathname: '/trip/[id]',
        params: { id },
      });
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

  if (isLoading || isAuthLoading) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="Loading Trip Editor"
          subtitle="Fetching the latest trip details from the backend."
        />
      </ScreenContainer>
    );
  }

  if (error || !tripDetail) {
    return (
      <ScreenContainer>
        <SectionTitle
          title="Trip Editor Unavailable"
          subtitle={error ?? 'Trip edit form could not be loaded.'}
        />
        <AppButton
          title="Back to Trip"
          onPress={() =>
            router.replace({
              pathname: '/trip/[id]',
              params: { id: id ?? '' },
            })
          }
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionTitle
          title="Edit Trip"
          subtitle={
            changeState.hasOptimizationChanges
              ? `Update persisted preferences for ${tripDetail.trip.title}, then re-run optimization.`
              : `Update persisted trip details for ${tripDetail.trip.title}.`
          }
        />

        {remix === '1' ? (
          <View style={styles.remixNotice}>
            <Text style={styles.remixNoticeText}>
              This is now your own draft copy. Any changes here only affect your remixed trip.
            </Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Trip title"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

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

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.optionRow}>
            {visibilityOptions.map((item) => {
              const isSelected = visibility === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setVisibility(item.value)}
                  style={[
                    styles.optionChip,
                    isSelected && styles.optionChipSelected,
                  ]}
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
            {
              visibilityOptions.find((item) => item.value === visibility)
                ?.description
            }
          </Text>

          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
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
                if (selectedDate) {
                  setDate(formatDateForApi(selectedDate));
                }
              }}
            />
          ) : null}

          <Text style={styles.label}>Available Time</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity
              style={[styles.input, styles.timeInput]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text
                style={{
                  color: startTime ? theme.colors.text : '#94A3B8',
                  fontSize: 15,
                }}
              >
                {startTime || 'Start time'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.input, styles.timeInput]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text
                style={{
                  color: endTime ? theme.colors.text : '#94A3B8',
                  fontSize: 15,
                }}
              >
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
                if (selectedTime) {
                  setStartTime(formatTimeForApi(selectedTime));
                }
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
                if (selectedTime) {
                  setEndTime(formatTimeForApi(selectedTime));
                }
              }}
            />
          ) : null}

          <Text style={styles.label}>Interests</Text>
          <View style={styles.chipContainer}>
            {interestOptions.map((interest) => (
              <InterestChip
                key={interest}
                label={interest}
                selected={categories.includes(interest.toLowerCase())}
                onPress={() => toggleCategory(interest)}
              />
            ))}
          </View>

          <Text style={styles.label}>Budget (TL)</Text>
          <TextInput
            value={budgetTl}
            onChangeText={setBudgetTl}
            placeholder="e.g. 3000"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Max Walking Distance (km)</Text>
          <TextInput
            value={maxWalkingDistanceKm}
            onChangeText={setMaxWalkingDistanceKm}
            placeholder="e.g. 3.5"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Max Stops</Text>
          <TextInput
            value={maxStops}
            onChangeText={setMaxStops}
            placeholder="e.g. 6"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Weather</Text>
          <View style={styles.optionRow}>
            {weatherOptions.map((item) => {
              const isSelected = weather === item;

              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setWeather(isSelected ? '' : item)}
                  style={[
                    styles.optionChip,
                    isSelected && styles.optionChipSelected,
                  ]}
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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <AppButton
            title={
              isSaving
                ? changeState.hasOptimizationChanges
                  ? 'Saving and Re-optimizing...'
                  : 'Saving Changes...'
                : primaryActionLabel
            }
            onPress={handleSave}
            disabled={isSaving || !changeState.hasChanges}
          />

          <View style={styles.buttonSpacer} />

          <AppButton
            title="Cancel"
            onPress={() =>
              router.replace({
                pathname: '/trip/[id]',
                params: { id: tripDetail.trip.id },
              })
            }
            disabled={isSaving}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  remixNotice: {
    backgroundColor: '#F4FBFB',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#BFEAE9',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  remixNoticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.primaryDark,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
  },
  textArea: {
    minHeight: 120,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  timeInput: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionChipText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  optionChipTextSelected: {
    color: theme.colors.white,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  buttonSpacer: {
    height: 12,
  },
});
