import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { C, T, CARD, FONT } from '@/lib/styles'
import { RestoreVersionButton } from './RestoreVersionButton'

export default async function AgenteVersoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: agent } = await supabase.from('agents').select('id, name').eq('id', id).single()
  if (!agent) notFound()

  const { data: versoes } = await supabase
    .from('agent_versions')
    .select('*')
    .eq('agent_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="animate-slide-up" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <a href={`/admin/agentes/${id}`} style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>← Voltar ao agente</a>
        <h1 style={T.h1}>Histórico de versões</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          {agent.name} · {versoes?.length ?? 0} versão(ões) salva(s). Cada edição gera um ponto de restauração.
        </p>
      </div>

      {!versoes?.length && (
        <div style={{ ...CARD, padding: '64px 24px', textAlign: 'center', ...T.sub }}>
          Nenhuma versão registrada ainda. O histórico começa a ser gravado a partir da próxima edição.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {versoes?.map((v: any, i: number) => (
          <div key={v.id} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>
                  {v.name}{i === 0 ? '  ·  versão mais recente' : ''}
                </p>
                <p style={{ ...T.mono, color: C.faint, fontSize: 10, marginTop: 4 }}>
                  {new Date(v.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  {v.note ? ` · ${v.note}` : ''}
                </p>
              </div>
              <RestoreVersionButton agentId={id} versionId={v.id} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Modelo</p>
                <p style={{ fontFamily: FONT.jb, fontSize: 11, color: C.blueB }}>{v.config?.model ?? '—'}</p>
              </div>
              <div>
                <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Tom</p>
                <p style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>{v.config?.tom ?? '—'}</p>
              </div>
              {Array.isArray(v.tags) && v.tags.length > 0 && (
                <div>
                  <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Tags</p>
                  <p style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>{v.tags.join(', ')}</p>
                </div>
              )}
            </div>
            {v.config?.prompt && (
              <div>
                <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 6 }}>Prompt</p>
                <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', maxHeight: 120, overflow: 'auto' }}>
                  <p style={{ fontFamily: FONT.dm, fontSize: 12, color: C.muted, lineHeight: 1.6, fontWeight: 300, whiteSpace: 'pre-wrap' }}>
                    {v.config.prompt}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
