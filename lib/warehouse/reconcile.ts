import 'server-only';
import type { WarehouseContext } from '@/lib/warehouse/access';

/**
 * Conciliación POS ↔ Warehouse (WH-14). Compara, por referencia y SKU, lo que
 * el POS registró (ventas y devoluciones con catálogo de Warehouse) con los
 * movimientos de stock que existen. Solo lectura.
 */

export type ReconStatus = 'ok' | 'missing_movement' | 'orphan_movement' | 'qty_mismatch';

export interface ReconRow {
  reference: string;
  kind: 'Venta' | 'Devolución' | 'Devolución dañada';
  sku: string;
  name: string;
  expected: number;
  actual: number;
  status: ReconStatus;
  date: string;
}

const num = (v: unknown) => Number(v ?? 0);
const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export async function reconcilePos(ctx: WarehouseContext, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: sales }, { data: returns }, { data: moves }] = await Promise.all([
    ctx.service
      .from('pos_sales')
      .select('sale_number, created_at, pos_sale_lines(sku_snapshot, name_snapshot, quantity, is_service, item_id, warehouse_items(track_stock))')
      .eq('tenant_id', ctx.tenantId)
      .eq('catalog_source', 'warehouse')
      .gte('created_at', since)
      .limit(2000),
    ctx.service
      .from('pos_sale_returns')
      .select('return_number, created_at, pos_return_lines(quantity_returned, condition, item_id, warehouse_items(sku, name, track_stock))')
      .eq('tenant_id', ctx.tenantId)
      .gte('created_at', since)
      .limit(2000),
    ctx.service
      .from('warehouse_movements')
      .select('movement_type, quantity, reference_id, created_at, warehouse_items(sku, name)')
      .eq('tenant_id', ctx.tenantId)
      .eq('reference_type', 'pos')
      .gte('created_at', since)
      .limit(10000),
  ]);

  // Lo esperado según el POS: clave "tipo|referencia|sku".
  const expected = new Map<string, Omit<ReconRow, 'actual' | 'status'>>();
  const add = (key: string, row: Omit<ReconRow, 'actual' | 'status'>) => {
    const prev = expected.get(key);
    expected.set(key, prev ? { ...prev, expected: prev.expected + row.expected } : row);
  };
  for (const s of sales ?? []) {
    for (const l of (s.pos_sale_lines ?? []) as any[]) {
      if (l.is_service || !l.item_id || one(l.warehouse_items)?.track_stock === false) continue;
      add(`Venta|${s.sale_number}|${l.sku_snapshot}`, {
        reference: s.sale_number, kind: 'Venta', sku: l.sku_snapshot, name: l.name_snapshot, expected: num(l.quantity), date: s.created_at,
      });
    }
  }
  for (const r of returns ?? []) {
    for (const l of (r.pos_return_lines ?? []) as any[]) {
      const item = one(l.warehouse_items) as { sku: string; name: string; track_stock: boolean } | null;
      if (!l.item_id || !item || item.track_stock === false) continue;
      const kind = l.condition === 'damaged' ? 'Devolución dañada' : 'Devolución';
      add(`${kind}|${r.return_number}|${item.sku}`, {
        reference: r.return_number, kind, sku: item.sku, name: item.name, expected: num(l.quantity_returned), date: r.created_at,
      });
    }
  }

  // Lo que realmente movió el stock.
  const actual = new Map<string, { qty: number; name: string; date: string }>();
  for (const m of moves ?? []) {
    const kind = m.movement_type === 'pos_sale' ? 'Venta' : m.movement_type === 'pos_return' ? 'Devolución' : m.movement_type === 'return_damaged' ? 'Devolución dañada' : null;
    if (!kind) continue;
    const item = one(m.warehouse_items as any) as { sku: string; name: string } | null;
    if (!item) continue;
    const key = `${kind}|${m.reference_id}|${item.sku}`;
    const prev = actual.get(key);
    actual.set(key, { qty: (prev?.qty ?? 0) + Math.abs(num(m.quantity)), name: item.name, date: prev?.date ?? m.created_at });
  }

  const rows: ReconRow[] = [];
  for (const [key, e] of Array.from(expected.entries())) {
    const a = actual.get(key);
    const qty = a?.qty ?? 0;
    rows.push({ ...e, actual: qty, status: !a ? 'missing_movement' : Math.abs(qty - e.expected) > 0.0005 ? 'qty_mismatch' : 'ok' });
  }
  for (const [key, a] of Array.from(actual.entries())) {
    if (expected.has(key)) continue;
    const [kind, reference, sku] = key.split('|');
    rows.push({ reference, kind: kind as ReconRow['kind'], sku, name: a.name, expected: 0, actual: a.qty, status: 'orphan_movement', date: a.date });
  }
  rows.sort((x, y) => y.date.localeCompare(x.date));

  const issues = rows.filter((r) => r.status !== 'ok');
  return {
    days,
    rows,
    issues,
    matched: rows.length - issues.length,
    references: new Set(rows.map((r) => r.reference)).size,
  };
}
