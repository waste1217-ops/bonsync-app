import { T } from '@/lib/styles'
import { AvaliacoesPanel } from './AvaliacoesPanel'

export const dynamic = 'force-dynamic'

export default function AvaliacoesPage() {
  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Avaliações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          Acompanhe a satisfação dos clientes analisada pela IA a partir das conversas, elogios, reclamações e pontos de atenção.
        </p>
      </div>
      <AvaliacoesPanel />
    </div>
  )
}
