import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'
import { sendEmail, qrEmailHtml } from '@/lib/email'

const EVO_URL = process.env.EVOLUTION_API_URL
const EVO_KEY = process.env.EVOLUTION_API_KEY
const evoHeaders = { apikey: EVO_KEY || '', 'Content-Type': 'application/json' }

function slug(s: string) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}
function webhookUrl() {
  if (process.env.AGENT_WEBHOOK_URL) return process.env.AGENT_WEBHOOK_URL
  return (process.env.EVOLUTION_API_URL || '').replace(':8080', ':3000') + '/webhook'
}
const stripB64 = (s: string) => String(s || '').replace(/^data:image\/\w+;base64,/, '')

async function evoConnect(instance: string): Promise<{ ok: boolean; status: number; qr?: string }> {
  const r = await fetch(`${EVO_URL}/instance/connect/${instance}`, { headers: evoHeaders, cache: 'no-store' })
  if (!r.ok) return { ok: false, status: r.status }
  const d = await r.json().catch(() => ({}))
  return { ok: true, status: 200, qr: d.base64 || d.qrcode?.base64 || '' }
}
async function evoCreate(instance: string) {
  const r = await fetch(`${EVO_URL}/instance/create`, {
    method: 'POST', headers: evoHeaders,
    body: JSON.stringify({ instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
  })
  if (r.ok) {
    await fetch(`${EVO_URL}/webhook/set/${instance}`, {
      method: 'POST', headers: evoHeaders,
      body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl(), webhookByEvents: false, webhookBase64: false, events: ['MESSAGES_UPSERT'] } }),
    }).catch(() => {})
  }
  return r
}
async function evoStatus(instance: string): Promise<{ status: string; number: string | null }> {
  try {
    const r = await fetch(`${EVO_URL}/instance/fetchInstances`, { headers: evoHeaders, cache: 'no-store' })
    if (!r.ok) return { status: 'error', number: null }
    const data = await r.json()
    const inst = (Array.isArray(data) ? data : []).find((i: any) => i.name === instance)
    if (!inst) return { status: 'desconectado', number: null }
    const map: Record<string, string> = { open: 'conectado', connecting: 'aguardando', close: 'desconectado' }
    return { status: map[inst.connectionStatus] || inst.connectionStatus || 'desconhecido', number: inst.ownerJid ? String(inst.ownerJid).split('@')[0] : null }
  } catch { return { status: 'error', number: null } }
}

/** Resolve a instância do cliente (perfil → agente → slug da empresa). */
async function resolveClient(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  const { data: prof } = await admin.from('profiles').select('*').eq('id', clientId).eq('role', 'client').single()
  if (!prof) return null
  let instance: string | null = prof.whatsapp_instance || null
  if (!instance) {
    const { data: ags } = await admin.from('agents').select('config').eq('client_id', clientId).limit(1)
    instance = (ags?.[0]?.config as any)?.whatsapp_instance || null
  }
  if (!instance) instance = slug(prof.company_name || prof.email || '')
  return { prof, instance }
}

// grava de forma tolerante (coluna pode não existir antes de rodar 04_whatsapp.sql)
async function saveInstance(admin: ReturnType<typeof createAdminClient>, clientId: string, instance: string) {
  try { await admin.from('profiles').update({ whatsapp_instance: instance }).eq('id', clientId) } catch {}
}

