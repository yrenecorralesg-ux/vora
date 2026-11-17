import { NextResponse } from 'next/server';
import { authorizeWarehouse, type WarehouseContext } from '@/lib/warehouse/access';
import { MOVEMENT_TYPES } from '@/lib/warehouse/catalog';
import { csvResponseHeaders, toCsv } from '@/lib/warehouse/csv';
import { loadStock, loadKardex, loadRotation } from '@/lib/warehouse/queries';

export const dynamic = 'force-dynamic';

/**
 * GET ?kind=stock|kardex|valuation|rotation|import-errors|template: exportaciones CSV
 * (WH-08, WH-09, WH-11, WH-20, WH-21). Los costos solo salen con permiso cost.view.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') ?? '';
  const auth = await authorizeWarehouse(params.slug, kind === 'valuation' || kind === 'rotation' ? { permission: 'report.view', fn: 'wh_reports' } : {});
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const day = new Date().toISOString().slice(0, 10);
  const csv = (name: string, headers: string[], rows: unknown[][]) =>
    new NextResponse(toCsv(headers, rows), { headers: csvResponseHeaders(`${name}-${day}.csv`) });

  switch (kind) {
    case 'stock': {
      const rows = await loadStock(ctx, { warehouseId: url.searchParams.get('warehouse') });
      const cost = ctx.can('cost.view');
      return csv(
        'stock',
        ['SKU', 'Artículo', 'Almacén', 'Físico', 'Reservado', 'Disponible', 'Dañado', 'Mínimo', 'Alerta', ...(cost ? ['Costo promedio', 'Valor'] : [])],
        rows.map((r) => [r.sku, r.name, r.warehouse_code, r.on_hand, r.reserved, r.available, r.damaged, r.min_stock, r.alert ?? '',
          ...(cost ? [r.avg_cost, r.value] : [])]),
      );
    }
    case 'kardex': {
      const rows = await loadKardex(ctx, kardexFilters(url), 5000);
      const cost = ctx.can('cost.view');
      return csv(
        'kardex',
        ['Fecha', 'SKU', 'Artículo', 'Almacén', 'Movimiento', 'Origen', 'Cantidad', 'Saldo', ...(cost ? ['Costo unitario', 'Costo promedio'] : []), 'Motivo'],
        rows.map((m) => [m.created_at, m.sku, m.item_name, m.warehouse_code, MOVEMENT_TYPES[m.movement_type] ?? m.movement_type, m.reference ?? '',
          m.quantity, m.on_hand_after, ...(cost ? [m.unit_cost, m.avg_cost_after] : []), m.reason ?? '']),
      );
    }
    case 'valuation': {
      if (!ctx.can('cost.view')) return NextResponse.json({ error: 'No tienes permiso para ver costos.' }, { status: 403 });
      const rows = await loadStock(ctx, {});
      return csv('valorizacion', ['SKU', 'Artículo', 'Almacén', 'Físico', 'Costo promedio', 'Valor'],
        rows.map((r) => [r.sku, r.name, r.warehouse_code, r.on_hand, r.avg_cost, r.value]));
    }
    case 'rotation': {
      const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
      const rows = await loadRotation(ctx, days);
      return csv(`rotacion-${days}d`, ['SKU', 'Artículo', 'Salidas del período', 'Existencia actual', 'Rotación', 'Días de inventario'],
        rows.map((r) => [r.sku, r.name, r.outflow, r.on_hand, r.rotation ?? '', r.days_of_stock ?? '']));
    }
    case 'import-errors': {
      const job = url.searchParams.get('job') ?? '';
      const { data } = await ctx.service
        .from('warehouse_import_rows')
        .select('row_number, errors')
        .eq('tenant_id', ctx.tenantId)
        .eq('job_id', job)
        .neq('errors', '[]')
        .order('row_number');
      const rows = (data ?? []).flatMap((r) =>
        (r.errors as { field: string; value?: string; message: string }[]).map((e) => [r.row_number, e.field, e.value ?? '', e.message]),
      );
      return csv('errores-importacion', ['Fila', 'Columna', 'Valor', 'Error y corrección'], rows);
    }
    case 'template':
      return template(ctx, url.searchParams.get('operation') ?? '');
    default:
      return NextResponse.json({ error: 'Exportación inválida.' }, { status: 400 });
  }
}

function kardexFilters(url: URL) {
  return {
    itemId: url.searchParams.get('item'),
    warehouseId: url.searchParams.get('warehouse'),
    type: url.searchParams.get('type'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  };
}

/** Plantillas descargables por operación y sector (WH-20). */
async function template(ctx: WarehouseContext, operation: string) {
  const day = new Date().toISOString().slice(0, 10);
  if (operation === 'items') {
    const { data: attrs } = await ctx.service
      .from('warehouse_attribute_definitions')
      .select('key, data_type, options')
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'active')
      .order('sort_order');
    const attrCols = (attrs ?? []).map((a) => `attr:${a.key}`);
    const example = ['REP-001', 'Filtro de aceite', 'physical', 'Repuestos', 'UND', '12.50', '16', '10', '7890123456789|REP001', 'Ejemplo: borra esta fila',
      ...(attrs ?? []).map((a) => (a.data_type === 'select' ? a.options[0] : a.data_type === 'number' ? '1' : a.data_type === 'date' ? '2027-01-31' : ''))];
    return new NextResponse(
      toCsv(['sku', 'name', 'item_type', 'category', 'unit', 'price_usd', 'tax_rate', 'min_stock', 'barcodes', 'description', ...attrCols], [example]),
      { headers: csvResponseHeaders(`plantilla-productos-v1-${day}.csv`) },
    );
  }
  if (operation === 'initial_stock')
    return new NextResponse(toCsv(['sku', 'warehouse', 'quantity', 'unit_cost'], [['REP-001', 'PRINCIPAL', '25', '8.40']]), {
      headers: csvResponseHeaders(`plantilla-stock-inicial-v1-${day}.csv`),
    });
  if (operation === 'prices')
    return new NextResponse(toCsv(['sku', 'price_usd'], [['REP-001', '12.50']]), {
      headers: csvResponseHeaders(`plantilla-precios-v1-${day}.csv`),
    });
  return NextResponse.json({ error: 'Plantilla inválida. Opciones: items, initial_stock, prices.' }, { status: 400 });
}
