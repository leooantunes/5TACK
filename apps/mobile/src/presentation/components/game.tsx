import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { FantasyRole, LeaderboardEntry, Match, Player, ScoreLine, Tournament } from '../../domain';
import { countdown, money, points, shortDate } from '../format';
import { matchStatusLabel, roleLabel, scoreLabel, tournamentStatusLabel } from '../i18n/pt';
import { colors, fonts, radius, roleColors, space } from '../theme/tokens';
import { HudPanel, Txt } from './primitives';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const roleIcon: Record<FantasyRole, IconName> = {
  STAR: 'star-four-points',
  ENTRY: 'run-fast',
  SNIPER: 'crosshairs-gps',
  CLUTCHER: 'timer-sand',
  SUPPORT: 'shield-half-full',
};

/* ---------------- Função ---------------- */

export function RoleBadge({ role, onPress, compact }: { role: FantasyRole; onPress?: () => void; compact?: boolean }) {
  const c = roleColors[role];
  const content = (
    <View style={[styles.role, { borderColor: c, backgroundColor: c + '1F' }]}>
      {compact ? null : <MaterialCommunityIcons name={roleIcon[role]} size={14} color={c} />}
      <Txt variant="label" color={c} style={compact ? { fontSize: 10, letterSpacing: 0.8 } : { fontSize: 11 }}>
        {roleLabel[role].short}
      </Txt>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Função ${roleLabel[role].name}. Toque para trocar`}
      hitSlop={8}
    >
      {content}
    </Pressable>
  );
}

/* ---------------- Tag de time ---------------- */

export function TeamTag({ name }: { name: string }) {
  return (
    <View style={styles.teamTag}>
      <Txt variant="mono" style={{ fontSize: 11 }} color={colors.textDim}>
        {name}
      </Txt>
    </View>
  );
}

/* ---------------- Orçamento ---------------- */

export function BudgetBar({ budget, spent }: { budget: number; spent: number }) {
  const ratio = Math.min(1, spent / budget);
  const over = spent > budget;
  const remaining = budget - spent;
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Txt variant="label">Orçamento</Txt>
        <Txt variant="mono" color={over ? colors.danger : colors.accent} style={{ fontFamily: fonts.monoBold, fontSize: 16 }}>
          {money(remaining)} <Txt variant="mono" color={colors.textMute}>/ {money(budget)}</Txt>
        </Txt>
      </View>
      <View style={styles.barTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: budget, now: spent }}>
        <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: over ? colors.danger : colors.accent }]} />
        {[0.2, 0.4, 0.6, 0.8].map((t) => (
          <View key={t} style={[styles.barTick, { left: `${t * 100}%` }]} />
        ))}
      </View>
    </View>
  );
}

/* ---------------- Vaga do time (5 slots) ---------------- */

export function SquadSlot({
  player,
  role,
  slotRole,
  onRemove,
  onCycleRole,
  disabled,
}: {
  player?: Player;
  role?: FantasyRole;
  slotRole: FantasyRole;
  onRemove?: () => void;
  onCycleRole?: () => void;
  disabled?: boolean;
}) {
  if (!player || !role) {
    return (
      <View style={[styles.slot, styles.slotEmpty]} accessibilityLabel={`Vaga para ${roleLabel[slotRole].name}`}>
        <Txt variant="label" color={colors.accent} style={{ fontSize: 9, fontWeight: '600' }}>
          {roleLabel[slotRole].short}
        </Txt>
        <Txt variant="label" color={colors.textMute} style={{ fontSize: 8 }}>
          {roleLabel[slotRole].name}
        </Txt>
      </View>
    );
  }
  return (
    <View style={[styles.slot, { borderColor: roleColors[role] + '88' }]}>
      {!disabled && onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          style={styles.slotRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remover ${player.nickname}`}
        >
          <MaterialCommunityIcons name="close" size={12} color={colors.textDim} />
        </Pressable>
      ) : null}
      <Txt variant="heading" numberOfLines={1} style={{ fontSize: 15 }}>
        {player.nickname}
      </Txt>
      <Txt variant="mono" color={colors.textMute} style={{ fontSize: 10 }}>
        {player.teamShortName}
      </Txt>
      <RoleBadge role={role} compact onPress={disabled ? undefined : onCycleRole} />
    </View>
  );
}

