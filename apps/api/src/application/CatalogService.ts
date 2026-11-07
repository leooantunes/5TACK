import { priceFromAverages, type Match, type Player, type PlayerMapStats, type Tournament } from '@5tack/core';
import type { DataProvider } from '../infra/providers/DataProvider';
import { notFound } from './errors';

/**
 * Catálogo de torneios, jogadores e partidas.
 * Tem cache em memória com TTL para economizar a cota da API de dados
 * (a PandaScore limita requisições por hora) e responder rápido ao app.
 */
export class CatalogService {
  private cache = new Map<string, { at: number; value: unknown }>();

  constructor(
    private readonly provider: DataProvider,
    private readonly ttlMs = 5 * 60 * 1000,
  ) {}

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value as T;
    const value = await load();
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  invalidate() {
    this.cache.clear();
  }

  listTournaments(): Promise<Tournament[]> {
    return this.cached('tournaments', () => this.provider.listTournaments());
  }

  async getTournament(id: string): Promise<Tournament> {
    const t = (await this.listTournaments()).find((x) => x.id === id);
    if (!t) throw notFound('Torneio');
    return t;
  }

  /** Jogadores com preço. O preço é regra de negócio (core), não vem do fornecedor. */
  async listPlayers(tournamentId: string): Promise<Player[]> {
    await this.getTournament(tournamentId);
    return this.cached(`players:${tournamentId}`, async () => {
      const raw = await this.provider.listPlayers(tournamentId);
      const prices = priceFromAverages(await this.provider.recentAverages(raw.map((p) => p.id)));
      return raw.map((p) => ({ ...p, price: prices[p.id] ?? 150_000 })).sort((a, b) => b.price - a.price);
    });
  }

  async listMatches(tournamentId: string): Promise<Match[]> {
    await this.getTournament(tournamentId);
    return this.cached(`matches:${tournamentId}`, () => this.provider.listMatches(tournamentId));
  }

  async listMapStats(tournamentId: string): Promise<PlayerMapStats[]> {
    return this.cached(`stats:${tournamentId}`, () => this.provider.listMapStats(tournamentId));
  }
}
