import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

interface Attachment {
  kind: 'text' | 'pdf' | 'image'
  name: string
  text?: string
  data?: string
  media_type?: string
}
interface ChatMsg { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_name').eq('id', user.id).single()

  let body: { messages?: ChatMsg[]; attachments?: Attachment[] }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }) }

  const messages    = body.messages    || []
  const attachments = body.attachments || []
  if (messages.length === 0) {
    return NextResponse.json({ error: 'Nenhuma mensagem.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Servidor sem chave de IA configurada.' }, { status: 500 })
  }

  const empresa = profile?.company_name || 'sua empresa'
  const systemPrompt = [
    `Você é o Copiloto Bonsync, assistente de análise de dados de ${empresa}.`,
    'Analise os arquivos enviados (planilhas, documentos, PDFs, imagens) e responda às perguntas.',
    'Responda sempre em português brasileiro, de forma clara e objetiva.',
    'Use tabelas, listas e destaques quando ajudarem a entender.',
    'Se um cálculo for pedido, mostre o raciocínio de forma resumida.',
    'Se a informação não estiver nos arquivos, diga isso com honestidade.',
  ].join('\n')

  // Monta o histórico. Os anexos vão na ÚLTIMA mensagem do usuário (reenviados a cada turno
  // para manter o contexto disponível em perguntas de acompanhamento).
  const anthropicMessages: Anthropic.MessageParam[] = []

  messages.forEach((m, i) => {
    const isLastUser = i === messages.length - 1 && m.role === 'user'
    if (isLastUser && attachments.length > 0) {
      const blocks: Anthropic.ContentBlockParam[] = []
      for (const a of attachments) {
        if (a.kind === 'text' && a.text) {
          blocks.push({ type: 'text', text: `Arquivo "${a.name}":\n\n${a.text}` })
        } else if (a.kind === 'pdf' && a.data) {
          blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } })
        } else if (a.kind === 'image' && a.data && a.media_type) {
          blocks.push({ type: 'image', source: { type: 'base64', media_type: a.media_type as any, data: a.data } })
        }
      }
      blocks.push({ type: 'text', text: m.content })
      anthropicMessages.push({ role: 'user', content: blocks })
    } else {
      anthropicMessages.push({ role: m.role, content: m.content })
    }
  })

  try {
    const client = new Anthropic({ apiKey, timeout: 55000, maxRetries: 1 })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: anthropicMessages,
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .trim()

    return NextResponse.json({
      reply: text,
      usage: {
        input_tokens:  response.usage?.input_tokens  ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    })
  } catch (err: any) {
    console.error('[assistant/chat] erro:', err.message)
    return NextResponse.json({ error: 'Erro ao processar. Tente novamente.' }, { status: 500 })
  }
}
