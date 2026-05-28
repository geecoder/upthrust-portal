-- ============================================================
-- UPTHRUST PORTAL — WEEK CONTENT SEED
-- Run in Supabase SQL Editor
-- Seeds all 13 weeks (W0–W12) with titles, phases, dates,
-- outcomes, and assignment briefs for PM and BA pathways.
-- ============================================================

-- First ensure weeks table exists and has required columns
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS why_it_matters TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS pre_work TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS outcomes TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS zoom_link TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS session_slides_url TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS ai_practice_type TEXT;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS reflection_prompt TEXT;

-- Upsert all 13 weeks
INSERT INTO weeks (
  week_number, title, phase, session_date,
  why_it_matters, pre_work, outcomes,
  pm_assignment_title, pm_assignment_brief, pm_deliverable, pm_due_date,
  ba_assignment_title, ba_assignment_brief, ba_deliverable, ba_due_date,
  is_published
) VALUES

-- Week 0: Orientation
(0, 'Orientation & Setup', 'Foundation',
'2026-06-06',
'Week 0 is your foundation. How you start shapes how you finish. Learners who complete all Week 0 tasks perform better across every subsequent week.',
'Join the cohort WhatsApp group. Set up Google Drive, Miro, and Zoom. Read the Week 0 brief in the portal.',
'Understand the program structure and what is expected,Complete your learner profile and onboarding,Set up all required tools and confirm they work,Introduce yourself to the cohort community',
'Pre-Program Reflections', 'Write a 1-page reflection: Where are you now in your career? What does success in this program look like for you in 3 months? What are you most anxious about?', '1-page written reflection (Google Doc)', '2026-06-10',
'Pre-Program Reflections', 'Write a 1-page reflection: Where are you now in your career? What does a successful BA career look like for you? What gaps are you hoping this program fills?', '1-page written reflection (Google Doc)', '2026-06-10',
true),

-- Week 1: Discovery
(1, 'The Role of PM/BA — What Does Great Look Like?', 'Foundation',
'2026-06-14',
'Most people applying for PM and BA roles have the wrong mental model of what the job actually is. This week resets that. You cannot be good at something you do not understand.',
'Read: "What Does a PM Actually Do?" (Lenny''s Newsletter). Watch: "A Day in the Life of a BA" (YouTube — IIBA). Think of a product you use every day.',
'Articulate what PMs and BAs actually do in a real product team,Distinguish between the role and the myths,Conduct a structured product teardown using a real framework,Identify at least 3 specific PM or BA decisions visible in an existing product',
'Product Teardown Report', 'Choose one of the 8 capstone briefs on the Upthrust site OR a product you use regularly. Analyse it using the Product Teardown framework: (1) Who is the user? (2) What job are they doing? (3) What decisions can you see the PM made? (4) What would you do differently and why? Submit as a Google Doc.', 'Structured Product Teardown Report', '2026-06-18',
'Stakeholder Map & RACI Matrix', 'Take the same product you analysed in the session. Map all stakeholders involved in building it: internal teams, external partners, regulators, customers. Build a RACI matrix for one key product decision. Submit as a Google Sheet or Miro board.', 'Stakeholder Map + RACI Matrix', '2026-06-18',
true),

-- Week 2: Problem Framing
(2, 'Problem Framing — From Vague Requests to Clear Briefs', 'Foundation',
'2026-06-21',
'The most expensive mistake in product work is solving the wrong problem. This week teaches you to stop, frame, and validate before jumping to solutions.',
'Read Chapter 1 of The Mom Test (free PDF). Bring one real problem from your workplace or community that you think technology could solve.',
'Write a problem statement that passes the Mom Test,Distinguish between symptoms and root causes,Frame a problem that is specific enough to build something from,Explain why a problem brief exists and what happens without one',
'Problem Brief', 'Using the problem framing template, write a complete problem brief for a real problem. Include: specific user, current situation, pain/friction, business context, and what good looks like. Do NOT propose a solution. 1-2 pages. Submit as Google Doc.', 'Structured Problem Brief', '2026-06-25',
'Elicitation Interview Notes', 'Conduct a 20-minute structured elicitation interview with someone who experiences the problem you identified in Week 1. Use the elicitation interview framework from the session. Document: what you asked, what they said, what surprised you, what you still don''t know. Submit structured notes.', 'Elicitation Interview Notes', '2026-06-25',
true),

