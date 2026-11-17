import { Check, Minus } from 'lucide-react';
import { requireWarehousePage, WAREHOUSE_PERMISSIONS } from '@/lib/warehouse/access';
import { PERMISSION_LABELS, ROLE_LABELS } from '@/lib/warehouse/catalog';
import { ActionsBar, DataTable, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

const ROLES = ['tenant_admin', 'wh_manager', 'wh_supervisor', 'wh_clerk', 'wh_scanner', 'wh_auditor'];

/** WH-12 · Roles y permisos: acceso por tenant y operación. */
export default async function RolesPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const [{ data: perms }, { data: members }] = await Promise.all([
    ctx.service.from('role_permissions').select('role_key, permission').eq('scope', 'tenant').in('role_key', ROLES),
    ctx.service.from('tenant_memberships').select('role').eq('tenant_id', ctx.tenantId).eq('status', 'active'),
  ]);
  const has = (role: string, p: string) => role === 'tenant_admin' || (perms ?? []).some((r) => r.role_key === role && r.permission === p);
  const count = (role: string) => (members ?? []).filter((m) => m.role === role).length;

  return (
    <div className="space-y-4">
      <WhHeader code="WH-12" title="Roles y permisos" subtitle="Acceso por empresa y operación" />
      <Panel title="Matriz de permisos">
        <DataTable head={['Permiso', ...ROLES.map((r) => ROLE_LABELS[r])]}>
          {WAREHOUSE_PERMISSIONS.map((p) => (
            <tr key={p}>
              <td>
                {PERMISSION_LABELS[p]}
                <span className="block font-mono text-[10px] text-slate-400">{p}</span>
              </td>
              {ROLES.map((r) => (
                <td key={r} className="text-center">
                  {has(r, p) ? <Check aria-label="Sí" className="mx-auto h-4 w-4 text-emerald-600" /> : <Minus aria-label="No" className="mx-auto h-4 w-4 text-slate-300" />}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="font-medium">Usuarios con este rol en la empresa</td>
            {ROLES.map((r) => (
              <td key={r} className="text-center tabular-nums">{count(r)}</td>
            ))}
          </tr>
        </DataTable>
        <div className="mt-3 space-y-1 text-[12px] text-slate-500">
          <p>Todos los miembros activos pueden consultar catálogo, stock y kardex. Los costos solo los ve quien tiene “Ver costos”.</p>
          <p>Tu rol: <strong>{ROLE_LABELS[ctx.role] ?? ctx.role}</strong>. La asignación de roles a usuarios se gestiona desde la administración de la empresa; la matriz es común a todas las empresas y la mantiene Venesoft.</p>
          <p>Quien solicita un ajuste no puede aprobarlo, salvo el administrador de la empresa.</p>
        </div>
      </Panel>
      <ActionsBar items={['Consultar matriz', 'Roles asignados']} />
    </div>
  );
}
