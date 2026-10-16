import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { getUserMemberships, requireSession } from '@/lib/auth';
import { EkosLogo } from '@/components/ekos-logo';
import { Card, CardContent } from '@/components/ui/card';
import { AdminLogout } from '@/components/admin-logout';

export const dynamic = 'force-dynamic';

export default async function SelectTenantPage() {
  const user = await requireSession();
  if (!user) redirect('/login');
  const memberships = await getUserMemberships(user.id);

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <EkosLogo textClassName="text-primary" />
        <div className="mt-16 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Tu espacio de trabajo</p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Elige una empresa</h1>
          <p className="mt-3 text-muted-foreground">Tienes acceso a mas de una empresa. Selecciona donde quieres continuar.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {memberships.map((membership) => {
            const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
            if (!tenant) return null;
            return (
              <Link key={membership.id} href={`/t/${tenant.slug}`}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Building2 className="h-5 w-5" /></div>
                    <div><p className="font-semibold text-foreground">{tenant.commercial_name}</p><p className="mt-1 text-xs text-muted-foreground">Rol: {membership.role}</p></div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
        {memberships.length === 0 && <p className="mt-8 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No tienes membresias activas.</p>}
        <div className="mt-8"><AdminLogout /></div>
      </div>
    </main>
  );
}
