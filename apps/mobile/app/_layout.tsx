import { Stack } from 'expo-router';
import { theme } from '@/constants/theme';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="results"
        options={{
          title: 'Your Route',
        }}
      />
      <Stack.Screen
        name="trip/[id]"
        options={{
          title: 'Trip Details',
        }}
      />
    </Stack>
  );
}