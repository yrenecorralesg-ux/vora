import { Loader2 } from 'lucide-react';

const bar = 'animate-pulse rounded-md bg-[#E4E0D6]';

/** Skeleton de las vistas WH mientras el servidor carga la página (la barra lateral queda fija). */
export default function WarehouseLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Cargando…</span>

      <div className="flex items-center justify-between rounded-2xl border border-[#E4E0D6] bg-white px-5 py-4">
        <div className="space-y-2">
          <div className={`${bar} h-5 w-56`} />
          <div className={`${bar} h-3 w-40`} />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-[#285C49]" aria-hidden />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-[#E4E0D6] bg-white px-4 py-3">
            <div className={`${bar} h-3 w-20`} />
            <div className={`${bar} h-6 w-16`} />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-[#E4E0D6] bg-white p-4">
        <div className={`${bar} h-4 w-32`} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className={`${bar} h-4 w-20`} />
            <div className={`${bar} h-4 flex-1`} />
            <div className={`${bar} h-4 w-16`} />
            <div className={`${bar} h-4 w-16`} />
          </div>
        ))}
      </div>
    </div>
  );
}
