import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const initSupabase = (url: string, key: string): SupabaseClient => {
  supabaseInstance = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return supabaseInstance;
};

export const getSupabase = (): SupabaseClient | null => {
  return supabaseInstance;
};

export const SCANNER_EVENT = 'barcode_scanned';
