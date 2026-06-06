'use client'

import { useState } from 'react'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'

interface Cliente { id: string; nome: string }
interface Insight {
  scope: string
  period_days: number
  summary: string
  complaints: any[]
  opportunities: any[]
  failures: any[]
  stats: { conversas?: number; reclamacoes?: number; oportunidades?: number; falhas?: number }
  created_at: string
}

const sevVariant = (s?: string): 'red' | 'yellow' | 'muted' =>
  s === 'alta' ? 'red' : s === 'media' ? 'yellow' : 'muted'

function ConvLink({ id }: { id?: string }) {
  if (!id) return null
  return (
    <a href={`/admin/conversas/${id}`} style={{ ...T.mono, fontSize: 9, color: C.blueB, marginLeft: 8 }}>
      ver conversa →
    </a>
  )
}

export function InteligenciaPanel({ clientes, initial }: { clientes: Cliente[]; initial: Insight | null }) {
  const [scope, setScope]     = useState('')      // '' = global
  const [period, setPeriod]   = useState(7)
  const [insight, setInsight] = useState<Insight | null>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function carregar(novoScope: string) {
    setScope(novoScope)
    setError('')
    const qs = novoScope ? `?client_id=${novoScope}` : '?scope=global'
    const res = await fetch(`/api/admin/analise${qs}`)
    const data = await res.json()
    setInsight(res.ok ? data.insight : null)
  }

  async function analisar() {
    setLoading(true); setError('')
    const res = await fetch('/api/admin/analise', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: scope || null, period_days: period }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Falha na análise.'); return }
    setInsight(data.insight)
  }

  const nomeCliente = scope ? (clientes.find(c => c.id === scope)?.nome ?? 'cliente') : 'Todos os clientes'

  return (
    <div>
      {/* Controles */}
      <div style={{ ...CARD, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={T.label}>Escopo</label>
          <select className="field" value={scope} onChange={e => carregar(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
            <option value="">Todos os clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={T.label}>Período</label>
          <select className="field" value={period} onChange={e => setPeriod(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </div>
        <button onClick={analisar} disabled={loading} className="btn-primary" style={{ fontSize: 13 }}>
          {loading ? 'Analisando…' : '✨ Analisar agora'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!insight ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '56px 24px' }}>
          <p style={{ fontSize: 30, marginBottom: 12 }}>🧠</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white, marginBottom: 6 }}>Nenhuma análise ainda para {nomeCliente}</p>
          <p style={T.sub}>Clique em "Analisar agora" para a IA examinar as conversas do período.</p>
        </div>
      ) : (
        <>
          {/* Resumo + stats */}
          <div style={{ ...CARD, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Resumo executivo</h2>
              <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>
                {insight.period_days}d · {new Date(insight.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.muted, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap' }}>
              {insight.summary}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 18 }}>
              {[
                { label: 'Conversas', value: insight.stats?.conversas ?? 0, color: C.blueB },
                { label: 'Reclamações', value: insight.stats?.reclamacoes ?? 0, color: C.red },
                { label: 'Oportunidades', value: insight.stats?.oportunidades ?? 0, color: C.green },
                { label: 'Falhas', value: insight.stats?.falhas ?? 0, color: C.yellow },
              ].map(s => (
                <div key={s.label} style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px' }}>
                  <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 6 }}>{s.label}</p>
                  <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reclamações */}
          <Secao titulo="🚨 Reclamações" vazio="Nenhuma reclamação detectada." itens={insight.complaints}
            render={(c, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={badgeStyle(sevVariant(c.severidade))}>{c.severidade || 'baixa'}</span>
                  <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13, color: C.white }}>{c.cliente}</span>
                  <ConvLink id={c.conversation_id} />
                </div>
                <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{c.resumo}</p>
              </div>
            )} />

          {/* Oportunidades */}
          <Secao titulo="💰 Oportunidades de venda" vazio="Nenhuma oportunidade identificada." itens={insight.opportunities}
            render={(o, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13, color: C.white }}>{o.cliente}</span>
                  <ConvLink id={o.conversation_id} />
                </div>
                <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{o.resumo}</p>
              </div>
            )} />

          {/* Falhas */}
          <Secao titulo="⚠️ Falhas do agente" vazio="Nenhuma falha relevante detectada." itens={insight.failures}
            render={(f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13, color: C.white }}>{f.cliente}</span>
                  {f.agente && <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>{f.agente}</span>}
                  <ConvLink id={f.conversation_id} />
                </div>
                <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{f.resumo}</p>
              </div>
            )} />
        </>
      )}
    </div>
  )
}

function Secao({ titulo, vazio, itens, render }: { titulo: string; vazio: string; itens: any[]; render: (item: any, i: number) => React.ReactNode }) {
  return (
    <div style={{ ...CARD, marginBottom: 16 }}>
      <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 14 }}>
        {titulo} <span style={{ color: C.faint, fontWeight: 400 }}>· {itens?.length ?? 0}</span>
      </h2>
      {!itens?.length ? (
        <p style={{ ...T.sub, fontSize: 13 }}>{vazio}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {itens.map(render)}
        </div>
      )}
    </div>
  )
}
