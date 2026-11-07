import type { FantasyRole } from '@5tack/core';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuthService } from './application/AuthService';
import { CatalogService } from './application/CatalogService';
import { LineupService } from './application/LineupService';
import type { Env } from './config/env';
import type { DataProvider } from './infra/providers/DataProvider';
import { MockDataProvider } from './infra/providers/MockDataProvider';
import { CitoProvider } from './infra/providers/CitoProvider';
import {
  InMemoryLineupRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from './infra/repositories/repositories';
import type { Services } from './http/server';

/** Composição das dependências (injeção manual). Único lugar que conhece as implementações concretas. */
export function createServices(env: Env, sign: (p: { sub: string }) => string): Services {
  let provider: DataProvider;

  if (env.DATA_PROVIDER === 'cito') {
    const cito = new CitoProvider(env.CITO_API_KEY ?? process.env.CITO_API_KEY!);
    const mock = new MockDataProvider();
    // Hybrid: Cito para torneios/times, Mock para players se Cito retornar vazio
    provider = {
      name: 'hybrid-cito-mock',
      listTournaments: () => cito.listTournaments(),
      listTeams: (id) => cito.listTeams(id),
      async listPlayers(id) {
        return cito.listPlayers(id);
      },
      listMatches: (id) => cito.listMatches(id),
      listMapStats: (id) => cito.listMapStats(id),
      recentAverages: (ids) => cito.recentAverages(ids),
    };
  } else {
    provider = new MockDataProvider();
  }

  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const lineupRepo = new InMemoryLineupRepository();

  const catalog = new CatalogService(provider);
  const services: Services = {
    auth: new AuthService(users, refreshTokens, lineupRepo, { sign }),
    catalog,
    lineups: new LineupService(catalog, lineupRepo, users),
  };

  if (env.DATA_PROVIDER === 'mock') void seedDemo(users, lineupRepo, catalog);
  return services;
}

/** Popula o torneio finalizado com usuários fictícios para o ranking não ficar vazio na demo. */
async function seedDemo(users: InMemoryUserRepository, lineups: InMemoryLineupRepository, catalog: CatalogService) {
  const roles: FantasyRole[] = ['STAR', 'ENTRY', 'SNIPER', 'CLUTCHER', 'SUPPORT'];
  const names = ['aimbotless', 'eco_warrior', 'smokecriminal', 'rushB_dad', 'tapdoutor', 'ninjadefuse'];
  const players = await catalog.listPlayers('mock-masters');
  for (let i = 0; i < names.length; i++) {
    const u = await users.create({
      email: `${names[i]}@demo.local`,
      displayName: names[i]!,
      // Senha aleatória descartada: contas de demo não podem ser acessadas.
      passwordHash: bcrypt.hashSync(randomBytes(16).toString('hex'), 4),
    });
    // 5 jogadores de times diferentes, deslocados por usuário
    const picks = roles.map((role, k) => ({ playerId: players[(i * 3 + k * 5) % players.length]!.id, role }));
    await lineups.upsert({ userId: u.id, tournamentId: 'mock-masters', picks, updatedAt: new Date().toISOString() });
  }
}
