import { redirect } from 'next/navigation';
import { Building2, ShieldCheck } from 'lucide-react';

import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { TenantsTable, type TenantRow } from '@/components/tenants-table';

export const dynamic = 'force-dynamic';

export default async function TenantsListPage() {
  const user = await requireSuperAdmin();
  if (!user) redirect('/login');

  const supabase = getSupabaseServerClient();

  /* Fetch tenants with related database + branding + template name ---------- */
  const { data, error } = await supabase
    .from('tenants')
    .select(
      `
        id,
        commercial_name,
        slug,
        commercial_status,
        technical_status,
        business_template_id,
        business_templates (
          name
        ),
        tenant_databases (
          connection_status
        ),
        tenant_branding (
          primary_color,
          logo_url
        )
      `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/tenants] fetch error', error.message);
  }

  const rows: TenantRow[] = (data ?? []).map((t: any) => ({
    id: t.id,
    commercial_name: t.commercial_name,
    slug: t.slug,
    commercial_status: t.commercial_status,
    technical_status: t.technical_status,
    template_name: t.business_templates?.name ?? null,
    connection_status: t.tenant_databases?.[0]?.connection_status ?? null,
    branding_primary: t.tenant_branding?.[0]?.primary_color ?? null,
    branding_logo_url: t.tenant_branding?.[0]?.logo_url ?? null,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                Panel Super Admin
              </h1>
              <p className="text-xs text-muted-foreground">
                VORA · {user.email}
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="/admin/tenants"
              className="rounded-md bg-muted px-3 py-1.5 font-medium text-foreground"
            >
              Empresas
            </a>
            <a
              href="/admin"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Inicio
            </a>
          </nav>
        </div>
      </header>

      {/* Page body */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Empresas</h2>
            <p className="text-sm text-muted-foreground">
              Administra todas las empresas (tenants) de la plataforma, su
              configuración, estado y conexión de base de datos.
            </p>
          </div>
        </div>

        <TenantsTable tenants={rows} />
      </main>
    </div>
  );
}
