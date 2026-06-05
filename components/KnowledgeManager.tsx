'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

interface Item {
  id: string
  content: string
  active: boolean
  created_at: string
}

export function KnowledgeManager({ agentId }: { agentId: string }) {
  const supabase = createClient()
  const [items, setItems]     = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [novo, setNovo]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [editId, setEditId]   = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  async function load() {
    const { data } = await supabase
      .from('knowledge_base').select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function adicionar() {
    const content = novo.trim()
    if (!content || saving) return
    setSaving(true)
    await supabase.from('knowledge_base').insert({ agent_id: agentId, content, active: true })
    setNovo('')
    setSaving(false)
    load()
  }

  async function toggle(item: Item) {
    await supabase.from('knowledge_base').update({ active: !item.active, updated_at: new Date().toISOString() }).eq('id', item.id)
    load()
  }

  async function remover(id: string) {
    await supabase.from('knowledge_base').delete().eq('id', id)
    load()
  }

  async function salvarEdicao(id: string) {
    const content = editText.trim()
    if (!content) return
    await supabase.from('knowledge_base').update({ content, updated_at: new Date().toISOString() }).eq('id', id)
    setEditId(null); setEditText('')
    load()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px 0', ...T.sub }} className="animate-pulse-dot">Carregando…</div>
  )

  return (
    <div>
      {/* Adicionar */}
      <div style={{ ...CARD, marginBottom: 20 }}>
        <label style={T.label}>Adicionar um conhecimento</label>
        <textarea
          className="field" rows={2}
          placeholder='Ex: "Entregamos em até 3 dias úteis para todo o Brasil." ou "Frete grátis acima de R$ 200."'
          value={novo}
          onChange={e => setNovo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) adicionar() }}
          style={{ marginBottom: 12 }}
        />
        <button onClick={adicionar} disabled={saving || !novo.trim()} className="btn-primary"
          style={{ opacity: saving || !novo.trim() ? 0.5 : 1 }}>
          {saving ? 'Adicionando…' : 'Adicionar'}
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>
          Nenhum conhecimento cadastrado. Adicione fatos sobre o seu negócio (horários, políticas, preços, prazos) para o agente usar nas respostas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <div key={item.id} style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', opacity: item.active ? 1 : 0.55 }}>
              {editId === item.id ? (
                <div>
                  <textarea className="field" rows={3} value={editText}
                    onChange={e => setEditText(e.target.value)} style={{ marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => salvarEdicao(item.id)} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>Salvar</button>
                    <button onClick={() => { setEditId(null); setEditText('') }} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <p style={{ fontFamily: FONT.dm, fontSize: 14.5, color: C.white, lineHeight: 1.6, fontWeight: 300, flex: 1 }}>
                    {item.content}
                  </p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                    <button onClick={() => toggle(item)} title={item.active ? 'Ativo — clique para desativar' : 'Inativo — clique para ativar'}
                      style={{ ...T.mono, fontSize: 9, padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                        color: item.active ? C.green : C.muted,
                        background: item.active ? 'rgba(34,197,94,0.1)' : 'rgba(80,130,210,0.08)',
                        border: `1px solid ${item.active ? 'rgba(34,197,94,0.25)' : C.border}` }}>
                      {item.active ? 'ATIVO' : 'INATIVO'}
                    </button>
                    <button onClick={() => { setEditId(item.id); setEditText(item.content) }} title="Editar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: FONT.jb, fontSize: 11 }}>editar</button>
                    <button onClick={() => remover(item.id)} title="Remover"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontFamily: FONT.jb, fontSize: 11 }}>remover</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
