// ════════════════════════════════════════════════════════════════════
// BONSYNC — Detecção de agendamento para o agente da VPS (bonsync-agente)
// Copie este arquivo para: bonsync-agente/src/appointments.js
// Depois faça a integração descrita em INTEGRACAO.md (1 require + 1 chamada).
//
// Autocontido: cria os próprios clientes (Supabase service-role + Anthropic)
// a partir das envs já usadas pelo agente. Resolve a conversa por
// (agentId, contactId), então a integração precisa de pouquíssimos dados.
// ════════════════════════════════════════════════════════════════════
const Anthropic = require('@anthropic-ai/sdk')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

/**
 * Detecta intenção de agendamento e cria/atualiza um registro REAL em `meetings`.
 *
 * @param {string} anthropicKey  chave Anthropic do agente (cfg.anthropic_key)
 * @param {object} ctx           { agentId, contactId, contactName, address, durationMin }
 * @param {Array}  history       [{ role:'user'|'assistant', content:string }, ...]
 */
async function detectAppointment(anthropicKey, ctx, history) {
  if (!anthropicKey) { console.warn('[Appointment] sem anthropicKey — pulando'); return }
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const hojeSP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const diaSemana = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' })
  const transcript = (history || []).slice(-16)
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${String(m.content).slice(0, 500)}`)
    .join('\n')

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system: [
      `Hoje é ${hojeSP} (${diaSemana}), fuso America/Sao_Paulo.`,
      'Você extrai a intenção de AGENDAMENTO (reunião, visita presencial, call, ligação, demonstração, "falar com o comercial") de uma conversa de atendimento.',
      'Resolva datas relativas ("amanhã", "sexta", "dia 20", "semana que vem") para YYYY-MM-DD com base na data de hoje.',
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

  const tool = resp.content.find(b => b.type === 'tool_use')
  const d = (tool && tool.input) || {}
  if (!d.tem_intencao) { console.log('[Appointment] Sem intenção de agendamento nesta conversa.'); return }
  console.log('[Appointment] Intenção de agendamento detectada')

  // resolve a conversa atual do contato (mesma lógica do agente)
  const { data: conv } = await supabase
    .from('conversations').select('id')
    .eq('agent_id', ctx.agentId).eq('contact_identifier', ctx.contactId)
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  const conversationId = conv && conv.id
  if (!conversationId) { console.error('[Appointment] Conversa não encontrada para o contato — abortando'); return }

  const data = (d.data || '').trim() || null
  const horario = (d.horario || '').trim() || null
  const missing = [!data && 'data', !horario && 'horario'].filter(Boolean)
  console.log('[Appointment] Dados coletados:', JSON.stringify({ contato: d.contato_nome, data, horario, modalidade: d.modalidade }))
  if (missing.length) console.log('[Appointment] Campos ausentes:', missing.join(', '))
  else console.log('[Appointment] Dados completos')

  const status = missing.length ? 'aguardando_info' : 'aguardando'
  const campos = {
    agent_id: ctx.agentId,
    conversation_id: conversationId,
    contact_identifier: ctx.contactId,
    contato_nome: (d.contato_nome || ctx.contactName || '').trim() || null,
    tipo: d.tipo || 'reuniao',
    modalidade: d.modalidade || null,
    assunto: (d.assunto || '').trim() || null,
    periodo: d.periodo || null,
    requested_date: data,
    requested_time: horario,
    duracao_min: ctx.durationMin || 30,
    origem: 'WhatsApp',
    source: 'ai_sugerida',
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'aguardando' && data) campos.start_at = new Date(`${data}T${horario}:00-03:00`).toISOString()
  if (ctx.address && campos.modalidade === 'presencial') campos.endereco = ctx.address

  const { data: existente } = await supabase
    .from('meetings').select('id')
    .eq('conversation_id', conversationId)
    .in('status', ['detectada', 'aguardando_info', 'aguardando', 'sugerida'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (existente) {
    const { error } = await supabase.from('meetings').update(campos).eq('id', existente.id)
    if (error) return console.error('[Appointment] Erro ao criar solicitação:', error.message)
    console.log(`[Appointment] Solicitação atualizada: ${existente.id} — status ${status} — conversa ${conversationId}`)
  } else {
    const { data: nova, error } = await supabase.from('meetings').insert(campos).select('id').single()
    if (error) return console.error('[Appointment] Erro ao criar solicitação:', error.message)
    console.log(`[Appointment] Solicitação criada: ${nova && nova.id} — clientId via agent ${ctx.agentId} — conversa ${conversationId} — status ${status}`)
  }
}

module.exports = { detectAppointment }
