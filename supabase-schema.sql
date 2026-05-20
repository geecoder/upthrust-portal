-- UPTHRUST PORTAL — SUPABASE SCHEMA
-- Run in: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS learners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  country TEXT,
  phone TEXT,
  pathway TEXT CHECK (pathway IN ('PM','BA','Design','Undecided')) DEFAULT 'Undecided',
  tier TEXT CHECK (tier IN ('Standard','Premium','VIP','Corporate')) DEFAULT 'Standard',
  cohort TEXT DEFAULT 'Cohort 1',
  enrollment_status TEXT CHECK (enrollment_status IN ('Pending','Active','Completed','Withdrawn')) DEFAULT 'Pending',
  attendance_pct NUMERIC(5,2) DEFAULT 0,
  assignment_completion_pct NUMERIC(5,2) DEFAULT 0,
  avg_score NUMERIC(5,2) DEFAULT 0,
  risk_status TEXT CHECK (risk_status IN ('Green','Amber','Red')) DEFAULT 'Green',
  passport_eligibility TEXT CHECK (passport_eligibility IN ('Not Eligible','Pending Review','Approved','Withheld','Needs Revision')) DEFAULT 'Not Eligible',
  passport_issued BOOLEAN DEFAULT FALSE,
  passport_issued_at TIMESTAMPTZ,
  portfolio_status TEXT CHECK (portfolio_status IN ('Not Started','Drafting','Submitted','Reviewed','Ready')) DEFAULT 'Not Started',
  capstone_status TEXT CHECK (capstone_status IN ('Not Started','In Progress','Submitted','Presented','Approved')) DEFAULT 'Not Started',
  notes TEXT,
  linkedin_url TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_number INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  phase TEXT CHECK (phase IN ('Foundation','Core Skills','Delivery','Capstone')),
  start_date DATE,
  end_date DATE,
  session_date DATE,
  is_published BOOLEAN DEFAULT FALSE,
  learning_goals TEXT,
  concept_topics TEXT,
  case_study TEXT,
  lab_exercise TEXT,
  session_notes TEXT,
  recording_url TEXT,
  pm_assignment_title TEXT,
  pm_assignment_brief TEXT,
  pm_deliverable TEXT,
  pm_rubric TEXT,
  pm_due_date DATE,
  ba_assignment_title TEXT,
  ba_assignment_brief TEXT,
  ba_deliverable TEXT,
  ba_rubric TEXT,
  ba_due_date DATE,
  reflection_prompt TEXT,
  resources TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  pathway TEXT CHECK (pathway IN ('PM','BA')) NOT NULL,
  submission_url TEXT,
  submission_notes TEXT,
  submitted_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('Not Started','In Progress','Submitted','In Review','Needs Revision','Approved','Portfolio Ready')) DEFAULT 'Not Started',
  score NUMERIC(5,2),
  feedback TEXT,
  feedback_by TEXT,
  feedback_at TIMESTAMPTZ,
  is_portfolio_ready BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(learner_id, week_number, pathway)
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  attended BOOLEAN DEFAULT FALSE,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(learner_id, week_number)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  category TEXT CHECK (category IN ('Question','Win','Portfolio Review','General')) DEFAULT 'General',
  content TEXT NOT NULL,
  pathway_tag TEXT CHECK (pathway_tag IN ('PM','BA','Both')),
  week_tag INTEGER,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_from_genesis BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  is_from_genesis BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  week_number INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  artefact_type TEXT,
  url TEXT,
  status TEXT CHECK (status IN ('Draft','Submitted','Approved','Featured')) DEFAULT 'Draft',
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('Normal','Important','Urgent')) DEFAULT 'Normal',
  target_pathway TEXT CHECK (target_pathway IN ('PM','BA','Both','All')) DEFAULT 'All',
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed weeks data
INSERT INTO weeks (week_number,title,phase,start_date,end_date,session_date,is_published,
  learning_goals,pm_assignment_title,pm_due_date,ba_assignment_title,ba_due_date,reflection_prompt)
VALUES
(0,'Onboarding & Diagnostic','Foundation','2026-06-06','2026-06-06','2026-06-06',TRUE,
  'Complete setup, confirm pathway, submit baseline diagnostic, meet the cohort',
  'Baseline Diagnostic','2026-06-06','Baseline Diagnostic','2026-06-06',
  'Who am I, where am I starting from, and what do I want to build over 12 weeks?'),
(1,'Digital Product Foundations','Foundation','2026-06-09','2026-06-13','2026-06-14',FALSE,
  'Explain how digital products create value, map every role on a product team, trace how work moves through a team',
  'Product Teardown Report','2026-06-20','Stakeholder Map & RACI Matrix','2026-06-20',
  'What I learned about how product teams work and where PM/BA sit in the picture.'),
