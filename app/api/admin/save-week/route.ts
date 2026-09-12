export const dynamic = 'force-dynamic';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { pickAllowedFields, WEEK_ADMIN_EDITABLE } from '@/lib/request-fields';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { id } = body ?? {};
  if (!id) return NextResponse.json({ error: 'week id required' }, { status: 400 });

  // The editor posts the whole week row, so `id` and the read-only calendar
  // columns are ignored rather than refused. Anything outside the allowlist —
  // notably is_published, which belongs to /api/admin/publish-week — is a 400.
  const picked = pickAllowedFields(body, WEEK_ADMIN_EDITABLE, {
    ignore: ['id', 'week_number', 'title', 'phase', 'start_date', 'end_date',
             'session_date', 'created_at', 'updated_at'],
  });
  if (!picked.ok) {
    return NextResponse.json({ error: picked.error, rejected: picked.rejected }, { status: picked.status });
  }

  const db = createAdminClient();
  const { error } = await db.from('weeks').update(picked.values).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
