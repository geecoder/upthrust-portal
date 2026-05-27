'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Learner, Attendance } from '@/lib/types';
import { WEEK_DATES } from '@/lib/types';

function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return 0;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}

export default function AttendancePage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const db = createBrowserClient();

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: l }, { data: a }] = await Promise.all([
      db.from('learners').select('*').eq('enrollment_status', 'Active').order('first_name'),
      db.from('attendance').select('*'),
    ]);
    setLearners((l || []) as Learner[]);
    setAttendance((a || []) as Attendance[]);
  }

  function getAttendance(learnerId: string, weekNum: number) {
    return attendance.find(a => a.learner_id === learnerId && a.week_number === weekNum);
  }

  async function markAttendance(learnerId: string, weekNum: number, arrival: string) {
    setSaving(learnerId);
    const existing = getAttendance(learnerId, weekNum);
    const record = {
      learner_id: learnerId,
      week_number: weekNum,
      attended: arrival !== 'Absent',
      arrival,
      session_date: WEEK_DATES.find(w => w.week === weekNum)?.session,
    };
    if (existing) {
      await db.from('attendance').update(record).eq('id', existing.id);
    } else {
      await db.from('attendance').insert(record);
    }
    // Update learner attendance percentage
    const { data: allAttendance } = await db.from('attendance').select('*').eq('learner_id', learnerId);
    const attended = (allAttendance || []).filter((a: any) => a.attended).length;
    const total = Math.max(selectedWeek + 1, 1);
    const pct = Math.round((attended / total) * 100);
    await db.from('learners').update({ attendance_pct: pct }).eq('id', learnerId);
    await load();
    setSaving(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function markAll(arrival: string) {
    setSaving('all');
    for (const learner of learners) {
      const existing = getAttendance(learner.id, selectedWeek);
      const record = {
        learner_id: learner.id, week_number: selectedWeek,
        attended: arrival !== 'Absent', arrival,
      };
      if (existing) await db.from('attendance').update(record).eq('id', existing.id);
      else await db.from('attendance').insert(record);
    }
    await load();
    setSaving(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const weekInfo = WEEK_DATES.find(w => w.week === selectedWeek);
  const weekAttendance = attendance.filter(a => a.week_number === selectedWeek);
  const attendedCount = weekAttendance.filter(a => a.attended).length;

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Attendance Management</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Mark attendance for each session. Updates learner attendance percentages automatically.</p>
      </div>

      {saved && <div style={{ padding: '10px 16px', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 6, marginBottom: 16, color: 'var(--moss)', fontWeight: 600 }}>✓ Attendance saved</div>}

      {/* Week selector */}
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
              <button onClick={() => markAll('On Time')} disabled={saving === 'all'} className="btn btn-primary btn-sm">
                Mark All Present
              </button>
              <button onClick={() => markAll('Absent')} disabled={saving === 'all'} className="btn btn-outline btn-sm">
                Mark All Absent
              </button>
            </div>
          </div>
        </div>
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
              {learners.map(learner => {
                const rec = getAttendance(learner.id, selectedWeek);
                const isSaving = saving === learner.id;
                return (
                  <tr key={learner.id}>
                    <td>
                      <p style={{ fontWeight: 600 }}>{learner.first_name} {learner.last_name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{learner.email}</p>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: learner.pathway === 'PM' ? 'rgba(15,26,46,0.08)' : 'rgba(160,90,38,0.1)', color: learner.pathway === 'PM' ? 'var(--ink)' : 'var(--amber-deep)' }}>
                        {learner.pathway}
                      </span>
                    </td>
                    <td>
                      <p style={{ fontWeight: 600, color: (learner.attendance_pct || 0) >= 75 ? 'var(--moss)' : 'var(--amber-deep)' }}>
                        {learner.attendance_pct ? `${learner.attendance_pct}%` : '0%'}
                      </p>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['On Time', 'Late', 'Absent', 'Excused'] as const).map(status => (
                          <button key={status} onClick={() => markAttendance(learner.id, selectedWeek, status)}
                            disabled={isSaving}
                            style={{
                              padding: '5px 10px', border: `1.5px solid ${rec?.arrival === status ? (status === 'Absent' ? 'var(--red)' : status === 'On Time' ? 'var(--moss)' : status === 'Late' ? 'var(--amber-deep)' : 'var(--ink-muted)') : 'var(--paper-line)'}`,
                              borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                              background: rec?.arrival === status ? (status === 'Absent' ? 'rgba(220,38,38,0.1)' : status === 'On Time' ? 'rgba(5,150,105,0.1)' : status === 'Late' ? 'rgba(217,119,6,0.1)' : 'rgba(107,114,128,0.1)') : 'transparent',
                              color: rec?.arrival === status ? (status === 'Absent' ? 'var(--red)' : status === 'On Time' ? 'var(--moss)' : status === 'Late' ? 'var(--amber-deep)' : 'var(--ink-muted)') : 'var(--ink-muted)',
                              opacity: isSaving ? 0.5 : 1,
                            }}
                          >
                            {status}
                          </button>
                        ))}
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
                        placeholder="Optional note..."
                        onBlur={async (e) => {
                          if (rec) await db.from('attendance').update({ notes: e.target.value }).eq('id', rec.id);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {learners.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-muted)' }}>No active learners to mark attendance for.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
