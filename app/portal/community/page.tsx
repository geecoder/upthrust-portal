'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { CommunityPost } from '@/lib/types';

const CATEGORIES = ['General', 'Question', 'Win', 'Portfolio Review'] as const;
const CAT_EMOJI: Record<string, string> = { General: '💬', Question: '❓', Win: '🌟', 'Portfolio Review': '👀' };

export default function CommunityPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [newCategory, setNewCategory] = useState<typeof CATEGORIES[number]>('General');
  const [posting, setPosting] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('All');

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: l } = await createBrowserClient().from('learners').select('*').eq('clerk_user_id', user!.id).single();
      setLearner(l);
      const { data: p } = await createBrowserClient().from('community_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      setPosts(p || []);
    }
    load();
  }, [user]);

  async function handlePost() {
    if (!learner || !newPost.trim()) return;
    setPosting(true);
    await createBrowserClient().from('community_posts').insert({
      learner_id: learner.id,
      author_name: `${learner.first_name} ${learner.last_name || ''}`.trim(),
      category: newCategory,
      content: newPost.trim(),
    });
    const { data: p } = await createBrowserClient().from('community_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    setPosts(p || []);
    setNewPost('');
    setPosting(false);
  }

  const filtered = filterCat === 'All' ? posts : posts.filter(p => p.category === filterCat);

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Cohort 1</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Community</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Ask questions, share wins, post your work for peer review.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Feed */}
        <div>
          {/* Post composer */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setNewCategory(cat)} style={{
                  padding: '4px 10px', borderRadius: 100,
                  background: newCategory === cat ? 'var(--ink)' : 'var(--paper-soft)',
                  color: newCategory === cat ? 'var(--paper)' : 'var(--ink-muted)',
                  border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                  transition: 'all 150ms',
                }}>
                  {CAT_EMOJI[cat]} {cat}
                </button>
              ))}
            </div>
            <textarea className="form-input form-textarea" placeholder={`Share something with the cohort...`} value={newPost} onChange={e => setNewPost(e.target.value)} style={{ marginBottom: 10, minHeight: 80 }} />
            <button className="btn btn-primary" disabled={!newPost.trim() || posting} onClick={handlePost} style={{ alignSelf: 'flex-start' }}>
              {posting ? 'Posting...' : 'Post to Community'}
            </button>
          </div>

          {/* Posts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(post => (
              <div key={post.id} className="card" style={{ borderLeft: post.is_pinned ? '3px solid var(--amber)' : post.is_from_genesis ? '3px solid var(--moss)' : '1px solid var(--paper-line)', borderTop: 'none', borderRight: 'none', borderBottom: 'none', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: post.is_from_genesis ? 'var(--ink)' : 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                      {post.author_name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {post.author_name}
                        {post.is_from_genesis && <span style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1px 6px', background: 'var(--moss)', color: 'var(--paper)', borderRadius: 2 }}>GENESIS</span>}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {CAT_EMOJI[post.category]} {post.category}
                  </span>
                </div>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>{post.content}</p>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-muted)' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>💬</p>
                <p>No posts yet. Be the first to share something.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Filter</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['All', ...CATEGORIES].map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat)} style={{
                  padding: '8px 12px', borderRadius: 6, textAlign: 'left',
                  background: filterCat === cat ? 'var(--paper-soft)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: filterCat === cat ? 600 : 400,
                  color: filterCat === cat ? 'var(--ink)' : 'var(--ink-muted)',
                }}>
                  {cat === 'All' ? '🗂️ All Posts' : `${CAT_EMOJI[cat]} ${cat}`}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: 'var(--paper-soft)' }}>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 10 }}>Community Rules</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none' }}>
              {['Be specific in your questions', 'Share your work and process', 'Give feedback kindly', 'Protect class confidentiality', 'No off-topic content'].map(r => (
                <li key={r} style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--moss)' }}>✓</span> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
