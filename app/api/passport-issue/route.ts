// app/api/passport-issue/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Issues (or re-issues / revokes) a Capability Passport.
// HUMAN-GATED: only an admin (ADMIN_USER_ID) may call this. This is the single
// action that turns verified evidence into a signed, immutable credential.
//
// Actions (POST body { action, learnerId, ... }):
//   - "issue"   : snapshot the learner's verified facts → passports row + signature
//   - "revoke"  : mark an issued passport revoked (stops verifying as valid)
//   - "reissue" : supersede the current passport with a fresh snapshot
//
// Mirrors the portal's existing action-dispatch + createAdminClient() pattern.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import {
  buildPassportId,
  signPassport,
  ratingForScore,
  readinessLevel,
  domainsFor,
  levelForDomainScore,
  MIN_OVERALL_THRESHOLD,
  type SignablePassport,
} from '@/lib/passport';

function isAdmin(userId: string | null): boolean {
  return !!userId && userId === process.env.ADMIN_USER_ID;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  const { action, learnerId } = body || {};
  if (!action || !learnerId) {
    return NextResponse.json({ error: 'action and learnerId are required' }, { status: 400 });
  }

  const db = createAdminClient();

  // ── REVOKE ────────────────────────────────────────────────────────────────
  if (action === 'revoke') {
    const { error } = await db
      .from('passports')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('learner_id', learnerId)
      .eq('status', 'issued');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'revoked' });
  }

  // ── ISSUE / REISSUE ─────────────────────────────────────────────────────────
  // 1) Load the learner record.
  const { data: learner, error: lErr } = await db
    .from('learners')
    .select('*')
    .eq('id', learnerId)
    .single();
  if (lErr || !learner) {
    return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
  }

  // 2) Enforce issuance preconditions (Notion 2.6 issuance rules).
  //    We read flags defensively — names may vary; adjust in ONE place here.
  const eligibility = learner.passport_eligibility ?? null;       // e.g. 'Approved'
  const alreadyIssuedFlag = learner.passport_issued === true;
  const overallScore = Number(learner.avg_score ?? 0);

  const eligibleByFlag = eligibility === 'Approved' || alreadyIssuedFlag;
  const eligibleByScore = overallScore >= MIN_OVERALL_THRESHOLD;

  if (!eligibleByFlag && !eligibleByScore) {
    return NextResponse.json({
      error: `Learner not eligible. Requires passport_eligibility = 'Approved' (or passport_issued) ` +
             `or overall score ≥ ${MIN_OVERALL_THRESHOLD}. Current score: ${overallScore}.`,
    }, { status: 409 });
  }

  // 3) Pull per-domain capability scores (snapshot).
  //    Table columns: learner_id, domain, score, capability, level.
  //    We select domain + score only; level is recomputed from score so it
  //    always matches the snapshotted number.
  const pathway: string = learner.pathway || learner.track || 'Product Management';
  const domains = domainsFor(pathway);

  const { data: capRows } = await db
    .from('capability_scores')
    .select('domain, score')
    .eq('learner_id', learnerId);

  const capMap = new Map<string, number>();
  (capRows || []).forEach((r: any) => capMap.set(String(r.domain), Number(r.score)));

  const capabilityBreakdown = domains.map((d) => {
    const score = capMap.has(d) ? capMap.get(d)! : overallScore; // fallback to overall
    return { domain: d, score, level: levelForDomainScore(score) };
  });

  // 4) Pull assessed evidence (assignments) for the Evidence Portfolio snapshot.
  //    Real column is week_number (not "week").
  const { data: assignmentRows } = await db
    .from('assignments')
    .select('title, score, status, reviewer, reviewed_by, submitted_at, week_number')
    .eq('learner_id', learnerId);

  const evidence = (assignmentRows || [])
    .filter((a: any) => a.score != null)
    .map((a: any) => ({
      title: a.title || `Week ${a.week_number ?? ''} Assignment`,
      score: Number(a.score),
      reviewer: a.reviewer || a.reviewed_by || 'Mentor Panel',
    }));

  // 5) Determine cohort + sequence + build the snapshot.
  const cohort: string = learner.cohort || 'Cohort 1';
  const cohortNumber = (String(cohort).match(/\d+/)?.[0]) || '1';
  const year = new Date().getFullYear();
  const issuedAt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // sequence = count of existing issued passports for this cohort+track + 1
  const track = /business/i.test(pathway) ? 'BA' : 'PM';
  const { count } = await db
    .from('passports')
    .select('id', { count: 'exact', head: true })
    .eq('track', track)
    .eq('cohort', cohort);
  const sequence = (count || 0) + 1;

  const passportId =
    learner.passport_id ||
    buildPassportId({ pathway, cohortNumber, year, sequence });

  const signable: SignablePassport = {
    passport_id: passportId,
    learner_id: learnerId,
    pathway,
    cohort,
    overall_score: overallScore,
    issued_at: issuedAt,
  };
  const signature = signPassport(signable);

  // 6) Supersede any prior issued passport for this learner (re-issue safety).
  await db
    .from('passports')
    .update({ status: 'superseded' })
    .eq('learner_id', learnerId)
    .eq('status', 'issued');

  // 7) Insert the immutable snapshot.
  const row = {
    passport_id: passportId,
    learner_id: learnerId,
    full_name: learner.full_name || `${learner.first_name ?? ''} ${learner.last_name ?? ''}`.trim(),
    country: learner.country || null,
    pathway,
    track,
    cohort,
    overall_score: overallScore,
    rating: ratingForScore(overallScore),
    readiness_level: readinessLevel(overallScore),
    capability_breakdown: capabilityBreakdown,   // jsonb
    evidence,                                     // jsonb
    portfolio_url: learner.portfolio_url || null,
    facilitator_note: learner.facilitator_note || null,
    issued_at: issuedAt,
    signature,
    status: 'issued',
  };

  const { data: inserted, error: insErr } = await db
    .from('passports')
    .insert(row)
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // 8) Mirror key fields back to the learner record (so existing UI keeps working).
  //    passport_issued_at is read by passport-pdf to show the original issue date.
  await db
    .from('learners')
    .update({ passport_issued: true, passport_id: passportId, passport_issued_at: issuedAt })
    .eq('id', learnerId);

  return NextResponse.json({
    ok: true,
    action: action === 'reissue' ? 'reissued' : 'issued',
    passport: inserted,
  });
}