-- Week 3: Strategy
(3, 'Product Strategy — From Problem to Direction', 'Foundation',
'2026-06-28',
'Strategy is the difference between a feature factory and a product that matters. This week teaches you to think above the sprint — about why, not just what.',
'Read: "Good Strategy / Bad Strategy" (summary). Review 3 mission statements from tech companies you admire. What makes them useful vs vague?',
'Define a product vision in one clear sentence,Identify strategic bets vs tactical features,Build a one-page product or solution strategy,Connect strategy to measurable business outcomes',
'Product Strategy Canvas', 'Using the strategy canvas template, define a product strategy for the problem you framed in Week 2. Include: Vision (1 sentence), Bets (2-3 strategic choices), Success metrics, What you are NOT doing. 1 page maximum. Submit as Google Doc or Miro.', 'Product Strategy Canvas', '2026-07-02',
'Business Case', 'Write a one-page business case for the solution direction you identified in Week 2. Structure: Business problem, Proposed solution (high level), Expected benefit (quantified where possible), Estimated effort/cost (ballpark), Recommendation. Submit as Google Doc.', 'One-page Business Case', '2026-07-02',
true),

-- Week 4: Requirements
(4, 'Requirements — Writing What Engineering Can Build', 'Core Skills',
'2026-07-05',
'Bad requirements are the number one cause of rework in product teams. This week teaches you to write requirements that are specific, testable, and actually useful.',
'Review a PRD or BRD template from the Resources section. Find a feature in an app you use that you think was poorly defined — what requirements might have been missing?',
'Write a functional requirement that is testable,Distinguish between functional and non-functional requirements,Define acceptance criteria that a QA engineer can test,Write a PRD (PM) or BRD (BA) that an engineer could build from',
'Full PRD', 'Write a Product Requirements Document for the product direction from Week 3. Use the PRD template. Include: Background, User stories (minimum 5), Acceptance criteria for each story, Non-functional requirements, Out of scope. Submit as Google Doc.', 'Complete PRD', '2026-07-09',
'Full BRD', 'Write a Business Requirements Document for the solution from Week 3. Use the BRD template. Include: Functional requirements (numbered), Non-functional requirements, Assumptions and constraints, Stakeholder sign-off section, Open questions. Submit as Google Doc.', 'Complete BRD', '2026-07-09',
true),

-- Week 5: User Research
(5, 'User Research — Understanding What People Actually Do', 'Core Skills',
'2026-07-12',
'Features fail because teams build what users say they want, not what they actually do. This week teaches you to observe, map, and document real behaviour.',
'Watch the IDEO shopping cart video (YouTube). Map how you did something routine this week — ordering food, getting somewhere, paying a bill. Notice the friction.',
'Conduct structured user research using at least one qualitative method,Build a journey map or process map from real data,Identify moments of friction and opportunity,Document findings in a format that can inform requirements',
'User Journey Map', 'Map the end-to-end journey of a user trying to solve the problem from your problem brief. Use the journey map template. Include at least 6 stages, emotions at each stage, pain points, and 3 opportunity areas. Submit as Miro board.', 'User Journey Map', '2026-07-16',
'As-Is / To-Be Process Maps', 'Map the current process (As-Is) for the business scenario from your BRD. Then map the improved future process (To-Be) if your solution is implemented. Use Miro or draw.io. Label every step, decision point, and handoff. Submit as Miro or draw.io export.', 'As-Is and To-Be Process Maps', '2026-07-16',
true),

