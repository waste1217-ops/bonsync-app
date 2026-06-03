'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PainelConfigPage() {
  const [agent, setAgent] = useState<any>(null)
  const [config, setConfig] = useState({ prompt: '', tom: 'profissional', saudacao: '', escalarApos: 15 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('agents').select('*').eq('client_id', user!.id).single()
      if (data) {
        setAgent(data)
        setConfig({
          prompt: data.config?.prompt ?? '',
          tom: data.config?.tom ?? 'profissional',
          saudacao: data.config?.saudacao ?? '',
          escalarApos: data.config?.escalarApos ?? 15,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('agents').update({
      config: { ...agent.config, ...config },
      updated_at: new Date().toISOString(),
    }).eq('id', agent.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="font-mono text-muted text-sm animate-pulse-dot">Carregando…</span>
    </div>
  )

  if (!agent) return (
    <div className="text-center py-20 text-muted text-sm font-light">
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  return (
    <div className="animate-slide-up max-w-2xl">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-white tracking-tight">Configurações</h1>
        <p className="text-muted text-sm font-light mt-1">Personalize o comportamento do seu agente.</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <div className="bg-deep border border-border rounded-xl p-6 flex flex-col gap-5">
          <h2 className="font-heading font-semibold text-base text-white border-b border-border pb-4">Identidade</h2>

          <div>
            <label className="block font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase mb-2">Tom de voz</label>
            <select value={config.tom} onChange={e => setConfig({ ...config, tom: e.target.value })}
              className="w-full bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-bright focus:ring-2 focus:ring-blue/20 transition appearance-none">
              <option value="profissional">Profissional</option>
              <option value="amigavel">Amigável e descontraído</option>
              <option value="formal">Formal</option>
              <option value="tecnico">Técnico</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase mb-2">Mensagem de saudação</label>
            <input type="text" value={config.saudacao}
              onChange={e => setConfig({ ...config, saudacao: e.target.value })}
              placeholder="Olá! Como posso te ajudar hoje?"
              className="w-full bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-blue-bright focus:ring-2 focus:ring-blue/20 transition"
            />
          </div>
        </div>

        <div className="bg-deep border border-border rounded-xl p-6 flex flex-col gap-5">
          <h2 className="font-heading font-semibold text-base text-white border-b border-border pb-4">Prompt de instrução</h2>
          <p className="text-muted text-xs font-light -mt-2">Define como o agente se comporta em todas as conversas.</p>
          <textarea value={config.prompt}
            onChange={e => setConfig({ ...config, prompt: e.target.value })}
            rows={6}
            placeholder="Você é um assistente virtual da empresa. Seu objetivo é…"
            className="w-full bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-blue-bright focus:ring-2 focus:ring-blue/20 transition resize-none"
          />
        </div>

        <div className="bg-deep border border-border rounded-xl p-6 flex flex-col gap-5">
          <h2 className="font-heading font-semibold text-base text-white border-b border-border pb-4">Limites</h2>
          <div>
            <label className="block font-mono text-[10px] text-blue-bright tracking-[0.14em] uppercase mb-2">
              Escalar para humano após (nº de mensagens)
            </label>
            <input type="number" min={5} max={100} value={config.escalarApos}
              onChange={e => setConfig({ ...config, escalarApos: Number(e.target.value) })}
              className="w-32 bg-surface/50 border border-border rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-bright focus:ring-2 focus:ring-blue/20 transition"
            />
          </div>
        </div>

        <div className="bg-void border border-border/50 rounded-xl p-5">
          <p className="font-mono text-[10px] text-muted tracking-widest uppercase mb-3">Segurança — sempre ativo</p>
          {['Validação de conteúdo em todas as mensagens', 'Log completo de interações', 'Conformidade LGPD'].map(f => (
            <div key={f} className="flex items-center gap-2 py-1.5">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-muted text-xs font-light">{f}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving}
            className="px-8 py-3 rounded-full bg-white text-void text-sm font-medium transition hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
          {saved && (
            <span className="flex items-center gap-2 text-green text-sm font-mono">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              Salvo!
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
