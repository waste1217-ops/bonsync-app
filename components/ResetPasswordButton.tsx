'use client'

import { useState } from 'react'
import { C, FONT } from '@/lib/styles'

export function ResetPasswordButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen]       = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  async function handleReset() {
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, new_password: password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro.'); setLoading(false); return }
    setDone(true); setLoading(false)
  }

  function close() {
    setOpen(false); setPassword(''); setError(''); setDone(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost" style={{ fontSize: 13, padding: '10px 20px' }}>
        Redefinir senha
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(6,10,16,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#08101f', border: `1px solid ${C.borderHi}`, borderRadius: 12, padding: 32, maxWidth: 420, width: '100%', animation: 'slide-up .2s ease' }}>
            {!done ? (
              <>
                <h3 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 8 }}>
                  Redefinir senha
                </h3>
                <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
                  Defina uma nova senha para <strong style={{ color: C.white }}>{clientName}</strong>. Informe a nova senha ao cliente.
                </p>
                <input
                  className="field" type="text" placeholder="Nova senha (mín. 8 caracteres)"
                  value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                  style={{ marginBottom: 16 }}
                />
                {error && (
                  <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={close} disabled={loading} style={{ fontFamily: FONT.dm, fontSize: 13, fontWeight: 500, padding: '10px 20px', borderRadius: 100, cursor: 'pointer', background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}>
                    Cancelar
                  </button>
                  <button onClick={handleReset} disabled={loading} className="btn-primary" style={{ fontSize: 13, padding: '10px 20px' }}>
                    {loading ? 'Salvando…' : 'Redefinir'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.green, marginBottom: 8 }}>
                  ✓ Senha redefinida
                </h3>
                <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
                  Nova senha de <strong style={{ color: C.white }}>{clientName}</strong>:
                </p>
                <div style={{ background: C.void, border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: '14px 16px', marginBottom: 20, fontFamily: FONT.jb, fontSize: 16, color: C.blueB, textAlign: 'center', letterSpacing: '0.05em' }}>
                  {password}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={close} className="btn-primary" style={{ fontSize: 13, padding: '10px 24px' }}>
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
