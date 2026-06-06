import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canWrite, isOwner } from '@/lib/permissions'

export interface AdminContext {
  userId: string
  email: string | null
  role: string
  admin_level: string | null
  actor: { id: string; email: string | null }
}

type RequireOpts = { write?: boolean; owner?: boolean }

/**
 * Valida que quem chama é admin (autenticado) com o nível necessário.
 * Retorna { ctx } em caso de sucesso ou { error: NextResponse } caso contrário.
 *
 *  - write: true  → bloqueia nível "viewer" (somente leitura)
 *  - owner: true  → exige nível "owner"
 */
export async function requireAdmin(opts: RequireOpts = {}): Promise<{ ctx?: AdminContext; error?: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_level, email, active')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) }
  if (profile.active === false)  return { error: NextResponse.json({ error: 'Conta suspensa.' }, { status: 403 }) }

  if (opts.owner && !isOwner(profile.role, profile.admin_level)) {
    return { error: NextResponse.json({ error: 'Apenas o dono da conta pode fazer isto.' }, { status: 403 }) }
  }
  if (opts.write && !canWrite(profile.role, profile.admin_level)) {
    return { error: NextResponse.json({ error: 'Seu nível de acesso é somente leitura.' }, { status: 403 }) }
  }

  return {
    ctx: {
      userId: user.id,
      email: profile.email ?? user.email ?? null,
      role: profile.role,
      admin_level: profile.admin_level ?? null,
      actor: { id: user.id, email: profile.email ?? user.email ?? null },
    },
  }
}
