'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const MODELOS = [
  { value: 'claude-opus-4-5',    label: 'Claude Opus 4.5    — Máxima inteligência' },
  { value: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5  — Equilíbrio ideal (recomendado)' },
  { value: 'claude-haiku-3-5',   label: 'Claude Haiku 3.5   — Máxima velocidade e custo' },
]

export default function NovoAgentePage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [form, setForm] = useState({
    client_id:       '',
    name:            '',
    description:     '',
    model:           'claude-sonnet-4-5',
    anthropic_key:   '',
    prompt:          '',
    tom:             'profissional',
    saudacao:        'Olá! Como posso te ajudar hoje?',
    escalarApos:     15,
    channels:        ['WhatsApp'],
  })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('profiles').select('id, email, company_name').eq('role', 'client').then(({ data }) => {
      if (data) setClientes(data)
    })
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
      status:      'paused', // começa pausado por segurança
      config: {
        model:         form.model,
        anthropic_key: form.anthropic_key,
        prompt:        form.prompt,
        tom:           form.tom,
        saudacao:      form.saudacao,
        escalarApos:   form.escalarApos,
        channels:      form.channels,
      },
    })

    if (err) { setError(err.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/admin/agentes'), 1200)
  }

  const field: React.CSSProperties = {
    width: '100%', background: 'rgba(11,26,54,0.5)', border: '1px solid var(--c-border)',
    borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-dm)', fontSize: 14,
    color: 'var(--c-white)', outline: 'none',
  }
  const label: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--font-jb)', fontSize: 10,
    letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--c-blue-b)', marginBottom: 8,
  }
  const section: React.CSSProperties = { marginBottom: 24 }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/agentes" style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-muted)', letterSpacing: '0.1em', display: 'inline-block', marginBottom: 16 }}>
          ← Voltar
        </a>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Novo agente
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Configure um agente Anthropic para um cliente.
        </p>
      </div>

      {success && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: 'var(--c-green)', fontFamily: 'var(--font-dm)', fontSize: 14 }}>
          Agente criado com sucesso! Redirecionando…
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Seção 1: Vinculação */}
        <div className="card" style={section}>
          <h2 style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 15, color: 'var(--c-white)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--c-border)' }}>
            Vinculação ao cliente
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={label}>Cliente</label>
              <select className="field" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} required>
                <option value="">Selecione o cliente…</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name || c.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Nome do agente</label>
              <input style={field} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Agente de Atendimento" required />
            </div>
            <div>
              <label style={label}>Descrição (opcional)</label>
              <input style={field} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Atende dúvidas de clientes pelo WhatsApp" />
            </div>
          </div>
        </div>

        {/* Seção 2: Anthropic */}
        <div className="card" style={{ ...section, border: '1px solid var(--c-border-hi)' }}>
          <h2 style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 15, color: 'var(--c-white)', marginBottom: 6, paddingBottom: 12, borderBottom: '1px solid var(--c-border)' }}>
            Configuração Anthropic
          </h2>
          <p style={{ fontFamily: 'var(--font-dm)', fontSize: 12, color: 'var(--c-muted)', marginBottom: 20, fontWeight: 300 }}>
            A API key fica armazenada criptografada e nunca é visível para o cliente.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={label}>Anthropic API Key</label>
              <input style={field} type="password" value={form.anthropic_key}
                onChange={e => setForm({ ...form, anthropic_key: e.target.value })}
                placeholder="sk-ant-api03-…" required />
            </div>
            <div>
              <label style={label}>Modelo</label>
              <select className="field" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                {MODELOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Prompt do sistema</label>
              <textarea className="field" rows={5} value={form.prompt}
                onChange={e => setForm({ ...form, prompt: e.target.value })}
                placeholder="Você é um assistente virtual da empresa {company}. Responda de forma clara e objetiva..." />
              <p style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-faint)', marginTop: 6 }}>
                Instrução base enviada em todo contexto do agente. O cliente pode adicionar instruções complementares.
              </p>
            </div>
          </div>
        </div>

        {/* Seção 3: Comportamento */}
        <div className="card" style={section}>
          <h2 style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 15, color: 'var(--c-white)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--c-border)' }}>
            Comportamento
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={label}>Tom de voz</label>
              <select className="field" value={form.tom} onChange={e => setForm({ ...form, tom: e.target.value })}>
                <option value="profissional">Profissional</option>
                <option value="amigavel">Amigável e descontraído</option>
                <option value="formal">Formal</option>
                <option value="tecnico">Técnico</option>
              </select>
            </div>
            <div>
              <label style={label}>Mensagem de saudação</label>
              <input style={field} value={form.saudacao} onChange={e => setForm({ ...form, saudacao: e.target.value })} />
            </div>
            <div>
              <label style={label}>Escalar para humano após (nº de mensagens)</label>
              <input style={{ ...field, width: 100 }} type="number" min={3} max={100} value={form.escalarApos}
                onChange={e => setForm({ ...form, escalarApos: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ background: 'var(--c-void)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <p style={{ fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-muted)', marginBottom: 8 }}>
            Segurança — sempre ativo em todos os agentes
          </p>
          {['Validação de conteúdo em todas as mensagens', 'Log completo salvo no Supabase', 'Acesso segregado por RLS — cliente vê apenas seus dados'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--c-green)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              <span style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--c-muted)', fontWeight: 300 }}>{f}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--c-red)', fontFamily: 'var(--font-dm)', fontSize: 13 }}>
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
