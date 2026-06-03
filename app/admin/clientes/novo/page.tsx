'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NovoClientePage() {
  const [form, setForm] = useState({ company_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Cria usuário via Supabase Auth Admin (precisa da service role key em produção)
    // Por ora usamos signUp e inserimos o profile manualmente
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { company_name: form.company_name } }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

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
    <div className="animate-slide-up max-w-lg">
      <div className="mb-8">
        <a href="/admin/clientes" className="font-mono text-[10px] text-muted tracking-wider hover:text-white transition-colors no-underline">
          ← Voltar
        </a>
        <h1 className="font-heading font-bold text-2xl text-white tracking-tight mt-4">Novo cliente</h1>
        <p className="text-muted text-sm font-light mt-1">Crie o acesso de um novo cliente à plataforma.</p>
      </div>

      {success && (
        <div className="bg-green/8 border border-green/30 rounded-xl px-5 py-4 text-green text-sm mb-6">
          Cliente criado com sucesso! Redirecionando…
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-deep border border-border rounded-xl p-6 flex flex-col gap-5">
        <div>
          <label className="block font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase mb-2">
            Nome da empresa
          </label>
          <input
            type="text"
            value={form.company_name}
            onChange={e => setForm({ ...form, company_name: e.target.value })}
            placeholder="Acme Ltda."
            required
            className="w-full bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-blue-bright focus:ring-2 focus:ring-blue/20 transition"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase mb-2">
            E-mail de acesso
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="contato@acme.com.br"
            required
            className="w-full bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-blue-bright focus:ring-2 focus:ring-blue/20 transition"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase mb-2">
            Senha inicial
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            required
            className="w-full bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-blue-bright focus:ring-2 focus:ring-blue/20 transition"
          />
          <p className="font-mono text-[10px] text-faint mt-2">O cliente poderá alterar a senha após o primeiro acesso.</p>
        </div>

        {error && (
          <div className="bg-red/8 border border-red/30 rounded-lg px-4 py-3 text-red text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-full bg-white text-void text-sm font-medium transition hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Criando…' : 'Criar cliente'}
        </button>
      </form>
    </div>
  )
}
