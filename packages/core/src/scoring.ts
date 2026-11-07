import type { Booster, FantasyRole, LineupPick, PlayerMapStats } from './types';

/**
 * Motor de pontuação do 5TACK.
 * Funções puras e versionadas: a mesma entrada sempre gera a mesma saída,
 * o que permite recalcular o histórico se a fórmula mudar.
 */

export const SCORING_VERSION = 'v1';

export interface ScoringRules {
  version: string;
  kill: number;
  assist: number;
  death: number;
  headshot: number;
  firstKill: number;
  k3: number;
  k4: number;
  k5: number;
  /** Pontos por inimigo no clutch: 1v2 vencido = 2 × clutchPerEnemy. */
  clutchPerEnemy: number;
  adrBonus: { threshold: number; points: number };
  kastBonus: { threshold: number; points: number };
  mapWon: number;
  seriesWon: number;
  roles: {
    ENTRY: { perFirstKill: number };
    SNIPER: { perAwpKill: number };
    CLUTCHER: { perClutch: number };
    SUPPORT: { perFlashAssist: number; kastThreshold: number; kastPoints: number };
    STAR: { multiplier: number };
  };
  boosters: {
    ACE_HUNTER: { perAce: number; perQuad: number };
    HEADSHOT_MACHINE: { minHsRatio: number; points: number };
    FLASH_MASTER: { perFlashAssist: number };
    IRON_WALL: { maxDeathsPerRound: number; points: number };
  };
}

export const DEFAULT_RULES: ScoringRules = {
  version: SCORING_VERSION,
  kill: 1.5,
  assist: 1,
  death: -1,
  headshot: 0.25,
  firstKill: 1,
  k3: 3,
  k4: 4,
  k5: 5,
  clutchPerEnemy: 2,
  adrBonus: { threshold: 100, points: 3 },
  kastBonus: { threshold: 80, points: 2 },
  mapWon: 2,
  seriesWon: 3,
  roles: {
    ENTRY: { perFirstKill: 1.5 },
    SNIPER: { perAwpKill: 0.5 },
    CLUTCHER: { perClutch: 2 },
    SUPPORT: { perFlashAssist: 1, kastThreshold: 75, kastPoints: 2 },
    STAR: { multiplier: 1.25 },
  },
  boosters: {
    ACE_HUNTER: { perAce: 5, perQuad: 2 },
    HEADSHOT_MACHINE: { minHsRatio: 0.6, points: 4 },
    FLASH_MASTER: { perFlashAssist: 1 },
    IRON_WALL: { maxDeathsPerRound: 0.55, points: 4 },
  },
};

/** Códigos estáveis; a UI traduz para texto. */
export type ScoreItemCode =
  | 'KILLS'
  | 'ASSISTS'
  | 'DEATHS'
  | 'HEADSHOTS'
  | 'FIRST_KILLS'
  | 'MULTI_KILLS'
  | 'CLUTCHES'
  | 'ADR_BONUS'
  | 'KAST_BONUS'
  | 'MAP_WON'
  | 'SERIES_WON'
  | `ROLE_${FantasyRole}`
  | `BOOSTER_${Booster}`;

export interface ScoreItem {
  code: ScoreItemCode;
  points: number;
}

