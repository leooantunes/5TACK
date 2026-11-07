import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useSession } from '../../application/stores/sessionStore';
import { DEFAULT_RULES, FANTASY_ROLES } from '../../domain';
import { RoleBadge } from '../components/game';
import { Banner, Button, HudPanel, Screen, SectionHeader, Txt } from '../components/primitives';
import { roleLabel } from '../i18n/pt';
import { colors, space } from '../theme/tokens';

/** Pontuação exibida a partir das MESMAS regras que o servidor usa (DEFAULT_RULES do domínio). */
const r = DEFAULT_RULES;
const n = (v: number) => String(v).replace('.', ',');
const BASE_RULES: [string, string][] = [
  ['Kill', `+${n(r.kill)}`],
  ['Assistência', `+${n(r.assist)}`],
  ['Morte', n(r.death)],
  ['Headshot', `+${n(r.headshot)}`],
  ['First kill', `+${n(r.firstKill)}`],
  ['3K / 4K / Ace', `+${r.k3} / +${r.k4} / +${r.k5}`],
  ['Clutch 1vX', `+${n(r.clutchPerEnemy)} × X`],
  [`ADR ≥ ${r.adrBonus.threshold}`, `+${n(r.adrBonus.points)}`],
  [`KAST ≥ ${r.kastBonus.threshold}%`, `+${n(r.kastBonus.points)}`],
  ['Mapa vencido', `+${n(r.mapWon)}`],
  ['Série vencida', `+${n(r.seriesWon)}`],
];

export function ProfileScreen() {
  const { user, logout, deleteAccount } = useSession();
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = () => {
    const run = () => deleteAccount().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'));
    if (Platform.OS === 'web') return run();
    Alert.alert('Excluir conta', 'Isso apaga sua conta e todos os seus times. Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Txt variant="label">Perfil</Txt>
        <Txt variant="display" color={colors.accent}>
          {user?.displayName}
        </Txt>
        <Txt variant="caption">{user?.email}</Txt>

        <SectionHeader title={`Regras de pontuação · ${r.version}`} />
        <HudPanel style={{ gap: 6 }}>
          {BASE_RULES.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="caption">{k}</Txt>
              <Txt variant="mono" color={v.startsWith('-') ? colors.danger : colors.success}>
                {v}
              </Txt>
            </View>
          ))}
        </HudPanel>

        <SectionHeader title="Funções" />
        <HudPanel style={{ gap: space.md }}>
          {FANTASY_ROLES.map((role) => (
            <View key={role} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 84 }}>
                <RoleBadge role={role} />
              </View>
              <Txt variant="caption" style={{ flex: 1 }}>
                {roleLabel[role].hint}
              </Txt>
            </View>
          ))}
        </HudPanel>

        <SectionHeader title="Conta e privacidade" />
        <View style={{ gap: space.md }}>
          <Txt variant="caption" color={colors.textMute}>
            Guardamos só seu e-mail, nick e times. Sua senha é armazenada como hash e a sessão fica no cofre seguro do aparelho.
          </Txt>
          {error ? <Banner message={error} /> : null}
          <Button title="Sair" variant="ghost" onPress={() => void logout()} />
          <Button title="Excluir minha conta" variant="danger" onPress={confirmDelete} />
        </View>
      </ScrollView>
    </Screen>
  );
}