-- Week 6: Design Collaboration
(6, 'Working With Design — From Brief to Prototype', 'Core Skills',
'2026-07-19',
'PMs and BAs do not design products — but they define what gets designed. This week teaches you to brief designers, give useful feedback, and protect the user experience.',
'Watch: "How to give design feedback" (Google Design Sprint YouTube). Review the Figma file shared in the portal. Notice what questions you have as a PM/BA looking at a design for the first time.',
'Write a clear design brief that a designer can act on,Review a design and give specific structured feedback,Identify when a design solves the problem and when it does not,Document design decisions in a way that prevents regression',
'Design Brief', 'Write a design brief for your product (1 page). Specify: user, job to be done, constraints, success criteria, what is and is not in scope for this design sprint. Submit as Google Doc.', 'Design Brief', '2026-07-23',
'User Journey vs Process Gap Analysis', 'Compare your Week 5 journey map (user perspective) against your process map (business perspective). Identify 3 specific gaps where the business process does not serve the user journey. Document each gap with: what the user needs, what the business currently does, the impact of the gap. Submit as Google Doc.', 'Gap Analysis Document', '2026-07-23',
true),

-- Week 7: Design Review
(7, 'Design Review, Iteration & Technical Constraints', 'Core Skills',
'2026-07-26',
'Most PMs and BAs are not trained to review designs. They either approve too easily or block progress. This week teaches you to make design decisions fast and well.',
'Review the prototype shared in the portal. Write down your first 10 questions as a PM/BA. Bring those questions to the session.',
'Conduct a structured design review using a rubric,Identify technical constraints that affect design decisions,Distinguish between UX problems and preference opinions,Write design review notes that a developer and designer can act on',
'Figma Prototype Review', 'Review the Figma prototype shared this week using the design review template. Score it against 5 criteria (usability, accessibility, feasibility, alignment with brief, completeness). Write structured feedback with specific change requests. Submit as Google Doc.', 'Design Review Document', '2026-07-30',
'BA Design Review Notes', 'Review the same Figma prototype from a BA perspective. For each screen, identify: Does this screen satisfy the requirements in your BRD? List any missing states, error flows, or edge cases not covered. Submit as Google Doc.', 'BA Design Review Notes', '2026-07-30',
true),

-- Week 8: Delivery
(8, 'Delivery & Agile — Working in Sprints', 'Delivery',
'2026-08-02',
'Most PMs and BAs learn about Agile in theory and struggle with it in practice. This week is the practical version — how sprints actually work in a real product team.',
'Watch: "How to run a sprint planning meeting" (Atlassian YouTube). Sign up for Trello or Jira (free). Create a board with 3 columns: Backlog, In Progress, Done.',
'Run a sprint planning meeting from a PRD or BRD,Prioritise a backlog using a real framework (RICE or MoSCoW),Write sprint stories that an engineer can pick up immediately,Estimate effort as a PM/BA working with technical stakeholders',
'Sprint Backlog', 'Using the requirements from your PRD, build a sprint backlog for a 2-week sprint. Include: 8-12 user stories in priority order, acceptance criteria for each, RICE score, and sprint goal. Use Trello or a Google Sheet. Submit a link.', 'Sprint Backlog (Trello or Sheet)', '2026-08-06',
'User Stories + Acceptance Criteria Library', 'Convert 10 requirements from your BRD into well-formed user stories (As a... I want to... So that...) with INVEST-compliant acceptance criteria. For each story, add: priority (MoSCoW), effort estimate (S/M/L), and dependencies. Submit as Google Sheet.', 'User Stories Library', '2026-08-06',
true),

