import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { api, ApiError } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import type { ContextoPortal, UsuarioPortal } from '../lib/types.ts';
import type { AuthContextValue, LoginOutcome } from './auth-context.ts';

const AuthContext = createContext<AuthContextValue | null>(null);
const CACHE_KEY = 'benefy.portal.context';

function leerContextoCache(): ContextoPortal | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as ContextoPortal : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UsuarioPortal | null>(null);
  const [context, setContext] = useState<ContextoPortal | null>(() => leerContextoCache());
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedUser = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const clear = useCallback(() => {
    loadedUser.current = null;
    setProfile(null);
    setContext(null);
    setNeedsProfile(false);
    window.sessionStorage.removeItem(CACHE_KEY);
  }, []);

  const loadSessionData = useCallback(async (): Promise<LoginOutcome> => {
    if (loadingRef.current) {
      return { needsProfile, context };
    }
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const currentProfile = await api.getProfile();
      const currentContext = await api.getContext();
      setProfile(currentProfile);
      setContext(currentContext);
      setNeedsProfile(false);
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(currentContext));
      return { needsProfile: false, context: currentContext };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        setProfile(null);
        setContext(null);
        setNeedsProfile(true);
        window.sessionStorage.removeItem(CACHE_KEY);
        return { needsProfile: true, context: null };
      }
      if (err instanceof ApiError && err.status === 401) {
        await supabase.auth.signOut();
      }
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu cuenta.');
      throw err;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [context, needsProfile]);

  const hydrate = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      clear();
      setLoading(false);
      return;
    }
    if (loadedUser.current === currentSession.user.id) {
      return;
    }
    try {
      await loadSessionData();
      loadedUser.current = currentSession.user.id;
    } catch {
      // El error ya quedó expuesto en el contexto.
    }
  }, [clear, loadSessionData]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        void hydrate(data.session);
      } else {
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!active) return;
        setSession(currentSession);
        if (currentSession) {
          void hydrate(currentSession);
        } else {
          loadedUser.current = null;
          setProfile(null);
          setContext(null);
          setNeedsProfile(false);
          setLoading(false);
          window.sessionStorage.removeItem(CACHE_KEY);
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        throw new Error(authError.message);
      }
      setSession(data.session);
      const outcome = await loadSessionData();
      loadedUser.current = data.session?.user.id ?? null;
      return outcome;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadSessionData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    clear();
  }, [clear]);

  const createProfile = useCallback(async (nombre: string, apellido: string) => {
    await api.createProfile(nombre, apellido);
    loadedUser.current = null;
    const outcome = await loadSessionData();
    return outcome.context;
  }, [loadSessionData]);

  const createBusiness = useCallback(async (data: {
    nombre: string;
    direccion: string;
    correo: string;
    telefono?: string;
    categoria: number;
  }) => {
    await api.createBusiness(data);
    loadedUser.current = null;
    const outcome = await loadSessionData();
    return outcome.context;
  }, [loadSessionData]);

  const refreshContext = useCallback(async () => {
    const currentContext = await api.getContext();
    setContext(currentContext);
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(currentContext));
    return currentContext;
  }, []);

  const value: AuthContextValue = {
    session,
    profile,
    context,
    loading,
    needsProfile,
    error,
    signIn,
    signOut,
    createProfile,
    createBusiness,
    refreshContext,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return value;
}
