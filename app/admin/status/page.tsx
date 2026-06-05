import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'

export const dynamic = 'force-dynamic'

async function checkEvolution() {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return { ok: false, reason: 'Variáveis EVOLUTION_* não configuradas na Vercel', instances: [] as { name: string; status: string }[] }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 7000)
    const res = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key }, signal: ctrl.signal, cache: 'no-store',
    })
    clearTimeout(t)
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, instances: [] }
    const data = await res.json()
    const instances = (Array.isArray(data) ? data : []).map((i: any) => ({
      name: i.name, status: i.connectionStatus || 'unknown',
    }))
    return { ok: true, reason: '', instances }
  } catch {
    return { ok: false, reason: 'Inacessível (timeout ou conexão recusada)', instances: [] }
  }
}

export default async function StatusPage() {
  const supabase = await createClient()

  // Supabase
  const { error: sbErr } = await supabase.from('agents').select('id', { count: 'exact', head: true })
  const supabaseOk = !sbErr

  // Evolution / VPS / WhatsApp
  const evo = await checkEvolution()

  // Agentes em erro
  const { data: errAgents } = await supabase
    .from('agents').select('id, name, profiles(company_name)').eq('status', 'error')

  // ── Monta alertas ──
  const alertas: { level: 'critical' | 'warning'; msg: string }[] = []
  if (!supabaseOk) alertas.push({ level: 'critical', msg: 'Banco de dados (Supabase) inacessível.' })
  if (!evo.ok) alertas.push({ level: 'critical', msg: 'Infraestrutura (VPS/Evolution) inacessível: ' + evo.reason })
  evo.instances.forEach(i => {
    if (i.status !== 'open') alertas.push({ level: 'warning', msg: `WhatsApp "${i.name}" desconectado (${i.status}).` })
  })
  ;(errAgents ?? []).forEach((a: any) => {
    alertas.push({ level: 'warning', msg: `Agente "${a.name}" (${a.profiles?.company_name ?? '—'}) está com erro.` })
  })

  const dot = (ok: boolean) => ({ width: 10, height: 10, borderRadius: '50%', background: ok ? C.green : C.red, boxShadow: `0 0 10px ${ok ? C.green : C.red}` })

  const servicos = [
    { nome: 'Banco de dados (Supabase)', ok: supabaseOk, detalhe: supabaseOk ? 'Operacional' : 'Sem resposta' },
    { nome: 'Infraestrutura (VPS + Evolution)', ok: evo.ok, detalhe: evo.ok ? 'Operacional' : evo.reason },
  ]

  const tudoOk = supabaseOk && evo.ok && alertas.length === 0

  return (
    <div className="animate-slide-up" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={T.h1}>Status do sistema</h1>
          <p style={{ ...T.sub, marginTop: 4 }}>Saúde da infraestrutura e alertas em tempo real.</p>
        </div>
        <a href="/admin/status" className="btn-ghost" style={{ fontSize: 12, padding: '9px 18px' }}>↻ Atualizar</a>
      </div>

      {/* Banner geral */}
      <div style={{
        ...CARD, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
        border: `1px solid ${tudoOk ? 'rgba(34,197,94,0.3)' : alertas.some(a => a.level === 'critical') ? 'rgba(232,64,64,0.3)' : 'rgba(245,158,11,0.3)'}`,
        background: tudoOk ? 'rgba(34,197,94,0.05)' : alertas.some(a => a.level === 'critical') ? 'rgba(232,64,64,0.05)' : 'rgba(245,158,11,0.05)',
      }}>
        <span style={dot(tudoOk)} className={tudoOk ? 'animate-pulse-dot' : ''} />
        <span style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>
          {tudoOk ? 'Todos os sistemas operacionais' : alertas.some(a => a.level === 'critical') ? 'Problema crítico detectado' : 'Atenção — há avisos'}
        </span>
      </div>

      {/* Serviços */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 20 }}>
        {servicos.map(s => (
          <div key={s.nome} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={dot(s.ok)} />
              <span style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>{s.nome}</span>
            </div>
            <p style={{ ...T.sub, fontSize: 13 }}>{s.detalhe}</p>
          </div>
        ))}
      </div>

      {/* WhatsApp instâncias */}
      <div style={{ ...CARD, marginBottom: 20 }}>
        <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 16 }}>Conexões WhatsApp</h2>
        {!evo.ok ? (
          <p style={{ ...T.sub, fontSize: 13 }}>Não foi possível consultar (infraestrutura inacessível).</p>
        ) : evo.instances.length === 0 ? (
          <p style={{ ...T.sub, fontSize: 13 }}>Nenhuma instância encontrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {evo.instances.map(i => {
              const ok = i.status === 'open'
              return (
                <div key={i.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.void, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={dot(ok)} />
                    <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{i.name}</span>
                  </div>
                  <span style={{ fontFamily: FONT.jb, fontSize: 11, color: ok ? C.green : C.red }}>
                    {ok ? 'conectado' : i.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Alertas */}
      <div style={CARD}>
        <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 16 }}>Alertas</h2>
        {alertas.length === 0 ? (
          <p style={{ ...T.sub, fontSize: 13 }}>✓ Nenhum alerta no momento.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alertas.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
                background: a.level === 'critical' ? 'rgba(232,64,64,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${a.level === 'critical' ? 'rgba(232,64,64,0.25)' : 'rgba(245,158,11,0.25)'}`,
              }}>
                <span style={{ fontSize: 14 }}>{a.level === 'critical' ? '🔴' : '🟡'}</span>
                <span style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 300 }}>{a.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
