import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { weekNumber, submissionUrl, submissionNote } = body;

  if (!weekNumber || !submissionUrl) {
    return NextResponse.json({ error: 'weekNumber and submissionUrl are required' }, { status: 400 });
  }

  const db = createServiceClient();

  // Get learner
  const { data: learner } = await db
    .from('learners').select('id, pathway').eq('clerk_user_id', userId).single();

  if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });

  // Get week for assignment title
  const { data: week } = await db
    .from('weeks').select('*').eq('week_number', weekNumber).single();

  if (!week || !week.is_unlocked) {
    return NextResponse.json({ error: 'Week not found or locked' }, { status: 404 });
  }

  const assignment = learner.pathway === 'pm' ? week.pm_assignment : week.ba_assignment;

  // Upsert submission (allow resubmission)
  const { data: submission, error } = await db
    .from('submissions')
    .upsert({
      learner_id: learner.id,
      week_number: weekNumber,
      pathway: learner.pathway,
      assignment_title: assignment?.title || `Week ${weekNumber} Assignment`,
      submission_url: submissionUrl,
      submission_note: submissionNote || null,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'learner_id,week_number' })
    .select()
    .single();

  if (error) {
    console.error('Submission error:', error);
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }

  // Update learner progress
  await db
    .from('learner_progress')
    .upsert({
      learner_id: learner.id,
      week_number: weekNumber,
      assignment_submitted: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'learner_id,week_number' });

  // Recalculate assignment completion %
  const { data: allProgress } = await db
    .from('learner_progress')
    .select('assignment_submitted')
    .eq('learner_id', learner.id);

  const submittedCount = (allProgress || []).filter(p => p.assignment_submitted).length;
  const pct = Math.round((submittedCount / 12) * 100);

  await db
    .from('learners')
    .update({ assignment_completion_percent: pct })
    .eq('id', learner.id);

  return NextResponse.json({ submission });
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient();
  const { data: learner } = await db
    .from('learners').select('id').eq('clerk_user_id', userId).single();

  if (!learner) return NextResponse.json({ submissions: [] });

  const { data: submissions } = await db
    .from('submissions').select('*')
    .eq('learner_id', learner.id)
    .order('submitted_at', { ascending: false });

  return NextResponse.json({ submissions: submissions || [] });
}
