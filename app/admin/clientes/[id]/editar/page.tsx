'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { C, T, CARD, FONT } from '@/lib/styles'

export default function EditarClientePage() {
  const params   = useParams()
  const id       = params.id as string
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)
  const [email, setEmail]     = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles').select('email, company_name').eq('id', id).single()
      if (data) {
        setEmail(data.email ?? '')
        setCompanyName(data.company_name ?? '')
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error: err } = await supabase.from('profiles')
      .update({ company_name: companyName })
      .eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true); setSaving(false)
    setTimeout(() => { router.push(`/admin/clientes/${id}`); router.refresh() }, 1000)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }} className="animate-pulse-dot">Carregando…</div>
  )

  return (
    <div className="animate-slide-up" style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 28 }}>
        <a href={`/admin/clientes/${id}`} style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>← Voltar</a>
        <h1 style={T.h1}>Editar cliente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Ajuste os dados do cliente.</p>
      </div>

      {saved && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: C.green, fontFamily: FONT.dm, fontSize: 14 }}>
          Salvo! Redirecionando…
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={T.label}>Nome da empresa</label>
          <input className="field" type="text" required value={companyName}
            onChange={e => setCompanyName(e.target.value)} />
        </div>
        <div>
          <label style={T.label}>E-mail de acesso</label>
          <input className="field" type="email" value={email} disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
            O e-mail de login não pode ser alterado aqui. Para trocar a senha, use "Redefinir senha" na página do cliente.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 8, padding: '12px 16px', color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}
