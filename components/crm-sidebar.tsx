'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Store,
  PieChart,
  MessageSquare,
  ShoppingBag,
  ShoppingCart,
  Package,
  TrendingUp,
  ListTodo,
  Megaphone,
  Sparkles,
  FileText,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImagePlaceholder } from '@/components/image-placeholder';

export interface CrmNavItem {
  featureKey: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface CrmSidebarProps {
  tenantId: string;
  slug: string;
  tenantName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarBannerUrl?: string | null;
  enabledFeatures: string[];
  userRole: string;
  isPreview: boolean;
}

export const ALL_CRM_MODULES: CrmNavItem[] = [
  { featureKey: 'crm.dashboard', label: 'Resumen', href: '/t/[slug]', icon: LayoutDashboard },
  { featureKey: 'crm.customers', label: 'Clientes', href: '/t/[slug]/customers', icon: Users },
  { featureKey: 'capture.fairs', label: 'Captura en feria', href: '/t/[slug]/capture', icon: Store },
  { featureKey: 'crm.segments', label: 'Segmentos', href: '/t/[slug]/segments', icon: PieChart },
  { featureKey: 'chatbot.guided_web', label: 'Conversaciones', href: '/t/[slug]/conversations', icon: MessageSquare },
  { featureKey: 'integration.shopify', label: 'Tienda virtual', href: '/t/[slug]/store', icon: ShoppingBag },
  { featureKey: 'crm.orders', label: 'Pedidos', href: '/t/[slug]/orders', icon: ShoppingCart },
  { featureKey: 'crm.products', label: 'Productos', href: '/t/[slug]/products', icon: Package },
  { featureKey: 'crm.sales', label: 'Ventas', href: '/t/[slug]/sales', icon: TrendingUp },
  { featureKey: 'crm.tasks', label: 'Seguimiento', href: '/t/[slug]/tasks', icon: ListTodo },
  { featureKey: 'crm.campaigns', label: 'Campañas', href: '/t/[slug]/campaigns', icon: Megaphone },
  { featureKey: 'analytics.repurchase_pilot', label: 'Predictivo', href: '/t/[slug]/predictive', icon: Sparkles },
  { featureKey: 'integration.siigo', label: 'Facturación SIIGO', href: '/t/[slug]/siigo', icon: FileText },
];

export function CrmSidebar({
  slug,
  tenantName,
  primaryColor,
  secondaryColor,
  sidebarBannerUrl,
  enabledFeatures,
}: CrmSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const base = `/t/${slug}`;
  const isSolee = slug === 'solee';

  // Modular dynamic filtering: always include dashboard, others only if enabled
  const navItems = ALL_CRM_MODULES.filter(
    (item) => item.featureKey === 'crm.dashboard' || enabledFeatures.includes(item.featureKey),
  );

  const isActive = (href: string) => {
    const resolved = href.replace('[slug]', slug);
    if (resolved === base) return pathname === resolved;
    return pathname === resolved || pathname.startsWith(resolved + '/');
  };

  const sidebarBg = isSolee ? '#131126' : primaryColor || '#104735';
  const activeBg = isSolee ? '#5136db' : secondaryColor || '#21805b';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      {/* Top Header / Text Logo (never replaced with random graphic) */}
      <div className="px-5 pt-6 pb-4 text-center">
        {isSolee ? (
          <div className="flex flex-col items-center justify-center">
            <span className="font-serif text-[22px] font-normal tracking-[0.32em] text-white uppercase leading-none">
              SOLEÉ
            </span>
            <span className="mt-1 text-[7.5px] font-medium tracking-[0.42em] text-white/50 uppercase">
              AROMAS & RELACIONES
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <span className="font-serif text-[20px] font-bold tracking-[0.25em] text-white uppercase leading-none">
              {tenantName}
            </span>
            <span className="mt-1 text-[7px] font-medium tracking-[0.35em] text-white/50 uppercase">
              VORA · BUSINESS PLATFORM
            </span>
          </div>
        )}
      </div>

      {/* Navigation List - Compact spacing matching Mockup */}
      <nav className="flex-1 space-y-1 px-3 py-1 font-sans overflow-y-auto custom-scrollbar-dark pr-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const resolved = item.href.replace('[slug]', slug);

          return (
            <Link
              key={item.featureKey}
              href={resolved}
              onClick={() => setOpen(false)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150',
                active
                  ? 'text-white shadow-md'
                  : 'text-[#8f92a9] hover:bg-white/5 hover:text-white',
              )}
              style={
                active
                  ? {
                      backgroundColor: activeBg,
                      boxShadow: '0 4px 14px -1px rgba(20, 100, 69, 0.35)',
                    }
                  : undefined
              }
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform group-hover:scale-105',
                  active ? 'text-white' : 'text-[#8f92a9] group-hover:text-white',
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Banner Image / Placeholder (No crop) */}
      <div className="mt-auto w-full p-2">
        {sidebarBannerUrl ? (
          <div className="w-full overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sidebarBannerUrl}
              alt=""
              className="w-full object-contain"
            />
          </div>
        ) : (
          <ImagePlaceholder
            className="w-full h-24 border-white/10 bg-white/5 text-white/40"
            label="Banner lateral"
            sublabel="Espacio reservado"
            objectFit="contain"
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-lg md:hidden"
        style={{ backgroundColor: sidebarBg }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 flex-col transition-transform md:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ backgroundColor: sidebarBg }}
      >
        <button
          type="button"
          aria-label="Cerrar menu"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col md:flex"
        style={{ backgroundColor: sidebarBg }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
