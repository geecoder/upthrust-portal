import { SignUp } from '@clerk/nextjs';
export default function SignUpPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <path d="M4 22 L14 6 L24 22 M9 18 L19 18" stroke="#FAF7F1" strokeWidth="2.2" strokeLinecap="square"/>
            </svg>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', color: '#FAF7F1', letterSpacing: '-0.02em' }}>Upthrust</span>
          </div>
          <p style={{ color: 'rgba(250,247,241,0.55)', fontSize: '0.875rem' }}>Create your portal account</p>
        </div>
        <SignUp routing="hash" />
      </div>
    </div>
  );
}
