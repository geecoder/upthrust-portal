'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { CommunityPost } from '@/lib/types';

const CATEGORIES = ['All', 'General', 'Question', 'Win', 'Portfolio Review'] as const;
const CAT_EMOJI: Record<string, string> = {
  General: '💬', Question: '❓', Win: '🌟', 'Portfolio Review': '👀'
};
const CAT_COLOR: Record<string, string> = {
  General: 'var(--ink-muted)', Question: '#2563EB', Win: 'var(--amber-deep)', 'Portfolio Review': 'var(--moss)'
};

export default function CommunityPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [replies, setReplies] = useState<Record<string, any[]>>({});
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [newPost, setNewPost] = useState('');
  const [newCategory, setNewCategory] = useState<'General' | 'Question' | 'Win' | 'Portfolio Review'>('General');
  const [posting, setPosting] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const db = createBrowserClient();

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [{ data: l }, { data: p }] = await Promise.all([
        db.from('learners').select('*').eq('clerk_user_id', user!.id).maybeSingle(),
        db.from('community_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      ]);
      setLearner(l);
      setPosts((p || []) as CommunityPost[]);
      setLoading(false);
    }
    load();
  }, [user]);

  async function loadReplies(postId: string) {
    if (replies[postId]) return;
    const { data } = await db
      .from('community_replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at');
    setReplies(prev => ({ ...prev, [postId]: data || [] }));
  }

  async function toggleExpand(postId: string) {
    if (expandedPost === postId) {
      setExpandedPost(null);
    } else {
      setExpandedPost(postId);
      await loadReplies(postId);
    }
  }

  async function handlePost() {
    if (!learner || !newPost.trim()) return;
    setPosting(true);
    await db.from('community_posts').insert({
      learner_id: learner.id,
      author_name: `${learner.first_name} ${learner.last_name || ''}`.trim(),
      category: newCategory,
      content: newPost.trim(),
      is_from_genesis: false,
      likes_count: 0,
      replies_count: 0,
    });
    const { data: p } = await db
      .from('community_posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setPosts((p || []) as CommunityPost[]);
    setNewPost('');
    setPosting(false);
    textareaRef.current?.focus();
  }

  async function handleReply(postId: string) {
    if (!learner || !replyText[postId]?.trim()) return;
    await db.from('community_replies').insert({
      post_id: postId,
      learner_id: learner.id,
      author_name: `${learner.first_name} ${learner.last_name || ''}`.trim(),
      is_from_genesis: learner.id === process.env.NEXT_PUBLIC_ADMIN_LEARNER_ID,
      content: replyText[postId].trim(),
    });
    await db.from('community_posts').update({ replies_count: (posts.find(p => p.id === postId)?.replies_count || 0) + 1 }).eq('id', postId);

    // Reload replies and posts
    const [{ data: newReplies }, { data: updatedPosts }] = await Promise.all([
      db.from('community_replies').select('*').eq('post_id', postId).order('created_at'),
      db.from('community_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    setReplies(prev => ({ ...prev, [postId]: newReplies || [] }));
    setPosts((updatedPosts || []) as CommunityPost[]);
    setReplyText(prev => ({ ...prev, [postId]: '' }));
  }

  async function handleLike(post: CommunityPost) {
    if (!learner) return;
    const newCount = (post.likes_count || 0) + 1;
    await db.from('community_posts').update({ likes_count: newCount }).eq('id', post.id);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: newCount } : p));
  }

  const filtered = filterCat === 'All' ? posts : posts.filter(p => p.category === filterCat);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="portal-content" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Cohort 1</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Community</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Ask questions, share wins, get portfolio feedback from your cohort.</p>
      </div>

      {/* Post composer */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {(['General', 'Question', 'Win', 'Portfolio Review'] as const).map(cat => (
            <button key={cat} onClick={() => setNewCategory(cat)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
              border: `1.5px solid ${newCategory === cat ? CAT_COLOR[cat] : 'var(--paper-line)'}`,
              background: newCategory === cat ? `${CAT_COLOR[cat]}10` : 'transparent',
              color: newCategory === cat ? CAT_COLOR[cat] : 'var(--ink-muted)',
              fontSize: '0.8125rem', fontWeight: newCategory === cat ? 700 : 400,
              transition: 'all 150ms',
            }}>
              <span>{CAT_EMOJI[cat]}</span> {cat}
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="form-input form-textarea"
          style={{ minHeight: 90, marginBottom: 12, resize: 'vertical' }}
          placeholder={
            newCategory === 'Question' ? "Ask the cohort or Genesis anything about the program, the work, or your career..."
            : newCategory === 'Win' ? "Share a win — big or small. Got your first piece of feedback? Finished a tough brief? Tell us."
            : newCategory === 'Portfolio Review' ? "Share a link to your work and ask for specific feedback. Be clear about what you want reviewers to focus on."
            : "Share something with the cohort..."
          }
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newPost.trim()) handlePost();
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>⌘+Enter to post quickly</p>
          <button
            onClick={handlePost}
            disabled={posting || !newPost.trim()}
            className="btn btn-primary btn-sm"
            style={{ opacity: !newPost.trim() ? 0.5 : 1 }}
          >
            {posting ? 'Posting...' : 'Post to Community →'}
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            padding: '5px 14px', borderRadius: 100,
            border: `1.5px solid ${filterCat === cat ? 'var(--ink)' : 'var(--paper-line)'}`,
            background: filterCat === cat ? 'var(--ink)' : 'transparent',
            color: filterCat === cat ? 'var(--paper)' : 'var(--ink-muted)',
            fontSize: '0.8125rem', fontWeight: filterCat === cat ? 700 : 400,
            cursor: 'pointer', transition: 'all 150ms',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {cat !== 'All' && CAT_EMOJI[cat]} {cat}
            <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0 4px', borderRadius: 100, background: filterCat === cat ? 'rgba(250,247,241,0.2)' : 'rgba(15,26,46,0.07)' }}>
              {cat === 'All' ? posts.length : posts.filter(p => p.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-muted)' }}>Loading community...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>💬</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', marginBottom: 8 }}>
            {filterCat === 'All' ? 'No posts yet — be the first to post' : `No ${filterCat} posts yet`}
          </p>
          <p style={{ color: 'var(--ink-muted)' }}>The community grows when you share.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(post => {
            const isExpanded = expandedPost === post.id;
            const postReplies = replies[post.id] || [];
            const isGenesis = post.is_from_genesis;
            const isMyPost = learner && post.learner_id === learner.id;

            return (
              <div key={post.id} className="card" style={{
                padding: 0, overflow: 'hidden',
                borderLeft: post.is_pinned ? '4px solid var(--amber)' : '4px solid transparent',
                transition: 'box-shadow 150ms',
              }}>
                {/* Post header */}
                <div style={{ padding: '16px 18px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: isGenesis ? 'var(--ink)' : 'var(--paper-soft)',
                        border: `1.5px solid ${isGenesis ? 'var(--amber)' : 'var(--paper-line)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.875rem', fontWeight: 700, color: isGenesis ? 'var(--paper)' : 'var(--ink)',
                      }}>
                        {post.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{post.author_name}</p>
                          {isGenesis && (
                            <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 2, background: 'rgba(197,116,58,0.12)', color: 'var(--amber-deep)' }}>
                              Genesis
                            </span>
                          )}
                          {isMyPost && !isGenesis && (
                            <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 2, background: 'rgba(15,26,46,0.07)', color: 'var(--ink-muted)' }}>
                              You
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>{timeAgo(post.created_at)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {post.is_pinned && <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 2, background: 'rgba(197,116,58,0.1)', color: 'var(--amber-deep)' }}>📌 Pinned</span>}
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: `${CAT_COLOR[post.category] || 'var(--ink-muted)'}12`, color: CAT_COLOR[post.category] || 'var(--ink-muted)' }}>
                        {CAT_EMOJI[post.category]} {post.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <p style={{ fontSize: '0.9375rem', lineHeight: 1.65, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>
                    {post.content}
                  </p>

                  {/* Actions row */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
                    <button onClick={() => handleLike(post)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.8125rem', color: 'var(--ink-muted)', padding: '4px 0',
                      transition: 'color 150ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber-deep)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-muted)')}>
                      <span>❤️</span>
                      <span style={{ fontWeight: 600 }}>{post.likes_count || 0}</span>
                    </button>
                    <button onClick={() => toggleExpand(post.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.8125rem', color: isExpanded ? 'var(--ink)' : 'var(--ink-muted)',
                      fontWeight: isExpanded ? 600 : 400, padding: '4px 0',
                    }}>
                      <span>💬</span>
                      <span>{post.replies_count || 0} {(post.replies_count || 0) === 1 ? 'reply' : 'replies'}</span>
                    </button>
                  </div>
                </div>

                {/* Replies */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--paper-line)', background: 'var(--paper-soft)' }}>
                    {postReplies.length > 0 && (
                      <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {postReplies.map((reply: any) => (
                          <div key={reply.id} style={{ display: 'flex', gap: 10 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: reply.is_from_genesis ? 'var(--ink)' : 'var(--paper-line)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 700,
                              color: reply.is_from_genesis ? 'var(--paper)' : 'var(--ink-muted)',
                              border: reply.is_from_genesis ? '1.5px solid var(--amber)' : 'none',
                            }}>
                              {reply.author_name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <p style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{reply.author_name}</p>
                                {reply.is_from_genesis && (
                                  <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 2, background: 'rgba(197,116,58,0.12)', color: 'var(--amber-deep)' }}>Genesis</span>
                                )}
                                <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>{timeAgo(reply.created_at)}</p>
                              </div>
                              <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    <div style={{ padding: '10px 18px 14px', display: 'flex', gap: 8 }}>
                      <textarea
                        className="form-input"
                        style={{ flex: 1, padding: '8px 12px', minHeight: 38, resize: 'none', fontSize: '0.875rem', lineHeight: 1.5 }}
                        placeholder="Write a reply..."
                        value={replyText[post.id] || ''}
                        onChange={e => setReplyText(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleReply(post.id);
                          }
                        }}
                        rows={1}
                      />
                      <button
                        onClick={() => handleReply(post.id)}
                        disabled={!replyText[post.id]?.trim()}
                        className="btn btn-primary btn-sm"
                        style={{ flexShrink: 0, opacity: !replyText[post.id]?.trim() ? 0.4 : 1 }}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
