import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';
import { IMPORT_OPERATIONS, type ImportOperation } from '@/lib/warehouse/catalog';
import { IMPORT_MAX_BYTES, validateImport } from '@/lib/warehouse/validation';

export const dynamic = 'force-dynamic';

/**
 * POST {operation, file_name, content, mapping}: valida en servidor (WH-19 → WH-21).
 * Guarda el resultado por fila sin tocar existencias; aplicar es un paso aparte (WH-22).
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'import.validate', fn: 'wh_imports' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as
    | { operation?: string; file_name?: string; content?: string; mapping?: Record<string, string> }
    | null;
  const operation = body?.operation as ImportOperation;
  if (!body || !(operation in IMPORT_OPERATIONS)) return NextResponse.json({ error: 'Operación inválida.' }, { status: 400 });
  const fileName = String(body.file_name ?? '').slice(0, 200);
  if (!/\.csv$/i.test(fileName))
    return NextResponse.json({ error: 'Por ahora se aceptan archivos CSV. Desde Excel: Guardar como → CSV UTF-8.' }, { status: 400 });
  const content = String(body.content ?? '');
  if (!content || Buffer.byteLength(content, 'utf8') > IMPORT_MAX_BYTES)
    return NextResponse.json({ error: 'El archivo está vacío o supera 2 MB.' }, { status: 400 });

  const { data: settings } = await ctx.service
    .from('warehouse_settings')
    .select('import_max_rows')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  const result = await validateImport(ctx, operation, content, body.mapping ?? {}, settings?.import_max_rows ?? 2000);
  if (result.fatal) return NextResponse.json({ error: result.fatal }, { status: 400 });

  const { data: applied } = await ctx.service
    .from('warehouse_import_jobs')
    .select('id, applied_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('operation', operation)
    .eq('file_sha256', result.sha256)
    .eq('status', 'applied')
    .maybeSingle();

  const errorRows = result.rows.filter((r) => r.errors.length).length;
  const count = (a: string) => result.rows.filter((r) => !r.errors.length && r.action === a).length;
  const { data: job, error } = await ctx.service
    .from('warehouse_import_jobs')
    .insert({
      tenant_id: ctx.tenantId,
      operation,
      file_name: fileName,
      file_sha256: result.sha256,
      status: errorRows ? 'invalid' : 'validated',
      total_rows: result.rows.length,
      valid_rows: result.rows.length - errorRows,
      error_rows: errorRows,
      summary: {
        create: count('create'),
        update: count('update'),
        movement: count('movement'),
        duplicate_of: applied?.id ?? null,
        mapping: body.mapping ?? {},
      },
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error || !job) return dbErrorResponse(error, 'No se pudo registrar la importación.');

  for (let i = 0; i < result.rows.length; i += 500) {
    const { error: rowError } = await ctx.service.from('warehouse_import_rows').insert(
      result.rows.slice(i, i + 500).map((r) => ({ ...r, tenant_id: ctx.tenantId, job_id: job.id })),
    );
    if (rowError) {
      await ctx.service.from('warehouse_import_jobs').delete().eq('id', job.id);
      return dbErrorResponse(rowError, 'No se pudieron guardar las filas validadas.');
    }
  }
  await auditWarehouse(ctx, 'import.validate', 'warehouse_import_jobs', job.id, { operation, file: fileName, errors: errorRows });
  return NextResponse.json({ id: job.id }, { status: 201 });
}
