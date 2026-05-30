'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Resource, ResourceType, ContentLevel, ContentLinkType } from '@/lib/types';
import { WEEK_DATES } from '@/lib/types';

// ── Constants ──────────────────────────────────────────────────
const RESOURCE_TYPES: { value: ResourceType; icon: string; desc: string }[] = [
  { value: 'Session Material', icon: '📋', desc: 'Slides, notes, or handouts from a live session' },
  { value: 'Recording',        icon: '🎬', desc: 'Video recording of a session' },
  { value: 'Template',         icon: '📄', desc: 'Document template learners fill in' },
  { value: 'Example',          icon: '✅', desc: 'Example of completed work at a good standard' },
  { value: 'Reading',          icon: '📖', desc: 'Article, book chapter, or written guide' },
  { value: 'Tool',             icon: '🔧', desc: 'Software tool or platform' },
  { value: 'Guide',            icon: '📋', desc: 'How-to guide or reference document' },
  { value: 'Worksheet',        icon: '📝', desc: 'Structured worksheet or exercise' },
  { value: 'Framework',        icon: '🗺️', desc: 'Model, canvas, or decision framework' },
  { value: 'Case Study',       icon: '🧩', desc: 'Real-world case for analysis or discussion' },
  { value: 'Video',            icon: '▶️', desc: 'Educational video (not a session recording)' },
  { value: 'AI Prompt',        icon: '⚡', desc: 'Prompt template for AI tools' },
  { value: 'Slides',           icon: '🖥️', desc: 'Presentation deck' },
];

const CONTENT_LEVELS: ContentLevel[] = [
  'Foundation', 'Intermediate', 'Core Skills', 'Delivery', 'Capstone', 'All Levels'
];

const LINK_TYPES: { value: ContentLinkType; label: string; icon: string; hint: string; placeholder: string }[] = [
  { value: 'url',     label: 'External Link',    icon: '🔗', hint: 'Any external website, Google Doc, Figma, Miro, etc.', placeholder: 'https://...' },
  { value: 'notion',  label: 'Notion Page',      icon: '📓', hint: 'Link to a Notion page — learners open it in Notion', placeholder: 'https://notion.so/...' },
  { value: 'youtube', label: 'YouTube Video',    icon: '▶️', hint: 'Paste a YouTube link — learners watch it inside the portal, no redirect', placeholder: 'https://youtube.com/watch?v=... or https://youtu.be/...' },
  { value: 'file',    label: 'Uploaded File',    icon: '📎', hint: 'PDF, DOCX, XLSX — upload a file directly (max 10MB)', placeholder: '' },
];

const TYPE_COLOR: Record<string, string> = {
  'Session Material': '#0F1A2E', Recording: '#7C3AED', Template: '#0F1A2E',
  Example: '#4F6A4A', Reading: '#A05A26', Tool: '#2563EB',
  Guide: '#C5743A', Worksheet: '#0F1A2E', Framework: '#A05A26',
  'Case Study': '#4F6A4A', Video: '#7C3AED', 'AI Prompt': '#6D28D9', Slides: '#2563EB',
};

// Extract YouTube video ID from any YouTube URL format
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Empty form state
const EMPTY_FORM = {
  title: '',
  description: '',
  resource_type: 'Template' as ResourceType,
  pathway: 'Both',
  week_number: '',
  content_level: 'All Levels' as ContentLevel,
  link_type: 'url' as ContentLinkType,
  external_url: '',
  notion_url: '',
  youtube_url: '',
  assignment_context: '',
  duration_mins: '',
  is_featured: false,
  tags: '',
};

