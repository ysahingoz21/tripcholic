import { useAuth } from '@/context/AuthContext';
import { createTrip, optimizeTrip, type CreateTripPayload } from '@/services/trips';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
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

  const formatDateForApi = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForApi = (value: Date) => {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getStartTimeValue = () => {
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const value = match ? match[1] : '10:00';
    const [hours, minutes] = value.split(':').map(Number);
    const base = new Date();
    base.setHours(hours, minutes, 0, 0);
    return base;
  };

  const getEndTimeValue = () => {
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const value = match ? match[2] : '18:00';
    const [hours, minutes] = value.split(':').map(Number);
    const base = new Date();
    base.setHours(hours, minutes, 0, 0);
    return base;
  };

  const updateStartTime = (selected: Date) => {
    const newStart = formatTimeForApi(selected);
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const currentEnd = match ? match[2] : '18:00';
    setAvailableTime(`${newStart}-${currentEnd}`);
  };

  const updateEndTime = (selected: Date) => {
    const newEnd = formatTimeForApi(selected);
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const currentStart = match ? match[1] : '10:00';
    setAvailableTime(`${currentStart}-${newEnd}`);
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
            placeholder="e.g. Kadıköy, Beşiktaş, Sultanahmet, Taksim"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
          />
          <Text style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Popular areas: Kadıköy, Beşiktaş, Taksim, Sultanahmet, Eminönü, Balat
          </Text>

          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text
              style={{
                color: date ? theme.colors.text : '#94A3B8',
                fontSize: 15,
              }}
            >
              {date || 'Select date'}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Pick a trip date from the calendar
          </Text>

          {showDatePicker && (
            <DateTimePicker
              value={date ? new Date(`${date}T12:00:00`) : new Date()}
              mode="date"
              display="default"
              onChange={(_, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDate(formatDateForApi(selectedDate));
                }
              }}
            />
          )}

          <Text style={styles.label}>Available Time</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity
              style={[styles.input, styles.timeInput]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text
                style={{
                  color: availableTime ? theme.colors.text : '#94A3B8',
                  fontSize: 15,
                }}
              >
                {availableTime ? availableTime.split('-')[0] : 'Start time'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.input, styles.timeInput]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text
                style={{
                  color: availableTime ? theme.colors.text : '#94A3B8',
                  fontSize: 15,
                }}
              >
                {availableTime ? availableTime.split('-')[1] : 'End time'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Pick start and end time
          </Text>

          {showStartTimePicker && (
            <DateTimePicker
              value={getStartTimeValue()}
              mode="time"
              display="default"
              onChange={(_, selectedTime) => {
                setShowStartTimePicker(false);
                if (selectedTime) {
                  updateStartTime(selectedTime);
                }
              }}
            />
          )}

          {showEndTimePicker && (
            <DateTimePicker
              value={getEndTimeValue()}
              mode="time"
              display="default"
              onChange={(_, selectedTime) => {
                setShowEndTimePicker(false);
                if (selectedTime) {
                  updateEndTime(selectedTime);
                }
              }}
            />
          )}

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
          <View style={styles.optionRow}>
            {['low', 'medium', 'high'].map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setBudgetStyle(item)}
                style={[
                  styles.optionChip,
                  budgetStyle === item && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={{
                    color: budgetStyle === item ? '#fff' : '#333',
                    fontWeight: '600',
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Transport Mode</Text>
          <View style={styles.optionRow}>
            {['walk', 'car'].map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setTransportMode(item)}
                style={[
                  styles.optionChip,
                  transportMode === item && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={{
                    color: transportMode === item ? '#fff' : '#333',
                    fontWeight: '600',
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeInput: {
    width: '48%',
  },
  optionRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  optionChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#eee',
  },
  optionChipSelected: {
    backgroundColor: '#0ea5e9',
  },
});
