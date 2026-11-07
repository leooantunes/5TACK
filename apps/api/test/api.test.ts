import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';
import { createServices } from '../src/container';
import { buildServer } from '../src/http/server';

const env = loadEnv({ NODE_ENV: 'test', JWT_SECRET: 'x'.repeat(40), DATA_PROVIDER: 'mock' });
let app: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
  app = await buildServer(env, (sign) => createServices(env, sign));
  await app.ready();
});
afterAll(() => app.close());

async function register(email = 'leo@test.dev') {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'senha1234', displayName: 'leo' },
  });
  return res.json() as { user: { id: string }; tokens: { accessToken: string; refreshToken: string } };
}

describe('segurança da API', () => {
  it('não sobe com JWT_SECRET curto', () => {
    expect(() => loadEnv({ JWT_SECRET: 'curto' })).toThrow();
  });

  it('não sobe com provider pandascore sem token', () => {
    expect(() => loadEnv({ JWT_SECRET: 'x'.repeat(40), DATA_PROVIDER: 'pandascore' })).toThrow();
  });

  it('envia cabeçalhos de segurança (helmet)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejeita senha fraca e nome com HTML', async () => {
    const weak = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'a@b.dev', password: '123', displayName: '<script>' },
    });
    expect(weak.statusCode).toBe(400);
  });

  it('login com erro genérico (não revela se o e-mail existe)', async () => {
    await register('exists@test.dev');
    const wrongPass = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'exists@test.dev', password: 'errada123' } });
    const noUser = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'nobody@test.dev', password: 'errada123' } });
    expect(wrongPass.statusCode).toBe(401);
    expect(noUser.json()).toEqual(wrongPass.json());
  });

  it('bloqueia lineup sem token', async () => {
    const res = await app.inject({ method: 'GET', url: '/tournaments/mock-major/lineup' });
    expect(res.statusCode).toBe(401);
  });

  it('refresh token é de uso único (rotação)', async () => {
    const { tokens } = await register('rot@test.dev');
    const first = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(first.statusCode).toBe(200);
    const reuse = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(reuse.statusCode).toBe(401);
  });

  it('servidor revalida o lineup (orçamento, times, funções)', async () => {
    const { tokens } = await register('draft@test.dev');
    const players = (await app.inject({ method: 'GET', url: '/tournaments/mock-major/players' })).json() as {
      id: string;
      teamId: string;
    }[];
    // 5 jogadores do mesmo time e funções repetidas → inválido
    const sameTeam = players.filter((p) => p.teamId === players[0]!.teamId).slice(0, 5);
    const bad = await app.inject({
      method: 'PUT',
      url: '/tournaments/mock-major/lineup',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: { picks: sameTeam.map((p) => ({ playerId: p.id, role: 'STAR' })) },
    });
    expect(bad.statusCode).toBe(422);

    // 5 jogadores baratos, de times diferentes, funções únicas → válido
    const roles = ['STAR', 'ENTRY', 'SNIPER', 'CLUTCHER', 'SUPPORT'];
    const cheapest = [...players].reverse();
    const picks: { playerId: string; role: string }[] = [];
    const teams = new Set<string>();
    for (const p of cheapest) {
      if (teams.has(p.teamId)) continue;
      teams.add(p.teamId);
      picks.push({ playerId: p.id, role: roles[picks.length]! });
      if (picks.length === 5) break;
    }
    const good = await app.inject({
      method: 'PUT',
      url: '/tournaments/mock-major/lineup',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: { picks },
    });
    expect(good.statusCode).toBe(200);
  });

  it('ranking não expõe e-mail', async () => {
    const res = await app.inject({ method: 'GET', url: '/tournaments/mock-masters/leaderboard' });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('@');
    expect((res.json() as unknown[]).length).toBeGreaterThan(0);
  });

  it('exclusão de conta (LGPD) invalida a sessão', async () => {
    const { tokens } = await register('bye@test.dev');
    const auth = { authorization: `Bearer ${tokens.accessToken}` };
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: auth })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).statusCode).toBe(401);
    const refresh = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(refresh.statusCode).toBe(401);
  });
});
