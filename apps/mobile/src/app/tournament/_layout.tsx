import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../application/stores/sessionStore';

export default function TournamentLayout() {
  const status = useSession((s) => s.status);
  if (status !== 'signedIn') return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
