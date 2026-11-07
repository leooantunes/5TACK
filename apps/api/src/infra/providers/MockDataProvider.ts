import type { Match, Player, PlayerMapStats, Team, Tournament } from '@5tack/core';
import type { DataProvider } from './DataProvider';

/**
 * Dados FICTÍCIOS para desenvolvimento offline e demonstração.
 * Times e jogadores são inventados, para não atribuir estatísticas falsas a pessoas reais.
 */

const DAY = 24 * 60 * 60 * 1000;

const TEAMS: Team[] = [
  { id: 'nox', name: 'Nox Esports', shortName: 'NOX', country: 'BR' },
  { id: 'vlt', name: 'Voltage', shortName: 'VLT', country: 'DK' },
  { id: 'krk', name: 'Kraken Gaming', shortName: 'KRK', country: 'UA' },
  { id: 'ash', name: 'Ashfall', shortName: 'ASH', country: 'FR' },
  { id: 'grd', name: 'Gridlock', shortName: 'GRD', country: 'US' },
  { id: 'hlx', name: 'Helix', shortName: 'HLX', country: 'SE' },
];

const NICKS: Record<string, string[]> = {
  nox: ['tatu', 'brasa', 'jacaré', 'kaju', 'sertão'],
  vlt: ['ampere', 'surge', 'ohm', 'static', 'fuse'],
  krk: ['inkk', 'abyss', 'tide', 'sonar', 'reef'],
  ash: ['cinder', 'ember', 'soot', 'pyre', 'flint'],
  grd: ['jam', 'lane', 'merge', 'honk', 'detour'],
  hlx: ['twist', 'coil', 'strand', 'spiral', 'axis'],
};

/** PRNG determinístico: os mesmos dados a cada boot. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export class MockDataProvider implements DataProvider {
  readonly name = 'mock';
  private readonly now = Date.now();
  private readonly tournaments: Tournament[];
  private readonly players: Omit<Player, 'price'>[];
  private readonly matches: Match[];
  private readonly stats: PlayerMapStats[];

  constructor() {
    this.tournaments = [
      {
        id: 'mock-major',
        name: 'Major Rio Showdown',
        tier: 'S',
        startsAt: new Date(this.now + 2 * DAY).toISOString(),
        endsAt: new Date(this.now + 9 * DAY).toISOString(),
        lockAt: new Date(this.now + 2 * DAY).toISOString(),
        status: 'upcoming',
        budget: 1_000_000,
        location: 'Rio de Janeiro',
      },
      {
        id: 'mock-masters',
        name: 'Nordic Masters',
        tier: 'A',
        startsAt: new Date(this.now - 8 * DAY).toISOString(),
        endsAt: new Date(this.now - 2 * DAY).toISOString(),
        lockAt: new Date(this.now - 8 * DAY).toISOString(),
        status: 'finished',
        budget: 1_000_000,
        location: 'Estocolmo',
      },
    ];

    this.players = TEAMS.flatMap((t) =>
      (NICKS[t.id] ?? []).map((nick, i) => ({
        id: `${t.id}-${i}`,
        nickname: nick,
        teamId: t.id,
        teamShortName: t.shortName,
        country: t.country,
      })),
    );

    this.matches = [];
    this.stats = [];
    const pairs: [number, number][] = [[0, 1], [2, 3], [4, 5], [0, 2], [1, 3]];
    pairs.forEach(([a, b], idx) => {
      const ta = TEAMS[a]!;
      const tb = TEAMS[b]!;
      // Partidas do torneio futuro
      this.matches.push({
        id: `major-m${idx}`,
        tournamentId: 'mock-major',
        teamAId: ta.id,
        teamBId: tb.id,
        teamAShortName: ta.shortName,
        teamBShortName: tb.shortName,
        scoreA: 0,
        scoreB: 0,
        bestOf: 3,
        startsAt: new Date(this.now + (2 + idx * 0.5) * DAY).toISOString(),
        status: 'scheduled',
      });
      // Partidas finalizadas, com estatísticas
      const id = `masters-m${idx}`;
      const r = rng(idx + 7);
      const aWins = idx % 2 === 0; // alterna vencedores para a demo
      this.matches.push({
        id,
        tournamentId: 'mock-masters',
        teamAId: ta.id,
        teamBId: tb.id,
        teamAShortName: ta.shortName,
        teamBShortName: tb.shortName,
        scoreA: aWins ? 2 : 1,
        scoreB: aWins ? 1 : 2,
        bestOf: 3,
        startsAt: new Date(this.now - (7 - idx) * DAY).toISOString(),
        status: 'finished',
      });
      for (let map = 1; map <= 3; map++) {
        const mapWinnerIsA = map === 3 ? aWins : map === 1 ? aWins : !aWins;
        for (const team of [ta, tb]) {
          const won = team === ta ? mapWinnerIsA : !mapWinnerIsA;
          this.players
            .filter((p) => p.teamId === team.id)
            .forEach((p) => this.stats.push(this.fakeStats(p.id, id, map, won, map === 3 && won, r)));
        }
      }
    });
  }

  private fakeStats(playerId: string, matchId: string, map: number, won: boolean, seriesWon: boolean, r: () => number): PlayerMapStats {
    const rounds = 20 + Math.floor(r() * 10);
    const kills = Math.floor(10 + r() * 18 + (won ? 3 : 0));
    const deaths = Math.floor(10 + r() * 12 + (won ? 0 : 3));
    return {
      playerId,
      matchId,
      mapNumber: map,
      roundsPlayed: rounds,
      kills,
      deaths,
      assists: Math.floor(r() * 7),
      headshots: Math.floor(kills * (0.3 + r() * 0.4)),
      firstKills: Math.floor(r() * 5),
      awpKills: r() > 0.8 ? Math.floor(kills * 0.7) : 0,
      flashAssists: Math.floor(r() * 4),
      multiKills: { k3: Math.floor(r() * 3), k4: r() > 0.85 ? 1 : 0, k5: r() > 0.97 ? 1 : 0 },
      clutchesWon: { v1: r() > 0.7 ? 1 : 0, v2: r() > 0.9 ? 1 : 0, v3: 0, v4: 0, v5: 0 },
      adr: Math.round(55 + r() * 60),
      kast: Math.round(55 + r() * 35),
      mapWon: won,
      seriesWon,
    };
  }

  async listTournaments() {
    return this.tournaments;
  }
  async listTeams() {
    return TEAMS;
  }
  async listPlayers() {
    return this.players;
  }
  async listMatches(tournamentId: string) {
    return this.matches.filter((m) => m.tournamentId === tournamentId);
  }
  async listMapStats(tournamentId: string) {
    const ids = new Set(this.matches.filter((m) => m.tournamentId === tournamentId).map((m) => m.id));
    return this.stats.filter((s) => ids.has(s.matchId));
  }
  async recentAverages(playerIds: string[]) {
    const r = rng(42);
    // Estrelas fictícias: o 1º de cada time tende a pontuar mais.
    return Object.fromEntries(playerIds.map((id) => [id, 18 + r() * 14 + (id.endsWith('-0') ? 8 : 0)]));
  }
}
