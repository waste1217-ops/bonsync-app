'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

interface Item { id: string; content: string; active: boolean; created_at: string; updated_at?: string }
interface Suggestion { id: string; content: string; reason: string | null; created_at: string }

// ── Categorização automática ──
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const CATS: [string, string[]][] = [
  ['Produtos não atendidos', ['nao atende', 'nao oferece', 'nao trabalha', 'nao fazemos', 'recus', 'perecivel', 'nao atendemos']],
  ['Preços', ['preco', 'valor', 'orcamento', 'custo', 'mensalidade', 'r$', 'reais', 'tarifa', 'cobrad']],
  ['Prazos', ['prazo', 'entrega', 'horario', 'funcionamento', 'dias uteis']],
  ['Integrações', ['integra', 'mercado livre', 'shopee', 'amazon', 'shopify', 'magalu', 'erp', 'tiny', 'bling', 'marketplace', 'woocommerce']],
  ['Políticas', ['politica', 'regra', 'restricao', 'obrigat', 'fifo', 'validade', 'nao pode', 'lgpd']],
  ['Serviços', ['servico', 'armazenagem', 'picking', 'packing', 'expedicao', 'fulfillment', 'devolucao', 'estoque']],
  ['Atendimento humano', ['humano', 'atendente', 'equipe', 'escal', 'transfer']],
  ['Objeções', ['caro', 'concorrente', 'desconto', 'pensar']],
  ['Empresa', ['empresa', 'quem somos', 'fundada', 'endereco', 'localiza', 'sobre a']],
]
function categorize(text: string): string {
  const t = norm(text || '')
  for (const [cat, kws] of CATS) if (kws.some(k => t.includes(k))) return cat
  return 'Geral'
}
const catCor: Record<string, string> = {
  'Preços': 'var(--c-green)', 'Prazos': 'var(--c-yellow)', 'Integrações': 'var(--c-blue-b)',
  'Políticas': 'var(--c-yellow)', 'Serviços': 'var(--c-blue-b)', 'Produtos não atendidos': 'var(--c-red)',
  'Atendimento humano': 'var(--c-blue-b)', 'Objeções': 'var(--c-yellow)', 'Empresa': 'var(--c-muted)', 'Geral': 'var(--c-muted)',
}
const impactoDe: Record<string, string> = {
  'Produtos não atendidos': 'Evita prometer atendimento para segmentos inadequados.',
  'Preços': 'Garante respostas corretas sobre valores e condições.',
  'Prazos': 'Mantém prazos e horários precisos nas respostas.',
  'Integrações': 'Esclarece com quais sistemas o agente integra.',
  'Políticas': 'Mantém as regras de atendimento consistentes.',
  'Serviços': 'Descreve corretamente o que é oferecido.',
  'Atendimento humano': 'Define quando acionar a equipe.',
  'Geral': 'Melhora a precisão das respostas do agente.',
}
function confianca(s: Suggestion): { label: string; cor: string } {
  const len = (s.reason || '').length
  if (s.reason && len > 60) return { label: 'Alta confiança', cor: 'var(--c-green)' }
  if (s.reason) return { label: 'Média confiança', cor: 'var(--c-yellow)' }
  return { label: 'Baixa confiança', cor: 'var(--c-muted)' }
}
const tituloDe = (text: string) => { const w = String(text).trim().split(/\s+/).slice(0, 7).join(' '); return w + (text.trim().split(/\s+/).length > 7 ? '…' : '') }
const isDoc = (c: string) => /^\[.+?\]/.test(c)
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

function Badge({ children, cor }: { children: React.ReactNode; cor: string }) {
  return <span style={{ fontFamily: FONT.jb, fontSize: 8.5, letterSpacing: '0.05em', color: cor, padding: '3px 8px', borderRadius: 100, background: `color-mix(in oklch, ${cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 28%, transparent)` }}>{children}</span>
}

