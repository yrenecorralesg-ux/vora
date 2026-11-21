import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizeWarehouse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

const BUCKET = 'warehouse-evidence';
const MAX_BYTES = 5 * 1024 * 1024;

/** Tipo real por firma de bytes (no se confía en la extensión ni en el Content-Type). */
function sniff(buf: Uint8Array): { ext: string; mime: string } | null {
  const at = (i: number, bytes: number[]) => bytes.every((b, j) => buf[i + j] === b);
  if (at(0, [0xff, 0xd8, 0xff])) return { ext: 'jpg', mime: 'image/jpeg' };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', mime: 'image/png' };
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return { ext: 'webp', mime: 'image/webp' };
  if (at(0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: 'pdf', mime: 'application/pdf' };
  return null;
}

/** POST multipart {file}: sube la evidencia de un ajuste (WH-07) y devuelve su ruta privada. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'stock.adjust.request' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Adjunta un archivo.' }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo debe pesar como máximo 5 MB.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return NextResponse.json({ error: 'Solo se admiten imágenes JPG, PNG o WEBP y documentos PDF.' }, { status: 400 });

  const path = `${ctx.tenantId}/${randomUUID()}.${type.ext}`;
  const { error } = await ctx.service.storage.from(BUCKET).upload(path, bytes, { contentType: type.mime, upsert: false });
  if (error) return NextResponse.json({ error: 'No se pudo guardar la evidencia.' }, { status: 500 });
  return NextResponse.json({ path, mime: type.mime, size: file.size }, { status: 201 });
}

/** GET ?path=…: abre la evidencia con un enlace firmado de 60 s (solo de la propia empresa). */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const path = new URL(req.url).searchParams.get('path') ?? '';
  if (!path.startsWith(`${ctx.tenantId}/`) || path.includes('..'))
    return NextResponse.json({ error: 'Evidencia no encontrada.' }, { status: 404 });
  const { data: doc } = await ctx.service
    .from('warehouse_documents')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('evidence_path', path)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Evidencia no encontrada.' }, { status: 404 });
  const { data, error } = await ctx.service.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: 'No se pudo abrir la evidencia.' }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
