'use client';
export const dynamic = 'force-dynamic';

/**
 * Admin — Module Access.
 *
 * One screen listing every gated module with its current state, a plain-language
 * note about what learners actually see, and a toggle.
 *
 * Turning a module OFF removes access for learners, so it asks for confirmation
 * first. Turning one ON does not — granting access is not the destructive
 * direction, and a confirmation on every click trains people to click through.
 *
 * The toggle is optimistic and rolls back visibly if the server refuses.
 */

import { useCallback, useEffect, useState } from 'react';

interface ModuleMeta {
  key: string;
  label: string;
  group: string;
  whenOn: string;
  whenOff: string;
  presentation: 'absent' | 'locked';
}

interface AccessRow {
  module_key: string;
  cohort: string | null;
  enabled: boolean;
  note: string | null;
  updated_at: string | null;
}

interface AuditRow {
  id: number;
  module_key: string;
  cohort: string | null;
  old_enabled: boolean | null;
  new_enabled: boolean;
  changed_at: string;
}

export default function ModuleAccessPage() {
  const [registry, setRegistry] = useState<ModuleMeta[]>([]);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ModuleMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/module-access');
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || 'Could not load module access.');
      } else {
        setRegistry(data.registry || []);
        setRows(data.rows || []);
        setAudit(data.audit || []);
      }
    } catch {
      setLoadError('Could not reach the server. Check your connection and try again.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Global (cohort-less) state for a module. Unknown means off — fail closed. */
  function stateOf(key: string): boolean {
    const row = rows.find((r) => r.module_key === key && r.cohort === null);
    return row ? row.enabled : false;
  }

  function overridesFor(key: string): AccessRow[] {
    return rows.filter((r) => r.module_key === key && r.cohort !== null);
  }

  async function apply(meta: ModuleMeta, next: boolean) {
    const previous = stateOf(meta.key);
    setSavingKey(meta.key);
    setBanner(null);

    // Optimistic: move the switch now.
    setRows((prev) => {
      const hit = prev.find((r) => r.module_key === meta.key && r.cohort === null);
      if (hit) {
        return prev.map((r) =>
          r.module_key === meta.key && r.cohort === null ? { ...r, enabled: next } : r
        );
      }
      return [...prev, { module_key: meta.key, cohort: null, enabled: next, note: null, updated_at: null }];
    });

    try {
      const res = await fetch('/api/admin/module-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_key: meta.key, enabled: next }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Roll back visibly.
        setRows((prev) =>
          prev.map((r) =>
            r.module_key === meta.key && r.cohort === null ? { ...r, enabled: previous } : r
          )
        );
        setBanner({
          kind: 'err',
          text: `${meta.label} was not changed. ${data.error || 'The server refused the change.'}`,
        });
      } else {
        setBanner({
          kind: 'ok',
          text: next
            ? `${meta.label} is on. Learners will see it within a minute — they do not need to sign out.`
            : `${meta.label} is off. Learners lose access within a minute — they do not need to sign out.`,
        });
        load();
      }
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.module_key === meta.key && r.cohort === null ? { ...r, enabled: previous } : r
        )
      );
      setBanner({ kind: 'err', text: `${meta.label} was not changed — the server could not be reached.` });
    }
    setSavingKey(null);
  }

  function onToggle(meta: ModuleMeta) {
    const current = stateOf(meta.key);
    if (current) {
      // Turning OFF removes learner access — confirm first.
      setConfirming(meta);
    } else {
      apply(meta, true);
    }
  }

  const groups = Array.from(new Set(registry.map((m) => m.group)));
  const enabledCount = registry.filter((m) => stateOf(m.key)).length;

  return (
    <div className="portal-content" style={{ maxWidth: 800 }}>
      <style>{`
        .mod-switch {
          position: relative; width: 46px; height: 26px; flex-shrink: 0;
          border-radius: 13px; border: 1.5px solid var(--paper-line);
          background: var(--paper-soft); cursor: pointer; padding: 0;
          transition: background 150ms, border-color 150ms;
        }
        .mod-switch[aria-checked="true"] { background: var(--moss); border-color: var(--moss); }
        .mod-switch[disabled] { opacity: 0.55; cursor: not-allowed; }
        .mod-switch:focus-visible { outline: 2px solid var(--amber-deep); outline-offset: 2px; }
        .mod-switch .knob {
          position: absolute; top: 2px; left: 2px; width: 19px; height: 19px;
          border-radius: 50%; background: var(--white);
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: transform 150ms;
        }
        .mod-switch[aria-checked="true"] .knob { transform: translateX(20px); }
        .mod-row { display: flex; gap: 16px; align-items: flex-start;
          padding: 18px 0; border-bottom: 1px solid var(--paper-line); }
        .mod-row:last-child { border-bottom: none; }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Module Access</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          Controls which parts of the portal learners can reach. Changes apply within a
          minute — learners do not need to sign out.
        </p>
      </div>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            background: banner.kind === 'ok' ? 'rgba(5,150,105,0.08)' : 'rgba(179,56,44,0.08)',
            border: `1px solid ${banner.kind === 'ok' ? 'rgba(5,150,105,0.25)' : 'rgba(179,56,44,0.25)'}`,
            borderRadius: 6,
            marginBottom: 20,
            color: banner.kind === 'ok' ? 'var(--moss)' : 'var(--red)',
            fontWeight: 600,
          }}
        >
          {banner.kind === 'ok' ? `✓ ${banner.text}` : `⚠ ${banner.text}`}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="card" role="status" aria-live="polite">
          <p style={{ color: 'var(--ink-muted)' }}>Loading module access…</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && loadError && (
        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>
            Module access is not set up yet
          </h2>
          <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 14 }}>{loadError}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 16 }}>
            Until this is fixed every gated module stays switched off for learners. That is
            deliberate — the portal refuses access when it cannot confirm a module is open.
          </p>
          <button onClick={load} className="btn btn-primary">Try again</button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !loadError && registry.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--ink-muted)' }}>No modules are registered. Nothing to configure.</p>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && !loadError && registry.length > 0 && (
        <>
          <div
            className="card"
            style={{ marginBottom: 20, borderLeft: '3px solid var(--amber)', padding: '14px 18px' }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)' }}>
              <strong>{enabledCount} of {registry.length}</strong> modules are open to learners.
            </p>
          </div>

          {groups.map((group) => (
            <div className="card" key={group} style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 4 }}>
                {group}
              </h2>
              <div>
                {registry
                  .filter((m) => m.group === group)
                  .map((meta) => {
                    const on = stateOf(meta.key);
                    const saving = savingKey === meta.key;
                    const overrides = overridesFor(meta.key);
                    return (
                      <div className="mod-row" key={meta.key}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{meta.label}</p>
                            {/* State in words, not colour alone. */}
                            <span
                              style={{
                                fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.1em',
                                textTransform: 'uppercase', padding: '2px 7px', borderRadius: 100,
                                background: on ? 'rgba(79,106,74,0.12)' : 'var(--paper-soft)',
                                color: on ? 'var(--moss)' : 'var(--ink-muted)',
                              }}
                            >
                              {on ? 'On' : 'Off'}
                            </span>
                            {meta.presentation === 'locked' && !on && (
                              <span style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 100, background: 'rgba(197,116,58,0.12)', color: 'var(--amber-deep)' }}>
                                Shown as locked
                              </span>
                            )}
                          </div>
                          <p
                            id={`mod-note-${meta.key}`}
                            style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}
                          >
                            {on ? meta.whenOn : meta.whenOff}
                          </p>
                          {overrides.length > 0 && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', marginTop: 6, fontWeight: 600 }}>
                              Cohort overrides:{' '}
                              {overrides.map((o) => `${o.cohort} — ${o.enabled ? 'on' : 'off'}`).join(', ')}
                            </p>
                          )}
                        </div>
                        <button
                          role="switch"
                          aria-checked={on}
                          aria-label={`${meta.label} — currently ${on ? 'on' : 'off'}`}
                          aria-describedby={`mod-note-${meta.key}`}
                          disabled={saving}
                          onClick={() => onToggle(meta)}
                          className="mod-switch"
                        >
                          <span className="knob" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* ── Audit trail ── */}
          <div className="card">
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 4 }}>
              Recent changes
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
              Every toggle is recorded. This is the last 15.
            </p>
            {audit.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
                No changes recorded yet. Toggle something above and it will appear here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {audit.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                      padding: '10px 14px', background: 'var(--paper-soft)', borderRadius: 6,
                      borderLeft: `3px solid ${a.new_enabled ? 'var(--moss)' : 'var(--ink-muted)'}`,
                    }}
                  >
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      {a.module_key}
                      {a.cohort ? ` · ${a.cohort}` : ''}{' '}
                      <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>
                        {a.old_enabled === null ? 'created as' : `${a.old_enabled ? 'on' : 'off'} →`}{' '}
                        {a.new_enabled ? 'on' : 'off'}
                      </span>
                    </p>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                      {new Date(a.changed_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Confirmation for access removal ── */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(30,27,24,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, zIndex: 50,
          }}
          onClick={() => setConfirming(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 460, width: '100%', margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 10 }}>
              Turn off {confirming.label}?
            </h2>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 10, fontSize: '0.9375rem' }}>
              This removes it for every learner. Here is exactly what they will see:
            </p>
            <p style={{ color: 'var(--ink-muted)', lineHeight: 1.65, marginBottom: 18, fontSize: '0.875rem', padding: '12px 14px', background: 'var(--paper-soft)', borderRadius: 6 }}>
              {confirming.whenOff}
            </p>
            <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 20, fontSize: '0.8125rem' }}>
              Nothing is deleted, and you can turn it back on at any time.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                autoFocus
                onClick={() => {
                  const target = confirming;
                  setConfirming(null);
                  apply(target, false);
                }}
              >
                Turn off {confirming.label}
              </button>
              <button
                className="btn"
                onClick={() => setConfirming(null)}
                style={{ border: '1.5px solid var(--paper-line)', background: 'var(--white)' }}
              >
                Keep it on
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
