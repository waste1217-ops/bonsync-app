'use client'

import { useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

interface Opt { id: string; nome: string; empresa?: string }

export function BackupPanel({ clientes, agentes, souOwner }: { clientes: Opt[]; agentes: Opt[]; souOwner: boolean }) {
  // Export
  const [escopo, setEscopo] = useState('')      // '' = global
  const [exporting, setExporting] = useState(false)
  const [expErr, setExpErr] = useState('')

  // Restore
  const [alvo, setAlvo] = useState('')
  const [modo, setModo] = useState<'knowledge' | 'config' | 'both'>('knowledge')
  const [arquivo, setArquivo] = useState<any>(null)
  const [arqNome, setArqNome] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [resMsg, setResMsg] = useState('')
  const [resErr, setResErr] = useState('')

  async function exportar() {
    setExporting(true); setExpErr('')
    try {
      const qs = escopo ? `?client_id=${escopo}` : '?scope=global'
      const res = await fetch(`/api/admin/backup${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao exportar.')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const nome = escopo ? (clientes.find(c => c.id === escopo)?.nome || 'cliente') : 'plataforma'
      a.href = url
      a.download = `backup-bonsync-${nome.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { setExpErr(e.message) }
    setExporting(false)
  }

  function lerArquivo(f: File) {
    setArqNome(f.name); setResErr(''); setResMsg('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result))
        if (!json.bonsync_backup) { setResErr('Arquivo não é um backup da Bonsync.'); setArquivo(null); return }
        setArquivo(json)
      } catch { setResErr('Arquivo JSON inválido.'); setArquivo(null) }
    }
    reader.readAsText(f)
  }

  async function restaurar() {
    if (!alvo) { setResErr('Selecione o agente de destino.'); return }
    if (!arquivo) { setResErr('Selecione um arquivo de backup.'); return }
    const qtdAgentes = Array.isArray(arquivo.agents) ? arquivo.agents.length : 1
    if (qtdAgentes > 1 && !confirm('O backup tem vários agentes; será usado o primeiro deles. Continuar?')) return
    if (!confirm(modo === 'knowledge'
      ? 'Os itens de conhecimento do backup serão ADICIONADOS ao agente. Continuar?'
      : 'A configuração do agente será sobrescrita (uma versão atual é salva antes). Continuar?')) return

    setRestoring(true); setResErr(''); setResMsg('')
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: alvo, mode: modo, data: arquivo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao restaurar.')
      const partes = []
      if (data.restoredCfg) partes.push('configuração restaurada')
      if (data.restoredKnow) partes.push(`${data.restoredKnow} item(ns) de conhecimento adicionados`)
      setResMsg(partes.length ? `✅ ${partes.join(' · ')}.` : '✅ Concluído (nada a restaurar).')
    } catch (e: any) { setResErr(e.message) }
    setRestoring(false)
  }

  const titulo = { fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 } as React.CSSProperties

  return (
    <div>
      {/* Exportar */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <h2 style={titulo}>Exportar</h2>
        <p style={{ ...T.sub, fontSize: 12, marginBottom: 16 }}>
          Gera um arquivo JSON com nome, descrição, tags, configuração (sem a chave de API) e conhecimento dos agentes.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={T.label}>Escopo</label>
            <select className="field" value={escopo} onChange={e => setEscopo(e.target.value)} style={{ width: 'auto', minWidth: 220 }}>
              {souOwner && <option value="">Toda a plataforma</option>}
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <button onClick={exportar} disabled={exporting} className="btn-primary" style={{ fontSize: 13 }}>
            {exporting ? 'Gerando…' : '⬇ Baixar backup'}
          </button>
        </div>
        {!souOwner && <p style={{ ...T.mono, fontSize: 9, color: C.faint, marginTop: 10 }}>O backup de toda a plataforma é restrito ao Dono.</p>}
        {expErr && <p style={{ color: C.red, fontFamily: FONT.dm, fontSize: 13, marginTop: 10 }}>{expErr}</p>}
      </div>

      {/* Restaurar */}
      <div style={CARD}>
        <h2 style={titulo}>Restaurar</h2>
        <p style={{ ...T.sub, fontSize: 12, marginBottom: 16 }}>
          Aplica um arquivo de backup a um agente. Conhecimento é adicionado; configuração sobrescreve (salvando uma versão antes, preservando chave e instância atuais).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={T.label}>Agente de destino</label>
            <select className="field" value={alvo} onChange={e => setAlvo(e.target.value)}>
              <option value="">Selecione…</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.empresa})</option>)}
            </select>
          </div>
          <div>
            <label style={T.label}>O que restaurar</label>
            <select className="field" value={modo} onChange={e => setModo(e.target.value as any)} style={{ width: 'auto' }}>
              <option value="knowledge">Somente conhecimento</option>
              <option value="config">Somente configuração</option>
              <option value="both">Configuração + conhecimento</option>
            </select>
          </div>
          <div>
            <label style={T.label}>Arquivo de backup (.json)</label>
            <input type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f) }}
              style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }} />
            {arqNome && <p style={{ ...T.mono, fontSize: 9, color: arquivo ? C.green : C.faint, marginTop: 6 }}>{arquivo ? '✓ ' : ''}{arqNome}</p>}
          </div>
          <button onClick={restaurar} disabled={restoring} className="btn-primary" style={{ alignSelf: 'flex-start', fontSize: 13 }}>
            {restoring ? 'Restaurando…' : 'Restaurar'}
          </button>
          {resMsg && <p style={{ color: C.green, fontFamily: FONT.dm, fontSize: 13 }}>{resMsg}</p>}
          {resErr && <p style={{ color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>{resErr}</p>}
        </div>
      </div>
    </div>
  )
}
