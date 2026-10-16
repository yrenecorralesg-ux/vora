import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';

/**
 * POST /api/admin/tenants/[id]/upload
 * Uploads an image file to Supabase Storage bucket 'tenant-assets'
 * and returns the public URL.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const admin = await isSuperAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol super_admin.' },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'asset';

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo.' }, { status: 400 });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10MB.' }, { status: 400 });
    }

    const service = getSupabaseServiceClient();

    // Verify tenant
    const { data: tenant } = await service
      .from('tenants')
      .select('id, slug')
      .eq('id', params.id)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    }

    // Ensure bucket exists
    const { data: buckets } = await service.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === 'tenant-assets');
    if (!bucketExists) {
      await service.storage.createBucket('tenant-assets', { public: true });
    }

    // Prepare filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const cleanType = type.replace(/[^a-z0-9_-]/gi, '');
    const fileName = `${tenant.slug}/${cleanType}_${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await service.storage
      .from('tenant-assets')
      .upload(fileName, buffer, {
        contentType: file.type || 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      console.error('[upload] error:', uploadError);
      return NextResponse.json(
        { error: 'Error al subir la imagen a almacenamiento.', detail: uploadError.message },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = service.storage.from('tenant-assets').getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
    });
  } catch (err: any) {
    console.error('[upload] exception:', err);
    return NextResponse.json(
      { error: err.message || 'Error inesperado al procesar la subida.' },
      { status: 500 },
    );
  }
}
