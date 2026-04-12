import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenContainer from '../../components/ui/ScreenContainer';
import SectionTitle from '../../components/ui/SectionTitle';
import AppButton from '../../components/ui/AppButton';
import InterestChip from '../../components/ui/InterestChip';
import { theme } from '../../constants/theme';
import { useAuth } from '@/context/AuthContext';
import { createTrip, optimizeTrip, type CreateTripPayload } from '@/services/trips';

const categoryOptions = [
  'Culture',
  'Food',
  'Museums',
  'Shopping',
  'Nature',
  'Coffee',
  'History',
  'Nightlife',
];

const budgetOptions = [
  { label: 'Low', value: 2000 },
  { label: 'Medium', value: 6000 },
  { label: 'High', value: 20000 },
] as const;

const weatherOptions = [
  { label: 'Clear', value: 'clear' },
  { label: 'Cloudy', value: 'cloudy' },
  { label: 'Rainy', value: 'rainy' },
] as const;

type WeatherValue = 'clear' | 'cloudy' | 'rainy';
type BudgetValue = 2000 | 6000 | 20000;

export default function PlannerScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Culture',
    'Food',
  ]);
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [budgetTl, setBudgetTl] = useState<BudgetValue | undefined>(undefined);
  const [weather, setWeather] = useState<WeatherValue | undefined>(undefined);
  const [maxWalkingDistanceKm, setMaxWalkingDistanceKm] = useState('');
  const [maxStops, setMaxStops] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const isValidTime = (value: string) => /^\d{2}:\d{2}$/.test(value.trim());

  const handleGenerateRoute = async () => {
    if (!token) {
      Alert.alert(
        'Authentication required',
        isAuthLoading
          ? 'Restoring session. Please try again in a moment.'
          : 'Please sign in again.'
      );
      return;
    }

    if (!destination.trim()) {
      Alert.alert('Missing title', 'Please enter a trip title or destination.');
      return;
    }

    if (!date.trim()) {
      Alert.alert('Missing date', 'Please enter a trip date in YYYY-MM-DD format.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Invalid date', 'Please use the YYYY-MM-DD format.');
      return;
    }

    if (startTime.trim() && !isValidTime(startTime)) {
      Alert.alert('Invalid start time', 'Please use HH:MM format (e.g. 09:00).');
      return;
    }

    if (endTime.trim() && !isValidTime(endTime)) {
      Alert.alert('Invalid end time', 'Please use HH:MM format (e.g. 18:00).');
      return;
    }

    if (isSubmitting) return;

    const normalizedCategories = selectedCategories.map((c) => c.toLowerCase());

    const parsedMaxWalking = maxWalkingDistanceKm.trim()
      ? parseFloat(maxWalkingDistanceKm.trim())
      : undefined;

    const parsedMaxStops = maxStops.trim()
      ? parseInt(maxStops.trim(), 10)
      : undefined;

    const payload: CreateTripPayload = {
      title: destination.trim(),
      date: date.trim(),
      categories: normalizedCategories,
      ...(tripNotes.trim() && { description: tripNotes.trim() }),
      ...(budgetTl !== undefined && { budgetTl }),
      ...(startTime.trim() && { startTime: startTime.trim() }),
      ...(endTime.trim() && { endTime: endTime.trim() }),
      ...(weather !== undefined && { weather }),
      ...(parsedMaxWalking !== undefined && !isNaN(parsedMaxWalking) && { maxWalkingDistanceKm: parsedMaxWalking }),
      ...(parsedMaxStops !== undefined && !isNaN(parsedMaxStops) && { maxStops: parsedMaxStops }),
    };

    try {
      setIsSubmitting(true);
      const createdTrip = await createTrip(token, payload);
      const optimizedTrip = await optimizeTrip(token, createdTrip.trip.id);

      router.push({
        pathname: '/results' as any,
        params: {
          tripId: optimizedTrip.trip.id,
        },
      });
    } catch (error) {
      Alert.alert(
        'Unable to generate route',
        error instanceof Error ? error.message : 'Trip creation or optimization failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionTitle
          title="Trip Planner"
          subtitle="Set your preferences and generate a personalized Istanbul route."
        />

        <View style={styles.formCard}>
          {/* Destination & Date */}
          <Text style={styles.label}>Destination</Text>
          <TextInput
            placeholder="Istanbul district or area"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={date}
            onChangeText={setDate}
          />

          {/* Time range */}
          <Text style={styles.label}>Time Range (optional)</Text>
          <View style={styles.row}>
            <TextInput
              placeholder="Start  09:00"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.halfInput]}
              value={startTime}
              onChangeText={setStartTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <TextInput
              placeholder="End  18:00"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.halfInput]}
              value={endTime}
              onChangeText={setEndTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>

          {/* Categories */}
          <Text style={styles.label}>Categories</Text>
          <View style={styles.chipContainer}>
            {categoryOptions.map((category) => (
              <InterestChip
                key={category}
                label={category}
                selected={selectedCategories.includes(category)}
                onPress={() => toggleCategory(category)}
              />
            ))}
          </View>

          {/* Budget */}
          <Text style={styles.label}>Budget</Text>
          <View style={styles.row}>
            {budgetOptions.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.selectorChip,
                  budgetTl === opt.value && styles.selectorChipSelected,
                ]}
                onPress={() =>
                  setBudgetTl(budgetTl === opt.value ? undefined : opt.value)
                }
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    budgetTl === opt.value && styles.selectorChipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Weather */}
          <Text style={styles.label}>Weather</Text>
          <View style={styles.row}>
            {weatherOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.selectorChip,
                  weather === opt.value && styles.selectorChipSelected,
                ]}
                onPress={() =>
                  setWeather(weather === opt.value ? undefined : opt.value)
                }
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    weather === opt.value && styles.selectorChipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Walking & Stops */}
          <Text style={styles.label}>Max Walking Distance (km, optional)</Text>
          <TextInput
            placeholder="e.g. 5"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={maxWalkingDistanceKm}
            onChangeText={setMaxWalkingDistanceKm}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Max Stops (optional)</Text>
          <TextInput
            placeholder="e.g. 6"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={maxStops}
            onChangeText={setMaxStops}
            keyboardType="number-pad"
          />

          {/* Trip Notes */}
          <Text style={styles.label}>Trip Notes (optional)</Text>
          <TextInput
            placeholder="Any extra context for your trip, e.g. relaxed pace, no steep hills."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
            value={tripNotes}
            onChangeText={setTripNotes}
          />

          <AppButton
            title={isSubmitting ? 'Generating Route...' : 'Generate Route'}
            onPress={handleGenerateRoute}
            disabled={isSubmitting || isAuthLoading}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  input: {
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
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  halfInput: {
    flex: 1,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 100,
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  selectorChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  selectorChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectorChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  selectorChipTextSelected: {
    color: '#FFFFFF',
  },
});
