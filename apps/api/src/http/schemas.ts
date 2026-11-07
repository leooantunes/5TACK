import { BOOSTERS, FANTASY_ROLES } from '@5tack/core';
import { z } from 'zod';
import { AppError } from '../application/errors';

/** Toda entrada externa é validada aqui antes de chegar aos serviços. */

export const RegisterBody = z.object({
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres')
    .max(128)
    .regex(/[A-Za-z]/, 'A senha precisa ter letras')
    .regex(/[0-9]/, 'A senha precisa ter números'),
  // Nome público: só caracteres seguros, sem HTML/URLs.
  displayName: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[\p{L}\p{N}_.\- ]+$/u, 'Use letras, números, espaço, _ . ou -'),
});

export const LoginBody = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const RefreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

export const IdParam = z.object({ id: z.string().min(1).max(64).regex(/^[\w-]+$/) });

export const LineupBody = z.object({
  picks: z
    .array(z.object({ playerId: z.string().min(1).max(64).regex(/^[\w-]+$/), role: z.enum(FANTASY_ROLES) }))
    .max(5),
  boosters: z.record(z.string(), z.object({ playerId: z.string().max(64), booster: z.enum(BOOSTERS) })).optional(),
});

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Dados inválidos',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}