/* ---------------- Linha de jogador (mercado) ---------------- */

export function PlayerRow({
  player,
  picked,
  blocked,
  onPress,
}: {
  player: Player;
  picked: boolean;
  blocked: boolean;
  onPress: () => void;
}) {
  const countryEmoji = player.country ? getCountryEmoji(player.country) : '🌍';

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={`${player.nickname}, ${player.teamShortName}, ${money(player.price)}${picked ? ', escalado' : ''}`}
      style={({ pressed }) => [
        styles.playerRow,
        picked && { borderColor: colors.accent, backgroundColor: colors.accentDim },
        blocked && { opacity: 0.5, borderColor: colors.textMute },
        pressed && !blocked && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.bgElevated, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }]}>
        <Txt variant="heading" style={{ fontSize: 20 }}>
          {countryEmoji}
        </Txt>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Txt variant="heading">{player.nickname}</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <TeamTag name={player.teamShortName} />
          {player.country ? <Txt variant="caption">{player.country}</Txt> : null}
        </View>
      </View>
      <Txt
        variant="mono"
        color={blocked && !picked ? colors.textMute : colors.text}
        style={{ fontFamily: fonts.monoBold, fontSize: 15 }}
      >
        {money(player.price)}
      </Txt>
      <View style={[styles.addBtn, picked ? { backgroundColor: colors.accent, borderColor: colors.accent } : blocked ? { opacity: 0.35 } : null]}>
        <MaterialCommunityIcons
          name={picked ? 'check' : 'plus'}
          size={18}
          color={picked ? colors.accentText : colors.accent}
        />
      </View>
    </Pressable>
  );
}

function getCountryEmoji(countryCode: string): string {
  const flags: Record<string, string> = {
    BR: '🇧🇷',
    US: '🇺🇸',
    FR: '🇫🇷',
    DE: '🇩🇪',
    SE: '🇸🇪',
    PL: '🇵🇱',
    DK: '🇩🇰',
    NO: '🇳🇴',
    TR: '🇹🇷',
    KZ: '🇰🇿',
    RU: '🇷🇺',
    UA: '🇺🇦',
    RO: '🇷🇴',
    CZ: '🇨🇿',
    HU: '🇭🇺',
    GR: '🇬🇷',
    IT: '🇮🇹',
    ES: '🇪🇸',
    PT: '🇵🇹',
    GB: '🇬🇧',
    AT: '🇦🇹',
    CH: '🇨🇭',
    BE: '🇧🇪',
    NL: '🇳🇱',
    CA: '🇨🇦',
    AU: '🇦🇺',
    FI: '🇫🇮',
    XK: '🏳️',
  };
  return flags[countryCode] || '🌍';
}

/* ---------------- Torneio ---------------- */

