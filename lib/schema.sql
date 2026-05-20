-- ============================================================
-- UPTHRUST PORTAL — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── LEARNERS ─────────────────────────────────────────────────
create table public.learners (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text unique not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  pathway text check (pathway in ('pm', 'ba')) not null default 'pm',
  tier text check (tier in ('standard', 'premium')) not null default 'standard',
  country text default '',
  cohort text default 'cohort-1',
  enrollment_status text check (enrollment_status in ('pending', 'active', 'completed', 'withdrawn')) default 'active',
  risk_status text check (risk_status in ('green', 'amber', 'red')) default 'green',
  attendance_percent numeric default 0,
  assignment_completion_percent numeric default 0,
  portfolio_status text check (portfolio_status in ('not_started', 'drafting', 'submitted', 'reviewed', 'ready')) default 'not_started',
  capstone_status text check (capstone_status in ('not_started', 'in_progress', 'submitted', 'presented', 'approved')) default 'not_started',
  passport_status text check (passport_status in ('locked', 'pending_review', 'approved', 'withheld', 'needs_revision')) default 'locked',
  passport_eligible boolean default false,
  notes text,
  created_at timestamp with time zone default now()
);

-- ─── WEEKS (content) ──────────────────────────────────────────
create table public.weeks (
  id uuid primary key default uuid_generate_v4(),
  week_number integer unique not null,
  title text not null,
  theme text not null,
  phase text check (phase in ('foundation', 'core', 'delivery', 'capstone')) not null,
  dates text not null,
  live_session_date text not null,
  is_unlocked boolean default false,
  concept_topics jsonb default '[]',
  case_study text default '',
  lab_exercise text default '',
  pm_assignment jsonb default '{}',
  ba_assignment jsonb default '{}',
  reflection_prompt text default '',
  resources jsonb default '[]',
  created_at timestamp with time zone default now()
);

-- ─── LEARNER PROGRESS ─────────────────────────────────────────
create table public.learner_progress (
  id uuid primary key default uuid_generate_v4(),
  learner_id uuid references public.learners(id) on delete cascade,
  week_number integer not null,
  attended boolean default false,
  assignment_submitted boolean default false,
  assignment_score numeric,
  reflection_submitted boolean default false,
  updated_at timestamp with time zone default now(),
  unique(learner_id, week_number)
);

-- ─── SUBMISSIONS ──────────────────────────────────────────────
create table public.submissions (
  id uuid primary key default uuid_generate_v4(),
  learner_id uuid references public.learners(id) on delete cascade,
  week_number integer not null,
  pathway text check (pathway in ('pm', 'ba')) not null,
  assignment_title text not null,
  submission_url text not null,
  submission_note text,
  status text check (status in ('not_submitted', 'submitted', 'in_review', 'needs_revision', 'approved', 'portfolio_ready')) default 'submitted',
  score numeric,
  feedback_text text,
  feedback_at timestamp with time zone,
  deliverable_type text default '',
  submitted_at timestamp with time zone default now()
);

-- ─── PORTFOLIO ITEMS ──────────────────────────────────────────
create table public.portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  learner_id uuid references public.learners(id) on delete cascade,
  week_number integer not null,
  title text not null,
  artefact_type text not null,
  url text not null,
  status text check (status in ('draft', 'submitted', 'reviewed', 'approved')) default 'draft',
  score numeric,
  feedback text,
  created_at timestamp with time zone default now()
);

-- ─── COMMUNITY POSTS ──────────────────────────────────────────
create table public.community_posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.learners(id) on delete cascade,
  author_name text not null,
  pathway text,
  type text check (type in ('update', 'question', 'win', 'portfolio_share')) default 'update',
  content text not null,
  attachment_url text,
  likes_count integer default 0,
  replies_count integer default 0,
  created_at timestamp with time zone default now()
);

