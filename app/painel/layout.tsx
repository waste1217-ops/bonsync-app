import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { ClientThemeWrapper } from '@/components/ThemeToggle'

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // Middleware já valida o token em toda rota protegida; aqui usamos a sessão
  // do cookie (sem round-trip extra ao Auth) para reduzir latência por render.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, role, email, company_name, created_at').eq('id', user.id).single()

  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')

  return (
    <ClientThemeWrapper>
      <div style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--c-void)',
        position: 'relative',
      }}>
        <Sidebar profile={profile} />
        <main style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '32px',
          position: 'relative',
          zIndex: 1,
        }}>
          {children}
        </main>
      </div>
    </ClientThemeWrapper>
  )
}
