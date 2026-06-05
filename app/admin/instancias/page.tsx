'use client'

import { useEffect, useState, useCallback } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

interface Inst { name: string; status: string; number: string | null }

export default function InstanciasPage() {
  const [instances, setInstances] = useState<Inst[]>([])
  const [loading, setLoading]     = useState(true)
  const [novo, setNovo]           = useState('')
  const [criando, setCriando]     = useState(false)
  const [error, setError]         = useState('')
  const [qr, setQr]               = useState('')
  const [qrInstance, setQrInstance] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch('/api/admin/instances', { cache: 'no-store' })
    const data = await res.json()
    if (res.ok) setInstances(data.instances ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Enquanto o QR está aberto, fica checando se conectou
  useEffect(() => {
    if (!qrInstance) return
    const t = setInterval(async () => {
      const res = await fetch('/api/admin/instances', { cache: 'no-store' })
      const data = await res.json()
      const inst = (data.instances ?? []).find((i: Inst) => i.name === qrInstance)
      if (inst?.status === 'open') {
        setQr(''); setQrInstance(''); carregar()
      }
    }, 4000)
    return () => clearInterval(t)
  }, [qrInstance, carregar])

  async function criar() {
    const nome = novo.trim()
    if (!nome || criando) return
    setCriando(true); setError('')
    const res = await fetch('/api/admin/create-instance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome }),
    })
    const data = await res.json()
    setCriando(false)
    if (!res.ok) { setError(data.error ?? 'Erro.'); return }
    setNovo('')
    if (data.qr) { setQr(data.qr); setQrInstance(data.instance) }
    carregar()
  }

  async function reconectar(name: string) {
    setError('')
    const res = await fetch('/api/admin/instance-connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro.'); return }
    if (data.qr) { setQr(data.qr); setQrInstance(name) }
  }

  const dot = (ok: boolean) => ({ width: 9, height: 9, borderRadius: '50%', background: ok ? C.green : C.red })
  const qrSrc = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`

  return (
    <div className="animate-slide-up" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Instâncias WhatsApp</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Crie e conecte os números de WhatsApp dos clientes. Cada instância = 1 número.</p>
      </div>

      {/* Criar */}
      <div style={{ ...CARD, marginBottom: 20 }}>
        <label style={T.label}>Nova instância</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="field" placeholder="ex: petshop (letras, números, - ou _)"
            value={novo} onChange={e => setNovo(e.target.value)} style={{ flex: 1 }} />
          <button onClick={criar} disabled={criando || !novo.trim()} className="btn-primary"
            style={{ opacity: criando || !novo.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {criando ? 'Criando…' : 'Criar + QR'}
          </button>
        </div>
        <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 8 }}>
          Use esse mesmo nome no campo "Instância WhatsApp" ao criar o agente.
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', ...T.sub }} className="animate-pulse-dot">Carregando…</div>
      ) : instances.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>
          Nenhuma instância criada ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {instances.map(i => {
            const ok = i.status === 'open'
            return (
              <div key={i.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={dot(ok)} />
                  <div>
                    <p style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white }}>{i.name}</p>
                    <p style={{ fontFamily: FONT.jb, fontSize: 10, color: ok ? C.green : C.muted, marginTop: 2 }}>
                      {ok ? `conectado${i.number ? ' · ' + i.number : ''}` : i.status}
                    </p>
                  </div>
                </div>
                {!ok && (
                  <button onClick={() => reconectar(i.name)} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>
                    Conectar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal QR */}
      {qr && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(6,10,16,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setQr(''); setQrInstance('') }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#08101f', border: `1px solid ${C.borderHi}`, borderRadius: 12, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 6 }}>
              Escaneie o QR Code
            </h3>
            <p style={{ ...T.sub, fontSize: 13, marginBottom: 18 }}>
              WhatsApp → Aparelhos conectados → Conectar aparelho. Instância: <strong style={{ color: C.white }}>{qrInstance}</strong>
            </p>
            <div style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'inline-block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="QR Code" style={{ width: 240, height: 240, display: 'block' }} />
            </div>
            <p style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted, marginTop: 16 }} className="animate-pulse-dot">
              Aguardando conexão…
            </p>
            <button onClick={() => { setQr(''); setQrInstance('') }} className="btn-ghost" style={{ fontSize: 12, padding: '9px 20px', marginTop: 14 }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
