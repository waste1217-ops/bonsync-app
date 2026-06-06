'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'

interface Item {
  id: string
  title: string
  kind: string
  category: string | null
  content: string
  created_at: string
}

const KINDS = [
  { value: 'prompt',   label: 'Prompt' },
  { value: 'resposta', label: 'Resposta pronta' },
  { value: 'fluxo',    label: 'Fluxo' },
]
const kindLabel: Record<string, string> = { prompt: 'Prompt', resposta: 'Resposta', fluxo: 'Fluxo' }
const kindVariant = (k: string): 'blue' | 'green' | 'yellow' => k === 'prompt' ? 'blue' : k === 'resposta' ? 'green' : 'yellow'

const vazio = { id: '', title: '', kind: 'prompt', category: '', content: '' }

export function LibraryManager() {
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtroKind, setFiltroKind] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<typeof vazio>(vazio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState('')

  async function load() {
    const { data } = await supabase.from('prompt_library').select('*').order('created_at', { ascending: false })
    setItems((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function novo() { setForm(vazio); setShowForm(true); setError('') }
  function editar(it: Item) { setForm({ id: it.id, title: it.title, kind: it.kind, category: it.category || '', content: it.content }); setShowForm(true); setError('') }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { setError('Título e conteúdo são obrigatórios.'); return }
    setSaving(true); setError('')
    const payload = { title: form.title.trim(), kind: form.kind, category: form.category.trim() || null, content: form.content }
    const { error } = form.id
      ? await supabase.from('prompt_library').update(payload).eq('id', form.id)
      : await supabase.from('prompt_library').insert(payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false); setForm(vazio); load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este item da biblioteca?')) return
    const { error } = await supabase.from('prompt_library').delete().eq('id', id)
    if (error) { alert(error.message); return }
    load()
  }

  async function copiar(it: Item) {
    try { await navigator.clipboard.writeText(it.content); setCopiado(it.id); setTimeout(() => setCopiado(''), 1500) }
    catch { alert('Não foi possível copiar.') }
  }

  const termo = q.trim().toLowerCase()
  const filtrados = items.filter(it => {
    if (filtroKind !== 'all' && it.kind !== filtroKind) return false
    if (termo) return `${it.title} ${it.category ?? ''} ${it.content}`.toLowerCase().includes(termo)
    return true
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" style={{ flex: 1, minWidth: 200, maxWidth: 320 }} />
        <select className="field" value={filtroKind} onChange={e => setFiltroKind(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">Todos os tipos</option>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={novo} className="btn-primary" style={{ fontSize: 13 }}>+ Novo item</button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={salvar} style={{ ...CARD, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>{form.id ? 'Editar item' : 'Novo item'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={T.label}>Título</label>
              <input className="field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label style={T.label}>Tipo</label>
              <select className="field" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label style={T.label}>Categoria / nicho</label>
              <input className="field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: restaurante" />
            </div>
          </div>
          <div>
            <label style={T.label}>Conteúdo</label>
            <textarea className="field" rows={6} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required />
          </div>
          {error && <p style={{ color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => { setShowForm(false); setForm(vazio) }} className="btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ ...T.sub }}>Carregando…</p>
      ) : !filtrados.length ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '48px 24px', ...T.sub }}>
          {items.length ? 'Nada encontrado com esses filtros.' : 'Biblioteca vazia. Crie o primeiro item.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }}>
          {filtrados.map(it => (
            <div key={it.id} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>{it.title}</h3>
                <span style={badgeStyle(kindVariant(it.kind))}>{kindLabel[it.kind]}</span>
              </div>
              {it.category && <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>{it.category}</span>}
              <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', maxHeight: 150, overflow: 'auto' }}>
                <p style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, lineHeight: 1.6, fontWeight: 300, whiteSpace: 'pre-wrap' }}>{it.content}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button onClick={() => copiar(it)} className="btn-primary" style={{ fontSize: 11, padding: '7px 14px', flex: 1 }}>
                  {copiado === it.id ? '✓ Copiado' : 'Copiar'}
                </button>
                <button onClick={() => editar(it)} className="btn-ghost" style={{ fontSize: 11, padding: '7px 12px' }}>Editar</button>
                <button onClick={() => excluir(it.id)} className="btn-ghost" style={{ fontSize: 11, padding: '7px 12px', color: C.red }}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
