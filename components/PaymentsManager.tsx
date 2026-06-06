'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'
import { fmtBRL } from '@/lib/usage'

interface Pagamento {
  id: string
  amount: number
  paid_at: string
  reference: string | null
  method: string | null
}

export function PaymentsManager({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [lista, setLista] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const hoje = new Date().toLocaleDateString('en-CA')
  const [form, setForm] = useState({ amount: '', paid_at: hoje, reference: '', method: 'pix' })

  async function load() {
    const { data } = await supabase.from('payments').select('*').eq('client_id', clientId).order('paid_at', { ascending: false })
    setLista((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [clientId])

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    const valor = Number(String(form.amount).replace(',', '.'))
    if (!valor || valor <= 0) { setError('Informe um valor válido.'); return }
    setSaving(true); setError('')
    const { error } = await supabase.from('payments').insert({
      client_id: clientId, amount: valor, paid_at: form.paid_at,
      reference: form.reference.trim() || null, method: form.method,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false); setForm({ amount: '', paid_at: hoje, reference: '', method: 'pix' })
    load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este pagamento do histórico?')) return
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) { alert(error.message); return }
    load()
  }

  const total = lista.reduce((s, p) => s + Number(p.amount || 0), 0)

  return (
    <div style={{ ...CARD, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Pagamentos</h2>
          {!loading && <p style={{ ...T.sub, fontSize: 12, marginTop: 2 }}>{lista.length} registro(s) · total {fmtBRL(total)}</p>}
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>
          {showForm ? 'Cancelar' : '+ Registrar pagamento'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={registrar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <label style={T.label}>Valor (R$)</label>
            <input className="field" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0,00" required />
          </div>
          <div>
            <label style={T.label}>Data</label>
            <input className="field" type="date" value={form.paid_at} onChange={e => setForm({ ...form, paid_at: e.target.value })} required />
          </div>
          <div>
            <label style={T.label}>Referência</label>
            <input className="field" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Ex: Mensalidade jun/2026" />
          </div>
          <div>
            <label style={T.label}>Forma</label>
            <select className="field" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
              <option value="pix">Pix</option>
              <option value="boleto">Boleto</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {error && <p style={{ gridColumn: '1/3', color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary" style={{ gridColumn: '1/3', justifySelf: 'start', fontSize: 13 }}>
            {saving ? 'Salvando…' : 'Salvar pagamento'}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ ...T.sub, fontSize: 13 }}>Carregando…</p>
      ) : !lista.length ? (
        <p style={{ ...T.sub, fontSize: 13 }}>Nenhum pagamento registrado ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 15, color: C.green, width: 110 }}>{fmtBRL(Number(p.amount))}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white }}>{p.reference || 'Pagamento'}</p>
                <p style={{ ...T.mono, fontSize: 9, color: C.faint }}>
                  {new Date(p.paid_at + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  {p.method ? ` · ${p.method}` : ''}
                </p>
              </div>
              <button onClick={() => excluir(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, fontSize: 16, padding: 4 }} title="Excluir">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
