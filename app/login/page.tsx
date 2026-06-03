'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function MeshMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <polygon points="24,5 41,14.5 41,33.5 24,43 7,33.5 7,14.5"
        stroke="oklch(72% 0.21 225)" strokeWidth="1.5" fill="oklch(18% 0.16 225 / 0.5)" />
      <line x1="41" y1="14.5" x2="47" y2="8" stroke="oklch(72% 0.21 225)" strokeWidth="1" />
      <line x1="41" y1="33.5" x2="47" y2="40" stroke="oklch(72% 0.21 225)" strokeWidth="1" />
      <line x1="7" y1="24" x2="1" y2="24" stroke="oklch(72% 0.21 225)" strokeWidth="1" />
      <circle cx="47" cy="8" r="2.5" fill="oklch(72% 0.21 225)" />
      <circle cx="47" cy="40" r="2.5" fill="oklch(72% 0.21 225)" />
      <circle cx="1" cy="24" r="2.5" fill="oklch(72% 0.21 225)" />
      <circle cx="24" cy="24" r="4" fill="oklch(55% 0.24 225)">
        <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">

      {/* Brand side */}
      <div className="hidden lg:flex relative bg-deep flex-col justify-between p-12 overflow-hidden border-r border-border">
        <div className="absolute w-[600px] h-[600px] -left-32 -bottom-48 rounded-full"
          style={{ background: 'radial-gradient(circle, oklch(55% 0.24 225/0.14) 0%, transparent 65%)' }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(80,130,210,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(80,130,210,0.04) 1px,transparent 1px)',
            backgroundSize: '48px 48px'
          }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <MeshMark size={26} />
          <span className="font-heading font-bold text-base tracking-tight text-white">BONSYNC</span>
        </div>

        {/* Network visualization */}
        <div className="relative z-10 w-64 h-64 self-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
            {nodes.slice(1).map((n, i) => (
              <line key={i} x1="50" y1="50" x2={n.x} y2={n.y}
                stroke="oklch(55% 0.24 225/0.35)" strokeWidth="0.5">
                <animate attributeName="stroke-opacity" values="0.15;0.5;0.15"
                  dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              </line>
            ))}
          </svg>
          {nodes.map((n, i) => (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}>
              <div className={`rounded-full flex items-center justify-center border transition-all
                ${n.core
                  ? 'w-14 h-14 border-blue-bright bg-blue/20'
                  : 'w-5 h-5 border-border-hi bg-surface'}`}
                style={n.core ? { boxShadow: '0 0 32px oklch(55% 0.24 225/0.45)' } : {}}>
                {n.core
                  ? <MeshMark size={28} />
                  : <div className="w-1.5 h-1.5 rounded-full bg-blue-bright" />}
              </div>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <p className="font-heading font-semibold text-xl text-white leading-snug max-w-xs">
            Seus agentes, num só lugar.
          </p>
          <p className="font-sans text-sm text-muted mt-2 font-light">
            Acompanhe tudo pelo painel da Bonsync.
          </p>
        </div>
      </div>

      {/* Login side */}
      <div className="flex items-center justify-center p-8 bg-void">
        <div className="w-full max-w-sm animate-slide-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <MeshMark size={24} />
            <span className="font-heading font-bold text-sm tracking-tight text-white">BONSYNC</span>
          </div>

          <h1 className="font-heading font-bold text-3xl text-white tracking-tight mb-2">
            Entrar
          </h1>
          <p className="text-muted text-sm font-light mb-8">
            Acesse o painel da sua conta Bonsync.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="voce@empresa.com.br"
                required
                className="w-full bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none transition focus:border-blue-bright focus:ring-2 focus:ring-blue/20"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase">
                  Senha
                </label>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                required
                className={`w-full bg-surface/50 border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none transition focus:border-blue-bright focus:ring-2 focus:ring-blue/20
                  ${error ? 'border-red/50' : 'border-border'}`}
              />
            </div>

            {error && (
              <div className="bg-red/8 border border-red/30 rounded-lg px-4 py-3 text-red text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full font-sans font-medium text-sm tracking-wide transition-all
                bg-white text-void hover:-translate-y-px hover:shadow-lg
                disabled:bg-surface disabled:text-muted disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {loading ? 'Verificando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-muted font-light">
            Precisa de acesso?{' '}
            <a href="https://bonsync.com/demo" className="text-blue-bright font-medium hover:underline">
              Fale com a Bonsync
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