-- ─── COMMUNITY REPLIES ────────────────────────────────────────
create table public.community_replies (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.community_posts(id) on delete cascade,
  author_id uuid references public.learners(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- ─── POST LIKES ───────────────────────────────────────────────
create table public.post_likes (
  post_id uuid references public.community_posts(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  primary key (post_id, learner_id)
);

-- ─── SEED WEEKS DATA ─────────────────────────────────────────
-- Insert all 13 weeks (0-12) with full content
insert into public.weeks (week_number, title, theme, phase, dates, live_session_date, is_unlocked, concept_topics, pm_assignment, ba_assignment, reflection_prompt, lab_exercise, case_study) values

(0, 'Onboarding & Diagnostic', 'Onboarding & Diagnostic', 'foundation',
 'Saturday June 6, 2026', 'Saturday June 6, 2026', true,
 '["Program overview and expectations", "Pathway confirmation", "Tools setup", "Community introduction", "Baseline diagnostic"]'::jsonb,
 '{"title": "Baseline Diagnostic", "brief": "Write a 400–600 word response covering: who you are and your background, what product experience you already have, what capability you most want to build, what success looks like at Week 12, and your biggest concern right now.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "June 6, 2026", "rubric": [{"criterion": "Honesty and self-awareness", "points": 40}, {"criterion": "Clarity of goals", "points": 30}, {"criterion": "Quality of writing", "points": 30}]}'::jsonb,
 '{"title": "Baseline Diagnostic", "brief": "Write a 400–600 word response covering: who you are and your background, what product experience you already have, what capability you most want to build, what success looks like at Week 12, and your biggest concern right now.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "June 6, 2026", "rubric": [{"criterion": "Honesty and self-awareness", "points": 40}, {"criterion": "Clarity of goals", "points": 30}, {"criterion": "Quality of writing", "points": 30}]}'::jsonb,
 'What do you want Genesis to know about you before Week 1 begins?',
 'Introductions and cohort community setup',
 'Welcome to Cohort 1 of the Upthrust Career Capability Accelerator'
),

(1, 'Digital Product Foundations', 'Digital Product Foundations', 'foundation',
 'June 9–13, 2026', 'Saturday June 14, 2026', false,
 '["What digital products are and how they create business value", "Roles on a product team: PM, BA, Design, Engineering, QA, Data, Marketing, Ops", "How work moves through a product team", "The lifecycle of a feature from request to shipped"]'::jsonb,
 '{"title": "Product Teardown", "brief": "Choose a product (Piggyvest, Monzo, Paystack, or propose your own). Write a structured Product Teardown Report (800–1,200 words) covering: what the product does, who it is for, the business model, the core user journey, what the PM decisions were, what you would change, and what metric you would watch.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday June 20, 2026", "rubric": [{"criterion": "Clarity of analysis", "points": 30}, {"criterion": "Evidence-based reasoning", "points": 25}, {"criterion": "Specificity (not generic)", "points": 25}, {"criterion": "Structure and presentation", "points": 20}]}'::jsonb,
 '{"title": "Stakeholder Mapping", "brief": "Using your chosen product, produce a stakeholder map and RACI matrix. Show all stakeholders (internal and external), classify them on a power-interest grid, build a RACI for one specific feature or process, and write 3–5 sentences explaining which stakeholder is most likely to cause problems.", "deliverableFormat": "Miro, draw.io, or Google Slides — share link", "dueDate": "Friday June 20, 2026", "rubric": [{"criterion": "Completeness of stakeholder identification", "points": 30}, {"criterion": "Accuracy of classification", "points": 25}, {"criterion": "Quality of RACI", "points": 25}, {"criterion": "Insight quality", "points": 20}]}'::jsonb,
 'If you were explaining what a product team does to a hiring manager, what would you say?',
 'Role mapping exercise — given a product scenario, identify every role involved and every handoff',
 'Flutterwave Checkout — what decisions are visible in this product?'
),

(2, 'Problem Discovery', 'Problem Discovery', 'foundation',
 'June 16–20, 2026', 'Saturday June 21, 2026', false,
 '["The difference between symptoms and root problems", "Problem discovery techniques: user interviews, JTBD, pain point mapping", "Writing a clear problem brief", "Common mistakes in problem definition"]'::jsonb,
 '{"title": "Problem Brief", "brief": "Choose a real problem you have experienced as a user. Write a structured Problem Brief using this format: User (be specific), the job they are trying to do, the current experience step by step, where it breaks, the workaround, why this matters to the business, what success looks like, what you are not solving.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday June 27, 2026", "rubric": [{"criterion": "User specificity (not generic)", "points": 25}, {"criterion": "Problem clarity (not solution-framed)", "points": 30}, {"criterion": "Business relevance", "points": 25}, {"criterion": "Scope boundaries", "points": 20}]}'::jsonb,
 '{"title": "Elicitation Interview", "brief": "Conduct a real or simulated elicitation interview. Produce a structured notes document: context of the interview, the 10+ questions you asked, raw notes, the underlying problem in one sentence, stated request vs real need, what you would investigate further, and what you missed.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday June 27, 2026", "rubric": [{"criterion": "Question quality", "points": 30}, {"criterion": "Problem extraction", "points": 30}, {"criterion": "Stated vs real need gap", "points": 20}, {"criterion": "Self-reflection quality", "points": 20}]}'::jsonb,
 'A time someone defined a problem incorrectly — what was the real problem? What does this mean for your product work?',
 'Elicitation simulation — pairs, one stakeholder, one interviewer, discover the hidden problem',
 'How Bolt lost drivers in Lagos — what a proper problem discovery process would have surfaced'
),

(3, 'Product Strategy & Business Context', 'Product Strategy & Business Context', 'foundation',
 'June 23–27, 2026', 'Saturday June 28, 2026', false,
 '["Strategy vs roadmap vs plan", "Connecting business goals to product decisions", "MVP: what it is and is not", "RICE and MoSCoW prioritisation", "The Product Strategy Canvas"]'::jsonb,
 '{"title": "Product Strategy Canvas", "brief": "Using your Week 2 problem brief, build a full Product Strategy Canvas. Must include: North Star Metric, User Segment, Problem Being Solved, MVP Scope (include/exclude/why), Success Measures (Week 1/Month 1/Month 6), What We Will Not Build (3+ items with reasons), and Biggest Risk.", "deliverableFormat": "Google Doc or Google Slides — share link", "dueDate": "Friday July 4, 2026", "rubric": [{"criterion": "North star clarity and relevance", "points": 20}, {"criterion": "MVP scope definition", "points": 30}, {"criterion": "Success measure specificity", "points": 30}, {"criterion": "Deliberate exclusions with reasoning", "points": 20}]}'::jsonb,
 '{"title": "Business Case", "brief": "Using your Week 2 problem, write a full Business Case: executive summary, problem statement, three options considered (do nothing / quick fix / full solution), recommended solution, specific benefits, rough costs and resources, risks, and success measures.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday July 4, 2026", "rubric": [{"criterion": "Problem articulation", "points": 20}, {"criterion": "Options analysis", "points": 25}, {"criterion": "Benefits specificity", "points": 25}, {"criterion": "Risk awareness", "points": 15}, {"criterion": "Recommendation clarity", "points": 15}]}'::jsonb,
 'The hardest part of scoping an MVP is... The reason most teams build too much is...',
 'Build a Product Strategy Canvas in 45 minutes — peer review in pairs',
 'How Kuda Bank scoped its MVP — what they built, what they cut, and what they tested first'
),

(4, 'Requirements & Scope', 'Requirements & Scope', 'core',
 'June 30 – July 4, 2026', 'Saturday July 5, 2026', false,
 '["Requirements vs solutions: the critical difference", "Functional vs non-functional requirements", "User stories: the right format and common mistakes", "Acceptance criteria: what done actually means", "Scope boundaries: assumptions, constraints, out-of-scope"]'::jsonb,
 '{"title": "Full PRD", "brief": "Write a full Product Requirements Document for a new feature or improvement to your Week 2 product. Must include: background and context, problem statement, goals and non-goals, minimum 5 user stories with acceptance criteria, assumptions, constraints, out-of-scope items, open questions, success metrics.", "deliverableFormat": "Google Doc using the PRD template — share link", "dueDate": "Friday July 11, 2026", "rubric": [{"criterion": "Story clarity", "points": 30}, {"criterion": "Acceptance criteria testability", "points": 30}, {"criterion": "Scope definition", "points": 20}, {"criterion": "Open questions", "points": 20}]}'::jsonb,
 '{"title": "Full BRD", "brief": "Write a full Business Requirements Document for the same product scenario. Must include: executive summary, business objectives, scope statement, stakeholder list, functional requirements (numbered, specific), non-functional requirements, assumptions, constraints, dependencies, acceptance criteria.", "deliverableFormat": "Google Doc using the BRD template — share link", "dueDate": "Friday July 11, 2026", "rubric": [{"criterion": "Requirements specificity", "points": 35}, {"criterion": "Non-functional completeness", "points": 20}, {"criterion": "Assumptions and constraints", "points": 25}, {"criterion": "Structure", "points": 20}]}'::jsonb,
 'The hardest requirement to write was... What I learned about the difference between requirements and solutions is...',
 'Requirements clinic — bring your draft user stories, workshop them with peers',
 'What happens when requirements are wrong — a real project case study'
),

(5, 'Journey, Workflow & Process Design', 'Journey, Workflow & Process Design', 'core',
 'July 7–11, 2026', 'Saturday July 12, 2026', false,
 '["User journeys vs process maps", "As-Is mapping: documenting the current state", "To-Be mapping: designing the future state", "Swimlane diagrams for cross-functional flows", "Edge cases: the scenarios most documents miss"]'::jsonb,
 '{"title": "User Journey Map", "brief": "Map the end-to-end user journey for the feature in your Week 4 PRD. Deliverable (in Miro or FigJam): user persona header, journey stages, touchpoints, user emotion at each stage, the riskiest moment, and one insight about what you would change in your PRD based on this map.", "deliverableFormat": "Miro or FigJam — share public link", "dueDate": "Friday July 18, 2026", "rubric": [{"criterion": "Journey completeness", "points": 30}, {"criterion": "Emotion accuracy", "points": 20}, {"criterion": "Risk identification", "points": 25}, {"criterion": "Insight quality", "points": 25}]}'::jsonb,
 '{"title": "As-Is / To-Be Process Maps", "brief": "Map the current-state and future-state process for your Week 4 scenario. Deliverable: As-Is process map (every step, every decision, every handoff), To-Be process map, gap analysis table (what changes/removed/added), at least 3 edge cases, risk note for the To-Be process.", "deliverableFormat": "Miro, draw.io, or Lucidchart — share link", "dueDate": "Friday July 18, 2026", "rubric": [{"criterion": "As-Is accuracy", "points": 30}, {"criterion": "To-Be logic", "points": 30}, {"criterion": "Gap analysis", "points": 20}, {"criterion": "Edge case coverage", "points": 20}]}'::jsonb,
 'What I discovered about the current process that I did not expect...',
 'Live process mapping — map the Upthrust enrollment flow as a team',
 'Why a fintech onboarding process failed users even though the engineering was perfect'
),

(6, 'UX & Product Design Foundations', 'UX & Product Design Foundations', 'core',
 'July 14–18, 2026', 'Saturday July 19, 2026', false,
 '["What designers actually do vs what PMs/BAs think they do", "Personas: building from evidence", "Information architecture", "Accessibility basics every PM and BA must know", "Design handoff: what PM/BA needs to have ready for design to start"]'::jsonb,
 '{"title": "Design Brief", "brief": "Write a design brief for your Week 4 PRD feature — the document you would hand to a designer. Must include: 2 user personas, key user flows, accessibility requirements, open design questions (minimum 5), what success looks like from a UX perspective.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday July 25, 2026", "rubric": [{"criterion": "Persona specificity", "points": 30}, {"criterion": "User flow clarity", "points": 30}, {"criterion": "Accessibility awareness", "points": 20}, {"criterion": "Open question quality", "points": 20}]}'::jsonb,
 '{"title": "User Journey vs Process Gap Analysis", "brief": "Layer your Week 5 process map onto a user journey to find where the internal process fails the user. Identify at least 3 gaps between the process and the user experience, and provide a recommendation for each gap.", "deliverableFormat": "Miro or Google Slides — share link", "dueDate": "Friday July 25, 2026", "rubric": [{"criterion": "Gap identification accuracy", "points": 40}, {"criterion": "Connection between process and user experience", "points": 35}, {"criterion": "Recommendation quality", "points": 25}]}'::jsonb,
 'What I learned about the relationship between process design and user experience...',
 'Design teardown — analyse a live product for accessibility and information architecture failures',
 'What a BA or PM needs to know about design — and what to leave to the designer'
),

(7, 'Prototyping & Design Systems', 'Prototyping & Design Systems', 'core',
 'July 21–25, 2026', 'Saturday July 26, 2026', false,
 '["What prototypes are and are not", "Navigating a Figma design file as a non-designer", "Design system thinking: components, tokens, consistency", "What to check in a design review (PM/BA checklist)", "How to write design feedback that is actionable"]'::jsonb,
 '{"title": "Figma Prototype Review", "brief": "Genesis will share a Figma prototype. Review it as the PM. Produce Design Review Notes covering: screen-by-screen assessment, requirements check against your Week 4 PRD acceptance criteria, edge cases missed in the design, at least 5 open questions for the designer, and an approval recommendation.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 1, 2026", "rubric": [{"criterion": "Requirements coverage check", "points": 35}, {"criterion": "Edge case identification", "points": 30}, {"criterion": "Feedback specificity", "points": 20}, {"criterion": "Recommendation", "points": 15}]}'::jsonb,
 '{"title": "BA Design Review", "brief": "Review the same Figma prototype from a BA perspective. Produce: a requirements traceability map (each screen mapped to a BRD requirement), missing requirements (what is in your BRD that does not appear in the design), undocumented assumptions, and at least 5 specific requirement-backed comments for the designer.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 1, 2026", "rubric": [{"criterion": "Traceability coverage", "points": 35}, {"criterion": "Gap identification", "points": 35}, {"criterion": "Feedback quality", "points": 30}]}'::jsonb,
 'How I would explain the difference between PM feedback and BA feedback on a design...',
 'Live Figma review — review a real prototype as a group and practice giving feedback',
 'What happens when PMs give bad design feedback — and how to give good feedback instead'
),

(8, 'Agile Delivery & Backlog', 'Agile Delivery & Backlog', 'delivery',
 'July 28 – August 1, 2026', 'Saturday August 2, 2026', false,
 '["Agile principles in plain language", "Epics, stories, tasks: the hierarchy", "Definition of Ready and Definition of Done", "Sprint planning: how to run it", "Backlog grooming: keeping work prioritised", "How BA and PM roles interact in an agile team"]'::jsonb,
 '{"title": "Sprint Backlog", "brief": "Build a sprint backlog from your Week 4 PRD. Deliver: minimum 8 user stories (each with title, description, acceptance criteria, story points, priority), a Definition of Ready checklist applied to each story, a sprint goal statement, and a prioritisation rationale explaining what you deprioritised and why.", "deliverableFormat": "Notion table, Trello board, or Google Sheets — share link", "dueDate": "Friday August 8, 2026", "rubric": [{"criterion": "Story quality", "points": 35}, {"criterion": "Acceptance criteria", "points": 30}, {"criterion": "Sprint scope reasoning", "points": 20}, {"criterion": "DoR application", "points": 15}]}'::jsonb,
 '{"title": "User Stories + Acceptance Criteria Library", "brief": "Write a complete user story library from your Week 4 BRD. Deliver: minimum 10 user stories in correct format, acceptance criteria for each (minimum 3 per story), an INVEST check on each story, and a dependency map showing which stories depend on which.", "deliverableFormat": "Google Doc or Notion — share link", "dueDate": "Friday August 8, 2026", "rubric": [{"criterion": "Story completeness", "points": 30}, {"criterion": "Acceptance criteria quality", "points": 35}, {"criterion": "INVEST compliance", "points": 20}, {"criterion": "Dependencies", "points": 15}]}'::jsonb,
 'What I now understand about agile delivery that I did not before this week...',
 'Mock sprint planning — run a sprint planning session against your own backlog',
 'What actually happens in a real sprint planning and why most teams do it wrong'
),

(9, 'Stakeholder Management', 'Stakeholder Management', 'delivery',
 'August 4–8, 2026', 'Saturday August 9, 2026', false,
 '["Types of stakeholders and how each behaves", "The vague executive request: how to handle it", "Conflicting priorities: facilitating the conversation", "Scope creep: how to push back professionally", "Trade-off escalation: when to decide vs when to escalate", "Facilitation techniques for product workshops"]'::jsonb,
 '{"title": "Stakeholder Simulation Responses", "brief": "Genesis will provide 3 stakeholder scenario cards. For each: write the response you would give in the meeting (the actual words), write the follow-up email you would send after, and write the trade-off recommendation you would escalate to the CPO. Scenarios: vague exec request, two VPs wanting opposite things, engineering saying the PRD is unclear mid-sprint.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 15, 2026", "rubric": [{"criterion": "Response quality", "points": 35}, {"criterion": "Follow-up clarity", "points": 30}, {"criterion": "Escalation framing", "points": 35}]}'::jsonb,
 '{"title": "Stakeholder Workshop Pack", "brief": "Design and document a requirements workshop. Deliver: 90-minute agenda, pre-read document for attendees, facilitation guide (what you say, what you ask, how you manage conflict), output capture template, and post-workshop summary template.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 15, 2026", "rubric": [{"criterion": "Agenda structure", "points": 25}, {"criterion": "Pre-read quality", "points": 20}, {"criterion": "Facilitation guide depth", "points": 35}, {"criterion": "Output completeness", "points": 20}]}'::jsonb,
 'A stakeholder conversation I have had (or observed) that did not go well — what would I do differently now?',
 'Stakeholder simulation — live role play with Genesis playing difficult stakeholders',
 'A real product team conflict: two executives, opposite priorities, one PM in the middle'
),

(10, 'Testing, UAT & Launch Readiness', 'Testing, UAT & Launch Readiness', 'delivery',
 'August 11–15, 2026', 'Saturday August 16, 2026', false,
 '["UAT vs QA: what is the difference", "Writing UAT test scenarios: format and standards", "Edge cases in UAT: the scenarios most teams miss", "Release checklist: what must be ready before go-live", "Rollout strategy: big bang vs phased vs feature flags", "Kill criteria: how to decide to roll back"]'::jsonb,
 '{"title": "Launch Plan", "brief": "Write a complete launch plan for your product feature. Must include: UAT scope, go-live checklist (minimum 15 items), rollout strategy with rationale, support readiness brief, kill criteria, and a communication plan (who gets told what and when).", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 22, 2026", "rubric": [{"criterion": "UAT scope", "points": 25}, {"criterion": "Checklist completeness", "points": 25}, {"criterion": "Rollout reasoning", "points": 20}, {"criterion": "Kill criteria", "points": 15}, {"criterion": "Communication plan", "points": 15}]}'::jsonb,
 '{"title": "Full UAT Pack", "brief": "Write a complete UAT pack for your product feature. Must include: UAT test plan (scope, approach, entry/exit criteria), minimum 15 test scenarios (happy path + edge cases + error states), test data requirements, UAT sign-off template, defect log template, and at least 3 edge cases that would likely be missed without this document.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 22, 2026", "rubric": [{"criterion": "Test scenario quality", "points": 35}, {"criterion": "Edge case coverage", "points": 30}, {"criterion": "Sign-off completeness", "points": 20}, {"criterion": "Defect log", "points": 15}]}'::jsonb,
 'What would have happened if this product launched without a UAT pack?',
 'UAT scenario writing clinic — practise writing edge cases as a group',
 'A real product launch that went wrong — and the UAT gaps that caused it'
),

(11, 'Metrics & Continuous Improvement', 'Metrics & Continuous Improvement', 'delivery',
 'August 18–22, 2026', 'Saturday August 23, 2026', false,
 '["Why most products measure the wrong things", "Activation, retention, engagement, revenue: the core metrics", "Funnels: where do users drop off and why", "Leading vs lagging indicators", "Dashboard thinking: what should product and business see", "Feedback loops: from data to decision to action"]'::jsonb,
 '{"title": "Metrics Plan", "brief": "Write a complete metrics plan for your product feature. Must include: North Star Metric, Week 1 metrics, Month 1 metrics, Month 6 metrics, dashboard spec (what the PM sees every Monday), kill criteria, and an analytics event brief (what events need instrumenting before launch).", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 29, 2026", "rubric": [{"criterion": "Metric specificity", "points": 30}, {"criterion": "Time-period progression", "points": 25}, {"criterion": "Kill criteria", "points": 20}, {"criterion": "Event instrumentation", "points": 25}]}'::jsonb,
 '{"title": "Post-Launch Reporting Framework", "brief": "Design the reporting structure for your feature after launch. Must include: KPIs with owner/source/frequency, weekly reporting template for stakeholders, exception reporting (what triggers escalation), continuous improvement loop (how feedback gets back into requirements), and a retrospective template.", "deliverableFormat": "Google Doc — share link with comment access", "dueDate": "Friday August 29, 2026", "rubric": [{"criterion": "KPI quality", "points": 30}, {"criterion": "Reporting structure", "points": 25}, {"criterion": "Exception logic", "points": 20}, {"criterion": "Retro template", "points": 25}]}'::jsonb,
 'How I would explain what success looks like for my product to a non-technical stakeholder...',
 'Metrics clinic — review your Week 3 North Star metric against your Week 11 framework',
 'A product that was hitting its metrics but still failing — what the wrong metrics look like'
),

(12, 'Capstone Defence & Portfolio Review', 'Capstone Defence', 'capstone',
 'August 25–29, 2026', 'Saturday August 30, 2026 — DEMO DAY', false,
 '["Capstone presentation preparation", "Portfolio review and final polish", "Capability Passport assessment criteria", "Demo Day format and expectations", "Post-program next steps"]'::jsonb,
 '{"title": "Capstone Presentation + Full Portfolio", "brief": "Present your full capstone project. Your 20-minute presentation must cover: the problem you solved, your discovery process, your solution definition and scoping decisions, your key artefacts walkthrough, your process decisions and trade-offs, your metrics plan, and your complete portfolio. Submit your full portfolio folder to Genesis by Friday August 29.", "deliverableFormat": "Slides (any format) + Google Drive folder with all artefacts", "dueDate": "Friday August 29, 2026", "rubric": [{"criterion": "Problem definition clarity", "points": 15}, {"criterion": "Requirements quality", "points": 20}, {"criterion": "Process and journey work", "points": 15}, {"criterion": "Stakeholder thinking", "points": 15}, {"criterion": "Delivery readiness artefact", "points": 15}, {"criterion": "Metrics thinking", "points": 10}, {"criterion": "Communication and defence", "points": 10}]}'::jsonb,
 '{"title": "Capstone Presentation + Full Portfolio", "brief": "Present your full capstone project. Your 20-minute presentation must cover: the problem you solved, your discovery and elicitation process, your requirements documentation, your process maps, your UAT pack, your stakeholder thinking, and your complete portfolio. Submit your full portfolio folder to Genesis by Friday August 29.", "deliverableFormat": "Slides (any format) + Google Drive folder with all artefacts", "dueDate": "Friday August 29, 2026", "rubric": [{"criterion": "Problem definition clarity", "points": 15}, {"criterion": "Requirements quality", "points": 20}, {"criterion": "Process and journey work", "points": 15}, {"criterion": "Stakeholder thinking", "points": 15}, {"criterion": "UAT and delivery readiness", "points": 15}, {"criterion": "Reporting and improvement thinking", "points": 10}, {"criterion": "Communication and defence", "points": 10}]}'::jsonb,
 'What I am most proud of producing over 12 weeks. What I would do differently. What I am ready for now.',
 'Mock presentations and peer feedback — practice your capstone with the cohort',
 'You are the case study. This week you present everything you have built.'
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.learners enable row level security;
alter table public.weeks enable row level security;
alter table public.learner_progress enable row level security;
alter table public.submissions enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.post_likes enable row level security;

-- Weeks are readable by all authenticated users
create policy "Weeks are viewable by authenticated users"
  on public.weeks for select
  using (true);

-- Learners can only read/write their own data
-- (Service role bypasses RLS for admin operations)
create policy "Learners can read their own record"
  on public.learners for select
  using (auth.uid()::text = clerk_user_id);

create policy "Learners can update their own record"
  on public.learners for update
  using (auth.uid()::text = clerk_user_id);

create policy "Learners can read their own progress"
  on public.learner_progress for select
  using (learner_id in (select id from public.learners where clerk_user_id = auth.uid()::text));

create policy "Learners can read their own submissions"
  on public.submissions for select
  using (learner_id in (select id from public.learners where clerk_user_id = auth.uid()::text));

create policy "Learners can insert their own submissions"
  on public.submissions for insert
  with check (learner_id in (select id from public.learners where clerk_user_id = auth.uid()::text));

create policy "Learners can read their own portfolio"
  on public.portfolio_items for select
  using (learner_id in (select id from public.learners where clerk_user_id = auth.uid()::text));

-- Community posts visible to all cohort members
create policy "Community posts are viewable by authenticated users"
  on public.community_posts for select
  using (true);

create policy "Learners can create community posts"
  on public.community_posts for insert
  with check (author_id in (select id from public.learners where clerk_user_id = auth.uid()::text));

create policy "Community replies are viewable by authenticated users"
  on public.community_replies for select
  using (true);

create policy "Learners can create replies"
  on public.community_replies for insert
  with check (author_id in (select id from public.learners where clerk_user_id = auth.uid()::text));
