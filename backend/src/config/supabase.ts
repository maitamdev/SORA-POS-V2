import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Lazy init Supabase client
 * Tránh crash khi chưa có config
 */
function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      throw new Error(
        '❌ SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình trong .env'
      );
    }
    supabaseInstance = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('✅ Supabase client initialized');
  }
  return supabaseInstance;
}

/**
 * Proxy pattern: cho phép import `supabase` và dùng ngay
 * mà không cần gọi init() thủ công
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getSupabase(), prop);
  },
});
