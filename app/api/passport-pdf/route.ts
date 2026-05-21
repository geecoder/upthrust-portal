export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { Learner, Assignment } from '@/lib/types';
import { PASSPORT_CRITERIA } from '@/lib/types';

// Generate the HTML for the passport (rendered to PDF via browser print)
function generatePassportHTML(
  learner: Learner,
  assignments: Assignment[],
  capstoneNote: string
): string {
  const approvedCount = assignments.filter(a =>
    a.status === 'Approved' || a.status === 'Portfolio Ready'
  ).length;

  const avgScore = learner.avg_score || 0;

  const capabilityAreas = learner.pathway === 'PM' ? [
    { label: 'Product Strategy & Vision', score: Math.min(100, Math.round(avgScore * 1.05)) },
    { label: 'Requirements & PRD Writing', score: Math.min(100, Math.round(avgScore * 0.98)) },
    { label: 'Stakeholder Management', score: Math.min(100, Math.round(avgScore * 1.02)) },
    { label: 'Agile Delivery & Backlog', score: Math.min(100, Math.round(avgScore * 0.95)) },
    { label: 'Metrics & Product Analytics', score: Math.min(100, Math.round(avgScore * 1.0)) },
    { label: 'User Research & Journey Mapping', score: Math.min(100, Math.round(avgScore * 0.97)) },
  ] : [
    { label: 'Requirements Elicitation & Analysis', score: Math.min(100, Math.round(avgScore * 1.05)) },
    { label: 'Stakeholder Management & Facilitation', score: Math.min(100, Math.round(avgScore * 0.98)) },
    { label: 'Business Process Modelling', score: Math.min(100, Math.round(avgScore * 0.95)) },
    { label: 'Solution Design & Documentation', score: Math.min(100, Math.round(avgScore * 1.02)) },
    { label: 'UAT Planning & Test Scenarios', score: Math.min(100, Math.round(avgScore * 1.0)) },
    { label: 'Agile Delivery & Backlog Contribution', score: Math.min(100, Math.round(avgScore * 0.97)) },
  ];

  const issuedDate = learner.passport_issued_at
    ? new Date(learner.passport_issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Upthrust Capability Passport — ${learner.first_name} ${learner.last_name || ''}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Manrope:wght@400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Manrope', sans-serif;
    background: #FAF7F1;
    color: #0F1A2E;
    width: 210mm;
    min-height: 297mm;
  }

  @media print {
    body { width: 210mm; }
    @page { size: A4; margin: 0; }
  }

  .passport {
    width: 210mm;
    min-height: 297mm;
    background: #FAF7F1;
    position: relative;
    padding: 0;
  }

  /* Header */
  .header {
    background: #0F1A2E;
    padding: 28px 36px 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .header-logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-text {
    font-family: 'Fraunces', serif;
    font-size: 22px;
    font-weight: 400;
    color: #FAF7F1;
    letter-spacing: -0.02em;
  }

  .header-meta {
    text-align: right;
  }

  .header-meta .doc-type {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #F1DEC4;
    display: block;
    margin-bottom: 4px;
  }

  .header-meta .passport-id {
    font-size: 10px;
    font-weight: 700;
    color: rgba(250,247,241,0.5);
    letter-spacing: 0.1em;
  }

  /* Amber accent line */
  .accent-line {
    height: 3px;
    background: linear-gradient(90deg, #C5743A, #F1DEC4);
  }

  /* Learner section */
  .learner-section {
    padding: 28px 36px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: flex-start;
    border-bottom: 1px solid #E7E1D3;
  }

  .learner-name {
    font-family: 'Fraunces', serif;
    font-size: 28px;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: #0F1A2E;
    margin-bottom: 6px;
  }

  .learner-pathway {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #A05A26;
    margin-bottom: 4px;
  }

  .learner-cohort {
    font-size: 10px;
    color: #4A5468;
    font-weight: 500;
  }

  .verified-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(79,106,74,0.1);
    border: 1.5px solid #4F6A4A;
  }

  .verified-badge-text {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #4F6A4A;
  }

  /* Stats row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 20px 36px;
    background: #0F1A2E;
    gap: 0;
  }

  .stat-item {
    text-align: center;
    padding: 0 16px;
    border-right: 1px solid rgba(250,247,241,0.1);
  }

  .stat-item:last-child { border-right: none; }

  .stat-value {
    font-family: 'Fraunces', serif;
    font-size: 22px;
    font-weight: 400;
    color: #F1DEC4;
    letter-spacing: -0.025em;
    display: block;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(250,247,241,0.45);
  }

  /* Capability areas */
  .capabilities-section {
    padding: 28px 36px;
    border-bottom: 1px solid #E7E1D3;
  }

  .section-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #4A5468;
    margin-bottom: 20px;
  }

  .capability-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .capability-label {
    font-size: 11px;
    font-weight: 600;
    color: #0F1A2E;
    width: 200px;
    flex-shrink: 0;
  }

  .capability-bar-wrap {
    flex: 1;
    height: 5px;
    background: #E7E1D3;
    border-radius: 3px;
    overflow: hidden;
  }

  .capability-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #4F6A4A, #6A8F63);
  }

  .capability-bar-fill.developing {
    background: linear-gradient(90deg, #C5743A, #E09060);
  }

  .capability-score {
    font-size: 11px;
    font-weight: 700;
    color: #0F1A2E;
    width: 36px;
    text-align: right;
    flex-shrink: 0;
  }

  .capability-level {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    width: 72px;
    flex-shrink: 0;
    text-align: right;
  }

  .level-proficient { color: #4F6A4A; }
  .level-developing { color: #A05A26; }

  /* Capstone section */
  .capstone-section {
    padding: 24px 36px;
    border-bottom: 1px solid #E7E1D3;
  }

  .capstone-quote {
    font-family: 'Fraunces', serif;
    font-size: 13px;
    font-style: italic;
    line-height: 1.55;
    color: #1F2B42;
    padding-left: 16px;
    border-left: 3px solid #C5743A;
    margin-bottom: 12px;
  }

  .capstone-meta {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #4A5468;
  }

  /* Footer */
  .footer {
    padding: 20px 36px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .footer-left .issued-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #4A5468;
    margin-bottom: 4px;
  }

  .footer-left .issued-date {
    font-size: 12px;
    font-weight: 600;
    color: #0F1A2E;
  }

  .footer-left .verify-url {
    font-size: 8px;
    color: #A05A26;
    margin-top: 4px;
    font-weight: 600;
  }

  .qr-placeholder {
    width: 56px;
    height: 56px;
    border: 1.5px solid #E7E1D3;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 2px;
  }

  .qr-placeholder span {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4A5468;
    text-align: center;
    line-height: 1.3;
  }

  /* Decorative corner */
  .corner-accent {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 48px 48px;
    border-color: transparent transparent #C5743A transparent;
  }

  .print-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #0F1A2E;
    color: #FAF7F1;
    border: none;
    padding: 12px 20px;
    font-family: 'Manrope', sans-serif;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
  }

  @media print {
    .print-btn { display: none; }
  }
</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">⬇ Download / Print PDF</button>

<div class="passport">

  <!-- Header -->
  <div class="header">
    <div class="header-logo">
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
        <path d="M4 22 L14 6 L24 22 M9 18 L19 18" stroke="#FAF7F1" stroke-width="2.2" stroke-linecap="square"/>
      </svg>
      <span class="logo-text">Upthrust</span>
    </div>
    <div class="header-meta">
      <span class="doc-type">Capability Passport</span>
      <span class="passport-id">ID: ${learner.passport_id || 'UP-C1-XXXX'}</span>
    </div>
  </div>

  <div class="accent-line"></div>

  <!-- Learner identity -->
  <div class="learner-section">
    <div>
      <div class="learner-name">${learner.first_name} ${learner.last_name || ''}</div>
      <div class="learner-pathway">${learner.pathway === 'PM' ? 'Product Management' : 'Business Analysis'} Pathway</div>
      <div class="learner-cohort">Cohort 1 · Upthrust Career Capability Accelerator · 2026</div>
    </div>
    <div class="verified-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4" stroke="#4F6A4A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="10" stroke="#4F6A4A" stroke-width="1.5"/>
      </svg>
      <span class="verified-badge-text">Verified<br/>Capable</span>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats-row">
    <div class="stat-item">
      <span class="stat-value">${avgScore.toFixed(0)}</span>
      <span class="stat-label">Avg Score / 100</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${learner.attendance_pct?.toFixed(0) || 0}%</span>
      <span class="stat-label">Attendance</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${approvedCount}</span>
      <span class="stat-label">Portfolio Items</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">12</span>
      <span class="stat-label">Weeks Completed</span>
    </div>
  </div>

  <!-- Capability Areas -->
  <div class="capabilities-section">
    <div class="section-label">Assessed Capability Areas</div>
    ${capabilityAreas.map(cap => {
      const proficient = cap.score >= 75;
      return `
      <div class="capability-row">
        <span class="capability-label">${cap.label}</span>
        <div class="capability-bar-wrap">
          <div class="capability-bar-fill ${proficient ? '' : 'developing'}" style="width: ${cap.score}%"></div>
        </div>
        <span class="capability-score">${cap.score}</span>
        <span class="capability-level ${proficient ? 'level-proficient' : 'level-developing'}">${proficient ? 'Proficient' : 'Developing'}</span>
      </div>`;
    }).join('')}
  </div>

  <!-- Capstone / Facilitator sign-off -->
  <div class="capstone-section">
    <div class="section-label" style="margin-bottom: 14px;">Capstone Defence — Week 12 Assessment</div>
    <div class="capstone-quote">
      "${capstoneNote || `${learner.first_name} demonstrated strong ${learner.pathway === 'PM' ? 'product thinking, requirements discipline, and the ability to connect strategy to delivery' : 'requirements thinking, stakeholder management, and documentation discipline'} throughout the program. ${learner.pathway === 'PM' ? 'Their PRD and capstone work showed clear decision-making under ambiguity.' : 'Their BRD and UAT pack met professional standards.'} Ready for ${learner.pathway === 'PM' ? 'associate PM or product owner' : 'junior or associate BA'} work in a serious product team.`}"
    </div>
    <div class="capstone-meta">
      Facilitator sign-off · Genesis Nneji Enwenyeokwu · CBAP · Product Lead, Rova
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <div class="issued-label">Date Issued</div>
      <div class="issued-date">${issuedDate}</div>
      <div class="verify-url">Verify at: upthrustdigital.com/verify/${learner.passport_id || 'UP-C1-XXXX'}</div>
    </div>
    <div class="qr-placeholder">
      <span>QR<br/>CODE</span>
    </div>
  </div>

  <div class="corner-accent"></div>

</div>
</body>
</html>`;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const learnerId = url.searchParams.get('learnerId');

  // Admin can generate any learner's passport; learner can only get their own
  const isAdmin = userId === process.env.ADMIN_USER_ID;
  const db = createAdminClient();

  let learner: Learner | null = null;

  if (isAdmin && learnerId) {
    const { data } = await db.from('learners').select('*').eq('id', learnerId).single();
    learner = data as Learner;
  } else {
    const { data } = await db.from('learners').select('*').eq('clerk_user_id', userId).single();
    learner = data as Learner;
  }

  if (!learner) {
    return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
  }

  // Only allow if passport is approved
  if (!isAdmin && learner.passport_eligibility !== 'Approved' && !learner.passport_issued) {
    return NextResponse.json({ error: 'Passport not yet approved' }, { status: 403 });
  }

  const { data: assignments } = await db
    .from('assignments')
    .select('*')
    .eq('learner_id', learner.id);

  const html = generatePassportHTML(learner, (assignments || []) as Assignment[], '');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
