'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

export default function PainelConfigPage() {
  const [agent, setAgent]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [cfg, setCfg] = useState({
    prompt: '', tom: 'profissional', saudacao: '',
    escalation_mode: 'on_demand', escalate_after_messages: 0,
    digest_frequency: 'off', digest_channel: 'email',
  })
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('agents').select('*').eq('client_id', user!.id).single()
      if (data) {
        setAgent(data)
        setCfg({
          prompt:                  data.config?.prompt                  ?? '',
          tom:                     data.config?.tom                     ?? 'profissional',
          saudacao:                data.config?.saudacao                ?? '',
          escalation_mode:         data.config?.escalation_mode         ?? 'on_demand',
          escalate_after_messages: data.config?.escalate_after_messages ?? 0,
          digest_frequency:        data.config?.digest_frequency        ?? 'off',
          digest_channel:          data.config?.digest_channel          ?? 'email',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('agents').update({
      config: { ...agent.config, ...cfg },
      updated_at: new Date().toISOString(),
    }).eq('id', agent.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%' }}>
      <span style={{ fontFamily: FONT.jb, fontSize: 12, color: C.muted }} className="animate-pulse-dot">
        Carregando…
      </span>
    </div>
  )

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const sectionStyle = { ...CARD, marginBottom: 16 }
  const sectionTitle = { ...T.h2, paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Configurações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Personalize o comportamento do seu agente.</p>
      </div>

      <form onSubmit={handleSave}>
        {/* Identidade */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Identidade</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Tom de voz</label>
              <select className="field" value={cfg.tom} onChange={e => setCfg({ ...cfg, tom: e.target.value })}>
                <option value="profissional">Profissional</option>
                <option value="amigavel">Amigável e descontraído</option>
                <option value="formal">Formal</option>
                <option value="tecnico">Técnico</option>
              </select>
            </div>
            <div>
              <label style={T.label}>Mensagem de saudação</label>
              <input className="field" type="text" value={cfg.saudacao}
                onChange={e => setCfg({ ...cfg, saudacao: e.target.value })}
                placeholder="Olá! Como posso te ajudar hoje?" />
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Prompt de instrução</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14, marginTop: -8 }}>
            Define como o agente se comporta em todas as conversas.
          </p>
          <textarea className="field" rows={6}
            value={cfg.prompt} onChange={e => setCfg({ ...cfg, prompt: e.target.value })}
            placeholder="Você é um assistente virtual da empresa. Seu objetivo é…" />
        </div>

        {/* Escalonamento */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Atendimento humano</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Quando passar para um atendente humano?</label>
              <select className="field" value={cfg.escalation_mode}
                onChange={e => setCfg({ ...cfg, escalation_mode: e.target.value })}>
                <option value="on_demand">Sob demanda — só quando o cliente pedir (recomendado)</option>
                <option value="auto">Automático — o agente decide quando é necessário</option>
              </select>
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                {cfg.escalation_mode === 'on_demand'
                  ? 'O agente só chama um humano se a pessoa pedir explicitamente ("quero falar com um atendente").'
                  : 'O agente passa para um humano quando julgar necessário (negociação, reclamação grave, etc.).'}
              </p>
            </div>
            {cfg.escalation_mode === 'auto' && (
              <div>
                <label style={T.label}>Escalar automaticamente após (nº de mensagens)</label>
                <input className="field" type="number" min={0} max={100} value={cfg.escalate_after_messages}
                  onChange={e => setCfg({ ...cfg, escalate_after_messages: Number(e.target.value) })}
                  style={{ width: 120 }} />
                <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                  Limite de segurança. Use <b style={{ color: C.muted }}>0</b> para desligar. Se a conversa passar desse número de mensagens, o agente escala automaticamente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Resumo automático */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Resumo automático</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Receber resumo do agente</label>
              <select className="field" value={cfg.digest_frequency}
                onChange={e => setCfg({ ...cfg, digest_frequency: e.target.value })}>
                <option value="off">Desligado</option>
                <option value="daily">Diário (todo dia de manhã)</option>
                <option value="weekly">Semanal (toda segunda-feira)</option>
              </select>
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                Um resumo com atendimentos e negócios fechados, enviado automaticamente.
              </p>
            </div>
            {cfg.digest_frequency !== 'off' && (
              <div>
                <label style={T.label}>Enviar por</label>
                <select className="field" value={cfg.digest_channel}
                  onChange={e => setCfg({ ...cfg, digest_channel: e.target.value })}>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">E-mail + WhatsApp</option>
                </select>
                <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                  E-mail vai para o seu login. WhatsApp vai para o número de escalonamento configurado.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Segurança */}
        <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ ...T.mono, color: C.muted, marginBottom: 10 }}>Segurança — sempre ativo</p>
          {['Validação de conteúdo em todas as mensagens', 'Log completo de interações', 'Conformidade LGPD'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span style={{ ...T.sub, fontSize: 13 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Salvar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FONT.jb, fontSize: 12, color: C.green }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Salvo!
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
