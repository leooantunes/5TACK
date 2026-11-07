import type { Booster, DraftError, FantasyRole, MatchStatus, TournamentStatus } from '../../domain';

/** Textos da UI. O domínio devolve CÓDIGOS; a tradução é responsabilidade da apresentação. */

export const roleLabel: Record<FantasyRole, { name: string; short: string; hint: string }> = {
  STAR: { name: 'Estrela', short: 'STAR', hint: '×1,25 nos pontos-base do mapa' },
  ENTRY: { name: 'Entry', short: 'ENTRY', hint: '+1,5 por first kill' },
  SNIPER: { name: 'Sniper', short: 'AWP', hint: '+0,5 por kill de AWP' },
  CLUTCHER: { name: 'Clutcher', short: 'CLUTCH', hint: '+2 por clutch vencido' },
  SUPPORT: { name: 'Suporte', short: 'SUP', hint: '+1 por flash assist, +2 com KAST ≥ 75%' },
};

export const boosterLabel: Record<Booster, string> = {
  ACE_HUNTER: 'Caçador de Ace',
  HEADSHOT_MACHINE: 'Máquina de HS',
  FLASH_MASTER: 'Mestre da Flash',
  IRON_WALL: 'Muralha',
};

const scoreLabels: Record<string, string> = {
  KILLS: 'Kills',
  ASSISTS: 'Assistências',
  DEATHS: 'Mortes',
  HEADSHOTS: 'Headshots',
  FIRST_KILLS: 'First kills',
  MULTI_KILLS: 'Multi-kills',
  CLUTCHES: 'Clutches',
  ADR_BONUS: 'Bônus ADR',
  KAST_BONUS: 'Bônus KAST',
  MAP_WON: 'Mapas vencidos',
  SERIES_WON: 'Série vencida',
};

export function scoreLabel(code: string): string {
  if (scoreLabels[code]) return scoreLabels[code];
  if (code.startsWith('ROLE_')) return `Função: ${roleLabel[code.slice(5) as FantasyRole]?.name ?? code.slice(5)}`;
  if (code.startsWith('BOOSTER_')) return `Booster: ${boosterLabel[code.slice(8) as Booster] ?? code.slice(8)}`;
  return code;
}

export const tournamentStatusLabel: Record<TournamentStatus, string> = {
  upcoming: 'Draft aberto',
  running: 'Em andamento',
  finished: 'Encerrado',
};

export const matchStatusLabel: Record<MatchStatus, string> = {
  scheduled: 'Agendada',
  live: 'Ao vivo',
  finished: 'Final',
};

export function draftErrorMessage(e: DraftError): string {
  switch (e.code) {
    case 'LOCKED':
      return 'O draft deste torneio já travou.';
    case 'WRONG_SIZE':
      return e.actual > e.expected ? 'Seu time já tem 5 jogadores.' : `Escale ${e.expected} jogadores (faltam ${e.expected - e.actual}).`;
    case 'DUPLICATE_PLAYER':
      return 'Esse jogador já está no seu time.';
    case 'UNKNOWN_PLAYER':
      return 'Jogador indisponível neste torneio.';
    case 'OVER_BUDGET':
      return 'Orçamento estourado.';
    case 'TOO_MANY_FROM_TEAM':
      return `Máximo de ${e.max} jogadores do mesmo time.`;
    case 'DUPLICATE_ROLE':
      return 'Cada função só pode ser usada uma vez.';
    case 'INVALID_ROLE':
      return 'Função inválida.';
  }
}
