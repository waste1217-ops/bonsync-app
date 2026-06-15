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

  // ── 3b. Horário de funcionamento ───────────────────────────────────────
  const bh = (cfg.business_hours ?? {}) as { enabled?: boolean; start?: string; end?: string; weekdays?: boolean }
  if (bh.enabled && cfg.away_message) {
    const spNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const dia = spNow.getDay() // 0 dom .. 6 sáb
    const minutosAgora = spNow.getHours() * 60 + spNow.getMinutes()
    const [sh, sm] = (bh.start ?? '08:00').split(':').map(Number)
    const [eh, em] = (bh.end ?? '18:00').split(':').map(Number)
    const ini = sh * 60 + sm, fim = eh * 60 + em
    const foraDeHorario = minutosAgora < ini || minutosAgora >= fim
    const fds = bh.weekdays && (dia === 0 || dia === 6)
    if (foraDeHorario || fds) {
      await supabase.from('messages').insert({ conversation_id: conversation.id, role: 'assistant', content: cfg.away_message })
      await supabase.from('conversations').update({ message_count: (conversation.message_count ?? 0) + 1, updated_at: new Date().toISOString() }).eq('id', conversation.id)
      await sendText(instance, contactJid, cfg.away_message)
      console.log(`[agent] Fora do horário — mensagem de ausência enviada para ${contactId}`)
      return
    }
  }

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

  // ── 7. Salva resposta (status "enviando") e ENTREGA, rastreando o status ──
  const { data: savedMsg } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role:            'assistant',
    content:         reply,
    send_status:     'enviando',
  }).select('id').single()
  await supabase.from('conversations').update({
    message_count: msgCount,
    updated_at:    new Date().toISOString(),
  }).eq('id', conversation.id)

  try {
    console.log(`[agent] → enviando resposta para ${contactId} (instância ${instance})`)
    await sendText(instance, contactJid, reply)
    if (savedMsg?.id) await supabase.from('messages').update({ send_status: 'enviada' }).eq('id', savedMsg.id)
    console.log(`[agent] ✓ resposta ENTREGUE para ${contactId} — conversa ${conversation.id}`)
  } catch (err: any) {
    const motivo = mapSendError(err)
    if (savedMsg?.id) await supabase.from('messages').update({ send_status: 'falha', send_error: motivo }).eq('id', savedMsg.id)
    console.error(`[agent] ✗ resposta NÃO entregue para ${contactId} — ${motivo}`)
  }

  // ── 8. Classifica o lead (não bloqueia o atendimento) ──────────────────
  try {
    if (conversation.lead_status !== 'cliente') {
      const fullHistory = [...messages, { role: 'assistant' as const, content: reply }]
      const lead = await classifyLead(anthropic, fullHistory)
      if (lead) {
        await supabase.from('conversations').update({
          lead_status: lead.status,
          lead_reason: lead.reason,
          lead_updated_at: new Date().toISOString(),
        }).eq('id', conversation.id)
      }
    }
  } catch (e: any) {
    console.error('[agent] classificação de lead falhou:', e?.message)
  }

  // ── 9. Detecta intenção de agendamento e cria/atualiza a solicitação ─────
  try {
    const fullHistory = [...messages, { role: 'assistant' as const, content: reply }]
    await detectAppointment(anthropic, {
      agentId: agent.id,
      conversationId: conversation.id,
      contactId,
      contactName,
      address: (cfg.scheduling?.address as string) || '',
      durationMin: Number(cfg.scheduling?.duration_min) || 30,
    }, fullHistory)
  } catch (e: any) {
    console.error('[Appointment] Erro ao detectar/criar solicitação:', e?.message)
  }
}

/**
 * Detecta intenção de agendamento na conversa (saída estruturada via tool_use)
 * e cria/atualiza um registro REAL em `meetings`, vinculado ao agente, à conversa
 * e ao contato. Enquanto faltar data/horário fica em 'aguardando_info'; quando
 * houver o mínimo (data + horário), vira 'aguardando' (aguardando confirmação
 * da empresa) e aparece em Negócios → Agenda comercial.
 */
