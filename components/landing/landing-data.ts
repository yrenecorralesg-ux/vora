import {
  BarChart3,
  Building2,
  Handshake,
  Landmark,
  Layers3,
  Network,
  ShoppingCart,
  Sparkles,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

/** Availability shown on the public landing. Keep it honest: only features that exist in the app are "Disponible". */
export type FeatureStatus = 'Disponible' | 'En desarrollo' | 'Próximamente';

export type ModuleId = 'commerce' | 'warehouse' | 'people' | 'finance' | 'distribution' | 'intelligence' | 'partners';

export type ModuleVisual =
  | { kind: 'photo'; src: string; alt: string; width: number; height: number }
  | { kind: 'illustration'; variant: 'distribution' | 'intelligence' | 'partners' };

export interface LandingModule {
  id: ModuleId;
  name: string;
  icon: LucideIcon;
  tagline: string;
  description: string;
  status: 'Base disponible' | FeatureStatus;
  features: { label: string; status: FeatureStatus }[];
  benefits: string[];
  note?: string;
  visual: ModuleVisual;
}

export const landingModules: LandingModule[] = [
  {
    id: 'commerce',
    name: 'VORA Commerce',
    icon: ShoppingCart,
    tagline: 'Cada venta cuenta.',
    description: 'Punto de venta, CRM, clientes, facturación, pedidos y catálogos en un mismo lugar.',
    status: 'Base disponible',
    features: [
      { label: 'CRM y fichas de clientes', status: 'Disponible' },
      { label: 'Pedidos con seguimiento', status: 'Disponible' },
      { label: 'Catálogos de productos', status: 'Disponible' },
      { label: 'Punto de venta (POS)', status: 'En desarrollo' },
      { label: 'Facturación', status: 'Próximamente' },
    ],
    benefits: ['Atiende mejor con el historial de cada cliente.', 'Mantén pedidos y catálogos al día.'],
    visual: {
      kind: 'photo',
      src: '/landing/module-commerce.webp',
      alt: 'Cajera atendiendo a un cliente con la pantalla de punto de venta de VORA visible',
      width: 768,
      height: 512,
    },
  },
  {
    id: 'warehouse',
    name: 'VORA Warehouse',
    icon: Warehouse,
    tagline: 'Tu inventario bajo control.',
    description: 'Almacenes, bodegas, inventario, códigos de barras y movimientos de mercancía.',
    status: 'En desarrollo',
    features: [
      { label: 'Estados de disponibilidad en el catálogo', status: 'Disponible' },
      { label: 'Almacenes y bodegas', status: 'En desarrollo' },
      { label: 'Inventario y movimientos', status: 'En desarrollo' },
      { label: 'Códigos de barras', status: 'Próximamente' },
    ],
    benefits: ['Sabe qué tienes y dónde está.', 'Prepara despachos con menos errores.'],
    visual: {
      kind: 'photo',
      src: '/landing/module-warehouse.webp',
      alt: 'Empleado en un almacén grande consultando VORA en una tablet',
      width: 768,
      height: 512,
    },
  },
  {
    id: 'people',
    name: 'VORA People',
    icon: Users,
    tagline: 'Personas primero.',
    description: 'Portal empresarial de empleados para vacaciones, permisos, documentos y solicitudes.',
    status: 'Próximamente',
    features: [
      { label: 'Portal de empleados', status: 'Próximamente' },
      { label: 'Vacaciones y permisos', status: 'Próximamente' },
      { label: 'Documentos y constancias', status: 'Próximamente' },
      { label: 'Solicitudes internas', status: 'Próximamente' },
    ],
    benefits: ['Menos papeleo para tu equipo.', 'Solicitudes claras y con respuesta.'],
    visual: {
      kind: 'photo',
      src: '/landing/module-people.webp',
      alt: 'Persona gestionando sus vacaciones desde un computador con el portal de VORA',
      width: 768,
      height: 512,
    },
  },
  {
    id: 'finance',
    name: 'VORA Finance & Fiscal',
    icon: Landmark,
    tagline: 'Más claridad en tus finanzas.',
    description: 'Conciliación bancaria, seguimiento de pagos, contabilidad y procesos fiscales relacionados con el SENIAT.',
    status: 'Próximamente',
    features: [
      { label: 'Conciliación bancaria', status: 'Próximamente' },
      { label: 'Seguimiento de pagos', status: 'Próximamente' },
      { label: 'Contabilidad', status: 'Próximamente' },
      { label: 'Procesos fiscales (SENIAT)', status: 'Próximamente' },
    ],
    benefits: ['Ordena cobros y pagos en un solo lugar.', 'Prepara la información fiscal con más tiempo.'],
    note: 'Aún sin certificación del SENIAT ni integración bancaria operativa.',
    visual: {
      kind: 'photo',
      src: '/landing/module-finance.webp',
      alt: 'Contadora revisando una conciliación bancaria en VORA y documentación fiscal',
      width: 568,
      height: 512,
    },
  },
  {
    id: 'distribution',
    name: 'VORA Distribution',
    icon: Network,
    tagline: 'Tu red de ventas crece contigo.',
    description: 'Asesoras, catálogos personalizados, pedidos, comisiones y dropshipping.',
    status: 'Próximamente',
    features: [
      { label: 'Gestión de asesoras', status: 'Próximamente' },
      { label: 'Catálogos personalizados', status: 'Próximamente' },
      { label: 'Comisiones', status: 'Próximamente' },
      { label: 'Dropshipping', status: 'Próximamente' },
    ],
    benefits: ['Cada asesora con su catálogo.', 'Comisiones claras para toda la red.'],
    visual: { kind: 'illustration', variant: 'distribution' },
  },
  {
    id: 'intelligence',
    name: 'VORA Intelligence',
    icon: BarChart3,
    tagline: 'Decide con datos.',
    description: 'Indicadores, análisis predictivo, proyecciones y alertas empresariales.',
    status: 'Base disponible',
    features: [
      { label: 'Indicadores y reportes base', status: 'Disponible' },
      { label: 'Análisis predictivo', status: 'Próximamente' },
      { label: 'Proyecciones', status: 'Próximamente' },
      { label: 'Alertas empresariales', status: 'Próximamente' },
    ],
    benefits: ['Mira lo importante primero.', 'Anticipa en lugar de reaccionar.'],
    visual: { kind: 'illustration', variant: 'intelligence' },
  },
  {
    id: 'partners',
    name: 'VORA Partners',
    icon: Handshake,
    tagline: 'Crezcamos juntos.',
    description: 'Programa para distribuidores de VORA, referidos y comisiones recurrentes.',
    status: 'Próximamente',
    features: [
      { label: 'Distribuidores de VORA', status: 'Próximamente' },
      { label: 'Programa de referidos', status: 'Próximamente' },
      { label: 'Comisiones recurrentes', status: 'Próximamente' },
    ],
    benefits: ['Recomienda VORA a otras empresas.', 'Genera ingresos recurrentes por tus referidos.'],
    visual: { kind: 'illustration', variant: 'partners' },
  },
];

export const diagnosticNeeds: { id: string; label: string; summary: string; modules: ModuleId[] }[] = [
  { id: 'vender', label: 'Vender más', summary: 'Ordena tus ventas y llega a más clientes con tu propia red comercial.', modules: ['commerce', 'distribution', 'intelligence'] },
  { id: 'inventario', label: 'Controlar inventario', summary: 'Ten a la vista existencias, almacenes y movimientos para vender lo que realmente tienes.', modules: ['warehouse', 'commerce'] },
  { id: 'pagos', label: 'Conciliar pagos', summary: 'Concilia cobros y pagos con tus movimientos bancarios y ordena tu información fiscal.', modules: ['finance', 'commerce'] },
  { id: 'empleados', label: 'Gestionar empleados', summary: 'Da a tu equipo un portal para vacaciones, permisos, documentos y solicitudes.', modules: ['people'] },
  { id: 'resultados', label: 'Analizar resultados', summary: 'Convierte la operación diaria en indicadores, proyecciones y alertas.', modules: ['intelligence', 'commerce'] },
  { id: 'red', label: 'Expandir mi red de distribución', summary: 'Suma asesoras con catálogos personalizados, pedidos y comisiones.', modules: ['distribution', 'warehouse', 'commerce'] },
];

export const differentiators: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Layers3, title: 'Una plataforma modular', text: 'Empieza con lo que necesitas hoy y suma módulos a medida que creces.' },
  { icon: Network, title: 'Red de distribución', text: 'Pensada para negocios que venden con asesoras, revendedores y catálogos.' },
  { icon: Landmark, title: 'Gestión financiera conectada', text: 'Ventas, pagos y finanzas hablan entre sí en lugar de vivir en hojas separadas.' },
  { icon: Sparkles, title: 'Inteligencia para mejores decisiones', text: 'Indicadores claros hoy y análisis predictivo en el camino.' },
  { icon: Building2, title: 'Para pequeños negocios y grandes empresas', text: 'Desde un emprendimiento con dos usuarios hasta una operación con equipos grandes.' },
  { icon: Users, title: 'Pensada para Venezuela', text: 'Una experiencia adaptada a la forma en que trabajan las empresas venezolanas.' },
];

