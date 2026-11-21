'use client';

import { usePathname } from 'next/navigation';

/** Devuelve true si la ruta pertenece a un módulo con barra lateral propia (POS o Warehouse). */
export function isOwnShellPath(pathname: string, slug: string): boolean {
  // En subdominio la URL visible no lleva el prefijo /t/<slug>.
  const path = pathname.startsWith(`/t/${slug}`) ? pathname.slice(`/t/${slug}`.length) || '/' : pathname;
  return ['/pos', '/warehouse'].some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Marco del portal de la empresa. Decide en el cliente si se muestra el menú del CRM:
 * el layout de Next no se vuelve a renderizar al navegar entre páginas, así que una
 * decisión tomada en el servidor con la ruta inicial dejaba el menú del CRM pegado
 * encima de la barra propia del POS o de Warehouse.
 */
export function TenantFrame({
  slug,
  rail,
  sidebar,
  topLink,
  children,
}: {
  slug: string;
  rail: React.ReactNode;
  sidebar: React.ReactNode;
  topLink: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  if (isOwnShellPath(pathname, slug)) {
    return (
      <div className="flex min-h-screen bg-[#F6F2E9]">
        {rail}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-[#f1f3f9]">
      {rail}
      {sidebar}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-y-auto">
        <main className="flex-1 p-4 pt-16 sm:p-5 sm:pt-16 md:pt-5 lg:p-6">
          {topLink}
          {children}
        </main>
      </div>
    </div>
  );
}
