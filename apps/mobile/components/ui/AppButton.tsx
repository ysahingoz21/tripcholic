import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  title: string;
  onPress?: () => void;
};

export default function AppButton({ title, onPress }: Props) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
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
  text: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});