import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenContainer from '../../components/ui/ScreenContainer';
import SectionTitle from '../../components/ui/SectionTitle';
import AppButton from '../../components/ui/AppButton';
import InterestChip from '../../components/ui/InterestChip';
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
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Culture',
    'Food',
  ]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest]
    );
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

          <Text style={styles.label}>Destination</Text>
          <TextInput
            placeholder="Istanbul district or area"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            placeholder="Select date"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Text style={styles.label}>Available Time</Text>
          <TextInput
            placeholder="e.g. 6 hours"
            placeholderTextColor="#94A3B8"
            style={styles.input}
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
          />

          <Text style={styles.label}>Transport Mode</Text>
          <TextInput
            placeholder="Walking / Car"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Text style={styles.sectionLabel}>Or describe it naturally</Text>
          <TextInput
            placeholder='Example: "A relaxed afternoon with good food and something cultural, not too much walking."'
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />

          <AppButton title="Generate Route" onPress={() => router.push('/results')} />
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