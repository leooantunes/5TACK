/**
 * Camada de DOMÍNIO do app.
 * Reexporta as regras puras do pacote compartilhado @5tack/core — as mesmas que o
 * servidor usa. A UI nunca reimplementa regra de negócio: ela chama estas funções.
 */
export * from '@5tack/core';

/** Tipos que só existem na fronteira app ↔ API. */
export interface User {
  id: string;
  displayName: string;
  email: string;
}

/** Linha de pontuação recebida da API (código como string: tolera códigos novos do servidor). */
export interface ScoreLine {
  code: string;
  points: number;
}

export interface PickScore {
  playerId: string;
  role: import('@5tack/core').FantasyRole;
  breakdown: { total: number; items: ScoreLine[] };
}

export interface LineupScore {
  total: number;
  picks: PickScore[];
}

export interface SavedLineup {
  tournamentId: string;
  picks: import('@5tack/core').LineupPick[];
  updatedAt: string;
}
