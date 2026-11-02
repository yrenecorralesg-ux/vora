import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  return NextResponse.json({
    ok: true,
    settings: posStore.settings,
    branches: posStore.branches,
    registers: posStore.registers,
    customers: posStore.customers,
    products: posStore.products,
    audit_events: posStore.auditEvents,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'update_settings') {
      if (body.max_cashier_discount_percent !== undefined) {
        posStore.settings.max_cashier_discount_percent = Number(body.max_cashier_discount_percent);
      }
      if (body.allow_partial_payments !== undefined) {
        posStore.settings.allow_partial_payments = Boolean(body.allow_partial_payments);
      }
      if (body.active_methods !== undefined) {
        posStore.settings.active_methods = body.active_methods;
      }
      if (body.active_exchange_rate !== undefined) {
        posStore.settings.active_exchange_rate = Number(body.active_exchange_rate);
      }
      if (body.internal_doc_prefix !== undefined) {
        posStore.settings.internal_doc_prefix = body.internal_doc_prefix;
      }
      posStore.settings.updated_at = new Date().toISOString();

      posStore.addAudit({
        branch_id: posStore.settings.branch_id,
        shift_id: null,
        actor_id: body.updated_by || null,
        event_type: 'actualizacion_configuracion',
        entity_type: 'pos_settings',
        entity_id: posStore.settings.id,
        description: 'Actualización de parámetros operativos de sede POS [mock]',
        metadata: body,
      });

      return NextResponse.json({ ok: true, settings: posStore.settings });
    }

    if (action === 'toggle_register') {
      const reg = posStore.registers.find((r) => r.id === body.register_id);
      if (!reg) {
        return NextResponse.json({ ok: false, error: 'Caja no encontrada' }, { status: 404 });
      }
      reg.status = body.status;
      reg.updated_at = new Date().toISOString();

      posStore.addAudit({
        branch_id: reg.branch_id,
        shift_id: null,
        actor_id: body.updated_by || null,
        event_type: 'estado_caja',
        entity_type: 'pos_registers',
        entity_id: reg.id,
        description: `Caja ${reg.name} actualizada a estado ${reg.status} [mock]`,
        metadata: { status: reg.status },
      });

      return NextResponse.json({ ok: true, register: reg });
    }

    if (action === 'create_register') {
      const newReg = {
        id: `r-${Date.now()}`,
        tenant_id: 't0000000-0000-0000-0000-000000000001',
        branch_id: body.branch_id,
        code: body.code,
        name: body.name,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      posStore.registers.push(newReg);

      return NextResponse.json({ ok: true, register: newReg });
    }

    return NextResponse.json({ ok: false, error: 'Acción de configuración no reconocida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

