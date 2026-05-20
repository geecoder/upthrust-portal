import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

// Force dynamic rendering — prevents Clerk from being called during static build
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Upthrust Portal — Cohort 1',
  description: 'The Upthrust Career Capability Accelerator learner portal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