async function detectAppointment(
  anthropic: Anthropic,
  ctx: { agentId: string; conversationId: string; contactId: string; contactName: string; address: string; durationMin: number },
  history: { role: 'user' | 'assistant'; content: string }[],
) {
  const supabase = createAdminClient()
  const hojeSP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const diaSemana = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' })

  const transcript = history.slice(-16)
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${String(m.content).slice(0, 500)}`)
    .join('\n')

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system: [
      `Hoje é ${hojeSP} (${diaSemana}), fuso America/Sao_Paulo.`,
      'Você extrai a intenção de AGENDAMENTO (reunião, visita presencial, call, ligação, demonstração, "falar com o comercial") de uma conversa de atendimento.',
      'Resolva datas relativas ("amanhã", "sexta", "dia 20", "semana que vem") para o formato YYYY-MM-DD com base na data de hoje.',
      'Horário no formato HH:MM (24h). Se um campo NÃO foi informado pelo cliente, deixe-o como string vazia. NUNCA invente data ou horário.',
      'Sempre chame a ferramenta registrar_agendamento.',
    ].join('\n'),
    tools: [{
      name: 'registrar_agendamento',
      description: 'Registra a intenção de agendamento detectada na conversa, com os campos já informados pelo cliente.',
      input_schema: {
        type: 'object',
        properties: {
          tem_intencao: { type: 'boolean', description: 'true se o cliente demonstrou intenção de marcar reunião/visita/call/demonstração' },
          contato_nome: { type: 'string', description: 'Nome do cliente, se informado' },
          data: { type: 'string', description: 'Data solicitada em YYYY-MM-DD, ou vazio' },
          horario: { type: 'string', description: 'Horário solicitado em HH:MM, ou vazio' },
          periodo: { type: 'string', description: 'manha, tarde ou noite, se informado sem horário exato' },
          modalidade: { type: 'string', description: 'presencial, online ou telefone, ou vazio' },
          tipo: { type: 'string', description: 'reuniao, visita, call ou demo' },
          assunto: { type: 'string', description: 'Assunto/objetivo, se mencionado' },
        },
        required: ['tem_intencao'],
      },
    }],
    tool_choice: { type: 'tool', name: 'registrar_agendamento' },
    messages: [{ role: 'user', content: `Conversa:\n${transcript}` }],
  })

  const tool = resp.content.find((b: any) => b.type === 'tool_use') as any
  const d = tool?.input ?? {}
  if (!d.tem_intencao) { console.log('[Appointment] Sem intenção de agendamento nesta conversa.'); return }
  console.log('[Appointment] Intenção de agendamento detectada')

  const data = (d.data || '').trim() || null
  const horario = (d.horario || '').trim() || null
  const missing = [!data && 'data', !horario && 'horario'].filter(Boolean)
  console.log('[Appointment] Dados coletados:', JSON.stringify({ contato: d.contato_nome, data, horario, modalidade: d.modalidade }))
  if (missing.length) console.log('[Appointment] Campos ausentes:', missing.join(', '))
  else console.log('[Appointment] Dados completos')

  const status = missing.length ? 'aguardando_info' : 'aguardando'
  const campos: any = {
    agent_id: ctx.agentId,
    conversation_id: ctx.conversationId,
    contact_identifier: ctx.contactId,
    contato_nome: (d.contato_nome || ctx.contactName || '').trim() || null,
    tipo: d.tipo || 'reuniao',
    modalidade: d.modalidade || null,
    assunto: (d.assunto || '').trim() || null,
    periodo: d.periodo || null,
    requested_date: data,
    requested_time: horario,
    duracao_min: ctx.durationMin,
    origem: 'WhatsApp',
    source: 'ai_sugerida',
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'aguardando' && data) campos.start_at = new Date(`${data}T${horario}:00-03:00`).toISOString()
  if (ctx.address && campos.modalidade === 'presencial') campos.endereco = ctx.address

  // já existe um rascunho/solicitação desta conversa? então atualiza
  const { data: existente } = await supabase
    .from('meetings')
    .select('id, status')
    .eq('conversation_id', ctx.conversationId)
    .in('status', ['detectada', 'aguardando_info', 'aguardando', 'sugerida'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) {
    console.log('[Appointment] Atualizando solicitação existente:', existente.id)
    const { error } = await supabase.from('meetings').update(campos).eq('id', existente.id)
    if (error) { console.error('[Appointment] Erro ao criar solicitação:', error.message); return }
    console.log(`[Appointment] Solicitação atualizada: ${existente.id} — status ${status} — conversa ${ctx.conversationId}`)
  } else {
    console.log('[Appointment] Criando solicitação')
    const { data: nova, error } = await supabase.from('meetings').insert(campos).select('id').single()
    if (error) { console.error('[Appointment] Erro ao criar solicitação:', error.message); return }
    console.log(`[Appointment] Solicitação criada: ${nova?.id} — clientId via agent ${ctx.agentId} — conversa ${ctx.conversationId} — status ${status}`)
  }
}

/**
 * Classifica a temperatura do lead com base na conversa.
 * Usa Haiku (barato). Retorna status + motivo curto.
 */
/** Motivo legível a partir do erro de envio (sendText lança "Evolution API <status>: <body>") */
function mapSendError(err: any): string {
  const msg = String(err?.message || '')
  const m = msg.match(/Evolution API (\d+)/)
  const s = m ? Number(m[1]) : 0
  if (s === 401 || s === 403) return 'Token inválido ou sem permissão'
  if (s === 404) return 'Instância/canal não encontrado (desconectado)'
  if (s === 400) return 'Número inválido ou requisição rejeitada'
  if (!s) return 'WhatsApp API indisponível (timeout ou conexão)'
  return `Erro ${s} da API do WhatsApp`
}

async function classifyLead(
  anthropic: Anthropic,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<{ status: 'curioso' | 'potencial' | 'qualificado'; reason: string } | null> {
  const texto = messages.slice(-12)
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${String(m.content).slice(0, 400)}`)
    .join('\n')

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    system: [
      'Você classifica a INTENÇÃO DE COMPRA de um contato com base na conversa de atendimento.',
      'Categorias:',
      '- curioso: só pesquisando, perguntas vagas, sem intenção clara de compra.',
      '- potencial: interesse real (pergunta preço/produto/condições), mas ainda decidindo.',
      '- qualificado: alta intenção — quer comprar/orçamento/agendar, deu dados ou pediu para falar com humano.',
      'Responda EXATAMENTE no formato: status|motivo curto (máx 8 palavras). Sem mais nada.',
    ].join('\n'),
    messages: [{ role: 'user', content: texto }],
  })

  const out = resp.content.filter(b => b.type === 'text').map((b: any) => b.text).join('').trim()
  const [rawStatus, ...rest] = out.split('|')
  const status = (rawStatus || '').trim().toLowerCase()
  if (status !== 'curioso' && status !== 'potencial' && status !== 'qualificado') return null
  return { status, reason: rest.join('|').trim().slice(0, 120) || '' }
}
