import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 45

// Gera um rascunho de proposta comercial a partir de um negócio (deal). Não grava nada.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { deal_id } = await req.json().catch(() => ({}))
  if (!deal_id) return NextResponse.json({ error: 'deal_id obrigatório.' }, { status: 400 })

  const { data: deal } = await supabase
    .from('deals').select('*, agents!inner(client_id, name, profiles(company_name))')
    .eq('id', deal_id).eq('agents.client_id', user.id).single()
  if (!deal) return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servidor sem chave de IA.' }, { status: 500 })

  const empresaFornecedor = (deal as any).agents?.profiles?.company_name || 'a empresa'
  const dados = [
    `Cliente: ${deal.empresa || deal.contato_nome || 'cliente'}`,
    deal.contato_nome && `Contato: ${deal.contato_nome}`,
    deal.produto && `Produto/serviço: ${deal.produto}`,
    deal.volume && `Volume: ${deal.volume}`,
    deal.valor && `Valor estimado: ${deal.valor}`,
    deal.resumo && `Contexto da conversa: ${deal.resumo}`,
  ].filter(Boolean).join('\n')

  const anthropic = new Anthropic({ apiKey })
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 900,
      system: `Você é um especialista comercial de ${empresaFornecedor}. Escreva propostas comerciais claras, profissionais e persuasivas em português do Brasil, prontas para enviar ao cliente pelo WhatsApp ou e-mail. Use tom cordial e objetivo. Não invente valores que não foram informados; quando faltar dado, use marcadores como [preencher].`,
      messages: [{ role: 'user', content: `Crie uma proposta comercial curta e bem estruturada com base nestes dados:\n\n${dados}\n\nInclua: saudação, resumo da necessidade, o que será oferecido, valor/condições (se houver), próximos passos e um fechamento cordial.` }],
    })
    const text = resp.content.filter(b => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    return NextResponse.json({ proposta: text || 'Não foi possível gerar a proposta.' })
  } catch (e: any) {
    console.error('[gerar-proposta]', e?.message)
    return NextResponse.json({ error: 'Falha ao gerar proposta.' }, { status: 502 })
  }
}
