import type { Match, MatchStatus, Player, PlayerMapStats, Team, Tournament } from '@5tack/core';
import { z } from 'zod';
import type { DataProvider } from './DataProvider';

/**
 * Implementação real usando Cito API (esports data).
 * Acesso a dados reais de CS2: torneios, times, jogadores, matches e stats.
 * Token guardado em CITO_API_KEY do .env
 */

const BASE_URL = 'https://api.citoapi.com/api/v1';
const TIMEOUT_MS = 10_000;

const CitoTournament = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  tier: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: z.string(),
});

const CitoTeam = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  imageUrl: z.string().nullable().optional(),
});

const CitoPlayer = z.object({
  id: z.string(),
  name: z.string(),
  playerSlug: z.string(),
  countryCode: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
});

const CitoMatch = z.object({
  id: z.string(),
  status: z.string(),
  startTime: z.string(),
  teamA: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  teamB: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  scoreA: z.number().nullable(),
  scoreB: z.number().nullable(),
  bestOf: z.number(),
});

export class CitoProvider implements DataProvider {
  readonly name = 'cito';

  constructor(private readonly token: string) {}

  private async get<S extends z.ZodTypeAny>(path: string, schema: S, query?: Record<string, string | number>): Promise<z.output<S>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = new URL(`${BASE_URL}${path}`);
      if (query) {
        Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      }
      console.log(`[Cito] GET ${url.toString()}`);
      const res = await fetch(url.toString(), {
        headers: { 'x-api-key': this.token, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[Cito] ${res.status} em ${path}: ${text}`);
        throw new Error(`Cito ${res.status} em ${path}`);
      }
      const json = await res.json();
      console.log(`[Cito] Resposta: ${JSON.stringify(json).substring(0, 200)}...`);
      const data = json.data ?? json;
      return schema.parse(data);
    } finally {
      clearTimeout(timer);
    }
  }

  async listTournaments(): Promise<Tournament[]> {
    try {
      console.log('[Cito] Buscando torneios em /cs2/tournaments/upcoming...');
      const data = await this.get('/cs2/tournaments/upcoming', z.array(z.object({
        eventId: z.string(),
        name: z.string(),
        tier: z.string().nullable().optional(),
        startsAt: z.string(),
        endsAt: z.string(),
        location: z.string().nullable().optional(),
      })), { limit: 50 });
      console.log(`[Cito] Recebidos ${data.length} torneios`);
      const now = Date.now();
      return data.map((t) => {
        const start = new Date(t.startsAt).toISOString();
        const tier = (t.tier ?? 'B').toUpperCase().slice(0, 1);
        console.log(`[Cito] Processando: ${t.name} (tier: ${tier}, status: ${new Date(start).getTime() > now ? 'upcoming' : 'running'})`);
        return {
          id: t.eventId,
          name: t.name,
          tier: tier === 'S' || tier === 'A' ? (tier as 'S' | 'A') : 'B',
          startsAt: start,
          endsAt: new Date(t.endsAt).toISOString(),
          lockAt: start,
          status: new Date(start).getTime() > now ? 'upcoming' : 'running',
          budget: 1_000_000,
          location: t.location ?? undefined,
        } satisfies Tournament;
      });
    } catch (err) {
      console.error('[Cito] Erro ao listar torneios:', (err as Error).message, (err as Error).stack);
      return [];
    }
  }

  async listTeams(tournamentId: string): Promise<Team[]> {
    try {
      const data = await this.get(`/cs2/tournaments/${tournamentId}/teams`, z.object({
        teams: z.array(z.object({
          id: z.string(),
          name: z.string(),
        })).optional(),
      }), { limit: 50 });
      return (data.teams || []).map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.name.slice(0, 6).toUpperCase(),
      }));
    } catch (err) {
      console.error(`[Cito] Erro ao listar times:`, (err as Error).message, (err as Error).stack);
      return [];
    }
  }

  async listPlayers(tournamentId: string): Promise<Omit<Player, 'price'>[]> {
    try {
      console.log(`[Cito] Buscando jogadores para torneio ${tournamentId}...`);
      const teams = await this.listTeams(tournamentId);
      console.log(`[Cito] Encontrados ${teams.length} times`);
      const teamIds = new Set(teams.map(t => t.id));

      // Primeiro tenta rosters dos times
      const allPlayers: Omit<Player, 'price'>[] = [];

      for (const team of teams) {
        try {
          const teamData = await this.get(`/cs2/teams/${team.id}`, z.object({
            roster: z.array(z.object({
              id: z.string(),
              name: z.string(),
              countryCode: z.string().nullable().optional(),
            })).optional(),
          }));

          const roster = teamData.roster || [];
          console.log(`[Cito] Time ${team.name}: ${roster.length} jogadores no roster`);

          allPlayers.push(
            ...roster.map((p) => ({
              id: p.id,
              nickname: p.name,
              teamId: team.id,
              teamShortName: team.shortName,
              country: p.countryCode ?? undefined,
            }))
          );
        } catch (e) {
          console.warn(`[Cito] Erro ao carregar roster de ${team.name}:`, (e as Error).message);
        }
      }

      // Se nenhum time tem roster, busca players globais e filtra pelos times do torneio
      if (allPlayers.length === 0 && teams.length > 0) {
        console.log(`[Cito] Nenhum roster encontrado, buscando players globais...`);
        console.log(`[Cito] Times do torneio IDs: ${Array.from(teamIds).join(', ')}`);
        try {
          const globalPlayers = await this.get('/cs2/players', z.array(z.object({
            id: z.string(),
            nickname: z.string(),
            countryCode: z.string().nullable().optional(),
            currentTeamId: z.string().nullable().optional(),
          })), { limit: 1000 });

          console.log(`[Cito] Encontrados ${globalPlayers.length} players globais`);

          // Debug: mostra alguns currentTeamIds
          const sampleTeamIds = globalPlayers.slice(0, 10).map(p => p.currentTeamId).join(', ');
          console.log(`[Cito] Sample de currentTeamIds: ${sampleTeamIds}`);

          // Filtra APENAS players que jogam em times do torneio
          const playersInTournament = globalPlayers.filter(p => p.currentTeamId && teamIds.has(p.currentTeamId));
          console.log(`[Cito] ${playersInTournament.length} players encontrados nos times do torneio`);

          for (const player of playersInTournament) {
            const teamId = player.currentTeamId!;
            const team = teams.find(t => t.id === teamId);
            if (team) {
              allPlayers.push({
                id: player.id,
                nickname: player.nickname,
                teamId: teamId,
                teamShortName: team.shortName,
                country: player.countryCode ?? undefined,
              });
            }
          }
        } catch (e) {
          console.error(`[Cito] Erro ao buscar players globais:`, (e as Error).message);
        }
      }

      console.log(`[Cito] Total de ${allPlayers.length} jogadores encontrados para o torneio`);
      return allPlayers;
    } catch (err) {
      console.error(`[Cito] Erro ao listar players:`, (err as Error).message, (err as Error).stack);
      return [];
    }
  }

  async listMatches(tournamentId: string): Promise<Match[]> {
    try {
      const data = await this.get(`/cs2/tournaments/${tournamentId}/matches`, z.array(z.object({
        id: z.string(),
        status: z.string(),
        startTime: z.string(),
        teams: z.array(z.object({ id: z.string(), slug: z.string() })).optional(),
        scores: z.array(z.number()).optional(),
        bestOf: z.number().optional(),
      })), { limit: 100 });
      return data.map((m) => {
        const teams = m.teams || [];
        const scores = m.scores || [0, 0];
        return {
          id: m.id,
          tournamentId,
          teamAId: teams[0]?.id || 'unknown',
          teamBId: teams[1]?.id || 'unknown',
          teamAShortName: teams[0]?.slug.toUpperCase() || 'TBA',
          teamBShortName: teams[1]?.slug.toUpperCase() || 'TBA',
          scoreA: scores[0] ?? 0,
          scoreB: scores[1] ?? 0,
          bestOf: m.bestOf === 5 ? 5 : m.bestOf === 1 ? 1 : 3,
          startsAt: m.startTime,
          status: (['live', 'running'].includes(m.status) ? 'live' : m.status === 'finished' ? 'finished' : 'scheduled') as MatchStatus,
        };
      });
    } catch (err) {
      console.log('[Cito] Erro ao listar matches:', (err as Error).message);
      return [];
    }
  }

  async listMapStats(tournamentId: string): Promise<PlayerMapStats[]> {
    // Cito fornece stats via /cs2/matches/{id}/stats
    // Por enquanto, retorna vazio (requer integração map-level)
    return [];
  }

  async recentAverages(playerIds: string[]): Promise<Record<string, number>> {
    if (playerIds.length === 0) return {};

    const averages: Record<string, number> = {};

    for (const playerId of playerIds) {
      try {
        // Pega stats do jogador (últimos 10 matches)
        const data = await this.get(
          `/cs2/players/${playerId}/stats`,
          z.array(z.object({
            kills: z.number().optional(),
            deaths: z.number().optional(),
            assists: z.number().optional(),
            adr: z.number().optional(),
            kast: z.number().optional(),
            roundsPlayed: z.number().optional(),
          }).nullable()),
          { limit: 10 }
        );

        const validStats = data.filter((s): s is NonNullable<typeof data[0]> => s !== null);

        if (validStats.length === 0) {
          averages[playerId] = 20;
          continue;
        }

        let totalScore = 0;
        for (const s of validStats) {
          const roundsPlayed = s.roundsPlayed || 16;
          const kpr = s.kills ? s.kills / roundsPlayed : 0;
          const score = kpr * 10 + (s.kast || 0) / 10 + (s.adr || 0) / 50;
          totalScore += score;
        }
        averages[playerId] = totalScore / validStats.length;
        console.log(`[Cito] ${playerId}: ${validStats.length} mapas, score ${(totalScore / validStats.length).toFixed(2)}`);
      } catch (err) {
        console.log(`[Cito] Erro ao buscar stats de ${playerId}:`, (err as Error).message);
        averages[playerId] = 20;
      }
    }

    return averages;
  }
}
