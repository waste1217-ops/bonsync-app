import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100%',
      overflow: 'hidden',
      background: '#060a10',
      position: 'relative',
    }}>
      <Sidebar profile={profile} />
      <main style={{
        flex: 1,
        minWidth: 0,          /* evita overflow do flex filho */
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '32px',
        position: 'relative',
        zIndex: 1,
      }}>
        {children}
      </main>
    </div>
  )
}
