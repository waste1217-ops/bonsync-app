import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from './supabase/admin'
import { sendText } from './evolution'

/**
 * Núcleo do agente Bonsync.
 * Recebe uma mensagem, processa com Anthropic e responde via Evolution API.
 * Toda interação é salva no Supabase.
 */
export async function processMessage({
  instance,
  contactJid,
  contactName,
  text,
}: {
  instance:    string   // nome da instância Evolution (ex: "javai")
  contactJid:  string   // ex: "5511999999999@s.whatsapp.net"
  contactName: string
  text:        string
}) {
  const supabase = createAdminClient()

  // ── 1. Busca o agente pela instância WhatsApp ──────────────────────────
  // .filter() é necessário para queries JSONB no Supabase JS v2
  console.log(`[agent] Buscando agente para instância: "${instance}"`)

  const { data: agentes, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .filter('config->>whatsapp_instance', 'eq', instance)
    .eq('status', 'active')
    .limit(1)

  if (agentError) {
    console.error('[agent] Erro ao buscar agente:', agentError.message)
    return
  }

  const agent = agentes?.[0] ?? null

  if (!agent) {
    console.warn(`[agent] Nenhum agente ativo para instância "${instance}"`)
    return
  }

  console.log(`[agent] Agente encontrado: "${agent.name}" (${agent.id})`)

  const cfg = agent.config as Record<string, any>

  // ── 2. Busca ou cria conversa ──────────────────────────────────────────
  const contactId = contactJid.replace('@s.whatsapp.net', '')

  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', agent.id)
    .eq('contact_identifier', contactId)
    .eq('status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!conversation) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        agent_id:           agent.id,
        contact_identifier: contactId,
        channel:            'whatsapp',
        status:             'open',
        message_count:      0,
      })
      .select()
      .single()
    conversation = newConv
  }

  if (!conversation) {
    console.error('[agent] Falha ao criar conversa')
    return
  }

  // ── 3. Salva mensagem do usuário no Supabase ───────────────────────────
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role:            'user',
    content:         text,
  })

  // ── 4. Carrega histórico recente para contexto ─────────────────────────
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(20) // últimas 20 mensagens = ~10 trocas

  const messages = (history ?? []).map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // ── 5. Verifica limite de escalamento ─────────────────────────────────
  const msgCount = (conversation.message_count ?? 0) + 1
  const escalarApos = cfg.escalarApos ?? 15

  if (msgCount >= escalarApos) {
    await supabase.from('conversations').update({
      status:        'escalated',
      ended_at:      new Date().toISOString(),
      message_count: msgCount,
    }).eq('id', conversation.id)

    const escMsg = 'Esta conversa foi transferida para um atendente humano. Em breve alguém entrará em contato. 🙏'
    await supabase.from('messages').insert({ conversation_id: conversation.id, role: 'assistant', content: escMsg })
    await sendText(instance, contactJid, escMsg)
    return
  }

  // ── 6. Chama Anthropic ─────────────────────────────────────────────────
  const apiKey = cfg.anthropic_key
  if (!apiKey) {
    console.error(`[agent] Anthropic API key não configurada no agente ${agent.id}`)
    return
  }

  const anthropic = new Anthropic({ apiKey })

  const tomMap: Record<string, string> = {
    profissional: 'Seja profissional, claro e objetivo.',
    amigavel:     'Seja amigável, descontraído e use linguagem informal.',
    formal:       'Seja extremamente formal e respeitoso.',
    tecnico:      'Use linguagem técnica e precisa.',
  }

  const systemPrompt = [
    cfg.prompt || 'Você é um assistente virtual prestativo.',
    '',
    `Tom de comunicação: ${tomMap[cfg.tom ?? 'profissional'] ?? ''}`,
    '',
    `Nome do contato: ${contactName || 'Cliente'}`,
    'Responda sempre em português brasileiro.',
    'Seja conciso — respostas curtas e diretas são preferidas no WhatsApp.',
    'Nunca se identifique como IA a menos que diretamente perguntado.',
  ].join('\n')

  let reply = ''

  try {
    const response = await anthropic.messages.create({
      model:      cfg.model ?? 'claude-sonnet-4-5',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    })

    reply = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .trim()
  } catch (err: any) {
    console.error('[agent] Erro Anthropic:', err.message)

    // Marca agente como erro e notifica
    await supabase.from('agents').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', agent.id)
    return
  }

  // ── 7. Salva resposta e envia ──────────────────────────────────────────
  await Promise.all([
    supabase.from('messages').insert({
      conversation_id: conversation.id,
      role:            'assistant',
      content:         reply,
    }),
    supabase.from('conversations').update({
      message_count: msgCount,
      updated_at:    new Date().toISOString(),
    }).eq('id', conversation.id),
    sendText(instance, contactJid, reply),
  ])

  console.log(`[agent] ✓ Respondido para ${contactId} — conversa ${conversation.id}`)
}
