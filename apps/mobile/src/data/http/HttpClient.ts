import { z } from 'zod';
import { REQUEST_TIMEOUT_MS } from '../config';
import type { TokenStorage, Tokens } from '../storage/TokenStorage';

/** Erro vindo da API, com código estável para a UI traduzir. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const ErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const TokensSchema = z.object({ accessToken: z.string(), refreshToken: z.string() });

interface RequestOptions<S extends z.ZodTypeAny> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  schema: S;
}

/**
 * Cliente HTTP único do app.
 *  - timeout em toda requisição;
 *  - anexa o access token só quando `auth: true`;
 *  - em 401, renova a sessão UMA vez (single-flight) e repete a chamada;
 *  - valida toda resposta com zod: dado inesperado vira erro, não crash na UI.
 */
export class HttpClient {
  private refreshing: Promise<Tokens | null> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly tokens: TokenStorage,
    private readonly onSessionExpired: () => void,
  ) {}

  async request<S extends z.ZodTypeAny>(path: string, opts: RequestOptions<S>): Promise<z.output<S>> {
    const res = await this.send(path, opts);
    if (res.status === 401 && opts.auth) {
      const renewed = await this.refreshOnce();
      if (!renewed) {
        this.onSessionExpired();
        throw new ApiError(401, 'UNAUTHORIZED', 'Sua sessão expirou');
      }
      return this.parse(await this.send(path, opts), opts.schema);
    }
    return this.parse(res, opts.schema);
  }

  private async send(path: string, opts: RequestOptions<z.ZodTypeAny>): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.auth) {
      const t = await this.tokens.get();
      if (t) headers.Authorization = `Bearer ${t.accessToken}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor');
    } finally {
      clearTimeout(timer);
    }
  }

  private async parse<S extends z.ZodTypeAny>(res: Response, schema: S): Promise<z.output<S>> {
    if (res.status === 204) return schema.parse(null);
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = ErrorBody.safeParse(json);
      if (err.success) throw new ApiError(res.status, err.data.error.code, err.data.error.message, err.data.error.details);
      throw new ApiError(res.status, 'UNKNOWN', 'Erro inesperado');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ApiError(res.status, 'BAD_RESPONSE', 'Resposta inválida do servidor');
    return parsed.data;
  }

  /** Várias requisições com 401 ao mesmo tempo disparam um único refresh. */
  private refreshOnce(): Promise<Tokens | null> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const current = await this.tokens.get();
        if (!current) return null;
        const res = await this.send('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: current.refreshToken },
          schema: TokensSchema,
        });
        if (!res.ok) {
          await this.tokens.clear();
          return null;
        }
        const next = TokensSchema.parse(await res.json());
        await this.tokens.set(next);
        return next;
      })().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }
}
