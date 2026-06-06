import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { ctx, error: authError } = await requireAdmin({ write: true })
    if (authError) return authError

    const { client_id, new_password } = await req.json()
    if (!client_id || !new_password) {
      return NextResponse.json({ error: 'client_id e new_password são obrigatórios.' }, { status: 400 })
    }
    if (new_password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(client_id, { password: new_password })

    if (error) {
      console.error('[reset-password]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logAction(ctx!.actor, 'client.reset_pwd', { entity: 'client', entityId: client_id })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[reset-password] erro:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
