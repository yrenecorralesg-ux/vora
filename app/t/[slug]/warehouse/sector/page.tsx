import { requireWarehousePage } from '@/lib/warehouse/access';
import { BUSINESS_SECTORS, BUSINESS_TEMPLATES } from '@/lib/warehouse/catalog';
import { fmtDate } from '@/lib/warehouse/format';
import { SectorForm } from '@/components/warehouse/sector-form';
import { ActionsBar, DataTable, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-15 · Alta de empresa y sector: selección de actividad y plantilla. */
export default async function SectorPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const { data: profile } = await ctx.service.from('warehouse_business_profiles').select('*').eq('tenant_id', ctx.tenantId).maybeSingle();
  const template = BUSINESS_TEMPLATES.find((t) => t.key === profile?.template_key);

  return (
    <div className="space-y-4">
      <WhHeader code="WH-15" title="Alta de empresa y sector" subtitle="Selección de actividad y plantilla" />
      {profile && (
        <Panel title="Perfil actual">
          <DataTable head={['Sector', 'Especialidad', 'Plantilla', 'Aplicada']}>
            <tr>
              <td>{profile.sector}</td>
              <td>{profile.specialty ?? '—'}</td>
              <td>{template?.name ?? profile.template_key} (v{profile.template_version})</td>
              <td>{fmtDate(profile.applied_at)}</td>
            </tr>
          </DataTable>
        </Panel>
      )}
      <Panel title={profile ? 'Cambiar o ampliar plantilla' : 'Selecciona el sector'}>
        {ctx.can('warehouse.configure') ? (
          <SectorForm slug={params.slug} sectors={BUSINESS_SECTORS} templates={BUSINESS_TEMPLATES} current={profile ? { sector: profile.sector, specialty: profile.specialty ?? '', template_key: profile.template_key } : null} />
        ) : (
          <p className="text-[13px] text-slate-600">Solo un administrador de almacén puede aplicar plantillas.</p>
        )}
        <p className="mt-3 text-[12px] text-slate-500">
          Aplicar una plantilla solo agrega los atributos que falten. No borra atributos existentes ni bloquea funciones de otros sectores; después puedes personalizarlos en Atributos.
        </p>
      </Panel>
      <ActionsBar items={['Aplicar plantilla', 'Personalizar']} />
    </div>
  );
}
