// Modelos de agenda por segmento — rótulos, campos extras e (p/ alimentício)
// modalidades de pedido. Campos extras ficam em meetings.campos (jsonb).
// O cliente também pode adicionar campos próprios em config.scheduling.campos.

export interface CampoExtra { k: string; label: string }
export interface Segmento {
  label: string
  cliente: string        // rótulo de "cliente" (ex.: Paciente)
  servico: string        // rótulo de "serviço/motivo" (ex.: Procedimento)
  profissional: string   // rótulo de "responsável" (ex.: Profissional)
  campos: CampoExtra[]   // campos extras do segmento
  pedidos?: boolean      // true = trabalha com pedidos/entregas (alimentício etc.)
}

// Campos de pedido (alimentício) — vão para meetings.campos
const CAMPOS_PEDIDO: CampoExtra[] = [
  { k: 'produtos', label: 'Produtos' },
  { k: 'quantidade', label: 'Quantidade' },
  { k: 'valor_produtos', label: 'Valor dos produtos' },
  { k: 'taxa_entrega', label: 'Taxa de entrega' },
  { k: 'valor_total', label: 'Valor total' },
  { k: 'forma_pagamento', label: 'Forma de pagamento' },
  { k: 'endereco', label: 'Endereço de entrega' },
  { k: 'ponto_referencia', label: 'Ponto de referência' },
]

export const MODALIDADES_PEDIDO = [
  'Pronta entrega', 'Delivery', 'Retirada no local', 'Encomenda', 'Pedido agendado', 'Reserva de mesa',
]

const PAG: CampoExtra = { k: 'forma_pagamento', label: 'Forma de pagamento' }

