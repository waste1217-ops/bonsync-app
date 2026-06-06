import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { C, T, L, CARD, CARD_HI, TABLE, FONT, badgeStyle, agentStatusVariant, agentStatusLabel, convStatusVariant, convStatusLabel } from '@/lib/styles'
import { DeleteButton } from '@/components/DeleteButton'
import { ResetPasswordButton } from '@/components/ResetPasswordButton'
import { ClientActiveToggle } from '@/components/ClientActiveToggle'

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('profiles')
    .select('*, agents(*, conversations(count))')
    .eq('id', id)
    .eq('role', 'client')
    .single()

  if (!cliente) notFound()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_name, monthly_price, status, due_date')
    .eq('client_id', id)
    .single()

  // Status de cobrança
  let billing: { label: string; variant: 'green' | 'yellow' | 'red' | 'muted'; sub: string } | null = null
  if (sub?.due_date) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const venc = new Date(sub.due_date + 'T00:00:00')
    const dias = Math.round((venc.getTime() - hoje.getTime()) / 86400000)
    const fmt = venc.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    if (dias < 0)       billing = { label: 'Vencido', variant: 'red',    sub: `há ${Math.abs(dias)} dia(s) · ${fmt}` }
    else if (dias === 0) billing = { label: 'Vence hoje', variant: 'red', sub: fmt }
    else if (dias <= 7) billing = { label: 'A vencer', variant: 'yellow', sub: `em ${dias} dia(s) · ${fmt}` }
    else                billing = { label: 'Em dia', variant: 'green',    sub: `próximo: ${fmt}` }
  }

  const { data: conversas } = await supabase
    .from('conversations')
    .select('*, agents!inner(client_id)')
    .eq('agents.client_id', id)
    .order('started_at', { ascending: false })
    .limit(20)

  const totalConversas  = conversas?.length ?? 0
  const resolvidas      = conversas?.filter(c => c.status === 'resolved').length ?? 0
  const escaladas       = conversas?.filter(c => c.status === 'escalated').length ?? 0

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>

      {/* Back + Header */}
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/clientes" style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>
          ← Clientes
        </a>
        <div style={L.pageHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={T.h1}>{cliente.company_name || cliente.email}</h1>
              {cliente.active === false && <span style={badgeStyle('red')}>Acesso suspenso</span>}
            </div>
            <p style={{ ...T.sub, marginTop: 4 }}>
              {cliente.email} · cliente desde {new Date(cliente.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              {cliente.responsavel ? ` · responsável: ${cliente.responsavel}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={`/admin/clientes/${id}/editar`} className="btn-ghost" style={{ fontSize: 13, padding: '10px 20px' }}>
              Editar
            </a>
            <ResetPasswordButton clientId={id} clientName={cliente.company_name || cliente.email} />
            <ClientActiveToggle clientId={id} initialActive={cliente.active !== false} clientName={cliente.company_name || cliente.email} />
            <DeleteButton
              label="Excluir cliente"
              confirmText={`Tem certeza que deseja excluir o cliente "${cliente.company_name || cliente.email}"? Todos os agentes, conversas e dados serão removidos permanentemente.`}
              apiRoute="/api/admin/delete-client"
              body={{ client_id: id }}
              redirectTo="/admin/clientes"
            />
          </div>
        </div>
      </div>

      {/* Assinatura / cobrança */}
      {sub && (
        <div style={{ ...CARD, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ ...T.mono, color: C.muted, marginBottom: 6 }}>Assinatura</p>
            <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white }}>
              {sub.plan_name || 'Padrão'}
              {sub.monthly_price ? ` · R$ ${Number(sub.monthly_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês` : ''}
              {' · '}
              <span style={{ color: sub.status === 'active' ? C.green : sub.status === 'trial' ? C.yellow : C.red }}>
                {sub.status === 'active' ? 'Ativo' : sub.status === 'trial' ? 'Em teste' : 'Cancelado'}
              </span>
            </p>
          </div>
          {billing && (
            <div style={{ textAlign: 'right' }}>
              <span style={badgeStyle(billing.variant)}>{billing.label}</span>
              <p style={{ ...T.mono, color: C.faint, fontSize: 10, marginTop: 6 }}>{billing.sub}</p>
            </div>
          )}
        </div>
      )}

      {/* Anotações internas (só admin vê esta tela) */}
      {cliente.internal_notes && (
        <div style={{ ...CARD, marginBottom: 20, borderColor: 'rgba(245,158,11,0.3)' }}>
          <p style={{ ...T.mono, color: C.yellow, marginBottom: 8 }}>🔒 Anotações internas</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, lineHeight: 1.6, fontWeight: 300, whiteSpace: 'pre-wrap' }}>
            {cliente.internal_notes}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Agentes',    value: cliente.agents?.length ?? 0 },
          { label: 'Conversas', value: totalConversas },
          { label: 'Resolvidas', value: resolvidas },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 36, color: C.blueB, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Agentes do cliente */}
      <div style={{ ...TABLE, marginBottom: 20 }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Agentes</h2>
          <a href="/admin/agentes/novo" style={{ ...T.mono, fontSize: 10, color: C.blueB }}>+ Novo agente</a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Nome', 'Modelo', 'Conversas', 'Status'].map(h => (
            <span key={h} style={T.tableHead}>{h}</span>
          ))}
        </div>

        {!cliente.agents?.length && (
          <div style={{ padding: '40px 24px', textAlign: 'center', ...T.sub }}>
            Nenhum agente configurado.{' '}
            <a href="/admin/agentes/novo" style={{ color: C.blueB }}>Criar agente</a>
          </div>
        )}

        {cliente.agents?.map((a: any) => (
          <a key={a.id} href={`/admin/agentes/${a.id}`} className="trow"
            style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 16, cursor: 'pointer' }}>
            <div>
              <p style={T.cell}>{a.name}</p>
              {a.description && <p style={{ ...T.cellMuted, fontSize: 12, marginTop: 2 }}>{a.description}</p>}
            </div>
            <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.blueB }}>{a.config?.model ?? '—'}</span>
            <span style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 20, color: C.blueB }}>
              {Array.isArray(a.conversations) ? (a.conversations[0]?.count ?? 0) : 0}
            </span>
            <span style={badgeStyle(agentStatusVariant(a.status))}>{agentStatusLabel[a.status]}</span>
          </a>
        ))}
      </div>

      {/* Conversas recentes */}
      <div style={TABLE}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Conversas recentes</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Contato', 'Canal', 'Status', 'Data'].map(h => (
            <span key={h} style={T.tableHead}>{h}</span>
          ))}
        </div>

        {!conversas?.length && (
          <div style={{ padding: '40px 24px', textAlign: 'center', ...T.sub }}>Nenhuma conversa registrada.</div>
        )}

        {conversas?.map(c => (
          <div key={c.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16 }}>
            <span style={T.cell}>{c.contact_identifier || 'Anônimo'}</span>
            <span style={T.cellMono}>{c.channel}</span>
            <span style={badgeStyle(convStatusVariant(c.status))}>{convStatusLabel[c.status]}</span>
            <span style={T.cellMono}>{new Date(c.started_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
