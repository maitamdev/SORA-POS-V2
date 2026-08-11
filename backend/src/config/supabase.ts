import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let supabaseInstance: SupabaseClient | null = null;
const SUPABASE_REQUEST_TIMEOUT_MS = 12_000;

const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController();
  let timedOut = false;
  const parentSignal = init.signal;
  const abortFromParent = () => controller.abort();

  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`Supabase request timed out after ${SUPABASE_REQUEST_TIMEOUT_MS}ms`);
      timeoutError.name = 'SupabaseTimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
};

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
      global: { fetch: fetchWithTimeout },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    if (env.isLocalDevelopment) {
      console.log('Supabase client initialized');
    }
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