export function KnowledgeManager({ agentId, central = false }: { agentId: string; central?: boolean }) {
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [novo, setNovo] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [busy, setBusy] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editSug, setEditSug] = useState<string>('')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importErr, setImportErr] = useState('')
  const [busca, setBusca] = useState('')
  const [showFull, setShowFull] = useState(!central)
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    const [{ data: kb }, { data: sug }] = await Promise.all([
      supabase.from('knowledge_base').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }),
      supabase.from('knowledge_suggestions').select('*').eq('agent_id', agentId).eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setItems(kb ?? []); setSuggestions(sug ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function adicionar() {
    const content = novo.trim(); if (!content || saving) return
    setSaving(true)
    await supabase.from('knowledge_base').insert({ agent_id: agentId, content, active: true })
    setNovo(''); setSaving(false); setShowAdd(false); load()
  }
  async function ingest(payload: any, descricao: string) {
    setImporting(true); setImportErr(''); setImportMsg('')
    try {
      const res = await fetch('/api/knowledge/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: agentId, ...payload }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha na importação.')
      setImportMsg(`✓ ${descricao}: ${data.inserted} item(ns) adicionado(s).`); load()
    } catch (e: any) { setImportErr(e.message) }
    setImporting(false)
  }
  function importarArquivo(file: File) {
    if (file.size > 8 * 1024 * 1024) { setImportErr('Arquivo muito grande (máx. 8 MB).'); return }
    const reader = new FileReader()
    reader.onload = () => ingest({ kind: 'file', fileName: file.name, fileData: String(reader.result).split(',')[1] || '' }, file.name)
    reader.readAsDataURL(file)
  }
  async function importarUrl() { const url = importUrl.trim(); if (!url) return; await ingest({ kind: 'url', url }, 'Link'); setImportUrl('') }
  async function toggle(item: Item) { await supabase.from('knowledge_base').update({ active: !item.active, updated_at: new Date().toISOString() }).eq('id', item.id); load() }
  async function remover(id: string) { await supabase.from('knowledge_base').delete().eq('id', id); load() }
  async function salvarEdicao(id: string) { const content = editText.trim(); if (!content) return; await supabase.from('knowledge_base').update({ content, updated_at: new Date().toISOString() }).eq('id', id); setEditId(null); setEditText(''); load() }
  async function aprovar(s: Suggestion) {
    const content = (drafts[s.id] ?? s.content).trim(); if (!content) return
    setBusy(s.id)
    await supabase.from('knowledge_base').insert({ agent_id: agentId, content, active: true })
    await supabase.from('knowledge_suggestions').update({ status: 'approved' }).eq('id', s.id)
    setBusy(''); load()
  }
  async function descartar(s: Suggestion) { setBusy(s.id); await supabase.from('knowledge_suggestions').update({ status: 'rejected' }).eq('id', s.id); setBusy(''); load() }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 0', ...T.sub }} className="animate-pulse-dot">Carregando…</div>

  // Derivados
  const ativos = items.filter(i => i.active).length
  const documentos = items.filter(i => isDoc(i.content)).length
  const ultimaAtt = items.length ? items.map(i => i.updated_at || i.created_at).sort().slice(-1)[0] : null
  const hojeKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const aprovadasHoje = items.filter(i => new Date(i.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === hojeKey).length
  const termo = busca.trim().toLowerCase()
  const itemsFiltrados = termo ? items.filter(i => i.content.toLowerCase().includes(termo)) : items
  const recentes = items.slice(0, 5)

  // Categorias dos itens ativos
  const catCount: Record<string, number> = {}
  for (const i of items) if (i.active) { const c = categorize(i.content); catCount[c] = (catCount[c] ?? 0) + 1 }
  const categorias = Object.entries(catCount).sort((a, b) => b[1] - a[1])

  // ── Blocos reutilizáveis ──
  const renderSugestao = (s: Suggestion, rich: boolean) => {
    const cat = categorize(drafts[s.id] ?? s.content)
    const conf = confianca(s)
    const editing = editSug === s.id || !rich
    return (
      <div key={s.id} style={{ background: C.deep, border: `1px solid ${C.borderHi}`, borderRadius: 12, padding: '16px 18px' }}>
        {rich && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white }}>{tituloDe(drafts[s.id] ?? s.content)}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge cor={catCor[cat] ?? C.muted}>{cat}</Badge>
              <Badge cor={conf.cor}>{conf.label}</Badge>
              <Badge cor={editSug === s.id ? 'var(--c-yellow)' : 'var(--c-blue-b)'}>{editSug === s.id ? 'Em revisão' : 'Nova'}</Badge>
            </div>
          </div>
        )}
        {s.reason && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Motivo detectado</p>
            <p style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{s.reason}</p>
          </div>
        )}
        <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 6 }}>Sugestão para a base</p>
        {editing ? (
          <textarea className="field" rows={3} value={drafts[s.id] ?? s.content} onChange={e => setDrafts({ ...drafts, [s.id]: e.target.value })} style={{ marginBottom: 10 }} />
        ) : (
          <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
            <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 300, lineHeight: 1.55 }}>{drafts[s.id] ?? s.content}</p>
          </div>
        )}
        {rich && <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 12 }}>Impacto: <span style={{ color: C.muted, textTransform: 'none', letterSpacing: 0, fontFamily: FONT.dm }}>{impactoDe[cat] ?? impactoDe['Geral']}</span></p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => aprovar(s)} disabled={!!busy} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>{busy === s.id ? '…' : 'Aprovar'}</button>
          {rich && <button onClick={() => setEditSug(editSug === s.id ? '' : s.id)} className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }}>{editSug === s.id ? 'Concluir edição' : 'Editar'}</button>}
          <button onClick={() => descartar(s)} disabled={!!busy} className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }}>Descartar</button>
          {rich && <a href="/painel/conversas" style={{ fontFamily: FONT.jb, fontSize: 11, color: C.blueB, marginLeft: 'auto' }}>Ver origem →</a>}
        </div>
      </div>
    )
  }

  const importBlock = (
    <div style={CARD}>
      <h3 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 4 }}>Arquivos e documentos</h3>
      <p style={{ ...T.sub, fontSize: 12.5, marginBottom: 14 }}>Envie PDFs, planilhas, catálogos ou links para atualizar o conhecimento do agente. A IA extrai o texto automaticamente.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn-ghost" style={{ fontSize: 13, padding: '10px 16px', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.5 : 1 }}>
          {importing ? 'Importando…' : '📎 Enviar arquivo'}
          <input type="file" accept=".pdf,.txt,.csv,.md,.tsv" disabled={importing} onChange={e => { const f = e.target.files?.[0]; if (f) importarArquivo(f); e.currentTarget.value = '' }} style={{ display: 'none' }} />
        </label>
        <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>ou</span>
        <input className="field" value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://seusite.com.br/precos" disabled={importing} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); importarUrl() } }} style={{ flex: 1, minWidth: 180 }} />
        <button onClick={importarUrl} disabled={importing || !importUrl.trim()} className="btn-primary" style={{ fontSize: 13 }}>Adicionar URL</button>
      </div>
      {importMsg && <p style={{ color: C.green, fontFamily: FONT.dm, fontSize: 13, marginTop: 12 }}>{importMsg}</p>}
      {importErr && <p style={{ color: C.red, fontFamily: FONT.dm, fontSize: 13, marginTop: 12 }}>{importErr}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint }}>Formatos: PDF, DOCX, XLSX, CSV, TXT · máx. 8 MB. (DOCX/XLSX: exporte como PDF/CSV.)</p>
        <p style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint }}>Última atualização: {fmt(ultimaAtt)}</p>
      </div>
    </div>
  )

  const manualBlock = (
    <div style={CARD}>
      <label style={T.label}>Adicionar informação manual</label>
      <textarea className="field" rows={2} placeholder='Ex: "Entregamos em até 3 dias úteis para todo o Brasil."' value={novo} onChange={e => setNovo(e.target.value)} style={{ margin: '8px 0 12px' }} />
      <button onClick={adicionar} disabled={saving || !novo.trim()} className="btn-primary" style={{ opacity: saving || !novo.trim() ? 0.5 : 1, fontSize: 13 }}>{saving ? 'Adicionando…' : 'Adicionar'}</button>
    </div>
  )

  const itemRow = (item: Item) => (
    <div key={item.id} style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', opacity: item.active ? 1 : 0.55 }}>
      {editId === item.id ? (
        <div>
          <textarea className="field" rows={3} value={editText} onChange={e => setEditText(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => salvarEdicao(item.id)} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>Salvar</button>
            <button onClick={() => { setEditId(null); setEditText('') }} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <Badge cor={catCor[categorize(item.content)] ?? C.muted}>{categorize(item.content)}</Badge>
              {isDoc(item.content) && <Badge cor="var(--c-blue-b)">Documento</Badge>}
            </div>
            <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, lineHeight: 1.55, fontWeight: 300 }}>{item.content.replace(/^\[[^\]]+\]\s*/, '')}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => toggle(item)} title={item.active ? 'Ativo' : 'Inativo'} style={{ ...T.mono, fontSize: 9, padding: '4px 10px', borderRadius: 100, cursor: 'pointer', color: item.active ? C.green : C.muted, background: item.active ? 'rgba(34,197,94,0.1)' : 'rgba(80,130,210,0.08)', border: `1px solid ${item.active ? 'rgba(34,197,94,0.25)' : C.border}` }}>{item.active ? 'ATIVO' : 'INATIVO'}</button>
            <button onClick={() => { setEditId(item.id); setEditText(item.content) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: FONT.jb, fontSize: 11 }}>editar</button>
            <button onClick={() => remover(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontFamily: FONT.jb, fontSize: 11 }}>remover</button>
          </div>
        </div>
      )}
    </div>
  )

  // ───────── ADMIN (simples) ─────────
  if (!central) {
    return (
      <div>
        {suggestions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 12 }}>Sugestões do agente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{suggestions.map(s => renderSugestao(s, false))}</div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>{importBlock}</div>
        <div style={{ marginBottom: 16 }}>{manualBlock}</div>
        {items.length === 0 ? (
          <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhum conhecimento cadastrado.</div>
        ) : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{items.map(itemRow)}</div>}
      </div>
    )
  }

  // ───────── CLIENTE (central, 2 colunas) ─────────
  const cards = [
    { label: 'Sugestões novas', value: suggestions.length, cor: 'var(--c-blue-b)', desc: 'Informações detectadas pela IA que aguardam revisão.' },
    { label: 'Itens ativos', value: ativos, cor: 'var(--c-green)', desc: 'Fatos aprovados usados nas respostas do agente.' },
    { label: 'Arquivos enviados', value: documentos, cor: 'var(--c-blue-b)', desc: 'Documentos que alimentam a base de conhecimento.' },
    { label: 'Última atualização', value: ultimaAtt ? fmt(ultimaAtt).slice(0, 5) : '—', cor: 'var(--c-muted)', desc: 'Quando a base foi modificada pela última vez.', small: true },
  ]
  const saude = [
    { k: 'Informações críticas', v: items.length ? 'OK' : 'Atenção', cor: items.length ? 'var(--c-green)' : 'var(--c-yellow)' },
    { k: 'Preços atualizados', v: catCount['Preços'] ? 'OK' : 'Atenção', cor: catCount['Preços'] ? 'var(--c-green)' : 'var(--c-yellow)' },
    { k: 'Documentos enviados', v: documentos ? 'OK' : 'Nenhum', cor: documentos ? 'var(--c-green)' : 'var(--c-muted)' },
    { k: 'Sugestões pendentes', v: String(suggestions.length), cor: suggestions.length ? 'var(--c-yellow)' : 'var(--c-green)' },
  ]
  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties

  return (
    <div>
      {/* Cards de resumo */}
      <div className="kb-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: c.small ? 18 : 30, color: c.cor, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{c.value}</p>
            <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="kb-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        {/* ESQUERDA */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sugestões da IA */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Sugestões da IA</h2>
              {suggestions.length > 0 && <Badge cor="var(--c-blue-b)">{suggestions.length} nova{suggestions.length > 1 ? 's' : ''}</Badge>}
            </div>
            <p style={{ ...T.sub, fontSize: 12.5, marginBottom: 14 }}>A IA encontrou informações recorrentes nas conversas. Revise antes de aprovar para evitar respostas incorretas.</p>
            {suggestions.length === 0 ? (
              <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px' }}>
                <p style={{ fontSize: 26, marginBottom: 10 }}>✅</p>
                <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white }}>Tudo atualizado por aqui.</p>
                <p style={{ ...T.sub, marginTop: 4 }}>A IA ainda não encontrou novas informações para sugerir. Envie documentos, adicione uma URL ou cadastre uma informação manualmente.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                  <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ fontSize: 12 }}>Adicionar informação</button>
                </div>
              </div>
            ) : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{suggestions.map(s => renderSugestao(s, true))}</div>}
          </div>

          {/* Base de conhecimento ativa */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Base de conhecimento ativa</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAdd(s => !s)} className="btn-ghost" style={{ fontSize: 11, padding: '7px 12px' }}>+ Informação manual</button>
                <button onClick={() => setShowFull(s => !s)} className="btn-ghost" style={{ fontSize: 11, padding: '7px 12px' }}>{showFull ? 'Ocultar base' : 'Ver base completa'}</button>
              </div>
            </div>
            <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>O que já foi aprovado e o agente usa nas respostas.</p>
            {showAdd && <div style={{ marginBottom: 16 }}>{manualBlock}</div>}
            {categorias.length === 0 ? (
              <p style={{ ...T.sub, fontSize: 13 }}>Nenhuma informação ativa ainda. Aprove sugestões ou adicione manualmente.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                {categorias.map(([cat, n]) => (
                  <div key={cat} style={{ background: C.void, border: `1px solid color-mix(in oklch, ${catCor[cat] ?? C.muted} 22%, var(--c-border))`, borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: catCor[cat] ?? C.muted, lineHeight: 1 }}>{n}</p>
                    <p style={{ ...T.mono, fontSize: 9, color: C.muted, marginTop: 6 }}>{cat}</p>
                  </div>
                ))}
              </div>
            )}
            {showFull && items.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <input className="field" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na base…" style={{ marginBottom: 12 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{itemsFiltrados.map(itemRow)}</div>
              </div>
            )}
          </div>

          {/* Arquivos e documentos */}
          {importBlock}

          {/* Histórico recente */}
          {recentes.length > 0 && (
            <div style={CARD}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 12 }}>Histórico recente</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentes.map(i => (
                  <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ ...T.mono, fontSize: 9, color: C.faint, flexShrink: 0, width: 80 }}>{fmt(i.updated_at || i.created_at).slice(0, 5)}</span>
                    <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, fontWeight: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.content.replace(/^\[[^\]]+\]\s*/, '')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={CARD}>
            <h2 style={sideTitle}>Resumo do conhecimento</h2>
            {[[`${suggestions.length} sugestões novas`, 'var(--c-blue-b)'], [`${aprovadasHoje} aprovadas hoje`, 'var(--c-green)'], [`Base ativa: ${ativos} itens`, 'var(--c-green)'], [`Arquivos enviados: ${documentos}`, 'var(--c-blue-b)'], [`Última atualização: ${fmt(ultimaAtt)}`, 'var(--c-muted)']].map(([t, c], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c as string, flexShrink: 0 }} />
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Saúde da base</h2>
            {saude.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < saude.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{s.k}</span>
                <Badge cor={s.cor}>{s.v}</Badge>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Categorias</h2>
            {categorias.length === 0 ? <p style={{ ...T.sub, fontSize: 13 }}>Sem itens ainda.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categorias.map(([cat, n]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: catCor[cat] ?? C.muted }} /><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white }}>{cat}</span></span>
                    <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted, background: 'rgba(80,130,210,0.1)', border: `1px solid ${C.border}`, borderRadius: 100, padding: '2px 8px' }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Ações rápidas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => setShowAdd(true)} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Adicionar informação<span style={{ color: C.faint }}>+</span></button>
              <button onClick={() => setShowFull(true)} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Ver base completa<span style={{ color: C.faint }}>→</span></button>
              <a href="/painel/conversas" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Revisar conversas<span style={{ color: C.faint }}>→</span></a>
              <a href="/painel/assistente" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Falar com o Copiloto<span style={{ color: C.faint }}>→</span></a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px){ .kb-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 680px){ .kb-cards{ grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}
