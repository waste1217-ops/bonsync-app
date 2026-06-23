'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, T, FONT } from '@/lib/styles'

const OPCOES = [
  { value: '24h',    label: 'Últimas 24 horas',  sub: 'Apaga as conversas iniciadas no último dia.' },
  { value: 'semana', label: 'Última semana',     sub: 'Apaga as conversas dos últimos 7 dias.' },
  { value: 'mes',    label: 'Último mês',         sub: 'Apaga as conversas dos últimos 30 dias.' },
  { value: 'tudo',   label: 'Todo o histórico',  sub: 'Apaga TODAS as conversas da sua conta.' },
]
const LABEL: Record<string, string> = { '24h': '24 horas', semana: '1 semana', mes: '1 mês', tudo: 'todo o histórico' }

export function LimparHistorico() {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1 | 2>(0)   // 0 fechado · 1 escolher período · 2 confirmar
  const [period, setPeriod] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function abrir() { setStep(1); setPeriod(''); setMsg(null) }
  function fechar() { if (busy) return; setStep(0); setPeriod('') }

  async function confirmar() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/painel/limpar-historico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setBusy(false); setMsg({ ok: false, text: data.error || 'Não foi possível apagar o histórico. Tente novamente.' }); return }
      setStep(0); setBusy(false)
      setMsg({ ok: true, text: 'Histórico apagado com sucesso.' })
      router.refresh()
      setTimeout(() => setMsg(null), 5000)
    } catch {
      setBusy(false); setMsg({ ok: false, text: 'Não foi possível apagar o histórico. Tente novamente.' })
    }
  }

  const ehTudo = period === 'tudo'

  return (
    <>
      <button onClick={abrir} className="btn-ghost" style={{ fontSize: 12.5, padding: '9px 16px', color: C.muted }}>
        Limpar histórico
      </button>

      {msg && step === 0 && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1001, maxWidth: 340, background: C.deep, border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.4)' : 'rgba(232,64,64,0.4)'}`, borderLeft: `3px solid ${msg.ok ? C.green : C.red}`, borderRadius: 10, padding: '12px 14px', boxShadow: '0 8px 30px oklch(20% 0.05 250 / 0.5)', display: 'flex', gap: 10 }}>
          <span style={{ color: msg.ok ? C.green : C.red }}>{msg.ok ? '✓' : '⚠'}</span>
          <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{msg.text}</span>
        </div>
      )}

      {step > 0 && (
        <div onClick={fechar} style={{ position: 'fixed', inset: 0, background: 'oklch(10% 0.03 250 / 0.7)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: C.deep, border: `1px solid ${C.borderHi}`, borderRadius: 16, padding: 24, position: 'relative' }}>
            <button onClick={fechar} aria-label="Fechar" style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>

            {step === 1 ? (
              <>
                <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 6 }}>Limpar histórico</h2>
                <p style={{ ...T.sub, fontSize: 13, marginBottom: 18 }}>Escolha o período que deseja apagar das suas conversas.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {OPCOES.map(o => {
                    const sel = period === o.value
                    const alerta = o.value === 'tudo'
                    const cor = alerta ? 'var(--c-red)' : 'var(--c-blue-b)'
                    return (
                      <label key={o.value} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 10,
                        background: sel ? `color-mix(in oklch, ${cor} 10%, transparent)` : C.void,
                        border: `1px solid ${sel ? `color-mix(in oklch, ${cor} 45%, transparent)` : alerta ? 'rgba(232,64,64,0.25)' : C.border}`,
                      }}>
                        <input type="radio" name="periodo" checked={sel} onChange={() => setPeriod(o.value)} style={{ marginTop: 3, accentColor: alerta ? '#e84040' : 'oklch(55% 0.24 225)' }} />
                        <div>
                          <p style={{ fontFamily: FONT.dm, fontSize: 14, fontWeight: 500, color: alerta ? 'var(--c-red)' : C.white }}>
                            {alerta && '⚠ '}{o.label}
                          </p>
                          <p style={{ fontFamily: FONT.dm, fontSize: 12, color: C.muted, fontWeight: 300, marginTop: 2 }}>{o.sub}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {msg && !msg.ok && <p style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.red, marginBottom: 12 }}>⚠ {msg.text}</p>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={fechar} className="btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
                  <button onClick={() => { setMsg(null); setStep(2) }} disabled={!period} className="btn-primary" style={{ fontSize: 13, opacity: period ? 1 : 0.5, cursor: period ? 'pointer' : 'not-allowed' }}>Limpar histórico</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 12 }}>Confirmar exclusão</h2>
                <div style={{ background: ehTudo ? 'rgba(232,64,64,0.08)' : C.void, border: `1px solid ${ehTudo ? 'rgba(232,64,64,0.3)' : C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, fontWeight: 300, lineHeight: 1.55, marginBottom: 10 }}>
                    Tem certeza de que deseja apagar o histórico selecionado? Esta ação não poderá ser desfeita.
                  </p>
                  <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: ehTudo ? 'var(--c-red)' : C.white }}>
                    Período selecionado: <b>{LABEL[period]}</b>
                  </p>
                </div>
                {msg && !msg.ok && <p style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.red, marginBottom: 12 }}>⚠ {msg.text}</p>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setStep(1)} disabled={busy} className="btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
                  <button onClick={confirmar} disabled={busy} className="btn-primary" style={{ fontSize: 13, background: ehTudo ? '#c23030' : undefined, opacity: busy ? 0.6 : 1 }}>
                    {busy ? 'Apagando…' : 'Confirmar e apagar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
