/**
 * Envio de e-mail via Resend + templates com a identidade da Bonsync.
 * Requer RESEND_API_KEY. EMAIL_FROM opcional.
 *
 * Nota: e-mail não suporta SVG/OKLCH/fontes custom de forma confiável,
 * então usamos tabelas + cores hex equivalentes ao tema do site.
 */

const FROM = process.env.EMAIL_FROM || 'Bonsync <onboarding@resend.dev>'

// Paleta (hex equivalente ao tema do site)
const COL = {
  bg: '#060a10',
  card: '#0b1426',
  panel: '#0e1f3d',
  border: '#1c2740',
  white: '#eef2ff',
  muted: '#8aa0c0',
  faint: '#56688a',
  blue: '#2d7fff',
  blueSoft: '#6db3ff',
  green: '#22c55e',
}
const FONT = "'Space Grotesk',-apple-system,Segoe UI,Roboto,Arial,sans-serif"

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

/** Botão padrão */
function btn(label: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:${COL.blue};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 26px;border-radius:8px;font-family:${FONT};">${label}</a>`
}

/** Shell com cabeçalho + rodapé da marca. Recebe o HTML interno. */
export function emailShell(inner: string, preheader = '') {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${COL.bg};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COL.bg};">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COL.bg};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${COL.card};border:1px solid ${COL.border};border-radius:14px;overflow:hidden;font-family:${FONT};">
      <tr><td style="padding:22px 28px;border-bottom:1px solid ${COL.border};">
        <span style="display:inline-block;width:18px;height:18px;background:${COL.blue};border-radius:5px;vertical-align:middle;"></span>
        <span style="color:${COL.white};font-size:17px;font-weight:700;letter-spacing:.04em;vertical-align:middle;margin-left:8px;">BONSYNC</span>
      </td></tr>
      <tr><td style="padding:28px;">${inner}</td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid ${COL.border};">
        <span style="color:${COL.faint};font-size:11px;">© Bonsync · Inteligência artificial com segurança · <a href="https://bonsync.com.br" style="color:${COL.faint};text-decoration:none;">bonsync.com.br</a></span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/** E-mail de boas-vindas (onboarding) */
export function onboardingEmailHtml(opts: {
  companyName: string
  loginEmail: string
  password: string
  connectUrl: string | null
}) {
  const { companyName, loginEmail, password, connectUrl } = opts
  const inner = `
    <h1 style="font-size:21px;color:${COL.white};margin:0 0 8px;font-weight:700;">Bem-vindo(a), ${companyName}! 🎉</h1>
    <p style="font-size:15px;color:${COL.muted};line-height:1.6;margin:0 0 24px;">
      Sua conta na Bonsync está pronta. Veja como acessar seu painel e ativar seu agente.
    </p>

    <div style="background:${COL.panel};border:1px solid ${COL.border};border-radius:10px;padding:18px;margin-bottom:20px;">
      <p style="font-size:11px;color:${COL.blueSoft};text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Acesso ao painel</p>
      <p style="font-size:14px;color:${COL.white};margin:0 0 6px;">🔗 <a href="https://app.bonsync.com.br/login" style="color:${COL.blueSoft};text-decoration:none;">app.bonsync.com.br/login</a></p>
      <p style="font-size:14px;color:${COL.white};margin:0 0 6px;">📧 <b>${loginEmail}</b></p>
      <p style="font-size:14px;color:${COL.white};margin:0;">🔑 <b>${password}</b></p>
      <p style="font-size:12px;color:${COL.faint};margin:12px 0 0;">Recomendamos trocar a senha após o primeiro acesso.</p>
    </div>

    ${connectUrl ? `
    <div style="background:${COL.panel};border:1px solid ${COL.border};border-radius:10px;padding:18px;margin-bottom:24px;">
      <p style="font-size:11px;color:${COL.blueSoft};text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;">Conectar seu WhatsApp</p>
      <p style="font-size:14px;color:${COL.muted};line-height:1.6;margin:0 0 16px;">
        Clique no botão, escaneie o QR Code com seu WhatsApp e seu agente entra no ar. O código se renova sozinho.
      </p>
      ${btn('Conectar WhatsApp', connectUrl)}
    </div>` : ''}

    <p style="font-size:13px;color:${COL.faint};line-height:1.6;margin:0;">
      Dúvidas? Fale com a gente em <a href="mailto:contato@bonsync.com.br" style="color:${COL.blueSoft};text-decoration:none;">contato@bonsync.com.br</a>.
    </p>`
  return emailShell(inner, `Sua conta na Bonsync está pronta — acesso e conexão do WhatsApp.`)
}

/** E-mail de resumo automático (digest) */
export function digestEmailHtml(opts: {
  empresa: string
  periodoLabel: string
  conversas: { total: number; resolvidas: number; escaladas: number; abertas: number }
  fechados: { empresa: string | null; valor: string | null }[]
  pendentes: number
}) {
  const { empresa, periodoLabel, conversas, fechados, pendentes } = opts
  const stat = (label: string, value: string | number) =>
    `<td style="padding:14px 8px;text-align:center;background:${COL.panel};border:1px solid ${COL.border};border-radius:8px;">
      <div style="font-size:22px;font-weight:700;color:${COL.blueSoft};font-family:${FONT};">${value}</div>
      <div style="font-size:10px;color:${COL.muted};text-transform:uppercase;letter-spacing:.06em;margin-top:2px;">${label}</div>
    </td>`
  const fechadosHtml = fechados.length
    ? fechados.map(f => `<li style="margin-bottom:4px;color:${COL.white};">${f.empresa || 'Negócio'}${f.valor ? ' — <b style="color:' + COL.blueSoft + ';">' + f.valor + '</b>' : ''}</li>`).join('')
    : `<li style="color:${COL.faint};">Nenhum fechamento no período.</li>`

  const inner = `
    <h1 style="font-size:19px;color:${COL.white};margin:0 0 4px;font-weight:700;">Resumo ${periodoLabel} — ${empresa}</h1>
    <p style="font-size:14px;color:${COL.muted};margin:0 0 22px;">Veja como foi o atendimento do seu agente.</p>

    <table width="100%" cellspacing="8" cellpadding="0" style="margin-bottom:20px;border-collapse:separate;">
      <tr>${stat('Atendimentos', conversas.total)}${stat('Resolvidos', conversas.resolvidas)}${stat('Escalados', conversas.escaladas)}</tr>
    </table>

    <div style="background:${COL.panel};border:1px solid ${COL.border};border-radius:10px;padding:16px 18px;margin-bottom:18px;">
      <p style="font-size:11px;color:${COL.blueSoft};text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;">Negócios fechados</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;">${fechadosHtml}</ul>
    </div>

    <p style="font-size:14px;color:${COL.muted};margin:0 0 22px;">📨 <b style="color:${COL.white};">${conversas.abertas}</b> em aberto · 🤝 <b style="color:${COL.white};">${pendentes}</b> aguardando confirmação</p>

    ${btn('Ver no painel', 'https://app.bonsync.com.br/login')}`
  return emailShell(inner, `Resumo ${periodoLabel}: ${conversas.total} atendimentos, ${fechados.length} fechados.`)
}
