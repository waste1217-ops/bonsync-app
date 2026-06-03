/**
 * Cliente para Evolution API
 * Abstrai o envio/recebimento de mensagens WhatsApp.
 * Trocar por Meta API no futuro = só mudar este arquivo.
 */

const BASE_URL = process.env.EVOLUTION_API_URL!
const API_KEY  = process.env.EVOLUTION_API_KEY!

const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
}

/** Envia mensagem de texto para um número */
export async function sendText(instance: string, to: string, text: string) {
  // Remove o sufixo @s.whatsapp.net se vier junto
  const number = to.replace('@s.whatsapp.net', '').replace('@g.us', '')

  const res = await fetch(`${BASE_URL}/message/sendText/${instance}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      number,
      textMessage: { text },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API erro ao enviar: ${res.status} — ${err}`)
  }

  return res.json()
}

/** Tipos do payload de webhook da Evolution API */
export interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string   // número do remetente ex: "5511999999999@s.whatsapp.net"
      fromMe: boolean     // true = mensagem enviada pelo bot
      id: string
    }
    message?: {
      conversation?: string          // texto simples
      extendedTextMessage?: {        // texto com preview de link
        text: string
      }
      imageMessage?: { caption?: string }
      audioMessage?: object
      documentMessage?: object
    }
    messageTimestamp: number
    pushName?: string                // nome de contato do WhatsApp
  }
}

/** Extrai o texto de um payload de mensagem */
export function extractText(payload: EvolutionWebhookPayload): string | null {
  const msg = payload.data?.message
  if (!msg) return null
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    null
  )
}

/** Verifica se o evento é uma mensagem recebida válida (não grupo, não própria) */
export function isIncomingMessage(payload: EvolutionWebhookPayload): boolean {
  if (payload.event !== 'messages.upsert') return false
  if (payload.data?.key?.fromMe) return false
  if (payload.data?.key?.remoteJid?.endsWith('@g.us')) return false // ignorar grupos por ora
  return true
}
