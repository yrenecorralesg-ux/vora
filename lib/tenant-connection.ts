const SUPABASE_HOST_RE = /^[a-z0-9-]+\.supabase\.co$/i;

export function validateTenantSupabaseTarget(projectRef: string, rawUrl: string): URL | null {
  if (!/^[a-z0-9-]{6,80}$/i.test(projectRef)) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !SUPABASE_HOST_RE.test(url.hostname)) return null;
  if (url.hostname.split('.')[0].toLowerCase() !== projectRef.toLowerCase()) return null;
  return url;
}

export function getTenantSecret(secretRef: string): string | null {
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(secretRef)) return null;
  return process.env[secretRef] ?? null;
}
