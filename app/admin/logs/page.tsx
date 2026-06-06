import { createClient } from '@/lib/supabase/server'
import { C, T, FONT } from '@/lib/styles'

export const dynamic = 'force-dynamic'

const ACTION_LABEL: Record<string, { txt: string; emoji: string }> = {
  'team.create':       { txt: 'Criou membro da equipe',   emoji: '👤' },
  'team.update':       { txt: 'Atualizou membro',          emoji: '✏️' },
  'client.create':     { txt: 'Criou cliente',             emoji: '🏢' },
  'client.delete':     { txt: 'Excluiu cliente',           emoji: '🗑️' },
  'agent.delete':      { txt: 'Excluiu agente',            emoji: '🗑️' },
  'agent.duplicate':   { txt: 'Duplicou agente',           emoji: '📋' },
  'client.reset_pwd':  { txt: 'Redefiniu senha',           emoji: '🔑' },
  'instance.create':   { txt: 'Criou instância WhatsApp',  emoji: '📱' },
  'onboarding.send':   { txt: 'Enviou onboarding',         emoji: '✉️' },
}

export default async function AdminLogsPage() {
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const lista = logs ?? []

  return (
    <div className="animate-slide-up" style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Registro de ações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Histórico das ações administrativas na plataforma (últimas 200).</p>
      </div>

      {!lista.length ? (
        <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, padding: '60px 24px', textAlign: 'center', ...T.sub }}>
          Nenhuma ação registrada ainda.
        </div>
      ) : (
        <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {lista.map((l: any) => {
            const meta = ACTION_LABEL[l.action] ?? { txt: l.action, emoji: '•' }
            return (
              <div key={l.id} className="trow" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>
                    {meta.txt}
                    {l.details?.email && <span style={{ color: C.muted }}> · {l.details.email}</span>}
                    {l.details?.target_email && <span style={{ color: C.muted }}> · {l.details.target_email}</span>}
                  </p>
                  <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted, marginTop: 2 }}>
                    por {l.actor_email || 'sistema'}
                  </p>
                </div>
                <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, flexShrink: 0, textAlign: 'right' }}>
                  {new Date(l.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
