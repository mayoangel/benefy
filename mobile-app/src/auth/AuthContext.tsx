import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  benefyUser: unknown;
  loading: boolean;
  recovering: boolean;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  benefyUser: null,
  loading: true,
  recovering: false,
  finishRecovery: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ userId: string; data: unknown }>();
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        if (event === 'PASSWORD_RECOVERY') setRecovering(true);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setRecovering(false);
        if (event === 'SIGNED_OUT') setProfile(undefined);
        setLoading(false);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const api = process.env.EXPO_PUBLIC_API_URL;
    if (!api || !session || recovering) return;
    const request = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${api.replace(/\/$/, '')}/v1/autenticacion/perfil/`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: request.signal,
        });
        if (response.ok) {
          const data: unknown = await response.json();
          if (!request.signal.aborted) setProfile({ userId: session.user.id, data });
        }
      } catch (error) {
        if (!request.signal.aborted) console.warn('No se pudo consultar el perfil de Django:', error);
      }
    })();
    return () => request.abort();
  }, [session, recovering]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        benefyUser: profile && profile.userId === session?.user.id ? profile.data : null,
        loading,
        recovering,
        finishRecovery: () => setRecovering(false),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
