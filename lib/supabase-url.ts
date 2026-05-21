const REST_PATH_SUFFIX = /\/rest\/v1\/?$/i;

export function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(REST_PATH_SUFFIX, '');
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  return normalizeSupabaseUrl(url);
}
