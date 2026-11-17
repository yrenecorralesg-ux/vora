// Definiciones compartidas (cliente y servidor) del módulo Warehouse.

export const ITEM_TYPES = {
  physical: 'Producto físico',
  weighted: 'Por peso o medida',
  lot: 'Por lote',
  serialized: 'Serializado',
  variant: 'Variante',
  kit: 'Kit',
  manufactured: 'Fabricado',
  service: 'Servicio puro',
  service_consumables: 'Servicio con consumibles',
  service_work_order: 'Servicio con orden de trabajo',
  reservable_resource: 'Recurso reservable',
  rental_asset: 'Activo alquilable',
} as const;
export type ItemType = keyof typeof ITEM_TYPES;
export const NON_STOCK_TYPES: ItemType[] = [
  'service',
  'service_consumables',
  'service_work_order',
  'reservable_resource',
  'rental_asset',
];

export const DOC_TYPES = {
  receipt: 'Entrada',
  issue: 'Salida',
  adjustment: 'Ajuste',
  return: 'Devolución',
} as const;
export type DocType = keyof typeof DOC_TYPES;

export const DOC_STATUS = {
  pending_approval: 'Pendiente de aprobación',
  posted: 'Contabilizado',
  rejected: 'Rechazado',
  reversed: 'Reversado',
} as const;

export const MOVEMENT_TYPES: Record<string, string> = {
  receipt: 'Entrada',
  issue: 'Salida',
  adjustment_in: 'Ajuste (+)',
  adjustment_out: 'Ajuste (−)',
  return_sellable: 'Devolución vendible',
  return_damaged: 'Devolución dañada',
  pos_sale: 'Venta POS',
  pos_return: 'Devolución POS',
  import: 'Importación',
  reversal: 'Reverso',
};

export const ISSUE_REASONS = ['Consumo interno', 'Merma', 'Vencimiento', 'Muestra', 'Donación', 'Salida autorizada'];
export const ADJUSTMENT_REASONS = ['Conteo físico', 'Error de registro', 'Robo o pérdida', 'Daño', 'Otro'];

export const PERMISSION_LABELS: Record<string, string> = {
  'catalog.create': 'Crear y editar catálogo',
  'stock.receive': 'Registrar entradas',
  'stock.issue': 'Registrar salidas',
  'stock.return': 'Registrar devoluciones',
  'stock.adjust.request': 'Solicitar ajustes',
  'stock.adjust.approve': 'Aprobar ajustes y reversos',
  'import.validate': 'Validar importaciones',
  'import.apply': 'Aplicar importaciones',
  'cost.view': 'Ver costos',
  'report.view': 'Ver reportes',
  'warehouse.configure': 'Configurar almacenes, unidades y atributos',
};

export const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Administrador de empresa',
  wh_manager: 'Administrador de almacén',
  wh_supervisor: 'Supervisor de almacén',
  wh_clerk: 'Almacenista',
  wh_scanner: 'Operador de escaneo',
  wh_auditor: 'Auditor / contador',
};

/* -------------------------------------------------------------------------- */
/*  Sectores y plantillas (secciones 2 y 4 del documento, WH-15)              */
/* -------------------------------------------------------------------------- */

export interface TemplateAttribute {
  key: string;
  label: string;
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
}
export interface BusinessTemplate {
  key: string;
  name: string;
  version: number;
  attributes: TemplateAttribute[];
}

const t = (key: string, label: string, data_type: TemplateAttribute['data_type'] = 'text', options?: string[]): TemplateAttribute =>
  ({ key, label, data_type, options });

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  { key: 'general', name: 'General', version: 1, attributes: [t('brand', 'Marca')] },
  { key: 'fashion', name: 'Ropa / calzado', version: 1, attributes: [t('size', 'Talla'), t('color', 'Color'), t('gender', 'Género', 'select', ['Mujer', 'Hombre', 'Unisex', 'Niño']), t('collection', 'Colección'), t('material', 'Material')] },
  { key: 'supermarket', name: 'Supermercado', version: 1, attributes: [t('presentation', 'Presentación'), t('net_weight', 'Peso neto', 'number'), t('lot', 'Lote'), t('expiry_date', 'Vencimiento', 'date')] },
  { key: 'auto_parts', name: 'Repuestos', version: 1, attributes: [t('oem', 'OEM'), t('part_number', 'Número de parte'), t('brand', 'Marca'), t('vehicle', 'Vehículo'), t('model', 'Modelo'), t('year', 'Año', 'number'), t('engine', 'Motor')] },
  { key: 'technology', name: 'Tecnología', version: 1, attributes: [t('model', 'Modelo'), t('warranty_months', 'Garantía (meses)', 'number'), t('specs', 'Especificaciones'), t('condition', 'Estado', 'select', ['Nuevo', 'Usado', 'Reacondicionado'])] },
  { key: 'spa', name: 'Spa / estética', version: 1, attributes: [t('treatment', 'Tratamiento'), t('duration_min', 'Duración (min)', 'number'), t('professional', 'Profesional'), t('cabin', 'Cabina')] },
  { key: 'workshop', name: 'Taller', version: 1, attributes: [t('plate', 'Placa'), t('mileage', 'Kilometraje', 'number'), t('diagnosis', 'Diagnóstico'), t('hours', 'Horas', 'number'), t('technician', 'Técnico')] },
  { key: 'pharmacy', name: 'Farmacia', version: 1, attributes: [t('active_ingredient', 'Principio activo'), t('concentration', 'Concentración'), t('lot', 'Lote'), t('expiry_date', 'Vencimiento', 'date'), t('storage', 'Conservación')] },
  { key: 'restaurant', name: 'Restaurante', version: 1, attributes: [t('portion', 'Porción'), t('ingredients', 'Ingredientes'), t('yield', 'Rendimiento', 'number'), t('waste_pct', 'Merma (%)', 'number')] },
  { key: 'hardware', name: 'Ferretería', version: 1, attributes: [t('gauge', 'Calibre'), t('length', 'Longitud'), t('diameter', 'Diámetro'), t('weight', 'Peso', 'number'), t('brand', 'Marca')] },
  { key: 'manufacturing', name: 'Manufactura', version: 1, attributes: [t('raw_material', 'Materia prima'), t('yield', 'Rendimiento', 'number'), t('production_order', 'Orden de producción')] },
  { key: 'oil_supplies', name: 'Suministros petroleros', version: 1, attributes: [t('technical_standard', 'Norma técnica'), t('certificate', 'Certificado'), t('lot', 'Lote'), t('serial', 'Serial')] },
];

