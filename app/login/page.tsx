'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function MeshMark({ size = 40, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ display: 'block' }}>
      <polygon points="24,5 41,14.5 41,33.5 24,43 7,33.5 7,14.5"
        stroke="oklch(72% 0.21 225)" strokeWidth="1.5" fill="oklch(18% 0.16 225 / 0.5)" />
      <line x1="41" y1="14.5" x2="47" y2="8" stroke="oklch(72% 0.21 225)" strokeWidth="1" />
      <line x1="41" y1="33.5" x2="47" y2="40" stroke="oklch(72% 0.21 225)" strokeWidth="1" />
      <line x1="7" y1="24" x2="1" y2="24" stroke="oklch(72% 0.21 225)" strokeWidth="1" />
      <circle cx="47" cy="8" r="2.5" fill="oklch(72% 0.21 225)" />
      <circle cx="47" cy="40" r="2.5" fill="oklch(72% 0.21 225)" />
      <circle cx="1" cy="24" r="2.5" fill="oklch(72% 0.21 225)" />
      <circle cx="24" cy="24" r="4" fill="oklch(55% 0.24 225)">
        {animate && <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />}
      </circle>
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [blocked, setBlocked]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('blocked') === '1') setBlocked(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  const nodes = [
    { x: 50, y: 50, core: true },
    { x: 50, y: 14 }, { x: 84, y: 32 }, { x: 84, y: 68 },
    { x: 50, y: 86 }, { x: 16, y: 68 }, { x: 16, y: 32 },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      background: '#060a10',
    }}>
      {/* ── Brand side ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#08101f',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
        borderRight: '1px solid rgba(80,130,210,0.16)',
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', width: 600, height: 600,
          left: -150, bottom: -200, borderRadius: '50%',
          background: 'radial-gradient(circle, oklch(55% 0.24 225/0.14) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(80,130,210,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(80,130,210,0.04) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <MeshMark size={26} />
          <span style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: '#eef2ff', letterSpacing: '-0.02em' }}>
            BONSYNC
          </span>
        </div>

        {/* Network */}
        <div style={{ position: 'relative', zIndex: 1, width: 260, height: 260, alignSelf: 'center', margin: 'auto 0' }}>
          <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            {nodes.slice(1).map((n, i) => (
              <line key={i} x1="50" y1="50" x2={n.x} y2={n.y}
                stroke="oklch(55% 0.24 225/0.35)" strokeWidth="0.5">
                <animate attributeName="stroke-opacity" values="0.15;0.5;0.15"
                  dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              </line>
            ))}
          </svg>
          {nodes.map((n, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${n.x}%`, top: `${n.y}%`,
              transform: 'translate(-50%, -50%)',
            }}>
              <div style={{
                width: n.core ? 56 : 22,
                height: n.core ? 56 : 22,
                borderRadius: '50%',
                background: n.core ? 'oklch(55% 0.24 225/0.22)' : 'oklch(20% 0.16 225/0.8)',
                border: `1px solid ${n.core ? 'oklch(72% 0.21 225)' : 'rgba(90,150,230,0.36)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: n.core ? '0 0 32px oklch(55% 0.24 225/0.45)' : 'none',
              }}>
                {n.core
                  ? <MeshMark size={28} animate />
                  : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'oklch(72% 0.21 225)' }} />
                }
              </div>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif', fontWeight: 600, fontSize: 20, color: '#eef2ff', lineHeight: 1.3, letterSpacing: '-0.01em', maxWidth: 300 }}>
            Seus agentes, num só lugar.
          </p>
          <p style={{ fontFamily: 'var(--font-dm), DM Sans, sans-serif', fontWeight: 300, fontSize: 14, color: '#7286a0', marginTop: 8 }}>
            Acompanhe tudo pelo painel da Bonsync.
          </p>
        </div>
      </div>

      {/* ── Login side ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px',
        background: '#060a10',
      }}>
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif', fontWeight: 700, fontSize: 32, color: '#eef2ff', letterSpacing: '-0.025em', marginBottom: 10 }}>
            Entrar
          </h1>
          <p style={{ fontFamily: 'var(--font-dm), DM Sans, sans-serif', fontWeight: 300, fontSize: 15, color: '#7286a0', marginBottom: 36 }}>
            Acesse o painel da sua conta Bonsync.
          </p>

          {blocked && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontFamily: 'var(--font-dm), sans-serif', fontSize: 13, color: '#fbbf24', lineHeight: 1.5 }}>
              Seu acesso está temporariamente suspenso. Entre em contato com a Bonsync para regularizar.
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-jb), JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'oklch(72% 0.21 225)', marginBottom: 8 }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="voce@empresa.com.br"
                required
                className="field"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-jb), JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'oklch(72% 0.21 225)', marginBottom: 8 }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                required
                className="field"
                style={{ borderColor: error ? 'rgba(232,64,64,0.5)' : undefined }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 8, padding: '11px 14px', fontFamily: 'var(--font-dm), sans-serif', fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ marginTop: 8, width: '100%', padding: '15px' }}
            >
              {loading ? 'Verificando…' : 'Entrar'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 28, fontFamily: 'var(--font-dm), sans-serif', fontSize: 14, color: '#7286a0', fontWeight: 300 }}>
            Precisa de acesso?{' '}
            <a href="https://bonsync.com.br/demo.html" style={{ color: 'oklch(72% 0.21 225)', fontWeight: 500 }}>
              Fale com a Bonsync
            </a>
          </p>
        </div>
      </div>

      {/* Responsive: esconde brand side em mobile */}
      <style>{`
        @media (max-width: 820px) {
          div[style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="border-right: 1px solid rgba(80,130,210"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
