import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadFormOptions } from '@/lib/warehouse/queries';
import { fmtDate } from '@/lib/warehouse/format';
import { ConfigForm } from '@/components/warehouse/config-form';
import { ActionsBar, DataTable, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-13 · Configuración de inventario: reglas por empresa y almacén. */
export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const [opts, { data: audit }] = await Promise.all([
    loadFormOptions(ctx),
    ctx.service.from('warehouse_audit_events').select('id, action, entity, created_at, details').eq('tenant_id', ctx.tenantId).order('created_at', { ascending: false }).limit(15),
  ]);
  const s = opts.settings;
  const canEdit = ctx.can('warehouse.configure');

  return (
    <div className="space-y-4">
      <WhHeader code="WH-13" title="Configuración de inventario" subtitle="Reglas por empresa y almacén" />
      <Panel title="Parámetros">
        <ConfigForm
          slug={params.slug}
          entity="settings"
          initial={{
            default_warehouse_id: s?.default_warehouse_id ?? '',
            require_adjustment_approval: s?.require_adjustment_approval ?? true,
            low_stock_alerts: s?.low_stock_alerts ?? true,
            import_max_rows: String(s?.import_max_rows ?? 2000),
            unknown_code_action: s?.unknown_code_action ?? 'offer_create',
          }}
          fields={[
            { name: 'default_warehouse_id', label: 'Almacén predeterminado (POS y escaneo)', type: 'select', options: opts.warehouses.map((w) => ({ value: w.id, label: w.label })), disabled: !canEdit },
            { name: 'import_max_rows', label: 'Tope de filas por importación', type: 'number', help: 'Entre 1 y 10.000', disabled: !canEdit },
            { name: 'unknown_code_action', label: 'Código escaneado desconocido', type: 'select', options: [{ value: 'offer_create', label: 'Ofrecer alta (según rol)' }, { value: 'block', label: 'Bloquear' }], disabled: !canEdit },
            { name: 'require_adjustment_approval', label: 'Los ajustes requieren aprobación', type: 'checkbox', disabled: !canEdit },
            { name: 'low_stock_alerts', label: 'Alertas de stock mínimo', type: 'checkbox', disabled: !canEdit },
          ]}
        />
        <DataTable head={['Parámetro', 'Valor']}>
          <tr><td>Método de valuación</td><td>Costo promedio ponderado (fijo)</td></tr>
          <tr><td>Stock negativo</td><td>Nunca permitido</td></tr>
          <tr><td>Última modificación</td><td>{fmtDate(s?.updated_at)}</td></tr>
        </DataTable>
      </Panel>
      <Panel title="Auditoría de configuración">
        <DataTable head={['Fecha', 'Acción', 'Entidad']} empty="Sin cambios registrados.">
          {(audit ?? []).map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{fmtDate(a.created_at)}</td>
              <td className="font-mono text-[11px]">{a.action}</td>
              <td>{a.entity}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      <ActionsBar items={['Guardar', 'Auditoría']} />
    </div>
  );
}