export const BUSINESS_SECTORS: { sector: string; specialties: string[]; template: string }[] = [
  { sector: 'Alimentos', specialties: ['Supermercado', 'Abasto', 'Carnicería', 'Panadería', 'Distribución'], template: 'supermarket' },
  { sector: 'Moda', specialties: ['Ropa', 'Calzado', 'Joyería', 'Textiles', 'Uniformes'], template: 'fashion' },
  { sector: 'Belleza', specialties: ['Spa', 'Barbería', 'Estética', 'Cosméticos', 'Gimnasio'], template: 'spa' },
  { sector: 'Automotriz', specialties: ['Repuestos', 'Taller', 'Cauchos', 'Baterías', 'Autolavado'], template: 'auto_parts' },
  { sector: 'Tecnología', specialties: ['Computadoras', 'Celulares', 'Reparaciones', 'Electrónica'], template: 'technology' },
  { sector: 'Ferretería', specialties: ['Herramientas', 'Construcción', 'Plomería', 'Electricidad'], template: 'hardware' },
  { sector: 'Salud', specialties: ['Farmacia', 'Óptica', 'Veterinaria', 'Laboratorio'], template: 'pharmacy' },
  { sector: 'Gastronomía', specialties: ['Restaurante', 'Catering', 'Cafetería', 'Delivery'], template: 'restaurant' },
  { sector: 'Hogar', specialties: ['Muebles', 'Decoración', 'Iluminación', 'Limpieza'], template: 'general' },
  { sector: 'Agro', specialties: ['Semillas', 'Vivero', 'Granja', 'Fertilizantes'], template: 'general' },
  { sector: 'Industria', specialties: ['Fabricación', 'Metalmecánica', 'Confección'], template: 'manufacturing' },
  { sector: 'Servicios', specialties: ['Mantenimiento', 'Instalación', 'Limpieza', 'Consultoría'], template: 'general' },
  { sector: 'Educación', specialties: ['Academia', 'Librería', 'Instituto'], template: 'general' },
  { sector: 'Turismo', specialties: ['Hotel', 'Posada', 'Agencia', 'Eventos'], template: 'general' },
  { sector: 'Logística', specialties: ['Transporte', 'Mensajería', 'Distribución'], template: 'general' },
  { sector: 'Otros', specialties: ['Floristería', 'Lavandería', 'Alquiler de equipos'], template: 'general' },
  { sector: 'Petróleo y gas', specialties: ['Taladros', 'Tráileres', 'Grúas', 'Transporte', 'Servicios de pozos'], template: 'oil_supplies' },
  { sector: 'Energía industrial', specialties: ['Generadores', 'Mantenimiento', 'Inspección', 'Suministros'], template: 'oil_supplies' },
];

/* -------------------------------------------------------------------------- */
/*  Importaciones (WH-19, WH-20)                                              */
/* -------------------------------------------------------------------------- */

export const IMPORT_OPERATIONS = {
  items: {
    label: 'Productos y servicios',
    columns: ['sku', 'name', 'item_type', 'category', 'unit', 'price_usd', 'tax_rate', 'min_stock', 'barcodes', 'description'],
    required: ['sku', 'name', 'item_type', 'unit'],
  },
  initial_stock: {
    label: 'Stock inicial',
    columns: ['sku', 'warehouse', 'quantity', 'unit_cost'],
    required: ['sku', 'warehouse', 'quantity', 'unit_cost'],
  },
  prices: {
    label: 'Precios',
    columns: ['sku', 'price_usd'],
    required: ['sku', 'price_usd'],
  },
} as const;
export type ImportOperation = keyof typeof IMPORT_OPERATIONS;

export const IMPORT_COLUMN_LABELS: Record<string, string> = {
  sku: 'SKU',
  name: 'Nombre',
  item_type: 'Tipo (código)',
  category: 'Categoría',
  unit: 'Unidad (código)',
  price_usd: 'Precio USD',
  tax_rate: 'IVA %',
  min_stock: 'Stock mínimo',
  barcodes: 'Códigos de barras (separados por |)',
  description: 'Descripción',
  warehouse: 'Almacén (código)',
  quantity: 'Cantidad',
  unit_cost: 'Costo unitario USD',
};

export const IMPORT_TEMPLATE_VERSION = 1;
