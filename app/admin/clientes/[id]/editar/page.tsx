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
  const [responsavel, setResponsavel] = useState('')
  const [notas, setNotas]     = useState('')
  const [sub, setSub] = useState({ plan_name: 'Padrão', monthly_price: 0, status: 'trial', due_date: '' })

  useEffect(() => {
    async function load() {
      const [{ data: profile }, { data: subscription }] = await Promise.all([
        supabase.from('profiles').select('email, company_name, responsavel, internal_notes').eq('id', id).single(),
        supabase.from('subscriptions').select('*').eq('client_id', id).single(),
      ])
      if (profile) {
        setEmail(profile.email ?? '')
        setCompanyName(profile.company_name ?? '')
        setResponsavel(profile.responsavel ?? '')
        setNotas(profile.internal_notes ?? '')
      }
      if (subscription) {
        setSub({
          plan_name: subscription.plan_name ?? 'Padrão',
          monthly_price: Number(subscription.monthly_price ?? 0),
          status: subscription.status ?? 'trial',
          due_date: subscription.due_date ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')

    const { error: e1 } = await supabase.from('profiles')
      .update({ company_name: companyName, responsavel, internal_notes: notas }).eq('id', id)
    if (e1) { setError(e1.message); setSaving(false); return }

    const { error: e2 } = await supabase.from('subscriptions').upsert({
      client_id: id,
      plan_name: sub.plan_name,
      monthly_price: sub.monthly_price,
      status: sub.status,
      due_date: sub.due_date || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
    if (e2) { setError(e2.message); setSaving(false); return }

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
        <p style={{ ...T.sub, marginTop: 4 }}>Ajuste os dados e a assinatura do cliente.</p>
      </div>

      {saved && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, color: C.green, fontFamily: FONT.dm, fontSize: 14 }}>
          Salvo! Redirecionando…
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Dados */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>Dados</h2>
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
              O e-mail não pode ser alterado aqui. Para trocar a senha, use "Redefinir senha".
            </p>
          </div>
          <div>
            <label style={T.label}>Responsável (Bonsync)</label>
            <input className="field" type="text" value={responsavel}
              onChange={e => setResponsavel(e.target.value)}
              placeholder="Quem cuida deste cliente" />
          </div>
        </div>

        {/* Anotações internas */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>Anotações internas</h2>
          <p style={{ ...T.sub, fontSize: 12, marginTop: -4 }}>🔒 Visível apenas para a equipe Bonsync — o cliente nunca vê isto.</p>
          <textarea className="field" rows={4} value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Observações, combinados, contexto do relacionamento…" />
        </div>

        {/* Assinatura */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>Assinatura</h2>
          <div>
            <label style={T.label}>Status</label>
            <select className="field" value={sub.status} onChange={e => setSub({ ...sub, status: e.target.value })}>
              <option value="trial">Em teste</option>
              <option value="active">Ativo (pagante)</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div>
            <label style={T.label}>Plano</label>
            <input className="field" type="text" value={sub.plan_name}
              onChange={e => setSub({ ...sub, plan_name: e.target.value })}
              placeholder="Ex: Essencial, Pro, Enterprise" />
          </div>
          <div>
            <label style={T.label}>Valor mensal (R$)</label>
            <input className="field" type="number" min={0} step="0.01" value={sub.monthly_price}
              onChange={e => setSub({ ...sub, monthly_price: Number(e.target.value) })}
              style={{ width: 160 }} />
            <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
              Entra no MRR só quando o status for "Ativo".
            </p>
          </div>
          <div>
            <label style={T.label}>Próximo vencimento</label>
            <input className="field" type="date" value={sub.due_date}
              onChange={e => setSub({ ...sub, due_date: e.target.value })}
              style={{ width: 200 }} />
            <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
              Data da próxima cobrança. Gera alerta no painel quando estiver próxima ou vencida.
            </p>
          </div>
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
