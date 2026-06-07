import { T } from '@/lib/styles'
import { AvaliacoesPanel } from './AvaliacoesPanel'

export const dynamic = 'force-dynamic'

export default function AvaliacoesPage() {
  return (
    <div className="animate-slide-up" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Avaliações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          A satisfação dos seus clientes, lida pela IA a partir das conversas — com elogios e reclamações.
        </p>
      </div>
      <AvaliacoesPanel />
    </div>
  )
}
