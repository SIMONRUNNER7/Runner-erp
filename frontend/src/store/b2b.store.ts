import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface B2BUser {
  id: string;
  email: string;
  name: string;
  company: string;
  discount: number;
}

interface B2BState {
  token: string | null;
  client: B2BUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, client: B2BUser) => void;
  logout: () => void;
}

export const useB2BStore = create<B2BState>()(
  persist(
    (set) => ({
      token: null,
      client: null,
      isAuthenticated: false,
      setAuth: (token, client) => set({ token, client, isAuthenticated: true }),
      logout: () => set({ token: null, client: null, isAuthenticated: false }),
    }),
    { name: 'b2b-auth' }
  )
);
