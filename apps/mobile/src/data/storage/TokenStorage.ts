import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Armazenamento das credenciais de sessão.
 *  - iOS: Keychain; Android: Keystore (via expo-secure-store), acessível só com o
 *    aparelho desbloqueado e sem migrar para outro dispositivo em backup.
 *  - Web: só em memória (nunca localStorage, que fica exposto a XSS).
 * Nunca usar AsyncStorage para tokens: ele não é criptografado.
 */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStorage {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
}

const KEY_ACCESS = 'fivestack.accessToken';
const KEY_REFRESH = 'fivestack.refreshToken';
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

class SecureTokenStorage implements TokenStorage {
  async get() {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(KEY_ACCESS, OPTS),
      SecureStore.getItemAsync(KEY_REFRESH, OPTS),
    ]);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  }
  async set(t: Tokens) {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, t.accessToken, OPTS),
      SecureStore.setItemAsync(KEY_REFRESH, t.refreshToken, OPTS),
    ]);
  }
  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(KEY_ACCESS, OPTS), SecureStore.deleteItemAsync(KEY_REFRESH, OPTS)]);
  }
}

class MemoryTokenStorage implements TokenStorage {
  private tokens: Tokens | null = null;
  async get() {
    return this.tokens;
  }
  async set(t: Tokens) {
    this.tokens = t;
  }
  async clear() {
    this.tokens = null;
  }
}

export function createTokenStorage(): TokenStorage {
  return Platform.OS === 'web' ? new MemoryTokenStorage() : new SecureTokenStorage();
}
