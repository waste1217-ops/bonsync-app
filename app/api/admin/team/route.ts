import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'
import { effectiveLevel, type AdminLevel } from '@/lib/permissions'

const VALID: AdminLevel[] = ['owner', 'manager', 'viewer']

// Cria um novo membro da equipe (admin)
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAdmin({ owner: true })
  if (error) return error

  const { email, password, name, admin_level } = await req.json()
  if (!email || !password || !name) return NextResponse.json({ error: 'Campos obrigatórios: nome, email e senha.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
  const level: AdminLevel = VALID.includes(admin_level) ? admin_level : 'manager'

  const admin = createAdminClient()
  const { data: newUser, error: e1 } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { company_name: name },
  })
  if (e1) {
    if (e1.message.includes('already registered')) return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    return NextResponse.json({ error: e1.message }, { status: 400 })
  }

  await admin.from('profiles').upsert({
    id: newUser.user!.id, email, role: 'admin', admin_level: level, company_name: name, active: true,
  }, { onConflict: 'id' })

  await logAction(ctx!.actor, 'team.create', { entity: 'admin', entityId: newUser.user!.id, details: { email, admin_level: level } })
  return NextResponse.json({ success: true, id: newUser.user!.id })
}

// Atualiza nível ou status de um membro
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireAdmin({ owner: true })
  if (error) return error

  const { target_id, admin_level, active } = await req.json()
  if (!target_id) return NextResponse.json({ error: 'target_id obrigatório.' }, { status: 400 })
  if (target_id === ctx!.userId) return NextResponse.json({ error: 'Você não pode alterar a própria conta aqui.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: alvo } = await admin.from('profiles').select('role, admin_level, email').eq('id', target_id).single()
  if (!alvo || alvo.role !== 'admin') return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
  if (effectiveLevel(alvo.role, alvo.admin_level) === 'owner') {
    return NextResponse.json({ error: 'Contas "Dono" não podem ser alteradas por aqui (proteção).' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (admin_level !== undefined) {
    if (!VALID.includes(admin_level)) return NextResponse.json({ error: 'Nível inválido.' }, { status: 400 })
    patch.admin_level = admin_level
  }
  if (active !== undefined) patch.active = Boolean(active)
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })

  const { error: e2 } = await admin.from('profiles').update(patch).eq('id', target_id)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })

  await logAction(ctx!.actor, 'team.update', { entity: 'admin', entityId: target_id, details: { ...patch, target_email: alvo.email } })
  return NextResponse.json({ success: true })
}
