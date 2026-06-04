import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

export const maxDuration = 30

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif',
}

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let body: { name?: string; dataBase64?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const name = (body.name || 'arquivo').trim()
  const b64  = body.dataBase64 || ''
  if (!b64) return NextResponse.json({ error: 'Arquivo vazio.' }, { status: 400 })

  const buffer = Buffer.from(b64, 'base64')
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx. 4 MB).' }, { status: 413 })
  }

  const ext = name.split('.').pop()?.toLowerCase() || ''

  try {
    // ── Planilhas ──
    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const parts: string[] = []
      wb.SheetNames.forEach(sheet => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet])
        parts.push(`### Planilha: ${sheet}\n${csv}`)
      })
      return NextResponse.json({ kind: 'text', name, text: parts.join('\n\n') })
    }

    // ── CSV / texto ──
    if (['csv', 'txt', 'md', 'json', 'tsv', 'log'].includes(ext)) {
      return NextResponse.json({ kind: 'text', name, text: buffer.toString('utf-8') })
    }

    // ── Word ──
    if (ext === 'docx') {
      const { value } = await mammoth.extractRawText({ buffer })
      return NextResponse.json({ kind: 'text', name, text: value })
    }

    // ── PDF (Claude lê nativamente) ──
    if (ext === 'pdf') {
      return NextResponse.json({ kind: 'pdf', name, data: b64 })
    }

    // ── Imagem (visão do Claude) ──
    if (IMAGE_TYPES[ext]) {
      return NextResponse.json({ kind: 'image', name, media_type: IMAGE_TYPES[ext], data: b64 })
    }

    return NextResponse.json({ error: `Formato .${ext} não suportado ainda.` }, { status: 415 })
  } catch (err: any) {
    console.error('[upload] erro:', err.message)
    return NextResponse.json({ error: 'Não foi possível ler o arquivo.' }, { status: 500 })
  }
}
