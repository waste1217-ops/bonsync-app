import type { Metadata } from 'next'
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  display: 'swap',
})

// IMPORTANTE: usar --font-jb, não --font-mono (conflita com Tailwind v4 internamente)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jb',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bonsync — Painel',
  description: 'Painel de controle dos agentes Bonsync',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      style={{ height: '100%' }}
    >
      <body style={{
        height: '100%',
        margin: 0,
        padding: 0,
        background: '#060a10',
        color: '#eef2ff',
        fontFamily: 'var(--font-dm), DM Sans, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        overflowX: 'hidden',
      }}>
        {children}
      </body>
    </html>
  )
}
