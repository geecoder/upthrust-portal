export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect('/portal');
  redirect('/auth/sign-in');
}
