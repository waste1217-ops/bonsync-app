'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, T, FONT } from '@/lib/styles'

interface Props {
  mode: 'top' | 'side'
  period: string
  periodoLabel: string
  csv: string[][]
  resumo: string
  linhas: [string, string][]
}

const PRESETS = [['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês']]

export function RelatorioActions({ mode, period, periodoLabel, csv, resumo, linhas }: Props) {
  const router = useRouter()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [busy, setBusy] = useState('')

  function exportarCSV() {
    const conteudo = csv.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  function pdf() { window.print() }
  async function email() {
    setBusy('email'); setEmailMsg('')
    const res = await fetch('/api/painel/enviar-relatorio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodo: periodoLabel, resumo, linhas }) })
    const data = await res.json(); setBusy('')
    setEmailMsg(res.ok ? '✓ Relatório enviado para o seu e-mail.' : (data.error || 'Falha ao enviar.'))
    setTimeout(() => setEmailMsg(''), 4000)
  }

  if (mode === 'side') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={pdf} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Exportar PDF<span style={{ color: C.faint }}>⎙</span></button>
        <button onClick={email} disabled={busy === 'email'} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>{busy === 'email' ? 'Enviando…' : 'Enviar por e-mail'}<span style={{ color: C.faint }}>✉</span></button>
        <a href="/painel/avaliacoes" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Gerar resumo comercial<span style={{ color: C.faint }}>→</span></a>
        <a href="/painel/conversas" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Ver conversas com humano<span style={{ color: C.faint }}>→</span></a>
        <a href="/painel/leads" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Ver leads<span style={{ color: C.faint }}>→</span></a>
        {emailMsg && <p style={{ fontFamily: FONT.dm, fontSize: 12, color: emailMsg.startsWith('✓') ? C.green : C.red, marginTop: 6 }}>{emailMsg}</p>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }} className="rel-noprint">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PRESETS.map(([v, l]) => (
          <button key={v} onClick={() => router.push(`/painel/metricas?p=${v}`)} className={period === v ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 12, padding: '8px 14px' }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="date" className="field" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '7px 10px' }} />
        <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>até</span>
        <input type="date" className="field" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '7px 10px' }} />
        <button onClick={() => from && to && router.push(`/painel/metricas?from=${from}&to=${to}`)} className="btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }}>Aplicar</button>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={exportarCSV} className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }}>⬇ Exportar</button>
      <button onClick={pdf} className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }}>⎙ Gerar PDF</button>
      <button onClick={email} disabled={busy === 'email'} className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }}>{busy === 'email' ? 'Enviando…' : '✉ Enviar por e-mail'}</button>
      {emailMsg && <span style={{ fontFamily: FONT.dm, fontSize: 12, color: emailMsg.startsWith('✓') ? C.green : C.red, width: '100%' }}>{emailMsg}</span>}
    </div>
  )
}
