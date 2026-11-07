import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AppError } from './errors';
import type { LineupRepository, RefreshTokenRepository, UserRepository } from '../infra/repositories/repositories';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/** Hash de comparação para usuário inexistente: o tempo de resposta não revela se o e-mail existe. */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export interface TokenSigner {
  sign(payload: { sub: string }): string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  displayName: string;
  email: string;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly lineups: LineupRepository,
    private readonly signer: TokenSigner,
  ) {}

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const refreshToken = randomBytes(48).toString('base64url');
    // Só o hash vai para o banco: um vazamento da tabela não dá acesso às contas.
    await this.refreshTokens.save({ tokenHash: sha256(refreshToken), userId, expiresAt: Date.now() + REFRESH_TTL_MS });
    return { accessToken: this.signer.sign({ sub: userId }), refreshToken };
  }

  async register(email: string, password: string, displayName: string) {
    const normalized = email.trim().toLowerCase();
    if (await this.users.findByEmail(normalized)) {
      throw new AppError(409, 'EMAIL_IN_USE', 'Não foi possível criar a conta com este e-mail');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create({ email: normalized, displayName: displayName.trim(), passwordHash });
    return { user: this.toPublic(user), tokens: await this.issueTokens(user.id) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    // Mensagem genérica: não diz se o erro foi o e-mail ou a senha.
    if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
    return { user: this.toPublic(user), tokens: await this.issueTokens(user.id) };
  }

  /** Rotação: o refresh token usado é invalidado e um novo par é emitido. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const rec = await this.refreshTokens.consume(sha256(refreshToken));
    if (!rec || rec.expiresAt < Date.now()) throw new AppError(401, 'INVALID_REFRESH', 'Sessão expirada');
    if (!(await this.users.findById(rec.userId))) throw new AppError(401, 'INVALID_REFRESH', 'Sessão expirada');
    return this.issueTokens(rec.userId);
  }

  async logout(refreshToken: string) {
    await this.refreshTokens.consume(sha256(refreshToken));
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida');
    return this.toPublic(user);
  }

  /** LGPD: exclusão da conta e de todos os dados ligados a ela. */
  async deleteAccount(userId: string) {
    await this.lineups.deleteAllForUser(userId);
    await this.refreshTokens.revokeAllForUser(userId);
    await this.users.delete(userId);
  }

  private toPublic(u: { id: string; displayName: string; email: string }): PublicUser {
    return { id: u.id, displayName: u.displayName, email: u.email };
  }
}
