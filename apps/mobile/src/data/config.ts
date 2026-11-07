/**
 * Configuração da camada de dados.
 * Só variáveis EXPO_PUBLIC_* chegam ao app — e elas ficam visíveis no bundle.
 * Por isso NENHUM segredo (chave da PandaScore, JWT secret) pode existir aqui:
 * o app só conhece a URL do nosso próprio backend.
 */
const raw = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.18.6:3333';

function resolveApiUrl(url: string): string {
  const clean = url.replace(/\/+$/, '');
  // Em build de produção, só aceita HTTPS (tokens nunca trafegam em texto puro).
  // Exceção: localhost, usado só para testar o build de produção na própria máquina.
  const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean);
  if (!__DEV__ && !clean.startsWith('https://') && !isLocalhost) {
    throw new Error('EXPO_PUBLIC_API_URL precisa usar https:// em produção');
  }
  return clean;
}

export const API_URL = resolveApiUrl(raw);
export const REQUEST_TIMEOUT_MS = 12_000;
