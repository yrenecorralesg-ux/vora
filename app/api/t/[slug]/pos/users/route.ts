import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    // Si hay Supabase configurado, intentar consultar tenant_memberships
    const supabase = getSupabaseServerClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle();

    if (tenant) {
      const { data: members, error } = await supabase
        .from('tenant_memberships')
        .select('id, auth_user_id, role, status, created_at')
        .eq('tenant_id', tenant.id);

      if (!error && members && members.length > 0) {
        return NextResponse.json({ ok: true, users: members, source: 'supabase' });
      }
    }

    // Fallback reactivo a posStore en memoria
    return NextResponse.json({ ok: true, users: posStore.users, source: 'posStore' });
  } catch {
    return NextResponse.json({ ok: true, users: posStore.users, source: 'fallback' });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    if (!body.name || !body.pin) {
      return NextResponse.json({ ok: false, error: 'Nombre y PIN son obligatorios.' }, { status: 400 });
    }

    const created = posStore.createUser({
      name: body.name,
      email: body.email,
      role: body.role || 'pos_cashier',
      pin: body.pin,
      assignedBranchId: body.assignedBranchId || 'b0000000-0000-0000-0000-000000000001',
      assignedRegisterId: body.assignedRegisterId,
      commission_rate_percent: body.commission_rate_percent,
      is_active: body.is_active !== false,
    });

    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error al crear usuario.' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ ok: false, error: 'ID de usuario requerido.' }, { status: 400 });
    }

    const updated = posStore.updateUser(body.id, {
      name: body.name,
      email: body.email,
      role: body.role,
      pin: body.pin,
      assignedRegisterId: body.assignedRegisterId,
      commission_rate_percent: body.commission_rate_percent,
      is_active: body.is_active,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error al actualizar usuario.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'ID de usuario requerido.' }, { status: 400 });
    }

    const res = posStore.deleteUser(userId);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: 'Usuario eliminado exitosamente.' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error al eliminar usuario.' }, { status: 500 });
  }
}
