import { z } from 'zod';

/**
 * Configuração validada na inicialização: se faltar segredo, o servidor nem sobe.
 * Evita rodar em produção com segredo padrão ou chave vazia.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    HOST: z.string().default('0.0.0.0'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
    CORS_ORIGINS: z.string().default(''),
    DATA_PROVIDER: z.enum(['mock', 'pandascore']).default('mock'),
    PANDASCORE_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.DATA_PROVIDER === 'pandascore' && !env.PANDASCORE_TOKEN) {
      ctx.addIssue({ code: 'custom', path: ['PANDASCORE_TOKEN'], message: 'Obrigatório quando DATA_PROVIDER=pandascore' });
    }
    if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('troque')) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Use um segredo real em produção' });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Mostra quais variáveis estão erradas, nunca os valores.
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida:\n${msg}`);
  }
  return parsed.data;
}
