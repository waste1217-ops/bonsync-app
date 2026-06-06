import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'

export const dynamic = 'force-dynamic'

function Dot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: ok ? C.green : C.red,
      boxShadow: ok ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
    }} />
  )
}

export default async function AdminConfiguracoesPage() {
  const supabase = await createClient()

  const [{ count: clientes }, { count: agentes }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('agents').select('*', { count: 'exact', head: true }),
  ])

  const env = (k: string) => Boolean(process.env[k])

  const integracoes = [
    { nome: 'Supabase (banco + auth)', ok: env('NEXT_PUBLIC_SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'), detalhe: 'Armazenamento, autenticação e RLS' },
    { nome: 'Evolution API (WhatsApp)', ok: env('EVOLUTION_API_URL') && env('EVOLUTION_API_KEY'),               detalhe: 'Conexão dos números de WhatsApp' },
    { nome: 'Anthropic (Claude)',       ok: env('ANTHROPIC_API_KEY'),                                            detalhe: 'Modelo padrão do Copiloto' },
    { nome: 'Resend (e-mails)',         ok: env('RESEND_API_KEY') && env('EMAIL_FROM'),                          detalhe: 'Onboarding e digests automáticos' },
    { nome: 'Cron (automações)',        ok: env('CRON_SECRET'),                                                  detalhe: 'Disparos diários/semanais protegidos' },
    { nome: 'Webhook do agente',        ok: env('AGENT_WEBHOOK_URL'),                                            detalhe: 'Recebe eventos da Evolution na VPS' },
  ]

  const card = { ...CARD, marginBottom: 16 } as React.CSSProperties
  const sectionTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Configurações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Identidade da plataforma, integrações e ambiente.</p>
      </div>

      {/* Identidade */}
      <div style={card}>
        <h2 style={sectionTitle}>Plataforma</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            ['Nome', 'Bonsync'],
            ['Painel', 'app.bonsync.com.br'],
            ['Site', 'bonsync.com.br'],
            ['Clientes ativos no banco', String(clientes ?? 0)],
            ['Agentes configurados', String(agentes ?? 0)],
            ['Fuso horário', 'America/Sao_Paulo (BRT)'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>{k}</p>
              <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Integrações */}
      <div style={card}>
        <h2 style={sectionTitle}>Integrações & ambiente</h2>
        <p style={{ ...T.sub, fontSize: 12, marginTop: -8, marginBottom: 16 }}>
          Status das chaves configuradas na Vercel. Os valores nunca são exibidos — apenas se estão presentes.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {integracoes.map(i => (
            <div key={i.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px' }}>
              <Dot ok={i.ok} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{i.nome}</p>
                <p style={{ fontFamily: FONT.dm, fontSize: 12, color: C.muted, fontWeight: 300 }}>{i.detalhe}</p>
              </div>
              <span style={{ fontFamily: FONT.jb, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: i.ok ? C.green : C.red }}>
                {i.ok ? 'Configurado' : 'Ausente'}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 14 }}>
          Para alterar chaves, edite as variáveis de ambiente no projeto da Vercel e refaça o deploy.
        </p>
      </div>

      {/* Segurança & dados */}
      <div style={card}>
        <h2 style={sectionTitle}>Segurança & dados</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Isolamento por RLS — cada cliente acessa apenas os próprios dados',
            'Chaves de API dos agentes nunca são expostas ao cliente',
            'Anotações internas e responsável visíveis somente para a equipe',
            'Service role usado apenas no servidor, nunca no navegador',
          ].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Atalhos */}
      <div style={card}>
        <h2 style={sectionTitle}>Atalhos</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/admin/status" className="btn-ghost" style={{ fontSize: 13, padding: '10px 18px' }}>Status do sistema</a>
          <a href="/admin/instancias" className="btn-ghost" style={{ fontSize: 13, padding: '10px 18px' }}>Instâncias WhatsApp</a>
          <a href="/admin/templates" className="btn-ghost" style={{ fontSize: 13, padding: '10px 18px' }}>Templates de agente</a>
        </div>
      </div>
    </div>
  )
}
