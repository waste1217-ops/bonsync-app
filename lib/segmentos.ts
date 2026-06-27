// Modelos de agenda por segmento — rótulos e campos extras adaptáveis.
// Os campos extras ficam em meetings.campos (jsonb). O cliente também pode
// adicionar campos próprios em config.scheduling.campos = [{k,label}].

export interface CampoExtra { k: string; label: string }
export interface Segmento {
  label: string
  cliente: string        // rótulo de "cliente" (ex.: Paciente)
  servico: string        // rótulo de "serviço/motivo" (ex.: Procedimento)
  profissional: string   // rótulo de "responsável" (ex.: Profissional)
  campos: CampoExtra[]   // campos extras do segmento
}

export const SEGMENTOS: Record<string, Segmento> = {
  comercial:   { label: 'Comercial / Vendas',  cliente: 'Cliente',  servico: 'Reunião / motivo', profissional: 'Responsável',  campos: [{ k: 'tipo_reuniao', label: 'Tipo de reunião' }] },
  clinica:     { label: 'Clínica / Saúde',     cliente: 'Paciente', servico: 'Procedimento',     profissional: 'Profissional', campos: [{ k: 'convenio', label: 'Convênio' }] },
  salao:       { label: 'Salão de beleza',     cliente: 'Cliente',  servico: 'Serviço',          profissional: 'Profissional', campos: [] },
  restaurante: { label: 'Restaurante',         cliente: 'Nome',     servico: 'Reserva',          profissional: 'Mesa',         campos: [{ k: 'pessoas', label: 'Qtd. pessoas' }, { k: 'mesa', label: 'Mesa' }] },
  escritorio:  { label: 'Escritório',          cliente: 'Cliente',  servico: 'Assunto',          profissional: 'Responsável',  campos: [{ k: 'tipo_reuniao', label: 'Tipo de reunião' }] },
  oficina:     { label: 'Oficina',             cliente: 'Cliente',  servico: 'Serviço',          profissional: 'Responsável',  campos: [{ k: 'veiculo', label: 'Veículo' }, { k: 'placa', label: 'Placa' }] },
  imobiliaria: { label: 'Imobiliária',         cliente: 'Cliente',  servico: 'Tipo de visita',   profissional: 'Corretor',     campos: [{ k: 'imovel', label: 'Imóvel' }] },
  outro:       { label: 'Outro / Personalizado', cliente: 'Cliente', servico: 'Serviço / motivo', profissional: 'Responsável', campos: [] },
}

export function getSegmento(key?: string | null): Segmento {
  return SEGMENTOS[key || 'comercial'] || SEGMENTOS.comercial
}

// Campos efetivos = campos do segmento + campos personalizados do cliente
export function camposEfetivos(seg: Segmento, custom?: CampoExtra[]): CampoExtra[] {
  const extras = Array.isArray(custom) ? custom.filter(c => c && c.k && c.label) : []
  const map = new Map<string, CampoExtra>()
  for (const c of [...seg.campos, ...extras]) map.set(c.k, c)
  return Array.from(map.values())
}

// Status da agenda (rótulo + variante de cor)
export const AGENDA_STATUS: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'muted' | 'blue' }> = {
  aguardando:         { label: 'Aguardando confirmação',     variant: 'yellow' },
  aguardando_info:    { label: 'Aguardando informações',     variant: 'yellow' },
  aguardando_escolha: { label: 'Aguardando escolha',         variant: 'blue' },
  sugerida:           { label: 'Sugerida pela IA',           variant: 'blue' },
  detectada:          { label: 'Detectada pela IA',          variant: 'blue' },
  confirmada:         { label: 'Confirmado',                 variant: 'green' },
  reagendada:         { label: 'Reagendado',                 variant: 'blue' },
  em_atendimento:     { label: 'Em atendimento',             variant: 'blue' },
  realizada:          { label: 'Concluído',                  variant: 'green' },
  cancelada:          { label: 'Cancelado',                  variant: 'muted' },
  ausente:            { label: 'Não compareceu',             variant: 'red' },
  recusada:           { label: 'Recusado',                   variant: 'muted' },
}
