import Link from 'next/link';
import { Clock3, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoraLogo } from '@/components/landing/vora-logo';
import { AdminLogout } from '@/components/admin-logout';

export default function AccessPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F2E9] px-6 py-16 font-inter text-[#25332D]">
      <div className="w-full max-w-md text-center">
        <Link href="/" aria-label="VORA by Venesoft, inicio" className="mb-12 inline-flex">
          <VoraLogo height={40} />
        </Link>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F3E2D2]">
          <Clock3 className="h-8 w-8 text-[#A4573A]" />
        </div>
        <h1 className="mt-6 font-jakarta text-2xl font-extrabold text-[#285C49]">Acceso pendiente</h1>
        <p className="mt-3 text-sm leading-6 text-[#52675A]">
          Tu cuenta está autenticada, pero todavía no tiene una membresía activa en una empresa de VORA.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="rounded-full bg-[#285C49] hover:bg-[#1F4A3A]"><Link href="/">Volver al inicio</Link></Button>
          <AdminLogout className="text-foreground hover:bg-muted hover:text-foreground" />
        </div>
      </div>
    </main>
  );
}
