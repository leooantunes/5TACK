import { z } from 'zod';
import { FANTASY_ROLES } from '../../domain';

/** Contratos da API. Qualquer divergência do servidor é detectada aqui, não na tela. */

export const UserSchema = z.object({ id: z.string(), displayName: z.string(), email: z.string() });

export const AuthResponseSchema = z.object({
  user: UserSchema,
  tokens: z.object({ accessToken: z.string(), refreshToken: z.string() }),
});

export const TournamentSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(['S', 'A', 'B']),
  startsAt: z.string(),
  endsAt: z.string(),
  lockAt: z.string(),
  status: z.enum(['upcoming', 'running', 'finished']),
  budget: z.number(),
  location: z.string().optional(),
});

export const PlayerSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  teamId: z.string(),
  teamShortName: z.string(),
  country: z.string().optional(),
  price: z.number(),
});

export const MatchSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  teamAId: z.string(),
  teamBId: z.string(),
  teamAShortName: z.string(),
  teamBShortName: z.string(),
  scoreA: z.number(),
  scoreB: z.number(),
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  startsAt: z.string(),
  status: z.enum(['scheduled', 'live', 'finished']),
});

export const LeaderboardSchema = z.array(
  z.object({ rank: z.number(), userId: z.string(), displayName: z.string(), points: z.number() }),
);

const PickSchema = z.object({ playerId: z.string(), role: z.enum(FANTASY_ROLES) });

export const SavedLineupSchema = z.object({
  tournamentId: z.string(),
  picks: z.array(PickSchema),
  updatedAt: z.string(),
});

const BreakdownSchema = z.object({
  total: z.number(),
  // Códigos de pontuação: string livre para não quebrar o app quando o servidor ganhar um código novo.
  items: z.array(z.object({ code: z.string(), points: z.number() })),
});

export const LineupScoreSchema = z.object({
  total: z.number(),
  picks: z.array(PickSchema.extend({ breakdown: BreakdownSchema })),
});
