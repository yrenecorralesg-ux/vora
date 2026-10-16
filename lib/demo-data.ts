/**
 * =====================================================================
 *  DATOS DEMO / FIXTURES
 * =====================================================================
 *  Todos los registros de este archivo son ficticios y existen unicamente
 *  para mostrar la interfaz del CRM durante la etapa de demostracion.
 *  NINGUNO de estos datos corresponde a clientes, ventas, pedidos o
 *  productos reales. Se deben reemplazar por datos del tenant una vez
 *  que el modulo correspondiente este conectado a su base de datos.
 * =====================================================================
 */

/* ------------------------------- Clientes -------------------------------- */

export interface DemoCustomer {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  empresa: string;
  estado: 'activo' | 'inactivo' | 'prospecto';
  valorTotal: number;
  ultimaCompra: string; // ISO date
}

export const demoCustomers: DemoCustomer[] = [
  {
    id: 'C-0001',
    nombre: 'Maria Fernanda Lopez',
    email: 'maria.lopez@example.co',
    telefono: '+57 310 555 0142',
    ciudad: 'Bogota',
    empresa: 'Distribuciones Andina SAS',
    estado: 'activo',
    valorTotal: 4_250_000,
    ultimaCompra: '2025-09-18',
  },
  {
    id: 'C-0002',
    nombre: 'Carlos Andres Restrepo',
    email: 'c.restrepo@example.com',
    telefono: '+57 320 555 0188',
    ciudad: 'Medellin',
    empresa: 'Comercializadora El Valle',
    estado: 'activo',
    valorTotal: 2_980_000,
    ultimaCompra: '2025-09-30',
  },
  {
    id: 'C-0003',
    nombre: 'Valentina Gutierrez',
    email: 'valentina.g@example.co',
    telefono: '+57 315 555 0110',
    ciudad: 'Cali',
    empresa: 'Gutierrez & Asociados',
    estado: 'prospecto',
    valorTotal: 0,
    ultimaCompra: '—',
  },
  {
    id: 'C-0004',
    nombre: 'Jorge Mendoza',
    email: 'j.mendoza@example.com',
    telefono: '+57 318 555 0173',
    ciudad: 'Barranquilla',
    empresa: 'Caribe Logistics SA',
    estado: 'activo',
    valorTotal: 6_740_000,
    ultimaCompra: '2025-10-01',
  },
  {
    id: 'C-0005',
    nombre: 'Diana Patricia Ruiz',
    email: 'diana.ruiz@example.co',
    telefono: '+57 301 555 0155',
    ciudad: 'Bogota',
    empresa: 'Insumos del Centro',
    estado: 'inactivo',
    valorTotal: 540_000,
    ultimaCompra: '2025-03-22',
  },
  {
    id: 'C-0006',
    nombre: 'Sebastian Ortiz',
    email: 's.ortiz@example.com',
    telefono: '+57 312 555 0199',
    ciudad: 'Pereira',
    empresa: 'Cafes Ortiz Ltda',
    estado: 'activo',
    valorTotal: 1_830_000,
    ultimaCompra: '2025-09-25',
  },
];

/* --------------------------- Ventas / Oportunidades ----------------------- */

export interface DemoSale {
  id: string;
  cliente: string;
  titulo: string;
  etapa: 'prospeccion' | 'calificacion' | 'propuesta' | 'negociacion' | 'ganada' | 'perdida';
  valor: number;
  probabilidad: number; // 0-100
  fechaCierre: string;
  responsable: string;
}

export const demoSales: DemoSale[] = [
  {
    id: 'O-1001',
    cliente: 'Distribuciones Andina SAS',
    titulo: 'Renovacion contrato anual',
    etapa: 'negociacion',
    valor: 12_500_000,
    probabilidad: 75,
    fechaCierre: '2025-10-15',
    responsable: 'Maria Fernanda Lopez',
  },
  {
    id: 'O-1002',
    cliente: 'Caribe Logistics SA',
    titulo: 'Implementacion modulo logistico',
    etapa: 'propuesta',
    valor: 28_900_000,
    probabilidad: 50,
    fechaCierre: '2025-10-28',
    responsable: 'Jorge Mendoza',
  },
  {
    id: 'O-1003',
    cliente: 'Cafes Ortiz Ltda',
    titulo: 'Compra campana navidena',
    etapa: 'calificacion',
    valor: 3_400_000,
    probabilidad: 30,
    fechaCierre: '2025-11-05',
    responsable: 'Sebastian Ortiz',
  },
  {
    id: 'O-1004',
    cliente: 'Comercializadora El Valle',
    titulo: 'Upgrade plan premium',
    etapa: 'ganada',
    valor: 8_700_000,
    probabilidad: 100,
    fechaCierre: '2025-09-30',
    responsable: 'Carlos Andres Restrepo',
  },
  {
    id: 'O-1005',
    cliente: 'Gutierrez & Asociados',
    titulo: 'Demo producto nuevo',
    etapa: 'prospeccion',
    valor: 1_200_000,
    probabilidad: 10,
    fechaCierre: '2025-11-12',
    responsable: 'Valentina Gutierrez',
  },
];

