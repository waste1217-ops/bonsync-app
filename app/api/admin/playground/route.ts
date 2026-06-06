import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from '@/lib/apiAuth'

export const maxDuration = 60

const MODELOS_OK = new Set(['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5', 'claude-haiku-4-5-20251001'])

// Testa um prompt/modelo de forma efêmera — NADA é gravado no banco.
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin({ write: true })
  if (authError) return authError

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servidor sem chave de IA configurada.' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const model: string = MODELOS_OK.has(body.model) ? body.model : 'claude-sonnet-4-5'
  const system: string = String(body.system || '').slice(0, 12000)
  const incoming: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages : []

  const messages = incoming
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-20)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 6000) }))

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Envie ao menos uma mensagem do usuário.' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey })
  try {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: system || undefined,
      messages,
    })
    const text = resp.content.filter(b => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    return NextResponse.json({
      reply: text || '(resposta vazia)',
      usage: { input: resp.usage.input_tokens, output: resp.usage.output_tokens },
    })
  } catch (e: any) {
    console.error('[playground]', e?.message)
    return NextResponse.json({ error: e?.message || 'Falha ao chamar a IA.' }, { status: 502 })
  }
}
