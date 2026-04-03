import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { token } = useAuth();

  return <Redirect href={token ? '/(tabs)' : '/login'} />;
}