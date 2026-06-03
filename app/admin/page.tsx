import { createClient } from '@/lib/supabase/server'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [{ count: totalClientes }, { count: totalAgentes }, { count: totalConversas }, { data: clientes }] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select(`
        id, email, company_name, created_at,
        agents(id, name, status)
      `).eq('role', 'client').order('created_at', { ascending: false }).limit(10),
    ])

  const stats = [
    { label: 'Clientes ativos', value: totalClientes ?? 0, color: 'text-blue-bright' },
    { label: 'Agentes configurados', value: totalAgentes ?? 0, color: 'text-blue-bright' },
    { label: 'Conversas registradas', value: totalConversas ?? 0, color: 'text-green' },
  ]

  return (
    <div className="animate-slide-up max-w-6xl">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-white tracking-tight">Visão geral</h1>
        <p className="text-muted text-sm font-light mt-1">Todos os clientes e agentes da plataforma Bonsync.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-deep border border-border rounded-xl p-6">
            <p className="font-mono text-[10px] text-muted tracking-widest uppercase mb-3">{s.label}</p>
            <p className={`font-heading font-bold text-4xl tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Clientes recentes */}
      <div className="bg-deep border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-semibold text-base text-white">Clientes</h2>
          <a href="/admin/clientes" className="font-mono text-[10px] text-blue-bright tracking-wider hover:underline">
            Ver todos →
          </a>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-border/50">
          {['Empresa', 'E-mail', 'Agentes', 'Cadastro'].map(h => (
            <span key={h} className="font-mono text-[9px] text-faint tracking-widest uppercase">{h}</span>
          ))}
        </div>

        {/* Rows */}
        {!clientes?.length && (
          <div className="px-6 py-12 text-center text-muted text-sm font-light">
            Nenhum cliente cadastrado ainda.
          </div>
        )}
        {clientes?.map((c: any) => (
          <a key={c.id} href={`/admin/clientes/${c.id}`}
            className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-border/40 hover:bg-surface/40 transition-colors no-underline">
            <span className="text-white text-sm font-sans font-medium truncate">{c.company_name || '—'}</span>
            <span className="text-muted text-sm font-light truncate">{c.email}</span>
            <span className="text-sm">
              {c.agents?.length > 0
                ? <span className="font-mono text-[10px] text-blue-bright bg-blue/10 border border-blue/20 px-2 py-0.5 rounded-full">
                    {c.agents.length} agente{c.agents.length > 1 ? 's' : ''}
                  </span>
                : <span className="font-mono text-[10px] text-faint">nenhum</span>
              }
            </span>
            <span className="text-muted text-xs font-mono">
              {new Date(c.created_at).toLocaleDateString('pt-BR')}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
