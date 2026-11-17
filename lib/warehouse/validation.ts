import 'server-only';
import { createHash } from 'node:crypto';
import type { WarehouseContext } from '@/lib/warehouse/access';
import { IMPORT_OPERATIONS, ITEM_TYPES, type ImportOperation } from '@/lib/warehouse/catalog';
import { parseCsv } from '@/lib/warehouse/csv';

export interface FieldError {
  field: string;
  value?: string;
  message: string;
}

const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9\-_.\/]{0,63}$/;
const BARCODE_RE = /^[A-Za-z0-9\-._/]{1,64}$/;

/** Acepta "12.5" y "12,5"; devuelve null si no es un número finito. */
export function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const s = raw.trim().replace(/\s/g, '');
  const normalized = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

interface AttributeDef {
  key: string;
  label: string;
  data_type: string;
  options: string[];
  required: boolean;
  category_id: string | null;
}

export async function loadAttributeDefs(ctx: WarehouseContext): Promise<AttributeDef[]> {
  const { data } = await ctx.service
    .from('warehouse_attribute_definitions')
    .select('key,label,data_type,options,required,category_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'active');
  return (data ?? []) as AttributeDef[];
}

/** Valida atributos dinámicos según las definiciones aplicables a la categoría (WH-16). */
export function validateAttributes(
  defs: AttributeDef[],
  categoryId: string | null,
  input: Record<string, unknown>,
): { values: Record<string, string | number | boolean>; errors: FieldError[] } {
  const values: Record<string, string | number | boolean> = {};
  const errors: FieldError[] = [];
  const applicable = defs.filter((d) => !d.category_id || d.category_id === categoryId);
  for (const def of applicable) {
    const raw = input[def.key];
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
    if (empty) {
      if (def.required) errors.push({ field: `attr:${def.key}`, message: `${def.label} es obligatorio.` });
      continue;
    }
    const str = String(raw).trim();
    switch (def.data_type) {
      case 'number': {
        const n = parseNumber(str);
        if (n === null) errors.push({ field: `attr:${def.key}`, value: str, message: `${def.label} debe ser numérico.` });
        else values[def.key] = n;
        break;
      }
      case 'boolean':
        if (!['true', 'false', 'si', 'sí', 'no', '1', '0'].includes(str.toLowerCase()))
          errors.push({ field: `attr:${def.key}`, value: str, message: `${def.label} debe ser sí o no.` });
        else values[def.key] = ['true', 'si', 'sí', '1'].includes(str.toLowerCase());
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || Number.isNaN(Date.parse(str)))
          errors.push({ field: `attr:${def.key}`, value: str, message: `${def.label} debe tener formato AAAA-MM-DD.` });
        else values[def.key] = str;
        break;
      case 'select':
        if (!def.options.includes(str))
          errors.push({ field: `attr:${def.key}`, value: str, message: `${def.label}: usa una de ${def.options.join(', ')}.` });
        else values[def.key] = str;
        break;
      default:
        if (str.length > 200) errors.push({ field: `attr:${def.key}`, message: `${def.label} es demasiado largo.` });
        else values[def.key] = str;
    }
  }
  return { values, errors };
}

export interface ItemInput {
  sku: string;
  name: string;
  description: string | null;
  item_type: string;
  category_id: string | null;
  unit_id: string;
  price_usd: number;
  tax_rate: number;
  min_stock: number;
  status: 'active' | 'inactive';
  attributes: Record<string, string | number | boolean>;
  barcodes: string[];
}

