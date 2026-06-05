'use client'

import { useEffect, useState, use } from 'react'

function MeshMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <polygon points="24,5 41,14.5 41,33.5 24,43 7,33.5 7,14.5" stroke="oklch(72% 0.21 225)" strokeWidth="1.5" fill="oklch(18% 0.16 225 / 0.5)" />
      <circle cx="24" cy="24" r="4" fill="oklch(55% 0.24 225)" />
    </svg>
  )
}

export default function ConectarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [qr, setQr]         = useState('')
  const [status, setStatus] = useState('loading')
  const [erro, setErro]     = useState('')

  useEffect(() => {
    let alive = true
    async function tick() {
      try {
        const res = await fetch(`/api/connect/${token}`, { cache: 'no-store' })
        const data = await res.json()
        if (!alive) return
        if (!res.ok) { setErro(data.error || 'Link inválido.'); setStatus('error'); return }
        setStatus(data.status)
        if (data.qr) setQr(data.qr)
      } catch { if (alive) { setErro('Erro de conexão.'); setStatus('error') } }
    }
    tick()
    const t = setInterval(() => { if (status !== 'open') tick() }, 5000)
    return () => { alive = false; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const qrSrc = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`
  const connected = status === 'open'

  return (
    <div style={{ minHeight: '100vh', background: '#060a10', color: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-dm), sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
          <MeshMark size={30} />
          <span style={{ fontFamily: 'var(--font-space), sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>BONSYNC</span>
        </div>

        {connected ? (
          <div style={{ background: '#08101f', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16, padding: '40px 28px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <h1 style={{ fontFamily: 'var(--font-space), sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>WhatsApp conectado!</h1>
            <p style={{ fontWeight: 300, fontSize: 15, color: '#7286a0', lineHeight: 1.6 }}>
              Tudo certo. Seu agente já está ativo e pronto para atender. Pode fechar esta página.
            </p>
          </div>
        ) : status === 'error' ? (
          <div style={{ background: '#08101f', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 16, padding: '40px 28px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontFamily: 'var(--font-space), sans-serif', fontWeight: 700, fontSize: 20, marginBottom: 10 }}>Link indisponível</h1>
            <p style={{ fontWeight: 300, fontSize: 14, color: '#7286a0', lineHeight: 1.6 }}>{erro}</p>
          </div>
        ) : (
          <div style={{ background: '#08101f', border: '1px solid rgba(90,150,230,0.36)', borderRadius: 16, padding: '32px 28px' }}>
            <h1 style={{ fontFamily: 'var(--font-space), sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Conecte seu WhatsApp</h1>
            <p style={{ fontWeight: 300, fontSize: 14, color: '#7286a0', lineHeight: 1.6, marginBottom: 24 }}>
              No celular: <b style={{ color: '#eef2ff' }}>WhatsApp → Aparelhos conectados → Conectar aparelho</b> e aponte para o código abaixo.
            </p>
            {qr ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'inline-block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR Code" style={{ width: 250, height: 250, display: 'block' }} />
              </div>
            ) : (
              <div style={{ height: 278, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7286a0', fontFamily: 'var(--font-jb), monospace', fontSize: 13 }}>
                Gerando código…
              </div>
            )}
            <p style={{ fontFamily: 'var(--font-jb), monospace', fontSize: 11, color: '#7286a0', marginTop: 20 }}>
              O código se renova sozinho. Mantenha esta página aberta.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
