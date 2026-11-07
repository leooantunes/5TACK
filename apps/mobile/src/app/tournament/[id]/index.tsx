import { useLocalSearchParams } from 'expo-router';
import { TournamentScreen } from '../../../presentation/screens/TournamentScreen';

export default function TournamentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TournamentScreen id={String(id)} />;
}
