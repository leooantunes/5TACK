import type { Match, Player, PlayerMapStats, Team, Tournament } from '@5tack/core';

/**
 * Contrato de qualquer fonte de dados de CS2.
 * O resto do backend só conhece esta interface — trocar PandaScore por GRID
 * significa escrever outra implementação, sem mexer em serviços ou rotas.
 */
export interface DataProvider {
  readonly name: string;
  listTournaments(): Promise<Tournament[]>;
  listTeams(tournamentId: string): Promise<Team[]>;
  /** Jogadores do torneio, SEM preço (o preço é regra de negócio, calculada no serviço). */
  listPlayers(tournamentId: string): Promise<Omit<Player, 'price'>[]>;
  listMatches(tournamentId: string): Promise<Match[]>;
  /** Estatísticas por mapa de partidas finalizadas. */
  listMapStats(tournamentId: string): Promise<PlayerMapStats[]>;
  /** Média recente de pontos por mapa (base do preço). */
  recentAverages(playerIds: string[]): Promise<Record<string, number>>;
}
