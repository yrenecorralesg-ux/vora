import 'server-only';
import type { WarehouseContext } from '@/lib/warehouse/access';

const num = (v: unknown) => Number(v ?? 0);
type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export interface StockRow {
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  warehouse_id: string | null;
  warehouse_code: string;
  warehouse_name: string;
  on_hand: number;
  reserved: number;
  available: number;
  damaged: number;
  in_transit: number;
  min_stock: number;
  avg_cost: number;
  value: number;
  alert: 'Sin stock' | 'Stock bajo' | null;
}

/** Existencias por artículo y almacén (WH-09). Incluye artículos sin saldo para alertar. */
export async function loadStock(
  ctx: WarehouseContext,
  opts: { warehouseId?: string | null; itemId?: string },
): Promise<StockRow[]> {
  let q = ctx.service
    .from('warehouse_balances')
    .select(
      'item_id, warehouse_id, on_hand, reserved, damaged, in_transit, avg_cost, warehouse_items!inner(sku, name, min_stock, status, warehouse_units(symbol)), warehouse_warehouses!inner(code, name)',
    )
    .eq('tenant_id', ctx.tenantId)
    .limit(5000);
  if (opts.warehouseId) q = q.eq('warehouse_id', opts.warehouseId);
  if (opts.itemId) q = q.eq('item_id', opts.itemId);
  const { data } = await q;

  const rows: StockRow[] = (data ?? []).map((b) => {
    const item = first(b.warehouse_items as One<{ sku: string; name: string; min_stock: number; warehouse_units: One<{ symbol: string }> }>)!;
    const wh = first(b.warehouse_warehouses as One<{ code: string; name: string }>)!;
    const onHand = num(b.on_hand);
    const reserved = num(b.reserved);
    const min = num(item.min_stock);
    const available = onHand - reserved;
    return {
      item_id: b.item_id,
      sku: item.sku,
      name: item.name,
      unit: first(item.warehouse_units)?.symbol ?? '',
      warehouse_id: b.warehouse_id,
      warehouse_code: wh.code,
      warehouse_name: wh.name,
      on_hand: onHand,
      reserved,
      available,
      damaged: num(b.damaged),
      in_transit: num(b.in_transit),
      min_stock: min,
      avg_cost: num(b.avg_cost),
      value: Math.round(onHand * num(b.avg_cost) * 100) / 100,
      alert: available <= 0 ? 'Sin stock' : available < min ? 'Stock bajo' : null,
    };
  });

  if (!opts.warehouseId) {
    let items = ctx.service
      .from('warehouse_items')
      .select('id, sku, name, min_stock, warehouse_units(symbol)')
      .eq('tenant_id', ctx.tenantId)
      .eq('track_stock', true)
      .eq('status', 'active')
      .limit(5000);
    if (opts.itemId) items = items.eq('id', opts.itemId);
    const { data: tracked } = await items;
    const withBalance = new Set(rows.map((r) => r.item_id));
    for (const i of tracked ?? []) {
      if (withBalance.has(i.id)) continue;
      rows.push({
        item_id: i.id, sku: i.sku, name: i.name,
        unit: first(i.warehouse_units as One<{ symbol: string }>)?.symbol ?? '',
        warehouse_id: null, warehouse_code: '—', warehouse_name: 'Sin movimientos',
        on_hand: 0, reserved: 0, available: 0, damaged: 0, in_transit: 0,
        min_stock: num(i.min_stock), avg_cost: 0, value: 0,
        alert: 'Sin stock',
      });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es') || a.warehouse_code.localeCompare(b.warehouse_code));
}

export interface KardexFilters {
  itemId?: string | null;
  warehouseId?: string | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface KardexRow {
  id: string;
  created_at: string;
  item_id: string;
  sku: string;
  item_name: string;
  warehouse_code: string;
  movement_type: string;
  bucket: string;
  quantity: number;
  on_hand_after: number;
  damaged_after: number;
  unit_cost: number;
  avg_cost_after: number;
  document_id: string | null;
  reference: string | null;
  reason: string | null;
  reversal_of: string | null;
}

/** Historial inmutable por artículo (WH-08). */
export async function loadKardex(ctx: WarehouseContext, f: KardexFilters, limit = 300): Promise<KardexRow[]> {
  let q = ctx.service
    .from('warehouse_movements')
    .select(
      'id, created_at, item_id, movement_type, bucket, quantity, on_hand_after, damaged_after, unit_cost, avg_cost_after, document_id, reference_type, reference_id, reason, reversal_of, warehouse_items!inner(sku, name), warehouse_warehouses!inner(code)',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (f.itemId) q = q.eq('item_id', f.itemId);
  if (f.warehouseId) q = q.eq('warehouse_id', f.warehouseId);
  if (f.type) q = q.eq('movement_type', f.type);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte('created_at', `${f.from}T00:00:00`);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lte('created_at', `${f.to}T23:59:59.999`);
  const { data } = await q;
  return (data ?? []).map((m) => {
    const item = first(m.warehouse_items as One<{ sku: string; name: string }>)!;
    return {
      id: m.id,
      created_at: m.created_at,
      item_id: m.item_id,
      sku: item.sku,
      item_name: item.name,
      warehouse_code: first(m.warehouse_warehouses as One<{ code: string }>)!.code,
      movement_type: m.movement_type,
      bucket: m.bucket,
      quantity: num(m.quantity),
      on_hand_after: num(m.on_hand_after),
      damaged_after: num(m.damaged_after),
      unit_cost: num(m.unit_cost),
      avg_cost_after: num(m.avg_cost_after),
      document_id: m.document_id,
      reference: m.reference_id ? `${m.reference_type === 'pos' ? 'POS ' : ''}${m.reference_id}` : null,
      reason: m.reason,
      reversal_of: m.reversal_of,
    };
  });
}

const OUTFLOW_TYPES = ['issue', 'pos_sale', 'adjustment_out'];

/** Rotación por artículo en un período (WH-11): salidas / existencia actual. */
export async function loadRotation(ctx: WarehouseContext, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: moves }, stock] = await Promise.all([
    ctx.service
      .from('warehouse_movements')
      .select('item_id, quantity')
      .eq('tenant_id', ctx.tenantId)
      .in('movement_type', OUTFLOW_TYPES)
      .gte('created_at', since)
      .limit(20000),
    loadStock(ctx, {}),
  ]);
  const outflow = new Map<string, number>();
  for (const m of moves ?? []) outflow.set(m.item_id, (outflow.get(m.item_id) ?? 0) - num(m.quantity));
  const byItem = new Map<string, { sku: string; name: string; on_hand: number }>();
  for (const r of stock) {
    const cur = byItem.get(r.item_id) ?? { sku: r.sku, name: r.name, on_hand: 0 };
    cur.on_hand += r.on_hand;
    byItem.set(r.item_id, cur);
  }
  return Array.from(byItem.entries())
    .map(([id, i]) => {
      const out = Math.round((outflow.get(id) ?? 0) * 1000) / 1000;
      return {
        item_id: id,
        sku: i.sku,
        name: i.name,
        on_hand: i.on_hand,
        outflow: out,
        rotation: i.on_hand > 0 ? Math.round((out / i.on_hand) * 100) / 100 : null,
        days_of_stock: out > 0 ? Math.round(i.on_hand / (out / days)) : null,
      };
    })
    .sort((a, b) => b.outflow - a.outflow);
}

/** Indicadores del dashboard (WH-01). */
export async function loadDashboard(ctx: WarehouseContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const count = (table: string) =>
    ctx.service.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId);
  const [items, warehouses, movesToday, movesYesterday, pending, stock, recent] = await Promise.all([
    count('warehouse_items').eq('status', 'active'),
    count('warehouse_warehouses').eq('status', 'active'),
    count('warehouse_movements').gte('created_at', today.toISOString()),
    count('warehouse_movements').gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
    count('warehouse_documents').eq('status', 'pending_approval'),
    loadStock(ctx, {}),
    loadKardex(ctx, {}, 8),
  ]);
  const alerts = stock.filter((s) => s.alert);
  return {
    items: items.count ?? 0,
    warehouses: warehouses.count ?? 0,
    alerts: alerts.length,
    movesToday: movesToday.count ?? 0,
    movesYesterday: movesYesterday.count ?? 0,
    pending: pending.count ?? 0,
    value: stock.reduce((s, r) => s + r.value, 0),
    topAlerts: alerts.slice(0, 6),
    recent,
  };
}

/** Opciones comunes de formularios: almacenes activos, unidades, proveedores y configuración. */
export async function loadFormOptions(ctx: WarehouseContext) {
  const [warehouses, units, suppliers, settings] = await Promise.all([
    ctx.service.from('warehouse_warehouses').select('id, code, name').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('code'),
    ctx.service.from('warehouse_units').select('id, code, symbol, base_unit_id').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('code'),
    ctx.service.from('warehouse_supplier_profiles').select('id, name').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('name'),
    ctx.service.from('warehouse_settings').select('*').eq('tenant_id', ctx.tenantId).maybeSingle(),
  ]);
  return {
    warehouses: (warehouses.data ?? []).map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` })),
    units: units.data ?? [],
    suppliers: (suppliers.data ?? []).map((s) => ({ id: s.id, label: s.name })),
    settings: settings.data as {
      require_adjustment_approval: boolean;
      low_stock_alerts: boolean;
      default_warehouse_id: string | null;
      import_max_rows: number;
      unknown_code_action: 'offer_create' | 'block';
      updated_at: string;
    } | null,
  };
}
