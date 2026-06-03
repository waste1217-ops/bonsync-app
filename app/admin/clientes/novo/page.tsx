'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, T, L, CARD, FONT } from '@/lib/styles'

export default function NovoClientePage() {
  const [form, setForm]       = useState({ company_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const res = await fetch('/api/admin/create-user', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar cliente.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/admin/clientes'), 1500)
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 520 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/clientes"
          style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>
          ← Voltar
        </a>
        <h1 style={T.h1}>Novo cliente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Crie o acesso de um novo cliente à plataforma.</p>
      </div>

      {/* Sucesso */}
      {success && (
        <div style={{
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 10, padding: '14px 20px', marginBottom: 20,
          color: C.green, fontFamily: FONT.dm, fontSize: 14,
        }}>
          ✓ Cliente criado com sucesso! Redirecionando…
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <label style={T.label}>Nome da empresa</label>
          <input className="field" type="text" required placeholder="Acme Ltda."
            value={form.company_name}
            onChange={e => setForm({ ...form, company_name: e.target.value })} />
        </div>

        <div>
          <label style={T.label}>E-mail de acesso</label>
          <input className="field" type="email" required placeholder="contato@acme.com.br"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>

        <div>
          <label style={T.label}>Senha inicial</label>
          <input className="field" type="password" required minLength={8}
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} />
          <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
            O cliente poderá alterar a senha após o primeiro acesso.
          </p>
        </div>

        {/* Erro */}
        {error && (
          <div style={{
            background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)',
            borderRadius: 8, padding: '12px 16px',
            color: C.red, fontFamily: FONT.dm, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading || success}>
          {loading ? 'Criando…' : 'Criar cliente'}
        </button>
      </form>

      {/* Info */}
      <div style={{
        marginTop: 16, background: C.void, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '14px 18px',
      }}>
        <p style={{ ...T.mono, color: C.muted, marginBottom: 8 }}>Como funciona</p>
        {[
          'Usuário criado via service role — sem e-mail de confirmação',
          'Cliente já pode logar imediatamente com as credenciais informadas',
          'Role definido como "client" automaticamente',
        ].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.blueB} strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
