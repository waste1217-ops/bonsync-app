/**
 * Sistema de estilos compartilhados — Bonsync App
 * Usar SEMPRE estas constantes, nunca classes Tailwind de cor customizada.
 * As cores do Tailwind v4 (bg-deep, text-muted etc.) NÃO são geradas corretamente.
 */
import type { CSSProperties } from 'react'

/* ── Tokens (via CSS vars — trocam com o tema claro/escuro) ── */
export const C = {
  void:     'var(--c-void)',
  deep:     'var(--c-deep)',
  surface:  'var(--c-surface)',
  raise:    'var(--c-raise)',
  blue:     'var(--c-blue)',
  blueM:    'var(--c-blue-m)',
  blueB:    'var(--c-blue-b)',
  white:    'var(--c-white)',
  muted:    'var(--c-muted)',
  faint:    'var(--c-faint)',
  border:   'var(--c-border)',
  borderHi: 'var(--c-border-hi)',
  green:    'var(--c-green)',
  red:      'var(--c-red)',
  yellow:   'var(--c-yellow)',
}

export const FONT = {
  space: "var(--font-space), 'Space Grotesk', sans-serif",
  dm:    "var(--font-dm), 'DM Sans', sans-serif",
  jb:    "var(--font-jb), 'JetBrains Mono', monospace",
}

/* ── Typography presets ── */
export const T = {
  h1: {
    fontFamily: FONT.space, fontWeight: 700,
    fontSize: 24, color: C.white,
    letterSpacing: '-0.025em', lineHeight: 1.1,
  } as CSSProperties,

  h2: {
    fontFamily: FONT.space, fontWeight: 600,
    fontSize: 16, color: C.white, marginBottom: 16,
  } as CSSProperties,

  sub: {
    fontFamily: FONT.dm, fontWeight: 300,
    fontSize: 14, color: C.muted, lineHeight: 1.6,
  } as CSSProperties,

  label: {
    display: 'block',
    fontFamily: FONT.jb, fontSize: 10,
    letterSpacing: '0.14em', textTransform: 'uppercase' as const,
    color: C.blueB, marginBottom: 8,
  } as CSSProperties,

  mono: {
    fontFamily: FONT.jb, fontSize: 10,
    letterSpacing: '0.14em', textTransform: 'uppercase' as const,
  } as CSSProperties,

  tableHead: {
    fontFamily: FONT.jb, fontSize: 9,
    letterSpacing: '0.14em', textTransform: 'uppercase' as const,
    color: C.faint,
  } as CSSProperties,

  cell: {
    fontFamily: FONT.dm, fontSize: 14,
    color: C.white, fontWeight: 500,
  } as CSSProperties,

  cellMuted: {
    fontFamily: FONT.dm, fontSize: 14,
    color: C.muted, fontWeight: 300,
  } as CSSProperties,

  cellMono: {
    fontFamily: FONT.jb, fontSize: 11, color: C.muted,
  } as CSSProperties,
}

/* ── Layout ── */
export const L = {
  page: {
    maxWidth: 1100,
    animation: 'slide-up 0.35s ease forwards',
  } as CSSProperties,

  pageHeader: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap' as const,
    gap: 16, marginBottom: 28,
  } as CSSProperties,

  grid3: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20,
  } as CSSProperties,

  grid2: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20,
  } as CSSProperties,
}

/* ── Card styles ── */
export const CARD: CSSProperties = {
  background: C.deep, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: 24,
}

export const CARD_HI: CSSProperties = {
  background: C.deep, border: `1px solid ${C.borderHi}`,
  borderRadius: 10, padding: 24,
}

/* ── Table ── */
export const TABLE: CSSProperties = {
  background: C.deep, border: `1px solid ${C.border}`,
  borderRadius: 10, overflow: 'hidden',
}

export const TABLE_HEADER: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 24px', borderBottom: `1px solid ${C.border}`,
}

export const TABLE_COL_HEADER = (cols: string): CSSProperties => ({
  display: 'grid', gridTemplateColumns: cols, gap: 16,
  padding: '10px 24px', borderBottom: 'rgba(80,130,210,0.08) 1px solid',
})

export const TABLE_ROW = (cols: string): CSSProperties => ({
  display: 'grid', gridTemplateColumns: cols, gap: 16,
  alignItems: 'center', padding: '14px 24px',
  borderBottom: `1px solid rgba(80,130,210,0.1)`,
  transition: 'background .2s', textDecoration: 'none', color: 'inherit',
})

/* ── Badge ── */
type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'muted'
export function badgeStyle(variant: BadgeVariant): CSSProperties {
  const map: Record<BadgeVariant, CSSProperties> = {
    green:  { color: C.green,  background: 'rgba(34,197,94,0.1)',      border: '1px solid rgba(34,197,94,0.2)' },
    yellow: { color: C.yellow, background: 'rgba(245,158,11,0.1)',     border: '1px solid rgba(245,158,11,0.2)' },
    red:    { color: C.red,    background: 'rgba(232,64,64,0.1)',      border: '1px solid rgba(232,64,64,0.2)' },
    blue:   { color: C.blueB,  background: 'oklch(55% 0.24 225/0.12)', border: '1px solid oklch(55% 0.24 225/0.25)' },
    muted:  { color: C.muted,  background: 'rgba(80,130,210,0.08)',    border: `1px solid ${C.border}` },
  }
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 100,
    fontFamily: FONT.jb, fontSize: 10,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    ...map[variant],
  }
}

/* ── Status helpers ── */
export const agentStatusVariant = (s: string): BadgeVariant =>
  s === 'active' ? 'green' : s === 'paused' ? 'yellow' : 'red'

export const agentStatusLabel: Record<string, string> = {
  active: 'Ativo', paused: 'Pausado', error: 'Erro',
}

export const convStatusVariant = (s: string): BadgeVariant =>
  s === 'resolved' ? 'green' : s === 'escalated' ? 'red' : 'yellow'

export const convStatusLabel: Record<string, string> = {
  open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado',
}
