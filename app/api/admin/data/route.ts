export const dynamic = 'force-dynamic';

/**
 * Unified admin/learner data API — uses the service-role client to bypass RLS.
 * Every write (and RLS-sensitive read) routes through here so the browser
 * anon client is never blocked by row-level security.
 *
 * Auth: requires a signed-in Clerk user. Admin-only actions additionally
 * verify the user matches ADMIN_USER_ID.
 */

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// Pull the first absolute http(s) URL out of an arbitrary string.
// Zoom invites are often pasted as a full blob ("X is inviting you to a
// scheduled Zoom meeting... https://zoom.us/j/123..."). We store only the URL.
function extractUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  // If it's already a clean absolute URL, keep it.
  if (/^https?:\/\/\S+$/i.test(text)) return text;
  // Otherwise find the first URL inside the text.
  const match = text.match(/https?:\/\/[^\s<>"')]+/i);
  if (match) return match[0];
  // No URL found — return null so we never store a non-URL as a link.
  return null;
}

async function getLearner(db: any, clerkUserId: string) {
  const { data } = await db.from('learners').select('*').eq('clerk_user_id', clerkUserId).maybeSingle();
  return data;
}

function isAdmin(userId: string) {
  return !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {

      // ─────────────────────────────────────────────────────────
      // PROFILE — update own learner record
      // ─────────────────────────────────────────────────────────
      case 'update_profile': {
        const learner = await getLearner(db, userId);
        if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
        const { fields } = body;
        const { error } = await db.from('learners').update(fields).eq('id', learner.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ─────────────────────────────────────────────────────────
      // ADMIN: correct a learner's core enrolment fields
      // (pathway, tier, enrollment_status). Used to fix mis-set tracks.
      // ─────────────────────────────────────────────────────────
      case 'admin_update_learner': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { learnerId, fields } = body;
        const allowed: Record<string, any> = {};
        if (fields.pathway === 'PM' || fields.pathway === 'BA') allowed.pathway = fields.pathway;
        if (fields.tier) allowed.tier = fields.tier;
        if (fields.enrollment_status) allowed.enrollment_status = fields.enrollment_status;
        if (Object.keys(allowed).length === 0)
          return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        const { error } = await db.from('learners').update(allowed).eq('id', learnerId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ─────────────────────────────────────────────────────────
      // PORTFOLIO — add / edit / delete own artefacts
      // ─────────────────────────────────────────────────────────
      case 'portfolio_add': {
        const learner = await getLearner(db, userId);
        if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
        const { item } = body;
        const { data, error } = await db.from('portfolio_items').insert({
          learner_id: learner.id,
          title: item.title,
          description: item.description || null,
          artefact_type: item.artefact_type || null,
          url: item.url,
          week_number: item.week_number ? parseInt(item.week_number) : null,
          status: 'Submitted',
          submitted_at: new Date().toISOString(),
        }).select('id').maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, id: data?.id });
      }

      case 'portfolio_edit': {
        const learner = await getLearner(db, userId);
        if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
        const { itemId, item } = body;
        const { error } = await db.from('portfolio_items').update({
          title: item.title,
          description: item.description || null,
          artefact_type: item.artefact_type || null,
          url: item.url,
          week_number: item.week_number ? parseInt(item.week_number) : null,
        }).eq('id', itemId).eq('learner_id', learner.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case 'portfolio_delete': {
        const learner = await getLearner(db, userId);
        if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
        const { itemId } = body;
        const { error } = await db.from('portfolio_items').delete().eq('id', itemId).eq('learner_id', learner.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ─────────────────────────────────────────────────────────
      // COMMUNITY — post / reply / like
      // ─────────────────────────────────────────────────────────
      case 'community_post': {
        const learner = await getLearner(db, userId);
        const adminPost = isAdmin(userId);
        if (!learner && !adminPost) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
        const { post } = body;
        const { data, error } = await db.from('community_posts').insert({
          learner_id: learner?.id || null,
          author_name: adminPost ? 'Genesis (Upthrust)' : `${learner.first_name} ${learner.last_name || ''}`.trim(),
          is_from_genesis: adminPost,
          category: post.category || 'General',
          content: post.content,
          likes_count: 0,
          replies_count: 0,
          is_pinned: false,
        }).select('id').maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, id: data?.id });
      }

      case 'community_reply': {
        const learner = await getLearner(db, userId);
        const adminReply = isAdmin(userId);
        if (!learner && !adminReply) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
        const { postId, content } = body;
        const { error } = await db.from('community_replies').insert({
          post_id: postId,
          learner_id: learner?.id || null,
          author_name: adminReply ? 'Genesis (Upthrust)' : `${learner.first_name} ${learner.last_name || ''}`.trim(),
          is_from_genesis: adminReply,
          content,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        // bump reply count
        const { data: p } = await db.from('community_posts').select('replies_count').eq('id', postId).maybeSingle();
        await db.from('community_posts').update({ replies_count: (p?.replies_count || 0) + 1 }).eq('id', postId);
        return NextResponse.json({ success: true });
      }

      case 'community_like': {
        const { postId, newCount } = body;
        const { error } = await db.from('community_posts').update({ likes_count: newCount }).eq('id', postId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ─────────────────────────────────────────────────────────
      // ADMIN: announcements (+ create notifications for learners)
      // ─────────────────────────────────────────────────────────
      case 'post_announcement': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { title, content, priority, target } = body;

        const { data: ann, error } = await db.from('announcements').insert({
          title, content, priority: priority || 'Normal',
          target_pathway: target || 'All',
          is_published: true,
          created_at: new Date().toISOString(),
        }).select('id').maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Create in-portal notifications for every targeted learner
        const { data: learners } = await db.from('learners').select('id, pathway')
          .neq('enrollment_status', 'Withdrawn');
        const targeted = (learners || []).filter((l: any) =>
          target === 'All' || !target || l.pathway === target
        );
        if (targeted.length > 0) {
          const notifs = targeted.map((l: any) => ({
            learner_id: l.id,
            type: 'announcement',
            title: `📣 ${title}`,
            message: content,
            is_read: false,
            created_at: new Date().toISOString(),
          }));
          await db.from('notifications').insert(notifs);
        }
        return NextResponse.json({ success: true, id: ann?.id, notified: targeted.length });
      }

      // ─────────────────────────────────────────────────────────
      // ADMIN: create a notification for one/all learners (generic)
      // ─────────────────────────────────────────────────────────
      case 'create_notifications': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { learnerIds, type, title, message } = body;
        const rows = (learnerIds as string[]).map(id => ({
          learner_id: id, type: type || 'announcement',
          title, message, is_read: false, created_at: new Date().toISOString(),
        }));
        const { error } = await db.from('notifications').insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, count: rows.length });
      }

      // ─────────────────────────────────────────────────────────
      // ADMIN: review feedback on an assignment
      // ─────────────────────────────────────────────────────────
      case 'review_feedback': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { assignmentId, status, score, feedback } = body;
        const { data: a, error } = await db.from('assignments').update({
          status, score: score ?? null, feedback: feedback || null,
          feedback_by: 'Genesis', feedback_at: new Date().toISOString(),
        }).eq('id', assignmentId).select('learner_id, week_number').maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // notify the learner
        if (a?.learner_id) {
          await db.from('notifications').insert({
            learner_id: a.learner_id,
            type: status === 'Resubmission Requested' ? 'resubmission_required' : 'feedback_ready',
            title: status === 'Resubmission Requested'
              ? `↩ Revision requested — Week ${a.week_number}`
              : `✓ Feedback ready — Week ${a.week_number}`,
            message: feedback || 'Genesis has reviewed your submission.',
            is_read: false, created_at: new Date().toISOString(),
          });
        }
        return NextResponse.json({ success: true });
      }

      // ─────────────────────────────────────────────────────────
      // ADMIN: create / update a live session
      // ─────────────────────────────────────────────────────────
      case 'save_session': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { session } = body;
        // Extract a clean absolute URL from whatever was pasted (full Zoom
        // invite blobs are common). Falls back to the raw value if no URL found.
        const cleanZoom = extractUrl(session.zoom_link);
        const cleanRecording = extractUrl(session.recording_url);
        if (session.id) {
          const { error } = await db.from('sessions').update({
            title: session.title, week_number: session.week_number,
            session_date: session.session_date, start_time: session.start_time,
            zoom_link: cleanZoom, description: session.description || null,
            recording_url: cleanRecording || null,
          }).eq('id', session.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, id: session.id });
        } else {
          const { data, error } = await db.from('sessions').insert({
            title: session.title, week_number: session.week_number,
            session_date: session.session_date, start_time: session.start_time,
            zoom_link: cleanZoom, description: session.description || null,
            recording_url: cleanRecording || null,
          }).select('id').maybeSingle();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, id: data?.id });
        }
      }

      case 'delete_session': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { sessionId } = body;
        const { error } = await db.from('sessions').delete().eq('id', sessionId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // ─────────────────────────────────────────────────────────
      // ADMIN: attendance marking (single + bulk).
      // Recomputes the learner's attendance_pct over sessions held so far.
      // ─────────────────────────────────────────────────────────
      case 'mark_attendance': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { learnerId, weekNumber, arrival, sessionDate, note } = body;
        if (!learnerId || weekNumber === undefined || !arrival)
          return NextResponse.json({ error: 'learnerId, weekNumber and arrival are required' }, { status: 400 });

        const record: Record<string, any> = {
          learner_id: learnerId,
          week_number: weekNumber,
          attended: arrival !== 'Absent',
          arrival,
          session_date: sessionDate || null,
        };
        if (note !== undefined) record.notes = note;

        // Upsert: update existing row for this learner+week, else insert.
        const { data: existing } = await db.from('attendance').select('id')
          .eq('learner_id', learnerId).eq('week_number', weekNumber).maybeSingle();
        if (existing) {
          const { error } = await db.from('attendance').update(record).eq('id', existing.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        } else {
          const { error } = await db.from('attendance').insert(record);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Recompute attendance_pct over sessions held so far (weeks 0..weekNumber).
        const sessionsHeld = Math.max(weekNumber + 1, 1);
        const { data: allAtt } = await db.from('attendance').select('attended')
          .eq('learner_id', learnerId);
        const attended = (allAtt || []).filter((a: any) => a.attended).length;
        const pct = Math.round((attended / sessionsHeld) * 100);
        await db.from('learners').update({ attendance_pct: pct }).eq('id', learnerId);

        return NextResponse.json({ success: true, attendance_pct: pct });
      }

      case 'mark_all_attendance': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { weekNumber, arrival, sessionDate } = body;
        if (weekNumber === undefined || !arrival)
          return NextResponse.json({ error: 'weekNumber and arrival are required' }, { status: 400 });

        const { data: learners } = await db.from('learners').select('id')
          .neq('enrollment_status', 'Withdrawn');
        const { data: existingRows } = await db.from('attendance').select('id, learner_id')
          .eq('week_number', weekNumber);
        const existingByLearner = new Map((existingRows || []).map((r: any) => [r.learner_id, r.id]));

        const sessionsHeld = Math.max(weekNumber + 1, 1);
        for (const l of (learners || [])) {
          const record = {
            learner_id: l.id,
            week_number: weekNumber,
            attended: arrival !== 'Absent',
            arrival,
            session_date: sessionDate || null,
          };
          const existingId = existingByLearner.get(l.id);
          if (existingId) await db.from('attendance').update(record).eq('id', existingId);
          else await db.from('attendance').insert(record);

          const { data: allAtt } = await db.from('attendance').select('attended').eq('learner_id', l.id);
          const attended = (allAtt || []).filter((a: any) => a.attended).length;
          const pct = Math.round((attended / sessionsHeld) * 100);
          await db.from('learners').update({ attendance_pct: pct }).eq('id', l.id);
        }
        return NextResponse.json({ success: true });
      }

      case 'update_attendance_note': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { learnerId, weekNumber, note } = body;
        const { data: existing } = await db.from('attendance').select('id')
          .eq('learner_id', learnerId).eq('week_number', weekNumber).maybeSingle();
        if (existing) {
          await db.from('attendance').update({ notes: note || null }).eq('id', existing.id);
        } else {
          // No row yet — create a minimal one so the note isn't lost.
          await db.from('attendance').insert({ learner_id: learnerId, week_number: weekNumber, notes: note || null, attended: false });
        }
        return NextResponse.json({ success: true });
      }

      // ─────────────────────────────────────────────────────────
      // ADMIN: create / update a resource (fixes vanishing links)
      // Writes through service role so the payload is never dropped.
      // ─────────────────────────────────────────────────────────
      case 'save_resource': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { resource } = body;
        const payload = {
          title: resource.title,
          description: resource.description || null,
          resource_type: resource.resource_type,
          pathway: resource.pathway || 'Both',
          week_number: resource.week_number ?? null,
          content_level: resource.content_level || 'All Levels',
          link_type: resource.link_type || 'url',
          external_url: resource.external_url || null,
          notion_url: resource.notion_url || null,
          youtube_url: resource.youtube_url || null,
          assignment_context: resource.assignment_context || null,
          duration_mins: resource.duration_mins ?? null,
          is_featured: !!resource.is_featured,
          is_active: resource.is_active !== false,
          tags: resource.tags || null,
        };
        if (resource.id) {
          const { error } = await db.from('resources').update(payload).eq('id', resource.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, id: resource.id });
        } else {
          const { data, error } = await db.from('resources').insert(payload).select('id').maybeSingle();
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          return NextResponse.json({ success: true, id: data?.id });
        }
      }

      case 'delete_resource': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { resourceId } = body;
        const { error } = await db.from('resources').delete().eq('id', resourceId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case 'toggle_resource': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { resourceId, field, value } = body;
        if (!['is_active', 'is_featured'].includes(field))
          return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
        const { error } = await db.from('resources').update({ [field]: value }).eq('id', resourceId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[admin/data] error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ── GET: RLS-safe reads (admin reads all; learner reads own) ──────
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const url = new URL(req.url);
  const resource = url.searchParams.get('resource');

  try {
    switch (resource) {
      case 'active_learners': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        // Count anyone enrolled who isn't withdrawn — Pending + Active both count,
        // so newly signed-up learners are immediately targetable.
        const { data } = await db.from('learners').select('*')
          .neq('enrollment_status', 'Withdrawn').order('first_name');
        return NextResponse.json({ learners: data || [] });
      }
      case 'all_learners': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { data } = await db.from('learners').select('*').order('first_name');
        return NextResponse.json({ learners: data || [] });
      }
      case 'attendance': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        // Learners + all attendance rows in one call (admin client bypasses RLS).
        const [{ data: learners }, { data: attendance }] = await Promise.all([
          db.from('learners').select('*').neq('enrollment_status', 'Withdrawn').order('first_name'),
          db.from('attendance').select('*'),
        ]);
        return NextResponse.json({ learners: learners || [], attendance: attendance || [] });
      }
      case 'review_queue': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const [{ data: assignments }, { data: learners }, { data: weeks }] = await Promise.all([
          db.from('assignments').select('*').order('submitted_at', { ascending: false }),
          db.from('learners').select('*').order('first_name'),
          db.from('weeks').select('*').order('week_number'),
        ]);
        return NextResponse.json({
          assignments: assignments || [], learners: learners || [], weeks: weeks || [],
        });
      }
      case 'announcements': {
        const { data } = await db.from('announcements').select('*')
          .order('created_at', { ascending: false });
        return NextResponse.json({ announcements: data || [] });
      }
      case 'sessions': {
        const { data } = await db.from('sessions').select('*')
          .order('session_date', { ascending: true });
        return NextResponse.json({ sessions: data || [] });
      }
      case 'resources': {
        if (!isAdmin(userId)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        const { data } = await db.from('resources').select('*')
          .order('created_at', { ascending: false });
        return NextResponse.json({ resources: data || [] });
      }
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
