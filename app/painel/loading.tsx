export default function Loading() {
  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 22 }}>
        <div className="skeleton" style={{ width: 220, height: 26, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: 420, maxWidth: '70%', height: 14 }} />
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 96 }} />
        ))}
      </div>

      {/* Bloco grande + lateral */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 220 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 130 }} />
          <div className="skeleton" style={{ height: 130 }} />
        </div>
      </div>
    </div>
  )
}
