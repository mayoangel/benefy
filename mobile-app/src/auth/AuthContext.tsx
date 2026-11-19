import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  benefyUser: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  benefyUser: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [benefyUser, setBenefyUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const syncWithBackend = async (currentSession: Session | null) => {
    if (!currentSession) {
      setBenefyUser(null);
      return;
    }

    try {
      const meta = currentSession.user.user_metadata || {};
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/v1/auth/sync/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          nombre: meta.nombre || '',
          apellido: meta.apellido || '',
          telefono: meta.telefono || null,
          rol: meta.rol || 'consumidor',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBenefyUser(data.usuario ?? data);
      }
    } catch (err) {
      console.warn('Error sincronizando usuario con Django:', err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await syncWithBackend(session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        await syncWithBackend(newSession);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setBenefyUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        benefyUser,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);