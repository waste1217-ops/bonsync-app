'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { C, T, FONT } from '@/lib/styles'

/* Renderiza Markdown da IA com estilos do tema escuro */
const MD = {
  p:  (p: any) => <p style={{ margin: '0 0 10px', lineHeight: 1.7 }} {...p} />,
  h1: (p: any) => <h1 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 19, color: C.white, margin: '16px 0 8px' }} {...p} />,
  h2: (p: any) => <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 17, color: C.white, margin: '16px 0 8px' }} {...p} />,
  h3: (p: any) => <h3 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, margin: '14px 0 6px' }} {...p} />,
  strong: (p: any) => <strong style={{ color: C.white, fontWeight: 700 }} {...p} />,
  em: (p: any) => <em style={{ fontStyle: 'italic' }} {...p} />,
  ul: (p: any) => <ul style={{ margin: '0 0 10px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }} {...p} />,
  ol: (p: any) => <ol style={{ margin: '0 0 10px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }} {...p} />,
  li: (p: any) => <li style={{ lineHeight: 1.6 }} {...p} />,
  a:  (p: any) => <a style={{ color: C.blueB, textDecoration: 'underline' }} target="_blank" rel="noreferrer" {...p} />,
  code: (p: any) => p.inline
    ? <code style={{ fontFamily: FONT.jb, fontSize: 12.5, background: 'rgba(80,130,210,0.12)', padding: '1px 6px', borderRadius: 4, color: C.blueB }} {...p} />
    : <code style={{ fontFamily: FONT.jb, fontSize: 12.5 }} {...p} />,
  pre: (p: any) => <pre style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, overflowX: 'auto', margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.6 }} {...p} />,
  blockquote: (p: any) => <blockquote style={{ borderLeft: `2px solid ${C.borderHi}`, paddingLeft: 14, margin: '0 0 10px', color: C.muted }} {...p} />,
  table: (p: any) => <div style={{ overflowX: 'auto', margin: '0 0 10px' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }} {...p} /></div>,
  th: (p: any) => <th style={{ border: `1px solid ${C.border}`, padding: '8px 10px', textAlign: 'left', color: C.white, fontFamily: FONT.jb, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(80,130,210,0.06)' }} {...p} />,
  td: (p: any) => <td style={{ border: `1px solid ${C.border}`, padding: '8px 10px', color: C.muted }} {...p} />,
  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '14px 0' }} />,
}

interface Attachment {
  kind: 'text' | 'pdf' | 'image'
  name: string
  text?: string
  data?: string
  media_type?: string
}
interface Msg { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Resuma os pontos principais deste arquivo',
  'Quais os números mais importantes aqui?',
  'Liste os itens com problemas ou pendências',
  'Crie um resumo executivo em tópicos',
]

export function Copiloto() {
  const [messages, setMessages]       = useState<Msg[]>([])
  const [input, setInput]             = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading]         = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState('')
  const [carregando, setCarregando]   = useState(true)
  const fileRef  = useRef<HTMLInputElement>(null)
  const endRef   = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Carrega o histórico salvo ao abrir
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/assistant/history', { cache: 'no-store' })
        if (res.ok) { const d = await res.json(); setMessages(d.messages ?? []) }
      } catch {}
      setCarregando(false)
    })()
  }, [])

  async function novaConversa() {
    if (!confirm('Limpar esta conversa? O histórico será apagado.')) return
    await fetch('/api/assistant/history', { method: 'DELETE' })
    setMessages([]); setAttachments([]); setError('')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setUploading(true)
    try {
      const dataBase64 = await fileToBase64(file)
      const res = await fetch('/api/assistant/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, dataBase64 }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar arquivo.'); setUploading(false); return }
      setAttachments(prev => [...prev, data])
    } catch {
      setError('Falha ao ler o arquivo.')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return
    setError('')
    const newMessages = [...messages, { role: 'user' as const, content }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, attachments }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro.')
        setLoading(false)
        return
      }
      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch {
      setError('Erro de conexão.')
    }
    setLoading(false)
  }

  const empty = messages.length === 0

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={T.h1}>Copiloto</h1>
          <p style={{ ...T.sub, marginTop: 4 }}>
            Pergunte sobre seus dados, envie planilhas e documentos. O histórico fica salvo.
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={novaConversa} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px', whiteSpace: 'nowrap' }}>
            Nova conversa
          </button>
        )}
      </div>

      {/* Anexos */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {attachments.map((a, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${C.borderHi}`, borderRadius: 100, padding: '6px 12px', fontFamily: FONT.dm, fontSize: 13, color: C.white }}>
              <span style={{ color: C.blueB }}>📎</span>
              {a.name}
              <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Área de mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, minHeight: 0 }}>
        {empty ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
            <p style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 18, color: C.white, marginBottom: 8 }}>
              Como posso ajudar hoje?
            </p>
            <p style={{ ...T.sub, maxWidth: 420, margin: '0 auto 28px' }}>
              Anexe um arquivo no botão abaixo e faça uma pergunta, ou comece com uma sugestão:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420, margin: '0 auto' }}>
              {SUGESTOES.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{ fontFamily: FONT.dm, fontSize: 14, color: C.muted, background: C.deep, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHi; e.currentTarget.style.color = C.white }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.role === 'user' ? 'rgba(80,130,210,0.12)' : 'oklch(55% 0.24 225/0.2)', border: `1px solid ${m.role === 'user' ? C.border : C.borderHi}` }}>
                  <span style={{ fontFamily: FONT.jb, fontSize: 9, color: m.role === 'user' ? C.muted : C.blueB }}>{m.role === 'user' ? 'EU' : 'IA'}</span>
                </div>
                <div style={{ maxWidth: '78%', background: m.role === 'user' ? C.surface : C.deep, border: `1px solid ${m.role === 'user' ? C.border : C.borderHi}`, borderRadius: m.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px', padding: '12px 16px' }}>
                  {m.role === 'user' ? (
                    <p style={{ fontFamily: FONT.dm, fontSize: 14.5, color: C.white, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap', margin: 0 }}>{m.content}</p>
                  ) : (
                    <div style={{ fontFamily: FONT.dm, fontSize: 14.5, color: C.white, fontWeight: 300 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{m.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(55% 0.24 225/0.2)', border: `1px solid ${C.borderHi}` }}>
                  <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.blueB }}>IA</span>
                </div>
                <span style={{ fontFamily: FONT.jb, fontSize: 12, color: C.muted }} className="animate-pulse-dot">analisando…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <input ref={fileRef} type="file" onChange={handleFile} style={{ display: 'none' }}
          accept=".xlsx,.xls,.csv,.tsv,.txt,.md,.json,.log,.docx,.pdf,.png,.jpg,.jpeg,.webp,.gif" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          title="Anexar arquivo"
          style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, background: C.deep, border: `1px solid ${C.border}`, color: C.blueB, cursor: uploading ? 'wait' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {uploading ? '…' : '+'}
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Pergunte algo sobre seus arquivos…"
          rows={1}
          className="field"
          style={{ resize: 'none', minHeight: 44, maxHeight: 140, padding: '12px 14px' }}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          className="btn-primary"
          style={{ height: 44, flexShrink: 0, opacity: loading || !input.trim() ? 0.5 : 1 }}>
          Enviar
        </button>
      </div>
      <p style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint, marginTop: 8, textAlign: 'center' }}>
        Suporta planilhas (xlsx/csv), PDF, Word, texto e imagens · máx. 4 MB por arquivo
      </p>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // remove o prefixo data:...;base64,
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
