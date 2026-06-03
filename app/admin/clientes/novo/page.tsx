'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { C, T, L, CARD, FONT } from '@/lib/styles'

export default function NovoClientePage() {
  const [form, setForm]     = useState({ company_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { company_name: form.company_name } },
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: form.email,
        role: 'client',
        company_name: form.company_name,
      })
      setSuccess(true)
      setTimeout(() => router.push('/admin/clientes'), 1500)
    }
    setLoading(false)
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 520 }}>

      {/* Back + Header */}
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/clientes" style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>
          ← Voltar
        </a>
        <h1 style={T.h1}>Novo cliente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Crie o acesso de um novo cliente à plataforma.</p>
      </div>

      {/* Sucesso */}
      {success && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: C.green, fontFamily: FONT.dm, fontSize: 14 }}>
          Cliente criado com sucesso! Redirecionando…
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={T.label}>Nome da empresa</label>
          <input className="field" type="text" required placeholder="Acme Ltda."
            value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div>
          <label style={T.label}>E-mail de acesso</label>
          <input className="field" type="email" required placeholder="contato@acme.com.br"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label style={T.label}>Senha inicial</label>
          <input className="field" type="password" required minLength={8} placeholder="Mínimo 8 caracteres"
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
            O cliente poderá alterar a senha após o primeiro acesso.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 8, padding: '12px 16px', color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Criando…' : 'Criar cliente'}
        </button>
      </form>
    </div>
  )
}
