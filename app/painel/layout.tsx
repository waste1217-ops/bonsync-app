import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { ClientThemeWrapper } from '@/components/ThemeToggle'

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

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
