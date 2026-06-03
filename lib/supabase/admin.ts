import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service_role key.
 * NUNCA use no browser — somente em Server Components, API Routes e Server Actions.
 * Bypassa o RLS e tem acesso total ao banco.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Variáveis de ambiente do Supabase Admin não configuradas.')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
