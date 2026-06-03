import { createClient } from '@/lib/supabase/server'

export default async function AdminClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('profiles')
    .select('id, email, company_name, created_at, agents(id, name, status)')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  return (
    <div className="animate-slide-up max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white tracking-tight">Clientes</h1>
          <p className="text-muted text-sm font-light mt-1">{clientes?.length ?? 0} cliente{clientes?.length !== 1 ? 's' : ''} na plataforma.</p>
        </div>
        <a href="/admin/clientes/novo"
          className="inline-flex items-center gap-2 bg-white text-void text-sm font-medium px-5 py-2.5 rounded-full hover:-translate-y-px transition-transform no-underline">
          + Novo cliente
        </a>
      </div>

      <div className="bg-deep border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-border/50">
          {['Empresa', 'E-mail', 'Agentes', 'Cadastro'].map(h => (
            <span key={h} className="font-mono text-[9px] text-faint tracking-widest uppercase">{h}</span>
          ))}
        </div>
        {!clientes?.length && (
          <div className="px-6 py-16 text-center text-muted text-sm font-light">
            Nenhum cliente cadastrado ainda.{' '}
            <a href="/admin/clientes/novo" className="text-blue-bright hover:underline">Criar o primeiro</a>
          </div>
        )}
        {clientes?.map((c: any) => (
          <a key={c.id} href={`/admin/clientes/${c.id}`}
            className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-border/40 hover:bg-surface/40 transition-colors no-underline group">
            <span className="text-white text-sm font-medium group-hover:text-blue-bright transition-colors truncate">
              {c.company_name || '—'}
            </span>
            <span className="text-muted text-sm font-light truncate">{c.email}</span>
            <div className="flex gap-1.5 flex-wrap">
              {c.agents?.length > 0
                ? c.agents.map((a: any) => (
                  <span key={a.id} className={`font-mono text-[9px] px-2 py-0.5 rounded-full border
                    ${a.status === 'active' ? 'text-green bg-green/10 border-green/20'
                      : a.status === 'paused' ? 'text-yellow bg-yellow/10 border-yellow/20'
                      : 'text-red bg-red/10 border-red/20'}`}>
                    {a.name}
                  </span>
                ))
                : <span className="font-mono text-[10px] text-faint">nenhum</span>
              }
            </div>
            <span className="text-muted text-xs font-mono self-center">
              {new Date(c.created_at).toLocaleDateString('pt-BR')}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
