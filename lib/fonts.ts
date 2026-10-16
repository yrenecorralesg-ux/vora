export const ALLOWED_FONTS = [
  'Inter',
  'Poppins',
  'Roboto',
  'Montserrat',
  'Plus Jakarta Sans',
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];

export const FONT_FAMILY_MAP: Record<string, string> = {
  Inter: 'var(--font-inter), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  Poppins: 'var(--font-poppins), "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  Roboto: 'var(--font-roboto), "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  Montserrat: 'var(--font-montserrat), "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  'Plus Jakarta Sans': 'var(--font-jakarta), "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export function getFontFamily(font?: string | null): string {
  if (!font) {
    return 'var(--font-poppins), "Poppins", var(--font-jakarta), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  return (
    FONT_FAMILY_MAP[font] ||
    `"${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  );
}
