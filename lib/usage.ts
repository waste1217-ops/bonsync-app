/**
 * Cálculo de consumo e custo de tokens por modelo.
 * Preços aproximados da Anthropic (USD por milhão de tokens).
 * Ajuste conforme a tabela oficial / sua margem.
 */

// USD por 1 milhão de tokens [input, output]
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-opus-4-5':           { in: 5,    out: 25 },
  'claude-sonnet-4-5':         { in: 3,    out: 15 },
  'claude-haiku-4-5-20251001': { in: 1,    out: 5 },
  'claude-3-5-haiku-latest':   { in: 0.8,  out: 4 },
  'default':                   { in: 3,    out: 15 }, // fallback (sonnet)
}

// Cotação USD→BRL (ajuste conforme necessário, ou puxe de uma API depois)
const USD_TO_BRL = 5.5

export interface TokenTotals {
  inputTokens: number
  outputTokens: number
}

/** Soma tokens de uma lista de mensagens */
export function sumTokens(messages: { input_tokens?: number | null; output_tokens?: number | null }[]): TokenTotals {
  return messages.reduce(
    (acc, m) => ({
      inputTokens:  acc.inputTokens  + (m.input_tokens  || 0),
      outputTokens: acc.outputTokens + (m.output_tokens || 0),
    }),
    { inputTokens: 0, outputTokens: 0 }
  )
}

/** Custo estimado em BRL para um dado modelo */
export function estimateCostBRL(totals: TokenTotals, model?: string): number {
  const price = PRICING[model || 'default'] || PRICING.default
  const usd =
    (totals.inputTokens  / 1_000_000) * price.in +
    (totals.outputTokens / 1_000_000) * price.out
  return usd * USD_TO_BRL
}

/** Formata número grande com separador de milhar */
export function fmtTokens(n: number): string {
  return n.toLocaleString('pt-BR')
}

/** Formata BRL */
export function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
