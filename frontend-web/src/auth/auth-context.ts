import type { Session } from '@supabase/supabase-js';
import type { ContextoPortal, UsuarioPortal } from '../lib/types.ts';

export type LoginOutcome = {
  needsProfile: boolean;
  context: ContextoPortal | null;
};

export type AuthContextValue = {
  session: Session | null;
  profile: UsuarioPortal | null;
  context: ContextoPortal | null;
  loading: boolean;
  needsProfile: boolean;
  onboardingError: string | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<LoginOutcome>;
  signOut: () => Promise<void>;
  createProfile: (nombre: string, apellido: string) => Promise<ContextoPortal | null>;
  createBusiness: (data: {
    nombre: string;
    direccion: string;
    correo: string;
    telefono?: string;
    categoria: number;
  }) => Promise<ContextoPortal | null>;
  refreshContext: () => Promise<ContextoPortal | null>;
  retryOnboarding: () => Promise<ContextoPortal | null>;
  clearError: () => void;
};
