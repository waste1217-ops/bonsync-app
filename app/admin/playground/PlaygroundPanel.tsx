'use client'

import { useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

interface AgenteOpt { id: string; nome: string; empresa: string; model: string; prompt: string }
interface Msg { role: 'user' | 'assistant'; content: string; usage?: { input: number; output: number } }

const MODELOS = [
  { value: 'claude-opus-4-5',   label: 'Opus 4.5' },
  { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
  { value: 'claude-haiku-3-5',  label: 'Haiku 3.5' },
]

interface Lado {
  model: string
  system: string
  msgs: Msg[]
  loading: boolean
}

const ladoVazio = (): Lado => ({ model: 'claude-sonnet-4-5', system: '', msgs: [], loading: false })

export function PlaygroundPanel({ agentes }: { agentes: AgenteOpt[] }) {
  const [compare, setCompare] = useState(false)
  const [input, setInput] = useState('')
  const [A, setA] = useState<Lado>(ladoVazio())
  const [B, setB] = useState<Lado>(ladoVazio())
  const [error, setError] = useState('')

  function carregar(setter: (l: Lado) => void, atual: Lado, agentId: string) {
    const ag = agentes.find(a => a.id === agentId)
    if (!ag) return
    setter({ ...atual, model: ag.model, system: ag.prompt, msgs: [] })
  }

  async function enviar() {
    const texto = input.trim()
    if (!texto) return
    setError(''); setInput('')

    const userMsg: Msg = { role: 'user', content: texto }
    const lados: { lado: Lado; set: (l: Lado) => void }[] = [{ lado: A, set: setA }]
    if (compare) lados.push({ lado: B, set: setB })

    // adiciona a mensagem do usuário + estado de loading em cada lado
    lados.forEach(({ lado, set }) => set({ ...lado, msgs: [...lado.msgs, userMsg], loading: true }))

    await Promise.all(lados.map(async ({ lado, set }) => {
      const historico = [...lado.msgs, userMsg].map(m => ({ role: m.role, content: m.content }))
      try {
        const res = await fetch('/api/admin/playground', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: lado.model, system: lado.system, messages: historico }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro')
        set({ ...lado, msgs: [...lado.msgs, userMsg, { role: 'assistant', content: data.reply, usage: data.usage }], loading: false })
      } catch (e: any) {
        set({ ...lado, msgs: [...lado.msgs, userMsg, { role: 'assistant', content: `⚠️ ${e.message}` }], loading: false })
      }
    }))
  }

  function limpar() {
    setA({ ...A, msgs: [] }); setB({ ...B, msgs: [] }); setError('')
  }

  return (
    <div>
      {/* Barra de modo */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setCompare(false)} className={compare ? 'btn-ghost' : 'btn-primary'} style={{ fontSize: 12, padding: '8px 16px' }}>Teste único</button>
        <button onClick={() => setCompare(true)} className={compare ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 12, padding: '8px 16px' }}>Comparar A/B</button>
        <div style={{ flex: 1 }} />
        <button onClick={limpar} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>Limpar conversa</button>
      </div>

      {/* Configs */}
      <div style={{ display: 'grid', gridTemplateColumns: compare ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>
        <LadoConfig titulo={compare ? 'Versão A' : 'Configuração'} lado={A} setLado={setA} agentes={agentes}
          onCarregar={id => carregar(setA, A, id)} />
        {compare && (
          <LadoConfig titulo="Versão B" lado={B} setLado={setB} agentes={agentes}
            onCarregar={id => carregar(setB, B, id)} />
        )}
      </div>

      {/* Transcrições */}
      <div style={{ display: 'grid', gridTemplateColumns: compare ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>
        <Transcript lado={A} />
        {compare && <Transcript lado={B} />}
      </div>

      {error && <p style={{ color: C.red, fontFamily: FONT.dm, fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {/* Input compartilhado */}
      <div style={{ display: 'flex', gap: 10 }}>
        <input className="field" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder="Digite uma mensagem como se fosse o cliente final…" style={{ flex: 1 }} />
        <button onClick={enviar} disabled={A.loading || B.loading} className="btn-primary" style={{ fontSize: 13 }}>
          {(A.loading || B.loading) ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

function LadoConfig({ titulo, lado, setLado, agentes, onCarregar }: {
  titulo: string; lado: Lado; setLado: (l: Lado) => void; agentes: AgenteOpt[]; onCarregar: (id: string) => void
}) {
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white }}>{titulo}</h3>
        <select className="field" defaultValue="" onChange={e => { onCarregar(e.target.value); e.target.value = '' }}
          style={{ width: 'auto', fontSize: 11, padding: '6px 10px' }}>
          <option value="">Carregar de um agente…</option>
          {agentes.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.empresa})</option>)}
        </select>
      </div>
      <div>
        <label style={T.label}>Modelo</label>
        <select className="field" value={lado.model} onChange={e => setLado({ ...lado, model: e.target.value })}>
          {MODELOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <label style={T.label}>Prompt do sistema</label>
        <textarea className="field" rows={6} value={lado.system} onChange={e => setLado({ ...lado, system: e.target.value })}
          placeholder="Instruções do agente para este teste…" />
      </div>
    </div>
  )
}

function Transcript({ lado }: { lado: Lado }) {
  if (!lado.msgs.length && !lado.loading) {
    return (
      <div style={{ ...CARD, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ ...T.sub, fontSize: 13 }}>A conversa de teste aparece aqui.</p>
      </div>
    )
  }
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 460, overflowY: 'auto' }}>
      {lado.msgs.map((m, i) => {
        const isUser = m.role === 'user'
        return (
          <div key={i} style={{ display: 'flex', flexDirection: isUser ? 'row' : 'row-reverse' }}>
            <div style={{
              maxWidth: '85%',
              background: isUser ? C.surface : 'oklch(28% 0.2 225/0.28)',
              border: `1px solid ${isUser ? C.border : C.borderHi}`,
              borderRadius: isUser ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
              padding: '10px 14px',
            }}>
              <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, lineHeight: 1.6, fontWeight: 300, whiteSpace: 'pre-wrap' }}>{m.content}</p>
              {m.usage && (
                <p style={{ ...T.mono, fontSize: 8, color: C.faint, marginTop: 6 }}>
                  {m.usage.input}↑ {m.usage.output}↓ tokens
                </p>
              )}
            </div>
          </div>
        )
      })}
      {lado.loading && <p style={{ ...T.sub, fontSize: 12 }} className="animate-pulse-dot">Gerando resposta…</p>}
    </div>
  )
}