-- Week 9: Stakeholders
(9, 'Stakeholder Management — Influence Without Authority', 'Delivery',
'2026-08-09',
'The skills in this week separate average PMs and BAs from great ones. You will face every type of difficult stakeholder in your career. Practise here first.',
'Complete at least one Stakeholder Simulation in the AI Practice Lab before this session. Note what you found hardest. Bring that to the session.',
'Manage a scope creep conversation and protect the sprint,Handle a resistant technical stakeholder using active listening and evidence,Run a structured requirements review meeting,Document outcomes of a stakeholder conversation in a way that prevents disputes',
'Stakeholder Simulation Responses', 'Complete all 5 stakeholder simulations in the AI Practice Lab. For each one: paste your full conversation, include the AI debrief, and write 3 sentences on what you will do differently next time. Submit as Google Doc.', 'Stakeholder Simulation Portfolio', '2026-08-13',
'Stakeholder Workshop Pack', 'Design a stakeholder requirements workshop for the solution from your BRD. Include: agenda (60 minutes), list of exercises, materials needed, facilitation notes, and how you will document outputs. Submit as Google Doc.', 'Stakeholder Workshop Pack', '2026-08-13',
true),

-- Week 10: Launch
(10, 'Launch Planning — Getting to Production', 'Delivery',
'2026-08-16',
'A product is not done when engineering ships it. Launch is a PM/BA discipline. This week teaches you what happens between "done in dev" and "live for users".',
'Read: "How to Write a Launch Plan" (Intercom blog). Think of a feature you use that clearly had a poor launch — what went wrong?',
'Write a launch plan that covers all non-engineering dependencies,Plan a UAT cycle that catches real bugs before production,Define a go/no-go criteria and rollback plan,Measure the success of a launch using pre-defined metrics',
'Launch Plan', 'Write a launch plan for your product. Include: launch goals, user segments, go-to-market summary, success metrics (Day 1, Week 1, Month 1), UAT sign-off plan, rollback criteria, and post-launch owner. 2-3 pages. Submit as Google Doc.', 'Launch Plan', '2026-08-20',
'Full UAT Pack', 'Write a complete UAT pack for your solution. Include: test scenarios (at least 10), expected vs actual results columns, pass/fail criteria, edge cases (at least 3), and a sign-off checklist. Submit as Google Sheet or Doc.', 'UAT Pack', '2026-08-20',
true),

-- Week 11: Metrics
(11, 'Metrics & Post-Launch — Measuring What Matters', 'Delivery',
'2026-08-23',
'Building a product is easy. Knowing whether it worked is hard. This week teaches you to define success before you ship and measure it after.',
'Review the metrics plan template in Resources. Think about: what would you measure for your capstone product at Day 1, Week 1, Month 1?',
'Define a North Star metric and explain why it matters,Build a metrics framework that distinguishes vanity from actionable metrics,Design a post-launch review process,Write a metrics plan that connects features to business outcomes',
'Metrics Plan', 'Write a metrics plan for your product. Include: North Star metric (with rationale), 3-5 supporting metrics, measurement method for each, baseline and target values, and a post-launch review plan. Connect each metric to a user or business outcome. Submit as Google Doc.', 'Metrics Plan', '2026-08-27',
'Post-Launch Reporting Framework', 'Design a post-launch reporting framework for your solution. Include: KPIs (at least 5), data sources, reporting frequency, stakeholder audience for each report, and what actions each metric should trigger. Submit as Google Sheet or Doc.', 'Reporting Framework', '2026-08-27',
true),

