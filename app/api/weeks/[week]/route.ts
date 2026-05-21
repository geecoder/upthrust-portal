export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

// Next.js 15: params must be typed as Promise and awaited
export async function GET(
  req: Request,
  { params }: { params: Promise<{ week: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { week } = await params;
  const weekNumber = parseInt(week);

  if (isNaN(weekNumber) || weekNumber < 0 || weekNumber > 12) {
    return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: weekData, error } = await db
    .from('weeks')
    .select('*')
    .eq('week_number', weekNumber)
    .eq('is_published', true)
    .single();

  if (error || !weekData) {
    return NextResponse.json({ error: 'Week not found or not published' }, { status: 404 });
  }

  const { data: learner } = await db
    .from('learners')
    .select('id, pathway')
    .eq('clerk_user_id', userId)
    .single();

  let assignment = null;
  if (learner) {
    const { data } = await db
      .from('assignments')
      .select('*')
      .eq('learner_id', learner.id)
      .eq('week_number', weekNumber)
      .eq('pathway', learner.pathway || 'PM')
      .single();
    assignment = data;
  }

  return NextResponse.json({ week: weekData, assignment, learner });
}
