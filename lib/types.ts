export type Pathway = 'PM' | 'BA' | 'Design' | 'Undecided';
export type Tier = 'Standard' | 'Premium' | 'VIP' | 'Corporate';
export type RiskStatus = 'Green' | 'Amber' | 'Red';
export type EnrollmentStatus = 'Pending' | 'Active' | 'Completed' | 'Withdrawn';
export type PassportEligibility = 'Not Eligible' | 'Pending Review' | 'Approved' | 'Withheld' | 'Needs Revision';
export type AssignmentStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'In Review' | 'Needs Revision' | 'Approved' | 'Portfolio Ready';
export type Phase = 'Foundation' | 'Core Skills' | 'Delivery' | 'Capstone';

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
  portfolio_status: string;
  capstone_status: string;
  notes?: string;
  linkedin_url?: string;
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
  learning_goals?: string;
  concept_topics?: string;
  case_study?: string;
  lab_exercise?: string;
  session_notes?: string;
  recording_url?: string;
  pm_assignment_title?: string;
  pm_assignment_brief?: string;
  pm_deliverable?: string;
  pm_rubric?: string;
  pm_due_date?: string;
  ba_assignment_title?: string;
  ba_assignment_brief?: string;
  ba_deliverable?: string;
  ba_rubric?: string;
  ba_due_date?: string;
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
  is_portfolio_ready: boolean;
  created_at: string;
  updated_at: string;
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

// Capability Passport criteria
export const PASSPORT_CRITERIA = {
  attendance_min: 75,
  assignment_submission_min: 80,
  avg_score_min: 70,
  capstone_required: true,
  capstone_score_min: 65,
  portfolio_items_min: 8,
};

// Program config
export const PROGRAM = {
  name: 'Career Capability Accelerator',
  cohort: 'Cohort 1',
  start: '2026-06-06',
  end: '2026-08-29',
  demoDay: '2026-08-30',
  enrollmentClose: '2026-06-03',
  totalWeeks: 13,
  contact: 'info@upthrustdigital.com',
  calendlyPm: '', // Add 1:1 booking link
  calendlyBa: '', // Add 1:1 booking link
  whatsapp: '',   // Add WhatsApp group link
  zoomLink: '',   // Add session Zoom link
};

export const PHASE_COLORS: Record<Phase, string> = {
  Foundation: '#0F1A2E',
  'Core Skills': '#A05A26',
  Delivery: '#4F6A4A',
  Capstone: '#C5743A',
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
