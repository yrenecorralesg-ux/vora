import 'server-only';
import type { WarehouseContext } from '@/lib/warehouse/access';

export const JOB_STATUS = {
  validated: { label: 'Validada', tone: 'blue' },
  invalid: { label: 'Con errores', tone: 'amber' },
  applied: { label: 'Aplicada', tone: 'green' },
  cancelled: { label: 'Cancelada', tone: 'slate' },
} as const;

export async function loadImportJob(ctx: WarehouseContext, id: string) {
  const { data } = await ctx.service
    .from('warehouse_import_jobs')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', id)
    .maybeSingle();
  return data as null | {
    id: string;
    operation: 'items' | 'initial_stock' | 'prices';
    file_name: string;
    file_sha256: string;
    status: keyof typeof JOB_STATUS;
    apply_mode: string | null;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    summary: { create?: number; update?: number; movement?: number; duplicate_of?: string | null; applied_created?: number; applied_updated?: number; applied_movements?: number };
    created_at: string;
    applied_at: string | null;
  };
}
