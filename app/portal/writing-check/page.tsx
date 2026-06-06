'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';

const DOC_TYPES = ['PRD', 'BRD', 'Problem Brief', 'Business Case', 'Process Map Write-up', 'User Stories', 'UAT Pack', 'Stakeholder Map', 'Strategy Canvas', 'Email to stakeholder', 'Other'];

export default function WritingCheckPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [text, setText] = useState('');
  const [docType, setDocType] = useState('PRD');
  const [result, setResult] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ docType: string; score: number; timestamp: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    const db = createBrowserClient();
    db.from('learners').select('*').eq('clerk_user_id', user.id).maybeSingle().then(({ data }) => setLearner(data));
  }, [user]);

  async function runCheck() {
    if (!text.trim() || text.trim().split(/\s+/).length < 30) return;
    setLoading(true);
    setResult('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/writing-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, documentType: docType, pathway: learner?.pathway === 'BA' ? 'BA' : 'PM' })
      });
      const data = await res.json();
      if (!res.ok || !data.result) {
        setErrorMsg(data.error || 'The writing checker could not process this right now. Please try again in a moment.');
        setLoading(false);
        return;
      }
      setResult(data.result);
      setWordCount(data.wordCount || 0);

      const scoreMatch = data.result?.match(/Score:\s*(\d+)\/10/);
      if (scoreMatch) {
        setHistory(h => [{ docType, score: parseInt(scoreMatch[1]), timestamp: new Date().toLocaleTimeString() }, ...h].slice(0, 5));
      }
    } catch {
      setErrorMsg('Network error. Check your connection and try again.');
    }
    setLoading(false);
  }

  const wordCountNow = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>AI Practice Lab</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Writing Quality Checker</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 6, maxWidth: 560, lineHeight: 1.6 }}>
          Paste any written section of your assignment before submitting. Get instant feedback on professional tone, clarity, and precision — specific to product and BA documentation.
        </p>
      </div>

      {/* What this checks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '✂️', title: 'Vague language', desc: '"various", "several", "things", "etc." flagged and rewritten' },
          { icon: '⚡', title: 'Passive voice', desc: 'Identifies weak phrasing and suggests active alternatives' },
          { icon: '📏', title: 'Untestable requirements', desc: '"fast", "user-friendly", "intuitive" — caught and challenged' },
        ].map(item => (
          <div key={item.title} style={{ padding: '14px 16px', background: 'var(--white)', border: '1px solid var(--paper-line)', borderRadius: 6 }}>
            <span style={{ fontSize: '1.25rem', display: 'block', marginBottom: 6 }}>{item.icon}</span>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 3 }}>{item.title}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.4 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Doc type selector */}
          <div className="card">
            <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', display: 'block', marginBottom: 10 }}>
              Document type
            </label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            >
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Text input */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                Paste your text
              </label>
              <span style={{ fontSize: '0.75rem', color: wordCountNow < 30 ? 'var(--red)' : 'var(--moss)' }}>
                {wordCountNow} words {wordCountNow < 30 ? '(need 30+)' : '✓'}
              </span>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Paste a section of your ${docType} here. Works best with 100–600 words — a full section or requirement block.\n\nExample: paste your requirements section, your executive summary, or a specific user story with acceptance criteria.`}
              style={{
                width: '100%', minHeight: 320, padding: '14px',
                border: '1.5px solid var(--paper-line)', borderRadius: 6,
                fontSize: '0.9rem', lineHeight: 1.65,
                fontFamily: 'Manrope, sans-serif', resize: 'vertical',
                outline: 'none', transition: 'border-color 150ms',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--ink)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--paper-line)'; }}
            />

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{wordCountNow} words</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{charCount} chars</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {text && (
                  <button onClick={() => { setText(''); setResult(''); }} className="btn btn-ghost btn-sm">
                    Clear
                  </button>
                )}
                <button
                  onClick={runCheck}
                  disabled={wordCountNow < 30 || loading}
                  className="btn btn-primary"
                  style={{ opacity: wordCountNow < 30 ? 0.4 : 1 }}
                >
                  {loading ? 'Checking...' : 'Check Writing →'}
                </button>
              </div>
            </div>
            {errorMsg && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--red, #C0392B)', marginTop: 12, fontWeight: 600 }}>
                ⚠ {errorMsg}
              </p>
            )}
          </div>

          {/* Tips */}
          <div style={{ padding: '14px 16px', background: 'var(--paper-soft)', border: '1px solid var(--paper-line)', borderRadius: 6 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>Best results</p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, listStyle: 'none' }}>
              {[
                'Paste one section at a time (not the whole document)',
                'Run the check before submitting, not after',
                'Fix the top 3 issues, then run again',
                'Don\'t paste meeting notes — paste polished writing',
              ].map((tip, i) => (
                <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--ink-soft)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--amber)', flexShrink: 0 }}>→</span>{tip}
                </li>
              ))}
            </ul>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="card">
              <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 12 }}>
                This session
              </p>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < history.length - 1 ? '1px solid var(--paper-line)' : 'none' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--ink-soft)' }}>{h.docType} · {h.timestamp}</span>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, color: h.score >= 7 ? 'var(--moss)' : h.score >= 5 ? 'var(--amber-deep)' : 'var(--red)' }}>
                    {h.score}/10
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {loading && (
            <div style={{ padding: '48px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
              <div style={{ width: 36, height: 36, border: '3px solid var(--paper-line)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 700ms linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--ink-muted)', fontFamily: 'Fraunces, serif', fontSize: '1.125rem' }}>Reviewing your writing...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {result && !loading && (
            <div className="card" style={{ borderTop: '3px solid var(--amber)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 16 }}>
                Writing Quality Report · {docType}
              </p>
              <div
                style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{
                  __html: result
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\|(.*)\|/g, (match) => {
                      // Style table rows
                      const cells = match.split('|').filter(c => c.trim() && !c.includes('---'));
                      if (cells.length === 0) return match;
                      return `<div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8px;padding:8px 0;border-bottom:1px solid var(--paper-line);font-size:0.8125rem">${cells.map(c => `<span>${c.trim()}</span>`).join('')}</div>`;
                    })
                }}
              />
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--paper-line)', display: 'flex', gap: 10 }}>
                <button onClick={() => { setResult(''); }} className="btn btn-outline btn-sm">
                  Run Again
                </button>
                <button onClick={() => { setText(''); setResult(''); }} className="btn btn-ghost btn-sm">
                  Check New Text
                </button>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 16 }}>📝</span>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 10 }}>Your results will appear here</p>
              <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6, fontSize: '0.9375rem' }}>
                Paste a section of your work and click Check Writing. The tool gives you a score out of 10, a table of specific issues with rewrites, and the three most important fixes to make.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
