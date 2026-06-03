import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // 1. Verifica se quem chama é um admin autenticado
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

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

    // 4. Garante que o profile foi criado corretamente (o trigger já faz isso,
    //    mas fazemos upsert como segurança)
    await adminClient.from('profiles').upsert({
      id:           newUser.user!.id,
      email,
      role:         'client',
      company_name,
    }, { onConflict: 'id' })

    return NextResponse.json({
      success: true,
      user_id: newUser.user!.id,
      message: `Cliente "${company_name}" criado com sucesso.`,
    })

  } catch (err: any) {
    console.error('[create-user]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
