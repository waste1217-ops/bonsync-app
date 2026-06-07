'use client'

import { useEffect, useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

export interface Notif {
  id: string
  kind: string
  title: string
  detail: string
  ts: string        // ISO
  href: string
  sev: 'alta' | 'media' | 'info'
}

const sevColor: Record<string, string> = { alta: C.red, media: C.yellow, info: C.blueB }
const SEEN_KEY = 'bonsync-notif-seen'

function tempo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export function NotificationsPanel({ notifs }: { notifs: Notif[] }) {
  const [seen, setSeen] = useState<number>(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const v = Number(localStorage.getItem(SEEN_KEY) || 0)
    setSeen(v); setReady(true)
  }, [])

  function marcarLidas() {
    const agora = Date.now()
    localStorage.setItem(SEEN_KEY, String(agora))
    setSeen(agora)
  }

  const naoLidas = ready ? notifs.filter(n => new Date(n.ts).getTime() > seen).length : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ ...T.sub }}>
          {ready && naoLidas > 0
            ? <span style={{ color: C.white }}><b>{naoLidas}</b> não lida{naoLidas > 1 ? 's' : ''} de {notifs.length}</span>
            : `${notifs.length} notificação(ões)`}
        </p>
        {notifs.length > 0 && (
          <button onClick={marcarLidas} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {!notifs.length ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '56px 24px' }}>
          <p style={{ fontSize: 30, marginBottom: 12 }}>🔕</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white }}>Tudo em dia! Nenhuma notificação no momento.</p>
          <p style={{ ...T.sub, marginTop: 4 }}>Avisamos aqui sobre leads quentes, conversas que precisam de você e problemas no agente.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifs.map(n => {
            const nova = ready && new Date(n.ts).getTime() > seen
            return (
              <a key={n.id} href={n.href} className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', borderColor: nova ? `${sevColor[n.sev]}55` : undefined }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: nova ? sevColor[n.sev] : 'transparent', border: nova ? 'none' : `1px solid ${C.border}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: FONT.dm, fontWeight: nova ? 600 : 500, fontSize: 14, color: C.white }}>{n.title}</p>
                  <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{n.detail}</p>
                </div>
                <span style={{ ...T.mono, fontSize: 9, color: C.faint, flexShrink: 0 }}>{tempo(n.ts)}</span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
