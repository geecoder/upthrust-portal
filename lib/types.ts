export type Pathway = 'PM' | 'BA' | 'Design' | 'Undecided';
export type Tier = 'Standard' | 'Premium' | 'VIP' | 'Corporate';
export type RiskStatus = 'Green' | 'Amber' | 'Red';
export type EnrollmentStatus = 'Pending' | 'Active' | 'Completed' | 'Withdrawn';
export type PassportEligibility = 'Not Eligible' | 'Pending Review' | 'Approved' | 'Withheld' | 'Needs Revision';
export type AssignmentStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'AI Reviewed' | 'Human Reviewed' | 'Resubmission Requested' | 'Approved' | 'Portfolio Ready';
export type Phase = 'Foundation' | 'Core Skills' | 'Delivery' | 'Capstone';
export type CapabilityLevel = 'Not Started' | 'Emerging' | 'Developing' | 'Competent' | 'Portfolio Ready';
export type ResourceType = 'Template' | 'Example' | 'Reading' | 'Tool' | 'Video' | 'Guide' | 'AI Prompt';

export interface Learner {
  id: string;
  clerk_user_id: string;
  email: string;
  first_name: string;
  last_name?: string;
  country?: string;
  phone?: string;
  pathway: Pathway;
  tier: Tier;
  cohort: string;
  enrollment_status: EnrollmentStatus;
  attendance_pct: number;
  assignment_completion_pct: number;
  avg_score: number;
  risk_status: RiskStatus;
  passport_eligibility: PassportEligibility;
  passport_issued: boolean;
  passport_issued_at?: string;
  passport_id?: string;
  portfolio_status: string;
  capstone_status: string;
  onboarding_complete?: boolean;
  career_goal?: string;
  current_job_role?: string;
  linkedin_url?: string;
  cv_url?: string;
  bio?: string;
  employer_visible?: boolean;
  preferred_roles?: string;
  work_preference?: string;
  availability?: string;
  notes?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Week {
  id: string;
  week_number: number;
  title: string;
  phase: Phase;
  start_date?: string;
  end_date?: string;
  session_date?: string;
  is_published: boolean;
  why_it_matters?: string;
  outcomes?: string;
  learning_goals?: string;
  pre_work?: string;
  concept_topics?: string;
  case_study?: string;
  lab_exercise?: string;
  session_notes?: string;
  recording_url?: string;
  session_slides_url?: string;
  zoom_link?: string;
  pm_assignment_title?: string;
  pm_assignment_brief?: string;
  pm_deliverable?: string;
  pm_rubric?: string;
  pm_rubric_json?: string;
  pm_due_date?: string;
  ba_assignment_title?: string;
  ba_assignment_brief?: string;
  ba_deliverable?: string;
  ba_rubric?: string;
  ba_rubric_json?: string;
  ba_due_date?: string;
  ai_practice_type?: string;
  reflection_prompt?: string;
  resources?: string;
}

export interface Assignment {
  id: string;
  learner_id: string;
  week_number: number;
  pathway: 'PM' | 'BA';
  submission_url?: string;
  submission_notes?: string;
  submitted_at?: string;
  status: AssignmentStatus;
  score?: number;
  feedback?: string;
  feedback_by?: string;
  feedback_at?: string;
  ai_feedback?: string;
  ai_feedback_at?: string;
  ai_score?: number;
  ai_quality_rating?: string;
  is_portfolio_ready: boolean;
  portfolio_approved?: boolean;
  portfolio_approved_at?: string;
  resubmission_count?: number;
  is_late?: boolean;
  extension_granted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CapabilityScore {
  id: string;
  learner_id: string;
  capability: string;
  level: CapabilityLevel;
  score: number;
  evidence?: string;
  last_assessed_at?: string;
}

export interface Resource {
  id: string;
  title: string;
  description?: string;
  resource_type: ResourceType;
  pathway: string;
  week_number?: number;
  assignment_context?: string;
  external_url?: string;
  example_url?: string;
  is_featured: boolean;
  is_active: boolean;
  tags?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  learner_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_assignment_id?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  learner_id: string;
  week_number: number;
  attended: boolean;
  arrival?: string;
  session_title?: string;
  session_date?: string;
  notes?: string;
  missed_session_task_sent?: boolean;
  recorded_at: string;
}

export interface AIAttempt {
  id: string;
  learner_id: string;
  practice_type: string;
  character_id?: string;
  question_id?: string;
  document_type?: string;
  score?: number;
  feedback?: string;
  completed: boolean;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  learner_id: string;
  author_name: string;
  author_avatar?: string;
  category: 'Question' | 'Win' | 'Portfolio Review' | 'General';
  content: string;
  pathway_tag?: string;
  week_tag?: number;
  is_pinned: boolean;
  is_from_genesis: boolean;
  likes_count: number;
  replies_count: number;
  created_at: string;
}

export interface PortfolioItem {
  id: string;
  learner_id: string;
  week_number?: number;
  title: string;
  description?: string;
  artefact_type?: string;
  url?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Featured';
  feedback?: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  target_pathway: 'PM' | 'BA' | 'Both' | 'All';
  is_published: boolean;
  created_at: string;
}

// ── Passport criteria ────────────────────────────────────
export const PASSPORT_CRITERIA = {
  attendance_min: 75,
  assignment_submission_min: 80,
  avg_score_min: 70,
  capstone_required: true,
  portfolio_items_min: 8,
};

// ── Capability areas ─────────────────────────────────────
export const CAPABILITY_AREAS = [
  'Product Thinking',
  'Business Analysis',
  'Discovery & Problem Framing',
  'Requirements & Documentation',
  'Stakeholder Management',
  'Delivery & Agile Collaboration',
  'Communication & Facilitation',
  'Strategy & Commercial Thinking',
  'AI-enabled Professional Practice',
  'Portfolio & Career Readiness',
];

// ── Status display helpers ────────────────────────────────
export const ASSIGNMENT_STATUS_COLOR: Record<string, string> = {
  'Not Started': '#6B7280',
  'In Progress': '#D97706',
  'Submitted': '#2563EB',
  'AI Reviewed': '#7C3AED',
  'Human Reviewed': '#1D4ED8',
  'Resubmission Requested': '#DC2626',
  'Approved': '#059669',
  'Portfolio Ready': '#047857',
};

export const ASSIGNMENT_STATUS_BG: Record<string, string> = {
  'Not Started': 'rgba(107,114,128,0.1)',
  'In Progress': 'rgba(217,119,6,0.1)',
  'Submitted': 'rgba(37,99,235,0.1)',
  'AI Reviewed': 'rgba(124,58,237,0.1)',
  'Human Reviewed': 'rgba(29,78,216,0.1)',
  'Resubmission Requested': 'rgba(220,38,38,0.1)',
  'Approved': 'rgba(5,150,105,0.1)',
  'Portfolio Ready': 'rgba(4,120,87,0.1)',
};

export const RISK_COLOR: Record<string, string> = {
  Green: '#059669',
  Amber: '#D97706',
  Red: '#DC2626',
};

export const PHASE_COLORS: Record<string, string> = {
  Foundation: '#0F1A2E',
  'Core Skills': '#A05A26',
  Delivery: '#4F6A4A',
  Capstone: '#C5743A',
};

// ── Program config ────────────────────────────────────────
export const PROGRAM = {
  name: 'Career Capability Accelerator',
  cohort: 'Cohort 1',
  start: '2026-06-06',
  end: '2026-08-29',
  demoDay: '2026-08-30',
  enrollmentClose: '2026-06-03',
  totalWeeks: 13,
  contact: 'info@upthrustdigital.com',
  zoomLink: '',
  whatsapp: '',
  calendlyPm: '',
  calendlyBa: '',
};

export const WEEK_DATES = [
  { week: 0, session: 'Sat June 6' },
  { week: 1, session: 'Sat June 14' },
  { week: 2, session: 'Sat June 21' },
  { week: 3, session: 'Sat June 28' },
  { week: 4, session: 'Sat July 5' },
  { week: 5, session: 'Sat July 12' },
  { week: 6, session: 'Sat July 19' },
  { week: 7, session: 'Sat July 26' },
  { week: 8, session: 'Sat Aug 2' },
  { week: 9, session: 'Sat Aug 9' },
  { week: 10, session: 'Sat Aug 16' },
  { week: 11, session: 'Sat Aug 23' },
  { week: 12, session: 'Sat Aug 30 — DEMO DAY' },
];
