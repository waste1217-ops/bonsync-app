import { NextRequest, NextResponse } from 'next/server'
import { isIncomingMessage, extractText, type EvolutionWebhookPayload } from '@/lib/evolution'
import { processMessage } from '@/lib/agent'

/**
 * Webhook receptor — Evolution API envia aqui cada evento de mensagem.
 * URL para configurar no Evolution Manager:
 *   https://app.bonsync.com.br/api/webhook/whatsapp
 */
export async function POST(req: NextRequest) {
  try {
    const payload: EvolutionWebhookPayload = await req.json()

    // Ignora eventos que não são mensagens recebidas
    if (!isIncomingMessage(payload)) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const text = extractText(payload)

    // Mensagem sem texto (áudio, imagem sem legenda, etc.)
    if (!text) {
      console.log('[webhook] Mensagem sem texto — ignorada')
      return NextResponse.json({ ok: true, skipped: 'no-text' })
    }

    // Processa em background — responde 200 imediatamente para a Evolution API
    // não reenviar o webhook por timeout
    processMessage({
      instance:    payload.instance,
      contactJid:  payload.data.key.remoteJid,
      contactName: payload.data.pushName ?? '',
      text,
    }).catch(err => {
      console.error('[webhook] Erro no processamento:', err)
    })

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[webhook] Erro ao parsear payload:', err.message)
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
}

// Evolution API às vezes faz GET para verificar se o webhook está vivo
export async function GET() {
  return NextResponse.json({ status: 'Bonsync webhook ativo ✓' })
}
