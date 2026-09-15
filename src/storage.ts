import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
export type Profile = { name: string; coins: number; games: number; wins: number; lastBonus: string; vibration: boolean; quick: boolean; theme: 'green' | 'blue' | 'plum' };
const defaults: Profile = { name: 'Misafir', coins: 12500, games: 0, wins: 0, lastBonus: '', vibration: true, quick: false, theme: 'green' };
type ProfileRow = { id: string } & Profile & { last_bonus?: string };
const fromRow = (row: Partial<ProfileRow>): Profile => ({ ...defaults, name: typeof row.name === 'string' ? row.name : defaults.name, coins: Number.isFinite(row.coins) ? Number(row.coins) : defaults.coins, games: Number.isFinite(row.games) ? Number(row.games) : defaults.games, wins: Number.isFinite(row.wins) ? Number(row.wins) : defaults.wins, lastBonus: typeof row.last_bonus === 'string' ? row.last_bonus : defaults.lastBonus, vibration: typeof row.vibration === 'boolean' ? row.vibration : defaults.vibration, quick: typeof row.quick === 'boolean' ? row.quick : defaults.quick, theme: row.theme === 'blue' || row.theme === 'plum' ? row.theme : 'green' });
const toRow = (profile: Profile, userId: string) => ({ id: userId, name: profile.name, coins: profile.coins, games: profile.games, wins: profile.wins, last_bonus: profile.lastBonus, vibration: profile.vibration, quick: profile.quick, theme: profile.theme });
export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<Profile>(defaults);
  const [ready, setReady] = useState(!userId || !supabase);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    if (userId && supabase) {
      const client = supabase;
      client.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data, error }) => {
        if (!active) return;
        if (error) setStorageError(true);
        if (data) setProfile(fromRow(data as ProfileRow));
        setReady(true);
      }, () => { if (active) { setStorageError(true); setReady(true); } });
    } else {
      AsyncStorage.getItem('keyif-profile-v1').then(raw => {
        if (!active || !raw) return;
        try {
          const saved = JSON.parse(raw);
          if (typeof saved.name === 'string' && Number.isFinite(saved.coins) && Number.isFinite(saved.games) && Number.isFinite(saved.wins)) setProfile({ ...defaults, ...saved });
        } catch { setStorageError(true); }
      }).catch(() => { if (active) setStorageError(true); }).finally(() => { if (active) setReady(true); });
    }
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (!ready) return;
    if (userId && supabase) {
      const client = supabase;
      const timeout = setTimeout(() => { client.from('profiles').upsert(toRow(profile, userId), { onConflict: 'id' }).then(({ error }) => { if (error) setStorageError(true); }); }, 350);
      return () => clearTimeout(timeout);
    }
    AsyncStorage.setItem('keyif-profile-v1', JSON.stringify(profile)).catch(() => setStorageError(true));
  }, [profile, ready, userId]);
  return { profile, setProfile, ready, storageError };
}
export function todayKey() { const date = new Date(); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
