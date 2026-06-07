'use client'

import { useEffect, useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

interface Report {
  satisfacao_media: number
  classificacao_geral: string
  resumo: string
  sentimento: { positivo: number; neutro: number; negativo: number }
  elogios: any[]
  reclamacoes: any[]
  pontos_atencao: any[]
  temas: { tema: string; n?: number }[]
  recomendacoes: string[]
  conversas: number
  period_days: number
}

const prioMeta: Record<string, { label: string; cor: string }> = {
  alta: { label: 'Alta', cor: 'var(--c-red)' }, media: { label: 'Média', cor: 'var(--c-yellow)' }, baixa: { label: 'Baixa', cor: 'var(--c-muted)' },
}
const statusMeta: Record<string, { label: string; cor: string }> = {
  nova: { label: 'Nova', cor: 'var(--c-yellow)' }, analise: { label: 'Em análise', cor: 'var(--c-yellow)' },
  resolvida: { label: 'Resolvida', cor: 'var(--c-green)' }, ignorada: { label: 'Ignorada', cor: 'var(--c-muted)' },
}
const STATUS_KEY = 'bonsync-aval-status'

function Stars({ n }: { n: number }) {
  const full = Math.round(n)
  return <span style={{ letterSpacing: 3, fontSize: 20 }}>{'★'.repeat(full)}<span style={{ color: C.border }}>{'★'.repeat(5 - full)}</span></span>
}
function Badge({ children, cor }: { children: React.ReactNode; cor: string }) {
  return <span style={{ fontFamily: FONT.jb, fontSize: 8.5, color: cor, padding: '3px 8px', borderRadius: 100, background: `color-mix(in oklch, ${cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 28%, transparent)` }}>{children}</span>
}

export function AvaliacoesPanel() {
  const [periodDays, setPeriodDays] = useState(30)
  const [periodoLabel, setPeriodoLabel] = useState('Últimos 30 dias')
  const [desde, setDesde] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})

  useEffect(() => { try { setStatusMap(JSON.parse(localStorage.getItem(STATUS_KEY) || '{}')) } catch {} }, [])
  function setStatus(id: string, s: string) { const m = { ...statusMap, [id]: s }; setStatusMap(m); localStorage.setItem(STATUS_KEY, JSON.stringify(m)) }

  function setPreset(dias: number, label: string) { setPeriodDays(dias); setPeriodoLabel(label); setDesde('') }
  function aplicarDesde() {
    if (!desde) return
    const d = Math.max(1, Math.ceil((Date.now() - new Date(desde + 'T00:00:00').getTime()) / 86400000))
    setPeriodDays(d); setPeriodoLabel(`Desde ${new Date(desde + 'T00:00:00').toLocaleDateString('pt-BR')}`)
  }

  async function analisar() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/painel/avaliacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period_days: periodDays }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha.')
      setReport(data.report)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  function exportar() {
    if (!report) return
    const linhas: string[][] = [
      ['Periodo', periodoLabel], ['Nota media', `${report.satisfacao_media.toFixed(1)}/5`], ['Conversas analisadas', String(report.conversas)],
      ['Positivo', String(report.sentimento.positivo)], ['Neutro', String(report.sentimento.neutro)], ['Negativo', String(report.sentimento.negativo)],
      ['Elogios', String(report.elogios.length)], ['Reclamacoes', String(report.reclamacoes.length)],
      [], ['Reclamacao', 'Tema', 'Severidade', 'Resumo'],
      ...report.reclamacoes.map(r => [r.titulo || r.resumo, r.tema || '', r.severidade || '', r.resumo || '']),
    ]
    const csv = linhas.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `avaliacoes-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const PRES = [[1, 'Hoje'], [7, '7 dias'], [30, '30 dias']] as [number, string][]
  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties

  // Toolbar (sempre visível)
  const toolbar = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PRES.map(([d, l]) => <button key={l} onClick={() => setPreset(d, `Últimos ${l.toLowerCase()}`.replace('últimos hoje', 'Hoje'))} className={periodDays === d && !desde ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 12, padding: '8px 14px' }}>{l}</button>)}
        <button onClick={() => { const now = new Date(); const dias = now.getDate(); setPreset(dias, 'Este mês') }} className={periodoLabel === 'Este mês' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 12, padding: '8px 14px' }}>Este mês</button>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="date" className="field" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '7px 10px' }} />
        <button onClick={aplicarDesde} className="btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }}>Aplicar</button>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={analisar} disabled={loading} className="btn-primary" style={{ fontSize: 13 }}>{loading ? 'Analisando…' : '✨ Avaliar atendimentos'}</button>
      {report && <button onClick={exportar} className="btn-ghost" style={{ fontSize: 13 }}>⬇ Exportar relatório</button>}
    </div>
  )

  const errBox = error ? <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>{error}</div> : null

  if (!report) {
    return (
      <div>
        {toolbar}{errBox}
        <div style={{ ...CARD, textAlign: 'center', padding: '64px 24px' }}>
          <p style={{ fontSize: 30, marginBottom: 12 }}>⭐</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white }}>Descubra como anda a satisfação dos seus clientes</p>
          <p style={{ ...T.sub, marginTop: 4 }}>A IA lê as conversas do período e estima a nota, separando elogios, reclamações e pontos de atenção.</p>
        </div>
      </div>
    )
  }

  const r = report
  const total = r.conversas || (r.sentimento.positivo + r.sentimento.neutro + r.sentimento.negativo) || 1
  const predominante = r.sentimento.negativo >= r.sentimento.neutro && r.sentimento.negativo >= r.sentimento.positivo ? 'Negativo'
    : r.sentimento.positivo >= r.sentimento.neutro ? 'Positivo' : 'Neutro'
  const cards = [
    { label: 'Nota média', value: `${r.satisfacao_media.toFixed(1)} / 5`, cor: 'var(--c-green)', desc: 'Estimativa de satisfação baseada nas conversas.', small: true },
    { label: 'Conversas analisadas', value: String(r.conversas), cor: 'var(--c-blue-b)', desc: 'Atendimentos avaliados pela IA no período.' },
    { label: 'Elogios', value: String(r.elogios.length), cor: 'var(--c-green)', desc: 'Comentários positivos identificados.' },
    { label: 'Reclamações', value: String(r.reclamacoes.length), cor: r.reclamacoes.length ? 'var(--c-red)' : 'var(--c-white)', desc: 'Sinais claros de insatisfação.' },
    { label: 'Pontos de atenção', value: String(r.pontos_atencao.length), cor: r.pontos_atencao.length ? 'var(--c-yellow)' : 'var(--c-white)', desc: 'Conversas com risco de frustração.' },
  ]
  const dist = [
    { label: 'Positivo', v: r.sentimento.positivo, cor: 'var(--c-green)' },
    { label: 'Neutro', v: r.sentimento.neutro, cor: 'var(--c-muted)' },
    { label: 'Negativo', v: r.sentimento.negativo, cor: 'var(--c-red)' },
  ]
  const recs = r.recomendacoes.length ? r.recomendacoes : ['Revisar conversas com sentimento negativo.', 'Adicionar regras na base de conhecimento sobre os temas mais sensíveis.']

  return (
    <div>
      {toolbar}{errBox}

      {/* Cards de resumo */}
      <div className="av-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: c.small ? 22 : 28, color: c.cor, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{c.value}</p>
            <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="av-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        {/* ESQUERDA */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card da nota */}
          <div style={{ ...CARD, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 46, color: C.green, lineHeight: 1 }}>{r.satisfacao_media.toFixed(1)}<span style={{ fontSize: 18, color: C.muted }}> / 5</span></p>
              <p style={{ color: C.green, marginTop: 6 }}><Stars n={r.satisfacao_media} /></p>
              <p style={{ ...T.mono, fontSize: 8, color: C.faint, marginTop: 6 }}>baseada em {r.conversas} conversas</p>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              {r.classificacao_geral && <p style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 6 }}>Classificação geral: {r.classificacao_geral}</p>}
              <p style={{ ...T.sub, fontSize: 13, lineHeight: 1.5 }}>A IA identifica sinais de satisfação, frustração, elogios e reclamações nas conversas. Esta nota é uma estimativa.</p>
            </div>
          </div>

          {/* Resumo da satisfação */}
          <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, oklch(22% 0.07 230 / 0.45), var(--c-deep))', border: '1px solid oklch(70% 0.16 220 / 0.3)', borderRadius: 14, padding: '18px 20px' }}>
            <p style={{ ...T.mono, fontSize: 10, letterSpacing: '0.16em', color: 'oklch(80% 0.12 215)', marginBottom: 8 }}>Resumo da satisfação · IA</p>
            <p style={{ fontFamily: FONT.dm, fontSize: 14.5, color: C.white, lineHeight: 1.65, fontWeight: 300 }}>{r.resumo}</p>
          </div>

          {/* Distribuição de sentimento */}
          <div style={CARD}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 14 }}>Distribuição de sentimento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dist.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, width: 70, flexShrink: 0 }}>{d.label}</span>
                  <div style={{ flex: 1, height: 10, background: C.void, borderRadius: 100, overflow: 'hidden' }}><div style={{ width: `${(d.v / total) * 100}%`, height: '100%', background: d.cor, opacity: 0.85 }} /></div>
                  <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted, width: 28, textAlign: 'right' }}>{d.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Elogios */}
          <div style={CARD}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 12 }}>👏 Elogios <span style={{ color: C.faint, fontWeight: 400 }}>· {r.elogios.length}</span></h2>
            {!r.elogios.length ? (
              <div>
                <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>Nenhum elogio destacado no período.</p>
                <p style={{ ...T.sub, fontSize: 12.5, marginTop: 4 }}>Ainda não foram identificados comentários claramente positivos nas conversas analisadas.</p>
                <a href="/painel/conversas" style={{ fontFamily: FONT.jb, fontSize: 11, color: C.blueB, marginTop: 10, display: 'inline-block' }}>Ver conversas analisadas →</a>
              </div>
            ) : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{r.elogios.map((e, i) => (
              <div key={i}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{e.contato && <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13, color: C.white }}>{e.contato}</span>}{e.conversation_id && <a href={`/painel/conversas/${e.conversation_id}`} style={{ ...T.mono, fontSize: 9, color: C.blueB }}>ver conversa →</a>}</div>
                <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, marginTop: 2 }}>{e.resumo}</p>
              </div>
            ))}</div>}
          </div>

          {/* Reclamações */}
          <div>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 12 }}>🚨 Reclamações <span style={{ color: C.faint, fontWeight: 400 }}>· {r.reclamacoes.length}</span></h2>
            {!r.reclamacoes.length ? <div style={{ ...CARD, ...T.sub, fontSize: 13 }}>Nenhuma reclamação detectada no período. 🎉</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {r.reclamacoes.map((rec, i) => {
                  const id = rec.conversation_id || `r${i}`
                  const st = statusMap[id] || 'nova'
                  const pm = prioMeta[rec.severidade] || prioMeta.media
                  const sm = statusMeta[st]
                  return (
                    <div key={id} style={{ ...CARD, borderColor: `color-mix(in oklch, ${pm.cor} 26%, var(--c-border))` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <p style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>{rec.titulo || rec.resumo?.slice(0, 50)}</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge cor={pm.cor}>Prioridade {pm.label}</Badge><Badge cor={sm.cor}>{sm.label}</Badge></div>
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
                        {rec.contato && <Det k="Contato" v={rec.contato} />}
                        <Det k="Canal" v="WhatsApp" />
                        {rec.tema && <Det k="Tema" v={rec.tema} />}
                        {rec.sentimento && <Det k="Sentimento" v={rec.sentimento} />}
                      </div>
                      <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, fontWeight: 300, lineHeight: 1.55, marginBottom: rec.acao ? 10 : 12 }}>{rec.resumo}</p>
                      {rec.acao && <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}><p style={{ ...T.mono, color: 'oklch(80% 0.12 215)', fontSize: 9, marginBottom: 3 }}>Ação recomendada</p><p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{rec.acao}</p></div>}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        {rec.conversation_id && <a href={`/painel/conversas/${rec.conversation_id}`} style={linkSt}>Ver conversa</a>}
                        {st !== 'resolvida' && <button onClick={() => setStatus(id, 'resolvida')} style={{ ...linkSt, color: 'var(--c-green)' }}>Marcar como resolvido</button>}
                        {st !== 'ignorada' && <button onClick={() => setStatus(id, 'ignorada')} style={linkSt}>Ignorar</button>}
                        <a href="/painel/conhecimento" style={{ ...linkSt, color: C.blueB }}>Criar melhoria</a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pontos de atenção */}
          {r.pontos_atencao.length > 0 && (
            <div>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 12 }}>⚠️ Pontos de atenção <span style={{ color: C.faint, fontWeight: 400 }}>· {r.pontos_atencao.length}</span></h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {r.pontos_atencao.map((p, i) => (
                  <div key={i} style={{ ...CARD, borderColor: 'rgba(245,158,11,0.25)' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>{p.tema && <Badge cor="var(--c-yellow)">{p.tema}</Badge>}{p.risco && <Badge cor="var(--c-muted)">{p.risco}</Badge>}</div>
                    <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, fontWeight: 300, lineHeight: 1.55 }}>{p.resumo}</p>
                    {p.acao && <p style={{ ...T.sub, fontSize: 12, marginTop: 6 }}>💡 {p.acao}</p>}
                    {p.conversation_id && <a href={`/painel/conversas/${p.conversation_id}`} style={{ ...linkSt, marginTop: 8, display: 'inline-block' }}>Ver conversa →</a>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={CARD}>
            <h2 style={sideTitle}>Resumo do período</h2>
            {[[`Período: ${periodoLabel}`, C.muted], [`Conversas analisadas: ${r.conversas}`, 'var(--c-blue-b)'], [`Nota estimada: ${r.satisfacao_media.toFixed(1)} / 5`, 'var(--c-green)'], [`Elogios: ${r.elogios.length}`, 'var(--c-green)'], [`Reclamações: ${r.reclamacoes.length}`, r.reclamacoes.length ? 'var(--c-red)' : 'var(--c-muted)'], [`Sentimento predominante: ${predominante}`, 'var(--c-blue-b)']].map(([t, c], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: c as string, flexShrink: 0 }} /><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span></div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Principais temas</h2>
            {!r.temas.length ? <p style={{ ...T.sub, fontSize: 13 }}>Sem temas destacados.</p> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {r.temas.map((t, i) => <span key={i} style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.white, background: 'rgba(80,130,210,0.1)', border: `1px solid ${C.border}`, borderRadius: 100, padding: '5px 12px' }}>{t.tema}{t.n ? ` · ${t.n}` : ''}</span>)}
              </div>
            )}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Recomendações da IA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recs.map((rec, i) => <div key={i} style={{ display: 'flex', gap: 9 }}><span style={{ color: 'oklch(80% 0.16 215)', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✦</span><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{rec}</span></div>)}
            </div>
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Ações rápidas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={analisar} disabled={loading} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Reavaliar atendimentos<span style={{ color: C.faint }}>↻</span></button>
              <button onClick={exportar} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Exportar avaliação<span style={{ color: C.faint }}>⬇</span></button>
              <a href="/painel/conversas" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Ver conversas negativas<span style={{ color: C.faint }}>→</span></a>
              <a href="/painel/conhecimento" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Criar melhoria<span style={{ color: C.faint }}>→</span></a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px){ .av-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 860px){ .av-cards{ grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}

function Det({ k, v }: { k: string; v: string }) {
  return <span style={{ display: 'inline-flex', gap: 5, alignItems: 'baseline' }}><span style={{ ...T.mono, fontSize: 8, color: C.faint }}>{k}:</span><span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.white }}>{v}</span></span>
}

const linkSt: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)', padding: 0 }
