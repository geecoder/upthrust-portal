export const dynamic = 'force-dynamic';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { weekId, isPublished } = await req.json();
  if (!weekId) return NextResponse.json({ error: 'weekId required' }, { status: 400 });
  const db = createAdminClient();
  const { error } = await db.from('weeks').update({ is_published: isPublished }).eq('id', weekId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
