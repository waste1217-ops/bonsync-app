import { createClient } from '@/lib/supabase/server'
import { C, T, L, CARD, FONT, badgeStyle } from '@/lib/styles'
import { TemplateActions } from './TemplateActions'

export default async function AdminTemplatesPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('agent_templates')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>

      {/* Header */}
      <div style={L.pageHeader}>
        <div>
          <h1 style={T.h1}>Templates de agente</h1>
          <p style={{ ...T.sub, marginTop: 4 }}>
            Modelos reutilizáveis para criar novos agentes mais rápido. {templates?.length ?? 0} template{templates?.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <a href="/admin/templates/novo" className="btn-primary">+ Novo template</a>
      </div>

      {/* Vazio */}
      {!templates?.length && (
        <div style={{ ...CARD, padding: '64px 24px', textAlign: 'center' }}>
          <p style={{ ...T.sub, marginBottom: 8 }}>Nenhum template criado ainda.</p>
          <p style={{ ...T.sub, fontSize: 12 }}>
            Crie um do zero em{' '}
            <a href="/admin/templates/novo" style={{ color: C.blueB }}>Novo template</a>{' '}
            — ou salve um agente existente como template a partir da página do agente.
          </p>
        </div>
      )}

      {/* Grid de templates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {templates?.map((t: any) => (
          <div key={t.id} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>{t.name}</h2>
              {t.category && <span style={badgeStyle('blue')}>{t.category}</span>}
            </div>
            {t.description && (
              <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.6 }}>
                {t.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 4 }}>
              <div>
                <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Modelo</p>
                <p style={{ fontFamily: FONT.jb, fontSize: 11, color: C.blueB }}>{t.config?.model ?? '—'}</p>
              </div>
              <div>
                <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>Tom</p>
                <p style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>{t.config?.tom ?? '—'}</p>
              </div>
            </div>
            <TemplateActions templateId={t.id} templateName={t.name} />
          </div>
        ))}
      </div>
    </div>
  )
}
