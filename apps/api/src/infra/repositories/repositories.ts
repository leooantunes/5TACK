import type { LineupPick } from '@5tack/core';
import { randomUUID } from 'node:crypto';

/**
 * Interfaces de persistência + implementação em memória.
 * Em produção, troque por PostgreSQL (mesmas interfaces), com:
 *  - senha só como hash bcrypt; refresh token só como hash SHA-256;
 *  - backups criptografados e acesso ao banco restrito à rede privada.
 */

export interface UserRecord {
  id: string;
  email: string; // dado pessoal (LGPD)
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
  create(data: Omit<UserRecord, 'id' | 'createdAt'>): Promise<UserRecord>;
  delete(id: string): Promise<void>;
  listDisplayNames(ids: string[]): Promise<Map<string, string>>;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

export interface RefreshTokenRepository {
  save(rec: RefreshTokenRecord): Promise<void>;
  /** Consome (apaga) e devolve o token: cada refresh token só pode ser usado uma vez. */
  consume(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  revokeAllForUser(userId: string): Promise<void>;
}

export interface LineupRecord {
  userId: string;
  tournamentId: string;
  picks: LineupPick[];
  updatedAt: string;
}

export interface LineupRepository {
  get(userId: string, tournamentId: string): Promise<LineupRecord | undefined>;
  upsert(rec: LineupRecord): Promise<LineupRecord>;
  listByTournament(tournamentId: string): Promise<LineupRecord[]>;
  deleteAllForUser(userId: string): Promise<void>;
}

export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, UserRecord>();
  async findByEmail(email: string) {
    return [...this.byId.values()].find((u) => u.email === email);
  }
  async findById(id: string) {
    return this.byId.get(id);
  }
  async create(data: Omit<UserRecord, 'id' | 'createdAt'>) {
    const rec = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    this.byId.set(rec.id, rec);
    return rec;
  }
  async delete(id: string) {
    this.byId.delete(id);
  }
  async listDisplayNames(ids: string[]) {
    return new Map(ids.map((id) => [id, this.byId.get(id)?.displayName ?? 'Jogador removido']));
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private map = new Map<string, RefreshTokenRecord>();
  async save(rec: RefreshTokenRecord) {
    this.map.set(rec.tokenHash, rec);
  }
  async consume(tokenHash: string) {
    const rec = this.map.get(tokenHash);
    this.map.delete(tokenHash);
    return rec;
  }
  async revokeAllForUser(userId: string) {
    for (const [k, v] of this.map) if (v.userId === userId) this.map.delete(k);
  }
}

export class InMemoryLineupRepository implements LineupRepository {
  private map = new Map<string, LineupRecord>();
  private key = (u: string, t: string) => `${u}::${t}`;
  async get(userId: string, tournamentId: string) {
    return this.map.get(this.key(userId, tournamentId));
  }
  async upsert(rec: LineupRecord) {
    this.map.set(this.key(rec.userId, rec.tournamentId), rec);
    return rec;
  }
  async listByTournament(tournamentId: string) {
    return [...this.map.values()].filter((l) => l.tournamentId === tournamentId);
  }
  async deleteAllForUser(userId: string) {
    for (const [k, v] of this.map) if (v.userId === userId) this.map.delete(k);
  }
}
