'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function TemplateActions({ templateId, templateName }: { templateId: string; templateName: string }) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function excluir() {
    if (!confirm(`Excluir o template "${templateName}"? Agentes já criados a partir dele não são afetados.`)) return
    setDeleting(true)
    const { error } = await supabase.from('agent_templates').delete().eq('id', templateId)
    if (error) { alert(error.message); setDeleting(false); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <a href={`/admin/agentes/novo?template=${templateId}`} className="btn-primary"
        style={{ fontSize: 12, padding: '8px 16px', flex: 1, textAlign: 'center' }}>
        Usar template
      </a>
      <button onClick={excluir} disabled={deleting} className="btn-ghost"
        style={{ fontSize: 12, padding: '8px 14px', color: 'var(--c-red)' }}>
        {deleting ? '…' : 'Excluir'}
      </button>
    </div>
  )
}
