import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { AuthService } from '../application/AuthService';
import type { CatalogService } from '../application/CatalogService';
import { AppError } from '../application/errors';
import type { LineupService } from '../application/LineupService';
import type { Env } from '../config/env';
import { IdParam, LineupBody, LoginBody, RefreshBody, RegisterBody, parse } from './schemas';

export interface Services {
  auth: AuthService;
  catalog: CatalogService;
  lineups: LineupService;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export const ACCESS_TOKEN_TTL = '15m';

export async function buildServer(env: Env, makeServices: (sign: (p: { sub: string }) => string) => Services) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.NODE_ENV === 'production' ? 'info' : 'debug',
            // Nunca registrar credenciais ou tokens em log.
            redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken', 'res.body.accessToken'],
          },
    bodyLimit: 16 * 1024, // nenhuma rota precisa de mais que 16 KB
    trustProxy: env.NODE_ENV === 'production',
  });

  await app.register(cors, {
    // Só origens explícitas (allowlist). O app nativo não envia Origin, então não depende disto.
    origin: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
  await app.register(helmet, {
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' });
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  const services = makeServices((p) => app.jwt.sign(p));

  const authenticate = async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Faça login novamente');
    }
  };

  // Limite mais rígido nas rotas de credencial (contra força bruta).
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.setErrorHandler((err: unknown, req, reply: FastifyReply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 429) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Muitas requisições, tente em instantes' } });
    }
    req.log.error(err);
    // Erros inesperados: resposta genérica, detalhes só no log do servidor.
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Erro interno' } });
  });

  app.get('/health', async () => ({ ok: true }));

  // ---------- Auth ----------
  app.post('/auth/register', authLimit, async (req, reply) => {
    const b = parse(RegisterBody, req.body);
    const r = await services.auth.register(b.email, b.password, b.displayName);
    return reply.status(201).send(r);
  });
  app.post('/auth/login', authLimit, async (req) => {
    const b = parse(LoginBody, req.body);
    return services.auth.login(b.email, b.password);
  });
  app.post('/auth/refresh', authLimit, async (req) => {
    const b = parse(RefreshBody, req.body);
    return services.auth.refresh(b.refreshToken);
  });
  app.post('/auth/logout', async (req, reply) => {
    const b = parse(RefreshBody, req.body);
    await services.auth.logout(b.refreshToken);
    return reply.status(204).send();
  });

  // ---------- Conta ----------
  app.get('/me', { preHandler: authenticate }, async (req) => services.auth.me(req.user.sub));
  app.delete('/me', { preHandler: authenticate }, async (req, reply) => {
    await services.auth.deleteAccount(req.user.sub);
    return reply.status(204).send();
  });

  // ---------- Catálogo (público) ----------
  app.get('/tournaments/upcoming', async () => {
    const all = await services.catalog.listTournaments();
    return all.filter((t) => t.status === 'upcoming');
  });
  app.get('/tournaments', async () => services.catalog.listTournaments());
  app.get('/tournaments/:id', async (req) => services.catalog.getTournament(parse(IdParam, req.params).id));
  app.get('/tournaments/:id/players', async (req) => services.catalog.listPlayers(parse(IdParam, req.params).id));
  app.get('/tournaments/:id/matches', async (req) => services.catalog.listMatches(parse(IdParam, req.params).id));
  app.get('/tournaments/:id/leaderboard', async (req) => services.lineups.leaderboard(parse(IdParam, req.params).id));

  // ---------- Lineup (autenticado; o usuário só acessa o PRÓPRIO lineup) ----------
  app.get('/tournaments/:id/lineup', { preHandler: authenticate }, async (req) =>
    services.lineups.getMine(req.user.sub, parse(IdParam, req.params).id),
  );
  app.put('/tournaments/:id/lineup', { preHandler: authenticate }, async (req) => {
    const { id } = parse(IdParam, req.params);
    const body = parse(LineupBody, req.body);
    return services.lineups.save(req.user.sub, id, body.picks);
  });
  app.get('/tournaments/:id/lineup/score', { preHandler: authenticate }, async (req) =>
    services.lineups.myScore(req.user.sub, parse(IdParam, req.params).id),
  );

  return app;
}
