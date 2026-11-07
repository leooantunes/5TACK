import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTournaments } from '../../application/hooks/queries';
import { useSession } from '../../application/stores/sessionStore';
import { TournamentCard } from '../components/game';
import { ErrorState, Loading, Logo, Screen, SectionHeader, Txt } from '../components/primitives';
import { colors, space } from '../theme/tokens';

export function TournamentsScreen() {
  const user = useSession((s) => s.user);
  const { data, loading, error, reload } = useTournaments();

  if (loading && !data) return <Screen><Loading /></Screen>;
  if (error && !data) return <Screen><ErrorState message={error} onRetry={reload} /></Screen>;

  // Filtra apenas tier S
  const tournaments = (data ?? []).filter((t) => t.tier === 'S');
  const open = tournaments.filter((t) => t.status === 'upcoming');
  const other = tournaments.filter((t) => t.status !== 'upcoming');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Logo size={34} />
          {user ? (
            <Txt variant="label" color={colors.textDim}>
              GL HF, <Txt variant="label" color={colors.accent}>{user.displayName}</Txt>
            </Txt>
          ) : null}
        </View>

        <SectionHeader title="Draft aberto" />
        <View style={{ gap: space.md }}>
          {open.length ? (
            open.map((t) => <TournamentCard key={t.id} t={t} onPress={() => router.push(`/tournament/${t.id}`)} />)
          ) : (
            <Txt variant="caption">Nenhum torneio aberto agora. Volte perto do próximo grande evento.</Txt>
          )}
        </View>

        <SectionHeader title="Em andamento e encerrados" />
        <View style={{ gap: space.md }}>
          {other.map((t) => (
            <TournamentCard key={t.id} t={t} onPress={() => router.push(`/tournament/${t.id}`)} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
