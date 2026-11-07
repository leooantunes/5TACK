import { create } from 'zustand';
import type { User } from '../../domain';
import { gateways } from '../ports';

type Status = 'booting' | 'signedOut' | 'signedIn';

interface SessionState {
  status: Status;
  user: User | null;
  restore(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, displayName: string): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
  /** Chamado pela camada de dados quando o refresh falha. */
  expire(): void;
}

/** Caso de uso de SESSÃO. A UI só chama estas ações; não sabe de tokens nem de HTTP. */
export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  user: null,

  async restore() {
    const user = await gateways().auth.restore();
    set({ user, status: user ? 'signedIn' : 'signedOut' });
  },

  async login(email, password) {
    const user = await gateways().auth.login(email, password);
    set({ user, status: 'signedIn' });
  },

  async register(email, password, displayName) {
    const user = await gateways().auth.register(email, password, displayName);
    set({ user, status: 'signedIn' });
  },

  async logout() {
    await gateways().auth.logout();
    set({ user: null, status: 'signedOut' });
  },

  async deleteAccount() {
    await gateways().auth.deleteAccount();
    set({ user: null, status: 'signedOut' });
  },

  expire() {
    set({ user: null, status: 'signedOut' });
  },
}));
