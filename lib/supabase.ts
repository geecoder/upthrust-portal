import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── IMPORTANT ──────────────────────────────────────────────────
// Never call createClient() at module top level.
// Next.js evaluates module exports at build time — env vars don't
// exist then, causing "supabaseUrl is required" build errors.
// Always create clients inside functions/components/handlers.

export function createBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Alias used in some API routes
export const createServiceClient = createAdminClient;
