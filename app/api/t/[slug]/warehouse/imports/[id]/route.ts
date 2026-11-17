import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

/** POST {action: 'apply'|'cancel', partial?}: confirmación de importación (WH-22). */
export async function POST(req: Request, { params }: { params: { slug: string; id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; partial?: boolean };
  const auth = await authorizeWarehouse(params.slug, {
    permission: body.action === 'cancel' ? 'import.validate' : 'import.apply',
    fn: 'wh_imports',
  });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (body.action === 'cancel') {
    const { data, error } = await ctx.service
      .from('warehouse_import_jobs')
      .update({ status: 'cancelled' })
      .eq('tenant_id', ctx.tenantId)
      .eq('id', params.id)
      .in('status', ['validated', 'invalid'])
      .select('id')
      .maybeSingle();
    if (error) return dbErrorResponse(error);
    if (!data) return NextResponse.json({ error: 'La importación ya no puede cancelarse.' }, { status: 409 });
    await auditWarehouse(ctx, 'import.cancel', 'warehouse_import_jobs', params.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action !== 'apply') return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });

  const { data, error } = await ctx.service.rpc('warehouse_apply_import', {
    p_tenant: ctx.tenantId,
    p_job: params.id,
    p_actor: ctx.userId,
    p_partial: body.partial === true,
  });
  if (error) return dbErrorResponse(error, 'No se pudo aplicar la importación; no se modificó nada.');
  await auditWarehouse(ctx, 'import.apply', 'warehouse_import_jobs', params.id, { partial: body.partial === true, result: data });
  return NextResponse.json({ ok: true, result: data });
}
