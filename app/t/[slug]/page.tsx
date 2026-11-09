import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TenantDashboardPage({
  params,
}: {
  params: { slug: string };
  searchParams?: { preview?: string };
}) {
  // Redirección directa al sistema operativo principal de la empresa (VORA POS)
  redirect(`/t/${params.slug}/pos`);
}
