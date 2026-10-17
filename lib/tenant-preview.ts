export function canPreviewTenant(
  isSuperAdmin: boolean,
  requested: boolean,
  hasMembership: boolean,
): boolean {
  return isSuperAdmin && (requested || !hasMembership);
}

export function parseTenantBanners(value: string | null | undefined): {
  header: string | null;
  sidebar: string | null;
} {
  if (!value) return { header: null, sidebar: null };
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      return {
        header: typeof record.header === 'string' ? record.header : null,
        sidebar: typeof record.sidebar === 'string' ? record.sidebar : null,
      };
    }
  } catch {
    return { header: value, sidebar: null };
  }
  return { header: null, sidebar: null };
}
