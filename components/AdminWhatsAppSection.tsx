'use client'

import { useEffect, useRef, useState } from 'react'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'

type St = 'conectado' | 'aguardando' | 'desconectado' | 'error' | 'desconhecido' | string

const stMeta: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'muted' }> = {
  conectado:    { label: 'Conectado',          variant: 'green' },
  aguardando:   { label: 'Aguardando leitura', variant: 'yellow' },
  desconectado: { label: 'Desconectado',       variant: 'muted' },
  error:        { label: 'Erro',               variant: 'red' },
}
const metaOf = (s: St) => stMeta[s] || { label: 'Desconhecido', variant: 'muted' as const }
const fmtDateTime = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

async function call(action: string, clientId: string, extra: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/whatsapp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, action, ...extra }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

export function AdminWhatsAppSection({ clientId, clientEmail, lastConnection: initialLast }: {
  clientId: string; clientEmail: string | null; lastConnection: string | null
}) {
  const [status, setStatus] = useState<St>('desconhecido')
  const [numero, setNumero] = useState<string | null>(null)
  const [lastConnection, setLast] = useState<string | null>(initialLast)
  const [modal, setModal] = useState(false)
  const [qr, setQr] = useState('')
  const [qrState, setQrState] = useState<'loading' | 'qr' | 'error'>('loading')
  const [qrErr, setQrErr] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailVal, setEmailVal] = useState(clientEmail || '')
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState('')
  const alive = useRef(true)

  async function loadStatus() {
    const { ok, data } = await call('status', clientId)
    if (!alive.current || !ok) return
    setStatus(data.status); setNumero(data.number ?? null)
    if (data.lastConnection) setLast(data.lastConnection)
  }

  useEffect(() => {
    alive.current = true
    loadStatus()
    return () => { alive.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling de status enquanto o modal de QR está aberto
  useEffect(() => {
    if (!modal) return
    const t = setInterval(loadStatus, 4000)
    const q = setInterval(() => { if (status !== 'conectado') gerarQr('new-qr', true) }, 22000)
    return () => { clearInterval(t); clearInterval(q) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, status])

  async function gerarQr(action: 'qr' | 'new-qr' = 'qr', silent = false) {
    setModal(true)
    if (!silent) { setQrState('loading'); setQr(''); setQrErr('') }
    const { ok, data } = await call(action, clientId)
    if (!alive.current) return
    if (!ok) { setQrState('error'); setQrErr(data.error || 'Não foi possível gerar o QR Code.'); return }
    if (data.status) setStatus(data.status)
    if (data.qr) { setQr(data.qr); setQrState('qr') }
    else if (!silent) setQrState('loading')
  }

  async function desconectar() {
    if (!confirm('Desconectar o WhatsApp deste cliente? O agente para de responder até reconectar.')) return
    setBusy('disc')
    const { ok, data } = await call('disconnect', clientId)
    setBusy('')
    if (!ok) { setEmailMsg({ ok: false, text: data.error || 'Falha ao desconectar.' }); return }
    setStatus('desconectado'); setNumero(null); setLast(null)
  }

  async function enviarEmail() {
    const dest = (emailVal || clientEmail || '').trim()
    if (!dest) { setEmailOpen(true); setEmailMsg({ ok: false, text: 'Informe um e-mail para enviar o QR Code.' }); return }
    setBusy('email'); setEmailMsg(null)
    const { ok, data } = await call('send-qr', clientId, { email: dest })
    setBusy('')
    if (!ok) { setEmailMsg({ ok: false, text: data.error || 'Não foi possível enviar o e-mail.' }); return }
    setEmailMsg({ ok: true, text: `QR Code enviado para ${data.email}.` }); setEmailOpen(false)
  }

  const meta = metaOf(status)
  const conectado = status === 'conectado'
  const qrSrc = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`

  return (
    <div style={{ ...CARD, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Conexão WhatsApp</h2>
          <span style={badgeStyle(meta.variant)}>{meta.label}</span>
          <button onClick={loadStatus} title="Atualizar status" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, fontSize: 13 }}>↻</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        {numero && <div><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Número</p><p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{numero}</p></div>}
        <div><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Última conexão</p><p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{fmtDateTime(lastConnection) || '—'}</p></div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => gerarQr('qr')} className="btn-primary" style={{ fontSize: 13 }}>Gerar QR Code</button>
        <button onClick={enviarEmail} disabled={busy === 'email'} className="btn-ghost" style={{ fontSize: 13 }}>{busy === 'email' ? 'Enviando…' : 'Enviar QR Code por e-mail'}</button>
        {conectado && <button onClick={desconectar} disabled={busy === 'disc'} className="btn-ghost" style={{ fontSize: 13, color: C.red, borderColor: 'rgba(232,64,64,0.3)' }}>{busy === 'disc' ? '…' : 'Desconectar WhatsApp'}</button>}
      </div>

      {(emailOpen || (emailMsg && !emailMsg.ok)) && !clientEmail && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="field" type="email" placeholder="email@cliente.com.br" value={emailVal} onChange={e => setEmailVal(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button onClick={enviarEmail} disabled={busy === 'email'} className="btn-primary" style={{ fontSize: 12 }}>Enviar</button>
        </div>
      )}
      {emailMsg && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontFamily: FONT.dm, fontSize: 13, fontWeight: 300,
          background: emailMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(232,64,64,0.08)',
          border: `1px solid ${emailMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(232,64,64,0.25)'}`,
          color: emailMsg.ok ? C.green : C.red,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>{emailMsg.ok ? '✓ ' : '⚠ '}{emailMsg.text}</span>
          {!emailMsg.ok && <button onClick={enviarEmail} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}>Tentar novamente</button>}
        </div>
      )}

      {/* Modal do QR */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'oklch(10% 0.03 250 / 0.7)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: C.deep, border: `1px solid ${C.borderHi}`, borderRadius: 16, padding: 24, position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setModal(false)} aria-label="Fechar" style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>

            {conectado ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 42, marginBottom: 10 }}>✅</div>
                <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 6 }}>WhatsApp conectado!</p>
                <p style={{ ...T.sub, fontSize: 13 }}>{numero ? `Número ${numero} vinculado.` : 'Conexão estabelecida.'}</p>
                <button onClick={() => setModal(false)} className="btn-primary" style={{ fontSize: 13, marginTop: 18 }}>Concluir</button>
              </div>
            ) : qrState === 'error' ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
                <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 16, color: C.white, marginBottom: 6 }}>Falha ao gerar o QR Code</p>
                <p style={{ ...T.sub, fontSize: 13, marginBottom: 16 }}>{qrErr}</p>
                <button onClick={() => gerarQr('qr')} className="btn-primary" style={{ fontSize: 13 }}>Tentar novamente</button>
              </div>
            ) : (
              <>
                <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 16, color: C.white, marginBottom: 6 }}>Conectar WhatsApp</p>
                <p style={{ ...T.sub, fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>WhatsApp → Aparelhos conectados → Conectar aparelho, e aponte para o código.</p>
                {qrState === 'qr' && qr ? (
                  <div style={{ background: '#fff', borderRadius: 14, padding: 12, display: 'inline-block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrSrc} alt="QR Code do WhatsApp" style={{ width: 230, height: 230, display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ height: 254, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <span className="animate-pulse-dot" style={{ width: 14, height: 14, borderRadius: '50%', background: C.blueB }} />
                    <span style={{ fontFamily: FONT.jb, fontSize: 12, color: C.muted }}>Gerando QR Code…</span>
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <button onClick={() => gerarQr('new-qr')} className="btn-ghost" style={{ fontSize: 12 }}>Gerar novo QR Code</button>
                </div>
                <p style={{ fontFamily: FONT.jb, fontSize: 10.5, color: C.faint, marginTop: 12 }}>O código se renova sozinho e expira em alguns segundos.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
