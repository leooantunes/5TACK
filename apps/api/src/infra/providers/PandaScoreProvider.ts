import type { Match, MatchStatus, Player, PlayerMapStats, Team, Tournament } from '@5tack/core';
import { z } from 'zod';
import type { DataProvider } from './DataProvider';

/**
 * Implementação para a PandaScore (https://developers.pandascore.co).
 *
 * Segurança:
 *  - o token vive só no servidor (variável de ambiente) e vai no header Authorization;
 *  - toda resposta passa por schema zod: dado externo é tratado como não confiável;
 *  - timeout em cada requisição para um fornecedor lento não travar a API.
 *
 * ⚠️ Os endpoints de CS2 usam o prefixo /csgo/. Os schemas de calendário seguem a
 * documentação pública; o mapeamento de ESTATÍSTICAS (`listMapStats`) depende do plano
 * Historical e deve ser conferido com respostas reais antes de ir para produção.
 */

const BASE_URL = 'https://api.pandascore.co';
const TIMEOUT_MS = 10_000;

const PsTeam = z.object({ id: z.number(), name: z.string(), acronym: z.string().nullable().optional(), location: z.string().nullable().optional() });
const PsPlayer = z.object({ id: z.number(), name: z.string(), nationality: z.string().nullable().optional() });

const PsTournament = z.object({
  id: z.number(),
  name: z.string(),
  begin_at: z.string().nullable(),
  end_at: z.string().nullable(),
  tier: z.string().nullable().optional(),
  league: z.object({ name: z.string() }).optional(),
  serie: z.object({ full_name: z.string().nullable().optional() }).optional(),
});

const PsMatch = z.object({
  id: z.number(),
  tournament_id: z.number(),
  begin_at: z.string().nullable(),
  status: z.string(),
  number_of_games: z.number(),
  opponents: z.array(z.object({ opponent: PsTeam })),
  results: z.array(z.object({ team_id: z.number(), score: z.number() })).default([]),
  winner_id: z.number().nullable().optional(),
});

const PsRosters = z.object({ rosters: z.array(PsTeam.extend({ players: z.array(PsPlayer).default([]) })) });

/** Estatísticas por jogo (mapa). Campos opcionais com default 0: o mapeamento é tolerante. */
const n = z.number().nullable().optional().transform((v) => v ?? 0);
const PsGamePlayerStats = z.object({
  player: z.object({ id: z.number() }),
  team: z.object({ id: z.number() }).optional(),
  kills: n,
  deaths: n,
  assists: n,
  headshots: n,
  first_kills: n,
  adr: n,
  kast: n,
  flash_assists: n,
});
const PsGame = z.object({
  id: z.number(),
  position: z.number(),
  status: z.string(),
  winner: z.object({ id: z.number().nullable() }).nullable().optional(),
  rounds_score: z.array(z.object({ team_id: z.number(), score: z.number() })).optional(),
  players: z.array(PsGamePlayerStats).default([]),
});

function mapStatus(s: string): MatchStatus {
  if (s === 'running') return 'live';
  if (s === 'finished') return 'finished';
  return 'scheduled';
}

export class PandaScoreProvider implements DataProvider {
  readonly name = 'pandascore';

  constructor(private readonly token: string) {}

