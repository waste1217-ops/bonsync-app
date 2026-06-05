import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

// Retorna QR atual (para reconectar uma instância existente)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return NextResponse.json({ error: 'EVOLUTION_* não configurada.' }, { status: 500 })

  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 })

  try {
    const res = await fetch(`${url}/instance/connect/${name}`, { headers: { apikey: key }, cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `Evolution ${res.status}` }, { status: 502 })
    const d = await res.json()
    return NextResponse.json({ qr: d.base64 || d.qrcode?.base64 || '', code: d.code || d.pairingCode || null })
  } catch {
    return NextResponse.json({ error: 'Evolution inacessível.' }, { status: 502 })
  }
}
