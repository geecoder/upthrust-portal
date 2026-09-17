'use client';

// app/portal/capstone/CapstoneArtefacts.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Learner-added evidence, carried over from the retired Portfolio page.
//
// TWO THINGS ARE DIFFERENT FROM THE PAGE THIS REPLACES, both deliberate:
//
//   1. It does not read from the database. The rows arrive as a prop from the
//      server component, and after a write it calls router.refresh() to have
//      the server read them again. The old page read `learners` through the
//      browser anon client, which RLS shows nothing (docs/SCHEMA_DRIFT.md §4),
//      so its `if (!l) return` fired on every load and the page never showed
//      anything to anyone. Reading on the server is what makes it work at all.
//
//   2. The insert it calls actually succeeds now. `portfolio_add` was writing a
//      submitted_at column that does not exist, which is why the table has 0
//      rows in production (D-15, fixed in the same commit as this file).
//
// The required-artefact checklist that also lived on the old page is NOT here.
// It was 12 titles hardcoded per pathway (audit H-50) that no longer match the
// live curriculum, and the page it now lives on derives the same thing from the
// `weeks` rows instead. Hardcoding it again would have been copying a known
// defect into new code.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PortfolioItem } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  Draft: 'var(--ink-muted)',
  Submitted: '#2563EB',
  Approved: 'var(--moss)',
  Featured: 'var(--amber-deep)',
};

interface Props {
  items: PortfolioItem[];
  /** Weeks a learner may tag an artefact against, from the live curriculum. */
  weekOptions: number[];
}

const EMPTY = { title: '', description: '', artefact_type: '', url: '', week_number: '' };

export default function CapstoneArtefacts({ items, weekOptions }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Shown in the page rather than in an alert(). The old page used
        // alert() for every failure, which is how a broken insert went
        // unnoticed for months — a dialog nobody screenshots.
        setError(data.error || 'That did not save. Please try again.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!form.title.trim() || !form.url.trim()) {
      setError('A title and a link are both needed.');
      return;
    }
    const ok = await post({ action: 'portfolio_add', item: form });
    if (ok) {
      setForm(EMPTY);
      setAdding(false);
    }
  }

  async function handleDelete(item: PortfolioItem) {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    await post({ action: 'portfolio_delete', itemId: item.id });
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 14 }}>
        <div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500 }}>Your own evidence</h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', marginTop: 4, lineHeight: 1.55 }}>
            Work you want on record beyond the weekly assignments — a case study, a deck, a write-up.
          </p>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setError(null); }} className="btn btn-outline btn-sm">
            + Add evidence
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 12,
            background: 'rgba(179,56,44,0.06)',
            border: '1px solid rgba(179,56,44,0.25)',
            borderRadius: 6,
            fontSize: '0.875rem',
            color: 'var(--red)',
          }}
        >
          {error}
        </div>
      )}

      {adding && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title — what is this piece of work?"
              style={inputStyle}
            />
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="Link (Google Doc, Notion, Figma, PDF…)"
              style={inputStyle}
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="One or two lines on what it shows (optional)"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={form.artefact_type}
                onChange={(e) => setForm({ ...form, artefact_type: e.target.value })}
                placeholder="Type (e.g. Case Study)"
                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              />
              <select
                value={form.week_number}
                onChange={(e) => setForm({ ...form, week_number: e.target.value })}
                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              >
                <option value="">No particular week</option>
                {weekOptions.map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={handleAdd} disabled={busy} className="btn btn-primary btn-sm">
                {busy ? 'Saving…' : 'Save evidence'}
              </button>
              <button
                onClick={() => { setAdding(false); setForm(EMPTY); setError(null); }}
                disabled={busy}
                className="btn btn-outline btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !adding ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Nothing added yet. Your weekly assignments already count as evidence — this is for anything else.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{item.title}</p>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: STATUS_COLOR[item.status] ?? 'var(--ink-muted)' }}>
                    {item.status}
                  </span>
                  {item.week_number != null && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>Week {item.week_number}</span>
                  )}
                </div>
                {item.description && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.55 }}>
                    {item.description}
                  </p>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}
                  >
                    Open ↗
                  </a>
                )}
              </div>
              <button
                onClick={() => handleDelete(item)}
                disabled={busy}
                className="btn btn-outline btn-sm"
                style={{ flexShrink: 0 }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  border: '1px solid var(--paper-line)',
  borderRadius: 6,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  background: 'var(--white)',
  color: 'var(--ink)',
  width: '100%',
};
