import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { effectiveLevel } from '@/lib/permissions'
import { BackupPanel } from './BackupPanel'

export const dynamic = 'force-dynamic'

export default async function AdminBackupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, admin_level').eq('id', user!.id).single()
  const souOwner = effectiveLevel(me?.role, me?.admin_level) === 'owner'

  const [{ data: clientes }, { data: agentes }] = await Promise.all([
    supabase.from('profiles').select('id, company_name, email').eq('role', 'client').order('company_name'),
    supabase.from('agents').select('id, name, profiles(company_name)').order('created_at', { ascending: false }),
  ])

  const cls = (clientes ?? []).map((c: any) => ({ id: c.id, nome: c.company_name || c.email }))
  const ags = (agentes ?? []).map((a: any) => ({ id: a.id, nome: a.name, empresa: a.profiles?.company_name ?? '—' }))

  return (
    <div className="animate-slide-up" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={T.h1}>Backup</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          Exporte as configurações dos agentes e a base de conhecimento, e restaure quando precisar.
        </p>
      </div>
      <BackupPanel clientes={cls} agentes={ags} souOwner={souOwner} />
    </div>
  )
}
