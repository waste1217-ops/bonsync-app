'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

export default function PainelConfigPage() {
  const [agent, setAgent]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [empresa, setEmpresa] = useState('')
  const [cfg, setCfg] = useState({
    prompt: '', tom: 'profissional', saudacao: '',
    escalation_mode: 'on_demand', escalate_after_messages: 0,
    digest_frequency: 'off', digest_channel: 'email',
    away_message: '',
    bh_enabled: false, bh_start: '08:00', bh_end: '18:00', bh_weekdays: true,
  })
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data }, { data: prof }] = await Promise.all([
        supabase.from('agents').select('*').eq('client_id', user!.id).single(),
        supabase.from('profiles').select('company_name').eq('id', user!.id).single(),
      ])
      if (prof) setEmpresa(prof.company_name ?? '')
      if (data) {
        setAgent(data)
        const bh = data.config?.business_hours ?? {}
        setCfg({
          prompt:                  data.config?.prompt                  ?? '',
          tom:                     data.config?.tom                     ?? 'profissional',
          saudacao:                data.config?.saudacao                ?? '',
          escalation_mode:         data.config?.escalation_mode         ?? 'on_demand',
          escalate_after_messages: data.config?.escalate_after_messages ?? 0,
          digest_frequency:        data.config?.digest_frequency        ?? 'off',
          digest_channel:          data.config?.digest_channel          ?? 'email',
          away_message:            data.config?.away_message            ?? '',
          bh_enabled:              bh.enabled  ?? false,
          bh_start:                bh.start    ?? '08:00',
          bh_end:                  bh.end      ?? '18:00',
          bh_weekdays:             bh.weekdays ?? true,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { bh_enabled, bh_start, bh_end, bh_weekdays, ...rest } = cfg
    const novoConfig = {
      ...agent.config,
      ...rest,
      business_hours: { enabled: bh_enabled, start: bh_start, end: bh_end, weekdays: bh_weekdays },
    }
    const { data: { user } } = await supabase.auth.getUser()
    await Promise.all([
      supabase.from('agents').update({ config: novoConfig, updated_at: new Date().toISOString() }).eq('id', agent.id),
      supabase.from('profiles').update({ company_name: empresa.trim() }).eq('id', user!.id),
    ])
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
        {/* Dados da empresa */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Dados da empresa</h2>
          <div>
            <label style={T.label}>Nome da empresa</label>
            <input className="field" type="text" value={empresa}
              onChange={e => setEmpresa(e.target.value)} placeholder="Ex: Loja do João" />
            <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
              Aparece no seu painel e nos relatórios. Para trocar e-mail/senha, fale com a Bonsync.
            </p>
          </div>
        </div>

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

        {/* Disponibilidade */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Horário de funcionamento</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={cfg.bh_enabled} onChange={e => setCfg({ ...cfg, bh_enabled: e.target.checked })} />
              <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>Responder só dentro do horário comercial</span>
            </label>
            {cfg.bh_enabled && (
              <>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <label style={T.label}>Abre às</label>
                    <input className="field" type="time" value={cfg.bh_start} onChange={e => setCfg({ ...cfg, bh_start: e.target.value })} style={{ width: 140 }} />
                  </div>
                  <div>
                    <label style={T.label}>Fecha às</label>
                    <input className="field" type="time" value={cfg.bh_end} onChange={e => setCfg({ ...cfg, bh_end: e.target.value })} style={{ width: 140 }} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={cfg.bh_weekdays} onChange={e => setCfg({ ...cfg, bh_weekdays: e.target.checked })} />
                  <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>Somente em dias úteis (seg a sex)</span>
                </label>
                <div>
                  <label style={T.label}>Mensagem de ausência</label>
                  <textarea className="field" rows={2} value={cfg.away_message}
                    onChange={e => setCfg({ ...cfg, away_message: e.target.value })}
                    placeholder="Olá! No momento estamos fora do horário de atendimento (seg a sex, 8h–18h). Retornaremos assim que possível. 🙏" />
                  <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                    Enviada automaticamente quando alguém escreve fora do horário. Horário de Brasília.
                  </p>
                </div>
              </>
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
