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
 * Normaliza o JID para número puro.
 * Evolution API v2 aceita só o número (sem @s.whatsapp.net ou @lid).
 * @lid é o formato multi-device novo do WhatsApp — não funciona para envio,
 * sempre converte para o número limpo.
 */
function normalizeJid(jid: string): string {
  return jid
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace('@g.us', '')
    .split(':')[0]  // remove sufixo de dispositivo ex: "5511999@c.us:1"
    .trim()
}

/** Envia mensagem de texto — Evolution API v2 */
export async function sendText(instance: string, to: string, text: string) {
  const number = normalizeJid(to)

  const res = await fetch(`${BASE_URL}/message/sendText/${instance}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      number,
      text,          // v2: campo direto "text" (v1 usava textMessage: { text })
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[evolution] Erro ao enviar para ${number}:`, res.status, err)
    throw new Error(`Evolution API ${res.status}: ${err}`)
  }

  return res.json()
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
