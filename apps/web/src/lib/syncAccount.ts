import { supabase, hasSupabaseConfig } from './supabase';

export interface SyncAccountState {
  email: string | null;
  isConfigured: boolean;
}

export async function getSyncAccountState(): Promise<SyncAccountState> {
  if (!supabase) {
    return { email: null, isConfigured: false };
  }

  const { data } = await supabase.auth.getUser();
  return {
    email: data.user?.email ?? null,
    isConfigured: hasSupabaseConfig(),
  };
}

export async function signUpForSync(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) {
    throw new Error('Account created, but email confirmation is required before sync can be enabled.');
  }
  return data;
}

export async function signInForSync(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('Sign-in did not create a session.');
  return data;
}

export async function signOutSync() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
