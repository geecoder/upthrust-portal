'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

interface Props {
  learnerId: string;
  weekNumber: number;
  pathway: string;
  assignmentTitle: string;
  assignmentBrief: string;
  existingAssignment: {
    id: string;
    status: string;
    submission_url?: string;
    resubmission_count?: number;
  } | null;
}

export default function AssignmentSubmitPanel({
  learnerId,
  weekNumber,
  pathway,
  assignmentTitle,
  assignmentBrief,
  existingAssignment,
}: Props) {
  const router = useRouter();
  const db = createBrowserClient();

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(existingAssignment?.submission_url || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [done, setDone] = useState(false);

  const isResubmission = existingAssignment?.status === 'Resubmission Requested';
  const hasSubmitted = !!existingAssignment?.submission_url;

  function validateUrl(val: string) {
    try { new URL(val); return true; } catch { return false; }
  }

  async function handleSubmit() {
    setUrlError('');
    if (!url.trim()) { setUrlError('Paste a link to your work first.'); return; }
    if (!validateUrl(url.trim())) {
      setUrlError("That doesn't look like a valid URL — make sure it starts with https://");
      return;
    }

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      learner_id: learnerId,
      week_number: weekNumber,
      pathway,
      submission_url: url.trim(),
      submission_notes: notes.trim() || null,
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
      resubmission_count: isResubmission
        ? (existingAssignment?.resubmission_count ?? 0) + 1
        : 0,
    };

    let assignmentId: string | null = null;

    if (existingAssignment?.id) {
      const { data } = await db
        .from('assignments')
        .update(payload)
        .eq('id', existingAssignment.id)
        .select('id')
        .maybeSingle();
      assignmentId = data?.id ?? existingAssignment.id;
    } else {
      const { data } = await db
        .from('assignments')
        .insert(payload)
        .select('id')
        .maybeSingle();
      assignmentId = data?.id ?? null;
    }

    setSubmitting(false);
    setOpen(false);
    setNotes('');
    setDone(true);

    // Trigger AI feedback — don't block UI
    if (assignmentId) {
      setGeneratingAI(true);
      try {
        await fetch('/api/ai-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId,
            submissionUrl: url.trim(),
            weekNumber,
            pathway,
            assignmentTitle,
          }),
        });
      } catch (err) {
        console.error('AI feedback error:', err);
      } finally {
        setGeneratingAI(false);
        // Refresh the server component to show updated status + AI feedback
        router.refresh();
      }
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* AI generating banner */}
      {generatingAI && (
        <div style={{
          marginTop: 14, padding: '12px 16px',
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.15)',
          borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 14, height: 14, flexShrink: 0,
            border: '2px solid rgba(124,58,237,0.2)',
            borderTopColor: '#7C3AED',
            borderRadius: '50%',
            animation: 'spin 700ms linear infinite',
          }} />
          <p style={{ fontSize: '0.875rem', color: '#7C3AED', fontWeight: 600 }}>
            Getting AI feedback — about 10 seconds...
          </p>
        </div>
      )}

      {/* Submitted banner */}
      {done && !generatingAI && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'rgba(5,150,105,0.07)',
          border: '1px solid rgba(5,150,105,0.2)',
          borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--moss)', fontWeight: 700 }}>✓</span>
          <p style={{ fontSize: '0.875rem', color: 'var(--moss)', fontWeight: 600 }}>
            Submitted. AI feedback loading, Genesis will review within 48 hours.
          </p>
        </div>
      )}

      {/* Action button */}
      {!open && !generatingAI && (
        <button
          onClick={() => { setOpen(true); setDone(false); setUrlError(''); }}
          className="btn btn-primary btn-sm"
          style={{ marginTop: 10 }}
        >
          {isResubmission ? '↩ Submit Revision'
            : hasSubmitted ? 'Update Submission'
            : 'Submit Work →'}
        </button>
      )}

      {/* Submission form */}
      {open && (
        <div style={{
          marginTop: 14, padding: '20px',
          background: 'var(--paper-soft)',
          border: '1px solid var(--paper-line)',
          borderRadius: 6,
        }}>

          {/* Brief */}
          {assignmentBrief && (
            <div style={{
              marginBottom: 16, padding: '12px 14px',
              background: 'var(--white)', borderRadius: 4,
              borderLeft: '3px solid var(--amber)',
            }}>
              <p style={{
                fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 6,
              }}>
                Assignment Brief
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                {assignmentBrief}
              </p>
            </div>
          )}

          {/* Resubmission note */}
          {isResubmission && (
            <div style={{
              marginBottom: 14, padding: '10px 12px',
              background: 'rgba(197,116,58,0.07)', borderRadius: 4,
            }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                Resubmission #{(existingAssignment?.resubmission_count ?? 0) + 1} — address all of
                Genesis's feedback before resubmitting.
              </p>
            </div>
          )}

          {/* URL */}
          <div className="form-group">
            <label className="form-label">Your submission link *</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://docs.google.com/... or https://notion.so/..."
              value={url}
              onChange={e => { setUrl(e.target.value); setUrlError(''); }}
              autoFocus
            />
            <p style={{
              fontSize: '0.75rem', marginTop: 5,
              color: urlError ? 'var(--red)' : 'var(--ink-muted)',
              fontWeight: urlError ? 600 : 400,
            }}>
              {urlError
                || 'Paste a Google Doc, Notion, Figma, or Miro link. Set sharing to "Anyone with the link can view".'}
            </p>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Note for Genesis{' '}
              <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>(optional)</span>
            </label>
            <textarea
              className="form-input form-textarea"
              style={{ minHeight: 68 }}
              placeholder="Anything specific you'd like Genesis to focus on..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              disabled={!url.trim() || submitting}
              onClick={handleSubmit}
              style={{ opacity: !url.trim() || submitting ? 0.6 : 1 }}
            >
              {submitting
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 12, height: 12, display: 'inline-block',
                      border: '2px solid rgba(250,247,241,0.3)',
                      borderTopColor: '#FAF7F1', borderRadius: '50%',
                      animation: 'spin 600ms linear infinite',
                    }} />
                    Submitting...
                  </span>
                : isResubmission ? '↩ Submit Revision'
                : hasSubmitted ? 'Update Submission'
                : 'Submit Assignment →'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setOpen(false); setUrlError(''); }}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
