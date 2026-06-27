import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit'

/**
 * Cria uma venda manual no faturamento do PRÓPRIO cliente.
 * Verifica a posse pela sessão e insere via service-role (evita depender de
 * policy de INSERT em deals). Isolada por agent_id do cliente.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user.id).single()
  if (!agent) return NextResponse.json({ error: 'Nenhum agente encontrado para esta conta.' }, { status: 404 })

  const status = ['confirmed', 'pending'].includes(b.status) ? b.status : 'confirmed'
  const now = new Date().toISOString()
  const admin = createAdminClient()
  const row: any = {
    agent_id: agent.id,
    empresa:         b.cliente || null,
    contato_nome:    b.contato || null,
    contact_identifier: b.telefone || null,
    produto:         b.produto || null,
    valor:           b.valor || null,
    resumo:          b.observacoes || null,
    forma_pagamento: b.forma_pagamento || null,
    status,
    detected_at: now,
    confirmed_at: status === 'confirmed' ? now : null,
  }
  let { data, error } = await admin.from('deals').insert(row).select('*').single()
  if (error && /forma_pagamento|column .* does not exist/i.test(error.message)) {
    delete row.forma_pagamento
    ;({ data, error } = await admin.from('deals').insert(row).select('*').single())
  }
  if (error) { console.error('[venda]', error.message); return NextResponse.json({ error: 'Não foi possível registrar a venda.' }, { status: 500 }) }

  await logAction({ id: user.id, email: user.email ?? null }, 'venda.create', { entity: 'client', entityId: user.id, details: { valor: b.valor || null, status } })
  return NextResponse.json({ success: true, deal: data })
}
