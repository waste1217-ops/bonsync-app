'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'
import { ADMIN_LEVELS, levelLabel, levelVariant, type AdminLevel } from '@/lib/permissions'

interface Membro {
  id: string
  email: string
  nome: string
  admin_level: AdminLevel
  active: boolean
  created_at: string
  isSelf: boolean
}

export function TeamManager({ membros }: { membros: Membro[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', admin_level: 'manager' as AdminLevel })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/admin/team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Erro ao criar membro.'); return }
    setShowForm(false); setForm({ name: '', email: '', password: '', admin_level: 'manager' })
    router.refresh()
  }

  async function patch(target_id: string, body: Record<string, unknown>) {
    setBusyId(target_id)
    const res = await fetch('/api/admin/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_id, ...body }),
    })
    const data = await res.json()
    setBusyId(null)
    if (!res.ok) { alert(data.error || 'Erro ao atualizar.'); return }
    router.refresh()
  }

  return (
    <div>
      {/* Ação topo */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary" style={{ fontSize: 13 }}>
          {showForm ? 'Cancelar' : '+ Novo membro'}
        </button>
      </div>

      {/* Form de criação */}
      {showForm && (
        <form onSubmit={criar} style={{ ...CARD, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>Novo membro da equipe</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={T.label}>Nome</label>
              <input className="field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label style={T.label}>E-mail</label>
              <input className="field" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label style={T.label}>Senha provisória</label>
              <input className="field" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="mín. 8 caracteres" required />
            </div>
            <div>
              <label style={T.label}>Nível de acesso</label>
              <select className="field" value={form.admin_level} onChange={e => setForm({ ...form, admin_level: e.target.value as AdminLevel })}>
                {ADMIN_LEVELS.filter(l => l.value !== 'owner').map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p style={{ ...T.sub, fontSize: 12 }}>
            {ADMIN_LEVELS.find(l => l.value === form.admin_level)?.desc}
          </p>
          {error && <p style={{ color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Criando…' : 'Criar membro'}
          </button>
        </form>
      )}

      {/* Lista */}
      <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1.4fr', gap: 16, padding: '12px 24px', borderBottom: `1px solid ${C.border}` }}>
          {['Membro', 'Nível', 'Status', 'Ações'].map(h => <span key={h} style={T.tableHead}>{h}</span>)}
        </div>
        {membros.map(m => (
          <div key={m.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1.4fr', gap: 16, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white, display: 'flex', alignItems: 'center', gap: 8 }}>
                {m.nome} {m.isSelf && <span style={{ ...T.mono, fontSize: 8, color: C.faint }}>(você)</span>}
              </p>
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
            </div>

            {/* Nível */}
            <div>
              {m.admin_level === 'owner' || m.isSelf ? (
                <span style={badgeStyle(levelVariant(m.admin_level))}>{levelLabel[m.admin_level]}</span>
              ) : (
                <select className="field" disabled={busyId === m.id} value={m.admin_level}
                  onChange={e => patch(m.id, { admin_level: e.target.value })}
                  style={{ fontFamily: FONT.jb, fontSize: 12, padding: '6px 10px', width: 'auto' }}>
                  {ADMIN_LEVELS.filter(l => l.value !== 'owner').map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Status */}
            <span style={badgeStyle(m.active ? 'green' : 'red')}>{m.active ? 'Ativo' : 'Suspenso'}</span>

            {/* Ações */}
            <div>
              {m.admin_level === 'owner' || m.isSelf ? (
                <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>—</span>
              ) : (
                <button onClick={() => patch(m.id, { active: !m.active })} disabled={busyId === m.id}
                  className="btn-ghost" style={{ fontSize: 11, padding: '7px 14px', color: m.active ? C.yellow : C.green }}>
                  {busyId === m.id ? '…' : m.active ? 'Suspender' : 'Reativar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Legenda dos níveis */}
      <div style={{ ...CARD, marginTop: 16 }}>
        <p style={{ ...T.mono, color: C.muted, marginBottom: 12 }}>Níveis de acesso</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ADMIN_LEVELS.map(l => (
            <div key={l.value} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ ...badgeStyle(levelVariant(l.value)), flexShrink: 0 }}>{l.label}</span>
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{l.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
