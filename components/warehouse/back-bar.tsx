'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const SECTION_LABELS: Record<string, string> = {
  '': 'Dashboard',
  catalog: 'Catálogo',
  stock: 'Stock y alertas',
  receipts: 'Entradas',
  issues: 'Salidas',
  adjustments: 'Ajustes',
  returns: 'Devoluciones',
  transfers: 'Transferencias',
  kardex: 'Kardex',
  scan: 'Escaneo',
  warehouses: 'Almacenes',
  imports: 'Importaciones',
  suppliers: 'Proveedores',
  reports: 'Reportes',
  pos: 'Integración POS',
  settings: 'General',
  sector: 'Sector',
  attributes: 'Atributos',
  units: 'Unidades',
  roles: 'Roles',
  documents: 'Documentos',
};

// Historial de navegación dentro de Warehouse (sobrevive a las navegaciones del cliente
// porque el layout, y con él este módulo, no se desmonta).
const visited: string[] = [];

/** Etiqueta legible de una ruta de Warehouse ("Catálogo", "Detalle en Catálogo"…). */
function labelFor(rel: string[]): string {
  const section = SECTION_LABELS[rel[0] ?? ''] ?? 'la sección anterior';
  return rel.length > 1 ? `${section} (detalle)` : section;
}

/**
 * Botón «Volver» común a todas las vistas de Warehouse. Regresa a la pantalla anterior si
 * se llegó desde otra vista del módulo; si se abrió directo, sube a la sección padre.
 */
export function WhBackBar({ slug }: { slug: string }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const base = pathname.startsWith(`/t/${slug}/`) ? `/t/${slug}/warehouse` : '/warehouse';

  useEffect(() => {
    if (visited[visited.length - 1] === pathname) return;
    // Retroceso con el botón del navegador: se descarta la entrada actual en vez de apilar.
    if (visited[visited.length - 2] === pathname) visited.pop();
    else visited.push(pathname);
    if (visited.length > 50) visited.shift();
  }, [pathname]);

  const rel = pathname.slice(base.length).split('/').filter(Boolean);
  if (!pathname.startsWith(base) || rel.length === 0) return null; // Dashboard: no hay a dónde volver.

  const previous = visited[visited.length - 1] === pathname ? visited[visited.length - 2] : visited[visited.length - 1];
  const fromHistory = Boolean(previous && previous.startsWith(base) && previous !== pathname);
  const parent = `${base}${rel.length > 1 ? `/${rel.slice(0, -1).join('/')}` : ''}`;
  const target = fromHistory ? previous! : parent;
  const targetRel = target.slice(base.length).split('/').filter(Boolean);

  const goBack = () => {
    if (fromHistory) {
      visited.pop();
      router.back();
    } else {
      router.push(parent);
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-[12px] font-medium text-slate-500 transition hover:bg-white hover:text-[var(--crm-primary,#285C49)]"
    >
      <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
      Volver a {labelFor(targetRel)}
    </button>
  );
}
