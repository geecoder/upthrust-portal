'use client';

// app/admin/modules/ScopeEditor.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Per-cohort and per-learner control for one module.
//
// The module row above this gives the GLOBAL default. This panel is the two
// narrower scopes: a cohort exception to the global, and a learner exception to
// their cohort. Most specific wins — the same precedence the server applies, and
// computed here with the same pure function (explainFromRows), so the screen
// and the runtime can never disagree about who won.
//
// ── WHY EACH CONTROL IS A TRI-STATE, NOT A SWITCH ───────────────────────────
// Inherit / On / Off, not on/off. Without "Inherit" there is no way to express
// "no opinion at this level", so an admin who set a learner override could
// never take it back — the row would sit there forever, silently overriding
// every future cohort change. Inherit DELETES the row, which is what makes the
// decision reversible.
//
// Each control therefore shows two things: what is set HERE, and what the
// learner actually GETS once precedence is applied. Those differ constantly —
// "Inherit → On (from cohort)" is the common case — and showing only one of
// them is how an admin ends up believing they switched something off.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { explainFromRows, type ModuleAccessRow, type ModuleKey } from '@/lib/module-access-rules';

export interface RosterLearner {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  cohort: string | null;
  pathway: string | null;
}

type Tri = 'inherit' | 'on' | 'off';

interface Props {
  moduleKey: ModuleKey;
  label: string;
  rows: ModuleAccessRow[];
  learners: RosterLearner[];
  /** Ask the parent to re-read from the server after a successful write. */
  onChanged: () => void;
  /** Surface an error in the parent's banner. */
  onError: (message: string) => void;
}

function learnerName(l: RosterLearner): string {
  const name = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim();
  return name || l.email || '(unnamed learner)';
}

