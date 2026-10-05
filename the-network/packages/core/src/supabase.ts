import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function initSupabase(url: string, anonKey: string): void {
  _client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  })
}

function getClient(): SupabaseClient {
  if (!_client) {
    const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined
    const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined
    if (url && key) {
      initSupabase(url, key)
    } else {
      throw new Error('Supabase not configured — call initSupabase(url, anonKey) before using the client.')
    }
  }
  return _client!
}

// Proxy defers client creation until first property access, so the module
// can be imported before initSupabase() is called (e.g. in Electron setup flow).
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
})
