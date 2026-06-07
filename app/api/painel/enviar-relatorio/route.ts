import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailShell } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { periodo, resumo, linhas } = await req.json().catch(() => ({}))
  const itens: [string, string][] = Array.isArray(linhas) ? linhas : []

  const { data: prof } = await supabase.from('profiles').select('company_name').eq('id', user.id).single()
  const empresa = prof?.company_name || 'sua empresa'

  const linhasHtml = itens.map(([k, v]) =>
    `<tr><td style="padding:8px 0;color:#9fb0c8;font-size:13px;">${k}</td><td style="padding:8px 0;color:#eef2ff;font-size:14px;text-align:right;font-weight:600;">${v}</td></tr>`
  ).join('')

  const inner = `
    <h1 style="font-size:20px;color:#eef2ff;margin:0 0 6px;">Relatório do agente</h1>
    <p style="color:#9fb0c8;font-size:13px;margin:0 0 18px;">${empresa} · ${periodo || 'período selecionado'}</p>
    <p style="color:#cdd8ea;font-size:14px;line-height:1.6;margin:0 0 20px;">${(resumo || '').replace(/</g, '&lt;')}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(120,160,220,0.15);">${linhasHtml}</table>
  `
  const result = await sendEmail({ to: user.email, subject: `Relatório do seu agente — ${periodo || 'resumo'}`, html: emailShell(inner, 'Resumo de desempenho do seu agente Bonsync') })
  if (!result.ok) return NextResponse.json({ error: result.error || 'Falha ao enviar.' }, { status: 502 })
  return NextResponse.json({ success: true })
}
