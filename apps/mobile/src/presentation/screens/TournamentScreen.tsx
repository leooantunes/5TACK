import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTournamentOverview, type TournamentOverview } from '../../application/hooks/queries';
import { useSession } from '../../application/stores/sessionStore';
import { isLocked } from '../../domain';
import { LeaderboardRow, MatchRow, RoleBadge, ScoreLines, TeamTag } from '../components/game';
import { Button, Chip, ErrorState, HudPanel, Loading, Screen, Txt } from '../components/primitives';
import { countdown, dateTime, money, points } from '../format';
import { tournamentStatusLabel } from '../i18n/pt';
import { colors, space } from '../theme/tokens';

type Tab = 'team' | 'matches' | 'ranking';

export function TournamentScreen({ id }: { id: string }) {
  const { data, loading, error, reload } = useTournamentOverview(id);
  const [tab, setTab] = useState<Tab>('team');

  // Recarrega ao voltar do draft, para mostrar o time salvo (ignora o primeiro foco).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else reload();
    }, [reload]),
  );

  if (loading && !data) return <Screen><Loading /></Screen>;
  if (error && !data) return <Screen><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!data) return null;

  const { tournament: t } = data;
  const locked = isLocked(t, new Date());

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
          <Txt variant="label">‹ Torneios</Txt>
        </Pressable>

        <View style={{ gap: space.xs }}>
          <Txt variant="label" color={t.status === 'upcoming' ? colors.success : colors.textDim}>
            Tier {t.tier} · {tournamentStatusLabel[t.status]}
          </Txt>
          <Txt variant="display">{t.name}</Txt>
          <Txt variant="caption">
            {dateTime(t.startsAt)}
            {t.location ? ` · ${t.location}` : ''}
          </Txt>
        </View>

        {!locked ? (
          <HudPanel highlighted style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <MaterialCommunityIcons name="timer-outline" size={28} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Txt variant="label">Lineup trava em</Txt>
              <Txt variant="monoLg" color={colors.accent}>
                {countdown(t.lockAt)}
              </Txt>
            </View>
            <Button
              title={data.myLineup ? 'Editar' : 'Montar time'}
              onPress={() => router.push(`/tournament/${t.id}/draft`)}
            />
          </HudPanel>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Meu time" active={tab === 'team'} onPress={() => setTab('team')} />
          <Chip label="Partidas" active={tab === 'matches'} onPress={() => setTab('matches')} />
          <Chip label="Ranking" active={tab === 'ranking'} onPress={() => setTab('ranking')} />
        </View>

        {tab === 'team' ? <MyTeam data={data} locked={locked} /> : null}
        {tab === 'matches' ? (
          <HudPanel style={{ paddingVertical: 0 }}>
            {data.matches.length ? data.matches.map((m) => <MatchRow key={m.id} m={m} />) : <Txt variant="caption" style={{ paddingVertical: space.lg }}>Sem partidas ainda.</Txt>}
          </HudPanel>
        ) : null}
        {tab === 'ranking' ? <Ranking data={data} /> : null}
      </ScrollView>
    </Screen>
  );
}

function MyTeam({ data, locked }: { data: TournamentOverview; locked: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const signedIn = useSession((s) => s.status === 'signedIn');
  const players = new Map(data.players.map((p) => [p.id, p]));

  if (!signedIn) return <Txt variant="caption">Entre para montar seu time.</Txt>;
  if (!data.myLineup) {
    return (
      <HudPanel style={{ alignItems: 'center', gap: space.md }}>
        <MaterialCommunityIcons name="account-group-outline" size={36} color={colors.textMute} />
        <Txt variant="caption" style={{ textAlign: 'center' }}>
          {locked ? 'Você não escalou time neste torneio.' : 'Você ainda não escalou seu five-stack.'}
        </Txt>
      </HudPanel>
    );
  }

  const scores = new Map((data.myScore?.picks ?? []).map((p) => [p.playerId, p]));

  return (
    <View style={{ gap: space.md }}>
      <HudPanel highlighted style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Txt variant="label">Pontuação total</Txt>
          <Txt variant="monoLg" color={colors.accent} style={{ fontSize: 30 }}>
            {points(data.myScore?.total ?? 0)}
          </Txt>
        </View>
        <Txt variant="caption">pts</Txt>
      </HudPanel>

      {data.myLineup.picks.map((pick) => {
        const p = players.get(pick.playerId);
        const s = scores.get(pick.playerId);
        const expanded = open === pick.playerId;
        return (
          <Pressable
            key={pick.playerId}
            onPress={() => setOpen(expanded ? null : pick.playerId)}
            accessibilityRole="button"
            accessibilityLabel={`${p?.nickname ?? 'Jogador'}, ${points(s?.breakdown.total ?? 0)} pontos. Toque para detalhes`}
          >
            <HudPanel style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                    <Txt variant="heading">{p?.nickname ?? pick.playerId}</Txt>
                    {p ? <TeamTag name={p.teamShortName} /> : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                    <RoleBadge role={pick.role} compact />
                    {p ? <Txt variant="mono" color={colors.textMute}>{money(p.price)}</Txt> : null}
                  </View>
                </View>
                <Txt variant="monoLg" style={{ fontSize: 20 }}>
                  {points(s?.breakdown.total ?? 0)}
                </Txt>
                <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMute} />
              </View>
              {expanded ? (
                s && s.breakdown.items.length ? (
                  <ScoreLines items={s.breakdown.items} />
                ) : (
                  <Txt variant="caption">Ainda sem mapas jogados.</Txt>
                )
              ) : null}
            </HudPanel>
          </Pressable>
        );
      })}
    </View>
  );
}

function Ranking({ data }: { data: TournamentOverview }) {
  const me = useSession((s) => s.user?.id);
  if (!data.leaderboard.length) return <Txt variant="caption">Ninguém no ranking ainda. Seja o primeiro.</Txt>;
  return (
    <HudPanel style={{ padding: 0 }}>
      {data.leaderboard.map((e) => (
        <LeaderboardRow key={e.userId} e={e} isMe={e.userId === me} />
      ))}
    </HudPanel>
  );
}
