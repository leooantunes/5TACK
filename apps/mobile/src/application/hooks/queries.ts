import type { LeaderboardEntry, LineupScore, Match, Player, SavedLineup, Tournament } from '../../domain';
import { gateways } from '../ports';
import { useSession } from '../stores/sessionStore';
import { useAsync } from './useAsync';

/** Consultas da aplicação. As telas usam estes hooks; nunca chamam gateways diretamente. */

export function useTournaments() {
  return useAsync<Tournament[]>(() => gateways().tournaments.list(), []);
}

export interface TournamentOverview {
  tournament: Tournament;
  matches: Match[];
  players: Player[];
  leaderboard: LeaderboardEntry[];
  myLineup: SavedLineup | null;
  myScore: LineupScore | null;
}

export function useTournamentOverview(id: string) {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useAsync<TournamentOverview>(async () => {
    const g = gateways();
    const [tournament, matches, players, leaderboard, myLineup, myScore] = await Promise.all([
      g.tournaments.get(id),
      g.tournaments.matches(id),
      g.tournaments.players(id),
      g.tournaments.leaderboard(id),
      signedIn ? g.lineups.getMine(id) : Promise.resolve(null),
      signedIn ? g.lineups.myScore(id) : Promise.resolve(null),
    ]);
    return { tournament, matches, players, leaderboard, myLineup, myScore };
  }, [id, signedIn]);
}
