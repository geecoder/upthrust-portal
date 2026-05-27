export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { text, documentType, pathway } = body;

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: 'Please paste at least 50 characters of text to check.' }, { status: 400 });
  }

  const systemPrompt = `You are a writing quality reviewer for product and business analysis documentation. You work with professionals across Africa and the UK who are developing their product careers. Your job is to review their written documentation and give specific, actionable feedback to make it more professional and precise.

You are NOT reviewing the content quality or strategic thinking — that's the facilitator's job. You are specifically reviewing: professional tone, clarity, specificity, and structure.

Common issues you look for:
- Passive voice overuse (makes documents feel weak and unclear about who does what)
- Vague language: "various", "several", "things", "stuff", "some", "many", "etc.", "and so on"
- Weasel words: "basically", "generally", "typically", "kind of", "sort of", "quite"
- Missing specificity: numbers without context ("many users" → how many?), time without definition ("soon", "quickly", "later")
- Unnecessary filler: "In order to" → "To", "Due to the fact that" → "Because", "At this point in time" → "Now"
- Inconsistent terminology: calling the same thing different names in the same document
- Sentences over 35 words (readability drops sharply)
- Missing structure where it would help (unnumbered requirements, unheaded sections)
- Unprofessional hedging: "I think", "I believe", "Maybe", "Perhaps" in formal documents
- For requirements specifically: untestable language ("the system should be fast", "user-friendly", "intuitive")

Your response format MUST be exactly:

**Writing Quality Score: [X]/10**
[One sentence summary of overall quality]

**Issues Found**

| # | Issue Type | Your Text | Better Version |
|---|-----------|-----------|----------------|
[List each issue as a table row — max 8 issues, prioritised by severity]

**Top 3 Fixes to Make Before Submitting**
1. [Most important fix — specific]
2. [Second most important]
3. [Third]

**One thing you're doing well**
[Genuinely positive, specific — don't skip this]

Keep total response under 500 words. Be specific and reference actual text from the document.`;

  const userMessage = `Document type: ${documentType || 'Product/BA document'}
Pathway: ${pathway || 'PM/BA'}

Text to review:
---
${text.substring(0, 3000)}
---

Please review this text for writing quality and professional presentation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  const data = await response.json();
  const result = data.content?.[0]?.text || '';

  return NextResponse.json({ result, wordCount: text.trim().split(/\s+/).length });
}
