import Link from 'next/link';
import { Clock3, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EkosLogo } from '@/components/ekos-logo';
import { AdminLogout } from '@/components/admin-logout';

export default function AccessPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md text-center">
        <EkosLogo className="mb-12 justify-center" textClassName="text-primary" />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
          <Clock3 className="h-8 w-8 text-warning" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-foreground">Acceso pendiente</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Tu cuenta esta autenticada, pero todavia no tiene una membresia activa en una empresa EKOSCRM.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild><Link href="/">Volver al inicio</Link></Button>
          <AdminLogout className="text-foreground hover:bg-muted hover:text-foreground" />
        </div>
      </div>
    </main>
  );
}