/* -------------------------------- Pedidos --------------------------------- */

export interface DemoOrder {
  id: string;
  cliente: string;
  fecha: string;
  total: number;
  estado: 'pendiente' | 'procesando' | 'enviado' | 'entregado' | 'cancelado';
  items: number;
}

export const demoOrders: DemoOrder[] = [
  {
    id: 'PED-20001',
    cliente: 'Distribuciones Andina SAS',
    fecha: '2025-10-01',
    total: 2_340_000,
    estado: 'pendiente',
    items: 12,
  },
  {
    id: 'PED-20002',
    cliente: 'Caribe Logistics SA',
    fecha: '2025-10-01',
    total: 5_680_000,
    estado: 'procesando',
    items: 28,
  },
  {
    id: 'PED-20003',
    cliente: 'Cafes Ortiz Ltda',
    fecha: '2025-09-28',
    total: 980_000,
    estado: 'enviado',
    items: 6,
  },
  {
    id: 'PED-20004',
    cliente: 'Comercializadora El Valle',
    fecha: '2025-09-26',
    total: 3_120_000,
    estado: 'entregado',
    items: 15,
  },
  {
    id: 'PED-20005',
    cliente: 'Insumos del Centro',
    fecha: '2025-09-20',
    total: 540_000,
    estado: 'cancelado',
    items: 3,
  },
  {
    id: 'PED-20006',
    cliente: 'Distribuciones Andina SAS',
    fecha: '2025-10-02',
    total: 1_450_000,
    estado: 'pendiente',
    items: 9,
  },
];

/* -------------------------------- Tareas ---------------------------------- */

export interface DemoTask {
  id: string;
  titulo: string;
  cliente: string;
  tipo: 'llamada' | 'correo' | 'reunion' | 'seguimiento' | 'otro';
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'vencida';
  fechaVencimiento: string;
  responsable: string;
}

export const demoTasks: DemoTask[] = [
  {
    id: 'T-3001',
    titulo: 'Llamar para confirmar visita tecnica',
    cliente: 'Distribuciones Andina SAS',
    tipo: 'llamada',
    estado: 'pendiente',
    fechaVencimiento: '2025-10-03',
    responsable: 'Maria Fernanda Lopez',
  },
  {
    id: 'T-3002',
    titulo: 'Enviar propuesta actualizada',
    cliente: 'Caribe Logistics SA',
    tipo: 'correo',
    estado: 'en_progreso',
    fechaVencimiento: '2025-10-04',
    responsable: 'Jorge Mendoza',
  },
  {
    id: 'T-3003',
    titulo: 'Reunion de cierre contrato',
    cliente: 'Comercializadora El Valle',
    tipo: 'reunion',
    estado: 'completada',
    fechaVencimiento: '2025-09-30',
    responsable: 'Carlos Andres Restrepo',
  },
  {
    id: 'T-3004',
    titulo: 'Seguimiento post venta',
    cliente: 'Cafes Ortiz Ltda',
    tipo: 'seguimiento',
    estado: 'vencida',
    fechaVencimiento: '2025-09-29',
    responsable: 'Sebastian Ortiz',
  },
  {
    id: 'T-3005',
    titulo: 'Enviar cotizacion inicial',
    cliente: 'Gutierrez & Asociados',
    tipo: 'correo',
    estado: 'pendiente',
    fechaVencimiento: '2025-10-05',
    responsable: 'Valentina Gutierrez',
  },
];

/* ------------------------------- Productos -------------------------------- */

export interface DemoProduct {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  estado: 'disponible' | 'agotado' | 'descontinuado';
}

export const demoProducts: DemoProduct[] = [
  {
    id: 'P-001',
    sku: 'PRD-1001',
    nombre: 'Licencia CRM Anual',
    categoria: 'Software',
    precio: 2_400_000,
    stock: 999,
    estado: 'disponible',
  },
  {
    id: 'P-002',
    sku: 'PRD-1002',
    nombre: 'Modulo de Facturacion',
    categoria: 'Software',
    precio: 980_000,
    stock: 999,
    estado: 'disponible',
  },
  {
    id: 'P-003',
    sku: 'PRD-1003',
    nombre: 'Kit Feria Comercial',
    categoria: 'Material',
    precio: 320_000,
    stock: 48,
    estado: 'disponible',
  },
  {
    id: 'P-004',
    sku: 'PRD-1004',
    nombre: 'Campana QR Premium',
    categoria: 'Servicio',
    precio: 1_500_000,
    stock: 12,
    estado: 'disponible',
  },
  {
    id: 'P-005',
    sku: 'PRD-1005',
    nombre: 'Capacitacion Onboarding',
    categoria: 'Servicio',
    precio: 650_000,
    stock: 0,
    estado: 'agotado',
  },
];

/* ------------------------------- Segmentos -------------------------------- */

export interface DemoSegment {
  id: string;
  nombre: string;
  descripcion: string;
  clientes: number;
  criterio: string;
}

