'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const S = {
  mono:  { fontFamily: 'var(--font-jb)',    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
  h2:    { fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 16, color: 'var(--c-white)', marginBottom: 16 },
  label: { fontFamily: 'var(--font-jb)',    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--c-muted)' },
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ position: 'relative', width: 48, height: 26, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-block', opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={on} onChange={e => !disabled && onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 13, background: on ? 'oklch(55% 0.24 225)' : 'rgba(80,130,210,0.2)', transition: 'background .3s' }} />
      <div style={{ position: 'absolute', top: 4, left: on ? 26 : 4, width: 18, height: 18, borderRadius: '50%', background: '#eef2ff', transition: 'left .3s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
    </label>
  )
}

export default function PainelStatusPage() {
  const [agent, setAgent]   = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('agents').select('*').eq('client_id', user!.id).single()
      setAgent(data)
      setLoading(false)
    }
    load()
  }, [])

  async function toggleStatus(active: boolean) {
    if (!agent || saving) return
    setSaving(true)
    const newStatus = active ? 'active' : 'paused'
    await supabase.from('agents').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', agent.id)
    setAgent({ ...agent, status: newStatus })
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%' }}>
      <span style={{ fontFamily: 'var(--font-jb)', fontSize: 12, color: 'var(--c-muted)' }} className="animate-pulse-dot">Carregando…</span>
    </div>
  )

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const isActive = agent.status === 'active'

  const statusBg: Record<string, React.CSSProperties> = {
    active: { background: 'rgba(34,197,94,0.06)',  border: '1px solid rgba(34,197,94,0.2)' },
    paused: { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' },
    error:  { background: 'rgba(232,64,64,0.06)',  border: '1px solid rgba(232,64,64,0.2)' },
  }
  const statusDot: Record<string, string> = {
    active: 'var(--c-green)', paused: 'var(--c-yellow)', error: 'var(--c-red)',
  }
  const statusLabel: Record<string, string> = { active: 'ATIVO', paused: 'PAUSADO', error: 'ERRO' }
  const statusColor: Record<string, string>  = { active: 'var(--c-green)', paused: 'var(--c-yellow)', error: 'var(--c-red)' }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Status do agente
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Controle e monitore seu agente em tempo real.
        </p>
      </div>

      {/* Status principal */}
      <div className="card-hi" style={{ marginBottom: 16, ...statusBg[agent.status] }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusDot[agent.status], boxShadow: `0 0 12px ${statusDot[agent.status]}` }}
              className={isActive ? 'animate-pulse-dot' : ''} />
            <div>
              <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 20, color: 'var(--c-white)', letterSpacing: '-0.02em' }}>
                {agent.name}
              </p>
              <p style={{ ...S.mono, color: statusColor[agent.status], marginTop: 4 }}>{statusLabel[agent.status]}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--c-muted)' }}>
              {isActive ? 'Respondendo automaticamente' : 'Respostas automáticas pausadas'}
            </span>
            <Toggle on={isActive} onChange={toggleStatus} disabled={saving || agent.status === 'error'} />
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Canais */}
        <div className="card">
          <p style={S.h2}>Canais configurados</p>
          {(agent.config?.channels ?? ['WhatsApp']).map((ch: string) => (
            <div key={ch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--c-border)' }}>
              <span style={{ fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-white)' }}>{ch}</span>
              <span style={{ ...S.mono, fontSize: 9, color: 'var(--c-green)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 10px', borderRadius: 100 }}>
                ativo
              </span>
            </div>
          ))}
        </div>

        {/* Config info */}
        <div className="card">
          <p style={S.h2}>Configuração atual</p>
          {[
            ['Modelo',    agent.config?.model ?? 'claude-sonnet-4-5'],
            ['Tom',       agent.config?.tom    ?? 'Profissional'],
            ['Escalar após', `${agent.config?.escalarApos ?? 15} msgs`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--c-border)' }}>
              <span style={{ ...S.label }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-white)' }}>{v as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Aviso se erro */}
      {agent.status === 'error' && (
        <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '16px 20px' }}>
          <p style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 15, color: 'var(--c-red)', marginBottom: 6 }}>
            Agente com erro
          </p>
          <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'rgba(232,64,64,0.8)', fontWeight: 300 }}>
            Seu agente encontrou um erro e foi pausado automaticamente. Entre em contato com o suporte da Bonsync.
          </p>
        </div>
      )}
    </div>
  )
}
