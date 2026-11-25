import { ShieldCheck, Users } from 'lucide-react';
import { FULL_ACCESS_ROLES, requireWarehousePage, resolveRolePermissions, WAREHOUSE_PERMISSIONS } from '@/lib/warehouse/access';
import { EDITABLE_ROLES, PERMISSION_LABELS, ROLE_LABELS } from '@/lib/warehouse/catalog';
import { EmptyState, Panel, WhHeader } from '@/components/warehouse/wh-ui';
import { RolesMatrixEditor, UserScopesEditor } from '@/components/warehouse/roles-editor';

export const dynamic = 'force-dynamic';

/** WH-12 · Roles y permisos: acceso por empresa, almacén y operación. */
export default async function RolesPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'warehouse.configure', fn: 'wh_roles' });
  const editable = FULL_ACCESS_ROLES.includes(ctx.role);

  const [{ data: members }, { data: overrides }, { data: scopes }, { data: warehouses }] = await Promise.all([
    ctx.service.from('tenant_memberships').select('auth_user_id, role').eq('tenant_id', ctx.tenantId).eq('status', 'active'),
    ctx.service.from('tenant_role_matrix').select('role_key').eq('tenant_id', ctx.tenantId),
    ctx.service.from('warehouse_user_scopes').select('auth_user_id, warehouse_id').eq('tenant_id', ctx.tenantId),
    ctx.service.from('warehouse_warehouses').select('id, code, name').eq('tenant_id', ctx.tenantId).order('code'),
  ]);
  const customized = new Set((overrides ?? []).map((o) => o.role_key as string));
  const roles = await Promise.all(
    EDITABLE_ROLES.map(async (key) => ({
      key,
      label: ROLE_LABELS[key] ?? key,
      permissions: Array.from(await resolveRolePermissions(ctx.service, ctx.tenantId, key)).filter((p) =>
        (WAREHOUSE_PERMISSIONS as readonly string[]).includes(p),
      ),
      customized: customized.has(key),
      users: (members ?? []).filter((m) => m.role === key).length,
    })),
  );

  // Nombres de los usuarios (solo para el administrador, que gestiona alcances).
  const scopeUsers = editable
    ? await Promise.all(
        (members ?? [])
          .filter((m) => !FULL_ACCESS_ROLES.includes(m.role))
          .map(async (m) => {
            const { data } = await ctx.service.auth.admin.getUserById(m.auth_user_id);
            const u = data?.user;
            return {
              id: m.auth_user_id as string,
              name: (u?.user_metadata?.full_name as string) || u?.email || 'Usuario',
              role: m.role as string,
              warehouse_ids: (scopes ?? []).filter((s) => s.auth_user_id === m.auth_user_id).map((s) => s.warehouse_id as string),
            };
          }),
      )
    : [];

  return (
    <div className="space-y-5">
      <WhHeader code="WH-12" icon={ShieldCheck} title="Roles y permisos" subtitle="Acceso por empresa, almacén y operación" />

      <Panel
        title="Matriz de permisos"
        description={
          editable
            ? 'Marca qué puede hacer cada rol en esta empresa y guarda por columna. "Por defecto" vuelve a los valores de VORA.'
            : `Tu rol: ${ROLE_LABELS[ctx.role] ?? ctx.role}. Solo el administrador de la empresa puede cambiar la matriz.`
        }
      >
        <RolesMatrixEditor
          slug={params.slug}
          roles={roles}
          permissions={[...WAREHOUSE_PERMISSIONS]}
          labels={PERMISSION_LABELS}
          editable={editable}
        />
        <div className="mt-4 space-y-1 text-[12px] text-slate-500">
          <p>El administrador de la empresa siempre tiene todos los permisos. Todos los miembros pueden consultar catálogo, stock y kardex; los costos solo los ve quien tiene “Ver costos”.</p>
          <p>Quien solicita un ajuste no puede aprobarlo, salvo el administrador de la empresa. Los roles se asignan a cada usuario desde el gestor de VORA.</p>
        </div>
      </Panel>

      {editable && (
        <Panel title="Alcance por almacén" description="Limita en qué almacenes puede registrar entradas, salidas, ajustes, transferencias e importaciones cada usuario.">
          {scopeUsers.length ? (
            <UserScopesEditor
              slug={params.slug}
              users={scopeUsers}
              warehouses={(warehouses ?? []).map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` }))}
              roleLabels={ROLE_LABELS}
            />
          ) : (
            <EmptyState icon={Users} title="Sin usuarios con rol operativo" description="Asigna roles de almacén a los usuarios desde el gestor de VORA." />
          )}
        </Panel>
      )}
    </div>
  );
}
