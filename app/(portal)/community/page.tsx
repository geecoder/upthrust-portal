'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, Button, Badge, SectionHeader, Spinner } from '@/components/ui';
import { Heart, MessageSquare, Share2, Plus, X, Trophy, HelpCircle, Briefcase, Activity } from 'lucide-react';

const POST_TYPES = [
  { id: 'update', label: 'Update', icon: Activity, color: 'bg-blue-100 text-blue-700' },
  { id: 'win', label: '🎉 Win', icon: Trophy, color: 'bg-amber/10 text-amber-deep' },
  { id: 'question', label: 'Question', icon: HelpCircle, color: 'bg-paper-soft text-ink-muted' },
  { id: 'portfolio_share', label: 'Portfolio', icon: Briefcase, color: 'bg-moss/10 text-moss' },
];

export default function CommunityPage() {
  const { user } = useUser();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostType, setNewPostType] = useState('update');
  const [newPostContent, setNewPostContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetch('/api/community').then(r => r.json()).then(d => {
      setPosts(d.posts || []);
      setLoading(false);
    });
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newPostType, content: newPostContent }),
    });
    if (res.ok) {
      const data = await res.json();
      setPosts(prev => [data.post, ...prev]);
      setNewPostContent('');
      setShowNewPost(false);
    }
    setSubmitting(false);
  }

  async function handleLike(postId: string) {
    await fetch(`/api/community/${postId}/like`, { method: 'POST' });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
  }

  async function handleReply(postId: string) {
    if (!replyText.trim()) return;
    const res = await fetch(`/api/community/${postId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyText }),
    });
    if (res.ok) {
      setReplyText('');
      // Refresh replies
    }
  }

  const getTypeConfig = (type: string) => POST_TYPES.find(t => t.id === type) || POST_TYPES[0];

  return (
    <div className="animate-fade-up">
      <div className="flex items-start justify-between mb-8">
        <SectionHeader
          eyebrow="Cohort 1"
          title="Community Feed"
          description="Share progress, ask questions, celebrate wins. This cohort grows together."
        />
        <Button onClick={() => setShowNewPost(true)} className="flex items-center gap-2 flex-shrink-0">
          <Plus size={16} /> New Post
        </Button>
      </div>

      {/* New post form */}
      {showNewPost && (
        <Card className="p-6 mb-6 border-t-4 border-t-amber">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink">Share with the cohort</h3>
            <button onClick={() => setShowNewPost(false)} className="text-ink-muted hover:text-ink">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handlePost}>
            <div className="flex gap-2 mb-4">
              {POST_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setNewPostType(type.id)}
                  className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase transition-all ${
                    newPostType === type.id ? 'bg-ink text-paper' : 'bg-paper-soft text-ink-muted hover:bg-paper-line'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <textarea
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              placeholder={
                newPostType === 'win' ? "What did you accomplish? Be specific..." :
                newPostType === 'question' ? "Ask the cohort — be specific about what you're stuck on..." :
                newPostType === 'portfolio_share' ? "Share a link to your work and what feedback you're looking for..." :
                "Share an update with the cohort..."
              }
              rows={4}
              required
              className="w-full px-4 py-3 border border-paper-line bg-white text-ink text-sm focus:outline-none focus:border-ink resize-none transition-colors"
            />
            <div className="flex justify-end gap-3 mt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewPost(false)}>Cancel</Button>
              <Button type="submit" loading={submitting} size="sm">Post</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={28} color="var(--ink)" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="font-serif text-xl text-ink mb-2">The community feed is quiet</p>
          <p className="text-sm text-ink-muted mb-4">Be the first to share something with Cohort 1</p>
          <Button size="sm" onClick={() => setShowNewPost(true)}>Start the conversation</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map(post => {
            const typeConfig = getTypeConfig(post.type);
            return (
              <Card key={post.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-deep font-bold text-xs">
                      {post.author_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-ink">{post.author_name}</span>
                      {post.pathway && (
                        <Badge color={post.pathway === 'pm' ? 'blue' : 'green'}>
                          {post.pathway === 'pm' ? 'PM' : 'BA'}
                        </Badge>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      <span className="text-xs text-ink-muted ml-auto flex-shrink-0">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-paper-line">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-amber transition-colors"
                  >
                    <Heart size={14} /> {post.likes_count > 0 && post.likes_count}
                  </button>
                  <button
                    onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
                  >
                    <MessageSquare size={14} />
                    {post.replies_count > 0 ? `${post.replies_count} replies` : 'Reply'}
                  </button>
                </div>

                {expandedPost === post.id && (
                  <div className="mt-4 pl-12 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a reply..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        className="flex-1 px-3 py-2 border border-paper-line bg-white text-sm focus:outline-none focus:border-ink text-ink"
                      />
                      <Button size="sm" onClick={() => handleReply(post.id)}>Send</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
