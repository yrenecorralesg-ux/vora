import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadKardex } from '@/lib/warehouse/queries';
import { MOVEMENT_TYPES } from '@/lib/warehouse/catalog';
import { fmtDate, fmtQty, signed } from '@/lib/warehouse/format';
import { ActionsBar, DataTable, Kpi, KpiGrid, Panel, Pill, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-14 · Integración POS: reserva, venta y reverso. */
export default async function PosIntegrationPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { fn: 'wh_pos_integration' });
  const [sales, returns] = await Promise.all([
    loadKardex(ctx, { type: 'pos_sale' }, 100),
    loadKardex(ctx, { type: 'pos_return' }, 100),
  ]);
  const events = [...sales, ...returns].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  const refs = new Set(sales.map((s) => s.reference));

  return (
    <div className="space-y-4">
      <WhHeader code="WH-14" title="Integración POS" subtitle="Reserva, venta y reverso" />
      <KpiGrid>
        <Kpi label="Ventas POS registradas" value={fmtQty(refs.size)} hint="últimos 100 movimientos" />
        <Kpi label="Unidades vendidas" value={fmtQty(-sales.reduce((s, m) => s + m.quantity, 0))} />
        <Kpi label="Unidades repuestas" value={fmtQty(returns.reduce((s, m) => s + m.quantity, 0))} />
        <Kpi label="Estado de la conexión" value={events.length ? 'Recibiendo' : 'Sin eventos'} tone={events.length ? 'good' : 'warn'} />
      </KpiGrid>
      <Panel title="Transacciones">
        <DataTable head={['Fecha', 'Evento', 'Venta', 'SKU', 'Stock', 'Saldo', 'Estado']} empty="Aún no hay ventas POS conectadas a este inventario.">
          {events.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap">{fmtDate(m.created_at)}</td>
              <td>{MOVEMENT_TYPES[m.movement_type]}</td>
              <td className="font-mono text-[11px]">{m.reference}</td>
              <td className="font-mono text-[11px]">{m.sku}</td>
              <td className="tabular-nums">{signed(m.quantity)}</td>
              <td className="tabular-nums">{fmtQty(m.on_hand_after)}</td>
              <td><Pill tone="green">Aplicado</Pill></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      <Panel title="Cómo se conecta">
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-600">
          <li>El POS envía cada venta o devolución a <code className="font-mono text-[12px]">/api/t/{params.slug}/warehouse/pos-events</code> con la referencia de la venta y los SKU.</li>
          <li>El descuento es atómico e idempotente: reenviar la misma venta no descuenta dos veces, y si falta stock de una línea no se descuenta ninguna.</li>
          <li>Dos cajas no pueden vender la última unidad a la vez: el saldo se bloquea durante la operación.</li>
          <li>Los SKU del POS deben existir en este catálogo. Los servicios no descuentan stock.</li>
        </ul>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          El POS actual todavía trabaja con datos de demostración en memoria; su conexión a este inventario se completa al migrar el POS a la base de datos. La reserva previa al cobro queda para esa misma entrega.
        </p>
      </Panel>
      <ActionsBar items={['Ver transacciones', 'Conciliar']} />
    </div>
  );
}