export default function ScopeEditor({ moduleKey, label, rows, learners, onChanged, onError }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const cohorts = useMemo(() => {
    const seen = new Map<string, number>();
    for (const l of learners) {
      const c = (l.cohort ?? '').trim();
      if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [learners]);

  const forModule = useMemo(() => rows.filter((r) => r.module_key === moduleKey), [rows, moduleKey]);

  /** What is explicitly set at this exact scope, if anything. */
  function setAt(scope: { cohort?: string | null; learnerId?: string | null }): Tri {
    const row = forModule.find((r) =>
      scope.learnerId
        ? r.learner_id === scope.learnerId
        : r.learner_id == null && (scope.cohort ?? null) === r.cohort
    );
    if (!row) return 'inherit';
    return row.enabled ? 'on' : 'off';
  }

  /** What a learner in this scope actually gets, and which row decided it. */
  function effective(scope: { cohort?: string | null; learnerId?: string | null }) {
    return explainFromRows(forModule, moduleKey, scope);
  }

  async function write(
    scope: { cohort?: string | null; learnerId?: string | null },
    next: Tri,
    busyKey: string
  ) {
    setBusy(busyKey);
    try {
      const res = await fetch('/api/admin/module-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_key: moduleKey,
          // null clears the row so this scope inherits again.
          enabled: next === 'inherit' ? null : next === 'on',
          ...(scope.learnerId ? { learner_id: scope.learnerId } : {}),
          ...(scope.cohort ? { cohort: scope.cohort } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || 'Could not save that change.');
        return;
      }
      onChanged();
    } catch {
      onError('Could not reach the server. Nothing was changed.');
    } finally {
      setBusy(null);
    }
  }

  function TriControl({
    value,
    busyKey,
    onPick,
  }: {
    value: Tri;
    busyKey: string;
    onPick: (next: Tri) => void;
  }) {
    const disabled = busy !== null;
    const options: Array<{ v: Tri; text: string }> = [
      { v: 'inherit', text: 'Inherit' },
      { v: 'on', text: 'On' },
      { v: 'off', text: 'Off' },
    ];
    return (
      <div className="tri" role="group" aria-label={`${label} for this scope`}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            disabled={disabled}
            onClick={() => value !== o.v && onPick(o.v)}
            data-state={o.v}
          >
            {busy === busyKey && value !== o.v ? '…' : o.text}
          </button>
        ))}
      </div>
    );
  }

  /** "On (from cohort)" — the outcome plus which scope produced it. */
  function Outcome({ scope }: { scope: { cohort?: string | null; learnerId?: string | null } }) {
    const { enabled, source } = effective(scope);
    const from =
      source === 'learner' ? 'set here' : source === 'cohort' ? 'from cohort' : source === 'global' ? 'from global' : 'nothing set';
    return (
      <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700, color: enabled ? 'var(--moss)' : 'var(--ink-muted)' }}>
          {enabled ? 'Sees it' : 'Does not'}
        </span>
        <span style={{ color: 'var(--ink-muted)' }}> · {from}</span>
      </span>
    );
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--paper-line)', paddingTop: 14 }}>
      <style>{`
        .tri { display: inline-flex; border: 1px solid var(--paper-line); border-radius: 6px; overflow: hidden; }
        .tri button {
          font: inherit; font-size: 0.6875rem; font-weight: 700; padding: 4px 10px;
          background: var(--white); color: var(--ink-muted); border: none; cursor: pointer;
          border-right: 1px solid var(--paper-line); min-width: 54px;
        }
        .tri button:last-child { border-right: none; }
        .tri button[aria-pressed="true"][data-state="on"]  { background: var(--moss); color: var(--paper); }
        .tri button[aria-pressed="true"][data-state="off"] { background: var(--red); color: var(--paper); }
        .tri button[aria-pressed="true"][data-state="inherit"] { background: var(--paper-soft); color: var(--ink); }
        .tri button[disabled] { opacity: 0.55; cursor: not-allowed; }
        .tri button:focus-visible { outline: 2px solid var(--amber-deep); outline-offset: -2px; }
        .scope-line {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 7px 0; flex-wrap: wrap;
        }
        .scope-line + .scope-line { border-top: 1px dashed var(--paper-line); }
      `}</style>

      {cohorts.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
          No learners with a cohort, so there is nothing narrower than the global setting to
          configure yet.
        </p>
      ) : (
        cohorts.map(([cohort, count]) => {
          const cohortBusyKey = `${cohort}::cohort`;
          const inCohort = learners.filter((l) => (l.cohort ?? '').trim() === cohort);
          return (
            <div key={cohort} style={{ marginBottom: 18 }}>
              <div className="scope-line" style={{ borderTop: 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{cohort}</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                    {count} learner{count === 1 ? '' : 's'} · applies to everyone in the cohort
                    unless set for them individually
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Outcome scope={{ cohort }} />
                  <TriControl
                    value={setAt({ cohort })}
                    busyKey={cohortBusyKey}
                    onPick={(next) => write({ cohort }, next, cohortBusyKey)}
                  />
                </div>
              </div>

              <div style={{ paddingLeft: 16, marginTop: 4 }}>
                {inCohort.map((l) => {
                  const key = `${cohort}::${l.id}`;
                  const at = setAt({ learnerId: l.id });
                  return (
                    <div className="scope-line" key={l.id}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.8125rem' }}>
                          {learnerName(l)}
                          {at !== 'inherit' && (
                            <span
                              style={{
                                marginLeft: 8, fontSize: '0.5625rem', fontWeight: 800,
                                letterSpacing: '0.08em', textTransform: 'uppercase',
                                padding: '1px 6px', borderRadius: 100,
                                background: 'rgba(197,116,58,0.12)', color: 'var(--amber-deep)',
                              }}
                            >
                              Exception
                            </span>
                          )}
                        </p>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                          {l.pathway ?? '—'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Outcome scope={{ cohort, learnerId: l.id }} />
                        <TriControl
                          value={at}
                          busyKey={key}
                          onPick={(next) => write({ learnerId: l.id }, next, key)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', lineHeight: 1.6, marginTop: 4 }}>
        A learner set to <strong>Inherit</strong> follows their cohort; a cohort set to{' '}
        <strong>Inherit</strong> follows the global setting above. Changes reach a learner within
        a minute without them signing out.
      </p>
    </div>
  );
}
