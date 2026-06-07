'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

interface Evento { quando: string; texto: string; cor?: string }
interface Props {
  agentId: string
  nome: string
  status: string
  config: any
  waConnected: boolean | null
  ultimaAtividade: string
  ultimaMsg: string | null
  eventos: Evento[]
  knowledgeCount: number
  escaladas: number
}

const modeloLabel: Record<string, string> = { 'claude-opus-4-5': 'Máximo', 'claude-sonnet-4-5': 'Avançado', 'claude-haiku-3-5': 'Rápido' }
const tomLabel: Record<string, string> = { profissional: 'Profissional', amigavel: 'Amigável', formal: 'Formal', tecnico: 'Técnico' }
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled} aria-label="toggle" style={{ position: 'relative', width: 48, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: on ? 'oklch(55% 0.24 225)' : 'rgba(80,130,210,0.2)', opacity: disabled ? 0.5 : 1, transition: 'background .3s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 4, left: on ? 26 : 4, width: 18, height: 18, borderRadius: '50%', background: '#eef2ff', transition: 'left .3s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
    </button>
  )
}

export function StatusCentral(p: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatusLocal] = useState(p.status)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const ativo = status === 'active'
  const stCor = status === 'active' ? 'var(--c-green)' : status === 'error' ? 'var(--c-red)' : 'var(--c-yellow)'
  const stLabel = status === 'active' ? 'Ativo' : status === 'error' ? 'Offline' : 'Pausado'

  async function toggleAtivo() {
    if (busy || status === 'error') return
    setBusy('toggle')
    const novo = ativo ? 'paused' : 'active'
    const { error } = await supabase.from('agents').update({ status: novo, updated_at: new Date().toISOString() }).eq('id', p.agentId)
    setBusy('')
    if (error) { alert(error.message); return }
    setStatusLocal(novo); router.refresh()
  }
  async function reiniciar() {
    setBusy('restart'); setMsg('')
    const res = await fetch('/api/painel/reiniciar-conexao', { method: 'POST' })
    const data = await res.json(); setBusy('')
    setMsg(res.ok ? '✓ Conexão reiniciada. Pode levar alguns segundos.' : (data.error || 'Falha ao reiniciar.'))
    setTimeout(() => setMsg(''), 5000)
  }

  const cards = [
    { label: 'Status geral', value: stLabel, cor: stCor, desc: ativo ? 'O agente está disponível para atendimento.' : status === 'error' ? 'O agente encontrou um erro.' : 'O agente está pausado.' },
    { label: 'Resposta automática', value: ativo ? 'Ligada' : 'Desligada', cor: ativo ? 'var(--c-green)' : 'var(--c-yellow)', desc: ativo ? 'O agente responde clientes automaticamente.' : 'As respostas automáticas estão pausadas.' },
    { label: 'Canal conectado', value: p.waConnected === false ? 'Offline' : 'WhatsApp', cor: p.waConnected === false ? 'var(--c-red)' : 'var(--c-green)', desc: p.waConnected === false ? 'WhatsApp desconectado.' : 'Canal principal conectado e ativo.' },
    { label: 'Última atividade', value: fmt(p.ultimaAtividade).slice(0, 11), cor: 'var(--c-muted)', desc: 'Última interação registrada.', small: true },
  ]

  const saude = [
    { k: 'Agente online', ok: ativo, warn: !ativo && status !== 'error' },
    { k: 'WhatsApp conectado', ok: p.waConnected === true, warn: p.waConnected === null, err: p.waConnected === false },
    { k: 'Resposta automática ativa', ok: ativo, warn: !ativo },
    { k: 'Base de conhecimento carregada', ok: p.knowledgeCount > 0, warn: p.knowledgeCount === 0 },
    { k: 'Sem falhas recentes', ok: status !== 'error', err: status === 'error' },
  ]

  const alertas: { txt: string; cor: string }[] = []
  if (status === 'error') alertas.push({ txt: 'Falha ao responder — agente com erro', cor: 'var(--c-red)' })
  if (status === 'paused') alertas.push({ txt: 'Agente pausado — não está respondendo', cor: 'var(--c-yellow)' })
  if (p.waConnected === false) alertas.push({ txt: 'WhatsApp desconectado', cor: 'var(--c-red)' })
  if (p.escaladas >= 3) alertas.push({ txt: `${p.escaladas} conversas encaminhadas para humano`, cor: 'var(--c-yellow)' })

  const cfg = p.config || {}
  const configAtual: [string, string][] = [
    ['Modelo de IA', modeloLabel[cfg.model] || 'Avançado'],
    ['Tom de voz', tomLabel[cfg.tom] || '—'],
    ['Atendimento humano', cfg.escalation_mode === 'auto' ? 'Automático' : 'Sob demanda'],
    ['Classificação de leads', 'Ativa'],
    ['Limite para revisão humana', `${cfg.escalate_after_messages || cfg.escalarApos || 15} mensagens`],
  ]

  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties
  const rowLabel = { ...T.mono, fontSize: 9, color: C.faint } as React.CSSProperties

  return (
    <div>
      {/* Cards de resumo */}
      <div className="st-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: c.small ? 16 : 24, color: c.cor, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{c.value}</p>
            <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="st-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.9fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        {/* ESQUERDA */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card principal */}
          <div className="card-hi" style={{ ...(status === 'error' ? { borderColor: 'rgba(232,64,64,0.3)' } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: stCor, boxShadow: `0 0 12px ${stCor}` }} className={ativo ? 'animate-pulse-dot' : ''} />
                <div>
                  <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 20, color: C.white }}>{p.nome}</p>
                  <p style={{ ...T.mono, color: stCor, marginTop: 3 }}>{stLabel}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {status !== 'error' && <button onClick={toggleAtivo} disabled={!!busy} className="btn-ghost" style={{ fontSize: 12, padding: '9px 16px', color: ativo ? 'var(--c-yellow)' : 'var(--c-green)' }}>{busy === 'toggle' ? '…' : ativo ? 'Pausar agente' : 'Reativar agente'}</button>}
                <a href="/painel/assistente" className="btn-ghost" style={{ fontSize: 12, padding: '9px 16px' }}>Testar agente</a>
                <a href="/painel/conversas" className="btn-primary" style={{ fontSize: 12, padding: '9px 16px' }}>Ver conversas</a>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 16 }}>
              {[['Canal principal', 'WhatsApp'], ['Modo atual', ativo ? 'Respondendo automaticamente' : 'Pausado'], ['Última atividade', fmt(p.ultimaAtividade)], ['Saúde do agente', status === 'error' ? 'Erro' : ativo ? 'Normal' : 'Pausado']].map(([k, v]) => (
                <div key={k}><p style={rowLabel}>{k}</p><p style={{ fontFamily: FONT.dm, fontSize: 14, color: k === 'Saúde do agente' ? stCor : C.white, marginTop: 3 }}>{v}</p></div>
              ))}
            </div>
            {/* Toggle resposta automática */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: C.void, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div>
                <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, fontWeight: 500 }}>Resposta automática</p>
                <p style={{ ...T.sub, fontSize: 12, marginTop: 2 }}>Quando ativada, o agente responde clientes sem intervenção humana.</p>
              </div>
              <Toggle on={ativo} onChange={toggleAtivo} disabled={!!busy || status === 'error'} />
            </div>
          </div>

          {/* Canais conectados */}
          <div style={CARD}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 12 }}>Canais conectados</h2>
            <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, fontWeight: 500 }}>WhatsApp</span>
                <span style={{ ...T.mono, fontSize: 9, color: p.waConnected === false ? 'var(--c-red)' : ativo ? 'var(--c-green)' : 'var(--c-yellow)' }}>{p.waConnected === false ? 'Offline' : ativo ? 'Online' : 'Pausado'}</span>
              </div>
              {[['Resposta automática', ativo ? 'Ativa' : 'Pausada'], ['Última mensagem recebida', fmt(p.ultimaMsg)], ['Falhas recentes', status === 'error' ? '1' : '0']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}><span style={{ ...T.sub, fontSize: 11.5 }}>{k}</span><span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted }}>{v}</span></div>
              ))}
              <a href="/painel/configuracoes" className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', width: '100%', textAlign: 'center', marginTop: 12, display: 'block' }}>Gerenciar canal</a>
            </div>
            {['Instagram', 'Site'].map(ch => (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', opacity: 0.6 }}>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{ch}</span>
                <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>Não conectado</span>
              </div>
            ))}
          </div>

          {/* Saúde do agente */}
          <div style={CARD}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 12 }}>Saúde do agente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {saude.map((s, i) => {
                const cor = s.err ? 'var(--c-red)' : s.ok ? 'var(--c-green)' : 'var(--c-yellow)'
                const icon = s.err ? '✕' : s.ok ? '✓' : '!'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: cor, background: `color-mix(in oklch, ${cor} 14%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 30%, transparent)` }}>{icon}</span>
                    <span style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 300 }}>{s.k}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ ...T.mono, fontSize: 8.5, color: cor }}>{s.err ? 'ERRO' : s.ok ? 'OK' : 'ATENÇÃO'}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Atividade recente */}
          <div style={CARD}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 12 }}>Atividade recente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {p.eventos.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: i < p.eventos.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ ...T.mono, fontSize: 9, color: C.faint, flexShrink: 0, width: 96 }}>{e.quando}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13, color: e.cor || C.muted, fontWeight: 300 }}>{e.texto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Controles rápidos */}
          <div style={CARD}>
            <h2 style={sideTitle}>Controles rápidos</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ControleRow titulo={ativo ? 'Pausar resposta automática' : 'Ativar resposta automática'} desc="Liga ou desliga as respostas automáticas." onClick={toggleAtivo} disabled={!!busy || status === 'error'} />
              <ControleRow titulo="Testar agente" desc="Simule uma conversa antes de atender clientes reais." href="/painel/assistente" />
              <ControleRow titulo="Ver conversas em aberto" desc="Acompanhe atendimentos em andamento." href="/painel/conversas" />
              <ControleRow titulo="Reiniciar conexão" desc="Reconecta o WhatsApp em caso de instabilidade." onClick={reiniciar} disabled={busy === 'restart'} loading={busy === 'restart'} />
              <ControleRow titulo="Abrir configurações" desc="Ajuste tom, saudação e comportamento." href="/painel/configuracoes" />
            </div>
            {msg && <p style={{ fontFamily: FONT.dm, fontSize: 12, color: msg.startsWith('✓') ? C.green : C.red, marginTop: 10 }}>{msg}</p>}
          </div>

          {/* Configuração atual */}
          <div style={CARD}>
            <h2 style={sideTitle}>Configuração atual</h2>
            {configAtual.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: i < configAtual.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={rowLabel}>{k}</span>
                <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.white, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            <a href="/painel/configuracoes" className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', width: '100%', textAlign: 'center', marginTop: 12, display: 'block' }}>Ver configurações avançadas</a>
          </div>

          {/* Alertas */}
          <div style={CARD}>
            <h2 style={sideTitle}>Alertas</h2>
            {alertas.length === 0 ? (
              <div><p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>Nenhum alerta no momento.</p><p style={{ ...T.sub, fontSize: 12.5, marginTop: 4 }}>O agente está funcionando normalmente.</p></div>
            ) : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{alertas.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: a.cor, flexShrink: 0 }} /><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{a.txt}</span></div>
            ))}</div>}
          </div>

          {/* Próximas ações */}
          <div style={CARD}>
            <h2 style={sideTitle}>Próximas ações</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['Testar agente no WhatsApp', '/painel/assistente'], ['Revisar conversas com humano', '/painel/conversas'], ['Atualizar base de conhecimento', '/painel/conhecimento'], ['Ver relatório de desempenho', '/painel/metricas']].map(([t, h]) => (
                <a key={t} href={h} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>{t}<span style={{ color: C.faint }}>→</span></a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px){ .st-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 680px){ .st-cards{ grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}

function ControleRow({ titulo, desc, href, onClick, disabled, loading }: { titulo: string; desc: string; href?: string; onClick?: () => void; disabled?: boolean; loading?: boolean }) {
  const inner = (
    <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'border-color .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 500 }}>{loading ? 'Aguarde…' : titulo}</span>
        <span style={{ color: C.faint }}>→</span>
      </div>
      <p style={{ ...T.sub, fontSize: 11.5, marginTop: 3 }}>{desc}</p>
    </div>
  )
  if (href) return <a href={href} style={{ textDecoration: 'none' }}>{inner}</a>
  return <div onClick={() => !disabled && onClick?.()}>{inner}</div>
}
