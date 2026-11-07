import { fail, ok, type Result } from './result';
import { FANTASY_ROLES, type Id, type LineupPick, type Player, type Tournament } from './types';

export interface DraftRules {
  squadSize: number;
  maxPerTeam: number;
  /** Cada função deve ser usada exatamente uma vez (5 jogadores, 5 funções). */
  uniqueRoles: boolean;
}

export const DEFAULT_DRAFT_RULES: DraftRules = {
  squadSize: 5,
  maxPerTeam: 2,
  uniqueRoles: true,
};

export type DraftError =
  | { code: 'LOCKED' }
  | { code: 'WRONG_SIZE'; expected: number; actual: number }
  | { code: 'DUPLICATE_PLAYER'; playerId: Id }
  | { code: 'UNKNOWN_PLAYER'; playerId: Id }
  | { code: 'OVER_BUDGET'; budget: number; cost: number }
  | { code: 'TOO_MANY_FROM_TEAM'; teamId: Id; max: number }
  | { code: 'DUPLICATE_ROLE'; role: string }
  | { code: 'INVALID_ROLE'; role: string };

export function isLocked(t: Tournament, now: Date): boolean {
  return now.getTime() >= new Date(t.lockAt).getTime();
}

export function lineupCost(picks: LineupPick[], players: Map<Id, Player>): number {
  return picks.reduce((acc, p) => acc + (players.get(p.playerId)?.price ?? 0), 0);
}

export function remainingBudget(t: Tournament, picks: LineupPick[], players: Map<Id, Player>): number {
  return t.budget - lineupCost(picks, players);
}

/**
 * Valida um lineup completo. A MESMA função roda no app (feedback imediato)
 * e no servidor (fonte da verdade) — o servidor nunca confia no cliente.
 * `now` é injetado para a regra ser testável e para o servidor usar o próprio relógio.
 */
export function validateLineup(
  tournament: Tournament,
  picks: LineupPick[],
  players: Map<Id, Player>,
  now: Date,
  rules: DraftRules = DEFAULT_DRAFT_RULES,
): Result<LineupPick[], DraftError> {
  const errors: DraftError[] = [];

  if (isLocked(tournament, now)) errors.push({ code: 'LOCKED' });

  if (picks.length !== rules.squadSize) {
    errors.push({ code: 'WRONG_SIZE', expected: rules.squadSize, actual: picks.length });
  }

  const seenPlayers = new Set<Id>();
  const seenRoles = new Set<string>();
  const perTeam = new Map<Id, number>();

  for (const pick of picks) {
    if (seenPlayers.has(pick.playerId)) errors.push({ code: 'DUPLICATE_PLAYER', playerId: pick.playerId });
    seenPlayers.add(pick.playerId);

    if (!(FANTASY_ROLES as readonly string[]).includes(pick.role)) {
      errors.push({ code: 'INVALID_ROLE', role: String(pick.role) });
    } else if (rules.uniqueRoles) {
      if (seenRoles.has(pick.role)) errors.push({ code: 'DUPLICATE_ROLE', role: pick.role });
      seenRoles.add(pick.role);
    }

    const player = players.get(pick.playerId);
    if (!player) {
      errors.push({ code: 'UNKNOWN_PLAYER', playerId: pick.playerId });
      continue;
    }
    perTeam.set(player.teamId, (perTeam.get(player.teamId) ?? 0) + 1);
  }

  for (const [teamId, count] of perTeam) {
    if (count > rules.maxPerTeam) errors.push({ code: 'TOO_MANY_FROM_TEAM', teamId, max: rules.maxPerTeam });
  }

  const cost = lineupCost(picks, players);
  if (cost > tournament.budget) errors.push({ code: 'OVER_BUDGET', budget: tournament.budget, cost });

  return errors.length ? fail(errors) : ok(picks);
}

/**
 * Checagem incremental usada pela UI enquanto o usuário monta o time:
 * diz se dá para adicionar mais um jogador sem quebrar orçamento/limite por time.
 */
export function canAddPlayer(
  tournament: Tournament,
  picks: LineupPick[],
  candidate: Player,
  players: Map<Id, Player>,
  rules: DraftRules = DEFAULT_DRAFT_RULES,
): Result<true, DraftError> {
  if (picks.some((p) => p.playerId === candidate.id)) return fail([{ code: 'DUPLICATE_PLAYER', playerId: candidate.id }]);
  if (picks.length >= rules.squadSize) {
    return fail([{ code: 'WRONG_SIZE', expected: rules.squadSize, actual: picks.length + 1 }]);
  }
  const sameTeam = picks.filter((p) => players.get(p.playerId)?.teamId === candidate.teamId).length;
  if (sameTeam >= rules.maxPerTeam) {
    return fail([{ code: 'TOO_MANY_FROM_TEAM', teamId: candidate.teamId, max: rules.maxPerTeam }]);
  }
  const cost = lineupCost(picks, players) + candidate.price;
  if (cost > tournament.budget) return fail([{ code: 'OVER_BUDGET', budget: tournament.budget, cost }]);
  return ok(true);
}
