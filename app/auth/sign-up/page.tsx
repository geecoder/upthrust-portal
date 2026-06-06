export const dynamic = 'force-dynamic';

import { SignUp } from '@clerk/nextjs';
import { UpthrustLogo } from '@/components/UpthrustLogo';
export default function SignUpPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <UpthrustLogo size={26} wordmarkColor="#FAF7F1" />
          </div>
          <p style={{ color: 'rgba(250,247,241,0.55)', fontSize: '0.875rem' }}>Create your portal account</p>
        </div>
        <SignUp routing="hash" />
      </div>
    </div>
  );
}
