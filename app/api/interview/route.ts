export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const QUESTION_BANKS: Record<string, {
  behavioural: Question[];
  technical: Question[];
  commercial: Question[];
}> = {
  PM: {
    behavioural: [
      {
        id: 'pm-b1',
        question: 'Tell me about a time you had to make a product decision without all the information you wanted. What did you do, and what happened?',
        whatTheyreReallyAsking: 'Can you operate under ambiguity? Do you have a process for deciding when you have enough information?',
        strongAnswerIndicators: ['Named a specific decision', 'Described their reasoning process', 'Acknowledged the risk', 'Shared the outcome honestly including if it went wrong'],
        modelAnswer: 'A strong answer names the specific product decision (e.g. "whether to build CSV export before we had confirmed demand"), explains exactly what information was missing and why waiting wasn\'t an option, walks through the reasoning used to decide anyway (data they did have, proxies, assumptions made explicit), shares the outcome honestly, and reflects on what they\'d do differently. The best answers acknowledge uncertainty as a normal condition, not a failure state.'
      },
      {
        id: 'pm-b2',
        question: 'Tell me about a product you worked on or observed that you think solved a problem really well. What made it work?',
        whatTheyreReallyAsking: 'Do you think analytically about products? Can you articulate why something works beyond "it\'s good"?',
        strongAnswerIndicators: ['Goes beyond surface features', 'Identifies the core user problem solved', 'Explains the business model connection', 'Shows genuine curiosity'],
        modelAnswer: 'Strong candidates pick a specific product (not "iPhone" or "Google" â€” too broad), identify the precise user problem it solved, explain why prior solutions failed, connect the product design to the business outcome, and show genuine enthusiasm. Bonus: they name something non-obvious that most people wouldn\'t think of.'
      },
      {
        id: 'pm-b3',
        question: 'Describe a situation where a stakeholder strongly disagreed with your product decision. How did you handle it?',
        whatTheyreReallyAsking: 'Can you hold your ground when challenged? Do you know when to update your position vs when to defend it?',
        strongAnswerIndicators: ['Explains the stakeholder\'s perspective fairly', 'Describes specific actions taken', 'Shows they listened before defending', 'Shares the resolution honestly'],
        modelAnswer: 'The best answers show the candidate first tried to genuinely understand the stakeholder\'s concern (not just listened to respond), used data or user evidence to support their position, found a way to address legitimate concerns while protecting the core decision, and were honest about cases where they updated their own view.'
      },
      {
        id: 'pm-b4',
        question: 'Tell me about a product feature or decision you championed that didn\'t work out. What did you learn?',
        whatTheyreReallyAsking: 'Are you self-aware? Can you fail without defending the failure or collapsing under it?',
        strongAnswerIndicators: ['Takes genuine ownership', 'Analyses root cause specifically', 'Identifies what they\'d do differently', 'Doesn\'t blame others or dismiss the failure'],
        modelAnswer: 'Strong candidates own the failure without excuses, analyse specifically what went wrong (wrong assumption, bad framing, insufficient validation, etc.), describe what they changed in their approach after, and show the lesson has actually stuck â€” ideally with an example of applying it since.'
      },
      {
        id: 'pm-b5',
        question: 'Walk me through how you decide what to build next when there are 10 things competing for attention.',
        whatTheyreReallyAsking: 'Do you have a real prioritisation process? Can you navigate competing stakeholder demands without making everyone equally unhappy?',
        strongAnswerIndicators: ['Describes a real framework or process', 'Mentions specific inputs used', 'Acknowledges the political dimension', 'Connects to business goals, not just user requests'],
        modelAnswer: 'A strong answer describes a real process (RICE, impact/effort, strategic alignment check), names the specific inputs used (user data, revenue impact, technical complexity, strategic fit), acknowledges that stakeholder management is part of prioritisation, and gives an example of using it in practice. Avoid candidates who only describe the framework without grounding it in a real example.'
      }
    ],
    technical: [
      {
        id: 'pm-t1',
        question: 'You\'re a PM at a fintech. Your North Star metric is "monthly active transacting users". It\'s been flat for 6 weeks. Walk me through how you diagnose what\'s happening.',
        whatTheyreReallyAsking: 'Can you think through a metrics problem systematically? Do you know the difference between a funnel problem and a retention problem?',
        strongAnswerIndicators: ['Breaks the metric into components', 'Asks clarifying questions before diagnosing', 'Looks at acquisition and retention separately', 'Proposes specific data queries, not just "look at dashboards"'],
        modelAnswer: 'Break "monthly active transacting users" into: new users who transact + returning users who transact. Then check: is acquisition flat/down? Or is activation failing (people sign up but don\'t transact)? Or are existing users churning? Each has a different diagnosis. Strong candidates then propose specific analyses: cohort retention curves, funnel conversion rates, first-transaction rates, and session data around abandonment points.'
      },
      {
        id: 'pm-t2',
        question: 'You need to write a PRD for a new feature that lets users set up recurring international transfers. What are the first 5 things you define before any wireframe exists?',
        whatTheyreReallyAsking: 'Do you think in requirements or in solutions? Do you know what questions to answer before design starts?',
        strongAnswerIndicators: ['Problem statement before solution', 'User definition', 'Scope and non-goals', 'Success metrics', 'Edge cases and constraints'],
        modelAnswer: '1) Who specifically is the user and what job are they trying to do (not "international users" but "Nigerian diaspora professionals sending monthly support to family in Lagos"). 2) What\'s the core problem â€” what\'s broken about the current experience? 3) Scope: what\'s in v1 and what\'s explicitly out. 4) Success metrics: how do we know it worked? 5) Constraints: regulatory (FCA, GDPR), technical (API rate limits), business (fraud risk). Wireframes come after all of this.'
      },
      {
        id: 'pm-t3',
        question: 'Your engineering team says the feature you want will take 6 weeks. Your CEO wants it in 2. How do you resolve this?',
        whatTheyreReallyAsking: 'Can you navigate timeline pressure without just capitulating or going to war?',
        strongAnswerIndicators: ['Seeks to understand both sides first', 'Explores scope reduction options', 'Doesn\'t promise the impossible', 'Has a process for escalation when genuinely stuck'],
        modelAnswer: 'Don\'t assume either number is fixed. First understand what\'s driving the CEO\'s 2-week timeline (is there a launch event? A competitor move?). Then work with engineering to understand what\'s in the 6 weeks â€” often there\'s a 2-week version if you scope aggressively. Propose options with explicit trade-offs. If neither party can move, escalate to a decision-maker with a clear framing of the choices and consequences â€” don\'t just let it fester.'
      }
    ],
    commercial: [
      {
        id: 'pm-c1',
        question: 'You\'re pitching to the CPO a new feature you want to build. They ask: "What\'s the business case?" How do you answer?',
        whatTheyreReallyAsking: 'Do you connect product decisions to business outcomes? Can you speak the language of revenue, retention, and risk?',
        strongAnswerIndicators: ['Links feature to a specific business outcome', 'Quantifies the opportunity where possible', 'Acknowledges the cost and risk', 'Has a success metric'],
        modelAnswer: 'A strong business case: names the user problem + size of affected user base, connects to a specific business metric (revenue per user, churn reduction, conversion rate), estimates the opportunity conservatively (better to underestimate and overdeliver), acknowledges what it costs and what risks exist, and defines how success would be measured at 30, 60, 90 days.'
      }
    ]
  },

  BA: {
    behavioural: [
      {
        id: 'ba-b1',
        question: 'Tell me about a time you had to get requirements from a stakeholder who didn\'t know what they wanted. How did you approach it?',
        whatTheyreReallyAsking: 'Can you elicit requirements from ambiguity? Do you have real techniques or do you just wait for people to tell you?',
        strongAnswerIndicators: ['Describes specific elicitation techniques used', 'Shows they dug for the real need, not the stated request', 'Explains how they verified understanding', 'Shares the outcome'],
        modelAnswer: 'Strong answers describe specific techniques: structured interviews with open-then-closed questions, prototyping to test understanding, process mapping to surface unstated assumptions, use cases to force specificity. Crucially, they distinguish between what the stakeholder asked for and what they actually needed â€” and explain how they bridged that gap.'
      },
      {
        id: 'ba-b2',
        question: 'Tell me about a time requirements changed significantly mid-project. How did you handle it?',
        whatTheyreReallyAsking: 'Are you adaptable? Do you have a process for change management that doesn\'t derail the project?',
        strongAnswerIndicators: ['Has a structured approach to change requests', 'Assessed impact before agreeing to anything', 'Communicated impact to stakeholders clearly', 'Didn\'t just accept or reject â€” managed it'],
        modelAnswer: 'Strong candidates describe a change request process: received the change, assessed impact on scope/timeline/cost before responding, presented the impact analysis to stakeholders, gave them a real choice (accept the change with consequences, defer, or descope something else), and documented whatever was agreed. Candidates who say "we just adapted" without impact analysis are showing a gap.'
      },
      {
        id: 'ba-b3',
        question: 'Describe a situation where two stakeholders wanted conflicting things. What did you do?',
        whatTheyreReallyAsking: 'Can you facilitate, not just document? Can you navigate politics while staying grounded in the real need?',
        strongAnswerIndicators: ['Sought to understand each stakeholder\'s underlying need, not just position', 'Facilitated a conversation rather than picking a side', 'Used data or evidence to support resolution', 'Escalated appropriately when needed'],
        modelAnswer: 'Best answers show the BA first investigated what each stakeholder actually needed (often different from what they asked for), facilitated a direct conversation between them rather than acting as messenger, reframed the conflict around the shared business goal, and helped them reach a decision â€” escalating only when truly stuck, with a clear options analysis.'
      },
      {
        id: 'ba-b4',
        question: 'Tell me about a BRD or requirements document you wrote that you\'re proud of. What made it good?',
        whatTheyreReallyAsking: 'Do you have professional standards? Can you articulate what "good" looks like in documentation?',
        strongAnswerIndicators: ['Describes specific qualities: testable, complete, unambiguous', 'Mentions the process, not just the output', 'References how it was validated with stakeholders', 'Honest about what they\'d improve'],
        modelAnswer: 'Strong candidates describe specific qualities: requirements were numbered and traceable, acceptance criteria were testable (not vague), assumptions were explicit, non-functional requirements were included. They also describe the process: how requirements were validated with stakeholders, whether it was peer-reviewed, and what feedback it received from engineering.'
      },
      {
        id: 'ba-b5',
        question: 'Walk me through how you run a requirements elicitation session from scratch.',
        whatTheyreReallyAsking: 'Do you have a repeatable process? Are you proactive or reactive?',
        strongAnswerIndicators: ['Pre-session prep described', 'Specific questions/techniques named', 'Post-session documentation process', 'Validation step included'],
        modelAnswer: 'Before: review existing documentation, identify stakeholders, prepare structured questions (open â†’ specific â†’ edge case). During: start with business context ("what problem are we solving?"), then current state ("walk me through what happens today"), then desired state, then constraints. After: document, circulate for validation, resolve gaps before signing off. Strong candidates mention they never start wireframes or design before requirements are validated.'
      }
    ],
    technical: [
      {
        id: 'ba-t1',
        question: 'A business owner says: "We need a report that shows all our customers." How do you turn that into a real requirement?',
        whatTheyreReallyAsking: 'Can you decompose a vague request into specific, actionable requirements?',
        strongAnswerIndicators: ['Identifies the vagueness immediately', 'Asks clarifying questions', 'Defines scope, filters, format, frequency', 'Writes a testable requirement at the end'],
        modelAnswer: 'The BA immediately asks: which customers? (all time, active, by geography?). What data about them? What format? Who uses it â€” and what decisions do they make from it? How often? Then writes a requirement like: "The report shall display all customers who have completed at least one transaction in the last 90 days, including name, registration date, total lifetime value, and last transaction date, filterable by country and product type, exportable as CSV, refreshed daily by 7am." That\'s a real requirement.'
      },
      {
        id: 'ba-t2',
        question: 'How would you document a process that has never been written down before? Walk me through your approach.',
        whatTheyreReallyAsking: 'Can you reverse-engineer and document undocumented processes? Do you know how to handle variation and exceptions?',
        strongAnswerIndicators: ['Shadow/observe before documenting', 'Interview multiple people doing the same role', 'Document exceptions, not just the happy path', 'Validate with stakeholders before finalising'],
        modelAnswer: 'Shadow the process being done in real time (don\'t just interview â€” watch). Interview at least 2-3 people doing the same role, because undocumented processes always have variation. Map the happy path first, then identify decision points and exceptions. Document as-is honestly (don\'t idealise it). Then validate by walking someone through the process map and asking "is this what you do?" â€” they\'ll correct it immediately.'
      },
      {
        id: 'ba-t3',
        question: 'You\'re doing UAT for a payment feature. What test scenarios do you include beyond the happy path?',
        whatTheyreReallyAsking: 'Can you think adversarially about a system? Do you test for what breaks, not just what works?',
        strongAnswerIndicators: ['Boundary conditions', 'Error states and failure scenarios', 'Concurrent and load scenarios', 'Regulatory/compliance edge cases for fintech'],
        modelAnswer: 'Beyond happy path: insufficient funds, expired cards, failed 3DS authentication, duplicate transaction attempts, network timeout mid-transaction, currency conversion edge cases, transaction limits (daily/monthly), suspicious transaction patterns triggering fraud rules, accessibility (screen reader, slow connection), and rollback/refund flows. For fintech specifically: AML flag scenarios, cross-border regulatory requirements, and data retention compliance.'
      }
    ],
    commercial: [
      {
        id: 'ba-c1',
        question: 'Your business analyst work often supports a change that has a cost. How do you help stakeholders understand the value of investing in proper requirements?',
        whatTheyreReallyAsking: 'Do you understand the commercial case for good BA work? Can you articulate ROI without being defensive?',
        strongAnswerIndicators: ['Connects BA rigour to cost avoidance', 'Has a concrete example of what bad requirements cost', 'Doesn\'t just say "it\'s important" â€” quantifies where possible'],
        modelAnswer: 'Strong BAs cite specific costs of poor requirements: rework (building the wrong thing), UAT failures, post-launch bugs, stakeholder conflict. They might say: "In my experience, every hour spent on clear requirements saves 4-6 hours of rework in development and testing. A missed requirement caught post-launch costs 10-100x more to fix than if caught in the requirements phase." They\'re fluent in the business case, not just the process case.'
      }
    ]
  }
};

