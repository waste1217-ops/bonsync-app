'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { C, T, L, CARD, CARD_HI, FONT } from '@/lib/styles'

const MODELOS = [
  { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5   — Máxima inteligência' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 — Equilíbrio ideal (recomendado)' },
  { value: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5  — Máxima velocidade e custo' },
]

export default function NovoAgentePage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [form, setForm] = useState({
    client_id: '', name: '', description: '',
    model: 'claude-sonnet-4-5', anthropic_key: '',
    prompt: '', tom: 'profissional',
    saudacao: 'Olá! Como posso te ajudar hoje?',
    escalarApos: 15,
    whatsapp_instance: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('profiles').select('id, email, company_name').eq('role', 'client')
      .then(({ data }) => { if (data) setClientes(data) })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id)     return setError('Selecione o cliente.')
    if (!form.anthropic_key) return setError('Informe a Anthropic API key.')
    setLoading(true); setError('')

    const { error: err } = await supabase.from('agents').insert({
      client_id:   form.client_id,
      name:        form.name,
      description: form.description,
      status:      'paused',
      config: {
        model:         form.model,
        anthropic_key: form.anthropic_key,
        prompt:        form.prompt,
        tom:           form.tom,
        saudacao:      form.saudacao,
        escalarApos:   form.escalarApos,
        whatsapp_instance:  form.whatsapp_instance,
        channels:           ['WhatsApp'],
      },
    })

    if (err) { setError(err.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/admin/agentes'), 1200)
  }

  const sectionTitle = {
    fontFamily: FONT.space, fontWeight: 600, fontSize: 15,
    color: C.white, marginBottom: 20, paddingBottom: 12,
    borderBottom: `1px solid ${C.border}`,
  } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 680 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/agentes" style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>
          ← Voltar
        </a>
        <h1 style={T.h1}>Novo agente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Configure um agente Anthropic para um cliente.</p>
      </div>

      {success && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: C.green, fontFamily: FONT.dm, fontSize: 14 }}>
          Agente criado com sucesso! Redirecionando…
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Vinculação */}
        <div style={{ ...CARD, marginBottom: 16 }}>
          <h2 style={sectionTitle}>Vinculação ao cliente</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Cliente</label>
              <select className="field" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} required>
                <option value="">Selecione o cliente…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.company_name || c.email}</option>)}
              </select>
            </div>
            <div>
              <label style={T.label}>Nome do agente</label>
              <input className="field" type="text" required placeholder="Ex: Agente de Atendimento"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={T.label}>Descrição (opcional)</label>
              <input className="field" type="text" placeholder="Atende dúvidas de clientes pelo WhatsApp"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Anthropic */}
        <div style={{ ...CARD_HI, marginBottom: 16 }}>
          <h2 style={sectionTitle}>Configuração Anthropic</h2>
          <p style={{ ...T.sub, fontSize: 12, marginTop: -8, marginBottom: 20 }}>
            A API key fica armazenada no banco e nunca é visível para o cliente.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={T.label}>Anthropic API Key</label>
              <input className="field" type="password" required placeholder="sk-ant-api03-…"
                value={form.anthropic_key} onChange={e => setForm({ ...form, anthropic_key: e.target.value })} />
            </div>
            <div>
              <label style={T.label}>Modelo</label>
              <select className="field" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                {MODELOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={T.label}>Prompt do sistema</label>
              <textarea className="field" rows={5}
                value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })}
                placeholder="Você é um assistente virtual da empresa. Responda de forma clara e objetiva..." />
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                Instrução base enviada em todo contexto. O cliente pode adicionar instruções complementares.
              </p>
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
              <label style={T.label}>Escalar para humano após (nº msgs)</label>
              <input className="field" type="number" min={3} max={100} value={form.escalarApos}
                onChange={e => setForm({ ...form, escalarApos: Number(e.target.value) })}
                style={{ width: 120 }} />
            </div>
            <div>
              <label style={T.label}>Instância WhatsApp (Evolution API)</label>
              <input className="field" type="text" placeholder="ex: javai"
                value={form.whatsapp_instance}
                onChange={e => setForm({ ...form, whatsapp_instance: e.target.value })} />
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                Nome exato da instância no Evolution Manager. Liga este agente ao número escaneado.
              </p>
            </div>
          </div>
        </div>

        {/* Segurança */}
        <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ ...T.mono, color: C.muted, marginBottom: 10 }}>Segurança — sempre ativo</p>
          {['Validação de conteúdo em todas as mensagens', 'Log completo salvo no Supabase', 'Acesso segregado por RLS — cliente vê apenas seus dados'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{f}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Criando agente…' : 'Criar agente (começa pausado)'}
        </button>
      </form>
    </div>
  )
}
