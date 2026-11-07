import type {
  LeaderboardEntry,
  LineupPick,
  LineupScore,
  Match,
  Player,
  SavedLineup,
  Tournament,
  User,
} from '../domain';

/**
 * PORTAS da camada de aplicação: o que a aplicação precisa do mundo externo.
 * A camada de dados implementa estas interfaces; a aplicação e a UI não sabem
 * se os dados vêm de HTTP, de cache ou de um mock de teste.
 */

export interface AuthGateway {
  /** Restaura a sessão salva no armazenamento seguro, se houver. */
  restore(): Promise<User | null>;
  login(email: string, password: string): Promise<User>;
  register(email: string, password: string, displayName: string): Promise<User>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
}

export interface TournamentGateway {
  list(): Promise<Tournament[]>;
  get(id: string): Promise<Tournament>;
  players(id: string): Promise<Player[]>;
  matches(id: string): Promise<Match[]>;
  leaderboard(id: string): Promise<LeaderboardEntry[]>;
}

export interface LineupGateway {
  getMine(tournamentId: string): Promise<SavedLineup | null>;
  save(tournamentId: string, picks: LineupPick[]): Promise<SavedLineup>;
  myScore(tournamentId: string): Promise<LineupScore | null>;
}

export interface Gateways {
  auth: AuthGateway;
  tournaments: TournamentGateway;
  lineups: LineupGateway;
}

let current: Gateways | null = null;

/** Chamado uma única vez na inicialização (composition root em src/di.ts). */
export function provideGateways(g: Gateways) {
  current = g;
}

export function gateways(): Gateways {
  if (!current) throw new Error('Gateways não configurados. Importe src/di.ts no layout raiz.');
  return current;
}
