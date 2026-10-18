import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Palette,
  Settings2,
} from 'lucide-react';

export interface PreviewModule {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  contracted: boolean;
}

export function TenantDashboardPreview({
  name,
  tenantId,
  logoUrl,
  bannerUrl,
  primary,
  secondary,
  accent,
  modules,
  canConfigure = false,
  preview = false,
}: {
  name: string;
  tenantId: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primary: string;
  secondary: string;
  accent: string;
  modules: PreviewModule[];
  canConfigure?: boolean;
  preview?: boolean;
}) {
  const active = modules.filter((m) => m.enabled).length;
  const stats = [
    { label: 'Servicios asignados', value: modules.length, icon: Boxes },
    { label: 'Servicios activos', value: active, icon: CheckCircle2 },
    { label: 'Identidad visual', value: 'Personalizada', icon: Palette },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="relative overflow-hidden rounded-2xl border bg-white">
        {bannerUrl && (
          <div className="relative h-40 w-full sm:h-56">
            <Image
              src={bannerUrl}
              alt={`Imagen de ${name}`}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-5 p-6 sm:p-8">
          {logoUrl ? (
            <div className="relative h-20 w-28 shrink-0 rounded-xl border bg-white p-2">
              <Image
                src={logoUrl}
                alt={`Logo de ${name}`}
                fill
                unoptimized
                className="object-contain p-2"
              />
            </div>
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: primary }}
            >
              Tu espacio empresarial
            </p>
            <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">
              {name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Tus servicios, tu equipo y tu operación, en un solo lugar.
            </p>
          </div>
          {canConfigure && <Link
            href={`/admin/tenants/${tenantId}`}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{ color: primary }}
          >
            <Settings2 className="h-4 w-4" />
            Configurar empresa
          </Link>}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-2xl border bg-white p-5"
          >
            <div
              className="rounded-xl p-3"
              style={{ backgroundColor: secondary, color: primary }}
            >
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="mt-1 text-xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <Boxes className="h-5 w-5" style={{ color: primary }} />
          <h2 className="text-lg font-bold">Servicios de {name}</h2>
        </div>
        {modules.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <article
                key={module.key}
                className="flex flex-col rounded-xl border p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{module.name}</h3>
                  <span
                    className="rounded-full border px-2 py-1 text-xs"
                    style={{ color: module.enabled ? primary : accent }}
                  >
                    {module.enabled ? 'Activo' : 'Contratado · pendiente'}
                  </span>
                </div>
                <p className="mt-3 flex-1 text-sm text-slate-600">
                  {module.description}
                </p>
                <p className="mt-4 text-xs text-slate-500">
                  {module.enabled
                    ? preview ? 'Disponible en el menú de vista previa.' : 'Disponible en el menú de tu empresa.'
                    : 'Se habilitará cuando termine su implementación y configuración.'}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {canConfigure ? 'Asigna los servicios desde la configuración de la empresa para verlos aquí.' : 'Tu empresa aún no tiene servicios asignados. Contacta a Venesoft para configurarlos.'}
          </p>
        )}
      </section>
      <div className="flex items-start gap-3 rounded-xl border bg-white p-4 text-sm text-slate-600">
        <ArrowUpRight
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: primary }}
        />
        <p>
          {preview ? 'Esta vista usa la marca y los servicios guardados. DNS, base de datos y acceso del cliente conservan sus propias validaciones; la vista previa no los activa.' : 'Este inicio muestra la configuración de tu empresa. Las pantallas comerciales todavía contienen demostraciones; sus cifras no corresponden a tu operación.'}
        </p>
      </div>
    </div>
  );
}
