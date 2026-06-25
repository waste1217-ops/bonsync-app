'use client'

import { useEffect, useRef, useState } from 'react'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'

type St = 'conectado' | 'aguardando' | 'desconectado' | 'error' | 'desconhecido' | string

const stMeta: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'muted' }> = {
  conectado:    { label: 'Conectado',          variant: 'green' },
  aguardando:   { label: 'Aguardando leitura', variant: 'yellow' },
  desconectado: { label: 'Não conectado',      variant: 'muted' },
  expirado:     { label: 'Expirado',           variant: 'yellow' },
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

export function AdminWhatsAppSection({ clientId, clientEmail, lastConnection: initialLast, lastSent: initialSent }: {
  clientId: string; clientEmail: string | null; lastConnection: string | null; lastSent: string | null
}) {
  const [status, setStatus] = useState<St>('desconhecido')
  const [numero, setNumero] = useState<string | null>(null)
  const [lastConnection, setLast] = useState<string | null>(initialLast)
  const [lastSent, setLastSent] = useState<string | null>(initialSent)
  const [modal, setModal] = useState(false)
  const [qr, setQr] = useState('')
  const [qrState, setQrState] = useState<'loading' | 'qr' | 'error' | 'expirado'>('loading')
  const [qrErr, setQrErr] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState('')
  const alive = useRef(true)
  const semEmail = !clientEmail

  async function loadStatus() {
    const { ok, data } = await call('status', clientId)
    if (!alive.current || !ok) return
    setStatus(data.status); setNumero(data.number ?? null)
    if (data.lastConnection) setLast(data.lastConnection)
    if (data.lastSent) setLastSent(data.lastSent)
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
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal])

  // Expira o QR após ~50s se ninguém escanear (permite gerar um novo)
  useEffect(() => {
    if (qrState !== 'qr') return
    const exp = setTimeout(() => { if (alive.current && status !== 'conectado') setQrState('expirado') }, 50000)
    return () => clearTimeout(exp)
  }, [qrState, status])

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

  async function reconectar() {
    setBusy('restart'); setEmailMsg(null)
    const { ok, data } = await call('restart', clientId)
    setBusy('')
    if (!ok) { setEmailMsg({ ok: false, text: data.error || 'Não foi possível reconectar a sessão.' }); return }
    setStatus(data.status); setNumero(data.number ?? null)
    setEmailMsg({ ok: data.status === 'conectado', text: data.status === 'conectado' ? 'Sessão reconectada com sucesso.' : 'Sessão reiniciada — aguardando o WhatsApp reconectar. Atualize em alguns segundos.' })
  }
  async function gerarLink() {
    setBusy('link'); setEmailMsg(null)
    const { ok, data } = await call('link', clientId)
    setBusy('')
    if (!ok) { setEmailMsg({ ok: false, text: data.error || 'Não foi possível gerar o link seguro.' }); return }
    setLink(data.connectUrl)
    try { await navigator.clipboard.writeText(data.connectUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  async function enviarEmail() {
    setConfirmSend(false)
    const dest = (clientEmail || '').trim()
    if (!dest) { setEmailMsg({ ok: false, text: 'Este cliente não possui um e-mail cadastrado. Adicione um e-mail ao perfil para continuar.' }); return }
    setBusy('email'); setEmailMsg(null)
    const { ok, data } = await call('send-qr', clientId, { email: dest })
    setBusy('')
    if (!ok) { setEmailMsg({ ok: false, text: data.error || 'Não foi possível enviar o e-mail.' }); return }
    setEmailMsg({ ok: true, text: `E-mail enviado com sucesso para ${data.email}.` })
    if (data.sentAt) setLastSent(data.sentAt)
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
        <div><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Último envio de e-mail</p><p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{fmtDateTime(lastSent) || '—'}</p></div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => gerarQr('qr')} className="btn-primary" style={{ fontSize: 13 }}>Gerar QR Code</button>
        <button onClick={reconectar} disabled={busy === 'restart'} className="btn-ghost" style={{ fontSize: 13 }}>{busy === 'restart' ? 'Reconectando…' : 'Reconectar sessão'}</button>
        <button onClick={gerarLink} disabled={busy === 'link'} className="btn-ghost" style={{ fontSize: 13 }}>{busy === 'link' ? 'Gerando…' : copied ? 'Link copiado!' : 'Copiar link seguro'}</button>
        <button
          onClick={() => { if (!semEmail) setConfirmSend(true); else setEmailMsg({ ok: false, text: 'Este cliente não possui um e-mail cadastrado. Adicione um e-mail ao perfil para continuar.' }) }}
          disabled={semEmail || busy === 'email'} title={semEmail ? 'Cliente sem e-mail cadastrado' : ''}
          className="btn-ghost" style={{ fontSize: 13, opacity: semEmail ? 0.5 : 1, cursor: semEmail ? 'not-allowed' : 'pointer' }}>
          {busy === 'email' ? 'Enviando…' : lastSent ? 'Reenviar e-mail' : 'Enviar QR Code por e-mail'}
        </button>
        {conectado && <button onClick={desconectar} disabled={busy === 'disc'} className="btn-ghost" style={{ fontSize: 13, color: C.red, borderColor: 'rgba(232,64,64,0.3)' }}>{busy === 'disc' ? '…' : 'Desconectar WhatsApp'}</button>}
      </div>

      {semEmail && (
        <p style={{ marginTop: 10, fontFamily: FONT.dm, fontSize: 12.5, color: C.yellow, fontWeight: 300 }}>
          Este cliente não possui um e-mail cadastrado. Adicione um e-mail ao perfil para enviar o link.
        </p>
      )}

      {link && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="field" readOnly value={link} style={{ flex: 1, minWidth: 220, fontSize: 12 }} />
          <button onClick={gerarLink} className="btn-ghost" style={{ fontSize: 11, padding: '8px 12px', whiteSpace: 'nowrap' }}>{copied ? 'Copiado!' : 'Copiar'}</button>
        </div>
      )}

      {/* Confirmação antes de enviar */}
      {confirmSend && (
        <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 10, background: C.void, border: `1px solid ${C.borderHi}` }}>
          <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 300, lineHeight: 1.5, marginBottom: 12 }}>
            O link de conexão e o QR Code serão enviados para <b>{clientEmail}</b>. Deseja continuar?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={enviarEmail} disabled={busy === 'email'} className="btn-primary" style={{ fontSize: 12 }}>{busy === 'email' ? 'Enviando…' : 'Continuar'}</button>
            <button onClick={() => setConfirmSend(false)} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
          </div>
        </div>
      )}

      {emailMsg && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontFamily: FONT.dm, fontSize: 13, fontWeight: 300,
          background: emailMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(232,64,64,0.08)',
          border: `1px solid ${emailMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(232,64,64,0.25)'}`,
          color: emailMsg.ok ? C.green : C.red,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>{emailMsg.ok ? '✓ ' : '⚠ '}{emailMsg.text}</span>
          {!emailMsg.ok && !semEmail && <button onClick={() => setConfirmSend(true)} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}>Tentar novamente</button>}
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
            ) : qrState === 'expirado' ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>⌛</div>
                <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 16, color: C.white, marginBottom: 6 }}>QR Code expirado</p>
                <p style={{ ...T.sub, fontSize: 13, marginBottom: 16 }}>O código não foi escaneado a tempo. Gere um novo para continuar.</p>
                <button onClick={() => gerarQr('new-qr')} className="btn-primary" style={{ fontSize: 13 }}>Gerar novo QR Code</button>
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