type Question = {
  id: string;
  question: string;
  whatTheyreReallyAsking: string;
  strongAnswerIndicators: string[];
  modelAnswer: string;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { pathway, questionId, userAnswer, category, mode } = body;

  const bank = QUESTION_BANKS[pathway === 'PM' ? 'PM' : 'BA'];
  if (!bank) return NextResponse.json({ error: 'Invalid pathway' }, { status: 400 });

  if (mode === 'evaluate') {
    const allQ = [...bank.behavioural, ...bank.technical, ...bank.commercial];
    const question = allQ.find(q => q.id === questionId);
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    const systemPrompt = `You are a senior hiring manager and interview coach for product roles (PM and BA) in fintech and tech companies across Africa and the UK. You are evaluating a learner's interview answer against a specific question.

You are direct, kind, and deeply practical. You know what real hiring decisions look like. You don't inflate scores or give false encouragement, but you always explain specifically what's needed to improve.

Your evaluation MUST follow this exact format with these exact headings:

**Score: [X]/100**
[One sentence on overall quality]

**What worked**
[2-3 specific things from their actual answer that demonstrated good thinking â€” quote their words where helpful]

**What's missing or weak**
[2-3 specific gaps â€” be precise about what they said vs what they should have said]

**What the interviewer was really listening for**
[Explain the hidden intent behind the question â€” what signal was the interviewer trying to extract]

**A stronger version of your answer**
[Rewrite a key part of their answer to show what "good" looks like â€” not the whole thing, just the weakest part improved]

**Readiness verdict**
[Strong / Developing / Needs work] â€” [One sentence of honest assessment]

Keep the total response under 400 words. Be specific. No generic advice.`;

    const userMessage = `Interview question: "${question.question}"

What the interviewer is really asking: ${question.whatTheyreReallyAsking}

Strong answer would include: ${question.strongAnswerIndicators.join(', ')}

The learner's answer:
"${userAnswer}"

Please evaluate this answer now.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) { const e = await response.text(); console.error('[interview] Anthropic error:', response.status, e); return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 }); }
  const data = await response.json();
    const evaluation = data.content?.[0]?.text || '';
    const modelAnswer = question.modelAnswer;

    return NextResponse.json({ evaluation, modelAnswer });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const pathway = url.searchParams.get('pathway') || 'PM';
  const category = url.searchParams.get('category') || 'all';

  const bank = QUESTION_BANKS[pathway === 'PM' ? 'PM' : 'BA'];

  let questions: Question[] = [];
  if (category === 'behavioural') questions = bank.behavioural;
  else if (category === 'technical') questions = bank.technical;
  else if (category === 'commercial') questions = bank.commercial;
  else questions = [...bank.behavioural, ...bank.technical, ...bank.commercial];

  // Return question list without model answers (learner sees those after submission)
  return NextResponse.json({
    questions: questions.map(q => ({
      id: q.id,
      question: q.question,
      category: q.id.includes('-b') ? 'Behavioural' : q.id.includes('-t') ? 'Technical' : 'Commercial',
    }))
  });
}
