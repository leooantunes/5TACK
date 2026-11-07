import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { draftSelectors, useDraft } from '../../application/stores/draftStore';
import { canAddPlayer, type Player } from '../../domain';
import { BudgetBar, PlayerRow, SquadSlot } from '../components/game';
import { Banner, Button, Chip, ErrorState, Loading, Screen, Txt } from '../components/primitives';
import { draftErrorMessage, roleLabel } from '../i18n/pt';
import { colors, fonts, radius, space } from '../theme/tokens';

export function DraftScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const s = useDraft();
  const [team, setTeam] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'danger' | 'success' | 'info' } | null>(null);

  useEffect(() => {
    void s.load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const playersById = useMemo(() => new Map(s.players.map((p) => [p.id, p])), [s.players]);
  const teams = useMemo(() => [...new Set(s.players.map((p) => p.teamShortName))].sort(), [s.players]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return s.players.filter((p) =>
      (!team || p.teamShortName === team) &&
      (!q || p.nickname.toLowerCase().includes(q))
    );
  }, [s.players, team, query]);

  if (s.loading || (!s.tournament && !s.loadError)) return <Screen><Loading label="Abrindo mercado…" /></Screen>;
  if (s.loadError || !s.tournament) return <Screen><ErrorState message={s.loadError ?? 'Erro'} onRetry={() => s.load(id)} /></Screen>;

  const tournament = s.tournament;
  const locked = draftSelectors.locked(s);
  const spent = draftSelectors.cost(s);
  const picked = draftSelectors.pickedPlayers(s);
  const pickedIds = new Set(s.picks.map((p) => p.playerId));

  const onToggle = (p: Player) => {
    if (locked) return setMsg({ text: draftErrorMessage({ code: 'LOCKED' }), tone: 'danger' });
    const err = s.toggle(p);
    setMsg(err ? { text: draftErrorMessage(err), tone: 'danger' } : null);
  };

  const onSave = async () => {
    const r = await s.save();
    if (r.ok) {
      setMsg({ text: 'Time salvo. GL HF!', tone: 'success' });
      setTimeout(() => router.back(), 600);
    } else {
      setMsg({ text: typeof r.errors === 'string' ? r.errors : r.errors.map(draftErrorMessage).join(' '), tone: 'danger' });
    }
  };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
        <Txt variant="label">‹ {tournament.name}</Txt>
      </Pressable>
      <Txt variant="title">Monte seu five-stack</Txt>

      <BudgetBar budget={tournament.budget} spent={spent} />

      <CompositionSummary picks={s.picks} />

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {['STAR', 'ENTRY', 'SNIPER', 'CLUTCHER', 'SUPPORT'].map((slotRole) => {
          const item = picked.find((p) => p?.pick.role === slotRole);
          return (
            <SquadSlot
              key={slotRole}
              player={item?.player}
              role={item?.pick.role as any}
              slotRole={slotRole as any}
              disabled={locked}
              onRemove={item ? () => onToggle(item.player) : undefined}
              onCycleRole={item ? () => s.cycleRole(item.player.id) : undefined}
            />
          );
        })}
      </View>
      <Txt variant="caption" color={colors.textMute}>
        Toque na função de um jogador para trocá-la. Cada função vale uma vez: {Object.values(roleLabel).map((r) => r.short).join(' · ')}
      </Txt>

      {msg ? <Banner message={msg.text} tone={msg.tone} /> : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar jogador"
        placeholderTextColor={colors.textMute}
        autoCapitalize="none"
        accessibilityLabel="Buscar jogador"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgElevated,
          color: colors.text,
          fontFamily: fonts.body,
          fontSize: 16,
          paddingHorizontal: space.md,
          minHeight: 44,
          borderRadius: radius.sm,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label="Todos" active={!team} onPress={() => setTeam(null)} />
        {teams.map((t) => (
          <Chip key={t} label={t} active={team === t} onPress={() => setTeam(team === t ? null : t)} color={colors.ct} />
        ))}
      </View>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 + insets.bottom, gap: space.sm }}
        renderItem={({ item }) => {
          const isPicked = pickedIds.has(item.id);
          const blocked = !isPicked && !canAddPlayer(tournament, s.picks, item, playersById).ok;
          return <PlayerRow player={item} picked={isPicked} blocked={blocked || locked} onPress={() => onToggle(item)} />;
        }}
        keyboardShouldPersistTaps="handled"
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: space.lg,
          paddingBottom: space.lg + insets.bottom,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt variant="label">Escalados</Txt>
          <Txt variant="monoLg" color={draftSelectors.isComplete(s) ? colors.success : colors.text}>
            {s.picks.length}/5
          </Txt>
        </View>
        <Button
          title={locked ? 'Travado' : 'Salvar time'}
          onPress={onSave}
          loading={s.saving}
          disabled={locked || !draftSelectors.isComplete(s) || !s.dirty}
          style={{ flex: 2 }}
        />
      </View>
    </Screen>
  );
}

function CompositionSummary({ picks }: { picks: Array<{ playerId: string; role: any }> }) {
  const roles = picks.map((p) => p.role);
  const picked = new Set(roles);
  const allRoles = ['STAR', 'ENTRY', 'SNIPER', 'CLUTCHER', 'SUPPORT'] as const;

  return (
    <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
      {allRoles.map((role) => (
        <View
          key={role}
          style={{
            backgroundColor: picked.has(role) ? colors.accent + '3F' : colors.bgElevated,
            borderWidth: 1,
            borderColor: picked.has(role) ? colors.accent : colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: space.sm,
            paddingVertical: 4,
          }}
        >
          <Txt
            variant="mono"
            color={picked.has(role) ? colors.accent : colors.textMute}
            style={{ fontSize: 11 }}
          >
            {roleLabel[role].short}
          </Txt>
        </View>
      ))}
    </View>
  );
}
