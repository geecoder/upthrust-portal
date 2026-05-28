-- ============================================================
-- UPTHRUST PORTAL — SCHEMA ADDITIONS
-- Run this in Supabase SQL Editor AFTER the base schema
-- ============================================================

-- Learner table additions
ALTER TABLE learners
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS passport_id TEXT,
  ADD COLUMN IF NOT EXISTS career_goal TEXT,
  ADD COLUMN IF NOT EXISTS current_role TEXT,
  ADD COLUMN IF NOT EXISTS employer_visible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preferred_roles TEXT,
  ADD COLUMN IF NOT EXISTS work_preference TEXT CHECK (work_preference IN ('Remote','Hybrid','Onsite','Flexible')),
  ADD COLUMN IF NOT EXISTS availability TEXT CHECK (availability IN ('Internship','Project Placement','Full-time','Freelance','Not Available')),
  ADD COLUMN IF NOT EXISTS cv_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Assignment table additions
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT,
  ADD COLUMN IF NOT EXISTS ai_feedback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ai_quality_rating TEXT CHECK (ai_quality_rating IN ('Needs Work','Developing','Good','Portfolio Ready')),
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS extension_granted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portfolio_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portfolio_approved_at TIMESTAMPTZ;

-- Attendance table additions
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS session_title TEXT,
  ADD COLUMN IF NOT EXISTS session_date DATE,
  ADD COLUMN IF NOT EXISTS arrival TEXT CHECK (arrival IN ('On Time','Late','Absent','Excused')) DEFAULT 'Absent',
  ADD COLUMN IF NOT EXISTS missed_session_task_sent BOOLEAN DEFAULT FALSE;

-- Weeks table additions
ALTER TABLE weeks
  ADD COLUMN IF NOT EXISTS why_it_matters TEXT,
  ADD COLUMN IF NOT EXISTS pre_work TEXT,
  ADD COLUMN IF NOT EXISTS outcomes TEXT,
  ADD COLUMN IF NOT EXISTS pm_rubric_json TEXT,
  ADD COLUMN IF NOT EXISTS ba_rubric_json TEXT,
  ADD COLUMN IF NOT EXISTS ai_practice_type TEXT,
  ADD COLUMN IF NOT EXISTS zoom_link TEXT,
  ADD COLUMN IF NOT EXISTS session_slides_url TEXT;

-- Capability scores table (new)
CREATE TABLE IF NOT EXISTS capability_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  level TEXT CHECK (level IN ('Not Started','Emerging','Developing','Competent','Portfolio Ready')) DEFAULT 'Not Started',
  score NUMERIC(5,2) DEFAULT 0,
  evidence TEXT,
  last_assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(learner_id, capability)
);

-- Resources table (new — replaces the static list in resources/page.tsx)
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT CHECK (resource_type IN ('Template','Example','Reading','Tool','Video','Guide','AI Prompt')) NOT NULL,
  pathway TEXT CHECK (pathway IN ('PM','BA','Both','Career')) DEFAULT 'Both',
  week_number INTEGER,
  assignment_context TEXT,
  external_url TEXT,
  example_url TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  tags TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table (new)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('feedback_ready','resubmission_required','assignment_due','session_reminder','passport_approved','announcement','inactivity_nudge')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_assignment_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI practice attempts log (new)
CREATE TABLE IF NOT EXISTS ai_practice_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  practice_type TEXT CHECK (practice_type IN ('Stakeholder Sim','Interview Coach','Writing Checker','Assignment Review','Portfolio Coach','Capstone Coach')) NOT NULL,
  character_id TEXT,
  question_id TEXT,
  document_type TEXT,
  transcript TEXT,
  score NUMERIC(5,2),
  feedback TEXT,
  capability_areas TEXT,
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed capability framework for PM pathway
INSERT INTO capability_scores (learner_id, capability, level)
SELECT l.id, cap.name, 'Not Started'
FROM learners l
CROSS JOIN (VALUES
  ('Product Thinking'),
  ('Business Analysis'),
  ('Discovery & Problem Framing'),
  ('Requirements & Documentation'),
  ('Stakeholder Management'),
  ('Delivery & Agile Collaboration'),
  ('Communication & Facilitation'),
  ('Strategy & Commercial Thinking'),
  ('AI-enabled Professional Practice'),
  ('Portfolio & Career Readiness')
) AS cap(name)
WHERE l.enrollment_status = 'Active'
ON CONFLICT (learner_id, capability) DO NOTHING;

