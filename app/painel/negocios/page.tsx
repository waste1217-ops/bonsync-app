import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'
import { DealActions } from '@/components/DealActions'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })

export default async function NegociosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: agent } = await supabase
    .from('agents').select('id, name').eq('client_id', user!.id).single()

  const { data: deals } = await supabase
    .from('deals').select('*')
    .eq('agent_id', agent?.id ?? '')
    .order('detected_at', { ascending: false })

  const all       = deals ?? []
  const pending   = all.filter(d => d.status === 'pending')
  const confirmed = all.filter(d => d.status === 'confirmed')

  // Resumo semanal (últimos 7 dias)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const confirmedWeek = confirmed.filter(d => d.confirmed_at && new Date(d.confirmed_at).getTime() >= weekAgo)

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Negócios</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Clientes fechados detectados pelo agente, com confirmação da sua equipe.</p>
      </div>

      {/* Resumo semanal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Fechados (7 dias)', value: confirmedWeek.length, color: C.green },
          { label: 'Total de clientes', value: confirmed.length,     color: C.blueB },
          { label: 'Aguardando confirmação', value: pending.length,  color: C.yellow },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 34, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Pendentes de confirmação */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 14 }}>
            Aguardando sua confirmação
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map(d => (
              <div key={d.id} style={{ background: C.deep, border: `1px solid ${C.yellow}33`, borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 17, color: C.white }}>
                        {d.empresa || 'Empresa não identificada'}
                      </span>
                      <span style={{ ...T.mono, fontSize: 9, color: C.yellow, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 9px', borderRadius: 100 }}>
                        PENDENTE
                      </span>
                    </div>
                    <DealFields d={d} />
                  </div>
                  <DealActions dealId={d.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clientes confirmados */}
      <div>
        <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 14 }}>
          Clientes fechados
        </h2>
        {confirmed.length === 0 ? (
          <div style={{ ...CARD, textAlign: 'center', padding: '48px 24px', ...T.sub }}>
            Nenhum negócio fechado ainda. Quando o agente detectar um fechamento, ele aparece aqui para sua confirmação.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {confirmed.map(d => (
              <div key={d.id} style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 17, color: C.white }}>
                      {d.empresa || 'Empresa'}
                    </span>
                    <span style={{ ...T.mono, fontSize: 9, color: C.green, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '3px 9px', borderRadius: 100 }}>
                      CLIENTE
                    </span>
                  </div>
                  {d.confirmed_at && (
                    <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.faint }}>fechado em {fmtDate(d.confirmed_at)}</span>
                  )}
                </div>
                <DealFields d={d} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DealFields({ d }: { d: any }) {
  const fields = [
    ['Contato', d.contato_nome],
    ['Produto / serviço', d.produto],
    ['Volume', d.volume],
    ['Valor estimado', d.valor],
  ].filter(([, v]) => v)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: d.resumo ? 12 : 0 }}>
        {fields.map(([k, v]) => (
          <div key={k as string}>
            <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>{k}</p>
            <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{v as string}</p>
          </div>
        ))}
      </div>
      {d.resumo && (
        <div>
          <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>Resumo da negociação</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, lineHeight: 1.6, fontWeight: 300 }}>{d.resumo}</p>
        </div>
      )}
    </div>
  )
}
