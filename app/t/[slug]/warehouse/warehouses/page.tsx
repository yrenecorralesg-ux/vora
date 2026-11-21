import { Warehouse } from 'lucide-react';
import Link from 'next/link';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { ConfigForm, type ConfigField } from '@/components/warehouse/config-form';
import { DataTable, Panel, Pill, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-04 · Almacenes y ubicaciones: existencias por sede y depósito. */
export default async function WarehousesPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const [{ data: warehouses }, { data: branches }, { data: balances }, { data: settings }] = await Promise.all([
    ctx.service.from('warehouse_warehouses').select('id, code, name, address, status, branch_id, tenant_branches(name)').eq('tenant_id', ctx.tenantId).order('code'),
    ctx.service.from('tenant_branches').select('id, name').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('name'),
    ctx.service.from('warehouse_balances').select('warehouse_id, on_hand, avg_cost').eq('tenant_id', ctx.tenantId).gt('on_hand', 0).limit(10000),
    ctx.service.from('warehouse_settings').select('default_warehouse_id').eq('tenant_id', ctx.tenantId).maybeSingle(),
  ]);
  const stats = new Map<string, { products: number; value: number }>();
  for (const b of balances ?? []) {
    const s = stats.get(b.warehouse_id) ?? { products: 0, value: 0 };
    s.products += 1;
    s.value += Number(b.on_hand) * Number(b.avg_cost);
    stats.set(b.warehouse_id, s);
  }
  const canConfigure = ctx.can('warehouse.configure');
  const fields: ConfigField[] = [
    { name: 'code', label: 'Código', placeholder: 'SEDE-CCS', help: 'Mayúsculas, números, - y _' },
    { name: 'name', label: 'Nombre' },
    { name: 'branch_id', label: 'Sede', type: 'select', options: [{ value: '', label: 'Sin sede' }, ...(branches ?? []).map((b) => ({ value: b.id, label: b.name }))] },
    { name: 'address', label: 'Dirección' },
    { name: 'status', label: 'Estado', type: 'select', options: [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }] },
  ];
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);

  return (
    <div className="space-y-4">
      <WhHeader code="WH-04" icon={Warehouse} title="Almacenes y ubicaciones" subtitle="Existencias por sede y depósito" />
      <Panel title="Almacenes">
        <DataTable head={['Almacén', 'Sede', 'Productos con stock', ...(ctx.can('cost.view') ? ['Valor'] : []), 'Estado', '']}>
          {(warehouses ?? []).map((w) => {
            const s = stats.get(w.id);
            return (
              <tr key={w.id}>
                <td>
                  <span className="font-mono text-[11px]">{w.code}</span> {w.name}
                  {settings?.default_warehouse_id === w.id && <span className="ml-2"><Pill tone="blue">Predeterminado</Pill></span>}
                </td>
                <td>{one(w.tenant_branches)?.name ?? '—'}</td>
                <td className="tabular-nums">{fmtQty(s?.products ?? 0)}</td>
                {ctx.can('cost.view') && <td className="tabular-nums">{fmtMoney(s?.value ?? 0)}</td>}
                <td>{w.status === 'active' ? <Pill tone="green">Activo</Pill> : <Pill>Inactivo</Pill>}</td>
                <td>
                  <Link href={`/t/${params.slug}/warehouse/stock?warehouse=${w.id}`} className="text-[12px] text-[#285C49] underline">Ver stock</Link>
                  {canConfigure && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[12px] text-slate-500">Editar</summary>
                      <div className="mt-2 min-w-[600px]">
                        <ConfigForm slug={params.slug} entity="warehouse" fields={fields} initial={{ id: w.id, code: w.code, name: w.name, branch_id: w.branch_id ?? '', address: w.address ?? '', status: w.status }} />
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
      {canConfigure && (
        <Panel title="Nuevo almacén">
          <ConfigForm slug={params.slug} entity="warehouse" fields={fields} initial={{ code: '', name: '', branch_id: '', address: '', status: 'active' }} submitLabel="Crear almacén" resetOnSuccess />
        </Panel>
      )}
    </div>
  );
}
