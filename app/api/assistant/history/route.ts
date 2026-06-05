import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data } = await supabase
    .from('copiloto_messages').select('role, content')
    .eq('user_id', user.id).order('created_at', { ascending: true }).limit(100)

  return NextResponse.json({ messages: data ?? [] })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  await supabase.from('copiloto_messages').delete().eq('user_id', user.id)
  await supabase.from('copiloto_memory').delete().eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
