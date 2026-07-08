/**
 * Cliente WhatsApp Cloud API (Meta) para o painel.
 * Espelha lib/evolution.ts: mesmo formato de retorno ({ key: { id } }) e erros
 * no formato "Meta API <status>: <body>" para que mapSendError e os chamadores
 * não precisem de lógica separada por canal.
 * Trocar/estender o canal Meta no futuro = mexer só aqui.
 */
const GRAPH = 'https://graph.facebook.com/v21.0'
const DEFAULT_TOKEN = process.env.META_CLOUD_TOKEN

function onlyDigits(s?: string | null): string {
  return String(s ?? '').replace(/\D/g, '')
}

/**
 * Envia mensagem de texto pela Cloud API a partir de UM número (phone_number_id).
 * Lança Error com marcador para o chamador mapear a causa:
 *  - "SEND_TARGET:INVALID_NUMBER"
 *  - "Meta API <status>: <body>" / "Meta API 0: network"
 */
export async function sendMetaText(phoneNumberId: string, to: string, text: string, token?: string) {
  const tok = token || DEFAULT_TOKEN
  if (!tok) throw new Error('Meta API 0: sem META_CLOUD_TOKEN')
  // Meta não usa @lid — precisa de telefone E.164 só com dígitos
  const number = onlyDigits(to)
  if (!number || number.length < 8) throw new Error('SEND_TARGET:INVALID_NUMBER')

  let res: Response
  try {
    res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: number,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    })
  } catch {
    throw new Error('Meta API 0: network')
  }

  const body = await res.text()
  if (res.status < 200 || res.status >= 300) throw new Error(`Meta API ${res.status}: ${body.slice(0, 500)}`)
  try {
    const d = JSON.parse(body)
    return { key: { id: d?.messages?.[0]?.id || null } }
  } catch {
    return { key: { id: null } }
  }
}
