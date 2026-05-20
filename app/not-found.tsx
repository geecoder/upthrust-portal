export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#FAF7F1', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4A5468', marginBottom: 12 }}>404</p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', fontWeight: 400, color: '#0F1A2E', marginBottom: 12 }}>Page not found</h1>
          <p style={{ color: '#4A5468', marginBottom: 24 }}>The page you're looking for doesn't exist.</p>
          <a href="/portal" style={{ background: '#0F1A2E', color: '#FAF7F1', padding: '10px 20px', textDecoration: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem' }}>
            Go to Portal
          </a>
        </div>
      </body>
    </html>
  );
}
