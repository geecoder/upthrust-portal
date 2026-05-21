export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// AI feedback prompts per assignment type
const FEEDBACK_PROMPTS: Record<string, string> = {
  'Product Teardown': `You are a senior product leader reviewing a learner's product teardown report.
Evaluate the submission against these criteria:
1. Clarity of product understanding (does the learner explain what the product does clearly?)
2. Business model analysis (do they identify how the company makes money?)
3. PM decision identification (do they identify real product decisions visible in the features?)
4. Specificity (are they specific or generic in their analysis?)
5. Insight quality (do they have at least one genuinely insightful observation?)

Give feedback in this exact structure:
**What you did well:**
- [2-3 specific things done well]

**What needs improvement:**
- [2-3 specific gaps with examples from the work]

**One priority action before resubmitting:**
[One specific thing to do]

Keep your tone professional but encouraging. Be specific — reference the actual work, not generic advice.
Maximum 250 words.`,

  'Problem Brief': `You are a senior product leader reviewing a learner's problem brief.
Evaluate against these criteria:
1. User specificity (is the user defined precisely, not broadly as "users"?)
2. Problem framing (is it a problem statement, not a solution statement?)
3. Business relevance (is there a clear business reason to solve this?)
4. Scope clarity (are boundaries clear — what's in and out?)
5. Current workaround identification (do they name how people cope today?)

Give feedback in this exact structure:
**What you did well:**
- [2-3 specific things]

**What needs improvement:**
- [2-3 specific gaps]

**One priority action:**
[One specific improvement]

Be specific. Reference the actual content. Maximum 250 words.`,

  'PRD': `You are a senior product leader reviewing a learner's Product Requirements Document.
Evaluate against these criteria:
1. User stories (correct format? testable? complete?)
2. Acceptance criteria (specific and measurable? not vague?)
3. Scope definition (clear what's in v1 and what's out?)
4. Edge cases (do they consider error states and exceptions?)
5. Success metrics (are they defined and measurable?)

Give feedback in this exact structure:
**What you did well:**
- [2-3 specific things]

**What needs improvement:**
- [2-3 specific gaps]

**One priority action:**
[One specific improvement]

Maximum 250 words.`,

  'BRD': `You are a senior business analyst reviewing a learner's Business Requirements Document.
Evaluate against these criteria:
1. Functional requirements (specific and numbered? not vague?)
2. Non-functional requirements (performance, security, accessibility included?)
3. Assumptions and constraints (clearly stated?)
4. Stakeholder list (complete? roles clear?)
5. Acceptance criteria (testable? linked to requirements?)

Give feedback in this exact structure:
**What you did well:**
- [2-3 specific things]

**What needs improvement:**
- [2-3 specific gaps]

**One priority action:**
[One specific improvement]

Maximum 250 words.`,

  'default': `You are a senior product practitioner reviewing a learner's assignment submission.
The learner is studying Product Management or Business Analysis.

Evaluate the submission against these general criteria:
1. Completeness — does it cover all required elements?
2. Clarity — is the thinking clear and well-structured?
3. Specificity — is it specific (not generic or vague)?
4. Professional quality — would this hold up in a real work environment?
5. Evidence of reasoning — do they explain their decisions?

Give feedback in this exact structure:
**What you did well:**
- [2-3 specific things done well]

**What needs improvement:**
- [2-3 specific gaps with examples]

**One priority action before resubmitting:**
[One specific, actionable improvement]

Be specific and reference the actual work. Maximum 250 words.`
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { assignmentId, submissionUrl, weekNumber, pathway, assignmentTitle } = body;

  if (!assignmentId || !submissionUrl) {
    return NextResponse.json({ error: 'assignmentId and submissionUrl required' }, { status: 400 });
  }

  // Get the system prompt for this assignment type
  const promptKey = Object.keys(FEEDBACK_PROMPTS).find(k =>
    assignmentTitle?.toLowerCase().includes(k.toLowerCase())
  ) || 'default';
  const systemPrompt = FEEDBACK_PROMPTS[promptKey];

  const userMessage = `Please review this ${pathway} assignment submission for Week ${weekNumber}.

Assignment title: ${assignmentTitle || 'Assignment'}
Submission link: ${submissionUrl}

Note: You cannot access the link directly, so evaluate based on the assignment context and provide guidance on what strong work should look like, what common mistakes to avoid, and what the learner should verify is in their submission.

Provide constructive, specific feedback that will help this learner improve their work.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status, await response.text());
      return NextResponse.json({ error: 'AI feedback temporarily unavailable' }, { status: 500 });
    }

    const data = await response.json();
    const aiFeedback = data.content?.[0]?.text || '';

    if (!aiFeedback) {
      return NextResponse.json({ error: 'No feedback generated' }, { status: 500 });
    }

    // Store AI feedback in the assignment record
    const db = createAdminClient();
    await db
      .from('assignments')
      .update({
        ai_feedback: aiFeedback,
        ai_feedback_at: new Date().toISOString(),
        status: 'In Review',
      })
      .eq('id', assignmentId);

    return NextResponse.json({ feedback: aiFeedback });

  } catch (err) {
    console.error('AI feedback error:', err);
    return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 });
  }
}
