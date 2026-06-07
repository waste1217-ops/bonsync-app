import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Reinicia a conexão da instância de WhatsApp do agente do cliente (Evolution).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: agent } = await supabase.from('agents').select('config').eq('client_id', user.id).single()
  const instance = (agent?.config as any)?.whatsapp_instance
  if (!instance) return NextResponse.json({ error: 'Nenhuma instância de WhatsApp configurada.' }, { status: 400 })

  const url = process.env.EVOLUTION_API_URL, key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return NextResponse.json({ error: 'Conexão indisponível no momento.' }, { status: 503 })

  try {
    const res = await fetch(`${url}/instance/restart/${instance}`, { method: 'POST', headers: { apikey: key }, cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `Não foi possível reiniciar (HTTP ${res.status}).` }, { status: 502 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Falha ao contatar o servidor de conexão.' }, { status: 502 })
  }
}
