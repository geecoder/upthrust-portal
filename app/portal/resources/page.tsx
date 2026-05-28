'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { Resource } from '@/lib/types';
import { WEEK_DATES } from '@/lib/types';

// ── Constants ──────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = {
  Template: '📄', Example: '✅', Reading: '📖', Tool: '🔧',
  Video: '▶️', Guide: '📋', 'AI Prompt': '⚡', Slides: '🖥️',
  'Session Material': '📋', Recording: '🎬', Worksheet: '📝',
  Framework: '🗺️', 'Case Study': '🧩',
};

const TYPE_COLOR: Record<string, string> = {
  'Session Material': '#0F1A2E', Recording: '#7C3AED', Template: '#0F1A2E',
  Example: '#4F6A4A', Reading: '#A05A26', Tool: '#2563EB',
  Guide: '#C5743A', Worksheet: '#0F1A2E', Framework: '#A05A26',
  'Case Study': '#4F6A4A', Video: '#7C3AED', 'AI Prompt': '#6D28D9', Slides: '#2563EB',
};

const ALL_TYPES = [
  'Session Material', 'Recording', 'Template', 'Example',
  'Reading', 'Tool', 'Guide', 'Worksheet', 'Framework',
  'Case Study', 'Video', 'AI Prompt', 'Slides',
];

const CONTENT_LEVELS = ['Foundation', 'Intermediate', 'Core Skills', 'Delivery', 'Capstone', 'All Levels'];

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return 0;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}

// ── YouTube embed modal ────────────────────────────────────
function YouTubeModal({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,46,0.88)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ width: '100%', maxWidth: 880, background: '#000', borderRadius: 8, overflow: 'hidden', boxShadow: '0 32px 64px -12px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '12px 18px', background: '#0F1A2E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#FAF7F1', fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'rgba(250,247,241,0.1)', border: 'none', color: '#FAF7F1', width: 32, height: 32, borderRadius: 4, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        {/* 16:9 iframe */}
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <iframe
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <p style={{ padding: '10px 18px', fontSize: '0.6875rem', color: 'rgba(250,247,241,0.35)', background: '#0F1A2E', textAlign: 'center' }}>
          Press Esc to close · Use fullscreen button for best experience
        </p>
      </div>
    </div>
  );
}

