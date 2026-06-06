import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, onboardingEmailHtml } from '@/lib/email'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { ctx, error: authError } = await requireAdmin({ write: true })
  if (authError) return authError

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

  await logAction(ctx!.actor, 'onboarding.send', { entity: 'client', details: { email: to } })
  return NextResponse.json({ success: true })
}
