import { clearPlanCache } from '../portal/hooks/planCache';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UsuarioPortal | null>(null);
  const [context, setContext] = useState<ContextoPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedUser = useRef<string | null>(null);
  const identity = useRef<string | null>(null);
  const epoch = useRef(0);
  const contextSequence = useRef(0);
  const pending = useRef<Promise<LoginOutcome> | null>(null);
  const acceptSession = useCallback((next: Session | null) => {
    if (identity.current !== (next?.user.id ?? null)) {
      clearPlanCache();
      identity.current = next?.user.id ?? null;
      epoch.current++;
      contextSequence.current++;
      pending.current = null;
      loadedUser.current = null;
      setProfile(null); setContext(null); setNeedsProfile(false); setOnboardingError(null);
    }
    setSession(next);
  }, []);

  const clear = useCallback(() => {
    clearPlanCache();
    epoch.current++; contextSequence.current++; pending.current = null; identity.current = null;
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

  const loadSessionData = useCallback((): Promise<LoginOutcome> => {
    if (pending.current) return pending.current;
    const version = epoch.current;
    const contextVersion = ++contextSequence.current;
    const valid = () => version === epoch.current && identity.current !== null;
    const assertCurrent = () => { if (!valid()) throw new Error('obsolete-session'); };
    const task = (async (): Promise<LoginOutcome> => {
    setLoading(true);
    setError(null);
    setOnboardingError(null);
    try {
      let currentProfile: UsuarioPortal;
      try {
        currentProfile = await api.getProfile();
        assertCurrent();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          const contextoCompletado = await completarOnboarding();
          assertCurrent();
          if (!contextoCompletado) {
            setProfile(null);
            setContext(null);
            setNeedsProfile(true);
            window.sessionStorage.removeItem(CACHE_KEY);
            return { needsProfile: true, context: null };
          }
          currentProfile = await api.getProfile();
        assertCurrent();
        } else {
          throw err;
        }
      }

      let currentContext = await api.getContext();
      assertCurrent();
      if (!currentContext.es_admin_sistema && currentContext.membresias.length === 0) {
        const contextoCompletado = await completarOnboarding();
          assertCurrent();
        if (contextoCompletado) {
          currentContext = contextoCompletado;
        }
      }

      if (contextVersion !== contextSequence.current) return {needsProfile:false,context:null};
      setProfile(currentProfile);
      setContext(currentContext);
      setNeedsProfile(false);
      setOnboardingError(null);

      return { needsProfile: false, context: currentContext };
    } catch (err) {
      if (!valid()) return {needsProfile: false, context: null};
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
      if (valid()) setLoading(false);
    }
    })();
    pending.current = task;
    void task.finally(() => { if (pending.current === task) pending.current = null; });
    return task;
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
    if (!outcome.needsProfile && identity.current === currentSession.user.id) {
      loadedUser.current = currentSession.user.id;
    }
  }, [clear, loadSessionData]);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!active || receivedAuthEvent) return;
      acceptSession(data.session);
      if (data.session) {
        void hydrate(data.session);
      } else {
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!active) return;
        receivedAuthEvent = true;
        acceptSession(currentSession);
        if (currentSession) {
          queueMicrotask(() => { if (active) void hydrate(currentSession); });
        } else {
          clear();
          setLoading(false);
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [hydrate, acceptSession, clear]);

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
      acceptSession(data.session);
      const outcome = await loadSessionData();
      if (identity.current === data.session?.user.id) loadedUser.current = data.session?.user.id ?? null;
      return outcome;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadSessionData, acceptSession]);

  const signOut = useCallback(async () => {
    clear();
    setSession(null);
    await supabase.auth.signOut();
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
    const version = epoch.current;
    const sequence = ++contextSequence.current;
    const currentContext = await api.getContext();
    if (version !== epoch.current || sequence !== contextSequence.current || !identity.current) return null;
    setContext(currentContext);
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

    function actualizarSilenciosamente(event: Event) {
      if (event.type === "benefy:contexto-invalidado") { setContext(null); clearPlanCache(); }
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
