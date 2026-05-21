export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase-admin';
import Link from 'next/link';
import type { Week } from '@/lib/types';
import { PHASE_COLORS } from '@/lib/types';

export default async function WeekListPage() {
  const { userId } = await auth();
  const db = createAdminClient();
  const { data: weeks } = await db.from('weeks').select('*').eq('is_published', true).order('week_number');
  const typedWeeks = (weeks || []) as Week[];
  const currentWeek = getCurrentWeek();

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Program Content</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Weekly Content</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {typedWeeks.map((week) => {
          const phase = week.phase || 'Foundation';
          const color = PHASE_COLORS[phase];
          const isCurrent = week.week_number === currentWeek;
          const isPast = week.week_number < currentWeek;
          return (
            <Link key={week.week_number} href={`/portal/week/${week.week_number}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{
                borderTop: `3px solid ${color}`,
                opacity: !week.is_published ? 0.5 : 1,
                background: isCurrent ? 'var(--paper-soft)' : 'var(--white)',
                transition: 'box-shadow 200ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px -8px rgba(15,26,46,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Week {week.week_number}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {isCurrent && <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', background: 'rgba(197,116,58,0.1)', color: 'var(--amber-deep)', borderRadius: 4 }}>Current</span>}
                    {isPast && <span style={{ color: 'var(--moss)', fontSize: '0.875rem' }}>✓</span>}
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', background: `${color}18`, color, borderRadius: 4 }}>{phase}</span>
                  </div>
                </div>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>{week.title}</h3>
                {week.session_date && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Session: {new Date(week.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return 0;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}
