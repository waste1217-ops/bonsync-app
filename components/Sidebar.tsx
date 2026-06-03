'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'

function MeshMark({ size = 24 }: { size?: number }) {
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
      <circle cx="24" cy="24" r="4" fill="oklch(55% 0.24 225)" />
    </svg>
  )
}

const adminNav = [
  { href: '/admin', label: 'Visão geral', icon: HomeIcon },
  { href: '/admin/clientes', label: 'Clientes', icon: UsersIcon },
  { href: '/admin/agentes', label: 'Agentes', icon: BoltIcon },
  { href: '/admin/conversas', label: 'Conversas', icon: ChatIcon },
  { href: '/admin/metricas', label: 'Métricas', icon: ChartIcon },
]

const clientNav = [
  { href: '/painel', label: 'Visão geral', icon: HomeIcon },
  { href: '/painel/conversas', label: 'Conversas', icon: ChatIcon },
  { href: '/painel/status', label: 'Status do agente', icon: BoltIcon },
  { href: '/painel/metricas', label: 'Métricas', icon: ChartIcon },
  { href: '/painel/configuracoes', label: 'Configurações', icon: SettingsIcon },
]

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const nav = profile.role === 'admin' ? adminNav : clientNav

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/painel') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 bg-deep border-r border-border flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <MeshMark size={24} />
          <span className="font-heading font-bold text-sm tracking-tight text-white">BONSYNC</span>
        </Link>
      </div>

      {/* Role badge */}
      <div className="px-4 py-3 border-b border-border">
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full
          ${profile.role === 'admin'
            ? 'bg-blue/10 text-blue-bright border border-blue/20'
            : 'bg-green/10 text-green border border-green/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse-dot
            ${profile.role === 'admin' ? 'bg-blue-bright' : 'bg-green'}`} />
          {profile.role === 'admin' ? 'Administrador' : 'Cliente'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {nav.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-all no-underline
                ${active
                  ? 'bg-blue/12 text-white border border-blue/20'
                  : 'text-muted hover:bg-blue/8 hover:text-white'}`}>
              <Icon size={16} color={active ? 'oklch(72% 0.21 225)' : '#7286a0'} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border px-3 py-4 flex flex-col gap-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-blue/20 border border-blue/30 flex items-center justify-center shrink-0">
            <UserIcon size={14} color="oklch(72% 0.21 225)" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-sans font-medium text-white truncate">
              {profile.company_name || 'Usuário'}
            </p>
            <p className="font-mono text-[10px] text-muted truncate">{profile.email}</p>
          </div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red/80 hover:bg-red/8 hover:text-red transition-all w-full text-left">
          <LogoutIcon size={16} color="currentColor" />
          Sair
        </button>
      </div>
    </aside>
  )
}

/* ── Icons ── */
function HomeIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
  </svg>
}
function ChatIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  </svg>
}
function ChartIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="11" width="3" height="6" /><rect x="11" y="6" width="3" height="11" /><rect x="16" y="14" width="3" height="3" />
  </svg>
}
function BoltIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
}
function SettingsIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
}
function UsersIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
}
function UserIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
}
function LogoutIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
}
