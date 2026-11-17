'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuleEntry {
  key: string;
  label: string;
  title: string;
  href: string;
  icon: typeof ShoppingCart;
  enabled: boolean;
}

/**
 * Selector de módulos del portal de la empresa (POS ↔ Warehouse).
 * Escritorio: barra vertical fija a la izquierda. Móvil: barra flotante inferior.
 * Los módulos no activos solo se muestran al Super Admin, atenuados.
 */
export function ModuleRail({
  slug,
  tenantId,
  enabledFeatures,
  isSuperAdmin,
}: {
  slug: string;
  tenantId: string;
  enabledFeatures: string[];
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const modules: ModuleEntry[] = [
    { key: 'commerce.pos', label: 'POS', title: 'VORA POS · Punto de venta', href: `/t/${slug}/pos`, icon: ShoppingCart, enabled: enabledFeatures.includes('commerce.pos') },
    { key: 'warehouse.inventory', label: 'Warehouse', title: 'VORA Warehouse · Inventario', href: `/t/${slug}/warehouse`, icon: Warehouse, enabled: enabledFeatures.includes('warehouse.inventory') },
  ].filter((m) => m.enabled || isSuperAdmin);

  if (modules.length === 0 || (modules.length === 1 && !isSuperAdmin)) return null;

  const items = modules.map((m) => {
    const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
    const Icon = m.icon;
    return { ...m, active, Icon };
  });

  return (
    <>
      <nav aria-label="Módulos" className="sticky top-0 z-30 hidden h-screen w-[68px] shrink-0 flex-col items-center gap-1 bg-[#0F2E22] py-3 md:flex print:hidden">
        <span className="mb-2 text-[10px] font-black tracking-widest text-white/50">VORA</span>
        {items.map(({ key, label, title, href, enabled, active, Icon }) => (
          <Link
            key={key}
            href={href}
            title={enabled ? title : `${title} (no activo: actívalo desde Core)`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors',
              active ? 'bg-white text-[#0F2E22]' : 'text-white/75 hover:bg-white/10 hover:text-white',
              !enabled && 'opacity-50',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
            {!enabled && <span className="text-[8px] font-normal">no activo</span>}
          </Link>
        ))}
        {isSuperAdmin && (
          <Link
            href={`/admin/tenants/${tenantId}`}
            title="Volver al gestor de empresas"
            className="mt-auto flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            Gestor
          </Link>
        )}
      </nav>

      <nav aria-label="Módulos" className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl bg-[#0F2E22] p-1 shadow-xl md:hidden print:hidden">
        {items.map(({ key, label, href, enabled, active, Icon }) => (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold',
              active ? 'bg-white text-[#0F2E22]' : 'text-white/80',
              !enabled && 'opacity-50',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
