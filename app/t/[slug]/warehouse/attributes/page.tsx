import { requireWarehousePage } from '@/lib/warehouse/access';
import { ConfigForm, type ConfigField } from '@/components/warehouse/config-form';
import { ActionsBar, DataTable, Panel, Pill, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = { text: 'Texto', number: 'Número', date: 'Fecha', boolean: 'Sí / No', select: 'Lista' };

/** WH-16 · Capacidades y atributos: campos dinámicos por categoría. */
export default async function AttributesPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const [{ data: attrs }, { data: categories }] = await Promise.all([
    ctx.service.from('warehouse_attribute_definitions').select('*').eq('tenant_id', ctx.tenantId).order('sort_order').order('label'),
    ctx.service.from('warehouse_categories').select('id, name').eq('tenant_id', ctx.tenantId).order('name'),
  ]);
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const canEdit = ctx.can('warehouse.configure');
  const fields = (editing: boolean): ConfigField[] => [
    { name: 'label', label: 'Campo' },
    { name: 'key', label: 'Clave interna', placeholder: 'talla', help: editing ? 'No se puede cambiar' : 'Minúsculas y _; se usa en importaciones (attr:clave)', disabled: editing },
    { name: 'data_type', label: 'Tipo', type: 'select', options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })) },
    { name: 'options', label: 'Opciones (si es lista)', placeholder: 'S, M, L, XL' },
    { name: 'category_id', label: 'Aplica a', type: 'select', options: [{ value: '', label: 'Todas las categorías' }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))] },
    { name: 'status', label: 'Estado', type: 'select', options: [{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }] },
    { name: 'required', label: 'Obligatorio', type: 'checkbox' },
  ];

  return (
    <div className="space-y-4">
      <WhHeader code="WH-16" title="Capacidades y atributos" subtitle="Campos dinámicos por categoría" />
      <Panel title="Atributos">
        <DataTable head={['Campo', 'Tipo', 'Obligatorio', 'Aplica a', 'Origen', 'Estado', '']} empty="Sin atributos. Aplica una plantilla de sector o crea uno.">
          {(attrs ?? []).map((a) => (
            <tr key={a.id}>
              <td>
                {a.label} <span className="font-mono text-[10px] text-slate-400">{a.key}</span>
              </td>
              <td>{TYPE_LABEL[a.data_type]}{a.data_type === 'select' && <span className="block text-[11px] text-slate-500">{(a.options as string[]).join(', ')}</span>}</td>
              <td>{a.required ? 'Sí' : 'No'}</td>
              <td>{a.category_id ? catName.get(a.category_id) : 'Todas'}</td>
              <td>{a.source === 'template' ? <Pill tone="blue">Plantilla</Pill> : <Pill>Propio</Pill>}</td>
              <td>{a.status === 'active' ? <Pill tone="green">Activo</Pill> : <Pill>Inactivo</Pill>}</td>
              <td>
                {canEdit && (
                  <details>
                    <summary className="cursor-pointer text-[12px] text-slate-500">Editar</summary>
                    <div className="mt-2 min-w-[640px]">
                      <ConfigForm
                        slug={params.slug}
                        entity="attribute"
                        fields={fields(true)}
                        initial={{ id: a.id, label: a.label, key: a.key, data_type: a.data_type, options: (a.options as string[]).join(', '), category_id: a.category_id ?? '', status: a.status, required: a.required }}
                      />
                    </div>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      {canEdit && (
        <Panel title="Nuevo atributo">
          <ConfigForm
            slug={params.slug}
            entity="attribute"
            fields={fields(false)}
            initial={{ label: '', key: '', data_type: 'text', options: '', category_id: '', status: 'active', required: false }}
            submitLabel="Nuevo atributo"
            resetOnSuccess
          />
        </Panel>
      )}
      <ActionsBar items={['Nuevo atributo', 'Guardar']} />
    </div>
  );
}
