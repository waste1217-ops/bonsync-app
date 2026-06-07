'use client'

import { useEffect, useMemo, useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

export interface Notif {
  id: string
  tipo: 'conversa' | 'lead' | 'venda' | 'agente' | 'sistema' | 'conhecimento'
  prioridade: 'alta' | 'media' | 'baixa' | 'info'
  title: string
  descricao: string
  contato?: string | null
  canal?: string | null
  motivo?: string | null
  ts: string
  href: string
}

const prio = {
  alta:  { label: 'Alta prioridade',  cor: 'var(--c-red)' },
  media: { label: 'Média prioridade', cor: 'var(--c-yellow)' },
  baixa: { label: 'Baixa prioridade', cor: 'var(--c-muted)' },
  info:  { label: 'Informativo',      cor: 'var(--c-blue-b)' },
}
const tipoLabel: Record<string, string> = { conversa: 'Conversa', lead: 'Lead', venda: 'Venda', agente: 'Agente', sistema: 'Sistema', conhecimento: 'Conhecimento' }
const READ_KEY = 'bonsync-notif-read-v2'

function tempo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60); if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24); return `há ${d} dia${d > 1 ? 's' : ''}`
}

export function NotificationsPanel({ notifs }: { notifs: Notif[] }) {
  const [readMap, setReadMap] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [q, setQ] = useState('')

  useEffect(() => {
    try { setReadMap(JSON.parse(localStorage.getItem(READ_KEY) || '{}')) } catch {}
    setReady(true)
  }, [])

  function persist(map: Record<string, number>) { setReadMap(map); localStorage.setItem(READ_KEY, JSON.stringify(map)) }
  function marcarLida(id: string) { persist({ ...readMap, [id]: Date.now() }) }
  function marcarTodas() { const m = { ...readMap }; const now = Date.now(); notifs.forEach(n => { if (!m[n.id]) m[n.id] = now }); persist(m) }

  const isRead = (id: string) => ready && id in readMap
  const naoLidas = ready ? notifs.filter(n => !(n.id in readMap)).length : notifs.length
  const exigemAcao = notifs.filter(n => n.prioridade === 'alta' || n.prioridade === 'media').length
  const criticas = notifs.filter(n => n.prioridade === 'alta').length
  const todayStart = new Date(new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' })).getTime()
  const resolvidasHoje = ready ? Object.values(readMap).filter(ts => ts >= todayStart).length : 0
  const ultima = notifs[0] ? tempo(notifs[0].ts) : '—'

  const tipos = ['conversa', 'lead', 'venda', 'agente', 'sistema'] as const
  const contagemTipo: Record<string, number> = {}
  tipos.forEach(t => { contagemTipo[t] = notifs.filter(n => n.tipo === t).length })

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase()
    return notifs.filter(n => {
      if (filtro === 'naolidas' && n.id in readMap) return false
      if (['conversa', 'lead', 'venda', 'agente', 'sistema'].includes(filtro) && n.tipo !== filtro) return false
      if (termo && !`${n.title} ${n.descricao} ${n.contato ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [notifs, filtro, q, readMap])

  const resumoCards = [
    { label: 'Não lidas', value: naoLidas, cor: 'var(--c-blue-b)', desc: 'Alertas que ainda não foram visualizados.' },
    { label: 'Exigem ação', value: exigemAcao, cor: 'var(--c-yellow)', desc: 'Notificações que precisam de resposta ou revisão.' },
    { label: 'Críticas', value: criticas, cor: criticas > 0 ? 'var(--c-red)' : 'var(--c-white)', desc: 'Problemas urgentes no atendimento ou agente.' },
    { label: 'Resolvidas hoje', value: resolvidasHoje, cor: 'var(--c-green)', desc: 'Alertas finalizados nas últimas 24h.' },
  ]

  const filtros = [
    { v: 'todas', l: 'Todas' }, { v: 'naolidas', l: 'Não lidas' }, { v: 'conversa', l: 'Conversas' },
    { v: 'lead', l: 'Leads' }, { v: 'venda', l: 'Vendas' }, { v: 'agente', l: 'Agente' }, { v: 'sistema', l: 'Sistema' },
  ]

  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties

  // Estado totalmente vazio
  if (!notifs.length) {
    return (
      <div style={{ ...CARD, textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ fontSize: 30, marginBottom: 12 }}>🔔</p>
        <p style={{ fontFamily: FONT.dm, fontSize: 16, color: C.white }}>Tudo certo por aqui.</p>
        <p style={{ ...T.sub, marginTop: 6 }}>Nenhuma notificação importante no momento. Seu agente está funcionando normalmente.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }} className="nt-summary">
        {resumoCards.map(c => (
          <div key={c.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 30, color: c.cor, letterSpacing: '-0.03em', lineHeight: 1 }}>{c.value}</p>
            <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="nt-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.1fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

        {/* ESQUERDA: filtros + lista */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar notificação…" style={{ flex: 1, minWidth: 180 }} />
            <button onClick={marcarTodas} className="btn-ghost" style={{ fontSize: 11, padding: '9px 14px' }}>Marcar todas como lidas</button>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
            {filtros.map(f => (
              <button key={f.v} onClick={() => setFiltro(f.v)} className={filtro === f.v ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 11, padding: '7px 13px' }}>{f.l}</button>
            ))}
          </div>

          {!filtradas.length ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhuma notificação com esse filtro.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtradas.map(n => {
                const lida = isRead(n.id)
                const p = prio[n.prioridade]
                return (
                  <div key={n.id} style={{ ...CARD, padding: '16px 18px', opacity: lida ? 0.72 : 1, borderColor: lida ? C.border : `color-mix(in oklch, ${p.cor} 30%, transparent)` }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.cor, flexShrink: 0, marginTop: 6 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                          <p style={{ fontFamily: FONT.dm, fontWeight: lida ? 500 : 600, fontSize: 14.5, color: C.white }}>{n.title}</p>
                          <span style={{ ...T.mono, fontSize: 9, color: C.faint, flexShrink: 0 }}>{tempo(n.ts)}</span>
                        </div>
                        <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, marginTop: 3, lineHeight: 1.5 }}>{n.descricao}</p>

                        {(n.contato || n.canal || n.motivo) && (
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                            {n.contato && <Detalhe k="Contato" v={n.contato} />}
                            {n.canal && <Detalhe k="Canal" v={n.canal} />}
                            {n.motivo && <Detalhe k="Motivo" v={n.motivo} />}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                          <span style={{ ...T.mono, fontSize: 8, color: p.cor, padding: '3px 9px', borderRadius: 100, background: `color-mix(in oklch, ${p.cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${p.cor} 28%, transparent)` }}>{p.label}</span>
                          <span style={{ ...T.mono, fontSize: 8, color: C.muted }}>Tipo: {tipoLabel[n.tipo]}</span>
                          {!lida && <span style={{ ...T.mono, fontSize: 8, color: C.blueB }}>● Não lida</span>}
                          <div style={{ flex: 1 }} />
                          <a href={n.href} style={{ fontFamily: FONT.jb, fontSize: 11, color: C.blueB }}>
                            {n.tipo === 'conversa' ? 'Ver conversa' : n.tipo === 'venda' ? 'Ver negócio' : n.tipo === 'lead' ? 'Ver lead' : 'Abrir'} →
                          </a>
                          {!lida && <button onClick={() => marcarLida(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>Marcar como lida</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={CARD}>
            <h2 style={sideTitle}>Resumo</h2>
            {[
              [`${naoLidas} notificações não lidas`, 'var(--c-blue-b)'],
              [`${exigemAcao} precisam de ação`, 'var(--c-yellow)'],
              [`${criticas} críticas`, criticas > 0 ? 'var(--c-red)' : 'var(--c-muted)'],
              [`Última notificação: ${ultima}`, 'var(--c-muted)'],
            ].map(([t, c], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c as string, flexShrink: 0 }} />
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Tipos de alerta</h2>
            {tipos.map((t, i) => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < tipos.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{tipoLabel[t]}</span>
                <span style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: contagemTipo[t] > 0 ? C.white : C.faint }}>{contagemTipo[t]}</span>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Ações rápidas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={marcarTodas} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Marcar todas como lidas<span style={{ color: C.faint }}>✓</span></button>
              {[['Ver conversas em aberto', '/painel/conversas'], ['Configurar notificações', '/painel/configuracoes'], ['Ver histórico', '/painel/conversas']].map(([t, h]) => (
                <a key={t} href={h} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>{t}<span style={{ color: C.faint }}>→</span></a>
              ))}
            </div>
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Configurações de aviso</h2>
            <p style={{ ...T.sub, fontSize: 12.5, lineHeight: 1.5 }}>
              Receba um resumo automático por e-mail ou WhatsApp com os principais alertas.
            </p>
            <a href="/painel/configuracoes" className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', width: '100%', textAlign: 'center', marginTop: 12, display: 'block' }}>Configurar avisos</a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) { .nt-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .nt-summary { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </div>
  )
}

function Detalhe({ k, v }: { k: string; v: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'baseline' }}>
      <span style={{ ...T.mono, fontSize: 8, color: C.faint }}>{k}:</span>
      <span style={{ fontFamily: FONT.dm, fontSize: 12, color: C.white }}>{v}</span>
    </span>
  )
}
