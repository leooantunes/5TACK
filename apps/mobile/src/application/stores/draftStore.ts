import { create } from 'zustand';
import {
  FANTASY_ROLES,
  canAddPlayer,
  isLocked,
  lineupCost,
  validateLineup,
  type DraftError,
  type FantasyRole,
  type LineupPick,
  type Player,
  type Tournament,
} from '../../domain';
import { gateways } from '../ports';

/**
 * Caso de uso de DRAFT (montar o time).
 * Toda regra vem do domínio compartilhado: a tela mostra o resultado, não decide nada.
 * O servidor revalida tudo ao salvar — a checagem aqui é só para feedback imediato.
 */

interface DraftState {
  tournament: Tournament | null;
  players: Player[];
  picks: LineupPick[];
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  loadError: string | null;

  load(tournamentId: string): Promise<void>;
  /** Adiciona ou remove. Retorna o erro de regra, se a adição não for permitida. */
  toggle(player: Player): DraftError | null;
  /** Gira a função do jogador; quem tinha a função nova recebe a antiga (troca). */
  cycleRole(playerId: string): void;
  clear(): void;
  save(): Promise<{ ok: true } | { ok: false; errors: DraftError[] | string }>;
}

export const useDraft = create<DraftState>((set, get) => ({
  tournament: null,
  players: [],
  picks: [],
  loading: false,
  saving: false,
  dirty: false,
  loadError: null,

  async load(tournamentId) {
    set({ loading: true, loadError: null });
    try {
      const g = gateways();
      const [tournament, players, mine] = await Promise.all([
        g.tournaments.get(tournamentId),
        g.tournaments.players(tournamentId),
        g.lineups.getMine(tournamentId).catch(() => null),
      ]);
      set({ tournament, players, picks: mine?.picks ?? [], dirty: false, loading: false });
    } catch (e) {
      set({ loading: false, loadError: e instanceof Error ? e.message : 'Erro ao carregar' });
    }
  },

  toggle(player) {
    const { tournament, picks, players } = get();
    if (!tournament) return null;
    if (picks.some((p) => p.playerId === player.id)) {
      set({ picks: picks.filter((p) => p.playerId !== player.id), dirty: true });
      return null;
    }
    const check = canAddPlayer(tournament, picks, player, byId(players));
    if (!check.ok) return check.errors[0] ?? null;
    const used = new Set(picks.map((p) => p.role));
    const role = FANTASY_ROLES.find((r) => !used.has(r)) ?? 'SUPPORT';
    set({ picks: [...picks, { playerId: player.id, role }], dirty: true });
    return null;
  },

  cycleRole(playerId) {
    const { picks } = get();
    const pick = picks.find((p) => p.playerId === playerId);
    if (!pick) return;
    const next = FANTASY_ROLES[(FANTASY_ROLES.indexOf(pick.role) + 1) % FANTASY_ROLES.length] as FantasyRole;
    set({
      dirty: true,
      picks: picks.map((p) => {
        if (p.playerId === playerId) return { ...p, role: next };
        if (p.role === next) return { ...p, role: pick.role };
        return p;
      }),
    });
  },

  clear() {
    set({ picks: [], dirty: true });
  },

  async save() {
    const { tournament, picks, players } = get();
    if (!tournament) return { ok: false, errors: 'Torneio não carregado' };
    const local = validateLineup(tournament, picks, byId(players), new Date());
    if (!local.ok) return { ok: false, errors: local.errors };
    set({ saving: true });
    try {
      const saved = await gateways().lineups.save(tournament.id, picks);
      set({ picks: saved.picks, saving: false, dirty: false });
      return { ok: true };
    } catch (e) {
      set({ saving: false });
      const details = (e as { details?: unknown }).details;
      if (Array.isArray(details)) return { ok: false, errors: details as DraftError[] };
      return { ok: false, errors: e instanceof Error ? e.message : 'Erro ao salvar' };
    }
  },
}));

const byId = (players: Player[]) => new Map(players.map((p) => [p.id, p]));

/** Seletores derivados (puros) usados pela UI. */
export const draftSelectors = {
  cost: (s: Pick<DraftState, 'picks' | 'players'>) => lineupCost(s.picks, byId(s.players)),
  remaining: (s: Pick<DraftState, 'picks' | 'players' | 'tournament'>) =>
    (s.tournament?.budget ?? 0) - lineupCost(s.picks, byId(s.players)),
  locked: (s: Pick<DraftState, 'tournament'>) => (s.tournament ? isLocked(s.tournament, new Date()) : true),
  pickedPlayers: (s: Pick<DraftState, 'picks' | 'players'>) => {
    const map = byId(s.players);
    return s.picks.map((p) => ({ pick: p, player: map.get(p.playerId) })).filter((x): x is { pick: LineupPick; player: Player } => !!x.player);
  },
  isComplete: (s: Pick<DraftState, 'picks'>) => s.picks.length === 5,
};
