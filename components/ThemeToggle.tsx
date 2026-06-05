'use client'

import { useEffect, useState } from 'react'

/**
 * Provedor de tema para o painel do cliente.
 * Envolve o conteúdo num wrapper com data-theme; o CSS troca as variáveis.
 * Persiste a escolha em localStorage. Padrão: escuro.
 */
export function ClientThemeWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('bonsync-theme') as 'dark' | 'light' | null) || 'dark'
    setTheme(saved)
    setMounted(true)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('bonsync-theme', next)
  }

  return (
    <div data-theme={theme} style={{ display: 'contents' }}>
      {/* Botão flutuante de tema */}
      {mounted && (
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 200,
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--c-deep)', border: '1px solid var(--c-border-hi)',
            color: 'var(--c-blue-b)', cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      )}
      {children}
    </div>
  )
}
