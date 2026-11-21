import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, FULL_ACCESS_ROLES, WAREHOUSE_PERMISSIONS } from '@/lib/warehouse/access';
import { EDITABLE_ROLES } from '@/lib/warehouse/catalog';

export const dynamic = 'force-dynamic';


/**
 * WH-12. Solo el administrador de la empresa (o Venesoft) cambia permisos:
 *  - action 'set_role': {role_key, permissions[]} → matriz propia de la empresa.
 *  - action 'reset_role': {role_key} → vuelve a los valores por defecto.
 *  - action 'set_scope': {auth_user_id, warehouse_ids[]} → almacenes permitidos ([] = todos).
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  if (!FULL_ACCESS_ROLES.includes(ctx.role))
    return NextResponse.json({ error: 'Solo el administrador de la empresa puede cambiar roles y permisos.' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  const action = String(body.action ?? '');

  if (action === 'set_role' || action === 'reset_role') {
    const role = String(body.role_key ?? '');
    if (!EDITABLE_ROLES.includes(role)) return NextResponse.json({ error: 'Rol no editable.' }, { status: 400 });
    if (action === 'reset_role') {
      await ctx.service.from('tenant_role_matrix').delete().eq('tenant_id', ctx.tenantId).eq('role_key', role);
      await auditWarehouse(ctx, 'roles.reset', 'tenant_role_matrix', role);
      return NextResponse.json({ ok: true });
    }
    const valid = new Set<string>(WAREHOUSE_PERMISSIONS);
    const requested = Array.isArray(body.permissions) ? (body.permissions as unknown[]).map(String) : [];
    if (requested.some((p) => !valid.has(p))) return NextResponse.json({ error: 'Permiso desconocido.' }, { status: 400 });
    const permissions = Array.from(new Set(requested)).sort();
    const { error } = await ctx.service.from('tenant_role_matrix').upsert(
      { tenant_id: ctx.tenantId, role_key: role, permissions, updated_by: ctx.userId, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,role_key' },
    );
    if (error) return NextResponse.json({ error: 'No se pudo guardar la matriz.' }, { status: 500 });
    await auditWarehouse(ctx, 'roles.update', 'tenant_role_matrix', role, { permissions });
    return NextResponse.json({ ok: true, permissions });
  }

  if (action === 'set_scope') {
    const userId = String(body.auth_user_id ?? '');
    const { data: member } = await ctx.service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', ctx.tenantId)
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (!member) return NextResponse.json({ error: 'El usuario no pertenece a la empresa.' }, { status: 404 });
    const ids = Array.from(new Set(Array.isArray(body.warehouse_ids) ? (body.warehouse_ids as unknown[]).map(String) : []));
    if (ids.length) {
      const { data: whs } = await ctx.service.from('warehouse_warehouses').select('id').eq('tenant_id', ctx.tenantId).in('id', ids);
      if ((whs ?? []).length !== ids.length) return NextResponse.json({ error: 'Algún almacén no pertenece a la empresa.' }, { status: 400 });
    }
    await ctx.service.from('warehouse_user_scopes').delete().eq('tenant_id', ctx.tenantId).eq('auth_user_id', userId);
    if (ids.length) {
      const { error } = await ctx.service
        .from('warehouse_user_scopes')
        .insert(ids.map((id) => ({ tenant_id: ctx.tenantId, auth_user_id: userId, warehouse_id: id, created_by: ctx.userId })));
      if (error) return NextResponse.json({ error: 'No se pudo guardar el alcance.' }, { status: 500 });
    }
    await auditWarehouse(ctx, 'roles.scope', 'warehouse_user_scopes', userId, { warehouse_ids: ids });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
}
