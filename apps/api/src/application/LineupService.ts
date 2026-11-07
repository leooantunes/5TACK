import {
  mergeBreakdowns,
  scorePickOnMap,
  validateLineup,
  type LeaderboardEntry,
  type LineupPick,
  type ScoreBreakdown,
} from '@5tack/core';
import type { LineupRepository, UserRepository } from '../infra/repositories/repositories';
import type { CatalogService } from './CatalogService';
import { AppError } from './errors';

export interface PickScore {
  playerId: string;
  role: LineupPick['role'];
  breakdown: ScoreBreakdown;
}

export class LineupService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly lineups: LineupRepository,
    private readonly users: UserRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async getMine(userId: string, tournamentId: string) {
    return (await this.lineups.get(userId, tournamentId)) ?? null;
  }

  /**
   * Salva o lineup. O servidor revalida TUDO com as regras do core e com o
   * próprio relógio e preços — nunca confia em preço, horário ou time vindo do app.
   */
  async save(userId: string, tournamentId: string, picks: LineupPick[]) {
    const tournament = await this.catalog.getTournament(tournamentId);
    const players = new Map((await this.catalog.listPlayers(tournamentId)).map((p) => [p.id, p]));
    const result = validateLineup(tournament, picks, players, this.clock());
    if (!result.ok) throw new AppError(422, 'INVALID_LINEUP', 'Lineup inválido', result.errors);
    return this.lineups.upsert({ userId, tournamentId, picks: result.value, updatedAt: this.clock().toISOString() });
  }

  async scoreLineup(picks: LineupPick[], tournamentId: string): Promise<{ total: number; picks: PickScore[] }> {
    const stats = await this.catalog.listMapStats(tournamentId);
    const perPick = picks.map((pick) => {
      const maps = stats.filter((s) => s.playerId === pick.playerId).map((s) => scorePickOnMap(pick, s));
      return { playerId: pick.playerId, role: pick.role, breakdown: mergeBreakdowns(maps) };
    });
    const total = Math.round(perPick.reduce((a, p) => a + p.breakdown.total, 0) * 100) / 100;
    return { total, picks: perPick };
  }

  async myScore(userId: string, tournamentId: string) {
    const lineup = await this.lineups.get(userId, tournamentId);
    if (!lineup) return null;
    return this.scoreLineup(lineup.picks, tournamentId);
  }

  async leaderboard(tournamentId: string, limit = 50): Promise<LeaderboardEntry[]> {
    await this.catalog.getTournament(tournamentId);
    const all = await this.lineups.listByTournament(tournamentId);
    const scored = await Promise.all(
      all.map(async (l) => ({ userId: l.userId, points: (await this.scoreLineup(l.picks, tournamentId)).total })),
    );
    scored.sort((a, b) => b.points - a.points);
    const top = scored.slice(0, limit);
    // Só o nome público vai no ranking — e-mail nunca sai do servidor.
    const names = await this.users.listDisplayNames(top.map((s) => s.userId));
    return top.map((s, i) => ({ rank: i + 1, userId: s.userId, displayName: names.get(s.userId) ?? '—', points: s.points }));
  }
}