// Cria um link seguro/temporário, individual da instância do cliente. O link
// só permite conectar (escanear QR) — não dá acesso ao admin nem a outros dados.
async function criarLink(admin: ReturnType<typeof createAdminClient>, instance: string, origin: string): Promise<{ url: string; token: string } | null> {
  try {
    const { data } = await admin.from('instance_connect_tokens').insert({ instance }).select('token').single()
    if (!data?.token) return null
    return { url: `${origin}/conectar/${data.token}`, token: data.token }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const { ctx, error: authError } = await requireAdmin({ write: true })
  if (authError) return authError
  if (!EVO_URL || !EVO_KEY) return NextResponse.json({ error: 'EVOLUTION_* não configurada.' }, { status: 500 })

  const { client_id, action, email } = await req.json().catch(() => ({}))
  if (!client_id || !action) return NextResponse.json({ error: 'client_id e action são obrigatórios.' }, { status: 400 })

  const admin = createAdminClient()
  const resolved = await resolveClient(admin, client_id)
  if (!resolved) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  const { prof, instance } = resolved

  try {
    // ── STATUS ───────────────────────────────────────────────
    if (action === 'status') {
      const st = await evoStatus(instance)
      if (st.status === 'conectado' && !prof.whatsapp_connected_at) {
        try { await admin.from('profiles').update({ whatsapp_connected_at: new Date().toISOString() }).eq('id', client_id) } catch {}
      }
      return NextResponse.json({ instance, ...st, lastConnection: prof.whatsapp_connected_at ?? null, lastSent: prof.whatsapp_qr_sent_at ?? null })
    }

    // ── LINK SEGURO PARA O CLIENTE ───────────────────────────
    if (action === 'link') {
      // garante a instância (cria se não existir)
      const c = await evoConnect(instance)
      if (!c.ok && (c.status === 404 || c.status === 400)) { await evoCreate(instance); await saveInstance(admin, client_id, instance) }
      else await saveInstance(admin, client_id, instance)
      const link = await criarLink(admin, instance, new URL(req.url).origin)
      if (!link) return NextResponse.json({ error: 'Não foi possível gerar o link seguro.' }, { status: 502 })
      await logAction(ctx!.actor, 'whatsapp.link', { entity: 'client', entityId: client_id, details: { instance, token: link.token } })
      return NextResponse.json({ connectUrl: link.url, token: link.token, instance })
    }

    // ── GERAR / RENOVAR QR ───────────────────────────────────
    if (action === 'qr' || action === 'new-qr') {
      let c = await evoConnect(instance)
      if (!c.ok && (c.status === 404 || c.status === 400)) {
        // instância não existe → cria, salva o ID e busca o QR
        const cr = await evoCreate(instance)
        let createdQr = ''
        if (cr.ok) {
          const created = await cr.json().catch(() => ({}))
          createdQr = (created as any)?.qrcode?.base64 || ''
        } else {
          const txt = await cr.text().catch(() => '')
          const jaExiste = txt.includes('already in use') || cr.status === 403 || cr.status === 409
          if (!jaExiste) return NextResponse.json({ error: 'Não foi possível criar a instância do cliente.' }, { status: 502 })
        }
        await saveInstance(admin, client_id, instance)
        c = createdQr ? { ok: true, status: 200, qr: createdQr } : await evoConnect(instance)
      } else {
        await saveInstance(admin, client_id, instance)
      }
      if (!c.ok) return NextResponse.json({ error: 'Não foi possível gerar o QR Code.' }, { status: 502 })
      const st = await evoStatus(instance)
      await logAction(ctx!.actor, action === 'new-qr' ? 'whatsapp.qr_renew' : 'whatsapp.qr', { entity: 'client', entityId: client_id, details: { instance } })
      return NextResponse.json({ instance, qr: c.qr || '', status: st.status, number: st.number })
    }

    // ── RECONECTAR SESSÃO (restart) ──────────────────────────
    if (action === 'restart') {
      const r = await fetch(`${EVO_URL}/instance/restart/${instance}`, { method: 'POST', headers: evoHeaders })
      if (!r.ok) return NextResponse.json({ error: 'Não foi possível reconectar a sessão.' }, { status: 502 })
      await logAction(ctx!.actor, 'whatsapp.restart', { entity: 'client', entityId: client_id, details: { instance } })
      // dá um tempo para o socket reabrir e devolve o status novo
      await new Promise(res => setTimeout(res, 3500))
      const st = await evoStatus(instance)
      return NextResponse.json({ ok: true, ...st })
    }

    // ── DESCONECTAR (encerra e APAGA a sessão de verdade) ────
    if (action === 'disconnect') {
      // 1) logout: encerra a conexão ativa (desvincula o aparelho)
      await fetch(`${EVO_URL}/instance/logout/${instance}`, { method: 'DELETE', headers: evoHeaders }).catch(() => {})
      // 2) delete: remove a instância e TODAS as credenciais/sessão salvas,
      //    impedindo reconexão automática sem novo QR.
      const del = await fetch(`${EVO_URL}/instance/delete/${instance}`, { method: 'DELETE', headers: evoHeaders })
      if (!del.ok && del.status !== 404) {
        const txt = await del.text().catch(() => '')
        console.error('[admin/whatsapp] delete falhou:', del.status, txt)
        return NextResponse.json({ error: 'Não foi possível desconectar/remover a sessão.' }, { status: 502 })
      }
      // 3) status no banco = desconectado (mantém o nome da instância p/ recriar)
      try { await admin.from('profiles').update({ whatsapp_connected_at: null }).eq('id', client_id) } catch {}
      await logAction(ctx!.actor, 'whatsapp.disconnect', { entity: 'client', entityId: client_id, details: { instance, removed: true } })
      return NextResponse.json({ ok: true, status: 'desconectado' })
    }

    // ── ENVIAR QR POR E-MAIL ─────────────────────────────────
    if (action === 'send-qr') {
      const dest = String(email || prof.email || '').trim()
      if (!dest) return NextResponse.json({ error: 'Este cliente não possui um e-mail cadastrado. Adicione um e-mail ao perfil para continuar.' }, { status: 400 })
      let c = await evoConnect(instance)
      if (!c.ok) { await evoCreate(instance); await saveInstance(admin, client_id, instance); c = await evoConnect(instance) }
      else await saveInstance(admin, client_id, instance)
      const b64 = c.qr ? stripB64(c.qr) : ''
      const link = await criarLink(admin, instance, new URL(req.url).origin)
      const result = await sendEmail({
        to: dest,
        subject: 'Conecte seu WhatsApp à Bonsync',
        html: qrEmailHtml({ companyName: prof.company_name || 'cliente', connectUrl: link?.url || null, hasQr: !!b64 }),
        attachments: b64 ? [{ filename: 'qrcode-whatsapp.png', content: b64, content_id: 'qrcode' }] : undefined,
      })
      if (!result.ok) return NextResponse.json({ error: result.error || 'Falha ao enviar o e-mail.' }, { status: 502 })
      const sentAt = new Date().toISOString()
      try { await admin.from('profiles').update({ whatsapp_qr_sent_at: sentAt }).eq('id', client_id) } catch {}
      await logAction(ctx!.actor, 'whatsapp.qr_email', { entity: 'client', entityId: client_id, details: { instance, email: dest, token: link?.token ?? null, status: 'enviado' } })
      return NextResponse.json({ ok: true, email: dest, connectUrl: link?.url || null, sentAt })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/whatsapp]', action, err?.message)
    return NextResponse.json({ error: 'Falha ao processar a ação.' }, { status: 500 })
  }
}
