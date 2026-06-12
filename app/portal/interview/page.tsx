'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';

type Question = { id: string; question: string; category: string; };
type Result = { evaluation: string; modelAnswer: string; };

const CATEGORY_COLOR: Record<string, string> = {
  Behavioural: 'var(--ink)',
  Technical: 'var(--amber-deep)',
  Commercial: 'var(--moss)',
};

export default function InterviewPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [selected, setSelected] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [history, setHistory] = useState<{ question: string; score: number }[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user) return;
    const db = createBrowserClient();
    db.from('learners').select('*').eq('clerk_user_id', user.id).maybeSingle().then(({ data }) => {
      setLearner(data);
      if (data?.pathway) loadQuestions(data.pathway, 'all');
    });
  }, [user]);

  function loadQuestions(pathway: string, cat: string) {
    setLoadError('');
    fetch(`/api/interview?pathway=${pathway}&category=${cat}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setLoadError('Could not load questions. Please refresh.'); setQuestions([]); }
        else setQuestions(d.questions || []);
      })
      .catch(() => setLoadError('Network error loading questions. Please refresh.'));
  }

  function selectQuestion(q: Question) {
    setSelected(q);
    setAnswer('');
    setResult(null);
    setShowModel(false);
    setErrorMsg('');
  }

  async function submitAnswer() {
    if (!selected || !answer.trim() || !learner) return;
    setLoading(true);
    setErrorMsg('');
    // Derive pathway from the QUESTION being answered, not the learner record.
    // Question IDs are prefixed 'pm-' or 'ba-'; this guarantees the API loads
    // the same bank the question came from (prevents "Question not found" 404s).
    const questionPathway = selected.id.startsWith('ba-') ? 'BA'
      : selected.id.startsWith('pm-') ? 'PM'
      : (learner.pathway === 'BA' ? 'BA' : 'PM');
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathway: questionPathway,
          questionId: selected.id,
          userAnswer: answer,
          mode: 'evaluate'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.evaluation) {
        setErrorMsg(data.error || 'The coach could not evaluate your answer right now. Please try again in a moment.');
        setLoading(false);
        return;
      }
      setResult(data);

      // Extract score from evaluation
      const scoreMatch = data.evaluation?.match(/Score:\s*(\d+)\/100/);
      if (scoreMatch) {
        setHistory(h => [...h, { question: selected.question.substring(0, 60) + '...', score: parseInt(scoreMatch[1]) }]);
      }
    } catch {
      setErrorMsg('Network error. Check your connection and try again.');
    }
    setLoading(false);
  }

  function nextQuestion() {
    const filtered = category === 'all' ? questions : questions.filter(q => q.category === category);
    const currentIdx = filtered.findIndex(q => q.id === selected?.id);
    const next = filtered[(currentIdx + 1) % filtered.length];
    if (next) selectQuestion(next);
  }

  const pathway = learner?.pathway === 'BA' ? 'BA' : learner?.pathway === 'PM' ? 'PM' : null;
  const filtered = category === 'all' ? questions : questions.filter(q => q.category === category);

  // Wait until we know the learner's pathway before showing PM/BA-specific
  // content — prevents a BA learner from briefly seeing PM questions.
  if (learner && !pathway) {
    return (
      <div className="portal-content">
        <div style={{ padding: '48px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>🧭</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>Your pathway isn't set yet</p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            We need to assign you to the PM or BA track before the Interview Coach can load the right questions. Email{' '}
            <a href="mailto:info@upthrustdigital.com" style={{ color: 'var(--amber-deep)', fontWeight: 600 }}>info@upthrustdigital.com</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>AI Practice Lab</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Interview Coach</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.6 }}>
          Practise real {pathway || ''} interview questions and get scored feedback with model answers. Based on what actual hiring managers assess for.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: question list */}
        <div className="card" style={{ padding: 0, position: 'sticky', top: 'calc(var(--header-h) + 20px)' }}>
          {/* Category filter */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--paper-line)' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 }}>Filter by type</p>
            {['all', 'Behavioural', 'Technical', 'Commercial'].map(cat => (
              <button key={cat} onClick={() => { setCategory(cat); setSelected(null); setAnswer(''); setResult(null); setShowModel(false); loadQuestions(pathway!, cat === 'all' ? 'all' : cat.toLowerCase()); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 10px', borderRadius: 4, marginBottom: 2,
                  background: category === cat ? 'var(--paper-soft)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: '0.875rem',
                  fontWeight: category === cat ? 700 : 400,
                  color: cat === 'all' ? 'var(--ink)' : CATEGORY_COLOR[cat] || 'var(--ink)',
                }}>
                {cat === 'all' ? '📋 All Questions' : `${cat === 'Behavioural' ? '💬' : cat === 'Technical' ? '🔧' : '💼'} ${cat}`}
              </button>
            ))}
          </div>

          {/* Question list */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {loadError && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--red, #C0392B)', padding: '12px 16px', fontWeight: 600 }}>
                ⚠ {loadError}
              </p>
            )}
            {filtered.map(q => (
              <button key={q.id} onClick={() => selectQuestion(q)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px 16px',
                background: selected?.id === q.id ? 'var(--paper-soft)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--paper-line)',
                cursor: 'pointer', transition: 'background 150ms',
                borderLeft: selected?.id === q.id ? '3px solid var(--amber)' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: CATEGORY_COLOR[q.category] }}>
                    {q.category}
                  </span>
                  {history.find(h => h.question.startsWith(q.question.substring(0, 30))) && (
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--moss)' }}>✓ Done</span>
                  )}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ink)', lineHeight: 1.4, fontWeight: selected?.id === q.id ? 600 : 400 }}>
                  {q.question.length > 80 ? q.question.substring(0, 80) + '...' : q.question}
                </p>
              </button>
            ))}
          </div>

          {/* Session stats */}
          {history.length > 0 && (
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--paper-line)', background: 'var(--paper-soft)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>
                Session
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500 }}>{history.length}</p>
                  <p style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)' }}>Answered</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, color: 'var(--amber-deep)' }}>
                    {Math.round(history.reduce((s, h) => s + h.score, 0) / history.length)}
                  </p>
                  <p style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)' }}>Avg Score</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: question + answer area */}
        <div>
          {!selected ? (
            <div style={{ padding: '48px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
              <p style={{ fontSize: '2rem', marginBottom: 12 }}>💬</p>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>Select a question to begin</p>
              <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
                Choose any question from the list. Write your answer as if you're in a real interview — don't use bullet points, speak in complete sentences.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Question card */}
              <div className="card" style={{ borderTop: `3px solid ${CATEGORY_COLOR[selected.category]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: CATEGORY_COLOR[selected.category] }}>
                    {selected.category} Question
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{pathway} Pathway</span>
                </div>
                <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1875rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '-0.01em' }}>
                  {selected.question}
                </p>
              </div>

              {/* Answer area */}
              {!result && (
                <div className="card">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', display: 'block', marginBottom: 10 }}>
                    Your Answer
                  </label>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginBottom: 14, lineHeight: 1.55 }}>
                    Write as if speaking aloud in an interview. Complete sentences. No bullet points. Take your time — there's no timer in practice mode.
                  </p>
                  <textarea
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    style={{
                      width: '100%', minHeight: 200, padding: '14px',
                      border: '1.5px solid var(--paper-line)', borderRadius: 6,
                      fontSize: '0.9375rem', lineHeight: 1.65,
                      fontFamily: 'Manrope, sans-serif', resize: 'vertical',
                      outline: 'none', transition: 'border-color 150ms',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--ink)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--paper-line)'; }}
                  />
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                      {answer.trim().split(/\s+/).filter(Boolean).length} words
                    </p>
                    <button
                      onClick={submitAnswer}
                      disabled={answer.trim().split(/\s+/).length < 20 || loading}
                      className="btn btn-primary"
                      style={{ opacity: answer.trim().split(/\s+/).length < 20 ? 0.4 : 1 }}
                    >
                      {loading ? 'Evaluating...' : 'Get Feedback →'}
                    </button>
                  </div>
                  {answer.trim().split(/\s+/).length < 20 && answer.length > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', marginTop: 6 }}>
                      Write at least 20 words for meaningful feedback
                    </p>
                  )}
                  {errorMsg && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--red, #C0392B)', marginTop: 10, fontWeight: 600 }}>
                      ⚠ {errorMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid var(--paper-line)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 700ms linear infinite', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--ink-muted)' }}>Evaluating your answer...</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Result */}
              {result && !loading && (
                <>
                  <div className="card" style={{ borderTop: '3px solid var(--amber)' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 14 }}>
                      Interview Coach Feedback
                    </p>
                    <div
                      style={{ fontSize: '0.9375rem', lineHeight: 1.75, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{ __html: (result.evaluation || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                    />
                  </div>

                  {/* Your answer recap */}
                  <div className="card" style={{ background: 'var(--paper-soft)' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 }}>Your answer</p>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--ink-soft)', fontStyle: 'italic' }}>"{answer}"</p>
                  </div>

                  {/* Model answer toggle */}
                  <div className="card">
                    <button
                      onClick={() => setShowModel(s => !s)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)' }}>
                        {showModel ? 'Hide' : 'Show'} model answer guidance
                      </p>
                      <span style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>{showModel ? '▲' : '▼'}</span>
                    </button>
                    {showModel && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--paper-line)' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 }}>
                          What a strong answer looks like
                        </p>
                        <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--ink-soft)' }}>{result.modelAnswer}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={nextQuestion} className="btn btn-primary">Next Question →</button>
                    <button onClick={() => { setResult(null); setAnswer(''); setShowModel(false); }} className="btn btn-outline">Retry This Question</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
