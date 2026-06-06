'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import type { Learner, Attendance } from '@/lib/types';
import { WEEK_DATES } from '@/lib/types';

function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return 0;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}

const ARRIVALS = ['On Time', 'Late', 'Absent', 'Excused'] as const;
type Arrival = typeof ARRIVALS[number];

function arrivalColor(status: string) {
  return status === 'Absent' ? 'var(--red)'
    : status === 'On Time' ? 'var(--moss)'
    : status === 'Late' ? 'var(--amber-deep)'
    : 'var(--ink-muted)';
}
function arrivalBg(status: string) {
  return status === 'Absent' ? 'rgba(220,38,38,0.1)'
    : status === 'On Time' ? 'rgba(5,150,105,0.1)'
    : status === 'Late' ? 'rgba(217,119,6,0.1)'
    : 'rgba(107,114,128,0.1)';
}

export default function AttendancePage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [saving, setSaving] = useState<string | null>(null);   // learnerId | 'all-present' | 'all-absent'
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data?resource=attendance');
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error || 'Could not load learners. Please refresh.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setLearners((data.learners || []) as Learner[]);
      setAttendance((data.attendance || []) as Attendance[]);
      setError('');
    } catch {
      setError('Network error loading attendance. Please refresh.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function getAttendance(learnerId: string, weekNum: number) {
    return attendance.find(a => a.learner_id === learnerId && a.week_number === weekNum);
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function markAttendance(learnerId: string, weekNum: number, arrival: Arrival) {
    setSaving(learnerId);
    setError('');
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_attendance',
          learnerId,
          weekNumber: weekNum,
          arrival,
          sessionDate: WEEK_DATES.find(w => w.week === weekNum)?.session || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error || 'Could not save attendance. Please try again.');
        setSaving(null);
        return;
      }
      await load();
      flashSaved();
    } catch {
      setError('Network error. Please try again.');
    }
    setSaving(null);
  }

  async function markAll(arrival: Arrival) {
    setSaving(arrival === 'Absent' ? 'all-absent' : 'all-present');
    setError('');
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_all_attendance',
          weekNumber: selectedWeek,
          arrival,
          sessionDate: WEEK_DATES.find(w => w.week === selectedWeek)?.session || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error || 'Could not mark all. Please try again.');
        setSaving(null);
        return;
      }
      await load();
      flashSaved();
    } catch {
      setError('Network error. Please try again.');
    }
    setSaving(null);
  }

  async function saveNote(learnerId: string, weekNum: number, note: string) {
    try {
      await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_attendance_note', learnerId, weekNumber: weekNum, note }),
      });
      await load();
    } catch {
      setError('Could not save note.');
    }
  }

  const weekAttendance = attendance.filter(a => a.week_number === selectedWeek);
  const attendedCount = weekAttendance.filter(a => a.attended).length;
  const markedCount = weekAttendance.length;
  const allBusy = saving === 'all-present' || saving === 'all-absent';

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Attendance Management</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Mark attendance for each session. Updates learner attendance percentages automatically.</p>
      </div>

      {saved && <div style={{ padding: '10px 16px', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 6, marginBottom: 16, color: 'var(--moss)', fontWeight: 600 }}>✓ Attendance saved</div>}
      {error && <div style={{ padding: '10px 16px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, marginBottom: 16, color: 'var(--red)', fontWeight: 600 }}>⚠ {error}</div>}

      {/* Week selector + summary + bulk actions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Session</p>
            <select className="form-input" value={selectedWeek} onChange={e => setSelectedWeek(parseInt(e.target.value))} style={{ width: 'auto' }}>
              {WEEK_DATES.map(w => (
                <option key={w.week} value={w.week}>Week {w.week} — {w.session}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', fontWeight: 500, color: 'var(--moss)' }}>{attendedCount}/{learners.length}</p>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Attended</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => markAll('On Time')} disabled={allBusy || learners.length === 0} className="btn btn-primary btn-sm">
                {saving === 'all-present' ? 'Marking…' : 'Mark All Present'}
              </button>
              <button onClick={() => markAll('Absent')} disabled={allBusy || learners.length === 0} className="btn btn-outline btn-sm">
                {saving === 'all-absent' ? 'Marking…' : 'Mark All Absent'}
              </button>
            </div>
          </div>
        </div>
        {markedCount > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 10 }}>
            {markedCount} of {learners.length} marked for this session.
          </p>
        )}
      </div>

      {/* Attendance table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Pathway</th>
                <th>Overall Attendance</th>
                <th>This Session</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-muted)' }}>Loading learners…</td></tr>
              )}
              {!loading && learners.map(learner => {
                const rec = getAttendance(learner.id, selectedWeek);
                const isSaving = saving === learner.id;
                return (
                  <tr key={learner.id} style={{ opacity: isSaving ? 0.6 : 1 }}>
                    <td>
                      <p style={{ fontWeight: 600 }}>{learner.first_name} {learner.last_name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{learner.email}</p>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: learner.pathway === 'PM' ? 'rgba(15,26,46,0.08)' : 'rgba(160,90,38,0.1)', color: learner.pathway === 'PM' ? 'var(--ink)' : 'var(--amber-deep)' }}>
                        {learner.pathway || '—'}
                      </span>
                    </td>
                    <td>
                      <p style={{ fontWeight: 600, color: (learner.attendance_pct || 0) >= 75 ? 'var(--moss)' : 'var(--amber-deep)' }}>
                        {learner.attendance_pct ? `${learner.attendance_pct}%` : '0%'}
                      </p>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ARRIVALS.map(status => {
                          const active = rec?.arrival === status;
                          return (
                            <button key={status} onClick={() => markAttendance(learner.id, selectedWeek, status)}
                              disabled={isSaving}
                              style={{
                                padding: '6px 11px', minHeight: 32,
                                border: `1.5px solid ${active ? arrivalColor(status) : 'var(--paper-line)'}`,
                                borderRadius: 4, cursor: isSaving ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                background: active ? arrivalBg(status) : 'transparent',
                                color: active ? arrivalColor(status) : 'var(--ink-muted)',
                              }}
                            >
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      {rec ? (
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: rec.attended ? 'var(--moss)' : 'var(--red)' }}>
                          {rec.attended ? '✓ Present' : '✗ Absent'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Not marked</span>
                      )}
                    </td>
                    <td>
                      <input
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        defaultValue={rec?.notes || ''}
                        key={`${learner.id}-${selectedWeek}-${rec?.notes || ''}`}
                        placeholder="Optional note..."
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (rec?.notes || '')) saveNote(learner.id, selectedWeek, v);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {!loading && learners.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-muted)' }}>
                  No learners found. Add learners under Admin → All Learners, or check that they aren&apos;t marked Withdrawn.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
