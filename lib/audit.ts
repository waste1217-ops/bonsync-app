import { createAdminClient } from '@/lib/supabase/admin'

export interface AuditActor { id?: string | null; email?: string | null }
export interface AuditOpts { entity?: string; entityId?: string | null; details?: Record<string, unknown> }

/**
 * Registra uma ação administrativa no audit log. Usa service role para gravar
 * de forma confiável (bypassa RLS). Nunca lança — falha de log não quebra a ação.
 */
export async function logAction(actor: AuditActor, action: string, opts: AuditOpts = {}) {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      actor_id: actor.id ?? null,
      actor_email: actor.email ?? null,
      action,
      entity: opts.entity ?? null,
      entity_id: opts.entityId ?? null,
      details: opts.details ?? null,
    })
  } catch (e) {
    console.error('[audit] falha ao registrar ação:', e)
  }
}
