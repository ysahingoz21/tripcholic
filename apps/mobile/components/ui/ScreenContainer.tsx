import { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  children: ReactNode;
};

export default function ScreenContainer({ children }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
});