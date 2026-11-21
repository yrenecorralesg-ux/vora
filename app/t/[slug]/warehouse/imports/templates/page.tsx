import { FileDown } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { IMPORT_COLUMN_LABELS, IMPORT_OPERATIONS, ITEM_TYPES, type ImportOperation } from '@/lib/warehouse/catalog';
import { DataTable, DownloadLink, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-20 · Descargar plantilla: formato según tipo de empresa. */
export default async function TemplatesPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'import.validate', fn: 'wh_imports' });
  const [{ data: profile }, { data: attrs }, { data: units }, { data: warehouses }] = await Promise.all([
    ctx.service.from('warehouse_business_profiles').select('sector, template_key').eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.service.from('warehouse_attribute_definitions').select('key, label, data_type, options, required').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('sort_order'),
    ctx.service.from('warehouse_units').select('code').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('code'),
    ctx.service.from('warehouse_warehouses').select('code').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('code'),
  ]);
  const api = `/api/t/${params.slug}/warehouse/export?kind=template&operation=`;

  return (
    <div className="space-y-4">
      <WhHeader code="WH-20" icon={FileDown} title="Descargar plantilla" subtitle={profile ? `Formato para ${profile.sector}` : 'Formato según tipo de empresa'} />
      <Panel title="Plantillas">
        <DataTable head={['Plantilla', 'Columnas principales', 'Formato']}>
          {(Object.keys(IMPORT_OPERATIONS) as ImportOperation[]).map((op) => (
            <tr key={op}>
              <td>{IMPORT_OPERATIONS[op].label} <span className="text-[11px] text-slate-500">v1</span></td>
              <td className="text-[12px]">
                {IMPORT_OPERATIONS[op].columns.join(', ')}
                {op === 'items' && (attrs ?? []).length > 0 && <span className="text-slate-500">, {(attrs ?? []).map((a) => `attr:${a.key}`).join(', ')}</span>}
              </td>
              <td><DownloadLink href={`${api}${op}`}>Descargar CSV</DownloadLink></td>
            </tr>
          ))}
        </DataTable>
        <p className="mt-2 text-[12px] text-slate-500">
          XLSX con listas desplegables: pendiente de elegir la librería. Mientras tanto, abre el CSV en Excel y guárdalo como “CSV UTF-8”.
        </p>
      </Panel>

      <Panel title="Instrucciones y valores válidos">
        <div className="grid gap-4 text-[12px] text-slate-600 lg:grid-cols-2">
          <div className="space-y-2">
            <p><strong>Columnas obligatorias</strong> (*) por plantilla:</p>
            <ul className="list-disc pl-5">
              {(Object.keys(IMPORT_OPERATIONS) as ImportOperation[]).map((op) => (
                <li key={op}>{IMPORT_OPERATIONS[op].label}: {IMPORT_OPERATIONS[op].required.map((c) => IMPORT_COLUMN_LABELS[c]).join(', ')}</li>
              ))}
            </ul>
            <p>Decimales con punto o coma. Varios códigos de barras separados por “|”. La fila de ejemplo debe borrarse antes de importar.</p>
            <p>El stock inicial solo suma: no se aceptan cantidades negativas ni se sobrescribe el stock existente.</p>
          </div>
          <div className="space-y-2">
            <p><strong>Tipos de ítem (item_type):</strong> {Object.keys(ITEM_TYPES).join(', ')}</p>
            <p><strong>Unidades (unit):</strong> {(units ?? []).map((u) => u.code).join(', ') || '—'}</p>
            <p><strong>Almacenes (warehouse):</strong> {(warehouses ?? []).map((w) => w.code).join(', ') || '—'}</p>
            {(attrs ?? []).length > 0 && (
              <p>
                <strong>Atributos:</strong>{' '}
                {(attrs ?? []).map((a) => `attr:${a.key} (${a.label}${a.required ? ', obligatorio' : ''}${a.data_type === 'select' ? `: ${(a.options as string[]).join('/')}` : ''})`).join('; ')}
              </p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