  private async get<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.output<S>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`PandaScore ${res.status} em ${path}`); // nunca loga o token
      return schema.parse(await res.json());
    } finally {
      clearTimeout(timer);
    }
  }

  async listTournaments(): Promise<Tournament[]> {
    const [running, upcoming] = await Promise.all([
      this.get('/csgo/tournaments/running?per_page=50', z.array(PsTournament)),
      this.get('/csgo/tournaments/upcoming?per_page=50', z.array(PsTournament)),
    ]);
    const now = Date.now();
    return [...running, ...upcoming]
      .filter((t) => t.begin_at)
      .map((t) => {
        const tier = (t.tier ?? 'b').toUpperCase();
        return {
          id: String(t.id),
          name: [t.league?.name, t.serie?.full_name, t.name].filter(Boolean).join(' · '),
          tier: tier === 'S' || tier === 'A' ? tier : 'B',
          startsAt: t.begin_at!,
          endsAt: t.end_at ?? t.begin_at!,
          lockAt: t.begin_at!,
          status: new Date(t.begin_at!).getTime() > now ? 'upcoming' : 'running',
          budget: 1_000_000,
        } satisfies Tournament;
      });
  }

  async listTeams(tournamentId: string): Promise<Team[]> {
    const { rosters } = await this.get(`/tournaments/${encodeURIComponent(tournamentId)}/rosters`, PsRosters);
    return rosters.map((t) => ({ id: String(t.id), name: t.name, shortName: t.acronym ?? t.name.slice(0, 4).toUpperCase() }));
  }

  async listPlayers(tournamentId: string): Promise<Omit<Player, 'price'>[]> {
    const { rosters } = await this.get(`/tournaments/${encodeURIComponent(tournamentId)}/rosters`, PsRosters);
    return rosters.flatMap((t) =>
      t.players.map((p) => ({
        id: String(p.id),
        nickname: p.name,
        teamId: String(t.id),
        teamShortName: t.acronym ?? t.name.slice(0, 4).toUpperCase(),
        country: p.nationality ?? undefined,
      })),
    );
  }

  async listMatches(tournamentId: string): Promise<Match[]> {
    const list = await this.get(
      `/csgo/matches?filter[tournament_id]=${encodeURIComponent(tournamentId)}&per_page=100`,
      z.array(PsMatch),
    );
    return list
      .filter((m) => m.opponents.length === 2)
      .map((m) => {
        const [a, b] = m.opponents.map((o) => o.opponent) as [z.infer<typeof PsTeam>, z.infer<typeof PsTeam>];
        const score = (id: number) => m.results.find((r) => r.team_id === id)?.score ?? 0;
        const bo = m.number_of_games;
        return {
          id: String(m.id),
          tournamentId: String(m.tournament_id),
          teamAId: String(a.id),
          teamBId: String(b.id),
          teamAShortName: a.acronym ?? a.name,
          teamBShortName: b.acronym ?? b.name,
          scoreA: score(a.id),
          scoreB: score(b.id),
          bestOf: bo === 5 ? 5 : bo === 1 ? 1 : 3,
          startsAt: m.begin_at ?? new Date().toISOString(),
          status: mapStatus(m.status),
        };
      });
  }

  /** Requer plano Historical. Conferir campos com respostas reais (ver comentário no topo). */
  async listMapStats(tournamentId: string): Promise<PlayerMapStats[]> {
    const matches = (await this.listMatches(tournamentId)).filter((m) => m.status === 'finished');
    const out: PlayerMapStats[] = [];
    for (const match of matches) {
      const games = await this.get(`/csgo/matches/${match.id}/games`, z.array(PsGame));
      const winnerSeries = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
      const lastPosition = Math.max(...games.map((g) => g.position));
      for (const g of games.filter((x) => x.status === 'finished')) {
        const rounds = (g.rounds_score ?? []).reduce((acc, r) => acc + r.score, 0);
        for (const p of g.players) {
          const teamId = p.team ? String(p.team.id) : '';
          const mapWon = g.winner?.id != null && String(g.winner.id) === teamId;
          out.push({
            playerId: String(p.player.id),
            matchId: match.id,
            mapNumber: g.position,
            roundsPlayed: rounds,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            headshots: p.headshots,
            firstKills: p.first_kills,
            awpKills: 0, // não exposto neste nível; disponível no feed ao vivo
            flashAssists: p.flash_assists,
            multiKills: { k3: 0, k4: 0, k5: 0 }, // idem: calcular a partir de eventos (plano Live)
            clutchesWon: { v1: 0, v2: 0, v3: 0, v4: 0, v5: 0 },
            adr: p.adr,
            kast: p.kast,
            mapWon,
            seriesWon: g.position === lastPosition && teamId === winnerSeries,
          });
        }
      }
    }
    return out;
  }

  async recentAverages(playerIds: string[]): Promise<Record<string, number>> {
    // Simplificação: sem histórico suficiente, todos começam com a mesma média.
    // Em produção: média de pontos dos últimos N mapas, gravada pelo job de sync.
    return Object.fromEntries(playerIds.map((id) => [id, 25]));
  }
}
