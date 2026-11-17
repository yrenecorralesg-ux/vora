import 'server-only';
import type { WarehouseContext } from '@/lib/warehouse/access';

/** Datos de apoyo de la ficha de producto (WH-03). */
export async function loadItemFormData(ctx: WarehouseContext) {
  const [units, categories, attributes] = await Promise.all([
    ctx.service.from('warehouse_units').select('id, code, name').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('code'),
    ctx.service.from('warehouse_categories').select('id, name').eq('tenant_id', ctx.tenantId).order('name'),
    ctx.service
      .from('warehouse_attribute_definitions')
      .select('key, label, data_type, options, required, category_id')
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'active')
      .order('sort_order'),
  ]);
  return {
    units: units.data ?? [],
    categories: categories.data ?? [],
    attributes: (attributes.data ?? []) as {
      key: string;
      label: string;
      data_type: 'text' | 'number' | 'date' | 'boolean' | 'select';
      options: string[];
      required: boolean;
      category_id: string | null;
    }[],
  };
}
