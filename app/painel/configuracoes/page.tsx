'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

const TABS = [
  ['empresa', 'Empresa'], ['agente', 'Agente'], ['atendimento', 'Atendimento'],
  ['horarios', 'Horários'], ['automacoes', 'Automações'], ['seguranca', 'Segurança'], ['avancado', 'Avançado'],
] as const

const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={T.label}>{label}</label>
      {children}
      {hint && <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>{hint}</p>}
    </div>
  )
}
function Check({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
      <input type="checkbox" checked={on} onChange={onToggle} />
      <span style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 300 }}>{children}</span>
    </label>
  )
}

export default function PainelConfigPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<string>('empresa')
  const [agent, setAgent] = useState<any>(null)

  const [empresaNome, setEmpresaNome] = useState('')
  const [agentNome, setAgentNome] = useState('')
  const [cfg, setCfgRaw] = useState<any>(null)

  function setCfg(updater: (c: any) => any) { setCfgRaw((c: any) => updater({ ...c })); setDirty(true) }
  function topo(k: string, v: any) { setCfg(c => ({ ...c, [k]: v })) }
  function grupo(g: string, k: string, v: any) { setCfg(c => ({ ...c, [g]: { ...(c[g] || {}), [k]: v } })) }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: a }, { data: prof }] = await Promise.all([
        supabase.from('agents').select('*').eq('client_id', user!.id).single(),
        supabase.from('profiles').select('company_name').eq('id', user!.id).single(),
      ])
      if (prof) setEmpresaNome(prof.company_name ?? '')
      if (a) {
        setAgent(a); setAgentNome(a.name ?? '')
        const c = a.config || {}
        setCfgRaw({
          tom: c.tom ?? 'profissional', saudacao: c.saudacao ?? '', prompt: c.prompt ?? '',
          idioma: c.idioma ?? 'pt', assinatura: c.assinatura ?? '', avatar: c.avatar ?? '',
          escalation_mode: c.escalation_mode ?? 'on_demand', escalate_after_messages: c.escalate_after_messages ?? 0,
          digest_frequency: c.digest_frequency ?? 'off', digest_channel: c.digest_channel ?? 'email', away_message: c.away_message ?? '',
          empresa: c.empresa ?? {}, profile: c.profile ?? {},
          business_hours: c.business_hours ?? { enabled: false, start: '08:00', end: '18:00', weekdays: true },
          escalonar_quando: c.escalonar_quando ?? {},
          digest: c.digest ?? { conteudo: {} },
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function salvar() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const novaConfig = { ...(agent.config || {}), ...cfg, profile: { ...cfg.profile, servicos: toArr(cfg.profile?.servicos), integracoes: toArr(cfg.profile?.integracoes) } }
    await Promise.all([
      supabase.from('agents').update({ name: agentNome, config: novaConfig, updated_at: new Date().toISOString() }).eq('id', agent.id),
      supabase.from('profiles').update({ company_name: empresaNome.trim() }).eq('id', user!.id),
    ])
    setAgent({ ...agent, config: novaConfig, name: agentNome, updated_at: new Date().toISOString() })
    setSaving(false); setSaved(true); setDirty(false); setTimeout(() => setSaved(false), 2500)
  }
  function toArr(v: any): string[] { return Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean) }
  function arrStr(v: any): string { return Array.isArray(v) ? v.join(', ') : (v || '') }
  async function descartar() { setDirty(false); window.location.reload() }
  function restaurarPadrao() {
    if (!confirm('Restaurar o comportamento padrão do agente? Tom, saudação e atendimento humano voltam ao padrão. Seus dados de empresa e perfil são mantidos.')) return
    setCfg(c => ({ ...c, tom: 'profissional', saudacao: 'Olá! Como posso te ajudar hoje?', escalation_mode: 'on_demand', escalate_after_messages: 0 }))
  }

  if (loading || !cfg) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%' }}><span style={{ ...T.sub }} className="animate-pulse-dot">Carregando…</span></div>
  if (!agent) return <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>Nenhum agente configurado. Entre em contato com a Bonsync.</div>

  const cardSec = { ...CARD, marginBottom: 16 } as React.CSSProperties
  const secTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 4 } as React.CSSProperties
  const secSub = { ...T.sub, fontSize: 12, marginBottom: 16 } as React.CSSProperties
  const col2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 } as React.CSSProperties
  const tomLabel: Record<string, string> = { profissional: 'Profissional', amigavel: 'Amigável', formal: 'Formal', tecnico: 'Técnico' }
  const bh = cfg.business_hours || {}
  const eq = cfg.escalonar_quando || {}
  const dc = cfg.digest?.conteudo || {}

  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={T.h1}>Configurações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Ajuste dados da empresa, comportamento do agente, canais, horários e automações.</p>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={tab === v ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 12.5, padding: '8px 14px' }}>{l}</button>
        ))}
      </div>

      {dirty && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.yellow }}>Você possui alterações não salvas.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvar} disabled={saving} className="btn-primary" style={{ fontSize: 12 }}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
            <button onClick={descartar} className="btn-ghost" style={{ fontSize: 12 }}>Descartar</button>
          </div>
        </div>
      )}
      {saved && <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: C.green, fontFamily: FONT.dm, fontSize: 14 }}>Configurações salvas com sucesso.</div>}

      <div className="cfg-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.1fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        {/* ESQUERDA */}
        <div style={{ minWidth: 0 }}>
          {tab === 'empresa' && (
            <>
              <div style={cardSec}>
                <h2 style={secTitle}>Dados da empresa</h2>
                <p style={secSub}>Aparece no seu painel, relatórios e e-mails.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={col2}>
                    <Campo label="Nome da empresa"><input className="field" value={empresaNome} onChange={e => { setEmpresaNome(e.target.value); setDirty(true) }} /></Campo>
                    <Campo label="Segmento" hint="Ex: Fulfillment, Varejo, Serviços"><input className="field" value={cfg.empresa.segmento || ''} onChange={e => grupo('empresa', 'segmento', e.target.value)} placeholder="Fulfillment para e-commerce" /></Campo>
                    <Campo label="Site"><input className="field" value={cfg.empresa.site || ''} onChange={e => grupo('empresa', 'site', e.target.value)} placeholder="https://" /></Campo>
                    <Campo label="Telefone comercial"><input className="field" value={cfg.empresa.telefone || ''} onChange={e => grupo('empresa', 'telefone', e.target.value)} placeholder="(11) 90000-0000" /></Campo>
                    <Campo label="E-mail comercial"><input className="field" value={cfg.empresa.email || ''} onChange={e => grupo('empresa', 'email', e.target.value)} placeholder="contato@empresa.com.br" /></Campo>
                    <Campo label="Cidade / Estado"><input className="field" value={cfg.empresa.cidade || ''} onChange={e => grupo('empresa', 'cidade', e.target.value)} placeholder="Guarulhos/SP" /></Campo>
                  </div>
                  <Campo label="Logo da empresa (URL)" hint="Cole o link de uma imagem do seu logo."><input className="field" value={cfg.empresa.logo || ''} onChange={e => grupo('empresa', 'logo', e.target.value)} placeholder="https://.../logo.png" /></Campo>
                </div>
              </div>
              <div style={cardSec}>
                <h2 style={secTitle}>Perfil comercial</h2>
                <p style={secSub}>Ajuda você e a IA a entenderem o foco do negócio. Aparece em “Meu Agente”.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Campo label="Objetivo comercial"><textarea className="field" rows={2} value={cfg.profile.objetivo || ''} onChange={e => grupo('profile', 'objetivo', e.target.value)} placeholder="Atender clientes interessados em fulfillment, tirar dúvidas, captar leads e encaminhar oportunidades." /></Campo>
                  <div style={col2}>
                    <Campo label="Especialidade"><input className="field" value={cfg.profile.especialidade || ''} onChange={e => grupo('profile', 'especialidade', e.target.value)} placeholder="Fulfillment para e-commerce" /></Campo>
                    <Campo label="Público atendido"><input className="field" value={cfg.profile.publico || ''} onChange={e => grupo('profile', 'publico', e.target.value)} placeholder="Lojas virtuais e marketplaces" /></Campo>
                    <Campo label="Principal meta"><input className="field" value={cfg.profile.meta || ''} onChange={e => grupo('profile', 'meta', e.target.value)} placeholder="Qualificar leads e gerar oportunidades" /></Campo>
                    <Campo label="Região de atuação"><input className="field" value={cfg.profile.regiao || ''} onChange={e => grupo('profile', 'regiao', e.target.value)} placeholder="Guarulhos/SP e nacional" /></Campo>
                  </div>
                  <Campo label="Serviços oferecidos" hint="Separe por vírgula."><input className="field" value={arrStr(cfg.profile.servicos)} onChange={e => grupo('profile', 'servicos', e.target.value)} placeholder="Armazenagem, Picking, Packing, Expedição" /></Campo>
                  <Campo label="Integrações" hint="Separe por vírgula."><input className="field" value={arrStr(cfg.profile.integracoes)} onChange={e => grupo('profile', 'integracoes', e.target.value)} placeholder="Mercado Livre, Shopee, Shopify, Tiny ERP" /></Campo>
                  <Campo label="Produtos / serviços NÃO atendidos" hint="Ajuda o agente a recusar pedidos fora do escopo."><textarea className="field" rows={2} value={cfg.profile.nao_atendidos || ''} onChange={e => grupo('profile', 'nao_atendidos', e.target.value)} placeholder="Ex: produtos perecíveis, bolos artesanais sem refrigeração." /></Campo>
                </div>
              </div>
            </>
          )}

          {tab === 'agente' && (
            <div style={cardSec}>
              <h2 style={secTitle}>Identidade do agente</h2>
              <p style={secSub}>Como o agente se apresenta e fala com seus clientes.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={col2}>
                  <Campo label="Nome do agente"><input className="field" value={agentNome} onChange={e => { setAgentNome(e.target.value); setDirty(true) }} /></Campo>
                  <Campo label="Avatar (URL)"><input className="field" value={cfg.avatar} onChange={e => topo('avatar', e.target.value)} placeholder="https://.../avatar.png" /></Campo>
                  <Campo label="Tom de voz">
                    <select className="field" value={cfg.tom} onChange={e => topo('tom', e.target.value)}>
                      <option value="profissional">Profissional</option><option value="amigavel">Amigável e profissional</option><option value="formal">Formal</option><option value="tecnico">Técnico</option>
                    </select>
                  </Campo>
                  <Campo label="Idioma principal">
                    <select className="field" value={cfg.idioma} onChange={e => topo('idioma', e.target.value)}>
                      <option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option>
                    </select>
                  </Campo>
                </div>
                <Campo label="Mensagem de saudação"><input className="field" value={cfg.saudacao} onChange={e => topo('saudacao', e.target.value)} placeholder="Olá! Bem-vindo à empresa. Como posso ajudar hoje?" /></Campo>
                <Campo label="Assinatura da resposta" hint="Texto opcional ao final das respostas."><input className="field" value={cfg.assinatura} onChange={e => topo('assinatura', e.target.value)} placeholder="— Equipe de atendimento" /></Campo>
              </div>
            </div>
          )}

          {tab === 'atendimento' && (
            <div style={cardSec}>
              <h2 style={secTitle}>Atendimento humano</h2>
              <p style={secSub}>Defina quando o agente deve passar a conversa para a sua equipe.</p>
              <Campo label="Modo de atendimento humano">
                <select className="field" value={cfg.escalation_mode} onChange={e => topo('escalation_mode', e.target.value)}>
                  <option value="on_demand">Sob demanda — só quando o cliente pedir</option>
                  <option value="auto">Sempre disponível — o agente decide</option>
                  <option value="business">Apenas em horário comercial</option>
                  <option value="off">Desativado</option>
                </select>
              </Campo>
              <div style={{ marginTop: 14 }}>
                <p style={{ ...T.label, marginBottom: 4 }}>Quando passar para humano?</p>
                {[['pedir', 'Quando o cliente pedir atendimento humano'], ['reclamacao', 'Quando houver reclamação'], ['contrato', 'Quando perguntar sobre contrato'], ['desconto', 'Quando pedir desconto'], ['ia_nao_sabe', 'Quando a IA não souber responder'], ['muitas_msgs', 'Após muitas mensagens sem resolução'], ['lead_quente', 'Quando houver lead quente']].map(([k, l]) => (
                  <Check key={k} on={!!eq[k]} onToggle={() => grupo('escalonar_quando', k, !eq[k])}>{l}</Check>
                ))}
              </div>
              {cfg.escalation_mode === 'auto' && (
                <div style={{ marginTop: 14 }}>
                  <Campo label="Escalar após (nº de mensagens, 0 = desligado)"><input className="field" type="number" min={0} max={100} value={cfg.escalate_after_messages} onChange={e => topo('escalate_after_messages', Number(e.target.value))} style={{ width: 140 }} /></Campo>
                </div>
              )}
            </div>
          )}

          {tab === 'horarios' && (
            <div style={cardSec}>
              <h2 style={secTitle}>Horário de funcionamento</h2>
              <p style={secSub}>Fora do horário, o agente envia uma mensagem de ausência em vez de responder.</p>
              <Check on={!!bh.enabled} onToggle={() => grupo('business_hours', 'enabled', !bh.enabled)}>Ativar horário comercial</Check>
              {bh.enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <Campo label="Abre às"><input className="field" type="time" value={bh.start || '08:00'} onChange={e => grupo('business_hours', 'start', e.target.value)} style={{ width: 140 }} /></Campo>
                    <Campo label="Fecha às"><input className="field" type="time" value={bh.end || '18:00'} onChange={e => grupo('business_hours', 'end', e.target.value)} style={{ width: 140 }} /></Campo>
                    <Campo label="Fuso horário"><select className="field" value={bh.fuso || 'America/Sao_Paulo'} onChange={e => grupo('business_hours', 'fuso', e.target.value)} style={{ width: 'auto' }}><option value="America/Sao_Paulo">Brasília (BRT)</option></select></Campo>
                  </div>
                  <div>
                    <p style={{ ...T.label, marginBottom: 4 }}>Dias de atendimento</p>
                    <Check on={true} onToggle={() => {}}>Segunda a sexta</Check>
                    <Check on={!!bh.sabado} onToggle={() => { grupo('business_hours', 'sabado', !bh.sabado); grupo('business_hours', 'weekdays', bh.sabado && !bh.domingo) }}>Sábado</Check>
                    <Check on={!!bh.domingo} onToggle={() => { grupo('business_hours', 'domingo', !bh.domingo); grupo('business_hours', 'weekdays', !bh.sabado && bh.domingo) }}>Domingo</Check>
                    <Check on={!!bh.feriados} onToggle={() => grupo('business_hours', 'feriados', !bh.feriados)}>Atender em feriados</Check>
                  </div>
                  <Campo label="Mensagem fora do horário"><textarea className="field" rows={2} value={cfg.away_message} onChange={e => topo('away_message', e.target.value)} placeholder="Olá! No momento estamos fora do horário de atendimento. Deixe sua mensagem que retornaremos em breve." /></Campo>
                </div>
              )}
            </div>
          )}

          {tab === 'automacoes' && (
            <div style={cardSec}>
              <h2 style={secTitle}>Resumo automático</h2>
              <p style={secSub}>Receba um resumo do que o agente fez, automaticamente.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={col2}>
                  <Campo label="Receber resumo do agente">
                    <select className="field" value={cfg.digest_frequency} onChange={e => topo('digest_frequency', e.target.value)}>
                      <option value="off">Desligado</option><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option>
                    </select>
                  </Campo>
                  {cfg.digest_frequency !== 'off' && (
                    <Campo label="Enviar por">
                      <select className="field" value={cfg.digest_channel} onChange={e => topo('digest_channel', e.target.value)}>
                        <option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="both">E-mail + WhatsApp</option>
                      </select>
                    </Campo>
                  )}
                </div>
                {cfg.digest_frequency !== 'off' && (
                  <>
                    <Campo label="Destinatários (e-mails, separados por vírgula)"><input className="field" value={cfg.digest?.destinatarios || ''} onChange={e => grupo('digest', 'destinatarios', e.target.value)} placeholder="voce@empresa.com.br" /></Campo>
                    <div>
                      <p style={{ ...T.label, marginBottom: 4 }}>Conteúdo do resumo</p>
                      {[['conversas', 'Conversas atendidas'], ['leads', 'Leads captados'], ['vendas', 'Vendas geradas'], ['reclamacoes', 'Reclamações'], ['oportunidades', 'Oportunidades perdidas'], ['sugestoes', 'Sugestões da IA'], ['desempenho', 'Relatório de desempenho']].map(([k, l]) => (
                        <Check key={k} on={dc[k] !== false} onToggle={() => grupo('digest', 'conteudo', { ...dc, [k]: dc[k] === false })}>{l}</Check>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'seguranca' && (
            <div style={cardSec}>
              <h2 style={secTitle}>Segurança e privacidade</h2>
              <p style={secSub}>Proteções sempre ativas na plataforma Bonsync.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {['Validação de conteúdo ativa', 'Histórico completo de interações', 'Proteção de dados sensíveis', 'Conformidade LGPD', 'Controle de acesso', 'Logs de alterações'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                    <span style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, fontWeight: 300 }}>{t}</span>
                    <span style={{ flex: 1 }} /><span style={{ ...T.mono, fontSize: 8.5, color: C.green }}>OK</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href="/painel/conversas" className="btn-ghost" style={{ fontSize: 12 }}>Ver logs de atividade</a>
                <a href="mailto:contato@bonsync.com.br?subject=Exclusão de dados" className="btn-ghost" style={{ fontSize: 12, color: C.red }}>Solicitar exclusão de dados</a>
              </div>
            </div>
          )}

          {tab === 'avancado' && (
            <div style={cardSec}>
              <h2 style={secTitle}>Configurações avançadas</h2>
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '10px 14px', margin: '8px 0 16px' }}>
                <p style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.yellow }}>⚠️ Edite esta área apenas se souber exatamente como deseja alterar o comportamento do agente.</p>
              </div>
              <details>
                <summary style={{ cursor: 'pointer', fontFamily: FONT.dm, fontSize: 14, color: C.white, marginBottom: 12 }}>Prompt de instrução do agente</summary>
                <Campo label="Prompt de instrução" hint="Instrução base usada em todas as conversas."><textarea className="field" rows={8} value={cfg.prompt} onChange={e => topo('prompt', e.target.value)} placeholder="Você é um assistente virtual da empresa…" /></Campo>
              </details>
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Modelo de IA', 'Avançado'], ['Regras automáticas', 'Ativas'], ['Classificação de leads', 'Ativa'], ['Segurança / guardrails', 'Ativos']].map(([k, v]) => (
                  <div key={k} style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ ...T.mono, fontSize: 9, color: C.faint }}>{k}</p><p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, marginTop: 3 }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Salvar fixo no rodapé da coluna */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
            <button onClick={salvar} disabled={saving} className="btn-primary">{saving ? 'Salvando…' : 'Salvar alterações'}</button>
            {dirty && <span style={{ ...T.sub, fontSize: 12, color: C.yellow }}>alterações não salvas</span>}
          </div>
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={CARD}>
            <h2 style={sideTitle}>Resumo das configurações</h2>
            {[
              ['Empresa', empresaNome || '—'], ['Agente', agentNome || '—'], ['Canal principal', 'WhatsApp'],
              ['Resposta automática', agent.status === 'active' ? 'Ativa' : 'Pausada'],
              ['Tom de voz', tomLabel[cfg.tom] || '—'],
              ['Atendimento humano', cfg.escalation_mode === 'auto' ? 'Automático' : cfg.escalation_mode === 'off' ? 'Desativado' : cfg.escalation_mode === 'business' ? 'Horário comercial' : 'Sob demanda'],
              ['Resumo automático', cfg.digest_frequency === 'off' ? 'Desligado' : cfg.digest_frequency === 'daily' ? 'Diário' : cfg.digest_frequency === 'weekly' ? 'Semanal' : 'Mensal'],
              ['Segurança', 'OK'],
            ].map(([k, v], i, arr) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>{k}</span>
                <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: k === 'Segurança' ? C.green : C.white, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Ações rápidas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={salvar} disabled={saving} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Salvar alterações<span style={{ color: C.faint }}>✓</span></button>
              <a href="/painel/assistente" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Testar agente<span style={{ color: C.faint }}>→</span></a>
              <button onClick={restaurarPadrao} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Restaurar padrão<span style={{ color: C.faint }}>↺</span></button>
              <a href="/painel/status" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Ver histórico<span style={{ color: C.faint }}>→</span></a>
              <a href="/painel/conhecimento" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Abrir base de conhecimento<span style={{ color: C.faint }}>→</span></a>
            </div>
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Status da configuração</h2>
            {[
              ['Perfil comercial', (cfg.profile?.objetivo || cfg.profile?.especialidade) ? 'Preenchido' : 'Incompleto', (cfg.profile?.objetivo || cfg.profile?.especialidade) ? 'var(--c-green)' : 'var(--c-yellow)'],
              ['Saudação', cfg.saudacao ? 'Definida' : 'Pendente', cfg.saudacao ? 'var(--c-green)' : 'var(--c-yellow)'],
              ['Horário comercial', bh.enabled ? 'Ativo' : 'Desligado', bh.enabled ? 'var(--c-green)' : 'var(--c-muted)'],
              ['Resumo automático', cfg.digest_frequency !== 'off' ? 'Ativo' : 'Desligado', cfg.digest_frequency !== 'off' ? 'var(--c-green)' : 'var(--c-muted)'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{k}</span>
                <span style={{ fontFamily: FONT.jb, fontSize: 9, color: c as string }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Histórico recente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[[fmt(agent.updated_at), 'Configuração atualizada'], [fmt(agent.created_at), 'Agente criado']].map(([d, t], i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ ...T.mono, fontSize: 9, color: C.faint, flexShrink: 0, width: 70 }}>{d}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, fontWeight: 300 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 1040px){ .cfg-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