export const SEGMENTOS: Record<string, Segmento> = {
  comercial:   { label: 'Comercial / Vendas',  cliente: 'Cliente',  servico: 'Reunião / motivo', profissional: 'Responsável',  campos: [{ k: 'tipo_reuniao', label: 'Tipo de reunião' }] },
  clinica:     { label: 'Clínica / Saúde',     cliente: 'Paciente', servico: 'Procedimento',     profissional: 'Profissional', campos: [{ k: 'convenio', label: 'Convênio' }, { k: 'especialidade', label: 'Especialidade' }, { k: 'tipo_consulta', label: 'Tipo de consulta' }, PAG] },
  consultorio: { label: 'Consultório',         cliente: 'Paciente', servico: 'Consulta',         profissional: 'Profissional', campos: [{ k: 'convenio', label: 'Convênio' }, { k: 'especialidade', label: 'Especialidade' }, { k: 'tipo_consulta', label: 'Tipo de consulta' }, PAG] },
  salao:       { label: 'Salão de beleza',     cliente: 'Cliente',  servico: 'Serviço',          profissional: 'Profissional', campos: [PAG] },
  barbearia:   { label: 'Barbearia',           cliente: 'Cliente',  servico: 'Serviço',          profissional: 'Barbeiro',     campos: [PAG] },
  spa:         { label: 'Spa / Estética',      cliente: 'Cliente',  servico: 'Procedimento',     profissional: 'Profissional', campos: [{ k: 'sala', label: 'Sala' }, PAG] },
  academia:    { label: 'Academia / Estúdio',  cliente: 'Aluno',    servico: 'Aula / avaliação', profissional: 'Instrutor',    campos: [{ k: 'plano', label: 'Plano' }] },
  oficina:     { label: 'Oficina / Automotivo', cliente: 'Cliente', servico: 'Serviço',          profissional: 'Técnico',      campos: [{ k: 'veiculo', label: 'Veículo' }, { k: 'modelo', label: 'Modelo' }, { k: 'placa', label: 'Placa' }, { k: 'previsao_conclusao', label: 'Previsão de conclusão' }, { k: 'valor_estimado', label: 'Valor estimado' }, PAG] },
  imobiliaria: { label: 'Imobiliária',         cliente: 'Cliente',  servico: 'Tipo de visita',   profissional: 'Corretor',     campos: [{ k: 'imovel', label: 'Imóvel' }, { k: 'endereco_imovel', label: 'Endereço do imóvel' }, { k: 'tipo_interesse', label: 'Tipo de interesse' }, { k: 'tipo_visita', label: 'Tipo de visita' }] },
  servicos:    { label: 'Serviços / Visita técnica', cliente: 'Cliente', servico: 'Tipo de serviço', profissional: 'Técnico',  campos: [{ k: 'endereco', label: 'Endereço' }, { k: 'equipamento', label: 'Equipamento' }, { k: 'prioridade', label: 'Prioridade' }, { k: 'valor_estimado', label: 'Valor estimado' }, PAG] },
  escritorio:  { label: 'Escritório',          cliente: 'Cliente',  servico: 'Assunto',          profissional: 'Responsável',  campos: [{ k: 'tipo_reuniao', label: 'Tipo de reunião' }] },
  restaurante: { label: 'Restaurante (pedidos)', cliente: 'Cliente', servico: 'Pedido',          profissional: 'Responsável',  campos: CAMPOS_PEDIDO, pedidos: true },
  lanchonete:  { label: 'Lanchonete (pedidos)',  cliente: 'Cliente', servico: 'Pedido',          profissional: 'Responsável',  campos: CAMPOS_PEDIDO, pedidos: true },
  pizzaria:    { label: 'Pizzaria (pedidos)',    cliente: 'Cliente', servico: 'Pedido',          profissional: 'Responsável',  campos: CAMPOS_PEDIDO, pedidos: true },
  padaria:     { label: 'Padaria (pedidos)',     cliente: 'Cliente', servico: 'Pedido',          profissional: 'Responsável',  campos: CAMPOS_PEDIDO, pedidos: true },
  marmitaria:  { label: 'Marmitaria (pedidos)',  cliente: 'Cliente', servico: 'Pedido',          profissional: 'Responsável',  campos: CAMPOS_PEDIDO, pedidos: true },
  confeitaria: { label: 'Confeitaria (encomendas)', cliente: 'Cliente', servico: 'Encomenda',    profissional: 'Responsável',  campos: CAMPOS_PEDIDO, pedidos: true },
  alimenticio: { label: 'Alimentício (geral)',  cliente: 'Cliente',  servico: 'Pedido',          profissional: 'Responsável',  campos: CAMPOS_PEDIDO, pedidos: true },
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

// Status da agenda (rótulo + variante de cor). Inclui status de pedido (alimentício).
export const AGENDA_STATUS: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'muted' | 'blue'; pedido?: boolean }> = {
  aguardando_info:    { label: 'Aguardando informações',     variant: 'yellow' },
  aguardando:         { label: 'Aguardando confirmação',     variant: 'yellow' },
  aguardando_escolha: { label: 'Aguardando escolha',         variant: 'blue' },
  sugerida:           { label: 'Sugerida pela IA',           variant: 'blue' },
  detectada:          { label: 'Detectada pela IA',          variant: 'blue' },
  confirmada:         { label: 'Confirmado',                 variant: 'green' },
  reagendada:         { label: 'Reagendado',                 variant: 'blue' },
  em_atendimento:     { label: 'Em atendimento',             variant: 'blue' },
  em_preparacao:      { label: 'Em preparação',              variant: 'blue', pedido: true },
  pronto:             { label: 'Pronto',                     variant: 'green', pedido: true },
  saiu_entrega:       { label: 'Saiu para entrega',          variant: 'blue', pedido: true },
  aguardando_retirada:{ label: 'Aguardando retirada',        variant: 'yellow', pedido: true },
  entregue:           { label: 'Entregue',                   variant: 'green', pedido: true },
  realizada:          { label: 'Concluído',                  variant: 'green' },
  cancelada:          { label: 'Cancelado',                  variant: 'muted' },
  ausente:            { label: 'Não compareceu',             variant: 'red' },
  recusada:           { label: 'Recusado',                   variant: 'muted' },
}
