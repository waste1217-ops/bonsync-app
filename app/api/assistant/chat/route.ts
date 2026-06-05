import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { copilotoTools, runCopilotoTool } from '@/lib/copilotoTools'

export const maxDuration = 60

interface Attachment {
  kind: 'text' | 'pdf' | 'image'
  name: string
  text?: string
  data?: string
  media_type?: string
}

const RECENT = 12          // mensagens verbatim enviadas ao modelo
const SUMMARIZE_AFTER = 24 // resume quando há mais que isso fora do resumo

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_name, role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const TOOLS = copilotoTools(isAdmin)

  let body: { message?: string; attachments?: Attachment[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }) }

  const message = (body.message || '').trim()
  const attachments = body.attachments || []
  if (!message) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servidor sem chave de IA configurada.' }, { status: 500 })

  // 1. Persiste a mensagem do usuário
  await supabase.from('copiloto_messages').insert({ user_id: user.id, role: 'user', content: message })

  // 2. Carrega memória (resumo) + últimas mensagens
  const { data: mem } = await supabase
    .from('copiloto_memory').select('summary').eq('user_id', user.id).single()
  const { data: recentDesc } = await supabase
    .from('copiloto_messages').select('role, content')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(RECENT)
  const recent = (recentDesc ?? []).reverse()

  const empresa = profile?.company_name || 'sua empresa'
  let systemPrompt = (isAdmin ? [
    'Você é o Copiloto da Bonsync no modo ADMINISTRADOR. Tem visão de TODA a plataforma: todos os clientes, agentes, conversas, negócios e finanças.',
    'Use as ferramentas para responder com dados reais. Em negócios e conversas, o campo "cliente_bonsync" indica a QUAL cliente da Bonsync o registro pertence.',
    'Ferramentas de admin: listar_clientes (carteira) e consultar_financeiro (MRR/ARR).',
  ] : [
    `Você é o Copiloto Bonsync, assistente de análise de dados de ${empresa}.`,
    'Use as ferramentas para consultar os dados de atendimento da empresa (conversas, leads, negócios do WhatsApp) e responda com números reais.',
  ]).concat([
    'O usuário também pode anexar arquivos (planilhas, PDFs) com dados históricos ou de fora do WhatsApp — combine as fontes quando fizer sentido.',
    'IMPORTANTE: você é SOMENTE LEITURA. Nunca afirme que alterou, criou ou apagou algo — você apenas analisa e relata.',
    'Responda sempre em português brasileiro, de forma clara e objetiva. Use tabelas, listas e destaques.',
    'Se um dado não existir nas ferramentas nem nos arquivos, diga isso com honestidade — não invente.',
  ]).join('\n')

  if (mem?.summary) {
    systemPrompt += '\n\n[Resumo da conversa até aqui]\n' + mem.summary
  }

  // 3. Monta o contexto (anexos na última mensagem do usuário)
  const anthropicMessages: Anthropic.MessageParam[] = []
  recent.forEach((m, i) => {
    const isLastUser = i === recent.length - 1 && m.role === 'user'
    if (isLastUser && attachments.length > 0) {
      const blocks: Anthropic.ContentBlockParam[] = []
      for (const a of attachments) {
        if (a.kind === 'text' && a.text) blocks.push({ type: 'text', text: `Arquivo "${a.name}":\n\n${a.text}` })
        else if (a.kind === 'pdf' && a.data) blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } })
        else if (a.kind === 'image' && a.data && a.media_type) blocks.push({ type: 'image', source: { type: 'base64', media_type: a.media_type as any, data: a.data } })
      }
      blocks.push({ type: 'text', text: m.content })
      anthropicMessages.push({ role: 'user', content: blocks })
    } else {
      anthropicMessages.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  })

  try {
    const client = new Anthropic({ apiKey, timeout: 55000, maxRetries: 1 })
    let totalIn = 0, totalOut = 0
    let response = await client.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 2048, system: systemPrompt, tools: TOOLS, messages: anthropicMessages })
    totalIn += response.usage?.input_tokens ?? 0; totalOut += response.usage?.output_tokens ?? 0

    let rodadas = 0
    while (response.stop_reason === 'tool_use' && rodadas < 5) {
      rodadas++
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await runCopilotoTool(supabase, block.name, block.input, isAdmin)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
        }
      }
      anthropicMessages.push({ role: 'assistant', content: response.content })
      anthropicMessages.push({ role: 'user', content: toolResults })
      response = await client.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 2048, system: systemPrompt, tools: TOOLS, messages: anthropicMessages })
      totalIn += response.usage?.input_tokens ?? 0; totalOut += response.usage?.output_tokens ?? 0
    }

    const text = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('\n').trim()
      || 'Não consegui gerar uma resposta. Pode reformular?'

    // 4. Persiste a resposta
    await supabase.from('copiloto_messages').insert({ user_id: user.id, role: 'assistant', content: text })

    // 5. Resume em background se a conversa cresceu
    await maybeSummarize(supabase, user.id, apiKey)

    return NextResponse.json({ reply: text, usage: { input_tokens: totalIn, output_tokens: totalOut } })
  } catch (err: any) {
    console.error('[assistant/chat] erro:', err.message)
    return NextResponse.json({ error: 'Erro ao processar. Tente novamente.' }, { status: 500 })
  }
}

async function maybeSummarize(supabase: any, userId: string, apiKey: string) {
  try {
    const { count } = await supabase.from('copiloto_messages').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    const total = count || 0
    const { data: mem } = await supabase.from('copiloto_memory').select('summary, summarized_count').eq('user_id', userId).single()
    const summarizedCount = mem?.summarized_count || 0
    if (total - summarizedCount <= SUMMARIZE_AFTER) return

    const foldUpto = total - RECENT
    if (foldUpto <= summarizedCount) return
    const { data: olds } = await supabase.from('copiloto_messages')
      .select('role, content').eq('user_id', userId)
      .order('created_at', { ascending: true }).range(summarizedCount, foldUpto - 1)
    if (!olds || !olds.length) return

    const convo = olds.map((m: any) => (m.role === 'user' ? 'Usuário' : 'Copiloto') + ': ' + m.content).join('\n').slice(0, 12000)
    const client = new Anthropic({ apiKey, timeout: 20000, maxRetries: 1 })
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      system: 'Resuma esta conversa entre um usuário e o Copiloto em até 8 linhas, preservando fatos, números, decisões e pendências. Português, objetivo.',
      messages: [{ role: 'user', content: (mem?.summary ? 'Resumo anterior:\n' + mem.summary + '\n\n' : '') + 'Conversa:\n' + convo }],
    })
    const summary = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
    if (summary) {
      await supabase.from('copiloto_memory').upsert(
        { user_id: userId, summary, summarized_count: foldUpto, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    }
  } catch (err: any) {
    console.error('[copiloto memory] erro:', err.message)
  }
}
