import { NextResponse } from 'next/server';
import { authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

/** POST {action: 'approve'|'reject'|'reverse', note}: aprobación de ajustes (WH-07) y reversos auditados. */
export async function POST(req: Request, { params }: { params: { slug: string; id: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'stock.adjust.approve' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => ({}))) as { action?: string; note?: string };
  const note = String(body.note ?? '').slice(0, 500);

  const { data: doc } = await ctx.service
    .from('warehouse_documents')
    .select('id, created_by, status')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', params.id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });

  const args = { p_tenant: ctx.tenantId, p_document: params.id, p_actor: ctx.userId };
  let result;
  switch (body.action) {
    case 'approve':
      // Segregación de funciones: quien solicita un ajuste no lo aprueba, salvo el administrador.
      if (doc.created_by === ctx.userId && !['tenant_admin', 'super_admin'].includes(ctx.role))
        return NextResponse.json({ error: 'Otro usuario debe aprobar tu solicitud.' }, { status: 403 });
      result = await ctx.service.rpc('warehouse_post_document', args);
      break;
    case 'reject':
      result = await ctx.service.rpc('warehouse_reject_document', { ...args, p_note: note });
      break;
    case 'reverse':
      if (!note.trim()) return NextResponse.json({ error: 'Indica el motivo del reverso.' }, { status: 400 });
      result = await ctx.service.rpc('warehouse_reverse_document', { ...args, p_note: note });
      break;
    default:
      return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  }
  if (result.error) return dbErrorResponse(result.error);
  return NextResponse.json({ ok: true });
}
