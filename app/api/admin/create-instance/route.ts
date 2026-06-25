import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'

function webhookUrl() {
  if (process.env.AGENT_WEBHOOK_URL) return process.env.AGENT_WEBHOOK_URL
  const base = process.env.EVOLUTION_API_URL || ''
  return base.replace(':8080', ':3000') + '/webhook'
}

export async function POST(req: NextRequest) {
  const { ctx, error: authError } = await requireAdmin({ write: true })
  if (authError) return authError

  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return NextResponse.json({ error: 'EVOLUTION_* não configurada.' }, { status: 500 })

  const { name } = await req.json()
  const instance = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!instance) return NextResponse.json({ error: 'Nome inválido. Use letras, números, - ou _.' }, { status: 400 })

  const headers = { apikey: key, 'Content-Type': 'application/json' }

  try {
    // 1. Cria a instância (já pede QR)
    const createRes = await fetch(`${url}/instance/create`, {
      method: 'POST', headers,
      body: JSON.stringify({ instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
    })
    if (!createRes.ok) {
      const txt = await createRes.text()
      if (txt.includes('already in use') || createRes.status === 403 || createRes.status === 409) {
        return NextResponse.json({ error: 'Já existe uma instância com esse nome.' }, { status: 409 })
      }
      return NextResponse.json({ error: `Erro ao criar (${createRes.status}).` }, { status: 502 })
    }

    // 2. Configura o webhook para o agente
    await fetch(`${url}/webhook/set/${instance}`, {
      method: 'POST', headers,
      body: JSON.stringify({
        webhook: { enabled: true, url: webhookUrl(), webhookByEvents: false, webhookBase64: false, events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'] },
      }),
    })

    // 3. Garante o QR
    let qr = ''
    const created = await createRes.json().catch(() => ({}))
    if (created?.qrcode?.base64) qr = created.qrcode.base64
    if (!qr) {
      const conn = await fetch(`${url}/instance/connect/${instance}`, { headers, cache: 'no-store' })
      if (conn.ok) { const d = await conn.json(); qr = d.base64 || d.qrcode?.base64 || '' }
    }

    // 4. Cria token de conexão pública (link ao vivo para o cliente escanear)
    let connectUrl: string | null = null
    try {
      const admin = createAdminClient()
      const { data: tok } = await admin
        .from('instance_connect_tokens')
        .insert({ instance })
        .select('token')
        .single()
      if (tok) connectUrl = `${new URL(req.url).origin}/conectar/${tok.token}`
    } catch (e) { /* token é opcional */ }

    await logAction(ctx!.actor, 'instance.create', { entity: 'instance', entityId: instance })
    return NextResponse.json({ success: true, instance, qr, connectUrl })
  } catch (err: any) {
    console.error('[create-instance]', err.message)
    return NextResponse.json({ error: 'Falha ao criar instância.' }, { status: 500 })
  }
}
