import { C, FONT } from '@/lib/styles'

export interface Bar { label: string; value: number; sub?: string }

/** Gráfico de barras vertical simples (server component, sem libs). */
export function BarChart({ data, color = C.blueB, height = 140, suffix = '' }: { data: Bar[]; color?: string; height?: number; suffix?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, paddingTop: 18 }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * (height - 26), d.value > 0 ? 3 : 0)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.muted, lineHeight: 1 }}>{d.value > 0 ? `${d.value}${suffix}` : ''}</span>
            <div title={`${d.label}: ${d.value}${suffix}`} style={{
              width: '100%', maxWidth: 38, height: h, background: color, opacity: 0.85,
              borderRadius: '4px 4px 0 0', transition: 'height .3s',
            }} />
            <span style={{ fontFamily: FONT.jb, fontSize: 8, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Barra horizontal (rankings). */
export function RankBars({ data, color = C.blueB, suffix = '' }: { data: Bar[]; color?: string; suffix?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  if (!data.length) return <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>Sem dados no período.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <div style={{ flex: 1, height: 10, background: C.void, borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: color, opacity: 0.85, borderRadius: 100 }} />
          </div>
          <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted, width: 56, textAlign: 'right', flexShrink: 0 }}>{d.value}{suffix}{d.sub ? ` ${d.sub}` : ''}</span>
        </div>
      ))}
    </div>
  )
}
