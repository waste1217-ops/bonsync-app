import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    // 1. Verifica admin com permissão de escrita
    const { ctx, error: authError } = await requireAdmin({ write: true })
    if (authError) return authError

    // 2. Lê os dados do body
    const { email, password, company_name } = await req.json()

    if (!email || !password || !company_name) {
      return NextResponse.json({ error: 'Campos obrigatórios: email, password, company_name.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    // 3. Cria o usuário com service_role (sem e-mail de confirmação, já ativo)
    const adminClient = createAdminClient()

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,           // confirma automaticamente, sem e-mail
      user_metadata: { company_name },
    })

    if (createError) {
      // Erro mais amigável para e-mail duplicado
      if (createError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const uid = newUser.user!.id
    console.log('[create-user] auth user criado:', uid, email)

    // 4. Garante o profile com role=client. Tenta upsert; se falhar, reporta de verdade.
    const { error: upErr } = await adminClient.from('profiles').upsert({
      id: uid, email, role: 'client', company_name,
    }, { onConflict: 'id' })
    if (upErr) {
      console.error('[create-user] upsert profile FALHOU:', upErr.message)
      // tenta UPDATE direto (caso a linha já exista via trigger) antes de desistir
      const { error: updErr } = await adminClient.from('profiles')
        .update({ role: 'client', company_name, email }).eq('id', uid)
      if (updErr) {
        console.error('[create-user] update profile também falhou:', updErr.message)
        return NextResponse.json({ error: 'Cliente autenticado, mas o perfil não foi salvo: ' + upErr.message }, { status: 500 })
      }
    }

    // 5. Verifica que o perfil realmente existe com role=client (sem isso, ele não aparece na lista)
    const { data: check } = await adminClient.from('profiles').select('id, role').eq('id', uid).single()
    if (!check) {
      console.error('[create-user] perfil não encontrado após criação:', uid)
      return NextResponse.json({ error: 'O perfil do cliente não foi persistido. Verifique a tabela profiles / triggers.' }, { status: 500 })
    }
    if (check.role !== 'client') {
      // trigger pode ter definido outro role — força client
      await adminClient.from('profiles').update({ role: 'client' }).eq('id', uid)
      console.warn('[create-user] role corrigido para client (estava:', check.role, ')')
    }
    console.log('[create-user] ✓ perfil confirmado com role=client:', uid)

    await logAction(ctx!.actor, 'client.create', { entity: 'client', entityId: uid, details: { email, empresa: company_name } })

    return NextResponse.json({
      success: true,
      user_id: uid,
      message: `Cliente "${company_name}" criado com sucesso.`,
    })

  } catch (err: any) {
    console.error('[create-user]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
