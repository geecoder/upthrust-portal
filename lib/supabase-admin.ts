import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './supabase-url';

export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Alias used in some API routes.
export const createServiceClient = createAdminClient;
