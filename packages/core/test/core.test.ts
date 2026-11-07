import { describe, expect, it } from 'vitest';
import {
  canAddPlayer,
  mergeBreakdowns,
  priceFromAverages,
  scoreMapBase,
  scorePickOnMap,
  validateLineup,
  type Player,
  type PlayerMapStats,
  type Tournament,
} from '../src';

const stats = (over: Partial<PlayerMapStats> = {}): PlayerMapStats => ({
  playerId: 'p1',
  matchId: 'm1',
  mapNumber: 1,
  roundsPlayed: 24,
  kills: 20,
  deaths: 15,
  assists: 4,
  headshots: 10,
  firstKills: 3,
  awpKills: 0,
  flashAssists: 2,
  multiKills: { k3: 1, k4: 0, k5: 0 },
  clutchesWon: { v1: 1, v2: 0, v3: 0, v4: 0, v5: 0 },
  adr: 85,
  kast: 72,
  mapWon: true,
  seriesWon: false,
  ...over,
});

describe('scoring', () => {
  it('calcula os pontos-base de um mapa', () => {
    // 20*1.5 + 4*1 - 15 + 10*0.25 + 3*1 + 3 (3K) + 2 (1v1) + 2 (mapa) = 31.5
    expect(scoreMapBase(stats()).total).toBe(31.5);
  });

  it('dá bônus de ADR e KAST quando atingem o limite', () => {
    const b = scoreMapBase(stats({ adr: 110, kast: 85 }));
    expect(b.items.find((i) => i.code === 'ADR_BONUS')?.points).toBe(3);
    expect(b.items.find((i) => i.code === 'KAST_BONUS')?.points).toBe(2);
  });

  it('STAR multiplica pontos positivos e não amplia pontos negativos', () => {
    const good = scorePickOnMap({ playerId: 'p1', role: 'STAR' }, stats());
    expect(good.total).toBe(39.38); // 31.5 * 1.25 = 39.375 → arredondado
    const bad = scorePickOnMap({ playerId: 'p1', role: 'STAR' }, stats({ kills: 2, deaths: 20, mapWon: false }));
    expect(bad.items.some((i) => i.code === 'ROLE_STAR')).toBe(false);
  });

  it('booster nunca subtrai pontos', () => {
    const s = stats({ multiKills: { k3: 0, k4: 0, k5: 0 } });
    const withBooster = scorePickOnMap({ playerId: 'p1', role: 'SUPPORT' }, s, 'ACE_HUNTER');
    const without = scorePickOnMap({ playerId: 'p1', role: 'SUPPORT' }, s);
    expect(withBooster.total).toBe(without.total);
  });

  it('HEADSHOT_MACHINE ativa com 60%+ de HS', () => {
    const r = scorePickOnMap({ playerId: 'p1', role: 'ENTRY' }, stats({ headshots: 14 }), 'HEADSHOT_MACHINE');
    expect(r.items.find((i) => i.code === 'BOOSTER_HEADSHOT_MACHINE')?.points).toBe(4);
  });

  it('agrega vários mapas por código', () => {
    const a = scoreMapBase(stats());
    const merged = mergeBreakdowns([a, a]);
    expect(merged.total).toBe(63);
  });
});

const tournament = (over: Partial<Tournament> = {}): Tournament => ({
  id: 't1',
  name: 'Test Major',
  tier: 'S',
  startsAt: '2030-01-01T00:00:00Z',
  endsAt: '2030-01-10T00:00:00Z',
  lockAt: '2030-01-01T00:00:00Z',
  status: 'upcoming',
  budget: 1_000_000,
  ...over,
});

const mkPlayers = (): Map<string, Player> => {
  const list: Player[] = [
    { id: 'a1', nickname: 'A1', teamId: 'A', teamShortName: 'A', price: 200_000 },
    { id: 'a2', nickname: 'A2', teamId: 'A', teamShortName: 'A', price: 200_000 },
    { id: 'a3', nickname: 'A3', teamId: 'A', teamShortName: 'A', price: 150_000 },
    { id: 'b1', nickname: 'B1', teamId: 'B', teamShortName: 'B', price: 200_000 },
    { id: 'c1', nickname: 'C1', teamId: 'C', teamShortName: 'C', price: 200_000 },
    { id: 'd1', nickname: 'D1', teamId: 'D', teamShortName: 'D', price: 180_000 },
    { id: 'e1', nickname: 'E1', teamId: 'E', teamShortName: 'E', price: 320_000 },
  ];
  return new Map(list.map((p) => [p.id, p]));
};

const before = new Date('2029-12-31T00:00:00Z');

describe('draft', () => {
  const valid = [
    { playerId: 'a1', role: 'STAR' as const },
    { playerId: 'a2', role: 'ENTRY' as const },
    { playerId: 'b1', role: 'SNIPER' as const },
    { playerId: 'c1', role: 'CLUTCHER' as const },
    { playerId: 'd1', role: 'SUPPORT' as const },
  ];

  it('aceita um lineup válido', () => {
    expect(validateLineup(tournament(), valid, mkPlayers(), before).ok).toBe(true);
  });

  it('rejeita depois do lock', () => {
    const r = validateLineup(tournament(), valid, mkPlayers(), new Date('2030-01-02T00:00:00Z'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain('LOCKED');
  });

  it('rejeita mais de 2 jogadores do mesmo time', () => {
    const picks = [...valid.slice(0, 4), { playerId: 'a3', role: 'SUPPORT' as const }];
    const r = validateLineup(tournament(), picks, mkPlayers(), before);
    expect(!r.ok && r.errors.some((e) => e.code === 'TOO_MANY_FROM_TEAM')).toBe(true);
  });

  it('rejeita função repetida e estouro de orçamento', () => {
    const picks = [...valid.slice(0, 4), { playerId: 'e1', role: 'STAR' as const }];
    const r = validateLineup(tournament(), picks, mkPlayers(), before);
    const codes = r.ok ? [] : r.errors.map((e) => e.code);
    expect(codes).toContain('DUPLICATE_ROLE');
    expect(codes).toContain('OVER_BUDGET');
  });

  it('rejeita jogador inexistente (cliente adulterado)', () => {
    const picks = [...valid.slice(0, 4), { playerId: 'hacker', role: 'SUPPORT' as const }];
    const r = validateLineup(tournament(), picks, mkPlayers(), before);
    expect(!r.ok && r.errors.some((e) => e.code === 'UNKNOWN_PLAYER')).toBe(true);
  });

  it('canAddPlayer bloqueia o 3º jogador do mesmo time', () => {
    const players = mkPlayers();
    const r = canAddPlayer(tournament(), valid.slice(0, 2), players.get('a3')!, players);
    expect(r.ok).toBe(false);
  });
});

describe('pricing', () => {
  it('interpola entre min e max', () => {
    const p = priceFromAverages({ x: 10, y: 20, z: 30 });
    expect(p.x).toBe(120_000);
    expect(p.z).toBe(320_000);
    expect(p.y).toBe(220_000);
  });
});
