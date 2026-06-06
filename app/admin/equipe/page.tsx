import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'
import { effectiveLevel } from '@/lib/permissions'
import { TeamManager } from './TeamManager'

export const dynamic = 'force-dynamic'

export default async function AdminEquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: me } = await supabase.from('profiles').select('role, admin_level').eq('id', user!.id).single()
  const souOwner = effectiveLevel(me?.role, me?.admin_level) === 'owner'

  if (!souOwner) {
    return (
      <div className="animate-slide-up" style={{ maxWidth: 640 }}>
        <h1 style={T.h1}>Equipe</h1>
        <div style={{ ...CARD, marginTop: 20, textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 30, marginBottom: 12 }}>🔒</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white, marginBottom: 6 }}>Acesso restrito</p>
          <p style={{ ...T.sub }}>Apenas contas com nível <strong style={{ color: C.blueB }}>Dono</strong> podem gerenciar a equipe.</p>
        </div>
      </div>
    )
  }

  const { data: membros } = await supabase
    .from('profiles')
    .select('id, email, company_name, admin_level, active, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })

  const lista = (membros ?? []).map((m: any) => ({
    id: m.id,
    email: m.email,
    nome: m.company_name || m.email,
    admin_level: effectiveLevel('admin', m.admin_level)!,
    active: m.active !== false,
    created_at: m.created_at,
    isSelf: m.id === user!.id,
  }))

  return (
    <div className="animate-slide-up" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Equipe</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Gerencie os administradores da Bonsync e seus níveis de acesso.</p>
      </div>
      <TeamManager membros={lista} />
    </div>
  )
}
