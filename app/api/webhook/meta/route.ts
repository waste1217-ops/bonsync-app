import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook da WhatsApp Cloud API (Meta).
 * URL para configurar no app da Meta:
 *   https://app.bonsync.com.br/api/webhook/meta
 *
 * A Meta exige HTTPS — por isso o webhook entra pela Vercel. Aqui só validamos
 * e REPASSAMOS o evento para o agente na VPS (o cérebro único, com todos os
 * recursos). O agente responde pela Cloud API endereçando por número real.
 *
 * Variáveis de ambiente (Vercel → Project Settings → Environment Variables):
 *   META_VERIFY_TOKEN      — a mesma frase configurada no webhook da Meta
 *   AGENT_META_URL         — ex.: http://IP_DA_VPS:3001/meta
 *   BONSYNC_WEBHOOK_SECRET — segredo compartilhado com a VPS (header x-bonsync-secret)
 */
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN
const AGENT_META_URL = process.env.AGENT_META_URL
const WEBHOOK_SECRET = process.env.BONSYNC_WEBHOOK_SECRET

// 1) Verificação do webhook — a Meta faz um GET com hub.challenge
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const mode = sp.get('hub.mode')
  const token = sp.get('hub.verify_token')
  const challenge = sp.get('hub.challenge')
  if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  console.warn('[meta-webhook] verificação falhou (verify_token incorreto)')
  return new NextResponse('forbidden', { status: 403 })
}

// 2) Eventos (mensagens + status) → repassa para a VPS e responde 200 rápido.
// Sempre retorna 200 para a Meta não reenviar (o processamento é assíncrono na VPS).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (AGENT_META_URL && body) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      await fetch(AGENT_META_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WEBHOOK_SECRET ? { 'x-bonsync-secret': WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      clearTimeout(t)
    } catch (e) {
      console.error('[meta-webhook] falha ao repassar p/ a VPS:', (e as Error)?.message)
    }
  } else if (!AGENT_META_URL) {
    console.error('[meta-webhook] AGENT_META_URL não configurada — evento descartado')
  }
  return NextResponse.json({ ok: true })
}