-- Seed resources
INSERT INTO resources (title, description, resource_type, pathway, week_number, assignment_context, external_url, is_featured, tags)
VALUES
('Product Teardown Template','Structured template for analysing an existing product','Template','PM',1,'Product Teardown Report','#',TRUE,'teardown,PM,week1'),
('Problem Brief Template','How to frame a problem clearly using structured format','Template','Both',2,'Problem Brief','#',TRUE,'problem,framing,week2'),
('Product Strategy Canvas','One-page strategic planning template','Template','PM',3,'Product Strategy Canvas','#',FALSE,'strategy,canvas,week3'),
('PRD Template','Full Product Requirements Document template','Template','PM',4,'Full PRD','#',TRUE,'PRD,requirements,week4'),
('BRD Template','Business Requirements Document template','Template','BA',4,'Full BRD','#',TRUE,'BRD,requirements,week4'),
('Stakeholder Map & RACI','Stakeholder identification and responsibility matrix','Template','BA',1,'Stakeholder Map & RACI Matrix','#',FALSE,'stakeholder,RACI,week1'),
('Elicitation Interview Notes','Structured notes format for requirements interviews','Template','BA',2,'Elicitation Interview Notes','#',FALSE,'elicitation,interview,week2'),
('User Journey Map Template','End-to-end user journey mapping template','Template','PM',5,'User Journey Map','#',FALSE,'journey,map,week5'),
('Process Map Template','As-Is and To-Be process mapping template','Template','BA',5,'As-Is / To-Be Process Maps','#',FALSE,'process,map,week5'),
('UAT Pack Template','User Acceptance Testing documentation pack','Template','BA',10,'Full UAT Pack','#',TRUE,'UAT,testing,week10'),
('Sprint Backlog Template','Agile sprint planning and backlog template','Template','PM',8,'Sprint Backlog','#',FALSE,'sprint,agile,week8'),
('Capstone Case Study Template','Portfolio-ready case study structure','Template','Both',12,'Capstone Project + Portfolio','#',TRUE,'capstone,portfolio,week12'),
('Inspired by Marty Cagan','Essential reading for product managers','Reading','PM',NULL,NULL,'https://svpg.com/inspired-how-to-create-tech-products-customers-love/',FALSE,'reading,PM'),
('Shape Up by Basecamp','Free online product development methodology book','Reading','PM',NULL,NULL,'https://basecamp.com/shapeup',FALSE,'reading,PM,agile'),
('The Mom Test','How to talk to customers and validate ideas','Reading','Both',2,NULL,'#',FALSE,'reading,discovery,validation'),
('Miro','Online whiteboard for process maps and journeys','Tool','Both',NULL,NULL,'https://miro.com',FALSE,'tool,collaboration'),
('Figma','Design review and prototyping tool','Tool','Both',6,NULL,'https://figma.com',FALSE,'tool,design'),
('draw.io','Free diagramming tool for process maps','Tool','BA',5,NULL,'https://diagrams.net',FALSE,'tool,BA,process'),
('Trello','Kanban/sprint backlog tool','Tool','PM',8,NULL,'https://trello.com',FALSE,'tool,PM,agile'),
('Lenny''s Newsletter','Weekly PM and product insights','Reading','PM',NULL,NULL,'https://lennysnewsletter.com',FALSE,'reading,PM'),
('BABOK Guide (IIBA)','Business Analysis Body of Knowledge','Reading','BA',NULL,NULL,'https://iiba.org',FALSE,'reading,BA')
ON CONFLICT DO NOTHING;

-- RLS for new tables
ALTER TABLE capability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_practice_attempts ENABLE ROW LEVEL SECURITY;

-- Resources: all authenticated can read active resources
CREATE POLICY "resources_read_all" ON resources FOR SELECT USING (is_active = TRUE);

-- Notifications: learner sees own
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (
    learner_id = (SELECT id FROM learners WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (
    learner_id = (SELECT id FROM learners WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- Capability scores: learner sees own
CREATE POLICY "capability_select_own" ON capability_scores
  FOR SELECT USING (
    learner_id = (SELECT id FROM learners WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- AI practice: learner sees own
CREATE POLICY "ai_practice_select_own" ON ai_practice_attempts
  FOR SELECT USING (
    learner_id = (SELECT id FROM learners WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );
CREATE POLICY "ai_practice_insert_own" ON ai_practice_attempts
  FOR INSERT WITH CHECK (
    learner_id = (SELECT id FROM learners WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- Generate passport IDs for existing learners
UPDATE learners
SET passport_id = 'UP-C1-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0') || '-' || COALESCE(pathway, 'PM')
WHERE passport_id IS NULL;

-- Triggers for new tables
CREATE TRIGGER update_capability_scores_updated_at BEFORE UPDATE ON capability_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Community replies table
CREATE TABLE IF NOT EXISTS community_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learners(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  is_from_genesis BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_replies_select_all" ON community_replies
  FOR SELECT USING (TRUE);

CREATE POLICY "community_replies_insert_own" ON community_replies
  FOR INSERT WITH CHECK (
    learner_id = (SELECT id FROM learners WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );
