import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendText, toSendTarget } from '@/lib/evolution'

function mapSendError(err: any): string {
  const msg = String(err?.message || '')
  if (msg.startsWith('SEND_TARGET:NO_PHONE')) return 'O cliente não possui telefone cadastrado.'
  if (msg.startsWith('SEND_TARGET:INVALID_NUMBER')) return 'O número do cliente é inválido.'
  const m = msg.match(/Evolution API (\d+)/)
  const s = m ? Number(m[1]) : 0
  if (s === 401 || s === 403) return 'Token inválido ou sem permissão.'
  if (s === 404) return 'O WhatsApp está desconectado.'
  if (s === 400) return 'A API de mensagens rejeitou a solicitação.'
  if (s === 500) return 'Sessão do WhatsApp instável — use "Reconectar sessão" no perfil do cliente.'
  if (!s) return 'WhatsApp indisponível (timeout ou conexão).'
  return `Erro ${s} da API do WhatsApp.`
}
const codeMsg = (code: string) => code === 'NO_PHONE' ? 'O cliente não possui telefone cadastrado.' : 'O número do cliente é inválido.'

const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const slotLabel = (s: { date?: string; time?: string }) => {
  if (!s?.date) return ''
  const d = new Date(`${s.date}T${(s.time || '00:00')}:00-03:00`)
  return `${fmtDate(d)} às ${s.time || fmtTime(d)}`
}

