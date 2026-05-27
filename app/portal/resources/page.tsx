'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { Resource } from '@/lib/types';
import { WEEK_DATES } from '@/lib/types';

const TYPE_ICON: Record<string, string> = {
  Template: '📄', Example: '✅', Reading: '📖', Tool: '🔧', Video: '🎬', Guide: '📋', 'AI Prompt': '⚡'
};

const TYPE_COLOR: Record<string, string> = {
  Template: 'var(--ink)', Example: 'var(--moss)', Reading: 'var(--amber-deep)', Tool: '#2563EB',
  Video: '#7C3AED', Guide: 'var(--amber)', 'AI Prompt': '#6D28D9'
};

function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return 0;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}

export default function ResourcesPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterWeek, setFilterWeek] = useState<string>('all');
  const [filterPathway, setFilterPathway] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const db = createBrowserClient();
  const currentWeek = getCurrentWeek();

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: l } = await db.from('learners').select('*').eq('clerk_user_id', user!.id).maybeSingle();
      setLearner(l);
      const { data: r } = await db.from('resources').select('*').eq('is_active', true).order('is_featured', { ascending: false }).order('title');
      setResources((r || []) as Resource[]);
      setLoading(false);
    }
    load();
  }, [user]);

  const filtered = resources.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.tags || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.assignment_context || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || r.resource_type === filterType;
    const matchWeek = filterWeek === 'all' || r.week_number?.toString() === filterWeek || (!r.week_number && filterWeek === 'general');
    const matchPathway = filterPathway === 'all' || r.pathway === filterPathway || r.pathway === 'Both';
    return matchSearch && matchType && matchWeek && matchPathway;
  });

  // Group featured separately
  const featured = filtered.filter(r => r.is_featured && filterWeek === 'all' && !search);
  const rest = filtered.filter(r => !featured.includes(r));
  const thisWeekResources = resources.filter(r => r.week_number === currentWeek);
  const pathway = learner?.pathway || 'PM';

  const RESOURCE_TYPES = ['all', 'Template', 'Example', 'Reading', 'Tool', 'Video', 'Guide', 'AI Prompt'];

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Program Resources</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Resource Library</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Templates, tools, readings, and examples — connected to your weekly work.</p>
      </div>

      {/* This week's resources */}
      {thisWeekResources.length > 0 && (
        <div style={{ padding: '16px 20px', background: 'rgba(197,116,58,0.07)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, marginBottom: 20 }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 10 }}>
            ⭐ Week {currentWeek} — Recommended for this week
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {thisWeekResources.map(r => (
              <a key={r.id} href={r.external_url || '#'} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', background: 'var(--white)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, textDecoration: 'none' }}>
                <span>{TYPE_ICON[r.resource_type]}</span>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>{r.title}</p>
                  {r.assignment_context && <p style={{ fontSize: '0.6875rem', color: 'var(--amber-deep)' }}>For: {r.assignment_context}</p>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 20 }}>
        <input className="form-input" type="search" placeholder="Search templates, tools, readings..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-input" value={filterPathway} onChange={e => setFilterPathway(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All pathways</option>
            <option value="PM">PM only</option>
            <option value="BA">BA only</option>
          </select>
          <select className="form-input" value={filterWeek} onChange={e => setFilterWeek(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All weeks</option>
            <option value="general">General (no week)</option>
            {WEEK_DATES.map(w => <option key={w.week} value={w.week.toString()}>Week {w.week}</option>)}
          </select>
        </div>
      </div>

      {/* Type filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {RESOURCE_TYPES.map(type => (
          <button key={type} onClick={() => setFilterType(type)} style={{
            padding: '5px 14px', borderRadius: 100, border: `1.5px solid ${filterType === type ? 'var(--ink)' : 'var(--paper-line)'}`,
            background: filterType === type ? 'var(--ink)' : 'transparent',
            color: filterType === type ? 'var(--paper)' : 'var(--ink-muted)',
            fontSize: '0.8125rem', fontWeight: filterType === type ? 700 : 400, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {type !== 'all' && TYPE_ICON[type]} {type === 'all' ? 'All Resources' : type}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--ink-muted)' }}>Loading resources...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem' }}>No resources match your search</p>
          <p style={{ color: 'var(--ink-muted)', marginTop: 6 }}>Try different keywords or clear your filters</p>
        </div>
      ) : (
        <>
          {/* Count */}
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginBottom: 16 }}>{filtered.length} resource{filtered.length !== 1 ? 's' : ''} found</p>

          {/* Resource grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(r => (
              <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `2px solid ${TYPE_COLOR[r.resource_type]}` }}>
                <div style={{ padding: '16px 18px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: `${TYPE_COLOR[r.resource_type]}15`, color: TYPE_COLOR[r.resource_type] }}>
                        {TYPE_ICON[r.resource_type]} {r.resource_type}
                      </span>
                      {r.week_number !== null && r.week_number !== undefined && (
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: 'var(--paper-soft)', color: 'var(--ink-muted)' }}>
                          Wk {r.week_number}
                        </span>
                      )}
                      {r.is_featured && (
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: 'rgba(197,116,58,0.1)', color: 'var(--amber-deep)' }}>
                          ⭐ Featured
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: r.pathway === 'PM' ? 'var(--ink-muted)' : r.pathway === 'BA' ? 'var(--amber-deep)' : 'var(--ink-muted)' }}>
                      {r.pathway}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 6 }}>{r.title}</h3>
                  {r.description && <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.5, marginBottom: 8 }}>{r.description}</p>}
                  {r.assignment_context && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', fontWeight: 600 }}>Used for: {r.assignment_context}</p>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--paper-line)', padding: '10px 18px', display: 'flex', gap: 8 }}>
                  {r.external_url && r.external_url !== '#' && (
                    <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                      {r.resource_type === 'Template' ? 'Use Template →' : r.resource_type === 'Tool' ? 'Open Tool →' : 'Open →'}
                    </a>
                  )}
                  {r.example_url && r.example_url !== '#' && (
                    <a href={r.example_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                      See example
                    </a>
                  )}
                  {(!r.external_url || r.external_url === '#') && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', padding: '6px 0' }}>Link coming soon</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
