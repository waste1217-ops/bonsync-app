/**
 * Roteador de canal de WhatsApp do painel.
 * Escolhe Meta (Cloud API) ou Evolution por AGENTE, com base na config:
 *  - se config.meta_phone_number_id existe → Meta
 *  - senão → Evolution (comportamento anterior, inalterado)
 * Retorna { key: { id } } e lança erros no mesmo formato dos dois clientes,
 * então os chamadores e o mapSendError continuam iguais.
 */
import { sendText } from './evolution'
import { sendMetaText } from './meta'

export interface WaConfig {
  whatsapp_instance?: string
  meta_phone_number_id?: string
  meta_token?: string
}

/** Canal ativo do agente. */
export function canalDe(cfg?: WaConfig | null): 'meta' | 'evolution' {
  return cfg?.meta_phone_number_id ? 'meta' : 'evolution'
}

/** Rótulo amigável do canal (para logs/painel). */
export function canalLabel(cfg?: WaConfig | null): string {
  return canalDe(cfg) === 'meta' ? 'WhatsApp Oficial (Meta)' : 'Evolution'
}

/**
 * Envia texto pelo canal correto do agente.
 * @param cfg  agent.config (whatsapp_instance / meta_phone_number_id / meta_token)
 * @param to   telefone/JID do contato (Evolution aceita @lid; Meta usa só dígitos)
 */
export async function sendWhatsApp(cfg: WaConfig | null | undefined, to: string, text: string) {
  if (cfg?.meta_phone_number_id) {
    return sendMetaText(cfg.meta_phone_number_id, to, text, cfg.meta_token)
  }
  const instance = cfg?.whatsapp_instance
  if (!instance) throw new Error('SEND_TARGET:NO_INSTANCE')
  return sendText(instance, to, text)
}
