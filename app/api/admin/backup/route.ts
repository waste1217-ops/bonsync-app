import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'

export const maxDuration = 60

// GET — exporta backup (JSON) dos agentes + conhecimento.
// ?scope=global  (exige owner)  |  ?client_id=<id>  (admin)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clientId = url.searchParams.get('client_id')
  const isGlobal = !clientId

  const { ctx, error } = await requireAdmin(isGlobal ? { owner: true } : {})
  if (error) return error

  const admin = createAdminClient()

  let q = admin.from('agents').select('id, name, description, tags, status, config, client_id, profiles(company_name)')
  if (clientId) q = q.eq('client_id', clientId)
  const { data: agentes } = await q
  const ags = agentes ?? []

  const ids = ags.map((a: any) => a.id)
  const { data: kb } = ids.length
    ? await admin.from('knowledge_base').select('agent_id, content, active').in('agent_id', ids)
    : { data: [] as any[] }

  const knowByAgent: Record<string, any[]> = {}
  for (const k of kb ?? []) (knowByAgent[k.agent_id] ??= []).push({ content: k.content, active: k.active })

  const payload = {
    bonsync_backup: true,
    version: 1,
    exported_at: new Date().toISOString(),
    scope: clientId || 'global',
    agents: ags.map((a: any) => {
      const cfg = { ...(a.config || {}) }
      delete (cfg as any).anthropic_key          // nunca exporta a chave
      delete (cfg as any).whatsapp_instance       // específico da instância
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        tags: a.tags ?? [],
        status: a.status,
        empresa: a.profiles?.company_name ?? null,
        config: cfg,
        knowledge: knowByAgent[a.id] ?? [],
      }
    }),
  }

  await logAction(ctx!.actor, 'backup.export', { entity: 'backup', entityId: clientId || 'global', details: { agentes: ags.length } })
  return NextResponse.json(payload)
}

// POST — restaura conhecimento e/ou configuração para UM agente
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireAdmin({ write: true })
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const agentId: string = body.agent_id
  const mode: string = body.mode || 'knowledge'      // 'knowledge' | 'config' | 'both'
  const source = body.data                            // um item de "agents[]" do arquivo (ou o arquivo inteiro)

  if (!agentId) return NextResponse.json({ error: 'agent_id obrigatório.' }, { status: 400 })
  if (!source) return NextResponse.json({ error: 'Arquivo de backup inválido.' }, { status: 400 })

  // aceita tanto um objeto de agente quanto o arquivo inteiro (pega o 1º agente)
  const ag = Array.isArray(source.agents) ? source.agents[0] : source
  if (!ag) return NextResponse.json({ error: 'Backup sem dados de agente.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: atual } = await admin.from('agents').select('name, description, tags, config').eq('id', agentId).single()
  if (!atual) return NextResponse.json({ error: 'Agente de destino não encontrado.' }, { status: 404 })

  let restoredKnow = 0, restoredCfg = false

  if (mode === 'config' || mode === 'both') {
    // snapshot antes de sobrescrever
    await admin.from('agent_versions').insert({
      agent_id: agentId, name: atual.name, description: atual.description,
      tags: atual.tags ?? [], config: atual.config ?? {}, note: 'antes de restaurar backup',
    })
    const novaConfig = { ...(ag.config || {}) }
    const chave = (atual.config as any)?.anthropic_key
    const inst = (atual.config as any)?.whatsapp_instance
    if (chave) (novaConfig as any).anthropic_key = chave       // preserva chave atual
    if (inst) (novaConfig as any).whatsapp_instance = inst     // preserva instância atual
    const { error: e1 } = await admin.from('agents').update({
      name: ag.name ?? atual.name,
      description: ag.description ?? atual.description,
      tags: ag.tags ?? atual.tags ?? [],
      config: novaConfig,
      updated_at: new Date().toISOString(),
    }).eq('id', agentId)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 })
    restoredCfg = true
  }

  if (mode === 'knowledge' || mode === 'both') {
    const itens = (ag.knowledge ?? []).filter((k: any) => k?.content)
    if (itens.length) {
      const rows = itens.map((k: any) => ({ agent_id: agentId, content: String(k.content), active: k.active ?? true }))
      const { error: e2 } = await admin.from('knowledge_base').insert(rows)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })
      restoredKnow = rows.length
    }
  }

  await logAction(ctx!.actor, 'backup.restore', { entity: 'agent', entityId: agentId, details: { mode, knowledge: restoredKnow, config: restoredCfg } })
  return NextResponse.json({ success: true, restoredKnow, restoredCfg })
}
