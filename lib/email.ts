/**
 * Envio de e-mail via Resend (API REST).
 * Requer RESEND_API_KEY no ambiente.
 * EMAIL_FROM opcional (padrão: domínio de teste do Resend).
 */

const FROM = process.env.EMAIL_FROM || 'Bonsync <onboarding@resend.dev>'

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY não configurada' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    const txt = await res.text()
    console.error('[email] erro Resend:', res.status, txt)
    return { ok: false, error: `Resend ${res.status}: ${txt}` }
  }
  return { ok: true }
}

export function onboardingEmailHtml(opts: {
  companyName: string
  loginEmail: string
  password: string
  connectUrl: string | null
}) {
  const { companyName, loginEmail, password, connectUrl } = opts
  const azul = '#2563eb'
  return `
  <div style="background:#f4f6fb;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6eaf2;">
      <div style="background:#060a10;padding:24px 28px;">
        <span style="color:#eef2ff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">BONSYNC</span>
      </div>
      <div style="padding:28px;">
        <h1 style="font-size:20px;color:#0b1220;margin:0 0 8px;">Bem-vindo(a), ${companyName}! 🎉</h1>
        <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;">
          Sua conta na Bonsync está pronta. Veja abaixo como acessar seu painel e ativar seu agente.
        </p>

        <div style="background:#f8fafc;border:1px solid #e6eaf2;border-radius:10px;padding:18px;margin-bottom:20px;">
          <p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Acesso ao painel</p>
          <p style="font-size:14px;color:#0b1220;margin:0 0 6px;">🔗 <a href="https://app.bonsync.com.br/login" style="color:${azul};text-decoration:none;">app.bonsync.com.br/login</a></p>
          <p style="font-size:14px;color:#0b1220;margin:0 0 6px;">📧 <b>${loginEmail}</b></p>
          <p style="font-size:14px;color:#0b1220;margin:0;">🔑 <b>${password}</b></p>
          <p style="font-size:12px;color:#94a3b8;margin:12px 0 0;">Recomendamos trocar a senha após o primeiro acesso.</p>
        </div>

        ${connectUrl ? `
        <div style="background:#eef4ff;border:1px solid #d6e4ff;border-radius:10px;padding:18px;margin-bottom:24px;">
          <p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;">Conectar seu WhatsApp</p>
          <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px;">
            Clique no botão, escaneie o QR Code com seu WhatsApp e seu agente entra no ar. O código se renova sozinho.
          </p>
          <a href="${connectUrl}" style="display:inline-block;background:${azul};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
            Conectar WhatsApp
          </a>
        </div>` : ''}

        <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0;">
          Qualquer dúvida, é só responder este e-mail ou falar com a gente em
          <a href="mailto:contato@bonsync.com.br" style="color:${azul};text-decoration:none;">contato@bonsync.com.br</a>.
        </p>
      </div>
      <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e6eaf2;">
        <span style="font-size:11px;color:#94a3b8;">© Bonsync · Inteligência artificial com segurança</span>
      </div>
    </div>
  </div>`
}