export interface LandingPlan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export const landingPlans: LandingPlan[] = [
  {
    name: 'Emprende',
    price: 'US$15',
    period: '/mes',
    description: 'Para dar el primer paso con lo esencial.',
    features: ['Modelo SaaS compartido', 'CRM y ventas básicas', 'Hasta 2 usuarios'],
    cta: 'Quiero empezar',
  },
  {
    name: 'Negocio',
    price: 'US$39',
    period: '/mes',
    description: 'Para crecer con más control.',
    features: ['Hasta 5 usuarios', 'Ventas, inventario y reportes'],
    cta: 'Solicitar información',
    highlighted: true,
  },
  {
    name: 'Profesional',
    price: 'US$89',
    period: '/mes',
    description: 'Para operaciones con más equipos y procesos.',
    features: ['Hasta 15 usuarios', 'Funcionalidades y módulos avanzados según disponibilidad'],
    cta: 'Solicitar información',
  },
  {
    name: 'Enterprise',
    price: 'Cotización personalizada',
    description: 'Para grandes empresas.',
    features: ['Grandes empresas', 'Portal de empleados', 'Integraciones y recursos dedicados opcionales'],
    cta: 'Solicitar cotización',
  },
];

/** Public contact address for advisory and information requests. */
export const CONTACT_EMAIL = 'info@venesoftca.com';
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Solicitud de información VORA')}`;

export const navLinks = [
  { label: 'Soluciones', href: '#soluciones' },
  { label: 'Beneficios', href: '#beneficios' },
  { label: 'Precios', href: '#precios' },
  { label: 'Contacto', href: '#contacto' },
];
