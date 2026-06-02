'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';

type Message = { role: 'user' | 'assistant'; content: string };
type Character = {
  id: string; name: string; role: string; company: string;
  context: string; difficulty: string; pathway: string; openingLine: string;
};

const DIFF_COLOR: Record<string, string> = {
  Intermediate: 'var(--amber-deep)',
  Advanced: 'var(--red)',
};

export default function SimulationPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selected, setSelected] = useState<Character | null>(null);
  const [phase, setPhase] = useState<'select' | 'brief' | 'sim' | 'debrief'>('select');
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debrief, setDebrief] = useState('');
  const [turnCount, setTurnCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    const db = createBrowserClient();
    db.from('learners').select('*').eq('clerk_user_id', user.id).maybeSingle().then(({ data }) => setLearner(data));
    fetch('/api/simulation').then(r => r.json()).then(d => setCharacters(d.characters || []));
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, debrief]);

  async function startSim(char: Character) {
    setSelected(char);
    setPhase('brief');
  }

  async function beginConversation() {
    if (!selected) return;
    setPhase('sim');
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selected.id, messages: [], mode: 'simulate' })
      });
      const data = await res.json();
      if (!res.ok || !data.reply) {
        setErrorMsg(data.error || 'Could not start the simulation. Please try again.');
        setLoading(false);
        return;
      }
      setMessages([{ role: 'assistant', content: data.reply }]);
    } catch {
      setErrorMsg('Network error. Check your connection and try again.');
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function sendMessage() {
    if (!input.trim() || !selected || loading) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setTurnCount(t => t + 1);
    setLoading(true);

    setErrorMsg('');
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selected.id, messages: newMessages, mode: 'simulate' })
      });
      const data = await res.json();
      if (!res.ok || !data.reply) {
        setErrorMsg(data.error || 'The character did not respond. Please try again.');
        setLoading(false);
        return;
      }
      if (data.isComplete || data.reply === '[SIMULATION_COMPLETE]') {
        await getDebrief(newMessages);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        setLoading(false);
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setLoading(false);
    }
  }

  async function getDebrief(msgs: Message[]) {
    setPhase('debrief');
    setLoading(true);
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selected!.id, messages: msgs, mode: 'debrief' })
      });
      const data = await res.json();
      setDebrief(data.debrief || data.error || 'Could not generate debrief. Your conversation is still saved.');
    } catch {
      setDebrief('Network error generating debrief. Please try again.');
    }
    setLoading(false);
  }

  function reset() {
    setSelected(null);
    setPhase('select');
    setMessages([]);
    setInput('');
    setDebrief('');
    setTurnCount(0);
  }

  const pathway = learner?.pathway || 'PM';
  const filteredChars = characters.filter(c =>
    c.pathway === 'Both' || c.pathway === pathway
  );

  // ── SELECT PHASE ────────────────────────────────────────────────────────────
  if (phase === 'select') return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>AI Practice Lab</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Stakeholder Simulations</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 6, maxWidth: 560, lineHeight: 1.6 }}>
          Practise real stakeholder conversations before they happen in the real world. Each character is based on archetypes you'll encounter in product and BA roles across Africa and the UK.
        </p>
      </div>

      <div style={{ padding: '12px 16px', background: 'rgba(197,116,58,0.08)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.1rem' }}>💡</span>
        <p style={{ fontSize: '0.875rem', color: 'var(--amber-deep)', lineHeight: 1.55 }}>
          Type naturally as you would in a real conversation. When you're ready to end the simulation, type <strong>END</strong> to get your coaching debrief. Aim for at least 6 exchanges to get useful feedback.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {filteredChars.map(char => (
          <button key={char.id} onClick={() => startSim(char)} style={{
            textAlign: 'left', background: 'var(--white)', border: '1px solid var(--paper-line)',
            borderRadius: 8, padding: 0, cursor: 'pointer', transition: 'box-shadow 200ms, border-color 200ms',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px -8px rgba(15,26,46,0.15)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--ink)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--paper-line)';
          }}
          >
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--paper-line)', background: 'var(--paper-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, flexShrink: 0 }}>
                  {char.name.charAt(0)}
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 100, background: `${DIFF_COLOR[char.difficulty]}15`, color: DIFF_COLOR[char.difficulty] }}>
                  {char.difficulty}
                </span>
              </div>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 500, marginBottom: 3 }}>{char.name}</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600, marginBottom: 2 }}>{char.role}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{char.company}</p>
            </div>
            {/* Context */}
            <div style={{ padding: '14px 20px' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{char.context}</p>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                  {char.pathway === 'Both' ? 'PM + BA' : char.pathway} pathway
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--ink)', fontWeight: 700 }}>Start →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── BRIEF PHASE ─────────────────────────────────────────────────────────────
  if (phase === 'brief' && selected) return (
    <div className="portal-content" style={{ maxWidth: 680 }}>
      <button onClick={reset} style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 24, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back to simulations
      </button>

      <div style={{ padding: '28px', background: 'var(--ink)', borderRadius: 8, marginBottom: 24, color: 'var(--paper)' }}>
        <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.45)', marginBottom: 12 }}>
          Your scenario
        </p>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 6, color: 'var(--paper)' }}>
          {selected.name}
        </h2>
        <p style={{ color: 'var(--amber-soft)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 16 }}>
          {selected.role} · {selected.company}
        </p>
        <p style={{ color: 'rgba(250,247,241,0.8)', lineHeight: 1.65, fontSize: '0.9375rem' }}>
          {selected.context}
        </p>
      </div>

      <div style={{ padding: '20px', background: 'var(--paper-soft)', border: '1px solid var(--paper-line)', borderRadius: 6, marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 }}>
          What to aim for in this simulation
        </p>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none' }}>
          {[
            'Respond as you would in a real workplace conversation',
            'Try to uncover what the stakeholder actually needs, not just what they say',
            'Hold your ground when challenged, but stay professional',
            'Ask good questions — don\'t just react',
            'When you\'re ready for feedback, type END',
          ].map((tip, i) => (
            <li key={i} style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--amber)', flexShrink: 0 }}>→</span>{tip}
            </li>
          ))}
        </ul>
      </div>

      <button onClick={beginConversation} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}>
        Begin Simulation →
      </button>
    </div>
  );

  // ── SIMULATION PHASE ────────────────────────────────────────────────────────
  if (phase === 'sim' && selected) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-h))', padding: '0' }}>

      {/* Chat header */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--paper-line)', background: 'var(--white)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, flexShrink: 0 }}>
            {selected.name.charAt(0)}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{selected.name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{selected.role} · {selected.company.split('—')[0].trim()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{turnCount} exchanges</span>
          <button
            onClick={() => getDebrief(messages)}
            className="btn btn-outline btn-sm"
            disabled={messages.length < 4}
            style={{ opacity: messages.length < 4 ? 0.4 : 1 }}
          >
            End & Get Feedback
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, background: '#F8F5EF' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            gap: 10,
            alignItems: 'flex-end',
          }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', fontSize: '0.875rem', fontWeight: 700, flexShrink: 0, marginBottom: 2 }}>
                {selected.name.charAt(0)}
              </div>
            )}
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
              background: msg.role === 'user' ? 'var(--ink)' : 'var(--white)',
              color: msg.role === 'user' ? 'var(--paper)' : 'var(--ink)',
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid var(--paper-line)' : 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', fontSize: '0.875rem', fontWeight: 700, flexShrink: 0 }}>
              {selected.name.charAt(0)}
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--white)', borderRadius: '4px 14px 14px 14px', border: '1px solid var(--paper-line)', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-muted)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 28px', background: 'var(--white)', borderTop: '1px solid var(--paper-line)', flexShrink: 0 }}>
        {errorMsg && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(179,56,44,0.08)', border: '1px solid rgba(179,56,44,0.25)', borderRadius: 6, color: 'var(--red)', fontSize: '0.8125rem', fontWeight: 600 }}>
            ⚠ {errorMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="Type your response... (Enter to send, Shift+Enter for new line)"
            style={{
              flex: 1, padding: '10px 14px',
              border: '1.5px solid var(--paper-line)', borderRadius: 8,
              fontSize: '0.9375rem', lineHeight: 1.55,
              resize: 'none', minHeight: 48, maxHeight: 140,
              fontFamily: 'Manrope, sans-serif',
              outline: 'none', transition: 'border-color 150ms',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--ink)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--paper-line)'; }}
            rows={2}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="btn btn-primary"
            style={{ padding: '10px 16px', flexShrink: 0, opacity: (!input.trim() || loading) ? 0.4 : 1 }}
          >
            Send
          </button>
        </div>
        <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 8 }}>
          Type <strong>END</strong> or click "End & Get Feedback" when you're ready for your coaching debrief.
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );

  // ── DEBRIEF PHASE ───────────────────────────────────────────────────────────
  if (phase === 'debrief') return (
    <div className="portal-content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
          Coaching Debrief
        </p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
          Your simulation with {selected?.name}
        </h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          {turnCount} exchanges · {selected?.role}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--paper-line)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 700ms linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-muted)', fontFamily: 'Fraunces, serif', fontSize: '1.125rem' }}>Analysing your conversation...</p>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', marginTop: 6 }}>This takes about 10 seconds</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          <div style={{ padding: '24px 28px', background: 'var(--white)', border: '1px solid var(--paper-line)', borderRadius: 8, marginBottom: 20 }}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9375rem', lineHeight: 1.75, color: 'var(--ink-soft)' }}
              dangerouslySetInnerHTML={{ __html: debrief.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
            />
          </div>

          {/* Conversation replay */}
          <details style={{ marginBottom: 20 }}>
            <summary style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink-muted)', cursor: 'pointer', padding: '12px 16px', background: 'var(--paper-soft)', borderRadius: 6, listStyle: 'none' }}>
              View conversation transcript
            </summary>
            <div style={{ padding: '16px', background: 'var(--paper-soft)', borderRadius: '0 0 6px 6px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ padding: '10px 14px', borderRadius: 6, background: msg.role === 'user' ? 'rgba(15,26,46,0.08)' : 'var(--white)', fontSize: '0.875rem', lineHeight: 1.55 }}>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 4 }}>
                    {msg.role === 'user' ? 'You' : selected?.name}
                  </p>
                  {msg.content}
                </div>
              ))}
            </div>
          </details>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={reset} className="btn btn-primary">Try Another Scenario</button>
            <button onClick={() => { setPhase('sim'); setLoading(false); }} className="btn btn-outline">Replay This Scenario</button>
          </div>
        </>
      )}
    </div>
  );

  return null;
}
