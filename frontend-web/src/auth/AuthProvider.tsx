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

const CODIGOS_SIN_REGISTRO = ['sin_registro_comercial', 'registro_incompleto'];

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
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedUser = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const estadoRef = useRef({ needsProfile, context });
  estadoRef.current = { needsProfile, context };

  const clear = useCallback(() => {
    loadedUser.current = null;
    setProfile(null);
    setContext(null);
    setNeedsProfile(false);
    setOnboardingError(null);
    window.sessionStorage.removeItem(CACHE_KEY);
  }, []);

  const completarOnboarding = useCallback(async (): Promise<ContextoPortal | null> => {
    try {
      const resultado = await api.completeOnboarding();
      return resultado.contexto;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && CODIGOS_SIN_REGISTRO.includes(err.codigo ?? '')) {
          return null;
        }
        if (err.status === 400 && err.codigo === 'registro_incompleto') {
          return null;
        }
      }
      throw err;
    }
  }, []);

  const loadSessionData = useCallback(async (): Promise<LoginOutcome> => {
    if (loadingRef.current) {
      return {
        needsProfile: estadoRef.current.needsProfile,
        context: estadoRef.current.context,
      };
    }
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    setOnboardingError(null);
    try {
      let currentProfile: UsuarioPortal;
      try {
        currentProfile = await api.getProfile();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          const contextoCompletado = await completarOnboarding();
          if (!contextoCompletado) {
            setProfile(null);
            setContext(null);
            setNeedsProfile(true);
            window.sessionStorage.removeItem(CACHE_KEY);
            return { needsProfile: true, context: null };
          }
          currentProfile = await api.getProfile();
        } else {
          throw err;
        }
      }

      let currentContext = await api.getContext();
      if (!currentContext.es_admin_sistema && currentContext.membresias.length === 0) {
        const contextoCompletado = await completarOnboarding();
        if (contextoCompletado) {
          currentContext = contextoCompletado;
        }
      }

      setProfile(currentProfile);
      setContext(currentContext);
      setNeedsProfile(false);
      setOnboardingError(null);
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(currentContext));
      return { needsProfile: false, context: currentContext };
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await supabase.auth.signOut();
      }
      setProfile(null);
      setContext(null);
      setNeedsProfile(false);
      setOnboardingError(
        err instanceof Error ? err.message : 'No se pudo completar tu registro.',
      );
      window.sessionStorage.removeItem(CACHE_KEY);
      return { needsProfile: false, context: null };
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [completarOnboarding]);

  const hydrate = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      clear();
      setLoading(false);
      return;
    }
    if (loadedUser.current === currentSession.user.id) {
      return;
    }
    const outcome = await loadSessionData();
    if (!outcome.needsProfile) {
      loadedUser.current = currentSession.user.id;
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
          setOnboardingError(null);
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

  const retryOnboarding = useCallback(async () => {
    setOnboardingError(null);
    const outcome = await loadSessionData();
    return outcome.context;
  }, [loadSessionData]);

  // Revocación: al volver a la pestaña o recibir un 403 se recarga el contexto.
  // Si la membresía ya no es efectiva, el guard redirige al acceso restringido.
  useEffect(() => {
    if (!session) return;

    function actualizarSilenciosamente() {
      void refreshContext().catch(() => {
        // Un 401 lo gestiona el cliente HTTP; no se fuerza otro ciclo aquí.
      });
    }

    window.addEventListener('focus', actualizarSilenciosamente);
    window.addEventListener('benefy:contexto-invalidado', actualizarSilenciosamente);
    return () => {
      window.removeEventListener('focus', actualizarSilenciosamente);
      window.removeEventListener('benefy:contexto-invalidado', actualizarSilenciosamente);
    };
  }, [session, refreshContext]);

  const value: AuthContextValue = {
    session,
    profile,
    context,
    loading,
    needsProfile,
    onboardingError,
    error,
    signIn,
    signOut,
    createProfile,
    createBusiness,
    refreshContext,
    retryOnboarding,
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
