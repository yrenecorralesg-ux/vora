import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Layers,
  CreditCard,
  Users,
  ScrollText,
  Menu,
} from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth';
import { EkosLogo } from '@/components/ekos-logo';
import { AdminLogout } from '@/components/admin-logout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/tenants', label: 'Empresas', icon: Building2 },
  { href: '/admin/modules', label: 'Modulos', icon: Layers },
  { href: '/admin/plans', label: 'Planes', icon: CreditCard },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/audit', label: 'Auditoria', icon: ScrollText },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSuperAdmin();
  if (!user) {
    redirect('/login?redirect=/admin');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground md:hidden">
        <EkosLogo />
        <label className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-primary-foreground/10">
          <Menu className="h-5 w-5" />
          <input type="checkbox" className="peer hidden" />
          {/* Mobile dropdown via peer-checked */}
          <div className="fixed inset-x-0 top-[57px] z-50 hidden origin-top bg-primary px-4 pb-4 pt-2 shadow-lg peer-checked:block">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="my-2 h-px bg-primary-foreground/10" />
              <div className="px-3 py-1 text-xs text-primary-foreground/60">
                {user.email}
              </div>
              <AdminLogout />
            </div>
          </div>
        </label>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 flex-col bg-primary text-primary-foreground md:flex">
          <div className="flex h-16 items-center border-b border-primary-foreground/10 px-6">
            <EkosLogo />
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-primary-foreground/10 p-4">
            <div className="mb-2 truncate px-3 text-xs text-primary-foreground/60">
              {user.email}
            </div>
            <AdminLogout />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Desktop header */}
          <header className="hidden h-16 items-center justify-between border-b bg-card px-6 md:flex">
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Panel de Super Administrador
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
