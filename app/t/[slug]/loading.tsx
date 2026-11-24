import { Loader2 } from 'lucide-react';

/** Indicador al cambiar de módulo (POS ↔ Warehouse u otras secciones del portal). */
export default function TenantLoading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen flex-1 items-center justify-center bg-[#F6F5F0]">
      <div className="flex flex-col items-center gap-3 text-[var(--crm-primary,#285C49)]">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span className="text-[13px] font-medium">Cargando módulo…</span>
      </div>
    </div>
  );
}
