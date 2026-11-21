import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, FULL_ACCESS_ROLES, resolveRolePermissions } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

const REPORTS = ['stock', 'valuation', 'rotation', 'kardex'];
const FREQUENCIES = ['daily', 'weekly', 'monthly'];

/**
 * WH-11 · Programar reportes.
 *  action 'create': {report, frequency, weekday?, month_day?, recipients[], warehouse_id?}
 *  action 'toggle' | 'delete': {id}
 * Los destinatarios deben ser miembros activos que puedan ver reportes.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'report.view', fn: 'wh_reports' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });

  if (body.action === 'toggle' || body.action === 'delete') {
    const { data: s } = await ctx.service
      .from('warehouse_report_schedules')
      .select('id, active, created_by')
      .eq('tenant_id', ctx.tenantId)
      .eq('id', String(body.id ?? ''))
      .maybeSingle();
    if (!s) return NextResponse.json({ error: 'Programación no encontrada.' }, { status: 404 });
    if (s.created_by !== ctx.userId && !FULL_ACCESS_ROLES.includes(ctx.role))
      return NextResponse.json({ error: 'Solo quien la creó o el administrador puede cambiarla.' }, { status: 403 });
    if (body.action === 'delete') await ctx.service.from('warehouse_report_schedules').delete().eq('id', s.id);
    else await ctx.service.from('warehouse_report_schedules').update({ active: !s.active }).eq('id', s.id);
    await auditWarehouse(ctx, `report_schedule.${body.action}`, 'warehouse_report_schedules', s.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action !== 'create') return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  const report = String(body.report ?? '');
  const frequency = String(body.frequency ?? '');
  if (!REPORTS.includes(report) || !FREQUENCIES.includes(frequency))
    return NextResponse.json({ error: 'Reporte o frecuencia inválidos.' }, { status: 400 });
  if (report === 'valuation' && !ctx.can('cost.view'))
    return NextResponse.json({ error: 'La valorización requiere permiso para ver costos.' }, { status: 403 });
  const weekday = frequency === 'weekly' ? Number(body.weekday) : null;
  const monthDay = frequency === 'monthly' ? Number(body.month_day) : null;
  if (weekday !== null && !(weekday >= 1 && weekday <= 7)) return NextResponse.json({ error: 'Día de la semana inválido.' }, { status: 400 });
  if (monthDay !== null && !(monthDay >= 1 && monthDay <= 28)) return NextResponse.json({ error: 'Día del mes inválido (1 a 28).' }, { status: 400 });

  const recipients = Array.from(new Set(Array.isArray(body.recipients) ? (body.recipients as unknown[]).map(String) : []));
  if (!recipients.length || recipients.length > 20) return NextResponse.json({ error: 'Elige entre 1 y 20 destinatarios.' }, { status: 400 });
  const { data: members } = await ctx.service
    .from('tenant_memberships')
    .select('auth_user_id, role')
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'active')
    .in('auth_user_id', recipients);
  if ((members ?? []).length !== recipients.length)
    return NextResponse.json({ error: 'Todos los destinatarios deben ser usuarios activos de la empresa.' }, { status: 400 });
  for (const m of members ?? []) {
    if (FULL_ACCESS_ROLES.includes(m.role)) continue;
    const perms = await resolveRolePermissions(ctx.service, ctx.tenantId, m.role);
    if (!perms.has('report.view'))
      return NextResponse.json({ error: 'Algún destinatario no tiene permiso para ver reportes.' }, { status: 400 });
  }
  const warehouseId = body.warehouse_id ? String(body.warehouse_id) : null;
  if (warehouseId && !ctx.canUseWarehouse(warehouseId)) return NextResponse.json({ error: 'No tienes acceso a ese almacén.' }, { status: 403 });

  const { data, error } = await ctx.service
    .from('warehouse_report_schedules')
    .insert({ tenant_id: ctx.tenantId, report, frequency, weekday, month_day: monthDay, recipients, warehouse_id: warehouseId, created_by: ctx.userId })
    .select('id')
    .single();
  if (error || !data) return NextResponse.json({ error: 'No se pudo guardar la programación.' }, { status: 500 });
  await auditWarehouse(ctx, 'report_schedule.create', 'warehouse_report_schedules', data.id, { report, frequency });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
