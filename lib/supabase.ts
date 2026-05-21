import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './supabase-url';

// IMPORTANT
// Never call createClient() at module top level.
// Next.js evaluates module exports at build time, and env vars may not
// exist then, causing "supabaseUrl is required" build errors.
// Always create clients inside functions/components/handlers.
export function createBrowserClient(): SupabaseClient {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(getSupabaseUrl(), key);
}
