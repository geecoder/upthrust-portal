import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Learner } from '@/lib/types';

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/portal');

  const db = createAdminClient();
  const { data: learners } = await db.from('learners').select('*').order('created_at', { ascending: false });
  const typedLearners = (learners || []) as Learner[];

  const stats = {
    total: typedLearners.length,
    active: typedLearners.filter(l => l.enrollment_status === 'Active').length,
    pm: typedLearners.filter(l => l.pathway === 'PM').length,
    ba: typedLearners.filter(l => l.pathway === 'BA').length,
    premium: typedLearners.filter(l => l.tier === 'Premium').length,
    green: typedLearners.filter(l => l.risk_status === 'Green').length,
    amber: typedLearners.filter(l => l.risk_status === 'Amber').length,
    red: typedLearners.filter(l => l.risk_status === 'Red').length,
  };

  const riskColor: Record<string, string> = { Green: 'var(--moss)', Amber: 'var(--amber-deep)', Red: 'var(--red)' };

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>All Learners — Cohort 1</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Enrolled', value: stats.total, color: 'var(--ink)' },
          { label: 'PM / BA', value: `${stats.pm} / ${stats.ba}`, color: 'var(--amber-deep)' },
          { label: 'Premium Tier', value: stats.premium, color: 'var(--moss)' },
          { label: 'At Risk 🔴', value: stats.red, color: 'var(--red)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
            <p style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 6 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Learner table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Learner</th>
              <th>Pathway</th>
              <th>Tier</th>
              <th>Country</th>
              <th>Risk</th>
              <th>Assignments</th>
              <th>Avg Score</th>
              <th>Passport</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {typedLearners.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-muted)' }}>
                  No learners enrolled yet. They will appear here once they sign up and you approve their access.
                </td>
              </tr>
            ) : typedLearners.map(learner => (
              <tr key={learner.id}>
                <td>
                  <div>
                    <p style={{ fontWeight: 600 }}>{learner.first_name} {learner.last_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{learner.email}</p>
                  </div>
                </td>
                <td><span className={`badge badge-${learner.pathway === 'PM' ? 'ink' : 'amber'}`}>{learner.pathway}</span></td>
                <td><span className={`badge badge-${learner.tier === 'Premium' ? 'green' : 'ink'}`}>{learner.tier}</span></td>
                <td style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>{learner.country || '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor[learner.risk_status || 'Green'] }} />
                    <span style={{ fontSize: '0.8125rem', color: riskColor[learner.risk_status || 'Green'], fontWeight: 600 }}>{learner.risk_status || 'Green'}</span>
                  </div>
                </td>
                <td>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{learner.assignment_completion_pct || 0}%</p>
                    <div style={{ width: 60, height: 4, background: 'var(--paper-line)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${learner.assignment_completion_pct || 0}%`, background: 'var(--amber)', borderRadius: 2 }} />
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, color: (learner.avg_score || 0) >= 70 ? 'var(--moss)' : 'var(--amber-deep)' }}>
                  {learner.avg_score ? `${learner.avg_score}` : '—'}
                </td>
                <td>
                  <span className={`badge badge-${learner.passport_issued ? 'green' : learner.passport_eligibility === 'Approved' ? 'amber' : 'ink'}`}>
                    {learner.passport_issued ? '✓ Issued' : learner.passport_eligibility === 'Approved' ? 'Approved' : learner.passport_eligibility || 'Not Eligible'}
                  </span>
                </td>
                <td>
                  <Link href={`/admin/learners/${learner.id}`} className="btn btn-sm btn-outline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
