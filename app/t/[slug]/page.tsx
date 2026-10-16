import Link from 'next/link';
import {
  Users,
  RotateCw,
  FileText,
  BarChart2,
  BarChart3,
  Calendar,
  ShoppingBag,
  MessageCircle,
  Globe,
  ChevronRight,
  ChevronDown,
  Star,
  MessageSquare,
  Sparkles,
  Lightbulb,
} from 'lucide-react';

import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function TenantDashboardPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'crm.dashboard');

  const supabase = getSupabaseServerClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, commercial_name, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  const { data: branding } = await supabase
    .from('tenant_branding')
    .select('primary_color, secondary_color, accent_color, banner_url')
    .eq('tenant_id', tenant?.id ?? '')
    .maybeSingle();

  let headerBannerUrl: string | null = null;
  if (branding?.banner_url) {
    try {
      const parsed = JSON.parse(branding.banner_url);
      headerBannerUrl = parsed.header || null;
    } catch {
      headerBannerUrl = branding.banner_url;
    }
  }

  const isSolee = params.slug === 'solee';
  const tenantName = tenant?.commercial_name ?? (isSolee ? 'SOLEÉ' : 'CRM');
  const ambientImage = headerBannerUrl;

  const kpiCards = [
    {
      title: 'Ventas del mes',
      value: '$18,4 M',
      sub: '↗ Todos los canales',
      icon: BarChart3,
    },
    {
      title: 'Clientes identificados',
      value: '386',
      sub: 'Fichas consolidadas',
      icon: Users,
    },
    {
      title: 'Clientes por recompra',
      value: '28',
      sub: 'Revisar reposición',
      icon: RotateCw,
    },
    {
      title: 'Seguimientos hoy',
      value: '17',
      sub: 'Asignados al equipo',
      icon: FileText,
    },
  ];

  const channelSales = [
    { name: 'Ferias', value: '$7,8 M', pct: 82, icon: Calendar },
    { name: 'Shopify', value: '$5,2 M', pct: 56, icon: ShoppingBag },
    { name: 'WhatsApp', value: '$3,4 M', pct: 38, icon: MessageCircle },
    { name: 'Web', value: '$2,0 M', pct: 22, icon: Globe },
  ];

  const recommendations = [
    {
      title: '9 clientes',
      desc: 'Pueden necesitar reposición',
      href: `/t/${params.slug}/segments`,
      icon: Users,
    },
    {
      title: '6 clientes valiosos',
      desc: 'Sin contacto reciente',
      href: `/t/${params.slug}/customers`,
      icon: Star,
    },
    {
      title: '2 conversaciones',
      desc: 'Listas para una asesora',
      href: `/t/${params.slug}/conversations`,
      icon: MessageSquare,
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Section - Matching Mockup */}
      <div className="relative flex min-h-[130px] sm:min-h-[145px] flex-col justify-center overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-100/90 px-6 sm:px-8 py-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        {/* Top-Right Clean Ambient Image blending smoothly */}
        {ambientImage && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[55%] max-w-[560px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ambientImage}
              alt=""
              className="h-full w-full object-cover object-right"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 15%, black 45%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 15%, black 45%)',
              }}
            />
          </div>
        )}

        {/* Top-Right Profile Pill (Asesora ▾) */}
        <div className="absolute right-4 sm:right-6 top-4 z-20">
          <div className="flex items-center gap-1.5 rounded-full border border-white/90 bg-white/90 px-3.5 py-1.5 shadow-sm backdrop-blur transition-all hover:bg-white cursor-pointer">
            <Sparkles className="h-3.5 w-3.5 text-[#5136db]" />
            <span className="text-[11.5px] font-semibold text-slate-800">Asesora</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </div>
        </div>

        {/* Title Content */}
        <div className="relative z-10 max-w-xl space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#5136db]">
            {tenantName}
          </p>
          <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-[#111827] leading-tight">
            Cada aroma cuenta una historia
          </h1>
          <p className="text-xs sm:text-[13px] font-normal text-[#6b7280]">
            Ventas y relaciones reunidas desde ferias, Shopify, web y atención directa.
          </p>
        </div>
      </div>

      {/* 4 KPI Cards - Tighter compact spacing */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eeecfc] text-[#5136db]">
                <Icon className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#6b7280] leading-none">{card.title}</p>
                <p className="text-[22px] sm:text-[24px] font-black tracking-tight text-[#111827] leading-tight my-0.5">
                  {card.value}
                </p>
                <p className="text-[10.5px] font-semibold text-[#059669] leading-none">
                  {card.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom 2 Columns - Compact and tight */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Card: Ventas por canal (Col 7) */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)] lg:col-span-7">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eeecfc] text-[#5136db]">
              <BarChart2 className="h-4 w-4 stroke-[2.2]" />
            </div>
            <h2 className="text-base sm:text-[17px] font-bold text-[#111827]">Ventas por canal</h2>
          </div>

          <div className="space-y-3.5">
            {channelSales.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.name} className="flex items-center gap-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#5136db]">
                    <Icon className="h-4 w-4 stroke-[1.8]" />
                  </div>
                  <span className="w-16 sm:w-20 text-[13.5px] font-semibold text-[#1f2937]">
                    {c.name}
                  </span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#f1effd]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${c.pct}%`,
                        background: 'linear-gradient(90deg, #5136db 0%, #7d64f6 100%)',
                      }}
                    />
                  </div>
                  <span className="w-14 sm:w-16 text-right text-[14px] font-bold text-[#111827]">
                    {c.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Acciones recomendadas (Col 5) */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)] lg:col-span-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eeecfc] text-[#5136db]">
              <Lightbulb className="h-4 w-4 stroke-[2.2]" />
            </div>
            <h2 className="text-base sm:text-[17px] font-bold text-[#111827]">Acciones recomendadas</h2>
          </div>

          <div className="space-y-2.5">
            {recommendations.map((rec) => {
              const Icon = rec.icon;
              return (
                <Link
                  key={rec.title}
                  href={rec.href}
                  className="group flex items-center justify-between rounded-xl border border-[#eeebfb] bg-[#f8f7fe] p-3 transition-all duration-150 hover:bg-[#f2effd] hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[#5136db]">
                      <Icon className="h-4 w-4 stroke-[1.8]" />
                    </div>
                    <div>
                      <p className="text-[13.5px] font-bold text-[#111827] group-hover:text-[#5136db] transition-colors">
                        {rec.title}
                      </p>
                      <p className="text-[11px] text-[#6b7280]">{rec.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5136db] transition-transform group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
