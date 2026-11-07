/**
 * Entidades de domínio do 5TACK.
 * Este arquivo não conhece HTTP, banco, React nem fornecedor de dados:
 * qualquer fonte (PandaScore, GRID, mock) é convertida para estes tipos.
 */

export type Id = string;

export type TournamentStatus = 'upcoming' | 'running' | 'finished';

export interface Tournament {
  id: Id;
  name: string;
  tier: 'S' | 'A' | 'B';
  startsAt: string; // ISO 8601
  endsAt: string;
  /** Momento em que os lineups travam (normalmente o início da 1ª partida). */
  lockAt: string;
  status: TournamentStatus;
  /** Orçamento virtual para montar o lineup. */
  budget: number;
  location?: string;
}

export interface Team {
  id: Id;
  name: string;
  shortName: string;
  country?: string;
}

export interface Player {
  id: Id;
  nickname: string;
  teamId: Id;
  teamShortName: string;
  country?: string;
  /** Preço virtual no torneio (calculado por `pricing`). */
  price: number;
}

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Match {
  id: Id;
  tournamentId: Id;
  teamAId: Id;
  teamBId: Id;
  teamAShortName: string;
  teamBShortName: string;
  scoreA: number;
  scoreB: number;
  bestOf: 1 | 3 | 5;
  startsAt: string;
  status: MatchStatus;
}

/** Estatísticas de UM jogador em UM mapa. Base da pontuação. */
export interface PlayerMapStats {
  playerId: Id;
  matchId: Id;
  mapNumber: number;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  firstKills: number;
  awpKills: number;
  flashAssists: number;
  /** Rounds com 3, 4 e 5 kills. */
  multiKills: { k3: number; k4: number; k5: number };
  /** Clutches vencidos, indexados pelo número de inimigos (1v1, 1v2...). */
  clutchesWon: { v1: number; v2: number; v3: number; v4: number; v5: number };
  /** Average damage per round. */
  adr: number;
  /** % de rounds com kill, assist, sobrevivência ou trade (0–100). */
  kast: number;
  mapWon: boolean;
  /** true apenas no último mapa de uma série vencida pelo time do jogador. */
  seriesWon: boolean;
}

export const FANTASY_ROLES = ['ENTRY', 'SNIPER', 'CLUTCHER', 'SUPPORT', 'STAR'] as const;
export type FantasyRole = (typeof FANTASY_ROLES)[number];

export const BOOSTERS = ['ACE_HUNTER', 'HEADSHOT_MACHINE', 'FLASH_MASTER', 'IRON_WALL'] as const;
export type Booster = (typeof BOOSTERS)[number];

export interface LineupPick {
  playerId: Id;
  role: FantasyRole;
}

export interface Lineup {
  id?: Id;
  userId?: Id;
  tournamentId: Id;
  picks: LineupPick[];
  /** Booster ativado por partida: matchId -> { playerId, booster } */
  boosters?: Record<Id, { playerId: Id; booster: Booster }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: Id;
  displayName: string;
  points: number;
}
