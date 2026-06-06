import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 90

const MAX_CHARS = 16000     // limite total extraído por importação
const CHUNK = 1800          // tamanho de cada item de conhecimento

function chunk(text: string, label: string): string[] {
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS)
  if (!clean) return []
  const paras = clean.split(/\n\n+/)
  const out: string[] = []
  let buf = ''
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > CHUNK && buf) { out.push(buf.trim()); buf = '' }
    buf = buf ? `${buf}\n\n${p}` : p
    while (buf.length > CHUNK) { out.push(buf.slice(0, CHUNK).trim()); buf = buf.slice(CHUNK) }
  }
  if (buf.trim()) out.push(buf.trim())
  return out.map(c => `[${label}]\n${c}`)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

async function pdfToText(base64: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Servidor sem chave de IA para ler PDF.')
  const anthropic = new Anthropic({ apiKey })
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
        { type: 'text', text: 'Extraia TODO o texto útil deste documento em português, de forma limpa e organizada (preços, itens, políticas, horários). Não comente, devolva apenas o conteúdo.' },
      ],
    }],
  })
  return resp.content.filter(b => b.type === 'text').map((b: any) => b.text).join('\n').trim()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const body = await req.json().catch(() => ({}))
  const agentId: string = body.agent_id
  if (!agentId) return NextResponse.json({ error: 'agent_id obrigatório.' }, { status: 400 })

  // Verifica posse do agente (admin pode tudo; cliente só o seu)
  const admin = createAdminClient()
  const { data: agent } = await admin.from('agents').select('id, client_id').eq('id', agentId).single()
  if (!agent) return NextResponse.json({ error: 'Agente não encontrado.' }, { status: 404 })
  if (!isAdmin && agent.client_id !== user.id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  let texto = ''
  let label = ''

  try {
    if (body.kind === 'url') {
      const url = String(body.url || '').trim()
      if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: 'Informe uma URL válida (http/https).' }, { status: 400 })
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'BonsyncBot/1.0' } })
      clearTimeout(t)
      if (!res.ok) return NextResponse.json({ error: `Não foi possível acessar a URL (${res.status}).` }, { status: 400 })
      texto = stripHtml(await res.text())
      label = new URL(url).hostname
    } else if (body.kind === 'file') {
      const name: string = body.fileName || 'arquivo'
      const data: string = body.fileData || ''       // base64 (sem prefixo data:)
      label = name
      const ext = name.toLowerCase().split('.').pop() || ''
      const buf = Buffer.from(data, 'base64')
      if (ext === 'pdf') {
        texto = await pdfToText(data)
      } else if (['txt', 'csv', 'md', 'tsv'].includes(ext)) {
        texto = buf.toString('utf-8')
      } else {
        return NextResponse.json({ error: 'Formato não suportado. Use PDF, TXT, CSV ou uma URL. (DOCX/XLSX: exporte como PDF ou CSV.)' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Tipo de importação inválido.' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('[ingest]', e?.message)
    return NextResponse.json({ error: 'Falha ao ler o conteúdo. Tente outro arquivo/URL.' }, { status: 502 })
  }

  const itens = chunk(texto, label)
  if (!itens.length) return NextResponse.json({ error: 'Nenhum texto extraído do conteúdo.' }, { status: 400 })

  const rows = itens.map(content => ({ agent_id: agentId, content, active: true }))
  const { error } = await admin.from('knowledge_base').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, inserted: rows.length, label })
}
