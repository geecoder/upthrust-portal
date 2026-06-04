'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(existingAssignment?.submission_url || '');
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'ai' | 'done'>('idle');
  const [urlError, setUrlError] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');

  const isResubmission = existingAssignment?.status === 'Needs Revision';
  const hasSubmitted = !!existingAssignment?.submission_url;

  function validateUrl(val: string) {
    try { new URL(val); return true; } catch { return false; }
  }

  async function handleSubmit() {
    setUrlError('');
    if (!url.trim()) {
      setUrlError('Paste a link to your work first.');
      return;
    }
    if (!validateUrl(url.trim())) {
      setUrlError("That doesn't look like a valid URL — make sure it starts with https://");
      return;
    }

    setOpen(false);
    setPhase('submitting');

    try {
      // Single API call handles: save assignment + generate AI feedback
      const res = await fetch('/api/submit-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekNumber,
          pathway,
          submissionUrl: url.trim(),
          submissionNotes: notes.trim() || null,
          assignmentTitle,
          assignmentBrief,
        }),
      });

      setPhase('ai'); // Show "Generating AI feedback..."

      const data = await res.json();

      if (!res.ok) {
        console.error('Submit error:', data);
        setPhase('idle');
        setOpen(true);
        setUrlError(data.error || 'Submission failed. Please try again.');
        return;
      }

      if (data.aiFeedback) {
        setAiFeedback(data.aiFeedback);
      }

      setPhase('done');
      setNotes('');

      // Refresh server component to show updated status
      router.refresh();

    } catch (err) {
      console.error('Submit error:', err);
      setPhase('idle');
      setOpen(true);
      setUrlError('Network error. Please check your connection and try again.');
    }
  }

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Submitting spinner */}
      {phase === 'submitting' && (
        <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(15,26,46,0.04)', border: '1px solid var(--paper-line)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 16, height: 16, border: '2.5px solid var(--paper-line)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 700ms linear infinite', flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>Saving your submission...</p>
        </div>
      )}

      {/* AI generating */}
      {phase === 'ai' && (
        <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 16, height: 16, border: '2.5px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 700ms linear infinite', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#7C3AED' }}>⚡ Generating AI feedback...</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 2 }}>This takes about 10 seconds</p>
          </div>
        </div>
      )}

      {/* Done — show inline AI feedback if received */}
      {phase === 'done' && (
        <div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--moss)', fontWeight: 700, fontSize: '1rem' }}>✓</span>
            <p style={{ fontSize: '0.875rem', color: 'var(--moss)', fontWeight: 600 }}>
              Submitted successfully. Genesis will review within 48 hours.
            </p>
          </div>
          {aiFeedback && (
            <div style={{ marginTop: 10, padding: '14px 16px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)', borderLeft: '3px solid #7C3AED', borderRadius: 6 }}>
              <p style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C3AED', marginBottom: 10 }}>
                ⚡ AI First-Pass Feedback
              </p>
              <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {aiFeedback}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 10, fontStyle: 'italic' }}>
                This is automated pre-screening. Genesis's human feedback is what determines your score.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action button — shown when idle */}
      {phase === 'idle' && !open && (
        <button
          onClick={() => { setOpen(true); setUrlError(''); }}
          className="btn btn-primary btn-sm"
          style={{ marginTop: 10 }}
        >
          {isResubmission ? '↩ Submit Revision'
            : hasSubmitted ? 'Update Submission'
            : 'Submit Work →'}
        </button>
      )}

      {/* Submission form */}
      {phase === 'idle' && open && (
        <div style={{ marginTop: 14, padding: '20px', background: 'var(--paper-soft)', border: '1px solid var(--paper-line)', borderRadius: 6 }}>

          {/* Brief */}
          {assignmentBrief && (
            <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--white)', borderRadius: 4, borderLeft: '3px solid var(--amber)' }}>
              <p style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 6 }}>
                Assignment Brief
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                {assignmentBrief}
              </p>
            </div>
          )}

          {/* Resubmission note */}
          {isResubmission && (
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(197,116,58,0.07)', borderRadius: 4 }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                Resubmission #{(existingAssignment?.resubmission_count ?? 0) + 1} — address all of Genesis's feedback before resubmitting.
              </p>
            </div>
          )}

          {/* URL field */}
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
            <p style={{ fontSize: '0.75rem', marginTop: 5, color: urlError ? 'var(--red)' : 'var(--ink-muted)', fontWeight: urlError ? 600 : 400 }}>
              {urlError || 'Paste a Google Doc, Notion, Figma, or Miro link. Set sharing to "Anyone with the link can view".'}
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
              placeholder="Anything specific you'd like Genesis to focus on in their review..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              disabled={!url.trim()}
              onClick={handleSubmit}
              style={{ opacity: !url.trim() ? 0.6 : 1 }}
            >
              {isResubmission ? '↩ Submit Revision'
                : hasSubmitted ? 'Update Submission'
                : 'Submit Assignment →'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setOpen(false); setUrlError(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
