import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';
import { BUSINESS_SECTORS, BUSINESS_TEMPLATES } from '@/lib/warehouse/catalog';
import { parseNumber } from '@/lib/warehouse/validation';

export const dynamic = 'force-dynamic';

const bad = (error: string, field?: string) =>
  NextResponse.json({ error, fields: field ? [{ field, message: error }] : undefined }, { status: 400 });
const text = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

/**
 * POST {entity, data}: almacenes (WH-04), unidades (WH-18), categorías y atributos (WH-16),
 * configuración (WH-13) y plantilla sectorial (WH-15). Con data.id actualiza; sin id crea.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'warehouse.configure' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as { entity?: string; data?: Record<string, unknown> } | null;
  const d = body?.data ?? {};
  const id = d.id ? String(d.id) : null;
  const db = ctx.service;

  switch (body?.entity) {
    case 'warehouse': {
      const row = {
        code: text(d.code, 24).toUpperCase(),
        name: text(d.name),
        address: text(d.address, 300) || null,
        branch_id: d.branch_id ? String(d.branch_id) : null,
        status: d.status === 'inactive' ? 'inactive' : 'active',
      };
      if (!/^[A-Z0-9][A-Z0-9\-_]{0,23}$/.test(row.code)) return bad('Código inválido (A-Z, 0-9, - _).', 'code');
      if (!row.name) return bad('El nombre es obligatorio.', 'name');
      if (row.branch_id) {
        const { data: branch } = await db.from('tenant_branches').select('id').eq('id', row.branch_id).eq('tenant_id', ctx.tenantId).maybeSingle();
        if (!branch) return bad('Sede no encontrada.', 'branch_id');
      }
      if (id && row.status === 'inactive') {
        const { data: settings } = await db.from('warehouse_settings').select('default_warehouse_id').eq('tenant_id', ctx.tenantId).maybeSingle();
        if (settings?.default_warehouse_id === id) return bad('No puedes desactivar el almacén predeterminado.', 'status');
      }
      const res = id
        ? await db.from('warehouse_warehouses').update(row).eq('id', id).eq('tenant_id', ctx.tenantId).select('id').maybeSingle()
        : await db.from('warehouse_warehouses').insert({ ...row, tenant_id: ctx.tenantId }).select('id').single();
      if (res.error || !res.data) return dbErrorResponse(res.error, 'No se pudo guardar el almacén.');
      await auditWarehouse(ctx, id ? 'warehouse.update' : 'warehouse.create', 'warehouse_warehouses', res.data.id, row);
      return NextResponse.json({ id: res.data.id });
    }

    case 'unit': {
      const factor = parseNumber(d.factor ?? 1);
      const row = {
        code: text(d.code, 12).toUpperCase(),
        name: text(d.name, 60),
        symbol: text(d.symbol, 12),
        base_unit_id: d.base_unit_id ? String(d.base_unit_id) : null,
        factor: d.base_unit_id ? factor : 1,
        status: d.status === 'inactive' ? 'inactive' : 'active',
      };
      if (!/^[A-Z0-9]{1,12}$/.test(row.code)) return bad('Código inválido (A-Z, 0-9).', 'code');
      if (!row.name || !row.symbol) return bad('Nombre y símbolo son obligatorios.', 'name');
      if (row.factor === null || row.factor <= 0) return bad('El factor debe ser mayor a cero.', 'factor');
      if (row.base_unit_id) {
        if (row.base_unit_id === id) return bad('Una unidad no puede ser su propia base.', 'base_unit_id');
        const { data: base } = await db.from('warehouse_units').select('id, base_unit_id').eq('id', row.base_unit_id).eq('tenant_id', ctx.tenantId).maybeSingle();
        // Un solo nivel: la base debe ser una unidad base, así las conversiones son directas.
        if (!base || base.base_unit_id) return bad('La unidad base debe ser una unidad sin base propia.', 'base_unit_id');
      }
      if (id) {
        const { count } = await db.from('warehouse_items').select('id', { count: 'exact', head: true }).eq('unit_id', id).eq('tenant_id', ctx.tenantId);
        const { data: prev } = await db.from('warehouse_units').select('base_unit_id, factor').eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle();
        if (count && prev && (prev.base_unit_id !== row.base_unit_id || Number(prev.factor) !== row.factor))
          return bad('La conversión de una unidad en uso no puede cambiarse; crea una unidad nueva.', 'factor');
      }
      const res = id
        ? await db.from('warehouse_units').update(row).eq('id', id).eq('tenant_id', ctx.tenantId).select('id').maybeSingle()
        : await db.from('warehouse_units').insert({ ...row, tenant_id: ctx.tenantId }).select('id').single();
      if (res.error || !res.data) return dbErrorResponse(res.error, 'No se pudo guardar la unidad.');
      await auditWarehouse(ctx, id ? 'unit.update' : 'unit.create', 'warehouse_units', res.data.id, row);
      return NextResponse.json({ id: res.data.id });
    }

    case 'category': {
      const name = text(d.name, 80);
      if (!name) return bad('El nombre es obligatorio.', 'name');
      const res = await db.from('warehouse_categories').insert({ tenant_id: ctx.tenantId, name }).select('id').single();
      if (res.error || !res.data) return dbErrorResponse(res.error, 'No se pudo crear la categoría.');
      await auditWarehouse(ctx, 'category.create', 'warehouse_categories', res.data.id, { name });
      return NextResponse.json({ id: res.data.id });
    }

    case 'attribute': {
      const options = Array.from(
        new Set((Array.isArray(d.options) ? d.options : String(d.options ?? '').split(',')).map((o) => text(o, 60)).filter(Boolean)),
      );
      const row = {
        key: text(d.key, 40).toLowerCase(),
        label: text(d.label, 80),
        data_type: String(d.data_type ?? 'text'),
        options,
        required: d.required === true,
        category_id: d.category_id ? String(d.category_id) : null,
        status: d.status === 'inactive' ? 'inactive' : 'active',
      };
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(row.key)) return bad('Clave inválida (minúsculas, números y _).', 'key');
      if (!row.label) return bad('La etiqueta es obligatoria.', 'label');
      if (!['text', 'number', 'date', 'boolean', 'select'].includes(row.data_type)) return bad('Tipo inválido.', 'data_type');
      if (row.data_type === 'select' && !options.length) return bad('Indica las opciones separadas por coma.', 'options');
      if (row.category_id) {
        const { data: cat } = await db.from('warehouse_categories').select('id').eq('id', row.category_id).eq('tenant_id', ctx.tenantId).maybeSingle();
        if (!cat) return bad('Categoría no encontrada.', 'category_id');
      }
      const res = id
        ? await db.from('warehouse_attribute_definitions').update({ ...row, key: undefined }).eq('id', id).eq('tenant_id', ctx.tenantId).select('id').maybeSingle()
        : await db.from('warehouse_attribute_definitions').insert({ ...row, tenant_id: ctx.tenantId }).select('id').single();
      if (res.error || !res.data) return dbErrorResponse(res.error, 'No se pudo guardar el atributo.');
      await auditWarehouse(ctx, id ? 'attribute.update' : 'attribute.create', 'warehouse_attribute_definitions', res.data.id, row);
      return NextResponse.json({ id: res.data.id });
    }

    case 'settings': {
      const maxRows = parseNumber(d.import_max_rows);
      const row = {
        require_adjustment_approval: d.require_adjustment_approval !== false,
        low_stock_alerts: d.low_stock_alerts !== false,
        import_max_rows: maxRows,
        unknown_code_action: d.unknown_code_action === 'block' ? 'block' : 'offer_create',
        default_warehouse_id: d.default_warehouse_id ? String(d.default_warehouse_id) : null,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      };
      if (maxRows === null || !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10000)
        return bad('El tope de filas debe estar entre 1 y 10.000.', 'import_max_rows');
      if (!row.default_warehouse_id) return bad('Selecciona el almacén predeterminado.', 'default_warehouse_id');
      const { data: wh } = await db.from('warehouse_warehouses').select('id').eq('id', row.default_warehouse_id).eq('status', 'active').eq('tenant_id', ctx.tenantId).maybeSingle();
      if (!wh) return bad('Almacén no disponible.', 'default_warehouse_id');
      const { data: before } = await db.from('warehouse_settings').select('*').eq('tenant_id', ctx.tenantId).maybeSingle();
      const { error } = await db.from('warehouse_settings').update(row).eq('tenant_id', ctx.tenantId);
      if (error) return dbErrorResponse(error, 'No se pudo guardar la configuración.');
      await auditWarehouse(ctx, 'settings.update', 'warehouse_settings', ctx.tenantId, { before, after: row });
      return NextResponse.json({ ok: true });
    }

    case 'sector': {
      const sector = BUSINESS_SECTORS.find((s) => s.sector === d.sector);
      if (!sector) return bad('Selecciona un sector.', 'sector');
      const specialty = d.specialty ? text(d.specialty, 80) : null;
      if (specialty && !sector.specialties.includes(specialty)) return bad('Especialidad no válida para el sector.', 'specialty');
      const template = BUSINESS_TEMPLATES.find((t) => t.key === (d.template_key ?? sector.template));
      if (!template) return bad('Plantilla no encontrada.', 'template_key');
      // Aplicar una plantilla solo agrega atributos que falten; nunca borra ni pisa los existentes.
      const { error: attrError } = await db.from('warehouse_attribute_definitions').upsert(
        template.attributes.map((a, i) => ({
          tenant_id: ctx.tenantId,
          key: a.key,
          label: a.label,
          data_type: a.data_type,
          options: a.options ?? [],
          sort_order: i,
          source: 'template',
        })),
        { onConflict: 'tenant_id,key', ignoreDuplicates: true },
      );
      if (attrError) return dbErrorResponse(attrError, 'No se pudo aplicar la plantilla.');
      const { error } = await db.from('warehouse_business_profiles').upsert({
        tenant_id: ctx.tenantId,
        sector: sector.sector,
        specialty,
        template_key: template.key,
        template_version: template.version,
        applied_by: ctx.userId,
        applied_at: new Date().toISOString(),
      });
      if (error) return dbErrorResponse(error, 'No se pudo guardar el perfil sectorial.');
      await auditWarehouse(ctx, 'sector.apply', 'warehouse_business_profiles', ctx.tenantId, {
        sector: sector.sector,
        specialty,
        template: template.key,
        version: template.version,
      });
      return NextResponse.json({ ok: true, added: template.attributes.map((a) => a.key) });
    }

    default:
      return bad('Entidad inválida.');
  }
}
