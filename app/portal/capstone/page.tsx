export const dynamic = 'force-dynamic';

// app/portal/capstone/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The capstone surface: the brief, the deliverables and where a learner stands
// on each of them.
//
// Every word of content here comes from the `weeks` rows whose phase is
// 'Capstone' — weeks 9-12 in the live curriculum, each with its own
// pathway-specific title, brief and deliverable already authored by the owner.
// Nothing on this page is written into the code, so the capstone changes when
// the curriculum changes rather than when someone edits this file.
//
// A SERVER component, deliberately. Every other learner page that reads
// learner-scoped data does it from the browser with the anon key, and RLS shows
// that key nothing — which is why the notifications surface has never worked
// (docs/DEFERRED.md D-22). Reading server-side with the service-role client is
// the shape that does work, and a new page should not inherit a known defect.
//
// Submission deliberately LINKS to /portal/assignments rather than repeating
// the form. The capstone weeks are assignment rows like any other week, and
// AssignmentSubmitPanel there already handles submit, resubmit and the
// resubmission counter. A second write path to the same table would be a second
// thing to keep correct.
// ─────────────────────────────────────────────────────────────────────────────
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase';
import type { Learner, Assignment, Week, PortfolioItem } from '@/lib/types';
import { ASSIGNMENT_STATUS_COLOR, ASSIGNMENT_STATUS_BG, PASSPORT_CRITERIA, isApprovedWork } from '@/lib/types';
import CapstoneArtefacts from './CapstoneArtefacts';

