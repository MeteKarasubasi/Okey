import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase bağlantısı yapılandırılmamış.' };
    setError('');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
    return result;
  };
  const signUp = async (email: string, password: string, name: string) => {
    if (!supabase) return { error: 'Supabase bağlantısı yapılandırılmamış.' };
    setError('');
    const result = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (result.error) setError(result.error.message);
    return result;
  };
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  };
  return { user: session?.user ?? null, session, loading, error, setError, signIn, signUp, signOut };
}

export type AuthUser = User;
