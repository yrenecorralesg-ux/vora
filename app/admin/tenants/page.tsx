import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Plus } from 'lucide-react';

import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { TenantsTable, type TenantRow } from '@/components/tenants-table';
import type { CommercialStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TenantsListPage() {
  const user = await requireSuperAdmin();
  if (!user) redirect('/login?redirect=/admin/tenants');

  const supabase = getSupabaseServerClient();
  const [{ data, error }, { data: plans }] = await Promise.all([
    supabase
      .from('tenants')
      .select(
        'id, commercial_name, legal_name, tax_id, slug, commercial_status, technical_status, infrastructure_mode, plan_id, created_at, plans ( name )',
      )
      .order('created_at', { ascending: false }),
    supabase.from('plans').select('id, name').order('name'),
  ]);

  if (error) console.error('[admin/tenants] fetch error', error.message);

  const rows: TenantRow[] = (data ?? []).map((t: any) => ({
    id: t.id,
    commercial_name: t.commercial_name,
    legal_name: t.legal_name ?? null,
    tax_id: t.tax_id ?? null,
    slug: t.slug,
    commercial_status: t.commercial_status,
    technical_status: t.technical_status,
    infrastructure_mode: t.infrastructure_mode ?? 'shared',
    plan_id: t.plan_id ?? null,
    plan_name: t.plans?.name ?? null,
    created_at: t.created_at,
  }));

  const count = (status: CommercialStatus) => rows.filter((row) => row.commercial_status === status).length;
  const stats = [
    { label: 'Empresas', value: rows.length },
    { label: 'Activas', value: count('active') },
    { label: 'Pendientes', value: count('pending') + count('trial') },
    { label: 'Suspendidas', value: count('suspended') },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A4573A]">VORA Core</p>
          <h1 className="mt-2 font-jakarta text-3xl font-extrabold tracking-[-0.02em] text-[#285C49]">Empresas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52675A]">
            Registra empresas, asigna su plan y modalidad de infraestructura y administra su estado.
          </p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#285C49] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1F4A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Registrar empresa
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[#E2DACB] bg-white px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#52675A]">{stat.label}</dt>
            <dd className="mt-1 font-jakarta text-3xl font-extrabold text-[#285C49]">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {error && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-[#E9C9B8] bg-[#FBF1EA] p-4 text-sm text-[#8A4528]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            No se pudo cargar el listado de empresas. Si es la primera vez que usas esta versión, aplica la migración{' '}
            <code className="rounded bg-white px-1.5 py-0.5">20261017000000_vora_tenant_management.sql</code> en Supabase.
          </p>
        </div>
      )}

      <TenantsTable tenants={rows} plans={(plans ?? []) as { id: string; name: string }[]} />
    </div>
  );
}
