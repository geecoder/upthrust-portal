// ─── Auth ─────────────────────────────────────────────────────
export type UserRole = 'learner' | 'admin';

export interface UserProfile {
  id: string; // Clerk user ID
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  pathway: Pathway | null;
  tier: Tier | null;
  country: string | null;
  cohort: string | null;
  createdAt: string;
}

// ─── Program ─────────────────────────────────────────────────
export type Pathway = 'pm' | 'ba';
export type Tier = 'standard' | 'premium';
export type Phase = 'foundation' | 'core' | 'delivery' | 'capstone';
export type RiskStatus = 'green' | 'amber' | 'red';
export type EnrollmentStatus = 'pending' | 'active' | 'completed' | 'withdrawn';
export type PassportStatus = 'locked' | 'pending_review' | 'approved' | 'withheld' | 'needs_revision';

export interface Learner {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  pathway: Pathway;
  tier: Tier;
  country: string;
  cohort: string;
  enrollmentStatus: EnrollmentStatus;
  riskStatus: RiskStatus;
  attendancePercent: number;
  assignmentCompletionPercent: number;
  portfolioStatus: PortfolioStatus;
  capstoneStatus: CapstoneStatus;
  passportStatus: PassportStatus;
  passportEligible: boolean;
  notes: string | null;
  createdAt: string;
}

export type PortfolioStatus = 'not_started' | 'drafting' | 'submitted' | 'reviewed' | 'ready';
export type CapstoneStatus = 'not_started' | 'in_progress' | 'submitted' | 'presented' | 'approved';

// ─── Weeks & Content ─────────────────────────────────────────
export interface Week {
  id: string;
  weekNumber: number; // 0-12
  title: string;
  theme: string;
  phase: Phase;
  dates: string; // e.g. "June 9–13, 2026"
  liveSessionDate: string;
  isUnlocked: boolean;
  conceptTopics: string[];
  caseStudy: string;
  labExercise: string;
  pmAssignment: Assignment;
  baAssignment: Assignment;
  reflectionPrompt: string;
  resources: Resource[];
}

export interface Assignment {
  title: string;
  brief: string;
  deliverableFormat: string;
  rubric: RubricItem[];
  dueDate: string;
}

export interface RubricItem {
  criterion: string;
  points: number;
}

export interface Resource {
  title: string;
  type: 'template' | 'reading' | 'tool' | 'video' | 'recording';
  url: string;
}

// ─── Submissions ─────────────────────────────────────────────
export type SubmissionStatus = 'not_submitted' | 'submitted' | 'in_review' | 'needs_revision' | 'approved' | 'portfolio_ready';

export interface Submission {
  id: string;
  learnerId: string;
  weekNumber: number;
  pathway: Pathway;
  assignmentTitle: string;
  submissionUrl: string;
  submissionNote: string | null;
  status: SubmissionStatus;
  score: number | null;
  feedbackText: string | null;
  feedbackAt: string | null;
  submittedAt: string;
  deliverableType: string;
}

// ─── Portfolio ───────────────────────────────────────────────
export interface PortfolioItem {
  id: string;
  learnerId: string;
  weekNumber: number;
  title: string;
  artefactType: string;
  url: string;
  status: 'draft' | 'submitted' | 'reviewed' | 'approved';
  score: number | null;
  feedback: string | null;
  createdAt: string;
}

// ─── Capability Passport ────────────────────────────────────
export interface PassportCriteria {
  attendancePercent: number;
  assignmentCompletionPercent: number;
  averageScore: number;
  capstoneSubmitted: boolean;
  capstoneScore: number | null;
  portfolioCount: number;
}

export interface PassportCriteriaCheck {
  attendance: { met: boolean; value: number; required: number };
  assignments: { met: boolean; value: number; required: number };
  averageScore: { met: boolean; value: number; required: number };
  capstoneSubmitted: { met: boolean };
  capstoneScore: { met: boolean; value: number | null; required: number };
  portfolioCount: { met: boolean; value: number; required: number };
  allMet: boolean;
}

// ─── Community ───────────────────────────────────────────────
export type PostType = 'update' | 'question' | 'win' | 'portfolio_share';

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  pathway: Pathway | null;
  type: PostType;
  content: string;
  attachmentUrl: string | null;
  likesCount: number;
  repliesCount: number;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ─── Progress ────────────────────────────────────────────────
export interface LearnerProgress {
  learnerId: string;
  weekNumber: number;
  attended: boolean;
  assignmentSubmitted: boolean;
  assignmentScore: number | null;
  reflectionSubmitted: boolean;
  updatedAt: string;
}

// ─── Cohort ──────────────────────────────────────────────────
export interface CohortStats {
  totalLearners: number;
  pmLearners: number;
  baLearners: number;
  standardTier: number;
  premiumTier: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  avgAttendance: number;
  avgAssignmentCompletion: number;
  passportEligibleCount: number;
}
