import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, onboardingEmailHtml } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { to, companyName, password, connectUrl } = await req.json()
  if (!to || !password) return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })

  const result = await sendEmail({
    to,
    subject: 'Sua conta na Bonsync está pronta 🎉',
    html: onboardingEmailHtml({
      companyName: companyName || 'cliente',
      loginEmail: to,
      password,
      connectUrl: connectUrl || null,
    }),
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ success: true })
}