export function TournamentCard({ t, onPress }: { t: Tournament; onPress: () => void }) {
  const open = t.status === 'upcoming';
  const statusColor = open ? colors.success : t.status === 'running' ? colors.live : colors.textMute;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t.name}, ${tournamentStatusLabel[t.status]}`}>
      {({ pressed }) => (
        <HudPanel highlighted={open} style={{ opacity: pressed ? 0.85 : 1, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={[styles.tier, t.tier === 'S' && { borderColor: colors.accent }]}>
              <Txt variant="label" color={t.tier === 'S' ? colors.accent : colors.textDim}>
                Tier {t.tier}
              </Txt>
            </View>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Txt variant="label" color={statusColor}>
              {tournamentStatusLabel[t.status]}
            </Txt>
          </View>
          <Txt variant="title" style={{ fontSize: 22 }}>
            {t.name}
          </Txt>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="caption">
              {shortDate(t.startsAt)} – {shortDate(t.endsAt)}
              {t.location ? ` · ${t.location}` : ''}
            </Txt>
            {open ? (
              <Txt variant="mono" color={colors.accent}>
                trava em {countdown(t.lockAt)}
              </Txt>
            ) : null}
          </View>
        </HudPanel>
      )}
    </Pressable>
  );
}

/* ---------------- Partida ---------------- */

export function MatchRow({ m }: { m: Match }) {
  const finished = m.status === 'finished';
  const aWon = finished && m.scoreA > m.scoreB;
  const bWon = finished && m.scoreB > m.scoreA;
  return (
    <View style={styles.match}>
      <Txt variant="heading" style={{ flex: 1, textAlign: 'right' }} color={aWon ? colors.text : colors.textDim}>
        {m.teamAShortName}
      </Txt>
      <View style={styles.score}>
        {m.status === 'scheduled' ? (
          <Txt variant="mono" color={colors.textDim}>
            {new Date(m.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Txt>
        ) : (
          <Txt variant="monoLg" style={{ fontSize: 18 }}>
            <Txt variant="monoLg" style={{ fontSize: 18 }} color={aWon ? colors.ct : colors.text}>
              {m.scoreA}
            </Txt>
            <Txt variant="mono" color={colors.textMute}>
              {' : '}
            </Txt>
            <Txt variant="monoLg" style={{ fontSize: 18 }} color={bWon ? colors.accent : colors.text}>
              {m.scoreB}
            </Txt>
          </Txt>
        )}
        <Txt variant="label" style={{ fontSize: 9 }} color={m.status === 'live' ? colors.live : colors.textMute}>
          {matchStatusLabel[m.status]} · BO{m.bestOf}
        </Txt>
      </View>
      <Txt variant="heading" style={{ flex: 1 }} color={bWon ? colors.text : colors.textDim}>
        {m.teamBShortName}
      </Txt>
    </View>
  );
}

/* ---------------- Ranking ---------------- */

export function LeaderboardRow({ e, isMe }: { e: LeaderboardEntry; isMe?: boolean }) {
  const medal = e.rank === 1 ? colors.accent : e.rank === 2 ? '#C9D3DF' : e.rank === 3 ? '#C98B5B' : colors.textMute;
  return (
    <View style={[styles.lbRow, isMe && { borderColor: colors.accent, backgroundColor: colors.accentDim }]}>
      <Txt variant="monoLg" color={medal} style={{ width: 36, fontSize: 16 }}>
        #{e.rank}
      </Txt>
      <Txt variant="heading" style={{ flex: 1 }} numberOfLines={1}>
        {e.displayName}
        {isMe ? <Txt variant="label" color={colors.accent}>{'  você'}</Txt> : null}
      </Txt>
      <Txt variant="mono" style={{ fontFamily: fonts.monoBold, fontSize: 15 }}>
        {points(e.points)}
      </Txt>
    </View>
  );
}

/* ---------------- Detalhe de pontuação ---------------- */

export function ScoreLines({ items }: { items: ScoreLine[] }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((i) => (
        <View key={i.code} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="caption">{scoreLabel(i.code)}</Txt>
          <Txt variant="mono" color={i.points < 0 ? colors.danger : colors.success}>
            {i.points > 0 ? '+' : ''}
            {points(i.points)}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  teamTag: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm },
  barTrack: { height: 8, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%' },
  barTick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.bg },
  slot: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    padding: 6,
    gap: 3,
    justifyContent: 'flex-end',
  },
  slotEmpty: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  slotRemove: { position: 'absolute', top: 4, right: 4, zIndex: 1 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
  },
  avatar: {
    width: 30,
    height: 30,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: colors.borderHi,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  addBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  tier: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  dot: { width: 7, height: 7, borderRadius: 4 },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  score: { alignItems: 'center', minWidth: 76, gap: 2 },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: 'transparent',
    borderBottomColor: colors.border,
  },
});