// ── Resource card ──────────────────────────────────────────
function ResourceCard({ resource, onWatch }: { resource: Resource; onWatch: (id: string, title: string) => void }) {
  const r = resource as any;
  const linkType: string = r.link_type || 'url';
  const ytId = r.youtube_url ? extractYouTubeId(r.youtube_url) : null;

  function getAction() {
    if (linkType === 'youtube' && ytId) {
      return { label: '▶ Watch Video', action: () => onWatch(ytId, r.title), isExternal: false };
    }
    if (linkType === 'notion' && r.notion_url) {
      return { label: 'Open in Notion →', href: r.notion_url, isExternal: true };
    }
    if (linkType === 'file' && r.external_url) {
      return { label: '⬇ Download File', href: r.external_url, isExternal: true };
    }
    if (r.external_url && r.external_url !== '#') {
      const isTemplate = r.resource_type === 'Template';
      return { label: isTemplate ? 'Use Template →' : r.resource_type === 'Tool' ? 'Open Tool →' : 'Open →', href: r.external_url, isExternal: true };
    }
    return null;
  }

  const actionInfo = getAction();
  const color = TYPE_COLOR[r.resource_type] || 'var(--ink)';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `2px solid ${color}`, display: 'flex', flexDirection: 'column' }}>

      {/* YouTube thumbnail */}
      {linkType === 'youtube' && ytId && (
        <div style={{ position: 'relative', cursor: 'pointer', background: '#000', aspectRatio: '16/9', overflow: 'hidden' }} onClick={() => onWatch(ytId, r.title)}>
          <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85, transition: 'opacity 200ms' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')} />
          {/* Play button overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(197,116,58,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', transition: 'transform 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <span style={{ fontSize: '1.375rem', marginLeft: 3 }}>▶</span>
            </div>
          </div>
          {/* Duration badge */}
          {r.duration_mins && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '2px 8px', background: 'rgba(15,26,46,0.85)', borderRadius: 3 }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#FAF7F1' }}>{r.duration_mins} min</span>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: `${color}14`, color }}>
            {TYPE_ICON[r.resource_type]} {r.resource_type}
          </span>
          {r.week_number != null && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'var(--paper-soft)', color: 'var(--ink-muted)' }}>Wk {r.week_number}</span>
          )}
          {r.content_level && r.content_level !== 'All Levels' && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'var(--paper-soft)', color: 'var(--ink-muted)' }}>{r.content_level}</span>
          )}
          {r.is_featured && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(197,116,58,0.1)', color: 'var(--amber-deep)' }}>⭐</span>
          )}
          {linkType === 'notion' && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(15,26,46,0.06)', color: 'var(--ink-muted)' }}>📓 Notion</span>
          )}
          {linkType === 'file' && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(37,99,235,0.08)', color: '#2563EB' }}>📎 Download</span>
          )}
        </div>

        <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 5, lineHeight: 1.3 }}>{r.title}</h3>
        {r.description && <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.55, marginBottom: 10, flex: 1 }}>{r.description}</p>}
        {r.assignment_context && (
          <p style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', fontWeight: 600, marginBottom: 10 }}>
            For: {r.assignment_context}
          </p>
        )}

        {/* Action button */}
        {actionInfo && (
          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--paper-line)' }}>
            {actionInfo.action ? (
              <button onClick={actionInfo.action} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                {actionInfo.label}
              </button>
            ) : (
              <a href={(actionInfo as any).href} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ display: 'flex', justifyContent: 'center' }}>
                {actionInfo.label}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function ResourcesPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterWeek, setFilterWeek] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterPathway, setFilterPathway] = useState('all');
  const [loading, setLoading] = useState(true);
  const [watchVideo, setWatchVideo] = useState<{ id: string; title: string } | null>(null);
  const currentWeek = getCurrentWeek();

  const db = createBrowserClient();

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [{ data: l }, { data: r }] = await Promise.all([
        db.from('learners').select('*').eq('clerk_user_id', user!.id).maybeSingle(),
        db.from('resources').select('*').eq('is_active', true)
          .order('is_featured', { ascending: false })
          .order('week_number', { ascending: true, nullsFirst: false })
          .order('title'),
      ]);
      setLearner(l);
      setResources((r || []) as Resource[]);
      setLoading(false);
    }
    load();
  }, [user]);

  const pathway = learner?.pathway || 'PM';

  const filtered = resources.filter(r => {
    const ra = r as any;
    const matchSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.tags || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.assignment_context || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || r.resource_type === filterType;
    const matchWeek = filterWeek === 'all' || r.week_number?.toString() === filterWeek || (!r.week_number && filterWeek === 'general');
    const matchLevel = filterLevel === 'all' || ra.content_level === filterLevel || ra.content_level === 'All Levels' || !ra.content_level;
    const matchPathway = filterPathway === 'all' || r.pathway === filterPathway || r.pathway === 'Both';
    return matchSearch && matchType && matchWeek && matchLevel && matchPathway;
  });

  const thisWeekResources = resources.filter(r => r.week_number === currentWeek);
  const featured = filtered.filter(r => r.is_featured);
  const notFeatured = filtered.filter(r => !r.is_featured);

  return (
    <div className="portal-content">
      {/* YouTube modal */}
      {watchVideo && (
        <YouTubeModal videoId={watchVideo.id} title={watchVideo.title} onClose={() => setWatchVideo(null)} />
      )}

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Program Resources</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Resource Library</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Templates, recordings, tools, and readings — connected to your weekly work.</p>
      </div>

      {/* This week banner */}
      {thisWeekResources.length > 0 && filterWeek === 'all' && !search && (
        <div style={{ padding: '14px 18px', background: 'rgba(197,116,58,0.07)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, marginBottom: 20 }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 10 }}>
            ⭐ Recommended for Week {currentWeek}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {thisWeekResources.map(r => {
              const ra = r as any;
              const ytId = ra.youtube_url ? extractYouTubeId(ra.youtube_url) : null;
              return (
                <button key={r.id}
                  onClick={() => {
                    if (ra.link_type === 'youtube' && ytId) {
                      setWatchVideo({ id: ytId, title: r.title });
                    } else {
                      const url = ra.notion_url || r.external_url;
                      if (url && url !== '#') window.open(url, '_blank');
                    }
                  }}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', background: 'var(--white)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '1.125rem' }}>{TYPE_ICON[r.resource_type]}</span>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>{r.title}</p>
                    {r.assignment_context && <p style={{ fontSize: '0.6875rem', color: 'var(--amber-deep)' }}>For: {r.assignment_context}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" type="search" style={{ flex: 1, minWidth: 200 }}
          placeholder="Search by name, topic, or assignment..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-input" style={{ width: 'auto' }} value={filterPathway} onChange={e => setFilterPathway(e.target.value)}>
          <option value="all">All pathways</option>
          <option value={pathway}>{pathway} only</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
          <option value="all">All weeks</option>
          <option value="general">No week</option>
          {WEEK_DATES.map(w => <option key={w.week} value={w.week.toString()}>Week {w.week}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="all">All levels</option>
          {CONTENT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Type filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {['all', ...ALL_TYPES].map(type => (
          <button key={type} onClick={() => setFilterType(type)} style={{
            padding: '5px 12px', borderRadius: 100,
            border: `1.5px solid ${filterType === type ? 'var(--ink)' : 'var(--paper-line)'}`,
            background: filterType === type ? 'var(--ink)' : 'transparent',
            color: filterType === type ? 'var(--paper)' : 'var(--ink-muted)',
            fontSize: '0.8125rem', fontWeight: filterType === type ? 700 : 400,
            cursor: 'pointer', transition: 'all 150ms',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {type === 'all' ? '📚 All' : `${TYPE_ICON[type] || ''} ${type}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-muted)' }}>Loading resources...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', marginBottom: 6 }}>No resources match your search</p>
          <p style={{ color: 'var(--ink-muted)' }}>Try clearing some filters.</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
            {filtered.length} resource{filtered.length !== 1 ? 's' : ''} found
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(r => (
              <ResourceCard key={r.id} resource={r} onWatch={(id, title) => setWatchVideo({ id, title })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