export const demoSegments: DemoSegment[] = [
  {
    id: 'S-01',
    nombre: 'Clientes VIP',
    descripcion: 'Clientes con valor total superior a 5 millones',
    clientes: 14,
    criterio: 'valorTotal > 5.000.000',
  },
  {
    id: 'S-02',
    nombre: 'Prospectos Bogota',
    descripcion: 'Prospectos ubicados en Bogota sin compras',
    clientes: 27,
    criterio: 'ciudad = "Bogota" AND estado = "prospecto"',
  },
  {
    id: 'S-03',
    nombre: 'Inactivos 90 dias',
    descripcion: 'Clientes sin compra en los ultimos 90 dias',
    clientes: 8,
    criterio: 'ultimaCompra < hoy - 90d',
  },
  {
    id: 'S-04',
    nombre: 'Sector Logistico',
    descripcion: 'Empresas del sector logistico activas',
    clientes: 5,
    criterio: 'sector = "logistica" AND estado = "activo"',
  },
];

/* ------------------------------- Campanas --------------------------------- */

export interface DemoCampaign {
  id: string;
  nombre: string;
  canal: 'email' | 'sms' | 'whatsapp' | 'qr' | 'redes';
  estado: 'borrador' | 'activa' | 'pausada' | 'finalizada';
  segmento: string;
  enviados: number;
  aperturas: number;
  fechaInicio: string;
}

export const demoCampaigns: DemoCampaign[] = [
  {
    id: 'CM-01',
    nombre: 'Bienvenida nuevos clientes',
    canal: 'email',
    estado: 'activa',
    segmento: 'Prospectos Bogota',
    enviados: 120,
    aperturas: 54,
    fechaInicio: '2025-09-15',
  },
  {
    id: 'CM-02',
    nombre: 'Reactivacion inactivos',
    canal: 'whatsapp',
    estado: 'finalizada',
    segmento: 'Inactivos 90 dias',
    enviados: 32,
    aperturas: 21,
    fechaInicio: '2025-08-20',
  },
  {
    id: 'CM-03',
    nombre: 'Promo Navidena 2025',
    canal: 'qr',
    estado: 'borrador',
    segmento: 'Clientes VIP',
    enviados: 0,
    aperturas: 0,
    fechaInicio: '2025-11-01',
  },
];

/* --------------------------- Actividad reciente --------------------------- */

export interface DemoActivity {
  id: string;
  tipo: 'cliente' | 'venta' | 'pedido' | 'tarea' | 'sistema';
  descripcion: string;
  usuario: string;
  fecha: string;
}

export const demoActivityFeed: DemoActivity[] = [
  {
    id: 'A-01',
    tipo: 'pedido',
    descripcion: 'Pedido PED-20006 creado para Distribuciones Andina SAS',
    usuario: 'Sistema',
    fecha: '2025-10-02T09:14:00Z',
  },
  {
    id: 'A-02',
    tipo: 'venta',
    descripcion: 'Oportunidad O-1004 marcada como Ganada (Comercializadora El Valle)',
    usuario: 'Carlos Andres Restrepo',
    fecha: '2025-09-30T16:40:00Z',
  },
  {
    id: 'A-03',
    tipo: 'cliente',
    descripcion: 'Nuevo cliente prospecto creado: Gutierrez & Asociados',
    usuario: 'Valentina Gutierrez',
    fecha: '2025-09-29T11:02:00Z',
  },
  {
    id: 'A-04',
    tipo: 'tarea',
    descripcion: 'Tarea T-3003 completada: Reunion de cierre contrato',
    usuario: 'Carlos Andres Restrepo',
    fecha: '2025-09-30T18:10:00Z',
  },
  {
    id: 'A-05',
    tipo: 'sistema',
    descripcion: 'Conexion con Shopify verificada correctamente',
    usuario: 'Sistema',
    fecha: '2025-09-28T08:00:00Z',
  },
];

/* ----------------------------- Etiquetas helper --------------------------- */

export const customerStatusLabel: Record<DemoCustomer['estado'], string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  prospecto: 'Prospecto',
};

export const saleStageLabel: Record<DemoSale['etapa'], string> = {
  prospeccion: 'Prospeccion',
  calificacion: 'Calificacion',
  propuesta: 'Propuesta',
  negociacion: 'Negociacion',
  ganada: 'Ganada',
  perdida: 'Perdida',
};

export const orderStatusLabel: Record<DemoOrder['estado'], string> = {
  pendiente: 'Pendiente',
  procesando: 'Procesando',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const taskStatusLabel: Record<DemoTask['estado'], string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  vencida: 'Vencida',
};

export const taskTypeLabel: Record<DemoTask['tipo'], string> = {
  llamada: 'Llamada',
  correo: 'Correo',
  reunion: 'Reunion',
  seguimiento: 'Seguimiento',
  otro: 'Otro',
};

export const productStatusLabel: Record<DemoProduct['estado'], string> = {
  disponible: 'Disponible',
  agotado: 'Agotado',
  descontinuado: 'Descontinuado',
};

export const campaignStatusLabel: Record<DemoCampaign['estado'], string> = {
  borrador: 'Borrador',
  activa: 'Activa',
  pausada: 'Pausada',
  finalizada: 'Finalizada',
};
