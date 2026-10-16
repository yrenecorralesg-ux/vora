import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Banner reutilizable que etiqueta claramente el contenido como datos de
 * demostracion. Debe aparecer en toda pagina que muestre fixtures.
 */
export function DemoBanner({ message }: { message?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
      <Eye className="h-4 w-4 text-warning" />
      <span className="text-sm font-medium text-warning">
        {message ?? 'Demo — Estos son datos de ejemplo (fixtures), no datos reales del tenant.'}
      </span>
    </div>
  );
}

/** Badge "Demo" para marcar tarjetas o secciones individuales. */
export function DemoBadge() {
  return (
    <Badge variant="secondary" className="border-warning/40 bg-warning/15 text-warning">
      Demo
    </Badge>
  );
}
