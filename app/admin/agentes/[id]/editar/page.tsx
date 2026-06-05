'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { C, T, CARD, CARD_HI, FONT } from '@/lib/styles'

const MODELOS = [
  { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5   — Máxima inteligência' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 — Equilíbrio ideal (recomendado)' },
  { value: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5  — Máxima velocidade e custo' },
]

export default function EditarAgentePage() {
  const params   = useParams()
  const id       = params.id as string
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)
  const [hasKey, setHasKey]   = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', status: 'paused',
    model: 'claude-sonnet-4-5', anthropic_key: '',
    prompt: '', tom: 'profissional', saudacao: '',
    escalation_mode: 'on_demand', escalate_after_messages: 0,
    whatsapp_instance: '',
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('agents').select('*').eq('id', id).single()
      if (data) {
        const cfg = data.config || {}
        setHasKey(!!cfg.anthropic_key)
        setForm({
          name: data.name ?? '',
          description: data.description ?? '',
          status: data.status ?? 'paused',
          model: cfg.model ?? 'claude-sonnet-4-5',
          anthropic_key: '', // não exibimos a chave; só sobrescreve se digitar
          prompt: cfg.prompt ?? '',
          tom: cfg.tom ?? 'profissional',
          saudacao: cfg.saudacao ?? '',
          escalation_mode: cfg.escalation_mode ?? 'on_demand',
          escalate_after_messages: cfg.escalate_after_messages ?? 0,
          whatsapp_instance: cfg.whatsapp_instance ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')

    // Busca config atual para preservar campos não editados (ex: channels)
    const { data: current } = await supabase.from('agents').select('config').eq('id', id).single()
    const baseConfig = current?.config || {}

    const newConfig: Record<string, unknown> = {
      ...baseConfig,
      model: form.model,
      prompt: form.prompt,
      tom: form.tom,
      saudacao: form.saudacao,
      escalation_mode: form.escalation_mode,
      escalate_after_messages: form.escalate_after_messages,
      whatsapp_instance: form.whatsapp_instance,
    }
    // Só sobrescreve a chave se o admin digitou uma nova
    if (form.anthropic_key.trim()) newConfig.anthropic_key = form.anthropic_key.trim()

    const { error: err } = await supabase.from('agents').update({
      name: form.name,
      description: form.description,
      status: form.status,
      config: newConfig,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true); setSaving(false)
    setTimeout(() => { router.push(`/admin/agentes/${id}`); router.refresh() }, 1000)
  }

  const sectionTitle = {
    fontFamily: FONT.space, fontWeight: 600, fontSize: 15,
    color: C.white, marginBottom: 20, paddingBottom: 12,
    borderBottom: `1px solid ${C.border}`,
  } as React.CSSProperties

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }} className="animate-pulse-dot">Carregando…</div>
  )

  return (
    <div className="animate-slide-up" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <a href={`/admin/agentes/${id}`} style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>← Voltar</a>
        <h1 style={T.h1}>Editar agente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Ajuste a configuração. As mudanças valem na próxima mensagem.</p>
      </div>

      {saved && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: C.green, fontFamily: FONT.dm, fontSize: 14 }}>
          Salvo! Redirecionando…
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Identidade */}
        <div style={{ ...CARD, marginBottom: 16 }}>
          <h2 style={sectionTitle}>Identidade</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Nome do agente</label>
              <input className="field" type="text" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={T.label}>Descrição</label>
              <input className="field" type="text" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label style={T.label}>Status</label>
              <select className="field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="error">Erro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Anthropic */}
        <div style={{ ...CARD_HI, marginBottom: 16 }}>
          <h2 style={sectionTitle}>Configuração Anthropic</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Anthropic API Key</label>
              <input className="field" type="password"
                placeholder={hasKey ? '•••••••• (já configurada — deixe vazio para manter)' : 'sk-ant-api03-…'}
                value={form.anthropic_key} onChange={e => setForm({ ...form, anthropic_key: e.target.value })} />
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                Só preencha se quiser trocar a chave atual.
              </p>
            </div>
            <div>
              <label style={T.label}>Modelo</label>
              <select className="field" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                {MODELOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={T.label}>Prompt do sistema</label>
              <textarea className="field" rows={6} value={form.prompt}
                onChange={e => setForm({ ...form, prompt: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Comportamento */}
        <div style={{ ...CARD, marginBottom: 16 }}>
          <h2 style={sectionTitle}>Comportamento</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Tom de voz</label>
              <select className="field" value={form.tom} onChange={e => setForm({ ...form, tom: e.target.value })}>
                <option value="profissional">Profissional</option>
                <option value="amigavel">Amigável e descontraído</option>
                <option value="formal">Formal</option>
                <option value="tecnico">Técnico</option>
              </select>
            </div>
            <div>
              <label style={T.label}>Mensagem de saudação</label>
              <input className="field" type="text" value={form.saudacao}
                onChange={e => setForm({ ...form, saudacao: e.target.value })} />
            </div>
            <div>
              <label style={T.label}>Modo de escalonamento</label>
              <select className="field" value={form.escalation_mode} onChange={e => setForm({ ...form, escalation_mode: e.target.value })}>
                <option value="on_demand">Sob demanda — só quando o cliente pedir</option>
                <option value="auto">Automático — o agente decide</option>
              </select>
            </div>
            {form.escalation_mode === 'auto' && (
              <div>
                <label style={T.label}>Escalar após (nº de mensagens, 0 = desligado)</label>
                <input className="field" type="number" min={0} max={100} value={form.escalate_after_messages}
                  onChange={e => setForm({ ...form, escalate_after_messages: Number(e.target.value) })}
                  style={{ width: 120 }} />
              </div>
            )}
            <div>
              <label style={T.label}>Instância WhatsApp (Evolution API)</label>
              <input className="field" type="text" value={form.whatsapp_instance}
                onChange={e => setForm({ ...form, whatsapp_instance: e.target.value })} />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}