export interface ScoreBreakdown {
  total: number;
  items: ScoreItem[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function sum(items: ScoreItem[]): number {
  return round2(items.reduce((acc, i) => acc + i.points, 0));
}

function compact(items: ScoreItem[]): ScoreItem[] {
  return items.filter((i) => i.points !== 0).map((i) => ({ ...i, points: round2(i.points) }));
}

/** Pontos-base de um jogador em um mapa, sem função nem booster. */
export function scoreMapBase(s: PlayerMapStats, r: ScoringRules = DEFAULT_RULES): ScoreBreakdown {
  const clutchEnemies =
    s.clutchesWon.v1 * 1 + s.clutchesWon.v2 * 2 + s.clutchesWon.v3 * 3 + s.clutchesWon.v4 * 4 + s.clutchesWon.v5 * 5;

  const items = compact([
    { code: 'KILLS', points: s.kills * r.kill },
    { code: 'ASSISTS', points: s.assists * r.assist },
    { code: 'DEATHS', points: s.deaths * r.death },
    { code: 'HEADSHOTS', points: s.headshots * r.headshot },
    { code: 'FIRST_KILLS', points: s.firstKills * r.firstKill },
    { code: 'MULTI_KILLS', points: s.multiKills.k3 * r.k3 + s.multiKills.k4 * r.k4 + s.multiKills.k5 * r.k5 },
    { code: 'CLUTCHES', points: clutchEnemies * r.clutchPerEnemy },
    { code: 'ADR_BONUS', points: s.adr >= r.adrBonus.threshold ? r.adrBonus.points : 0 },
    { code: 'KAST_BONUS', points: s.kast >= r.kastBonus.threshold ? r.kastBonus.points : 0 },
    { code: 'MAP_WON', points: s.mapWon ? r.mapWon : 0 },
    { code: 'SERIES_WON', points: s.seriesWon ? r.seriesWon : 0 },
  ]);
  return { total: sum(items), items };
}

/** Bônus da função escolhida pelo usuário. STAR multiplica os pontos-base. */
export function roleBonus(role: FantasyRole, s: PlayerMapStats, basePoints: number, r: ScoringRules = DEFAULT_RULES): number {
  const totalClutches = s.clutchesWon.v1 + s.clutchesWon.v2 + s.clutchesWon.v3 + s.clutchesWon.v4 + s.clutchesWon.v5;
  switch (role) {
    case 'ENTRY':
      return s.firstKills * r.roles.ENTRY.perFirstKill;
    case 'SNIPER':
      return s.awpKills * r.roles.SNIPER.perAwpKill;
    case 'CLUTCHER':
      return totalClutches * r.roles.CLUTCHER.perClutch;
    case 'SUPPORT':
      return (
        s.flashAssists * r.roles.SUPPORT.perFlashAssist +
        (s.kast >= r.roles.SUPPORT.kastThreshold ? r.roles.SUPPORT.kastPoints : 0)
      );
    case 'STAR':
      // Só multiplica pontos positivos: um mapa ruim não é punido em dobro.
      return basePoints > 0 ? basePoints * (r.roles.STAR.multiplier - 1) : 0;
  }
}

/** Bônus de booster. Boosters nunca tiram pontos. */
export function boosterBonus(booster: Booster, s: PlayerMapStats, r: ScoringRules = DEFAULT_RULES): number {
  switch (booster) {
    case 'ACE_HUNTER':
      return s.multiKills.k5 * r.boosters.ACE_HUNTER.perAce + s.multiKills.k4 * r.boosters.ACE_HUNTER.perQuad;
    case 'HEADSHOT_MACHINE':
      return s.kills > 0 && s.headshots / s.kills >= r.boosters.HEADSHOT_MACHINE.minHsRatio
        ? r.boosters.HEADSHOT_MACHINE.points
        : 0;
    case 'FLASH_MASTER':
      return s.flashAssists * r.boosters.FLASH_MASTER.perFlashAssist;
    case 'IRON_WALL':
      return s.roundsPlayed > 0 && s.deaths / s.roundsPlayed <= r.boosters.IRON_WALL.maxDeathsPerRound
        ? r.boosters.IRON_WALL.points
        : 0;
  }
}

/** Pontuação completa de um jogador escalado em um mapa. */
export function scorePickOnMap(
  pick: LineupPick,
  s: PlayerMapStats,
  booster?: Booster,
  r: ScoringRules = DEFAULT_RULES,
): ScoreBreakdown {
  const base = scoreMapBase(s, r);
  const extra = compact([
    { code: `ROLE_${pick.role}`, points: roleBonus(pick.role, s, base.total, r) },
    ...(booster ? [{ code: `BOOSTER_${booster}` as const, points: boosterBonus(booster, s, r) }] : []),
  ]);
  const items = [...base.items, ...extra];
  return { total: sum(items), items };
}

/** Soma vários breakdowns (ex.: todos os mapas de um torneio) agrupando por código. */
export function mergeBreakdowns(list: ScoreBreakdown[]): ScoreBreakdown {
  const byCode = new Map<ScoreItemCode, number>();
  for (const b of list) for (const i of b.items) byCode.set(i.code, (byCode.get(i.code) ?? 0) + i.points);
  const items = compact([...byCode.entries()].map(([code, points]) => ({ code, points })));
  return { total: sum(items), items };
}
