export const VORA_DOMAIN = 'vora.venesoftca.com';
export const RESERVED_SLUGS = [
  'www',
  'admin',
  'api',
  'auth',
  'login',
  'app',
  'mail',
  'support',
  'billing',
  'status',
  't',
];
export function validTenantSlug(value: string): boolean {
  return (
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) &&
    !RESERVED_SLUGS.includes(value)
  );
}
export function tenantHostname(slug: string): string {
  return `${slug}.${VORA_DOMAIN}`;
}
export function venezuelaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
