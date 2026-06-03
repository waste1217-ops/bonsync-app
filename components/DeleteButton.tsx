'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, FONT } from '@/lib/styles'

interface Props {
  label?: string
  confirmText: string      // "Tem certeza que deseja excluir o agente X?"
  apiRoute: string         // "/api/admin/delete-agent"
  body: Record<string, string>
  redirectTo: string       // "/admin/agentes"
}

export function DeleteButton({ label = 'Excluir', confirmText, apiRoute, body, redirectTo }: Props) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const router = useRouter()

  async function handleDelete() {
    setLoading(true); setError('')
    try {
      const res = await fetch(apiRoute, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao excluir.')
        setLoading(false)
        return
      }
      // Sucesso — redireciona
      router.push(redirectTo)
      router.refresh()
    } catch (err: any) {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: FONT.dm, fontWeight: 500, fontSize: 13,
          padding: '10px 20px', borderRadius: 100, cursor: 'pointer',
          background: 'rgba(232,64,64,0.08)', color: C.red,
          border: '1px solid rgba(232,64,64,0.25)', transition: 'all .2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,64,64,0.16)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(232,64,64,0.08)')}
      >
        {label}
      </button>

      {/* Modal de confirmação */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(6,10,16,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: '#08101f', border: '1px solid rgba(232,64,64,0.3)',
            borderRadius: 12, padding: '32px', maxWidth: 420, width: '100%',
            animation: 'slide-up .2s ease',
          }}>
            <h3 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 12 }}>
              Confirmar exclusão
            </h3>
            <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
              {confirmText}
              <br /><br />
              <strong style={{ color: C.red }}>Esta ação não pode ser desfeita.</strong>
            </p>

            {error && (
              <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setOpen(false); setError('') }}
                disabled={loading}
                style={{ fontFamily: FONT.dm, fontSize: 13, fontWeight: 500, padding: '10px 20px', borderRadius: 100, cursor: 'pointer', background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                style={{ fontFamily: FONT.dm, fontSize: 13, fontWeight: 500, padding: '10px 20px', borderRadius: 100, cursor: loading ? 'not-allowed' : 'pointer', background: C.red, color: '#fff', border: 'none', opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}
              >
                {loading ? 'Excluindo…' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