-- Week 12: Capstone
(12, 'Capstone Presentations — Demo Day', 'Capstone',
'2026-08-30',
'This is what everything has been building toward. You are not just presenting a project — you are demonstrating that you can think, communicate, and produce work to a professional standard.',
'Complete all portfolio artefacts. Run through your presentation at least twice. Prepare answers to: Why this problem? What would you do differently? What does success look like at 6 months?',
'Present a complete product or analysis case study to a live audience,Defend your decisions under questioning from Genesis and peers,Demonstrate how your work from across the program connects into a coherent whole,Walk away with a professional portfolio artefact ready to show in interviews',
'Capstone Project + Portfolio', 'Present your full capstone: the product or solution you developed throughout the program. Presentation: 10 minutes + 5 minutes Q&A. Deliverables: case study document, all portfolio artefacts linked, demonstration or prototype if applicable. Submit everything via Google Drive before Demo Day.', 'Capstone Presentation + Case Study', '2026-08-28',
'Capstone Project + Portfolio', 'Present your BA capstone: the full solution analysis you developed throughout the program. Presentation: 10 minutes + 5 minutes Q&A. Deliverables: case study document, all portfolio artefacts linked, stakeholder map, BRD, process maps, UAT pack, and reporting framework. Submit via Google Drive before Demo Day.', 'Capstone Presentation + Case Study', '2026-08-28',
true)

ON CONFLICT (week_number) DO UPDATE SET
  title = EXCLUDED.title,
  phase = EXCLUDED.phase,
  session_date = EXCLUDED.session_date,
  why_it_matters = EXCLUDED.why_it_matters,
  pre_work = EXCLUDED.pre_work,
  outcomes = EXCLUDED.outcomes,
  pm_assignment_title = EXCLUDED.pm_assignment_title,
  pm_assignment_brief = EXCLUDED.pm_assignment_brief,
  pm_deliverable = EXCLUDED.pm_deliverable,
  pm_due_date = EXCLUDED.pm_due_date,
  ba_assignment_title = EXCLUDED.ba_assignment_title,
  ba_assignment_brief = EXCLUDED.ba_assignment_brief,
  ba_deliverable = EXCLUDED.ba_deliverable,
  ba_due_date = EXCLUDED.ba_due_date,
  is_published = EXCLUDED.is_published;

-- Set up the reflection prompts
UPDATE weeks SET reflection_prompt = 'What was the most surprising thing you learned this week? What changed in how you think about the role?' WHERE week_number = 1;
UPDATE weeks SET reflection_prompt = 'Describe a time recently when you (or someone you know) solved a symptom instead of a root cause. How would you reframe the problem now?' WHERE week_number = 2;
UPDATE weeks SET reflection_prompt = 'What is the most important strategic trade-off in your product/case study? What are you choosing NOT to do, and why?' WHERE week_number = 3;
UPDATE weeks SET reflection_prompt = 'Review your PRD/BRD. Find the one requirement that is most likely to cause a debate with engineering. How would you defend it?' WHERE week_number = 4;
UPDATE weeks SET reflection_prompt = 'What did your user research reveal that surprised you most? How did it change what you thought you already knew?' WHERE week_number = 5;
UPDATE weeks SET reflection_prompt = 'Review the design brief you wrote. If you were a designer receiving this brief, what would your first 3 questions be?' WHERE week_number = 6;
UPDATE weeks SET reflection_prompt = 'What is the hardest trade-off you had to make in your design review? How did you decide?' WHERE week_number = 7;
UPDATE weeks SET reflection_prompt = 'After sprint planning, what is the most underestimated story in your backlog? What makes it harder than it looks?' WHERE week_number = 8;
UPDATE weeks SET reflection_prompt = 'Which stakeholder simulation challenged you most, and why? What specific phrase or tactic would you use differently next time?' WHERE week_number = 9;
UPDATE weeks SET reflection_prompt = 'What is the most important go/no-go decision in your launch plan? Who needs to sign off on it, and what would make you delay?' WHERE week_number = 10;
UPDATE weeks SET reflection_prompt = 'If your product launched tomorrow and one of your metrics was not moving, what would be your first hypothesis about why?' WHERE week_number = 11;
UPDATE weeks SET reflection_prompt = 'Looking back at Week 0 — what did you think the role of PM/BA was then, and what do you know now that you did not know then?' WHERE week_number = 12;

