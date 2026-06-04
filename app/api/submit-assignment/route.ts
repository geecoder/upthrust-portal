export const dynamic = 'force-dynamic';

/**
 * Assignment submission API
 * Uses admin client (service role) to bypass RLS for writes.
 * After saving, immediately calls Anthropic API for AI feedback.
 * Returns both the assignment record and AI feedback in one response.
 */

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const FEEDBACK_PROMPTS: Record<string, string> = {
  'Product Teardown': `You are a senior product leader reviewing a learner's product teardown. The learner cannot see their submission from your view — you are coaching them based on the assignment context.

Evaluate based on what strong work looks like for a Product Teardown:
1. Clear user identification (specific person, not generic "users")
2. Business model understanding (how does the product make money?)
3. PM decision identification (what specific product choices are visible in the features?)
4. Specificity (specific observations vs generic statements)
5. Insight quality (at least one non-obvious observation)

Respond in this exact format:
**What strong work looks like for this assignment:**
[2-3 sentences on what a high-scoring teardown includes]

**Common mistakes to avoid:**
- [specific mistake 1]
- [specific mistake 2]
- [specific mistake 3]

**Verify your submission includes:**
- [ ] A named, specific user (not "users" or "people")
- [ ] At least 3 visible PM decisions with your reasoning
- [ ] Your recommendation for what you would change and why

Keep it under 200 words. Be direct and specific.`,

  'Problem Brief': `You are a senior product leader reviewing a learner's Problem Brief.

Respond in this exact format:
**What strong work looks like for a Problem Brief:**
[2-3 sentences on what makes an excellent problem brief]

**Common mistakes to avoid:**
- Describing solutions instead of problems
- Defining users too broadly ("small businesses", "people who...")
- Missing the business reason why this problem matters
- Conflating symptoms with root causes

**Verify your submission includes:**
- [ ] A specific named user profile (not "users")
- [ ] The current situation (what they do today)
- [ ] The friction or pain (what breaks, costs time, causes loss)
- [ ] Why this matters to the business
- [ ] What "good" looks like without proposing a solution

Under 200 words. Direct and specific.`,

  'PRD': `You are a senior product leader reviewing a learner's PRD.

Respond in this exact format:
**What strong work looks like for a PRD:**
[2-3 sentences on what a high-quality PRD includes]

**Common mistakes to avoid:**
- User stories that describe UI instead of outcomes ("I want a button" vs "I want to...")
- Acceptance criteria that are not testable ("it should be fast" vs "load time < 2 seconds")
- Missing error states and edge cases
- Success metrics that are vanity metrics

**Verify your submission includes:**
- [ ] User stories in "As a [who]... I want [what]... So that [why]..." format
- [ ] Acceptance criteria that a QA engineer can test
- [ ] At least one non-functional requirement
- [ ] A clear "out of scope" section

Under 200 words.`,

  'BRD': `You are a senior BA reviewing a learner's BRD.

Respond in this exact format:
**What strong work looks like for a BRD:**
[2-3 sentences on what makes an excellent BRD]

**Common mistakes to avoid:**
- Requirements that describe how instead of what
- Missing non-functional requirements (performance, security, accessibility)
- Stakeholders listed without roles or RACI assignments
- Assumptions buried in requirements instead of stated explicitly

**Verify your submission includes:**
- [ ] Numbered functional requirements (FR-001, FR-002...)
- [ ] Non-functional requirements section
- [ ] Assumptions and constraints clearly stated
- [ ] Stakeholder sign-off section
- [ ] Open questions log

Under 200 words.`,

  'Stakeholder': `You are a senior product practitioner reviewing a stakeholder management exercise.

Respond in this exact format:
**What strong work looks like:**
[2-3 sentences on what excellent stakeholder management looks like]

**Common mistakes to avoid:**
- Reacting emotionally instead of de-escalating first
- Making commitments you haven't validated with engineering
- Forgetting to document the outcome of the conversation
- Missing the stakeholder's underlying concern (vs their stated position)

**Verify your submission shows:**
- [ ] You listened and acknowledged the stakeholder's concern before responding
- [ ] You separated their position from their underlying interest
- [ ] You proposed a specific next step with a timeline
- [ ] You documented the outcome

Under 200 words.`,

  'default': `You are a senior product/BA practitioner reviewing a learner's assignment submission.

Respond in this exact format:
**What strong work looks like for this assignment:**
[2-3 sentences specific to "${2}" pathway work at this level]

**Common mistakes to avoid:**
- Being too generic instead of specific to the product/problem
- Describing what, not why — strong work explains reasoning
- Missing professional structure (headers, numbered lists, clear sections)
- Leaving obvious gaps without acknowledging them

**Verify your submission includes:**
- [ ] Clear structure that a stakeholder could read without explanation
- [ ] Specific examples and evidence, not general statements
- [ ] A summary of your key decisions and reasoning
- [ ] All required elements listed in the assignment brief

Under 200 words. Be specific and actionable.`,
};

