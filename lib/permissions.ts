// Níveis de acesso administrativo da Bonsync.
// - owner   : controle total, incluindo gestão da equipe
// - manager : operação completa (clientes, agentes, conversas), sem gerir equipe
// - viewer  : somente leitura (suporte/consulta)

export type AdminLevel = 'owner' | 'manager' | 'viewer'

export const ADMIN_LEVELS: { value: AdminLevel; label: string; desc: string }[] = [
  { value: 'owner',   label: 'Dono',     desc: 'Controle total, incluindo a equipe e configurações.' },
  { value: 'manager', label: 'Gestor',   desc: 'Opera clientes, agentes e conversas. Não gere a equipe.' },
  { value: 'viewer',  label: 'Leitura',  desc: 'Apenas visualiza dados. Não pode alterar nada.' },
]

export const levelLabel: Record<string, string> = {
  owner: 'Dono', manager: 'Gestor', viewer: 'Leitura',
}

export const levelVariant = (l?: string | null): 'blue' | 'green' | 'muted' =>
  l === 'owner' ? 'blue' : l === 'manager' ? 'green' : 'muted'

// Normaliza: admins sem nível definido são tratados como 'owner' (retrocompatível
// com o primeiro admin criado antes do sistema de níveis).
export function effectiveLevel(role?: string | null, level?: string | null): AdminLevel | null {
  if (role !== 'admin') return null
  if (level === 'owner' || level === 'manager' || level === 'viewer') return level
  return 'owner'
}

export function canWrite(role?: string | null, level?: string | null): boolean {
  const l = effectiveLevel(role, level)
  return l === 'owner' || l === 'manager'
}

export function isOwner(role?: string | null, level?: string | null): boolean {
  return effectiveLevel(role, level) === 'owner'
}
