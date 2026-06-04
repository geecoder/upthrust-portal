// lib/passport.ts
// ─────────────────────────────────────────────────────────────────────────────
// Upthrust Capability Passport — shared core logic.
// Pure, dependency-free (Node built-in `crypto` only). Safe to import from any
// API route. NO 'use client' — server-only.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';

// ── Pathway domains (from Notion 2.6 — Capability Framework) ─────────────────
export const PM_DOMAINS = [
  'Product Thinking',
  'Discovery & Problem Framing',
  'User Research',
  'Solution Design',
  'Prioritisation',
  'Roadmapping',
  'Stakeholder Management',
  'Communication',
  'Data & Analytics',
  'Execution & Delivery',
] as const;

export const BA_DOMAINS = [
  'Requirements Elicitation',
  'Stakeholder Management',
  'Strategy Analysis',
  'Process Analysis',
  'Process Modelling',
  'Business Needs Analysis',
  'Solution Evaluation',
  'Communication',
  'Documentation',
  'Critical Thinking',
  'Facilitation',
] as const;

export type Pathway = 'Product Management' | 'Business Analysis';

export function domainsFor(pathway: string): readonly string[] {
  return /business/i.test(pathway) ? BA_DOMAINS : PM_DOMAINS;
}

// ── Overall score → rating band (Notion 2.6 Section 2) ───────────────────────
export function ratingForScore(score: number): string {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Advanced';
  if (score >= 70) return 'Proficient';
  if (score >= 60) return 'Developing';
  return 'Foundation';
}

// ── Per-domain numeric → capability level (Notion 2.6) ───────────────────────
export function levelForDomainScore(score: number): 'Advanced' | 'Proficient' | 'Developing' | 'Foundation' {
  if (score >= 80) return 'Advanced';
  if (score >= 65) return 'Proficient';
  if (score >= 50) return 'Developing';
  return 'Foundation';
}

// ── Overall readiness level (Notion 2.6 Section 3 levels) ────────────────────
// Maps the single overall score to the 5 readiness tiers used in messaging.
export function readinessLevel(score: number): string {
  if (score >= 90) return 'Advanced Practitioner';
  if (score >= 80) return 'Strong Associate';
  if (score >= 70) return 'Associate Work-Ready';
  if (score >= 60) return 'Developing';
  return 'Foundation';
}

// ── Minimum issuance threshold (Notion 2.6) ──────────────────────────────────
export const MIN_OVERALL_THRESHOLD = 70;

// ─────────────────────────────────────────────────────────────────────────────
// HMAC SIGNING
// The signature is computed over a canonical string of the *snapshot* facts.
// It is what makes the credential tamper-evident: the passport_id is guessable,
// but a valid signature is not, and any change to the signed fields invalidates it.
// ─────────────────────────────────────────────────────────────────────────────
function getSecret(): string {
  const s = process.env.PASSPORT_SECRET;
  if (!s) throw new Error('PASSPORT_SECRET is not set');
  return s;
}

// Canonical payload — order matters and must never change once passports exist.
export interface SignablePassport {
  passport_id: string;       // e.g. UPT-PM-C1-2026-001
  learner_id: string | number;
  pathway: string;
  cohort: string;
  overall_score: number;
  issued_at: string;         // ISO date (the snapshot moment)
}

export function canonicalString(p: SignablePassport): string {
  return [
    p.passport_id,
    String(p.learner_id),
    p.pathway,
    p.cohort,
    String(p.overall_score),
    p.issued_at,
  ].join('|');
}

export function signPassport(p: SignablePassport): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(canonicalString(p))
    .digest('base64url'); // URL-safe, no padding — clean in query strings
}

// Constant-time comparison to avoid timing attacks.
export function verifySignature(p: SignablePassport, sig: string | null | undefined): boolean {
  if (!sig) return false;
  const expected = signPassport(p);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── URL builders ─────────────────────────────────────────────────────────────
export function baseUrl(): string {
  // Prefer explicit public app URL; fall back to production domain.
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'https://app.upthrustdigital.com'
  );
}

export function verifyUrl(passportId: string, sig?: string): string {
  const u = `${baseUrl()}/verify/${encodeURIComponent(passportId)}`;
  return sig ? `${u}?sig=${sig}` : u;
}

// ── Passport ID generator ────────────────────────────────────────────────────
// Format: UPT-<TRACK>-C<cohortNum>-<year>-<seq3>  e.g. UPT-PM-C1-2026-001
export function buildPassportId(opts: {
  pathway: string;
  cohortNumber: number | string;
  year: number | string;
  sequence: number;
}): string {
  const track = /business/i.test(opts.pathway) ? 'BA' : 'PM';
  const seq = String(opts.sequence).padStart(3, '0');
  return `UPT-${track}-C${opts.cohortNumber}-${opts.year}-${seq}`;
}
