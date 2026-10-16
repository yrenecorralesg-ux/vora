import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { getUserMemberships, requireSession } from '@/lib/auth';
import { VoraLogo } from '@/components/landing/vora-logo';
import { Card, CardContent } from '@/components/ui/card';
import { AdminLogout } from '@/components/admin-logout';

export const dynamic = 'force-dynamic';

export default async function SelectTenantPage() {
  const user = await requireSession();
  if (!user) redirect('/login');
  const memberships = await getUserMemberships(user.id);

  return (
    <main className="min-h-screen bg-[#F6F2E9] px-6 py-12 font-inter text-[#25332D]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" aria-label="VORA by Venesoft, inicio" className="inline-flex">
          <VoraLogo />
        </Link>
        <div className="mt-16 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#A4573A]">Tu espacio de trabajo</p>
          <h1 className="mt-3 font-jakarta text-3xl font-extrabold text-[#285C49]">Elige una empresa</h1>
          <p className="mt-3 text-[#52675A]">Tienes acceso a más de una empresa. Selecciona dónde quieres continuar.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {memberships.map((membership) => {
            const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
            if (!tenant) return null;
            return (
              <Link key={membership.id} href={`/t/${tenant.slug}`}>
                <Card className="h-full rounded-2xl border-[#E2DACB] transition hover:-translate-y-0.5 hover:border-[#A9BEA5] hover:shadow-lg">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#285C49] text-white"><Building2 className="h-5 w-5" /></div>
                    <div><p className="font-semibold text-foreground">{tenant.commercial_name}</p><p className="mt-1 text-xs text-muted-foreground">Rol: {membership.role}</p></div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
        {memberships.length === 0 && <p className="mt-8 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No tienes membresías activas.</p>}
        <div className="mt-8"><AdminLogout className="text-[#285C49] hover:bg-[#E6EBDF] hover:text-[#1F4A3A]" /></div>
      </div>
    </main>
  );
}
