export default function HomePage() {
  return (
    <main style={{ maxWidth: 560, margin: '96px auto', padding: '0 24px' }}>
      <div className="card" style={{ padding: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-0.02em' }}>RocketRental</h1>
        <p style={{ color: 'var(--muted)' }}>
          App scaffold is running. Feature screens for managers and tenants are coming soon.
        </p>
      </div>
    </main>
  );
}
