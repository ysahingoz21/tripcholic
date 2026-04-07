import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
};

export default function AppButton({ title, onPress, disabled = false }: Props) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
