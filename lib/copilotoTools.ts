import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * Ferramentas SOMENTE LEITURA do Copiloto sobre os dados da Bonsync.
 * Segurança: o client é a sessão do usuário, então o RLS do Supabase
 * garante o escopo — cliente só lê os próprios dados; admin lê tudo.
 * As ferramentas de admin só são oferecidas a admins.
 * NENHUMA ferramenta escreve/altera nada.
 */

const BASE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_metricas',
    description: 'Métricas de atendimento: total de conversas (abertas, resolvidas, escaladas) e negócios (pendentes, fechados) em um período.',
    input_schema: {
      type: 'object',
      properties: { periodo_dias: { type: 'number', description: 'Dias para trás (ex: 7, 30). Padrão 30.' } },
    },
  },
  {
    name: 'listar_negocios',
    description: 'Lista negócios/leads detectados (CRM): empresa do lead, contato, produto, volume, valor, status e — para admin — a qual cliente da Bonsync pertence (campo cliente_bonsync).',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', description: 'pending, confirmed ou rejected. Vazio = todos.' } },
    },
  },
  {
    name: 'listar_conversas',
    description: 'Conversas recentes: contato, canal, status, data e — para admin — o cliente da Bonsync (cliente_bonsync). Útil para ver quem aguarda resposta (status open).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'open, resolved ou escalated. Vazio = todos.' },
        limite: { type: 'number', description: 'Máximo (padrão 15).' },
      },
    },
  },
  {
    name: 'buscar_conversas',
    description: 'Busca mensagens que contenham um termo. Para admin, mostra de qual cliente é cada resultado.',
    input_schema: {
      type: 'object',
      properties: { termo: { type: 'string', description: 'Palavra ou expressão a buscar.' } },
      required: ['termo'],
    },
  },
]

const ADMIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'listar_clientes',
    description: '[ADMIN] Lista os clientes da Bonsync: empresa, e-mail, plano, status da assinatura e agentes. Use para perguntas sobre a carteira de clientes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_financeiro',
    description: '[ADMIN] Resumo financeiro da plataforma: MRR, ARR, nº de clientes ativos, em teste e cancelados.',
    input_schema: { type: 'object', properties: {} },
  },
]

export function copilotoTools(isAdmin: boolean): Anthropic.Tool[] {
  return isAdmin ? [...BASE_TOOLS, ...ADMIN_TOOLS] : BASE_TOOLS
}

function ownerOf(row: any): string | null {
  return row?.agents?.profiles?.company_name ?? null
}

export async function runCopilotoTool(
  supabase: SupabaseClient,
  name: string,
  input: any,
  isAdmin: boolean,
): Promise<any> {
  try {
    if (name === 'consultar_metricas') {
      const dias = Number(input?.periodo_dias) || 30
      const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
      const { data: convs } = await supabase.from('conversations').select('status').gte('started_at', since)
      const c = convs ?? []
      const { data: deals } = await supabase.from('deals').select('status, valor')
      const d = deals ?? []
      return {
        periodo_dias: dias,
        conversas: {
          total: c.length,
          abertas: c.filter(x => x.status === 'open').length,
          resolvidas: c.filter(x => x.status === 'resolved').length,
          escaladas: c.filter(x => x.status === 'escalated').length,
        },
        negocios: {
          pendentes: d.filter(x => x.status === 'pending').length,
          fechados: d.filter(x => x.status === 'confirmed').length,
          valores_fechados: d.filter(x => x.status === 'confirmed').map(x => x.valor).filter(Boolean),
        },
      }
    }

    if (name === 'listar_negocios') {
      let q = supabase.from('deals')
        .select('empresa, contato_nome, produto, volume, valor, status, resumo, detected_at, agents(name, profiles(company_name))')
        .order('detected_at', { ascending: false }).limit(50)
      if (input?.status) q = q.eq('status', input.status)
      const { data } = await q
      const negocios = (data ?? []).map((n: any) => ({
        empresa_lead: n.empresa, contato: n.contato_nome, produto: n.produto,
        volume: n.volume, valor: n.valor, status: n.status, resumo: n.resumo,
        ...(isAdmin ? { cliente_bonsync: ownerOf(n) } : {}),
      }))
      return { negocios }
    }

    if (name === 'listar_conversas') {
      const limite = Number(input?.limite) || 15
      let q = supabase.from('conversations')
        .select('contact_identifier, channel, status, started_at, message_count, agents(name, profiles(company_name))')
        .order('started_at', { ascending: false }).limit(limite)
      if (input?.status) q = q.eq('status', input.status)
      const { data } = await q
      const conversas = (data ?? []).map((c: any) => ({
        contato: c.contact_identifier, canal: c.channel, status: c.status,
        data: c.started_at, mensagens: c.message_count,
        ...(isAdmin ? { cliente_bonsync: ownerOf(c) } : {}),
      }))
      return { conversas }
    }

    if (name === 'buscar_conversas') {
      const termo = String(input?.termo || '').trim()
      if (!termo) return { resultados: [] }
      const { data } = await supabase.from('messages')
        .select('content, role, created_at, conversations(contact_identifier, agents(name, profiles(company_name)))')
        .ilike('content', `%${termo}%`).order('created_at', { ascending: false }).limit(20)
      const resultados = (data ?? []).map((m: any) => ({
        texto: m.content, autor: m.role, data: m.created_at,
        contato: m.conversations?.contact_identifier,
        ...(isAdmin ? { cliente_bonsync: m.conversations?.agents?.profiles?.company_name ?? null } : {}),
      }))
      return { resultados }
    }

    // ── Ferramentas de admin ──
    if (name === 'listar_clientes') {
      if (!isAdmin) return { error: 'Sem permissão.' }
      const { data } = await supabase.from('profiles')
        .select('company_name, email, created_at, subscriptions(plan_name, monthly_price, status), agents(name, status)')
        .eq('role', 'client')
      const clientes = (data ?? []).map((p: any) => ({
        empresa: p.company_name, email: p.email, desde: p.created_at,
        plano: p.subscriptions?.plan_name ?? null,
        valor_mensal: p.subscriptions?.monthly_price ?? null,
        assinatura: p.subscriptions?.status ?? 'sem assinatura',
        agentes: (p.agents ?? []).map((a: any) => ({ nome: a.name, status: a.status })),
      }))
      return { clientes }
    }

    if (name === 'consultar_financeiro') {
      if (!isAdmin) return { error: 'Sem permissão.' }
      const { data } = await supabase.from('subscriptions').select('monthly_price, status')
      const subs = data ?? []
      const mrr = subs.filter(s => s.status === 'active').reduce((a, s) => a + Number(s.monthly_price || 0), 0)
      return {
        mrr, arr: mrr * 12,
        ativos: subs.filter(s => s.status === 'active').length,
        em_teste: subs.filter(s => s.status === 'trial').length,
        cancelados: subs.filter(s => s.status === 'cancelled').length,
      }
    }

    return { error: 'Ferramenta desconhecida.' }
  } catch (err: any) {
    return { error: 'Falha ao consultar: ' + err.message }
  }
}