/**
 * Ações de agendamento disparadas pelo painel. Atualiza a reunião, responde
 * ao cliente pelo WhatsApp (quando aplicável) e registra a mensagem na conversa.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { meeting_id, acao } = body as { meeting_id?: string; acao?: string }
  if (!meeting_id || !acao) return NextResponse.json({ error: 'meeting_id e acao são obrigatórios.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: m } = await admin
    .from('meetings')
    .select('*, agents!inner(client_id, config)')
    .eq('id', meeting_id).single()
  if (!m) return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 })

  const agent: any = (m as any).agents
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && agent?.client_id !== user.id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const cfg = (agent?.config ?? {}) as any
  const sched = (cfg.scheduling ?? {}) as any
  const instance: string | undefined = cfg.whatsapp_instance
  const endereco: string = body.endereco || sched.address || m.endereco || '[endereço da empresa]'

  // monta start_at a partir do payload ou do que foi solicitado
  function buildStart(): Date | null {
    if (body.start_at) return new Date(body.start_at)
    const date = body.requested_date || m.requested_date
    const time = body.requested_time || m.requested_time
    if (date) return new Date(`${date}T${(time || '09:00')}:00-03:00`)
    if (m.start_at) return new Date(m.start_at)
    return null
  }

  let patch: any = { updated_at: new Date().toISOString() }
  let mensagem = ''        // texto enviado ao cliente (vazio = não envia)
  let evento = ''          // nota interna na conversa (role system)

  if (acao === 'confirmar') {
    const start = buildStart()
    if (!start || isNaN(start.getTime())) return NextResponse.json({ error: 'Defina data e horário para confirmar.' }, { status: 400 })
    if (start.getTime() < Date.now() - 60000) return NextResponse.json({ error: 'Não é possível confirmar para uma data no passado.' }, { status: 400 })
    patch.status = 'confirmada'
    patch.start_at = start.toISOString()
    if (body.responsavel) patch.responsavel = body.responsavel
    if (body.modalidade) patch.modalidade = body.modalidade
    const mod = body.modalidade || m.modalidade
    const quando = `${fmtDate(start)} às ${fmtTime(start)}`
    if (mod === 'presencial') mensagem = `Perfeito! Sua visita presencial foi marcada com sucesso para o dia ${quando}. O endereço é ${endereco}. Se precisar alterar o horário, é só nos avisar.`
    else if (mod === 'online') mensagem = `Perfeito! Sua reunião online foi marcada com sucesso para o dia ${quando}. O link será enviado antes do horário combinado. Se precisar alterar, é só nos avisar.`
    else mensagem = `Perfeito! Sua reunião foi marcada com sucesso para o dia ${quando}. Em breve nossa equipe falará com você por aqui. Se precisar alterar o horário, é só nos avisar.`
    evento = `Horário confirmado pela empresa — ${quando}.`

  } else if (acao === 'oferecer_datas') {
    const slots: { date?: string; time?: string }[] = (body.slots || []).filter((s: any) => s?.date).slice(0, 3)
    if (!slots.length) return NextResponse.json({ error: 'Informe ao menos uma data alternativa.' }, { status: 400 })
    patch.status = 'aguardando_escolha'
    patch.alternative_slots = slots
    const linhas = slots.map(s => `• ${slotLabel(s)}`).join('\n')
    mensagem = `O horário solicitado não está disponível, mas temos estas opções:\n\n${linhas}\n\nQual delas funciona melhor para você?`
    evento = `Novas datas oferecidas ao cliente: ${slots.map(slotLabel).join(' / ')}.`

  } else if (acao === 'recusar') {
    patch.status = 'recusada'
    mensagem = body.mensagem || 'Obrigado pelo interesse! No momento não conseguimos agendar, mas seguimos à disposição por aqui para o que precisar.'
    evento = 'Solicitação de reunião recusada pela empresa.'

  } else if (acao === 'reagendar') {
    const start = buildStart()
    if (!start || isNaN(start.getTime())) return NextResponse.json({ error: 'Defina a nova data e horário.' }, { status: 400 })
    patch.status = 'reagendada'
    patch.start_at = start.toISOString()
    const quando = `${fmtDate(start)} às ${fmtTime(start)}`
    mensagem = `Sua reunião foi reagendada para o dia ${quando}. Qualquer coisa, é só nos avisar por aqui.`
    evento = `Reunião reagendada para ${quando}.`

  } else if (acao === 'realizada') {
    patch.status = 'realizada'
    evento = 'Reunião marcada como realizada.'

  } else if (acao === 'ausencia') {
    patch.status = 'ausente'
    evento = 'Cliente não compareceu à reunião.'

  } else if (acao === 'cancelar') {
    patch.status = 'cancelada'
    if (body.notificar) mensagem = body.mensagem || 'Olá! Precisamos cancelar a reunião agendada. Podemos remarcar quando for melhor para você — é só me dizer.'
    evento = 'Reunião cancelada pela empresa.'

  } else {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  // aplica a atualização da reunião
  const { error: upErr } = await admin.from('meetings').update(patch).eq('id', meeting_id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // garante uma conversa para registrar eventos/mensagens
  let convId: string | null = m.conversation_id || null
  if (!convId && m.contact_identifier) {
    const { data: c } = await admin.from('conversations')
      .select('id').eq('agent_id', m.agent_id).eq('contact_identifier', m.contact_identifier)
      .order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (c) convId = c.id
    else {
      const { data: nc } = await admin.from('conversations')
        .insert({ agent_id: m.agent_id, contact_identifier: m.contact_identifier, channel: 'whatsapp', status: 'open', message_count: 0 })
        .select('id').single()
      convId = nc?.id ?? null
    }
    if (convId) await admin.from('meetings').update({ conversation_id: convId }).eq('id', meeting_id)
  }

  // nota interna (linha do tempo)
  if (convId && evento) {
    await admin.from('messages').insert({ conversation_id: convId, role: 'system', content: evento }).then(() => {}, () => {})
  }

  // resolve o telefone do contato que originou a oportunidade
  let contato: string | null = m.contact_identifier || null
  if (!contato && convId) {
    const { data: c } = await admin.from('conversations').select('contact_identifier').eq('id', convId).maybeSingle()
    contato = c?.contact_identifier || null
  }

  // envia ao cliente + registra a mensagem enviada (com status para retry)
  let sendResult: { ok: boolean; error?: string; messageId?: string; retryable?: boolean } = { ok: true }
  if (mensagem) {
    const alvo = toSendTarget(contato)
    if (!instance) {
      sendResult = { ok: false, error: 'Agente sem instância de WhatsApp configurada.', retryable: false }
    } else if (!alvo.ok) {
      // número ausente/inválido: não adianta reenviar
      console.error('[reuniao/acao] alvo inválido', JSON.stringify({ original: alvo.original, code: alvo.code }))
      sendResult = { ok: false, error: codeMsg(alvo.code), retryable: false }
    } else {
      const { data: saved } = convId
        ? await admin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: mensagem, send_status: 'enviando' }).select('id').single()
        : { data: null as any }
      try {
        const data: any = await sendText(instance, alvo.target, mensagem)
        const waId = data?.key?.id || null
        if (!waId) {
          if (saved?.id) await admin.from('messages').update({ send_status: 'falha', send_error: 'API não retornou messageId' }).eq('id', saved.id)
          sendResult = { ok: false, error: 'A integração não confirmou o envio (sem messageId).', messageId: saved?.id, retryable: !!saved?.id }
        } else {
          // aceita pela API; ACK (webhook) confirma entregue/lida depois
          if (saved?.id) await admin.from('messages').update({ send_status: 'aceita', wa_message_id: waId }).eq('id', saved.id)
          sendResult = { ok: true, messageId: saved?.id }
        }
      } catch (err: any) {
        const motivo = mapSendError(err)
        if (saved?.id) await admin.from('messages').update({ send_status: 'falha', send_error: motivo }).eq('id', saved.id)
        sendResult = { ok: false, error: motivo, messageId: saved?.id, retryable: !!saved?.id }
      }
    }
    if (convId) await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
  }

  return NextResponse.json({
    success: true, status: patch.status, sent: !!mensagem,
    sendOk: sendResult.ok, sendError: sendResult.error,
    messageId: sendResult.messageId, retryable: sendResult.retryable,
  })
}
