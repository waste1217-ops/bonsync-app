'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SaveAsTemplateButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function salvar() {
    const nome = prompt('Nome do template:', `Template de ${agentName}`)
    if (!nome) return
    const categoria = prompt('Categoria (opcional):', '') || null
    setSaving(true)

    const { data: agent, error: e1 } = await supabase.from('agents').select('config, description').eq('id', agentId).single()
    if (e1 || !agent) { alert('Não foi possível ler o agente.'); setSaving(false); return }

    // Remove dados sensíveis / específicos da instância
    const cfg = { ...(agent.config || {}) }
    delete (cfg as any).anthropic_key
    delete (cfg as any).whatsapp_instance

    const { error: e2 } = await supabase.from('agent_templates').insert({
      name: nome.trim(),
      description: agent.description || null,
      category: categoria,
      config: cfg,
    })
    if (e2) { alert(e2.message); setSaving(false); return }

    router.push('/admin/templates')
    router.refresh()
  }

  return (
    <button onClick={salvar} disabled={saving} className="btn-ghost" style={{ fontSize: 12, padding: '9px 18px' }}>
      {saving ? 'Salvando…' : 'Salvar como template'}
    </button>
  )
}