export default async function CapstonePage() {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');

  const db = createAdminClient();

  const { data: learner } = await db
    .from('learners')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  // No learner row is the normal case for an admin who has come here through
  // the override. The portal layout has already decided they may be here, so
  // this page only has to cope with having nobody to show progress for.
  const typedLearner = (learner ?? null) as Learner | null;
  const pathway = typedLearner?.pathway === 'BA' ? 'BA' : 'PM';

  // Every published week, not just the capstone ones: the arc below needs the
  // four capstone weeks, and the evidence count needs all of them.
  const [{ data: weeks }, { data: assignments }, { data: artefacts }] = await Promise.all([
    db.from('weeks').select('*').eq('is_published', true).order('week_number'),
    typedLearner
      ? db.from('assignments').select('*').eq('learner_id', typedLearner.id).order('week_number')
      : Promise.resolve({ data: [] as Assignment[] }),
    typedLearner
      ? db.from('portfolio_items').select('*').eq('learner_id', typedLearner.id).order('week_number')
      : Promise.resolve({ data: [] as PortfolioItem[] }),
  ]);

  const allWeeks = (weeks || []) as Week[];
  const capstoneWeeks = allWeeks.filter((w) => w.phase === 'Capstone');
  const typedAssignments = (assignments || []) as Assignment[];
  const typedArtefacts = (artefacts || []) as PortfolioItem[];

  // Approved work across the WHOLE programme — this is what the Capability
  // Passport counts, and it is counted from assignments rather than from
  // portfolio_items because that is what the passport criteria have always
  // read (see app/portal/passport/page.tsx). portfolio_items feeds nothing.
  const approvedOverall = typedAssignments.filter(isApprovedWork).length;
  const artefactTarget = PASSPORT_CRITERIA.capstone_artefacts_min;

  function assignmentFor(weekNumber: number): Assignment | undefined {
    return typedAssignments.find((a) => a.week_number === weekNumber && a.pathway === pathway);
  }

  // Per-week content for this learner's pathway. The `weeks` table carries a
  // pm_* and a ba_* set of columns; picking between them here keeps the
  // rendering below pathway-agnostic.
  const stages = capstoneWeeks.map((w) => ({
    week: w,
    title: (pathway === 'PM' ? w.pm_assignment_title : w.ba_assignment_title) || w.title,
    brief: pathway === 'PM' ? w.pm_assignment_brief : w.ba_assignment_brief,
    deliverable: pathway === 'PM' ? w.pm_deliverable : w.ba_deliverable,
    dueDate: pathway === 'PM' ? w.pm_due_date : w.ba_due_date,
    assignment: assignmentFor(w.week_number),
  }));

  const submitted = stages.filter((s) => s.assignment && s.assignment.status !== 'Not Started').length;
  const approved = stages.filter((s) => isApprovedWork(s.assignment)).length;

  if (stages.length === 0) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 500, marginBottom: 12 }}>
          Capstone
        </h1>
        <p style={{ color: 'var(--ink-muted)', lineHeight: 1.65 }}>
          No capstone weeks have been published yet. They appear here as soon as they are.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            marginBottom: 6,
          }}
        >
          {pathway} Pathway · {stages.length} stages
        </p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.875rem', fontWeight: 500 }}>Capstone</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.6 }}>
          The work your Capability Passport rests on. Each stage below is submitted the same way as any
          other week&rsquo;s assignment.
        </p>
      </div>

      {/* Progress across the arc. Counted from assignment rows, not from
          learners.capstone_status — that column is maintained by hand in the
          admin screens and would disagree with the submissions on this page. */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '16px 20px',
          marginBottom: 24,
          background: 'var(--paper-soft)',
          border: '1px solid var(--paper-line)',
          borderRadius: 8,
        }}
      >
        {[
          { label: 'Stages submitted', value: `${submitted} of ${stages.length}` },
          { label: 'Approved', value: `${approved} of ${stages.length}` },
          ...(typedLearner ? [{ label: 'Capstone status', value: typedLearner.capstone_status || 'Not Started' }] : []),
        ].map(({ label, value }) => (
          <div key={label}>
            <p
              style={{
                fontSize: '0.5625rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
                marginBottom: 4,
              }}
            >
              {label}
            </p>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem' }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {stages.map(({ week, title, brief, deliverable, dueDate, assignment }) => {
          const status = assignment?.status || 'Not Started';
          const isApproved = isApprovedWork(assignment);

          return (
            <div
              key={week.id}
              className="card"
              style={{ borderLeft: `3px solid ${isApproved ? 'var(--moss)' : status !== 'Not Started' ? '#2563EB' : 'var(--amber)'}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div>
                  <p
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-muted)',
                      marginBottom: 4,
                    }}
                  >
                    Week {week.week_number}
                    {dueDate && ` · due ${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </p>
                  <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>{title}</h2>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    padding: '4px 10px',
                    borderRadius: 100,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    background: ASSIGNMENT_STATUS_BG[status] ?? 'var(--paper-soft)',
                    color: ASSIGNMENT_STATUS_COLOR[status] ?? 'var(--ink-muted)',
                  }}
                >
                  {status}
                </span>
              </div>

              {brief && (
                <p style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                  {brief}
                </p>
              )}

              {deliverable && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    background: 'var(--paper-soft)',
                    borderRadius: 6,
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-muted)',
                      marginBottom: 4,
                    }}
                  >
                    Deliverable
                  </p>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{deliverable}</p>
                </div>
              )}

              <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {assignment?.score && (
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: 'var(--amber-deep)' }}>
                    {assignment.score}/100
                  </span>
                )}
                <Link href={`/portal/week/${week.week_number}`} className="btn btn-outline btn-sm">
                  Week {week.week_number} detail
                </Link>
                {isApproved ? (
                  <span style={{ fontSize: '0.875rem', color: 'var(--moss)', fontWeight: 700 }}>✓ Approved</span>
                ) : (
                  <Link href="/portal/assignments" className="btn btn-primary btn-sm">
                    {status === 'Not Started'
                      ? 'Submit work'
                      : status === 'Resubmission Requested'
                        ? 'Resubmit →'
                        : 'View status'}
                  </Link>
                )}
              </div>

              {assignment?.feedback && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    background: 'rgba(37,99,235,0.05)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    borderRadius: 6,
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#1D4ED8',
                      marginBottom: 4,
                    }}
                  >
                    Facilitator feedback
                  </p>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{assignment.feedback}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Programme-wide evidence. Separate from the arc above because the
          passport counts approved work from every week, not only weeks 9-12,
          and a learner looking at "8 required" needs to see the same number
          the passport screen shows them. */}
      <div
        style={{
          marginTop: 32,
          padding: '16px 20px',
          background: 'var(--paper-soft)',
          border: '1px solid var(--paper-line)',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '0.5625rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              marginBottom: 4,
            }}
          >
            Approved artefacts, all weeks
          </p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem' }}>
            {approvedOverall}{' '}
            <span style={{ fontSize: '0.9375rem', color: 'var(--ink-muted)' }}>of {artefactTarget} required</span>
          </p>
        </div>
        <Link href="/portal/passport" className="btn btn-outline btn-sm">
          View Passport progress
        </Link>
      </div>

      {typedLearner && (
        <CapstoneArtefacts items={typedArtefacts} weekOptions={allWeeks.map((w) => w.week_number)} />
      )}
    </div>
  );
}
