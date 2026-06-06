'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { C, T, CARD, CARD_HI, FONT } from '@/lib/styles'

const MODELOS = [
  { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5   — Máxima inteligência' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 — Equilíbrio ideal (recomendado)' },
  { value: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5  — Máxima velocidade e custo' },
]

export default function NovoTemplatePage() {
  const router   = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', category: '',
    model: 'claude-sonnet-4-5',
    prompt: '', tom: 'profissional',
    saudacao: 'Olá! Como posso te ajudar hoje?',
    escalation_mode: 'on_demand', escalate_after_messages: 0,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Dê um nome ao template.')
    setSaving(true); setError('')

    const { error: err } = await supabase.from('agent_templates').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      config: {
        model: form.model,
        prompt: form.prompt,
        tom: form.tom,
        saudacao: form.saudacao,
        escalation_mode: form.escalation_mode,
        escalate_after_messages: form.escalate_after_messages,
        channels: ['WhatsApp'],
      },
    })

    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => { router.push('/admin/templates'); router.refresh() }, 1000)
  }

  const sectionTitle = {
    fontFamily: FONT.space, fontWeight: 600, fontSize: 15,
    color: C.white, marginBottom: 20, paddingBottom: 12,
    borderBottom: `1px solid ${C.border}`,
  } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/templates" style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>← Voltar</a>
        <h1 style={T.h1}>Novo template</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Um modelo reutilizável. Não inclui chave de API nem instância — isso é definido na criação do agente.</p>
      </div>

      {success && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: C.green, fontFamily: FONT.dm, fontSize: 14 }}>
          Template criado! Redirecionando…
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Identidade */}
        <div style={{ ...CARD, marginBottom: 16 }}>
          <h2 style={sectionTitle}>Identidade do template</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Nome</label>
              <input className="field" type="text" required placeholder="Ex: Atendimento Restaurante"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={T.label}>Categoria</label>
              <input className="field" type="text" placeholder="Ex: vendas, suporte, restaurante"
                value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label style={T.label}>Descrição</label>
              <input className="field" type="text" placeholder="Para que serve este template"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Configuração */}
        <div style={{ ...CARD_HI, marginBottom: 16 }}>
          <h2 style={sectionTitle}>Configuração padrão</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Modelo</label>
              <select className="field" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                {MODELOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={T.label}>Prompt do sistema</label>
              <textarea className="field" rows={6} value={form.prompt}
                onChange={e => setForm({ ...form, prompt: e.target.value })}
                placeholder="Você é um assistente virtual da empresa..." />
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
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Salvando…' : 'Criar template'}
        </button>
      </form>
    </div>
  )
}
