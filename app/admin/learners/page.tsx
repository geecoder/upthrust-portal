export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Learner } from '@/lib/types';
import { RISK_COLOR, ASSIGNMENT_STATUS_COLOR } from '@/lib/types';

export default async function AllLearnersPage() {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/portal');

  const db = createAdminClient();
  const { data: learners } = await db.from('learners').select('*').order('first_name');
  const typedLearners = (learners || []) as Learner[];

  const active = typedLearners.filter(l => l.enrollment_status === 'Active');
  const pm = active.filter(l => l.pathway === 'PM').length;
  const ba = active.filter(l => l.pathway === 'BA').length;

  return (
    <div className="portal-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>All Learners — Cohort 1</h1>
          <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>{active.length} active · {pm} PM · {ba} BA</p>
        </div>
        <Link href="/admin/learners/add" className="btn btn-primary">+ Add Learner</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Enrolled', value: typedLearners.length, color: 'var(--ink)' },
          { label: 'Active', value: active.length, color: 'var(--moss)' },
          { label: 'At Risk 🔴', value: active.filter(l => l.risk_status === 'Red').length, color: 'var(--red)' },
          { label: 'Passport Ready', value: active.filter(l => l.passport_eligibility === 'Approved' || l.passport_issued).length, color: 'var(--amber-deep)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '18px' }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', marginTop: 6 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Learner</th>
              <th>Pathway</th>
              <th>Tier</th>
              <th>Country</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Assignments %</th>
              <th>Avg Score</th>
              <th>Attendance</th>
              <th>Passport</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {typedLearners.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-muted)' }}>
                No learners enrolled yet. They appear here once their accounts are activated.
              </td></tr>
            ) : typedLearners.map(l => (
              <tr key={l.id}>
                <td>
                  <p style={{ fontWeight: 600 }}>{l.first_name} {l.last_name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{l.email}</p>
                </td>
                <td><span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: l.pathway === 'PM' ? 'rgba(15,26,46,0.08)' : 'rgba(160,90,38,0.1)', color: l.pathway === 'PM' ? 'var(--ink)' : 'var(--amber-deep)' }}>{l.pathway}</span></td>
                <td style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>{l.tier}</td>
                <td style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>{l.country || '—'}</td>
                <td><span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: l.enrollment_status === 'Active' ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)', color: l.enrollment_status === 'Active' ? 'var(--moss)' : 'var(--ink-muted)' }}>{l.enrollment_status}</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLOR[l.risk_status || 'Green'] }} />
                    <span style={{ fontSize: '0.8125rem', color: RISK_COLOR[l.risk_status || 'Green'], fontWeight: 600 }}>{l.risk_status || 'Green'}</span>
                  </div>
                </td>
                <td>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.assignment_completion_pct || 0}%</p>
                    <div style={{ width: 56, height: 3, background: 'var(--paper-line)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${l.assignment_completion_pct || 0}%`, background: 'var(--amber)', borderRadius: 2 }} />
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, color: (l.avg_score || 0) >= 70 ? 'var(--moss)' : (l.avg_score || 0) > 0 ? 'var(--amber-deep)' : 'var(--ink-muted)' }}>
                  {l.avg_score ? `${l.avg_score}` : '—'}
                </td>
                <td style={{ color: (l.attendance_pct || 0) >= 75 ? 'var(--moss)' : 'var(--amber-deep)', fontWeight: 600, fontSize: '0.875rem' }}>
                  {l.attendance_pct ? `${l.attendance_pct}%` : '—'}
                </td>
                <td>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: l.passport_issued ? 'rgba(5,150,105,0.1)' : l.passport_eligibility === 'Approved' ? 'rgba(217,119,6,0.1)' : 'rgba(107,114,128,0.07)', color: l.passport_issued ? 'var(--moss)' : l.passport_eligibility === 'Approved' ? 'var(--amber-deep)' : 'var(--ink-muted)' }}>
                    {l.passport_issued ? '✓ Issued' : l.passport_eligibility || 'Not Eligible'}
                  </span>
                </td>
                <td><Link href={`/admin/learners/${l.id}`} className="btn btn-sm btn-outline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