/** Valida el formulario de ficha de producto (WH-03). Las mismas reglas usa la importación. */
export async function validateItemInput(
  ctx: WarehouseContext,
  body: Record<string, unknown>,
): Promise<{ item?: ItemInput; errors: FieldError[] }> {
  const errors: FieldError[] = [];
  const sku = String(body.sku ?? '').trim();
  const name = String(body.name ?? '').trim();
  const itemType = String(body.item_type ?? '');
  const unitId = String(body.unit_id ?? '');
  const categoryId = body.category_id ? String(body.category_id) : null;
  if (!SKU_RE.test(sku)) errors.push({ field: 'sku', value: sku, message: 'SKU inválido (letras, números, - _ . /; máximo 64).' });
  if (!name || name.length > 200) errors.push({ field: 'name', message: 'El nombre es obligatorio (máximo 200 caracteres).' });
  if (!(itemType in ITEM_TYPES)) errors.push({ field: 'item_type', value: itemType, message: 'Tipo de ítem inválido.' });
  const price = parseNumber(body.price_usd ?? 0);
  const tax = parseNumber(body.tax_rate ?? 16);
  const min = parseNumber(body.min_stock ?? 0);
  if (price === null || price < 0) errors.push({ field: 'price_usd', message: 'Precio inválido.' });
  if (tax === null || tax < 0 || tax > 100) errors.push({ field: 'tax_rate', message: 'IVA inválido (0 a 100).' });
  if (min === null || min < 0) errors.push({ field: 'min_stock', message: 'Stock mínimo inválido.' });

  const [{ data: unit }, category] = await Promise.all([
    ctx.service.from('warehouse_units').select('id').eq('tenant_id', ctx.tenantId).eq('id', unitId).eq('status', 'active').maybeSingle(),
    categoryId
      ? ctx.service.from('warehouse_categories').select('id').eq('tenant_id', ctx.tenantId).eq('id', categoryId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!unit) errors.push({ field: 'unit_id', message: 'Selecciona una unidad válida.' });
  if (categoryId && !category.data) errors.push({ field: 'category_id', message: 'Categoría no encontrada.' });

  const rawCodes = Array.isArray(body.barcodes) ? body.barcodes : String(body.barcodes ?? '').split(/[|,\n]/);
  const barcodes = Array.from(new Set(rawCodes.map((c) => String(c).trim()).filter(Boolean)));
  for (const code of barcodes)
    if (!BARCODE_RE.test(code)) errors.push({ field: 'barcodes', value: code, message: `Código de barras inválido: ${code}` });
  if (barcodes.length > 20) errors.push({ field: 'barcodes', message: 'Máximo 20 códigos por artículo.' });

  const attrs = validateAttributes(
    await loadAttributeDefs(ctx),
    categoryId,
    (body.attributes && typeof body.attributes === 'object' ? body.attributes : {}) as Record<string, unknown>,
  );
  errors.push(...attrs.errors);
  if (errors.length) return { errors };
  return {
    errors,
    item: {
      sku,
      name,
      description: body.description ? String(body.description).trim().slice(0, 2000) : null,
      item_type: itemType,
      category_id: categoryId,
      unit_id: unitId,
      price_usd: price!,
      tax_rate: tax!,
      min_stock: min!,
      status: body.status === 'inactive' ? 'inactive' : 'active',
      attributes: attrs.values,
      barcodes,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Importaciones (WH-19, WH-21)                                              */
/* -------------------------------------------------------------------------- */

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export interface ImportRowResult {
  row_number: number;
  action: 'create' | 'update' | 'movement' | 'skip';
  data: Record<string, unknown>;
  raw: Record<string, string>;
  errors: FieldError[];
}

/**
 * Valida en servidor un archivo CSV ya mapeado. mapping: campo esperado -> encabezado del archivo.
 * No escribe nada: la aplicación ocurre después, en una transacción (warehouse_apply_import).
 */
export async function validateImport(
  ctx: WarehouseContext,
  operation: ImportOperation,
  content: string,
  mapping: Record<string, string>,
  maxRows: number,
): Promise<{ sha256: string; rows: ImportRowResult[]; fatal?: string }> {
  const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  const table = parseCsv(content);
  if (table.length < 2) return { sha256, rows: [], fatal: 'El archivo no tiene filas de datos.' };
  if (table.length - 1 > maxRows)
    return { sha256, rows: [], fatal: `El archivo supera el máximo de ${maxRows} filas configurado.` };

  const headers = table[0].map((h) => h.trim());
  const spec = IMPORT_OPERATIONS[operation];
  for (const field of spec.required)
    if (!mapping[field] || !headers.includes(mapping[field]))
      return { sha256, rows: [], fatal: `Falta mapear la columna obligatoria "${field}".` };
  const attrHeaders = operation === 'items' ? headers.filter((h) => h.startsWith('attr:')) : [];

  const [units, warehouses, items, codes, defs] = await Promise.all([
    ctx.service.from('warehouse_units').select('id,code').eq('tenant_id', ctx.tenantId).eq('status', 'active'),
    ctx.service.from('warehouse_warehouses').select('id,code').eq('tenant_id', ctx.tenantId).eq('status', 'active'),
    ctx.service.from('warehouse_items').select('id,sku,item_type').eq('tenant_id', ctx.tenantId),
    ctx.service.from('warehouse_item_barcodes').select('code,item_id').eq('tenant_id', ctx.tenantId),
    operation === 'items' ? loadAttributeDefs(ctx) : Promise.resolve([] as AttributeDef[]),
  ]);
  const unitByCode = new Map((units.data ?? []).map((u) => [u.code.toUpperCase(), u.id]));
  const whByCode = new Map((warehouses.data ?? []).map((w) => [w.code.toUpperCase(), w.id]));
  const itemBySku = new Map((items.data ?? []).map((i) => [i.sku.toUpperCase(), i]));
  const codeOwner = new Map((codes.data ?? []).map((c) => [c.code, c.item_id]));
  const { data: categories } = await ctx.service.from('warehouse_categories').select('id,name').eq('tenant_id', ctx.tenantId);
  const categoryByName = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  const seenSku = new Set<string>();
  const seenCodes = new Map<string, string>();
  const rows: ImportRowResult[] = [];

  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2; // fila 1 = encabezados
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => (raw[h] = (cells[i] ?? '').trim()));
    const get = (field: string) => (mapping[field] ? raw[mapping[field]] ?? '' : '');
    const errors: FieldError[] = [];
    const err = (field: string, value: string, message: string) => errors.push({ field, value, message });
    const sku = get('sku');
    const skuKey = sku.toUpperCase();
    if (!SKU_RE.test(sku)) err('sku', sku, 'SKU inválido.');
    if (seenSku.has(skuKey)) err('sku', sku, 'SKU duplicado dentro del archivo.');
    seenSku.add(skuKey);
    const existing = itemBySku.get(skuKey);

    if (operation === 'items') {
      const itemType = get('item_type');
      if (!(itemType in ITEM_TYPES)) err('item_type', itemType, `Tipo inválido. Usa: ${Object.keys(ITEM_TYPES).join(', ')}.`);
      const name = get('name');
      if (!name || name.length > 200) err('name', name, 'Nombre obligatorio (máximo 200).');
      const unitCode = get('unit').toUpperCase();
      const unitId = unitByCode.get(unitCode);
      if (!unitId) err('unit', get('unit'), 'Unidad inexistente.');
      const num = (field: string, def: number, max?: number) => {
        const v = get(field);
        if (v === '') return def;
        const n = parseNumber(v);
        if (n === null || n < 0 || (max !== undefined && n > max)) {
          err(field, v, 'Valor numérico inválido.');
          return def;
        }
        return n;
      };
      const price = num('price_usd', 0);
      const tax = num('tax_rate', 16, 100);
      const min = num('min_stock', 0);
      const barcodes = Array.from(new Set(get('barcodes').split('|').map((c) => c.trim()).filter(Boolean)));
      for (const code of barcodes) {
        if (!BARCODE_RE.test(code)) err('barcodes', code, 'Código de barras inválido.');
        const owner = codeOwner.get(code);
        if (owner && owner !== existing?.id) err('barcodes', code, 'Código de barras ya asignado a otro artículo.');
        const inFile = seenCodes.get(code);
        if (inFile && inFile !== skuKey) err('barcodes', code, 'Código de barras repetido en el archivo.');
        seenCodes.set(code, skuKey);
      }
      const categoryName = get('category');
      const categoryId = categoryName ? categoryByName.get(categoryName.toLowerCase()) ?? null : null;
      const attrInput: Record<string, string> = {};
      for (const h of attrHeaders) attrInput[h.slice(5)] = raw[h];
      const attrs = validateAttributes(defs, categoryId, attrInput);
      errors.push(...attrs.errors.map((e) => ({ ...e, value: e.value ?? attrInput[e.field.slice(5)] })));
      rows.push({
        row_number: rowNumber,
        action: existing ? 'update' : 'create',
        raw,
        errors,
        data: {
          sku,
          name,
          item_type: itemType,
          category: categoryName.slice(0, 80),
          unit_id: unitId,
          price_usd: price,
          tax_rate: tax,
          min_stock: min,
          barcodes,
          description: get('description').slice(0, 2000),
          attributes: attrs.values,
        },
      });
    } else if (operation === 'initial_stock') {
      if (!existing) err('sku', sku, 'El SKU no existe en el catálogo.');
      else if (['service', 'service_consumables', 'service_work_order', 'reservable_resource', 'rental_asset'].includes(existing.item_type))
        err('sku', sku, 'Este artículo no maneja existencias.');
      const whId = whByCode.get(get('warehouse').toUpperCase());
      if (!whId) err('warehouse', get('warehouse'), 'Almacén inexistente.');
      const qty = parseNumber(get('quantity'));
      if (qty === null || qty <= 0) err('quantity', get('quantity'), 'La cantidad debe ser mayor a cero (sin stock negativo).');
      const cost = parseNumber(get('unit_cost'));
      if (cost === null || cost < 0) err('unit_cost', get('unit_cost'), 'Costo inválido.');
      rows.push({
        row_number: rowNumber,
        action: 'movement',
        raw,
        errors,
        data: { sku, item_id: existing?.id, warehouse_id: whId, quantity: qty, unit_cost: cost },
      });
    } else {
      if (!existing) err('sku', sku, 'El SKU no existe en el catálogo.');
      const price = parseNumber(get('price_usd'));
      if (price === null || price < 0) err('price_usd', get('price_usd'), 'Precio inválido.');
      rows.push({ row_number: rowNumber, action: 'update', raw, errors, data: { sku, item_id: existing?.id, price_usd: price } });
    }
  });
  return { sha256, rows };
}
