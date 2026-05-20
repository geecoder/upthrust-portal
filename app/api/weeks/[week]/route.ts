import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { week: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekNumber = parseInt(params.week);
  if (isNaN(weekNumber) || weekNumber < 0 || weekNumber > 12) {
    return NextResponse.json({ error: 'Invalid week' }, { status: 400 });
  }

  const db = createServiceClient();

  // Get week
  const { data: week } = await db
    .from('weeks').select('*').eq('week_number', weekNumber).single();

  if (!week || !week.is_unlocked) {
    return NextResponse.json({ error: 'Week not found or locked' }, { status: 404 });
  }

  // Get learner
  const { data: learner } = await db
    .from('learners').select('id, pathway').eq('clerk_user_id', userId).single();

  // Get submission if learner exists
  let submission = null;
  if (learner) {
    const { data } = await db
      .from('submissions').select('*')
      .eq('learner_id', learner.id)
      .eq('week_number', weekNumber)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();
    submission = data;
  }

  return NextResponse.json({ week, submission, learner });
}
