import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Session, type User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import {
  ApiError,
  eliminarCuenta as eliminarCuentaApi,
  type EliminarCuentaResultado,
} from '../lib/api';
import { cargarPerfil } from '../lib/profile';
import { queryKeys } from '../lib/queryKeys';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: boolean;
  recovering: boolean;
  retryProfile: () => void;
  beginRecovery: () => void;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
  deleteAccount: (confirmacion: string) => Promise<EliminarCuentaResultado>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  profileLoading: false,
  profileError: false,
  recovering: false,
  retryProfile: () => {},
  beginRecovery: () => {},
  finishRecovery: () => {},
  signOut: async () => {},
  deleteAccount: async () => {
    throw new Error('Sesión no disponible.');
  },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(
      ({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      },
      () => {
        if (active) setLoading(false);
      },
    );
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        if (event === 'PASSWORD_RECOVERY') setRecovering(true);
        if (event === 'SIGNED_OUT') {
          setRecovering(false);
          queryClient.clear();
        }
        setLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [queryClient]);

  const perfilQuery = useQuery({
    queryKey: queryKeys.perfil(session?.user.id),
    queryFn: () => {
      if (!session) throw new ApiError(401, 'Tu sesión terminó.', 'sin_sesion');
      return cargarPerfil(
        session.access_token,
        session.user.user_metadata as Record<string, unknown>,
        session.user.email ?? '',
      );
    },
    enabled: !!session && !recovering,
  });

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    queryClient.clear();
  }, [queryClient]);

  const deleteAccount = useCallback(async (confirmacion: string) => {
    if (!session?.access_token) {
      throw new ApiError(401, 'Tu sesión terminó.', 'sin_sesion');
    }
    const resultado = await eliminarCuentaApi(confirmacion, session.access_token);
    queryClient.clear();
    try {
      await supabase.auth.signOut();
    } catch {
      // La identidad ya fue revocada en el servidor o se revocará al reintentar.
    }
    return resultado;
  }, [queryClient, session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profileLoading: !!session && !recovering && perfilQuery.isPending,
        profileError: !!session && !recovering && perfilQuery.isError && !perfilQuery.data,
        recovering,
        retryProfile: () => { void perfilQuery.refetch(); },
        beginRecovery: () => setRecovering(true),
        finishRecovery: () => setRecovering(false),
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
