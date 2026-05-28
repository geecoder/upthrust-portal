export const dynamic = 'force-dynamic';

/**
 * Email notification API
 * Uses Resend (resend.com) — free tier: 100 emails/day, 3,000/month
 * Falls back gracefully if RESEND_API_KEY is not set
 */

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

type NotificationType =
  | 'feedback_ready'
  | 'resubmission_required'
  | 'assignment_due'
  | 'session_reminder'
  | 'passport_approved'
  | 'announcement'
  | 'inactivity_nudge';

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Notify] RESEND_API_KEY not set — skipping email to', to);
    return { sent: false, reason: 'no_api_key' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Upthrust <noreply@upthrustdigital.com>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Notify] Resend error:', err);
      return { sent: false, reason: err };
    }

    return { sent: true };
  } catch (err) {
    console.error('[Notify] Email send failed:', err);
    return { sent: false, reason: String(err) };
  }
}

function emailTemplate(
  learnerName: string,
  heading: string,
  body: string,
  ctaLabel?: string,
  ctaUrl?: string
) {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://upthrust-portal-qj18.vercel.app';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#F3EFE6;font-family:Manrope,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3EFE6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#0F1A2E;border-radius:8px;overflow:hidden;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="background:#0F1A2E;padding:28px 36px 20px;border-bottom:3px solid #C5743A;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:Georgia,serif;font-size:20px;font-weight:400;color:#FAF7F1;letter-spacing:-0.02em;">Upthrust</span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(250,247,241,0.4);">Career Capability Accelerator</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#FAF7F1;padding:36px;">
              <p style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#A05A26;margin:0 0 12px;">Hi ${learnerName}</p>
              <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#0F1A2E;letter-spacing:-0.02em;margin:0 0 20px;line-height:1.2;">${heading}</h1>
              <div style="font-size:15px;line-height:1.7;color:#1F2B42;">${body}</div>
              ${ctaLabel && ctaUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td>
                    <a href="${ctaUrl}" style="display:inline-block;background:#0F1A2E;color:#FAF7F1;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;border-radius:4px;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#0F1A2E;padding:20px 36px;border-top:1px solid rgba(250,247,241,0.1);">
              <p style="font-size:11px;color:rgba(250,247,241,0.4);margin:0;line-height:1.6;">
                Cohort 1 · Upthrust Career Capability Accelerator<br>
                <a href="${portalUrl}" style="color:#C5743A;text-decoration:none;">${portalUrl}</a> · info@upthrustdigital.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, learnerId, assignmentId, weekNumber, pathway, score, customMessage } = body;

  const db = createAdminClient();
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://upthrust-portal-qj18.vercel.app';

  const { data: learner } = await db
    .from('learners')
    .select('first_name, last_name, email')
    .eq('id', learnerId)
    .single();

  if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });

  const name = `${learner.first_name} ${learner.last_name || ''}`.trim();

  let subject = '';
  let heading = '';
  let bodyHtml = '';
  let ctaLabel = '';
  let ctaUrl = `${portalUrl}/portal/assignments`;

  switch (type as NotificationType) {
    case 'feedback_ready':
      subject = `Feedback on your Week ${weekNumber} assignment is ready`;
      heading = `Your Week ${weekNumber} feedback is ready`;
      bodyHtml = `
        <p>Genesis has reviewed your <strong>${pathway} assignment for Week ${weekNumber}</strong>.</p>
        ${score ? `<p style="font-size:24px;font-family:Georgia,serif;color:#A05A26;font-weight:400;margin:16px 0;">Score: <strong>${score}/100</strong></p>` : ''}
        <p>Log into the portal to read your full feedback, understand what worked well, and action any improvements.</p>
        ${score && Number(score) < 70 ? `<p style="background:#FEF3C7;padding:14px;border-left:3px solid #D97706;margin:16px 0;"><strong>Note:</strong> Your score is below 70. Review the feedback carefully and consider resubmitting to improve your Capability Passport eligibility.</p>` : ''}
      `;
      ctaLabel = 'Read Feedback';
      break;

    case 'resubmission_required':
      subject = `Action required: Resubmit your Week ${weekNumber} assignment`;
      heading = `Your Week ${weekNumber} assignment needs revision`;
      bodyHtml = `
        <p>Genesis has reviewed your <strong>${pathway} assignment for Week ${weekNumber}</strong> and has requested a resubmission.</p>
        <p>This is not a failure — revision is a core part of the program. Read the feedback carefully, make the specific improvements Genesis has described, and resubmit.</p>
        <p style="background:#FEF2F2;padding:14px;border-left:3px solid #DC2626;margin:16px 0;"><strong>Important:</strong> Resubmit within 72 hours to maintain your submission rate for Passport eligibility.</p>
      `;
      ctaLabel = 'View Feedback & Resubmit';
      break;

    case 'passport_approved':
      subject = 'Your Capability Passport has been approved 🏆';
      heading = 'Your Capability Passport is approved';
      bodyHtml = `
        <p>Congratulations — you have met all the criteria for the Upthrust Capability Passport.</p>
        <p>Genesis has reviewed your evidence and formally approved your Passport. You can now download it from the portal.</p>
        <p>Your Passport includes your capability scores, portfolio highlights, capstone summary, and a unique verifiable ID that employers can check.</p>
        <p>Well done for completing the program to this standard.</p>
      `;
      ctaLabel = 'Download Your Passport';
      ctaUrl = `${portalUrl}/portal/passport`;
      break;

    case 'session_reminder':
      subject = `Reminder: Live session Week ${weekNumber} — tomorrow`;
      heading = `Week ${weekNumber} live session is tomorrow`;
      bodyHtml = `
        <p>Your Upthrust live session for Week ${weekNumber} is <strong>tomorrow</strong>.</p>
        <p>Make sure you have reviewed this week's content in the portal and have your Week ${weekNumber} assignment in progress.</p>
        <p>Come prepared: camera on, work visible, questions ready.</p>
        ${process.env.NEXT_PUBLIC_ZOOM_LINK ? `<p>Zoom link: <a href="${process.env.NEXT_PUBLIC_ZOOM_LINK}" style="color:#C5743A;">${process.env.NEXT_PUBLIC_ZOOM_LINK}</a></p>` : ''}
      `;
      ctaLabel = 'View Week Content';
      ctaUrl = `${portalUrl}/portal/week/${weekNumber}`;
      break;

    case 'inactivity_nudge':
      subject = 'We haven\'t seen you in the portal this week';
      heading = 'Don\'t fall behind — we\'re here to help';
      bodyHtml = `
        <p>We noticed you haven't logged into the Upthrust portal this week.</p>
        ${customMessage ? `<p>${customMessage}</p>` : `<p>Missing sessions or assignments can affect your Capability Passport eligibility. If you're facing any challenges, reach out to Genesis directly at <a href="mailto:info@upthrustdigital.com" style="color:#C5743A;">info@upthrustdigital.com</a>.</p>`}
        <p>Log in to see where you are and what to do next.</p>
      `;
      ctaLabel = 'Go to Portal';
      ctaUrl = `${portalUrl}/portal`;
      break;

    case 'announcement':
      subject = customMessage?.subject || 'New announcement from Upthrust';
      heading = customMessage?.title || 'New announcement';
      bodyHtml = `<p>${customMessage?.content || ''}</p>`;
      ctaLabel = 'View in Portal';
      ctaUrl = `${portalUrl}/portal`;
      break;

    default:
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  }

  const html = emailTemplate(name, heading, bodyHtml, ctaLabel, ctaUrl);
  const result = await sendEmail(learner.email, subject, html);

  // Also create an in-portal notification record
  await db.from('notifications').insert({
    learner_id: learnerId,
    type,
    title: heading,
    message: bodyHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 200),
    related_assignment_id: assignmentId || null,
    is_read: false,
  }).then(() => {}, () => {});

  return NextResponse.json({ ...result, learner: name });
}

// GET — trigger session reminders for all learners
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const weekNumber = url.searchParams.get('week');
  const notifType = url.searchParams.get('type') || 'session_reminder';

  if (!weekNumber) return NextResponse.json({ error: 'week param required' }, { status: 400 });

  const db = createAdminClient();
  const { data: learners } = await db
    .from('learners')
    .select('id, first_name, last_name, email')
    .eq('enrollment_status', 'Active');

  if (!learners?.length) return NextResponse.json({ sent: 0 });

  const results = await Promise.allSettled(
    learners.map(l =>
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({ type: notifType, learnerId: l.id, weekNumber: parseInt(weekNumber) }),
      })
    )
  );

  return NextResponse.json({ sent: results.filter(r => r.status === 'fulfilled').length, total: learners.length });
}
