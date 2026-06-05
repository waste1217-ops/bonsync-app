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
interface Suggestion {
  id: string
  content: string
  reason: string | null
  created_at: string
}

export function KnowledgeManager({ agentId }: { agentId: string }) {
  const supabase = createClient()
  const [items, setItems]       = useState<Item[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading]   = useState(true)
  const [novo, setNovo]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [busy, setBusy]         = useState('')

  async function load() {
    const [{ data: kb }, { data: sug }] = await Promise.all([
      supabase.from('knowledge_base').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }),
      supabase.from('knowledge_suggestions').select('*').eq('agent_id', agentId).eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setItems(kb ?? [])
    setSuggestions(sug ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function adicionar() {
    const content = novo.trim()
    if (!content || saving) return
    setSaving(true)
    await supabase.from('knowledge_base').insert({ agent_id: agentId, content, active: true })
    setNovo(''); setSaving(false); load()
  }

  async function toggle(item: Item) {
    await supabase.from('knowledge_base').update({ active: !item.active, updated_at: new Date().toISOString() }).eq('id', item.id)
    load()
  }
  async function remover(id: string) {
    await supabase.from('knowledge_base').delete().eq('id', id); load()
  }
  async function salvarEdicao(id: string) {
    const content = editText.trim(); if (!content) return
    await supabase.from('knowledge_base').update({ content, updated_at: new Date().toISOString() }).eq('id', id)
    setEditId(null); setEditText(''); load()
  }

  async function aprovar(s: Suggestion) {
    setBusy(s.id)
    await supabase.from('knowledge_base').insert({ agent_id: agentId, content: s.content, active: true })
    await supabase.from('knowledge_suggestions').update({ status: 'approved' }).eq('id', s.id)
    setBusy(''); load()
  }
  async function descartar(s: Suggestion) {
    setBusy(s.id)
    await supabase.from('knowledge_suggestions').update({ status: 'rejected' }).eq('id', s.id)
    setBusy(''); load()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px 0', ...T.sub }} className="animate-pulse-dot">Carregando…</div>
  )

  return (
    <div>
      {/* Sugestões do agente */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>
              Sugestões do agente
            </h2>
            <span style={{ ...T.mono, fontSize: 9, color: C.blueB, background: 'oklch(55% 0.24 225/0.12)', border: '1px solid oklch(55% 0.24 225/0.25)', padding: '3px 9px', borderRadius: 100 }}>
              {suggestions.length} nova{suggestions.length > 1 ? 's' : ''}
            </span>
          </div>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>
            O agente percebeu temas recorrentes nas conversas e sugere adicionar à base. Você decide.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map(s => (
              <div key={s.id} style={{ background: C.deep, border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: '16px 18px' }}>
                <p style={{ fontFamily: FONT.dm, fontSize: 14.5, color: C.white, lineHeight: 1.6, fontWeight: 300, marginBottom: s.reason ? 8 : 14 }}>
                  {s.content}
                </p>
                {s.reason && (
                  <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
                    💡 {s.reason}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => aprovar(s)} disabled={!!busy} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>
                    {busy === s.id ? '…' : 'Aprovar'}
                  </button>
                  <button onClick={() => descartar(s)} disabled={!!busy} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adicionar manual */}
      <div style={{ ...CARD, marginBottom: 20 }}>
        <label style={T.label}>Adicionar um conhecimento</label>
        <textarea
          className="field" rows={2}
          placeholder='Ex: "Entregamos em até 3 dias úteis para todo o Brasil." ou "Frete grátis acima de R$ 200."'
          value={novo}
          onChange={e => setNovo(e.target.value)}
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
                    <button onClick={() => { setEditId(item.id); setEditText(item.content) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: FONT.jb, fontSize: 11 }}>editar</button>
                    <button onClick={() => remover(item.id)}
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
