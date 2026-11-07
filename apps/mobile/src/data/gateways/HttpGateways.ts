import { z } from 'zod';
import type { AuthGateway, LineupGateway, TournamentGateway } from '../../application/ports';
import type { LineupPick, User } from '../../domain';
import type { HttpClient } from '../http/HttpClient';
import {
  AuthResponseSchema,
  LeaderboardSchema,
  LineupScoreSchema,
  MatchSchema,
  PlayerSchema,
  SavedLineupSchema,
  TournamentSchema,
  UserSchema,
} from '../http/schemas';
import type { TokenStorage } from '../storage/TokenStorage';

/** Implementações HTTP das portas da aplicação. */

const seg = (id: string) => encodeURIComponent(id);

export class HttpAuthGateway implements AuthGateway {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStorage,
  ) {}

  async restore(): Promise<User | null> {
    if (!(await this.tokens.get())) return null;
    try {
      return await this.http.request('/me', { auth: true, schema: UserSchema });
    } catch {
      return null;
    }
  }

  async login(email: string, password: string) {
    const r = await this.http.request('/auth/login', { method: 'POST', body: { email, password }, schema: AuthResponseSchema });
    await this.tokens.set(r.tokens);
    return r.user;
  }

  async register(email: string, password: string, displayName: string) {
    const r = await this.http.request('/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
      schema: AuthResponseSchema,
    });
    await this.tokens.set(r.tokens);
    return r.user;
  }

  async logout() {
    const t = await this.tokens.get();
    await this.tokens.clear(); // limpa localmente primeiro: logout funciona mesmo offline
    if (t) await this.http.request('/auth/logout', { method: 'POST', body: { refreshToken: t.refreshToken }, schema: z.null() }).catch(() => undefined);
  }

  async deleteAccount() {
    await this.http.request('/me', { method: 'DELETE', auth: true, schema: z.null() });
    await this.tokens.clear();
  }
}

export class HttpTournamentGateway implements TournamentGateway {
  constructor(private readonly http: HttpClient) {}
  list() {
    return this.http.request('/tournaments', { schema: z.array(TournamentSchema) });
  }
  get(id: string) {
    return this.http.request(`/tournaments/${seg(id)}`, { schema: TournamentSchema });
  }
  players(id: string) {
    return this.http.request(`/tournaments/${seg(id)}/players`, { schema: z.array(PlayerSchema) });
  }
  matches(id: string) {
    return this.http.request(`/tournaments/${seg(id)}/matches`, { schema: z.array(MatchSchema) });
  }
  leaderboard(id: string) {
    return this.http.request(`/tournaments/${seg(id)}/leaderboard`, { schema: LeaderboardSchema });
  }
}

export class HttpLineupGateway implements LineupGateway {
  constructor(private readonly http: HttpClient) {}
  getMine(tournamentId: string) {
    return this.http.request(`/tournaments/${seg(tournamentId)}/lineup`, { auth: true, schema: SavedLineupSchema.nullable() });
  }
  save(tournamentId: string, picks: LineupPick[]) {
    return this.http.request(`/tournaments/${seg(tournamentId)}/lineup`, {
      method: 'PUT',
      auth: true,
      body: { picks },
      schema: SavedLineupSchema,
    });
  }
  myScore(tournamentId: string) {
    return this.http.request(`/tournaments/${seg(tournamentId)}/lineup/score`, {
      auth: true,
      schema: LineupScoreSchema.nullable(),
    });
  }
}
