import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Rota PÚBLICA — o cliente acessa via link para conectar o WhatsApp.
// A chave da Evolution nunca é exposta (fica no servidor).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return NextResponse.json({ error: 'config' }, { status: 500 })

  // Token → instância
  let instance: string | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('instance_connect_tokens').select('instance').eq('token', token).single()
    instance = data?.instance ?? null
  } catch { instance = null }
  if (!instance) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })

  try {
    // Status atual
    let status = 'unknown'
    const list = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key }, cache: 'no-store' })
    if (list.ok) {
      const arr = await list.json()
      const found = (Array.isArray(arr) ? arr : []).find((i: any) => i.name === instance)
      status = found?.connectionStatus || 'unknown'
    }

    // Já conectado? não precisa de QR
    if (status === 'open') {
      return NextResponse.json({ status: 'open', qr: '' })
    }

    // Gera/atualiza QR
    let qr = ''
    const conn = await fetch(`${url}/instance/connect/${instance}`, { headers: { apikey: key }, cache: 'no-store' })
    if (conn.ok) { const d = await conn.json(); qr = d.base64 || d.qrcode?.base64 || '' }

    return NextResponse.json({ status, qr })
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 502 })
  }
}
