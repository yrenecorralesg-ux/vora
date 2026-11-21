import Link from 'next/link';
import { Warehouse } from 'lucide-react';
import { isSuperAdmin, requireSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const REASONS = {
  inactive: {
    title: 'Warehouse no está activo para esta empresa',
    text: 'El módulo VORA Warehouse · Inventario debe estar contratado y activado para la empresa.',
  },
  setup: {
    title: 'Warehouse no pudo prepararse',
    text: 'No se pudo crear la configuración inicial del inventario. Suele indicar que faltan las migraciones de Warehouse en la base de datos.',
  },
  suspended: {
    title: 'La operación de la empresa está suspendida',
    text: 'Mientras la empresa esté suspendida o cancelada no se puede operar el inventario.',
  },
} as const;

/** Aviso cuando Warehouse no puede abrirse, en lugar de redirigir sin explicación. */
export default async function WarehouseInactivePage({ params, searchParams }: { params: { slug: string }; searchParams: { reason?: string } }) {
  const reason = REASONS[(searchParams.reason as keyof typeof REASONS) ?? 'inactive'] ?? REASONS.inactive;
  const session = getSupabaseServerClient();
  const user = await requireSession(session);
  const admin = user ? await isSuperAdmin(user.id, session) : false;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[#E4E0D6] bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#285C49]/10 text-[#285C49]">
        <Warehouse className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-bold text-[#1B3D2F]">{reason.title}</h1>
      <p className="mt-2 text-[13px] text-slate-600">{reason.text}</p>
      {admin ? (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-left text-[13px] text-slate-600">
          <li>
            Aplica en Supabase (SQL Editor), en orden: <code className="text-[11px]">20261117000000_warehouse_catalog.sql</code>,{' '}
            <code className="text-[11px]">20261117020000_warehouse_suppliers_schema.sql</code> y{' '}
            <code className="text-[11px]">20261117030000_warehouse_core_schema.sql</code>.
          </li>
          <li>En el gestor de la empresa, contrata y activa “VORA Warehouse · Inventario”.</li>
        </ol>
      ) : (
        <p className="mt-4 text-[13px] text-slate-600">Pide al administrador de VORA que active el módulo.</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href={`/t/${params.slug}/pos`} className="inline-flex h-9 items-center rounded-xl border border-[#E7E2D7] px-4 text-[13px]">Ir al POS</Link>
        {admin && (
          <Link href="/admin/tenants" className="inline-flex h-9 items-center rounded-xl bg-[#285C49] px-4 text-[13px] font-semibold text-white">Abrir el gestor</Link>
        )}
      </div>
    </div>
  );
}
