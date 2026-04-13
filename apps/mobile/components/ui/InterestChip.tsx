import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';

type InterestChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export default function InterestChip({
  label,
  selected = false,
  onPress,
}: InterestChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#DFF7F6',
    borderColor: theme.colors.primary,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  chipLabelSelected: {
    color: theme.colors.primaryDark,
    fontWeight: '700',
  },
});