export default function AdminResourcesPage() {
  const db = createBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [previewYt, setPreviewYt] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await db.from('resources').select('*').order('created_at', { ascending: false });
    setResources((data || []) as Resource[]);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPreviewYt(null);
    setShowForm(true);
  }

  function openEdit(r: Resource) {
    setEditing(r);
    setForm({
      title: r.title,
      description: r.description || '',
      resource_type: r.resource_type,
      pathway: r.pathway,
      week_number: r.week_number?.toString() || '',
      content_level: (r as any).content_level || 'All Levels',
      link_type: (r as any).link_type || 'url',
      external_url: r.external_url || '',
      notion_url: (r as any).notion_url || '',
      youtube_url: (r as any).youtube_url || '',
      assignment_context: r.assignment_context || '',
      duration_mins: (r as any).duration_mins?.toString() || '',
      is_featured: r.is_featured,
      tags: r.tags || '',
    });
    setPreviewYt((r as any).youtube_url ? extractYouTubeId((r as any).youtube_url) : null);
    setShowForm(true);
  }

  function f(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'youtube_url') {
      setPreviewYt(value ? extractYouTubeId(value) : null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }
    setUploadProgress('Uploading...');
    const fileName = `resources/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { data, error } = await db.storage.from('content').upload(fileName, file, { upsert: true });
    if (error) {
      setUploadProgress(`Upload failed: ${error.message}`);
      return;
    }
    const { data: urlData } = db.storage.from('content').getPublicUrl(fileName);
    f('external_url', urlData.publicUrl);
    setUploadProgress(`✓ Uploaded: ${file.name}`);
  }

  async function handleSave() {
    if (!form.title.trim()) { alert('Title is required.'); return; }

    // Validate link
    const hasLink = form.link_type === 'url' ? !!form.external_url
      : form.link_type === 'notion' ? !!form.notion_url
      : form.link_type === 'youtube' ? !!form.youtube_url
      : !!form.external_url;

    if (!hasLink) { alert('Please add a link or upload a file.'); return; }

    // For YouTube, validate it's a real YouTube ID
    if (form.link_type === 'youtube' && !extractYouTubeId(form.youtube_url)) {
      alert('That doesn\'t look like a valid YouTube URL. Make sure it contains youtube.com/watch?v= or youtu.be/');
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      resource_type: form.resource_type,
      pathway: form.pathway,
      week_number: form.week_number ? parseInt(form.week_number) : null,
      content_level: form.content_level,
      link_type: form.link_type,
      external_url: form.link_type === 'url' || form.link_type === 'file' ? form.external_url || null : null,
      notion_url: form.link_type === 'notion' ? form.notion_url || null : null,
      youtube_url: form.link_type === 'youtube' ? form.youtube_url || null : null,
      assignment_context: form.assignment_context.trim() || null,
      duration_mins: form.duration_mins ? parseInt(form.duration_mins) : null,
      is_featured: form.is_featured,
      is_active: true,
      tags: form.tags.trim() || null,
    };

    if (editing) {
      await db.from('resources').update(payload).eq('id', editing.id);
    } else {
      await db.from('resources').insert(payload);
    }

    await load();
    setSaved(true);
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setTimeout(() => setSaved(false), 3000);
  }

  async function toggleActive(r: Resource) {
    await db.from('resources').update({ is_active: !r.is_active }).eq('id', r.id);
    await load();
  }

  async function toggleFeatured(r: Resource) {
    await db.from('resources').update({ is_featured: !r.is_featured }).eq('id', r.id);
    await load();
  }

  async function deleteResource(r: Resource) {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    await db.from('resources').delete().eq('id', r.id);
    await load();
  }

  const filtered = resources.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || r.resource_type === filter || (!r.is_active && filter === 'inactive');
    return matchSearch && matchFilter;
  });

  const linkType = LINK_TYPES.find(l => l.value === form.link_type)!;

  return (
    <div className="portal-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Resource Library</h1>
          <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
            {resources.filter(r => r.is_active).length} active resources · {resources.filter(r => r.is_featured).length} featured
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">+ Add Resource</button>
      </div>

      {saved && (
        <div style={{ padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 6, marginBottom: 20, color: 'var(--moss)', fontWeight: 600 }}>
          ✓ Resource saved successfully
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-input" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All types</option>
          {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.value}</option>)}
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Resource table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Title & Description</th>
              <th>Type</th>
              <th>Link</th>
              <th>Pathway</th>
              <th>Week</th>
              <th>Level</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-muted)' }}>
                No resources found.
              </td></tr>
            ) : filtered.map(r => {
              const lType = (r as any).link_type || 'url';
              const linkIcon = lType === 'youtube' ? '▶️' : lType === 'notion' ? '📓' : lType === 'file' ? '📎' : '🔗';
              return (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                  <td>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.title}</p>
                    {r.description && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 2 }}>{r.description.substring(0, 80)}{r.description.length > 80 ? '…' : ''}</p>}
                    {r.is_featured && <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', padding: '1px 6px', borderRadius: 2, background: 'rgba(197,116,58,0.1)', color: 'var(--amber-deep)' }}>⭐ Featured</span>}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: `${TYPE_COLOR[r.resource_type] || 'var(--ink)'}12`, color: TYPE_COLOR[r.resource_type] || 'var(--ink)' }}>
                      {r.resource_type}
                    </span>
                  </td>
                  <td>
                    <span title={lType} style={{ fontSize: '1rem' }}>{linkIcon}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginLeft: 4 }}>{lType}</span>
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>{r.pathway}</td>
                  <td style={{ fontSize: '0.8125rem' }}>{r.week_number != null ? `Wk ${r.week_number}` : '—'}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{(r as any).content_level || '—'}</td>
                  <td>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: r.is_active ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.08)', color: r.is_active ? 'var(--moss)' : 'var(--ink-muted)' }}>
                      {r.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(r)} className="btn btn-xs btn-outline" title="Edit">✏️</button>
                      <button onClick={() => toggleFeatured(r)} className="btn btn-xs btn-ghost" title={r.is_featured ? 'Unfeature' : 'Feature'}>⭐</button>
                      <button onClick={() => toggleActive(r)} className="btn btn-xs btn-ghost" title={r.is_active ? 'Hide' : 'Show'}>{r.is_active ? '👁' : '🚫'}</button>
                      <button onClick={() => deleteResource(r)} className="btn btn-xs btn-ghost" title="Delete" style={{ color: 'var(--red)' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── CREATE / EDIT MODAL ───────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, width: '100%', maxWidth: 760, maxHeight: '92vh', overflow: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(15,26,46,0.3)' }}>

            {/* Modal header — sticky */}
            <div style={{ padding: '22px 32px', borderBottom: '1px solid var(--paper-line)', position: 'sticky', top: 0, background: 'var(--white)', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', fontWeight: 500 }}>
                {editing ? `Edit: ${editing.title.substring(0, 40)}` : 'Add New Resource'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--ink-muted)', padding: '4px 8px' }}>✕</button>
            </div>

            <div style={{ padding: '28px 32px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Title + description */}
              <div>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, marginBottom: 14, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.6875rem' }}>
                  1 — BASIC DETAILS
                </h3>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Title *</label>
                  <input className="form-input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="e.g. PRD Template — Upthrust Standard Format" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Description</label>
                  <textarea className="form-input form-textarea" style={{ minHeight: 70 }} value={form.description} onChange={e => f('description', e.target.value)} placeholder="One or two sentences on what this resource is and when learners should use it..." />
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--paper-line)' }} />

              {/* Content type */}
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 14 }}>
                  2 — CONTENT TYPE
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                  {RESOURCE_TYPES.map(t => (
                    <button key={t.value} onClick={() => f('resource_type', t.value)} style={{
                      padding: '10px 12px', border: `1.5px solid ${form.resource_type === t.value ? 'var(--ink)' : 'var(--paper-line)'}`,
                      borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                      background: form.resource_type === t.value ? 'var(--ink)' : 'var(--white)',
                      transition: 'all 150ms',
                    }}>
                      <div style={{ fontSize: '1.125rem', marginBottom: 4 }}>{t.icon}</div>
                      <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: form.resource_type === t.value ? 'var(--paper)' : 'var(--ink)', marginBottom: 2 }}>{t.value}</p>
                      <p style={{ fontSize: '0.6875rem', color: form.resource_type === t.value ? 'rgba(250,247,241,0.6)' : 'var(--ink-muted)', lineHeight: 1.35 }}>{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--paper-line)' }} />

              {/* Link type */}
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 14 }}>
                  3 — HOW LEARNERS ACCESS THIS
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                  {LINK_TYPES.map(l => (
                    <button key={l.value} onClick={() => f('link_type', l.value)} style={{
                      padding: '12px', border: `1.5px solid ${form.link_type === l.value ? 'var(--ink)' : 'var(--paper-line)'}`,
                      borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                      background: form.link_type === l.value ? 'var(--ink)' : 'var(--white)',
                      transition: 'all 150ms',
                    }}>
                      <div style={{ fontSize: '1.25rem', marginBottom: 5 }}>{l.icon}</div>
                      <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: form.link_type === l.value ? 'var(--paper)' : 'var(--ink)', marginBottom: 2 }}>{l.label}</p>
                      <p style={{ fontSize: '0.6875rem', color: form.link_type === l.value ? 'rgba(250,247,241,0.55)' : 'var(--ink-muted)', lineHeight: 1.3 }}>{l.hint}</p>
                    </button>
                  ))}
                </div>

                {/* Link input — changes based on type */}
                {form.link_type === 'url' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">URL</label>
                    <input className="form-input" type="url" value={form.external_url} onChange={e => f('external_url', e.target.value)} placeholder="https://docs.google.com/... or https://miro.com/..." />
                  </div>
                )}

                {form.link_type === 'notion' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notion Page URL</label>
                    <input className="form-input" type="url" value={form.notion_url} onChange={e => f('notion_url', e.target.value)} placeholder="https://notion.so/..." />
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 5 }}>
                      Make sure the Notion page is set to "Anyone with the link can view" before saving.
                    </p>
                  </div>
                )}

                {form.link_type === 'youtube' && (
                  <div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">YouTube URL</label>
                      <input className="form-input" type="url" value={form.youtube_url} onChange={e => f('youtube_url', e.target.value)} placeholder="https://youtube.com/watch?v=... or https://youtu.be/..." />
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 5 }}>
                        Learners will watch this inside the portal — no redirect to YouTube.
                      </p>
                    </div>
                    {/* YouTube preview */}
                    {previewYt && (
                      <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--paper-line)' }}>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', padding: '6px 12px', background: 'rgba(79,106,74,0.06)' }}>
                          ✓ Preview — will embed in portal
                        </p>
                        <iframe
                          width="100%"
                          height="240"
                          src={`https://www.youtube.com/embed/${previewYt}`}
                          title="Preview"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ display: 'block' }}
                        />
                      </div>
                    )}
                    {form.youtube_url && !previewYt && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--red)', padding: '8px 12px', background: 'rgba(179,56,44,0.06)', borderRadius: 4 }}>
                        ⚠ Couldn't extract a YouTube video ID from that URL. Check the URL format.
                      </p>
                    )}
                  </div>
                )}

                {form.link_type === 'file' && (
                  <div>
                    <label className="form-label">Upload File</label>
                    <div style={{ border: '2px dashed var(--paper-line)', borderRadius: 6, padding: '24px', textAlign: 'center', cursor: 'pointer', background: 'var(--paper-soft)' }}
                      onClick={() => fileInputRef.current?.click()}>
                      <p style={{ fontSize: '2rem', marginBottom: 8 }}>📎</p>
                      <p style={{ fontWeight: 600 }}>Click to upload a file</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>PDF, DOCX, XLSX, PPTX — max 10MB</p>
                      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </div>
                    {uploadProgress && (
                      <p style={{ marginTop: 8, fontSize: '0.875rem', color: uploadProgress.startsWith('✓') ? 'var(--moss)' : uploadProgress.startsWith('Upload failed') ? 'var(--red)' : 'var(--amber-deep)', fontWeight: 600 }}>
                        {uploadProgress}
                      </p>
                    )}
                    {form.external_url && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 6 }}>
                        File URL: <a href={form.external_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber-deep)' }}>Preview →</a>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--paper-line)' }} />

              {/* Classification */}
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 14 }}>
                  4 — CLASSIFICATION
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Pathway</label>
                    <select className="form-input" value={form.pathway} onChange={e => f('pathway', e.target.value)}>
                      <option value="Both">Both PM & BA</option>
                      <option value="PM">PM only</option>
                      <option value="BA">BA only</option>
                      <option value="Career">Career (all)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Program Level</label>
                    <select className="form-input" value={form.content_level} onChange={e => f('content_level', e.target.value)}>
                      {CONTENT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Week (optional)</label>
                    <select className="form-input" value={form.week_number} onChange={e => f('week_number', e.target.value)}>
                      <option value="">Not week-specific</option>
                      {WEEK_DATES.map(w => <option key={w.week} value={w.week}>Week {w.week} — {w.session}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Duration (minutes)</label>
                    <input className="form-input" type="number" min="1" max="600" value={form.duration_mins} onChange={e => f('duration_mins', e.target.value)} placeholder="e.g. 15 for a 15-min video" />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Assignment Context</label>
                  <input className="form-input" value={form.assignment_context} onChange={e => f('assignment_context', e.target.value)} placeholder="e.g. Full PRD — helps learners know which assignment this supports" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tags (comma separated)</label>
                  <input className="form-input" value={form.tags} onChange={e => f('tags', e.target.value)} placeholder="PRD,requirements,week4,PM" />
                </div>
              </div>

              {/* Featured toggle */}
              <div style={{ padding: '14px 16px', background: form.is_featured ? 'rgba(197,116,58,0.06)' : 'var(--paper-soft)', border: `1px solid ${form.is_featured ? 'rgba(197,116,58,0.25)' : 'var(--paper-line)'}`, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>⭐ Feature this resource</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 2 }}>Featured resources appear at the top of the resource hub and on the learner dashboard.</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: 48, height: 26, background: form.is_featured ? 'var(--amber)' : 'var(--paper-line)', borderRadius: 13, position: 'relative', transition: 'background 200ms', cursor: 'pointer' }} onClick={() => f('is_featured', !form.is_featured)}>
                    <div style={{ position: 'absolute', width: 20, height: 20, background: 'white', borderRadius: '50%', top: 3, left: form.is_featured ? 25 : 3, transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </label>
              </div>
            </div>

            {/* Modal footer — sticky */}
            <div style={{ padding: '16px 32px', borderTop: '1px solid var(--paper-line)', position: 'sticky', bottom: 0, background: 'var(--white)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {saving && <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>Saving...</p>}
                <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn btn-primary" style={{ minWidth: 140 }}>
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Resource'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
