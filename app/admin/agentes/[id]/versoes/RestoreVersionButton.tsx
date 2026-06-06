'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RestoreVersionButton({ agentId, versionId }: { agentId: string; versionId: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function restaurar() {
    if (!confirm('Restaurar esta versão? A configuração atual será salva como uma nova versão antes de aplicar — nada é perdido. O status (ativo/pausado) não muda.')) return
    setBusy(true)

    // Lê a versão alvo e o estado atual do agente
    const [{ data: versao, error: e1 }, { data: atual, error: e2 }] = await Promise.all([
      supabase.from('agent_versions').select('*').eq('id', versionId).single(),
      supabase.from('agents').select('name, description, tags, config').eq('id', agentId).single(),
    ])
    if (e1 || !versao || e2 || !atual) { alert('Não foi possível carregar os dados.'); setBusy(false); return }

    // Snapshot do estado atual (para poder desfazer a restauração)
    await supabase.from('agent_versions').insert({
      agent_id: agentId,
      name: atual.name,
      description: atual.description,
      tags: atual.tags ?? [],
      config: atual.config ?? {},
      note: 'antes de restaurar',
    })

    // Preserva a chave de API atual (versões antigas podem não tê-la / tê-la diferente)
    const novaConfig = { ...(versao.config || {}) }
    const chaveAtual = (atual.config as any)?.anthropic_key
    if (chaveAtual) (novaConfig as any).anthropic_key = chaveAtual

    const { error: e3 } = await supabase.from('agents').update({
      name: versao.name,
      description: versao.description,
      tags: versao.tags ?? [],
      config: novaConfig,
      updated_at: new Date().toISOString(),
    }).eq('id', agentId)

    if (e3) { alert(e3.message); setBusy(false); return }
    router.push(`/admin/agentes/${agentId}`)
    router.refresh()
  }

  return (
    <button onClick={restaurar} disabled={busy} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>
      {busy ? 'Restaurando…' : 'Restaurar'}
    </button>
  )
}
