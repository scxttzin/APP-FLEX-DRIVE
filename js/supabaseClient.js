/* ============================================================
   Cliente Supabase (carregado via ESM CDN).
   Só é inicializado quando há credenciais em config.js.
   ============================================================ */
import { CONFIG, IS_DEMO } from './config.js';

let _client = null;

export async function getSupabase() {
  if (IS_DEMO) return null;
  if (_client) return _client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}
