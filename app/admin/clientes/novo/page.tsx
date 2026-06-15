'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, T, CARD, FONT } from '@/lib/styles'
import { ConnectWhatsApp } from '@/components/ConnectWhatsApp'

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

export default function NovoClientePage() {
  const [form, setForm] = useState({ company_name: '', email: '', password: '' })
  const [criarInstancia, setCriarInstancia] = useState(true)
  const [instancia, setInstancia] = useState('')
  const [instanciaEdit, setInstanciaEdit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState<null | { connectUrl: string | null; instancia: string | null; emailOk: boolean }>(null)
  const [copiado, setCopiado] = useState(false)
  const router = useRouter()

  const instanciaFinal = (instanciaEdit ? instancia : slugify(form.company_name))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    // 1. Cria o usuário/cliente
    const res = await fetch('/api/admin/create-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao criar cliente.'); setLoading(false); return }

    // 2. Opcional: cria instância de WhatsApp
    let connectUrl: string | null = null
    let instCriada: string | null = null
    if (criarInstancia && instanciaFinal) {
      const r2 = await fetch('/api/admin/create-instance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: instanciaFinal }),
      })
      const d2 = await r2.json()
      if (r2.ok) { connectUrl = d2.connectUrl ?? null; instCriada = d2.instance ?? instanciaFinal }
      else { setError('Cliente criado, mas falhou ao criar a instância: ' + (d2.error ?? '')) }
    }

    // 3. Envia e-mail de boas-vindas (credenciais + link de conexão)
    let emailOk = false
    try {
      const r3 = await fetch('/api/admin/send-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: form.email, companyName: form.company_name, password: form.password, connectUrl }),
      })
      emailOk = r3.ok
    } catch { emailOk = false }

    setLoading(false)
    // Mesmo se a criação da instância tropeçar, passamos o nome pretendido para
    // o painel de QR tentar conectar/gerar o código (com opção de tentar de novo).
    setDone({ connectUrl, instancia: instCriada || (criarInstancia && instanciaFinal ? instanciaFinal : null), emailOk })
  }

  function copiar() {
    if (done?.connectUrl) {
      navigator.clipboard.writeText(done.connectUrl)
      setCopiado(true); setTimeout(() => setCopiado(false), 2000)
    }
  }

  // ── Tela de sucesso ──
  if (done) {
    return (
      <div className="animate-slide-up" style={{ maxWidth: 560 }}>
        <h1 style={T.h1}>Cliente criado ✓</h1>
        <p style={{ ...T.sub, marginTop: 4, marginBottom: 16 }}>
          {done.emailOk ? 'Enviamos um e-mail de boas-vindas com tudo isso. Aqui está uma cópia:' : 'Envie estes dados ao cliente para ele começar.'}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 14px', borderRadius: 8,
          background: done.emailOk ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${done.emailOk ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
          fontFamily: FONT.dm, fontSize: 13, color: done.emailOk ? C.green : C.yellow,
        }}>
          {done.emailOk ? `✓ E-mail enviado para ${form.email}` : '⚠ Não foi possível enviar o e-mail — envie os dados manualmente (abaixo).'}
        </div>

        <div style={{ ...CARD, marginBottom: 16 }}>
          <p style={{ ...T.mono, color: C.muted, marginBottom: 12 }}>Acesso ao painel</p>
          <div style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, lineHeight: 1.9 }}>
            <div>🔗 <span style={{ color: C.muted }}>app.bonsync.com.br/login</span></div>
            <div>📧 {form.email}</div>
            <div>🔑 {form.password}</div>
          </div>
        </div>

        {done.instancia && (
          <div style={{ marginBottom: 16 }}>
            {/* QR Code ao vivo — abre automaticamente após criar o cliente */}
            <ConnectWhatsApp instance={done.instancia} />

            {done.connectUrl && (
              <div style={{ ...CARD, marginTop: 12 }}>
                <p style={{ ...T.mono, color: C.muted, marginBottom: 8 }}>Ou envie este link ao cliente</p>
                <p style={{ ...T.sub, fontSize: 13, marginBottom: 12 }}>
                  Ele abre, escaneia o QR (que se renova sozinho) e pronto — sem precisar de você.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="field" readOnly value={done.connectUrl} style={{ flex: 1, fontSize: 12 }} />
                  <button onClick={copiar} className="btn-primary" style={{ fontSize: 12, padding: '10px 18px', whiteSpace: 'nowrap' }}>
                    {copiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { router.push('/admin/clientes'); router.refresh() }} className="btn-primary">Concluir</button>
          {done.connectUrl && (
            <a href={done.connectUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 26px', fontSize: 13 }}>
              Abrir QR agora
            </a>
          )}
        </div>
      </div>
    )
  }

  // ── Formulário ──
  return (
    <div className="animate-slide-up" style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/clientes" style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>← Voltar</a>
        <h1 style={T.h1}>Novo cliente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Crie o acesso do cliente e, opcionalmente, o WhatsApp dele.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={T.label}>Nome da empresa</label>
            <input className="field" type="text" required placeholder="Acme Ltda."
              value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div>
            <label style={T.label}>E-mail de acesso</label>
            <input className="field" type="email" required placeholder="contato@acme.com.br"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={T.label}>Senha inicial</label>
            <input className="field" type="text" required minLength={8} placeholder="Mínimo 8 caracteres"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>

        {/* Instância */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={criarInstancia} onChange={e => setCriarInstancia(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'oklch(55% 0.24 225)' }} />
            <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>Criar instância de WhatsApp para este cliente</span>
          </label>
          {criarInstancia && (
            <div>
              <label style={T.label}>Nome da instância</label>
              <input className="field" type="text"
                value={instanciaEdit ? instancia : slugify(form.company_name)}
                onChange={e => { setInstanciaEdit(true); setInstancia(slugify(e.target.value)) }}
                placeholder="gerado a partir do nome da empresa" />
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>
                Use este mesmo nome ao criar o agente. Gera um link de conexão para o cliente.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 8, padding: '12px 16px', color: C.red, fontFamily: FONT.dm, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Criando…' : 'Criar cliente'}
        </button>
      </form>
    </div>
  )
}
