import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return NextResponse.json({ error: 'EVOLUTION_* não configurada.' }, { status: 500 })

  try {
    const res = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key }, cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `Evolution ${res.status}` }, { status: 502 })
    const data = await res.json()
    const instances = (Array.isArray(data) ? data : []).map((i: any) => ({
      name: i.name,
      status: i.connectionStatus || 'unknown',
      number: i.ownerJid ? String(i.ownerJid).split('@')[0] : null,
    }))
    return NextResponse.json({ instances })
  } catch {
    return NextResponse.json({ error: 'Evolution inacessível.' }, { status: 502 })
  }
}
