export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { weekNumber, pathway, submissionUrl, submissionNotes } = body;

  if (!weekNumber && weekNumber !== 0) {
    return NextResponse.json({ error: 'weekNumber is required' }, { status: 400 });
  }
  if (!submissionUrl) {
    return NextResponse.json({ error: 'submissionUrl is required' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: learner } = await db
    .from('learners')
    .select('id, pathway')
    .eq('clerk_user_id', userId)
    .single();

  if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });

  const assignmentPathway = pathway || learner.pathway || 'PM';

  const { data: existing } = await db
    .from('assignments')
    .select('id')
    .eq('learner_id', learner.id)
    .eq('week_number', weekNumber)
    .eq('pathway', assignmentPathway)
    .single();

  let result;
  if (existing) {
    const { data, error } = await db
      .from('assignments')
      .update({
        submission_url: submissionUrl,
        submission_notes: submissionNotes || null,
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    const { data, error } = await db
      .from('assignments')
      .insert({
        learner_id: learner.id,
        week_number: weekNumber,
        pathway: assignmentPathway,
        submission_url: submissionUrl,
        submission_notes: submissionNotes || null,
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) {
    console.error('Submission error:', result.error);
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }

  return NextResponse.json({ assignment: result.data });
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();

  const { data: learner } = await db
    .from('learners')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();

  if (!learner) return NextResponse.json({ assignments: [] });

  const { data: assignments } = await db
    .from('assignments')
    .select('*')
    .eq('learner_id', learner.id)
    .order('week_number', { ascending: true });

  return NextResponse.json({ assignments: assignments || [] });
}
