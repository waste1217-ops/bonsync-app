import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, digestEmailHtml } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret
}

// Envia o resumo pelo canal do PRÓPRIO agente (Meta ou Evolution), não por uma
// instância global. cfg = agent.config.
async function sendWhatsappDigest(cfg: any, number: string, text: string) {
  if (!number) return
  try { await sendWhatsApp(cfg, number, text) } catch (e: any) { console.error('[digests] envio WA falhou:', e?.message) }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // Segunda-feira em BRT? (para resumos semanais)
  const agoraBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const isMonday = agoraBRT.getDay() === 1

  const force = req.nextUrl.searchParams.get('force') === '1'

  const { data: agents } = await admin
    .from('agents')
    .select('id, name, config, profiles(email, company_name)')
    .eq('status', 'active')

  let enviados = 0
  for (const a of (agents ?? []) as any[]) {
    const cfg = a.config || {}
    const freq = cfg.digest_frequency || 'off'
    if (!force) {
      if (freq === 'off') continue
      if (freq === 'weekly' && !isMonday) continue
    }

    const dias = freq === 'weekly' ? 7 : 1
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
    const periodoLabel = freq === 'weekly' ? 'da semana' : 'de hoje'

    // Dados do período
    const { data: convs } = await admin.from('conversations').select('id, status').eq('agent_id', a.id).gte('started_at', since)
    const c = convs ?? []
    const { data: fechadosData } = await admin.from('deals').select('empresa, valor, confirmed_at').eq('agent_id', a.id).eq('status', 'confirmed').gte('confirmed_at', since)
    const { count: pendentes } = await admin.from('deals').select('*', { count: 'exact', head: true }).eq('agent_id', a.id).eq('status', 'pending')

    const conversas = {
      total: c.length,
      resolvidas: c.filter(x => x.status === 'resolved').length,
      escaladas: c.filter(x => x.status === 'escalated').length,
      abertas: c.filter(x => x.status === 'open').length,
    }
    const fechados = (fechadosData ?? []).map((f: any) => ({ empresa: f.empresa, valor: f.valor }))

    // Nada relevante? evita spam de resumo vazio (só envia se houve atividade)
    if (!force && conversas.total === 0 && fechados.length === 0) continue

    const empresa = a.profiles?.company_name || 'sua empresa'
    const email = a.profiles?.email
    const canal = cfg.digest_channel || 'email'

    if ((canal === 'email' || canal === 'both') && email) {
      await sendEmail({
        to: email,
        subject: `Resumo ${periodoLabel} — ${empresa}`,
        html: digestEmailHtml({ empresa, periodoLabel, conversas, fechados, pendentes: pendentes ?? 0 }),
      })
      enviados++
    }

    if ((canal === 'whatsapp' || canal === 'both') && cfg.escalation_phone) {
      const fechadosTxt = fechados.length
        ? fechados.map(f => `• ${f.empresa || 'Negócio'}${f.valor ? ' — ' + f.valor : ''}`).join('\n')
        : '• Nenhum fechamento no período.'
      const texto = `📊 *Resumo ${periodoLabel} — ${empresa}*\n\n` +
        `💬 Atendimentos: ${conversas.total}\n✅ Resolvidos: ${conversas.resolvidas}\n🚨 Escalados: ${conversas.escaladas}\n📨 Em aberto: ${conversas.abertas}\n\n` +
        `🤝 *Negócios fechados:*\n${fechadosTxt}\n\n` +
        `${pendentes ?? 0} negócio(s) aguardando confirmação no painel.`
      await sendWhatsappDigest(cfg, cfg.escalation_phone, texto)
      enviados++
    }
  }

  return NextResponse.json({ ok: true, enviados })
}
