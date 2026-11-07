import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../application/stores/sessionStore';

export default function AuthLayout() {
  const status = useSession((s) => s.status);
  if (status === 'signedIn') return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
