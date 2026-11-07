import { Redirect } from 'expo-router';
import { useSession } from '../application/stores/sessionStore';

export default function Index() {
  const status = useSession((s) => s.status);
  return <Redirect href={status === 'signedIn' ? '/(tabs)' : '/login'} />;
}