(2,'Problem Discovery','Foundation','2026-06-16','2026-06-20','2026-06-21',FALSE,
  'Distinguish symptoms from root problems, write a structured problem brief, run an elicitation interview',
  'Problem Brief','2026-06-27','Elicitation Interview Notes','2026-06-27',
  'A time someone defined a problem incorrectly — and what the real problem turned out to be.'),
(3,'Product Strategy & Business Context','Foundation','2026-06-23','2026-06-27','2026-06-28',FALSE,
  'Connect a problem to a business goal, define MVP scope, write a product strategy canvas',
  'Product Strategy Canvas','2026-07-04','Business Case Document','2026-07-04',
  'The hardest part of scoping an MVP and why most teams build too much.'),
(4,'Requirements & Scope','Core Skills','2026-06-30','2026-07-04','2026-07-05',FALSE,
  'Write user stories, define acceptance criteria, scope a BRD or PRD a team can act on',
  'Full PRD','2026-07-11','Full BRD','2026-07-11',
  'The hardest requirement to write and what I learned about requirements vs solutions.'),
(5,'Journey, Workflow & Process Design','Core Skills','2026-07-07','2026-07-11','2026-07-12',FALSE,
  'Map user journeys, document As-Is and To-Be processes, identify edge cases',
  'User Journey Map','2026-07-18','As-Is / To-Be Process Maps','2026-07-18',
  'What the journey map revealed that was not in my requirements document.'),
(6,'UX & Product Design Foundations','Core Skills','2026-07-14','2026-07-18','2026-07-19',FALSE,
  'Build evidence-based personas, understand information architecture, write a design brief',
  'Design Brief','2026-07-25','User Journey vs Process Gap Analysis','2026-07-25',
  'What I now understand about design that I did not know before.'),
(7,'Prototyping & Design Systems','Core Skills','2026-07-21','2026-07-25','2026-07-26',FALSE,
  'Review a Figma prototype as PM or BA, write design feedback, check requirements coverage',
  'Figma Prototype Review Notes','2026-08-01','BA Design Review Document','2026-08-01',
  'What feedback adds real value in a design review and what creates noise.'),
(8,'Agile Delivery & Backlog','Delivery','2026-07-28','2026-08-01','2026-08-02',FALSE,
  'Build a sprint backlog, write stories with Definition of Ready, understand agile flow',
  'Sprint Backlog','2026-08-08','User Stories + Acceptance Criteria Library','2026-08-08',
  'What makes a user story truly ready for a sprint — and what usually makes it not ready.'),
(9,'Stakeholder Management','Delivery','2026-08-04','2026-08-08','2026-08-09',FALSE,
  'Handle vague requests, navigate conflicting priorities, facilitate trade-off conversations',
  'Stakeholder Simulation Responses','2026-08-15','Stakeholder Workshop Pack','2026-08-15',
  'The stakeholder situation I found hardest and how I would handle it differently now.'),
(10,'Testing, UAT & Launch Readiness','Delivery','2026-08-11','2026-08-15','2026-08-16',FALSE,
  'Write UAT test scenarios, build a launch plan, define rollback criteria',
  'Launch Plan','2026-08-22','Full UAT Pack','2026-08-22',
  'What launch readiness actually means — and what most teams skip.'),
(11,'Metrics & Continuous Improvement','Delivery','2026-08-18','2026-08-22','2026-08-23',FALSE,
  'Define success metrics, build a metrics plan, design a post-launch feedback loop',
  'Metrics Plan','2026-08-29','Post-Launch Reporting Framework','2026-08-29',
  'The metric that would tell me my product is working — and the one that would say pivot.'),
(12,'Capstone Defence & Portfolio Review','Capstone','2026-08-25','2026-08-29','2026-08-30',FALSE,
  'Present your full capstone, defend every decision, receive Capability Passport assessment',
  'Capstone Project + Portfolio','2026-08-29','Capstone Project + Portfolio','2026-08-29',
  'Demo Day. What I built, what I learned, and who I am now vs Week 0.')
ON CONFLICT (week_number) DO NOTHING;

-- Row Level Security
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;

-- Weeks: published only for learners
CREATE POLICY "weeks_select_published" ON weeks FOR SELECT USING (is_published = TRUE);
-- Announcements: all
CREATE POLICY "announcements_select_all" ON announcements FOR SELECT USING (is_published = TRUE);
-- Community: all can read
CREATE POLICY "community_posts_select_all" ON community_posts FOR SELECT USING (TRUE);
CREATE POLICY "community_replies_select_all" ON community_replies FOR SELECT USING (TRUE);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_learners_updated_at BEFORE UPDATE ON learners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_weeks_updated_at BEFORE UPDATE ON weeks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
