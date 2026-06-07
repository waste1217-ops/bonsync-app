'use client'

import { useState } from 'react'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'

interface Report {
  satisfacao_media: number
  resumo: string
  elogios: any[]
  reclamacoes: any[]
  conversas: number
  period_days: number
}

const sevVariant = (s?: string): 'red' | 'yellow' | 'muted' => s === 'alta' ? 'red' : s === 'media' ? 'yellow' : 'muted'

function Stars({ n }: { n: number }) {
  const full = Math.round(n)
  return <span style={{ letterSpacing: 2 }}>{'★'.repeat(full)}<span style={{ color: C.border }}>{'★'.repeat(5 - full)}</span></span>
}

export function AvaliacoesPanel() {
  const [period, setPeriod] = useState(30)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function analisar() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/painel/avaliacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_days: period }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha.')
      setReport(data.report)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={T.label}>Período</label>
          <select className="field" value={period} onChange={e => setPeriod(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>
        <button onClick={analisar} disabled={loading} className="btn-primary" style={{ fontSize: 13 }}>
          {loading ? 'Analisando…' : '✨ Avaliar atendimentos'}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>{error}</div>}

      {!report ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '56px 24px' }}>
          <p style={{ fontSize: 30, marginBottom: 12 }}>⭐</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white }}>Descubra como anda a satisfação dos seus clientes</p>
          <p style={{ ...T.sub, marginTop: 4 }}>A IA lê as conversas e estima a nota, separando elogios e reclamações.</p>
        </div>
      ) : (
        <>
          {/* Nota + resumo */}
          <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 44, color: C.green, lineHeight: 1 }}>{report.satisfacao_media.toFixed(1)}</p>
              <p style={{ fontSize: 18, color: C.green, marginTop: 4 }}><Stars n={report.satisfacao_media} /></p>
              <p style={{ ...T.mono, fontSize: 8, color: C.faint, marginTop: 6 }}>estimada por IA · {report.conversas} conversas</p>
            </div>
            <p style={{ flex: 1, minWidth: 200, fontFamily: FONT.dm, fontSize: 14, color: C.muted, lineHeight: 1.7, fontWeight: 300 }}>{report.resumo}</p>
          </div>

          {/* Elogios */}
          <div style={{ ...CARD, marginBottom: 16 }}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 14 }}>👏 Elogios <span style={{ color: C.faint, fontWeight: 400 }}>· {report.elogios.length}</span></h2>
            {!report.elogios.length ? <p style={{ ...T.sub, fontSize: 13 }}>Nenhum elogio destacado no período.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {report.elogios.map((e, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {e.contato && <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13, color: C.white }}>{e.contato}</span>}
                      {e.conversation_id && <a href={`/painel/conversas/${e.conversation_id}`} style={{ ...T.mono, fontSize: 9, color: C.blueB }}>ver conversa →</a>}
                    </div>
                    <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, marginTop: 2 }}>{e.resumo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reclamações */}
          <div style={CARD}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 14 }}>🚨 Reclamações <span style={{ color: C.faint, fontWeight: 400 }}>· {report.reclamacoes.length}</span></h2>
            {!report.reclamacoes.length ? <p style={{ ...T.sub, fontSize: 13 }}>Nenhuma reclamação detectada. 🎉</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {report.reclamacoes.map((r, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={badgeStyle(sevVariant(r.severidade))}>{r.severidade || 'baixa'}</span>
                      {r.contato && <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13, color: C.white }}>{r.contato}</span>}
                      {r.conversation_id && <a href={`/painel/conversas/${r.conversation_id}`} style={{ ...T.mono, fontSize: 9, color: C.blueB }}>ver conversa →</a>}
                    </div>
                    <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, marginTop: 2 }}>{r.resumo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
