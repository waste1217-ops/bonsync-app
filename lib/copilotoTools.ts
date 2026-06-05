import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * Ferramentas SOMENTE LEITURA do Copiloto sobre os dados da Bonsync.
 * A segurança de acesso é garantida pelo RLS do Supabase (o client é
 * a sessão do usuário): cada cliente só lê os próprios dados; admin lê tudo.
 * NENHUMA ferramenta escreve/altera nada.
 */

export const COPILOTO_TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_metricas',
    description: 'Retorna métricas de atendimento do negócio na Bonsync: total de conversas (abertas, resolvidas, escaladas) e negócios (pendentes, fechados) em um período. Use para perguntas sobre números, volume, desempenho.',
    input_schema: {
      type: 'object',
      properties: {
        periodo_dias: { type: 'number', description: 'Quantos dias para trás considerar (ex: 7, 30). Padrão 30.' },
      },
    },
  },
  {
    name: 'listar_negocios',
    description: 'Lista os negócios/clientes detectados pelo agente (CRM). Cada um tem empresa, contato, produto, volume, valor, status (pending/confirmed/rejected) e resumo. Use para perguntas sobre vendas, fechamentos, leads.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrar por status: pending, confirmed ou rejected. Vazio = todos.' },
      },
    },
  },
  {
    name: 'listar_conversas',
    description: 'Lista conversas recentes do agente: contato, canal, status e data. Use para ver atendimentos recentes ou quem está aguardando resposta (status open).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrar: open, resolved ou escalated. Vazio = todos.' },
        limite: { type: 'number', description: 'Máximo de resultados (padrão 15).' },
      },
    },
  },
  {
    name: 'buscar_conversas',
    description: 'Busca mensagens que contenham um termo nas conversas. Use para saber sobre o que os clientes estão falando (ex: "frete", "cancelamento").',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Palavra ou expressão a buscar.' },
      },
      required: ['termo'],
    },
  },
]

export async function runCopilotoTool(
  supabase: SupabaseClient,
  name: string,
  input: any,
): Promise<any> {
  try {
    if (name === 'consultar_metricas') {
      const dias = Number(input?.periodo_dias) || 30
      const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

      const { data: convs } = await supabase
        .from('conversations').select('status, started_at').gte('started_at', since)
      const c = convs ?? []
      const { data: deals } = await supabase
        .from('deals').select('status, valor, detected_at')
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
      let q = supabase.from('deals').select('empresa, contato_nome, produto, volume, valor, status, resumo, detected_at').order('detected_at', { ascending: false }).limit(50)
      if (input?.status) q = q.eq('status', input.status)
      const { data } = await q
      return { negocios: data ?? [] }
    }

    if (name === 'listar_conversas') {
      const limite = Number(input?.limite) || 15
      let q = supabase.from('conversations').select('contact_identifier, channel, status, started_at, message_count').order('started_at', { ascending: false }).limit(limite)
      if (input?.status) q = q.eq('status', input.status)
      const { data } = await q
      return { conversas: data ?? [] }
    }

    if (name === 'buscar_conversas') {
      const termo = String(input?.termo || '').trim()
      if (!termo) return { resultados: [] }
      const { data } = await supabase
        .from('messages').select('content, role, created_at')
        .ilike('content', `%${termo}%`)
        .order('created_at', { ascending: false })
        .limit(20)
      return { resultados: data ?? [] }
    }

    return { error: 'Ferramenta desconhecida.' }
  } catch (err: any) {
    return { error: 'Falha ao consultar: ' + err.message }
  }
}
