import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { validTenantSlug } from '@/lib/core-config';
import { z } from 'zod';
const schema = z.object({
  commercial_name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(validTenantSlug, 'Subdominio inválido o reservado.'),
  infrastructure_mode: z.enum(['shared', 'dedicated']).default('shared'),
  legal_name: z.string().trim().max(200).optional(),
  tax_id: z.string().trim().max(40).optional(),
});
export async function POST(req: Request) {
  if (!(await requireSuperAdmin()))
    return NextResponse.json(
      { error: 'Acceso exclusivo para Super Admin.' },
      { status: 403 },
    );
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const d = parsed.data;
  const { data, error } = await getSupabaseServerClient().rpc(
    'vora_create_tenant',
    {
      p_name: d.commercial_name,
      p_slug: d.slug,
      p_mode: d.infrastructure_mode,
      p_legal: d.legal_name ?? null,
      p_tax_id: d.tax_id ?? null,
    },
  );
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === '23505'
            ? 'Ese subdominio ya está reservado.'
            : 'No se pudo crear la empresa. Verifica que la migración de Core esté instalada.',
      },
      { status: error.code === '23505' ? 409 : 500 },
    );
  return NextResponse.json({ tenant: data }, { status: 201 });
}
export async function GET() {
  if (!(await requireSuperAdmin()))
    return NextResponse.json(
      { error: 'Permisos insuficientes.' },
      { status: 403 },
    );
  const { data, error } = await getSupabaseServerClient()
    .from('tenants')
    .select(
      'id,commercial_name,slug,commercial_status,technical_status,created_at',
    )
    .order('created_at', { ascending: false });
  return error
    ? NextResponse.json({ error: 'Error al listar empresas.' }, { status: 500 })
    : NextResponse.json({ tenants: data });
}
