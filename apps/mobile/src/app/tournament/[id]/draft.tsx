import { useLocalSearchParams } from 'expo-router';
import { DraftScreen } from '../../../presentation/screens/DraftScreen';

export default function DraftRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DraftScreen id={String(id)} />;
}
