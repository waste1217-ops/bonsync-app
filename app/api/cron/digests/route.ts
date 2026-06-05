import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, digestEmailHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret
}

async function sendWhatsapp(number: string, text: string) {
  const url = process.env.EVOLUTION_API_URL, key = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE_NAME || 'javai'
  if (!url || !key || !number) return
  try {
    await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: number.replace(/\D/g, ''), text }),
    })
  } catch {}
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // Segunda-feira em BRT? (para resumos semanais)
  const agoraBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const isMonday = agoraBRT.getDay() === 1

  const { data: agents } = await admin
    .from('agents')
    .select('id, name, config, profiles(email, company_name)')
    .eq('status', 'active')

  let enviados = 0
  for (const a of (agents ?? []) as any[]) {
    const cfg = a.config || {}
    const freq = cfg.digest_frequency || 'off'
    if (freq === 'off') continue
    if (freq === 'weekly' && !isMonday) continue

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
    if (conversas.total === 0 && fechados.length === 0) continue

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
      await sendWhatsapp(cfg.escalation_phone, texto)
      enviados++
    }
  }

  return NextResponse.json({ ok: true, enviados })
}
