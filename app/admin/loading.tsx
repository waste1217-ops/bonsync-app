export default function Loading() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 22 }}>
        <div className="skeleton" style={{ width: 200, height: 26, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: 360, maxWidth: '70%', height: 14 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 92 }} />)}
      </div>
      <div className="skeleton" style={{ height: 280 }} />
    </div>
  )
}
