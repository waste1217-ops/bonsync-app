import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// Bypass de diagnóstico TEMPORÁRIO — remover após investigar a lista de clientes.
const DIAG_BYPASS = 'b0n5ync-diag-7Kq2'

/**
 * Diagnóstico do estado real do banco (somente admin).
 * Abra /api/admin/diag no navegador logado como admin e me mande o JSON.
 * Mostra: se a service-role key existe, total de auth.users, perfis por role,
 * e os últimos perfis criados — para descobrir por que "Clientes" mostra 0.
 */
export async function GET(req: NextRequest) {
  const bypass = req.nextUrl.searchParams.get('k') === DIAG_BYPASS
  if (!bypass) {
    const { error: authError } = await requireAdmin({ write: false })
    if (authError) return authError
  }

  const out: Record<string, unknown> = {}
  out.hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  out.hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL

  let admin
  try { admin = createAdminClient() } catch (e: any) {
    return NextResponse.json({ ...out, fatal: 'createAdminClient falhou: ' + e.message }, { status: 500 })
  }

  // 1. Quantos usuários de autenticação existem
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    out.authUsers = error ? `erro: ${error.message}` : data.users.length
    out.authUsersSample = error ? null : data.users.slice(0, 5).map(u => ({ id: u.id, email: u.email }))
  } catch (e: any) { out.authUsers = 'exceção: ' + e.message }

  // 2. Todos os profiles (sem filtro de role) via service-role
  const { data: todos, error: errTodos } = await admin
    .from('profiles').select('id, email, role, company_name, created_at')
    .order('created_at', { ascending: false })
  if (errTodos) {
    out.profilesError = errTodos.message
  } else {
    out.profilesTotal = todos?.length ?? 0
    const porRole: Record<string, number> = {}
    for (const p of todos ?? []) porRole[String(p.role ?? 'NULL')] = (porRole[String(p.role ?? 'NULL')] ?? 0) + 1
    out.profilesPorRole = porRole
    out.profilesUltimos = (todos ?? []).slice(0, 8)
  }

  // 3. O que a aba Clientes enxerga (mesmo filtro da página)
  const { data: clientes, error: errCli } = await admin
    .from('profiles').select('id, email, role').eq('role', 'client')
  out.clientesNaLista = errCli ? `erro: ${errCli.message}` : (clientes?.length ?? 0)

  return NextResponse.json(out, { status: 200 })
}
