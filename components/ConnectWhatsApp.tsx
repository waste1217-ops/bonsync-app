'use client'

import { useEffect, useRef, useState } from 'react'
import { C, T, FONT } from '@/lib/styles'

type Estado = 'loading' | 'qr' | 'open' | 'error'

/**
 * Painel de conexão do WhatsApp (admin): gera o QR de uma instância, mostra
 * carregamento, atualiza para "conectado" após o scan e oferece "tentar
 * novamente" em caso de falha. Usado inline (cadastro) e dentro do modal.
 */
export function ConnectWhatsApp({ instance, onConnected }: { instance: string; onConnected?: () => void }) {
  const [estado, setEstado] = useState<Estado>('loading')
  const [qr, setQr] = useState('')
  const [erro, setErro] = useState('')
  const [numero, setNumero] = useState<string | null>(null)
  const alive = useRef(true)

  async function buscarQr() {
    setEstado('loading'); setErro('')
    try {
      const res = await fetch('/api/admin/instance-connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: instance }),
      })
      const d = await res.json().catch(() => ({}))
      if (!alive.current) return
      if (!res.ok) { setErro(d.error || 'Não foi possível gerar o QR Code.'); setEstado('error'); return }
      if (d.qr) { setQr(d.qr); setEstado('qr') }
      else { setEstado('loading') } // pode já estar conectado; o status confirma
    } catch {
      if (alive.current) { setErro('Erro de conexão ao gerar o QR.'); setEstado('error') }
    }
  }

  async function checarStatus() {
    try {
      const res = await fetch('/api/admin/instances', { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!alive.current || !res.ok) return
      const inst = (d.instances || []).find((i: any) => i.name === instance)
      if (inst?.status === 'open') {
        setNumero(inst.number || null)
        setEstado('open')
        onConnected?.()
      }
    } catch { /* silencioso — segue tentando */ }
  }

  useEffect(() => {
    alive.current = true
    buscarQr()
    checarStatus()
    const stt = setInterval(() => { if (alive.current) checarStatus() }, 4000)          // status a cada 4s
    const qrt = setInterval(() => { if (alive.current) setEstado(e => { if (e !== 'open') buscarQr(); return e }) }, 22000) // QR renova a cada 22s
    return () => { alive.current = false; clearInterval(stt); clearInterval(qrt) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance])

  const qrSrc = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`

  if (estado === 'open') {
    return (
      <div style={{ textAlign: 'center', padding: '28px 20px', background: C.deep, border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
        <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 6 }}>WhatsApp conectado!</p>
        <p style={{ ...T.sub, fontSize: 13 }}>{numero ? `Número ${numero} vinculado.` : 'Conexão estabelecida.'} O agente já pode atender.</p>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '28px 20px', background: C.deep, border: '1px solid rgba(232,64,64,0.3)', borderRadius: 14 }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
        <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 16, color: C.white, marginBottom: 6 }}>Não foi possível gerar o QR Code</p>
        <p style={{ ...T.sub, fontSize: 13, marginBottom: 16 }}>{erro}</p>
        <button onClick={buscarQr} className="btn-primary" style={{ fontSize: 13 }}>Tentar novamente</button>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '24px 20px', background: C.deep, border: `1px solid ${C.borderHi}`, borderRadius: 14 }}>
      <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 16, color: C.white, marginBottom: 6 }}>Conecte o WhatsApp</p>
      <p style={{ ...T.sub, fontSize: 12.5, marginBottom: 18, lineHeight: 1.5 }}>
        No celular: <b style={{ color: C.white }}>WhatsApp → Aparelhos conectados → Conectar aparelho</b> e aponte para o código.
      </p>
      {estado === 'qr' && qr ? (
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
      <p style={{ fontFamily: FONT.jb, fontSize: 10.5, color: C.faint, marginTop: 16 }}>
        O código se renova sozinho. Assim que escanear, esta tela confirma a conexão.
      </p>
    </div>
  )
}

/** Botão que abre o painel de conexão em um modal (para reconectar depois). */
export function ConnectButton({ instance, label = 'Conectar WhatsApp', className = 'btn-primary', style }: { instance: string; label?: string; className?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  if (!instance) return null
  return (
    <>
      <button onClick={() => setOpen(true)} className={className} style={{ fontSize: 13, ...style }}>{label}</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'oklch(10% 0.03 250 / 0.7)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
            <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ position: 'absolute', top: -34, right: 0, background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>
            <ConnectWhatsApp instance={instance} />
          </div>
        </div>
      )}
    </>
  )
}
