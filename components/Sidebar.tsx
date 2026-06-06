'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import { isOwner } from '@/lib/permissions'

function MeshMark({ size = 24, animate = false }: { size?: number; animate?: boolean }) {
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

type NavItem = { href: string; label: string; icon: ComponentType<IconProps> }
type NavGroup = { section: string | null; items: NavItem[] }

const adminNav: NavGroup[] = [
  { section: null, items: [
    { href: '/admin',            label: 'Visão geral',    icon: HomeIcon },
    { href: '/admin/alertas',    label: 'Alertas',        icon: BellIcon },
    { href: '/admin/assistente', label: 'Copiloto',       icon: SparkIcon },
  ] },
  { section: 'Operação', items: [
    { href: '/admin/clientes',   label: 'Clientes',       icon: UsersIcon },
    { href: '/admin/agentes',    label: 'Agentes',        icon: BoltIcon },
    { href: '/admin/templates',  label: 'Templates',      icon: BookIcon },
    { href: '/admin/biblioteca', label: 'Biblioteca',     icon: BookIcon },
    { href: '/admin/playground', label: 'Playground',     icon: SparkIcon },
    { href: '/admin/conversas',  label: 'Conversas',      icon: ChatIcon },
    { href: '/admin/negocios',   label: 'Negócios',       icon: DealIcon },
  ] },
  { section: 'Análise', items: [
    { href: '/admin/metricas',     label: 'Analytics',       icon: ChartIcon },
    { href: '/admin/financeiro',   label: 'Financeiro',      icon: DealIcon },
    { href: '/admin/inteligencia', label: 'IA para gestão',  icon: SparkIcon },
  ] },
  { section: 'Administração', items: [
    { href: '/admin/equipe',       label: 'Equipe',         icon: UsersIcon },
    { href: '/admin/logs',         label: 'Registro',       icon: BookIcon },
  ] },
  { section: 'Infraestrutura', items: [
    { href: '/admin/status',       label: 'Status',         icon: PulseIcon },
    { href: '/admin/instancias',   label: 'Instâncias',     icon: BoltIcon },
    { href: '/admin/backup',       label: 'Backup',         icon: BookIcon },
    { href: '/admin/configuracoes',label: 'Configurações',  icon: SettingsIcon },
  ] },
]

const clientNav: NavGroup[] = [
  { section: null, items: [
    { href: '/painel',               label: 'Visão geral',      icon: HomeIcon },
    { href: '/painel/assistente',    label: 'Copiloto',         icon: SparkIcon },
  ] },
  { section: 'Atendimento', items: [
    { href: '/painel/conversas',     label: 'Conversas',        icon: ChatIcon },
    { href: '/painel/negocios',      label: 'Negócios',         icon: DealIcon },
    { href: '/painel/status',        label: 'Status do agente', icon: BoltIcon },
    { href: '/painel/conhecimento',  label: 'Conhecimento',     icon: BookIcon },
  ] },
  { section: 'Conta', items: [
    { href: '/painel/metricas',      label: 'Métricas',         icon: ChartIcon },
    { href: '/painel/configuracoes', label: 'Configurações',    icon: SettingsIcon },
  ] },
]

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const souOwner = isOwner(profile.role, (profile as any).admin_level)
  const groups   = (profile.role === 'admin' ? adminNav : clientNav)
    .map(g => ({ ...g, items: g.items.filter(it => it.href !== '/admin/equipe' || souOwner) }))
    .filter(g => g.items.length > 0)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/admin' || href === '/painel' ? pathname === href : pathname.startsWith(href)

  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      height: '100%',
      background: 'var(--c-deep)',
      borderRight: '1px solid var(--c-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 20,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MeshMark size={26} animate />
          <span style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 15, color: 'var(--c-white)', letterSpacing: '-0.02em' }}>
            BONSYNC
          </span>
        </Link>
      </div>

      {/* Role badge */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <span className={profile.role === 'admin' ? 'badge badge-blue' : 'badge badge-green'}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: profile.role === 'admin' ? 'var(--c-blue-b)' : 'var(--c-green)',
            flexShrink: 0,
          }} className="animate-pulse-dot" />
          {profile.role === 'admin' ? 'Administrador' : 'Cliente'}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: gi === 0 ? 0 : 10 }}>
            {group.section && (
              <span style={{ fontFamily: 'var(--font-jb)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--c-faint)', padding: '4px 14px 6px' }}>
                {group.section}
              </span>
            )}
            {group.items.map(item => {
              const active = isActive(item.href)
              const Icon   = item.icon
              return (
                <Link key={item.href} href={item.href}
                  className={`nav-item${active ? ' active' : ''}`}>
                  <Icon size={16} color={active ? 'oklch(72% 0.21 225)' : 'var(--c-muted)'} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--c-border)', padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'oklch(55% 0.24 225/0.2)',
            border: '1px solid oklch(55% 0.24 225/0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserIcon size={15} color="oklch(72% 0.21 225)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 13, color: 'var(--c-white)', lineHeight: 1, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.company_name || 'Usuário'}
            </p>
            <p style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.email}
            </p>
          </div>
        </div>
        <button onClick={logout} className="nav-item" style={{ color: 'rgba(232,64,64,0.8)' }}>
          <LogoutIcon size={16} color="rgba(232,64,64,0.8)" />
          Sair
        </button>
      </div>
    </aside>
  )
}

/* ── Icons ── */
type IconProps = { size?: number; color?: string }

function HomeIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
  </svg>
}
function ChatIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  </svg>
}
function ChartIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="11" width="3" height="6" /><rect x="11" y="6" width="3" height="11" /><rect x="16" y="14" width="3" height="3" />
  </svg>
}
function BoltIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
}
function SettingsIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
}
function PulseIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
}
function BookIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
}
function BellIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
}
function DealIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M9 13l2 2 4-4" />
  </svg>
}
function SparkIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
  </svg>
}
function UsersIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
}
function UserIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
}
function LogoutIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
}
