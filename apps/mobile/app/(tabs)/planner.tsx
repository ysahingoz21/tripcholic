import { useAuth } from '@/context/AuthContext';
import { createTrip, optimizeTrip, type CreateTripPayload } from '@/services/trips';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppButton from '../../components/ui/AppButton';
import InterestChip from '../../components/ui/InterestChip';
import ScreenContainer from '../../components/ui/ScreenContainer';
import SectionTitle from '../../components/ui/SectionTitle';
import { theme } from '../../constants/theme';

const interestOptions = [
  'Culture',
  'Food',
  'Museums',
  'Shopping',
  'Nature',
  'Coffee',
  'History',
  'Nightlife',
];

export default function PlannerScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Culture',
    'Food',
  ]);
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [availableTime, setAvailableTime] = useState('');
  const [budgetStyle, setBudgetStyle] = useState('');
  const [transportMode, setTransportMode] = useState('');
  const [naturalLanguageDescription, setNaturalLanguageDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest]
    );
  };

  const parseBudgetTl = (value: string) => {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'low') return 2000;
    if (normalized === 'medium') return 6000;
    if (normalized === 'high') return 20000;

    return undefined;
  };

  const parseTimeRange = (value: string) => {
    const match = value.trim().match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);

    if (!match) {
      return {};
    }

    return {
      startTime: match[1],
      endTime: match[2],
    };
  };

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

    const missingFields: string[] = [];

    if (!destination.trim()) {
      missingFields.push('Destination');
    }

    if (!date.trim()) {
      missingFields.push('Date');
    }

    if (missingFields.length > 0) {
      Alert.alert(
        'Missing required fields',
        `Please fill in the following fields: ${missingFields.join(', ')}`
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Invalid date', 'Please use the YYYY-MM-DD format.');
      return;
    }

    if (isSubmitting) return;

    const normalizedCategories = selectedInterests.map((interest) =>
      interest.toLowerCase()
    );
    const parsedBudgetTl = parseBudgetTl(budgetStyle);
    const parsedTimeRange = parseTimeRange(availableTime);

    const payload: CreateTripPayload = {
      title: destination.trim(),
      date: date.trim(),
      categories: normalizedCategories,
      ...(naturalLanguageDescription.trim() && {
        description: naturalLanguageDescription.trim(),
      }),
      ...(parsedBudgetTl !== undefined && { budgetTl: parsedBudgetTl }),
      ...parsedTimeRange,
    };

    try {
      setIsSubmitting(true);
      const createdTrip = await createTrip(token, payload);
      const optimizedTrip = await optimizeTrip(token, createdTrip.trip.id);

      router.push({
        pathname: '/results',
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
          subtitle="Create a personalized Istanbul route with structured input or natural language."
        />

        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>Structured preferences</Text>

          <Text style={styles.label}>Destination *</Text>
          <TextInput
            placeholder="Istanbul district or area"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
          />

          <Text style={styles.label}>Date *</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={date}
            onChangeText={setDate}
          />

          <Text style={styles.label}>Available Time</Text>
          <TextInput
            placeholder="Optional: 10:00-18:00"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={availableTime}
            onChangeText={setAvailableTime}
          />

          <Text style={styles.label}>Interests</Text>
          <View style={styles.chipContainer}>
            {interestOptions.map((interest) => (
              <InterestChip
                key={interest}
                label={interest}
                selected={selectedInterests.includes(interest)}
                onPress={() => toggleInterest(interest)}
              />
            ))}
          </View>

          <Text style={styles.label}>Budget Style</Text>
          <TextInput
            placeholder="Low / Medium / High"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={budgetStyle}
            onChangeText={setBudgetStyle}
          />

          <Text style={styles.label}>Transport Mode</Text>
          <TextInput
            placeholder="Walking / Car"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={transportMode}
            onChangeText={setTransportMode}
          />

          <Text style={styles.sectionLabel}>Or describe it naturally</Text>
          <TextInput
            placeholder='Example: "A relaxed afternoon with good food and something cultural, not too much walking."'
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
            value={naturalLanguageDescription}
            onChangeText={setNaturalLanguageDescription}
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
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginBottom: 8,
    marginTop: 4,
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
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 120,
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
});
