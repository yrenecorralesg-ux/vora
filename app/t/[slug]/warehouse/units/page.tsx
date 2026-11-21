import { Ruler } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { fmtQty } from '@/lib/warehouse/format';
import { ConfigForm, type ConfigField } from '@/components/warehouse/config-form';
import { DataTable, Panel, Pill, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-18 · Unidades y conversiones: compra, almacén y venta. */
export default async function UnitsPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const { data: units } = await ctx.service.from('warehouse_units').select('*').eq('tenant_id', ctx.tenantId).order('code');
  const byId = new Map((units ?? []).map((u) => [u.id, u]));
  const bases = (units ?? []).filter((u) => !u.base_unit_id);
  const canEdit = ctx.can('warehouse.configure');
  const fields = (selfId?: string): ConfigField[] => [
    { name: 'code', label: 'Código', placeholder: 'CAJA12' },
    { name: 'name', label: 'Unidad', placeholder: 'Caja x 12' },
    { name: 'symbol', label: 'Símbolo', placeholder: 'cj12' },
    { name: 'base_unit_id', label: 'Base', type: 'select', options: [{ value: '', label: 'Es unidad base' }, ...bases.filter((b) => b.id !== selfId).map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))] },
    { name: 'factor', label: 'Factor', type: 'number', help: '1 de esta unidad = factor × base' },
    { name: 'status', label: 'Estado', type: 'select', options: [{ value: 'active', label: 'Activa' }, { value: 'inactive', label: 'Inactiva' }] },
  ];

  return (
    <div className="space-y-4">
      <WhHeader code="WH-18" icon={Ruler} title="Unidades y conversiones" subtitle="Compra, almacén y venta" />
      <Panel title="Unidades">
        <DataTable head={['Unidad', 'Símbolo', 'Base', 'Factor', 'Estado', '']}>
          {(units ?? []).map((u) => (
            <tr key={u.id}>
              <td><span className="font-mono text-[11px]">{u.code}</span> {u.name}</td>
              <td>{u.symbol}</td>
              <td>{u.base_unit_id ? byId.get(u.base_unit_id)?.code : '—'}</td>
              <td className="tabular-nums">{u.base_unit_id ? `1 ${u.symbol} = ${fmtQty(u.factor)} ${byId.get(u.base_unit_id)?.symbol}` : '1'}</td>
              <td>{u.status === 'active' ? <Pill tone="green">Activa</Pill> : <Pill>Inactiva</Pill>}</td>
              <td>
                {canEdit && (
                  <details>
                    <summary className="cursor-pointer text-[12px] text-slate-500">Editar</summary>
                    <div className="mt-2 min-w-[600px]">
                      <ConfigForm slug={params.slug} entity="unit" fields={fields(u.id)} initial={{ id: u.id, code: u.code, name: u.name, symbol: u.symbol, base_unit_id: u.base_unit_id ?? '', factor: String(u.factor), status: u.status }} />
                    </div>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
        <p className="mt-2 text-[12px] text-slate-500">
          Las entradas y salidas aceptan cualquier unidad de la misma familia y la convierten a la unidad del artículo. Ejemplo: comprar en gramos un artículo que se controla en kilogramos.
        </p>
      </Panel>
      {canEdit && (
        <Panel title="Nueva unidad">
          <ConfigForm slug={params.slug} entity="unit" fields={fields()} initial={{ code: '', name: '', symbol: '', base_unit_id: '', factor: '1', status: 'active' }} submitLabel="Nueva unidad" resetOnSuccess />
        </Panel>
      )}
    </div>
  );
}
