/**
 * Cliente para Evolution API v2
 * Abstrai o envio/recebimento de mensagens WhatsApp.
 * Trocar por Meta API no futuro = só mudar este arquivo.
 */

const BASE_URL = process.env.EVOLUTION_API_URL!
const API_KEY  = process.env.EVOLUTION_API_KEY!

const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
}

/**
 * Resolve o alvo de envio a partir de um identificador de contato.
 * - Contatos @lid: o JID NÃO é telefone; o Evolution roteia pelo próprio
 *   "<id>@lid" (mesma lógica do agente da VPS). Mantemos o @lid.
 * - Números: remove formatação (espaços, traços, parênteses, +) e, para
 *   Brasil, adiciona o 55 quando vier só com DDD + número.
 * Retorna { ok:false, code } para vazio/indefinido/ID inválido.
 */
export function toSendTarget(raw?: string | null):
  | { ok: true; target: string; original: string }
  | { ok: false; code: 'NO_PHONE' | 'INVALID_NUMBER'; original: string } {
  const original = String(raw ?? '')
  const s = original.trim()
  if (!s || s === 'undefined' || s === 'null') return { ok: false, code: 'NO_PHONE', original }

  if (s.includes('@lid')) {
    const id = s.split('@')[0].split(':')[0].replace(/\D/g, '')
    if (id.length < 8) return { ok: false, code: 'INVALID_NUMBER', original }
    return { ok: true, target: `${id}@lid`, original }
  }

  let d = s.replace('@s.whatsapp.net', '').replace('@g.us', '').split(':')[0].replace(/\D/g, '')
  if (!d) return { ok: false, code: 'INVALID_NUMBER', original }
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d  // Brasil: DDD + número
  if (d.length < 11 || d.length > 15) return { ok: false, code: 'INVALID_NUMBER', original }
  return { ok: true, target: d, original }
}

/** Normaliza um JID para uso interno (matching de contato). */
function normalizeJid(jid: string): string {
  const r = toSendTarget(jid)
  return r.ok ? r.target : ''
}

/**
 * Envia mensagem de texto — Evolution API v2.
 * Loga número original, normalizado, endpoint, status e resposta (sem o texto).
 * Lança Error com marcador para o chamador mapear a causa:
 *  - "SEND_TARGET:NO_PHONE" / "SEND_TARGET:INVALID_NUMBER"
 *  - "Evolution API <status>: <body>" / "Evolution API 0: network"
 */
export async function sendText(instance: string, to: string, text: string) {
  const endpoint = `${BASE_URL}/message/sendText/${instance}`
  const r = toSendTarget(to)
  if (!r.ok) {
    console.error('[evolution] alvo inválido', JSON.stringify({ original: r.original, code: r.code, instance }))
    throw new Error(`SEND_TARGET:${r.code}`)
  }
  const number = r.target
  console.log('[evolution] sendText →', JSON.stringify({ original: r.original, target: number, endpoint, instance, textLen: text.length }))

  async function attempt(): Promise<{ status: number; body: string }> {
    let res: Response
    try {
      res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ number, text }) })
    } catch (e: any) {
      console.error('[evolution] sem conexão com a API:', e?.message)
      throw new Error('Evolution API 0: network')
    }
    const body = await res.text()
    return { status: res.status, body }
  }

  let { status, body } = await attempt()
  console.log('[evolution] resposta', JSON.stringify({ target: number, status, body: body.slice(0, 500) }))

  // Autocura: sessão "open mas socket morto" (500 Connection Closed) → restart + 1 retry
  if (status === 500 && /connection closed|connection is closed|socket/i.test(body)) {
    console.warn('[evolution] sessão caída — reiniciando instância e reenviando…', JSON.stringify({ instance }))
    await fetch(`${BASE_URL}/instance/restart/${instance}`, { method: 'POST', headers }).catch(() => {})
    await new Promise(r => setTimeout(r, 4000))
    const retry = await attempt()
    status = retry.status; body = retry.body
    console.log('[evolution] resposta (após restart)', JSON.stringify({ target: number, status, body: body.slice(0, 500) }))
  }

  if (status < 200 || status >= 300) throw new Error(`Evolution API ${status}: ${body}`)
  try { return JSON.parse(body) } catch { return {} }
}

/** Tipos do payload de webhook da Evolution API v2 */
export interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string   // "5511999999999@s.whatsapp.net" ou "@lid"
      fromMe: boolean
      id: string
    }
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
      imageMessage?: { caption?: string }
      audioMessage?: object
      documentMessage?: object
      stickerMessage?: object
    }
    messageType?: string
    messageTimestamp: number
    pushName?: string
  }
}

/** Extrai o texto de uma mensagem (vários formatos possíveis) */
export function extractText(payload: EvolutionWebhookPayload): string | null {
  const msg = payload.data?.message
  if (!msg) return null
  return (
    msg.conversation                 ||
    msg.extendedTextMessage?.text    ||
    msg.imageMessage?.caption        ||
    null
  )
}

/**
 * Verifica se é uma mensagem de entrada válida para processar.
 * Ignora: mensagens próprias, grupos, status/broadcast, @lid sem texto.
 */
export function isIncomingMessage(payload: EvolutionWebhookPayload): boolean {
  if (payload.event !== 'messages.upsert') return false

  const { remoteJid, fromMe } = payload.data?.key ?? {}

  if (fromMe)                              return false  // enviada pelo bot
  if (!remoteJid)                          return false
  if (remoteJid.endsWith('@g.us'))         return false  // grupos
  if (remoteJid === 'status@broadcast')    return false  // status do WA

  return true
}

/** Retorna o número normalizado de um payload */
export function getSenderNumber(payload: EvolutionWebhookPayload): string {
  return normalizeJid(payload.data.key.remoteJid)
}
