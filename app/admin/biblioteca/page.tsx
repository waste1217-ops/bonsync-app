import { T } from '@/lib/styles'
import { LibraryManager } from './LibraryManager'

export const dynamic = 'force-dynamic'

export default function AdminBibliotecaPage() {
  return (
    <div className="animate-slide-up" style={{ maxWidth: 1040 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={T.h1}>Biblioteca</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          Prompts, respostas prontas e fluxos reutilizáveis para montar agentes mais rápido.
        </p>
      </div>
      <LibraryManager />
    </div>
  )
}