function getPrompt(assignmentTitle: string, pathway: string): string {
  const key = Object.keys(FEEDBACK_PROMPTS).find(k =>
    assignmentTitle.toLowerCase().includes(k.toLowerCase())
  );
  return FEEDBACK_PROMPTS[key || 'default'].replace('${2}', pathway);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { weekNumber, pathway, submissionUrl, submissionNotes, assignmentTitle, assignmentBrief } = body;

  if (!weekNumber === undefined || !pathway || !submissionUrl) {
    return NextResponse.json({ error: 'weekNumber, pathway, and submissionUrl are required' }, { status: 400 });
  }

  const db = createAdminClient();

  // 1. Find the learner record
  const { data: learner, error: learnerError } = await db
    .from('learners')
    .select('id, pathway')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (learnerError || !learner) {
    return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
  }

  // 2. Check for existing assignment (for resubmission)
  const { data: existing } = await db
    .from('assignments')
    .select('id, status, resubmission_count')
    .eq('learner_id', learner.id)
    .eq('week_number', weekNumber)
    .eq('pathway', pathway)
    .maybeSingle();

  const isResubmission = existing?.status === 'Needs Revision';
  const resubCount = isResubmission ? (existing?.resubmission_count ?? 0) + 1 : 0;

  // 3. Upsert the assignment
  let assignmentId: string;

  if (existing?.id) {
    const { error: updateError } = await db
      .from('assignments')
      .update({
        submission_url: submissionUrl,
        submission_notes: submissionNotes || null,
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
        resubmission_count: resubCount,
        ai_feedback: null,
        ai_feedback_at: null,
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Assignment update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    assignmentId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await db
      .from('assignments')
      .insert({
        learner_id: learner.id,
        week_number: weekNumber,
        pathway,
        submission_url: submissionUrl,
        submission_notes: submissionNotes || null,
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
        resubmission_count: 0,
      })
      .select('id')
      .maybeSingle();

    if (insertError || !inserted) {
      console.error('Assignment insert error:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Insert failed' }, { status: 500 });
    }
    assignmentId = inserted.id;
  }

  // 4. Generate AI feedback via Anthropic
  let aiFeedback = '';
  try {
    const systemPrompt = getPrompt(assignmentTitle || '', pathway);
    const userMessage = `The learner has submitted their ${pathway} Week ${weekNumber} assignment: "${assignmentTitle || 'Assignment'}".

Their submission is at: ${submissionUrl}

Assignment brief summary: ${assignmentBrief ? assignmentBrief.substring(0, 300) : 'Not provided'}

Since you cannot access the link, provide guidance based on what the assignment requires. Be direct, specific, and encouraging.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Faster + cheaper for auto-feedback
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (anthropicRes.ok) {
      const aiData = await anthropicRes.json();
      aiFeedback = aiData.content?.[0]?.text || '';
    } else {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
    }
  } catch (aiErr) {
    console.error('AI feedback generation failed:', aiErr);
    // Don't fail the whole request — submission was already saved
  }

  // 5. Save AI feedback to assignment
  if (aiFeedback) {
    await db
      .from('assignments')
      .update({
        ai_feedback: aiFeedback,
        ai_feedback_at: new Date().toISOString(),
        status: 'AI Reviewed',
      })
      .eq('id', assignmentId);
  }

  return NextResponse.json({
    success: true,
    assignmentId,
    aiFeedback: aiFeedback || null,
  });
}
