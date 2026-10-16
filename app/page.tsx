'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Layers3,
  Mail,
  Menu,
  MessageSquare,
  Package,
  Palette,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { EkosLogo } from '@/components/ekos-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const moduleTabs = [
  { key: 'clientes', label: 'Clientes', icon: Users, title: 'Una ficha que recuerda el contexto', description: 'Conecta contactos, compras, notas y siguientes pasos para que cada conversación empiece con información útil.', metric: 'Historial conectado', rows: ['Laura Méndez · 8 compras', 'Andrea Pérez · seguimiento hoy', 'Carlos Rojas · origen WhatsApp'] },
  { key: 'ventas', label: 'Ventas', icon: TrendingUp, title: 'Del interés a la oportunidad', description: 'Ordena oportunidades, responsables y próximas acciones sin perder visibilidad del proceso comercial.', metric: 'Etapas claras', rows: ['Descubrimiento · 12 oportunidades', 'Propuesta · 6 oportunidades', 'Ganada · cierre confirmado'] },
  { key: 'pedidos', label: 'Pedidos', icon: ShoppingCart, title: 'Pedidos con seguimiento visible', description: 'Mantén cada pedido en contexto con su cliente, estado y tareas asociadas.', metric: 'Estado por pedido', rows: ['#EK-2048 · En preparación', '#EK-2047 · Listo para entrega', '#EK-2046 · Entregado'] },
  { key: 'seguimiento', label: 'Seguimiento', icon: Clock3, title: 'La próxima acción siempre a la vista', description: 'Convierte pendientes en una agenda accionable con prioridades, responsables y fechas.', metric: 'Acciones priorizadas', rows: ['Llamar a Laura · Hoy 10:30', 'Enviar propuesta · Hoy 14:00', 'Revisar recompra · Mañana'] },
  { key: 'campanas', label: 'Campañas', icon: MessageSquare, title: 'Comunicación con un propósito', description: 'Organiza campañas y segmentos desde una base común de clientes, sin inventar resultados ni automatizaciones.', metric: 'Segmentos definidos', rows: ['Clientes frecuentes · 84', 'Sin contacto reciente · 32', 'Nuevos registros · 18'] },
  { key: 'reportes', label: 'Reportes', icon: BarChart3, title: 'Una lectura simple del negocio', description: 'Mira las señales importantes del equipo y decide qué merece atención primero.', metric: 'Vista operativa', rows: ['Clientes activos · 284', 'Oportunidades abiertas · 42', 'Tareas pendientes · 16'] },
] as const;

const identities = {
  soleé: { name: 'SOLEÉ', descriptor: 'Aromas & relaciones', primary: '#4a1d6e', accent: '#b68cff', soft: '#f2eaff', active: 'Clientes' },
  demo: { name: 'Empresa Demo', descriptor: 'Servicios profesionales', primary: '#0d7a4e', accent: '#66c9a0', soft: '#e6f7ef', active: 'Seguimiento' },
};

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeModule, setActiveModule] = useState(0);
  const [identity, setIdentity] = useState<keyof typeof identities>('soleé');
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [formData, setFormData] = useState({ full_name: '', email: '', company: '', phone: '', interest: '', consent: true });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitDemo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus('submitting');
    try {
      const response = await fetch('/api/demo-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, website: '' }) });
      setFormStatus(response.ok ? 'success' : 'error');
      if (response.ok) setFormData({ full_name: '', email: '', company: '', phone: '', interest: '', consent: true });
    } catch {
      setFormStatus('error');
    }
  };

  const selectedModule = moduleTabs[activeModule];
  const SelectedIcon = selectedModule.icon;
  const selectedIdentity = identities[identity];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className={`sticky top-0 z-50 border-b transition-all ${scrolled ? 'border-border/80 bg-white/95 shadow-sm backdrop-blur' : 'border-transparent bg-white/70 backdrop-blur'}`}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="EKOSCRM inicio"><EkosLogo textClassName="text-primary" /></Link>
          <nav className="hidden items-center gap-8 lg:flex">
            <a href="#beneficios" className="text-sm font-medium text-muted-foreground transition hover:text-primary">Beneficios</a>
            <a href="#modulos" className="text-sm font-medium text-muted-foreground transition hover:text-primary">Módulos</a>
            <a href="#como-funciona" className="text-sm font-medium text-muted-foreground transition hover:text-primary">Cómo funciona</a>
            <a href="#contacto" className="text-sm font-medium text-muted-foreground transition hover:text-primary">Contacto</a>
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <Button asChild variant="ghost" className="text-primary"><Link href="/login">Iniciar sesión</Link></Button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90"><a href="#contacto">Solicitar demo <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
          </div>
          <button type="button" aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} className="rounded-lg p-2 text-primary sm:hidden" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        </div>
        {mobileOpen && <div className="border-t bg-white px-5 py-5 sm:hidden"><div className="flex flex-col gap-4"><a href="#beneficios" onClick={() => setMobileOpen(false)}>Beneficios</a><a href="#modulos" onClick={() => setMobileOpen(false)}>Módulos</a><a href="#como-funciona" onClick={() => setMobileOpen(false)}>Cómo funciona</a><a href="#contacto" onClick={() => setMobileOpen(false)}>Contacto</a><Button asChild><Link href="/login">Iniciar sesión</Link></Button></div></div>}
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#061a4e] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(99,220,229,.22),transparent_30%),radial-gradient(circle_at_12%_84%,rgba(0,175,239,.12),transparent_30%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:py-28">
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-[#b9f4f5]"><Sparkles className="h-3.5 w-3.5" /> CRM modular para operaciones reales</div>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-.04em] sm:text-5xl lg:text-[4.2rem]">Convierte cada contacto en una relación que impulsa tus ventas.</h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/72">Clientes, pedidos y seguimientos conectados en un CRM modular que se adapta a tu empresa.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="bg-[#63dce5] font-semibold text-[#061a4e] hover:bg-[#8ae9ee]"><a href="#contacto">Solicitar demo <ArrowRight className="ml-2 h-4 w-4" /></a></Button><Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10"><a href="#modulos">Explorar EKOSCRM</a></Button></div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/55"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#63dce5]" /> Acceso por empresa</span><span className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-[#63dce5]" /> Módulos activables</span></div>
            </div>
            <ProductMockup />
          </div>
        </section>

        <section id="beneficios" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:items-end"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-info">Una base para crecer</p><h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">Menos piezas aisladas. Más contexto para decidir.</h2></div><p className="max-w-xl text-lg leading-8 text-muted-foreground">EKOSCRM organiza la operación comercial alrededor de la relación con el cliente, con una arquitectura preparada para crecer por etapas.</p></div>
          <div className="mt-14 grid gap-4 md:grid-cols-3"><Benefit icon={Users} title="Ficha única" text="Reúne contactos, compras, notas y próximos pasos en una vista comprensible." /><Benefit icon={Activity} title="Seguimiento accionable" text="Convierte oportunidades y pendientes en acciones claras para el equipo." /><Benefit icon={Palette} title="Identidad propia" text="Cada empresa opera con su marca y configuración, separada de la plataforma." /></div>
        </section>

        <section id="modulos" className="border-y border-border bg-[#f4f7fb] px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-info">Explorador de módulos</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Una experiencia que cambia con tu operación.</h2><p className="mt-4 text-lg leading-8 text-muted-foreground">Selecciona un módulo para ver cómo se organiza el trabajo. La información es ilustrativa y no representa actividad real.</p></div>
            <div className="mt-10 grid gap-6 lg:grid-cols-[.7fr_1.3fr]"><div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible">{moduleTabs.map((tab, index) => { const Icon = tab.icon; return <button key={tab.key} type="button" onClick={() => setActiveModule(index)} className={`flex min-w-max items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition lg:w-full ${index === activeModule ? 'border-primary bg-primary text-white shadow-lg' : 'border-border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary'}`}><Icon className="h-4 w-4" /><span>{tab.label}</span>{index === activeModule && <ArrowRight className="ml-auto hidden h-4 w-4 lg:block" />}</button>; })}</div><div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e5f8fa] text-[#008f9b]"><SelectedIcon className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">{selectedModule.metric}</p><h3 className="mt-1 text-xl font-semibold">{selectedModule.title}</h3></div></div><p className="mt-5 max-w-xl leading-7 text-muted-foreground">{selectedModule.description}</p></div><span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">Vista ilustrativa</span></div><div className="mt-8 grid gap-3 sm:grid-cols-3">{selectedModule.rows.map((row, index) => <div key={row} className="rounded-xl border border-border bg-[#f8fafc] p-4"><div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm"><span className="text-xs font-bold">0{index + 1}</span></div><p className="text-sm font-medium leading-6">{row}</p><div className="mt-4 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-[#63dce5]" style={{ width: `${48 + index * 18}%` }} /></div></div>)}</div></div></div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-info">Cómo funciona</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Una ruta clara desde la captura hasta la siguiente acción.</h2><p className="mt-5 leading-8 text-muted-foreground">La plataforma separa configuración, operación e integraciones futuras para que cada avance sea comprobable.</p></div><div className="grid gap-3 sm:grid-cols-2">{[{ n: '01', t: 'Captar', d: 'Registra el contacto desde el canal disponible.' }, { n: '02', t: 'Conocer', d: 'Construye el contexto de la relación.' }, { n: '03', t: 'Gestionar', d: 'Ordena la venta, pedido o tarea.' }, { n: '04', t: 'Seguir', d: 'Define la próxima acción del equipo.' }, { n: '05', t: 'Aprender', d: 'Identifica señales para mejorar el proceso.' }].map((step) => <div key={step.n} className="rounded-2xl border border-border bg-card p-5"><span className="text-sm font-bold text-info">{step.n}</span><h3 className="mt-5 font-semibold">{step.t}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.d}</p></div>)}</div></div></section>

        <section className="border-y border-border bg-[#f4f7fb] px-5 py-20 sm:px-8 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-info">Personalización</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Una plataforma, la identidad de tu empresa.</h2></div><div className="flex rounded-xl border border-border bg-white p-1"><button type="button" onClick={() => setIdentity('soleé')} className={`rounded-lg px-4 py-2 text-sm font-medium ${identity === 'soleé' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>Marca A</button><button type="button" onClick={() => setIdentity('demo')} className={`rounded-lg px-4 py-2 text-sm font-medium ${identity === 'demo' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>Marca B</button></div></div><div className="mt-10 grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-center"><div><p className="text-lg font-semibold">{selectedIdentity.name}</p><p className="mt-2 text-muted-foreground">{selectedIdentity.descriptor}</p><ul className="mt-6 space-y-3 text-sm text-muted-foreground"><li className="flex gap-3"><Check className="h-4 w-4 shrink-0 text-success" /> Colores y navegación propios</li><li className="flex gap-3"><Check className="h-4 w-4 shrink-0 text-success" /> Módulos habilitados por empresa</li><li className="flex gap-3"><Check className="h-4 w-4 shrink-0 text-success" /> Configuración separada de otras empresas</li></ul></div><IdentityMockup identity={selectedIdentity} /></div></div></section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-info">Ecosistema</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Capacidades con estado visible.</h2><p className="mt-4 text-lg leading-8 text-muted-foreground">Lo implementado se distingue de lo planificado. Sin logos inventados ni promesas de integraciones que todavía no están listas.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Roadmap icon={ShoppingCart} title="Shopify" text="Productos y pedidos cuando la integración esté habilitada." /><Roadmap icon={Package} title="SIIGO" text="Facturación de ventas directas autorizadas. En hoja de ruta." /><Roadmap icon={QrCode} title="Captura QR" text="Captura de contactos para ferias y eventos." active /><Roadmap icon={Sparkles} title="Predictivo" text="Diagnóstico y reglas validadas antes de cualquier modelo." /></div></section>

        <section id="contacto" className="bg-[#061a4e] px-5 py-20 text-white sm:px-8 lg:py-28"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-[#63dce5]">Hablemos</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Diseñemos el espacio que tu equipo necesita.</h2><p className="mt-5 max-w-md leading-8 text-white/70">Déjanos tus datos. Registraremos tu solicitud en EKOSCRM y el equipo podrá revisarla. No afirmamos un envío de correo automático.</p></div><div className="rounded-2xl bg-white p-6 text-foreground shadow-2xl sm:p-8">{formStatus === 'success' ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-success" /><h3 className="mt-5 text-xl font-semibold">Solicitud registrada</h3><p className="mt-2 text-sm text-muted-foreground">Guardamos tus datos correctamente. El contacto posterior depende del equipo de EKOS Solutions.</p></div> : <form onSubmit={submitDemo} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Nombre completo" id="full_name"><Input id="full_name" required value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} /></Field><Field label="Email" id="email"><Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Empresa" id="company"><Input id="company" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} /></Field><Field label="Teléfono" id="phone"><Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></Field></div><Field label="Qué te interesa explorar" id="interest"><Textarea id="interest" rows={4} value={formData.interest} onChange={(e) => setFormData({ ...formData, interest: e.target.value })} placeholder="Cuéntanos sobre tu operación o los módulos que te interesan." /></Field><div className="flex items-start gap-3"><Checkbox id="consent" checked={formData.consent} onCheckedChange={(checked) => setFormData({ ...formData, consent: checked === true })} /><Label htmlFor="consent" className="text-xs font-normal leading-5 text-muted-foreground">Acepto ser contactado por EKOS Solutions sobre EKOSCRM.</Label></div>{formStatus === 'error' && <p role="alert" className="text-sm text-destructive">No pudimos registrar la solicitud. Revisa los datos e inténtalo de nuevo.</p>}<Button type="submit" disabled={formStatus === 'submitting' || !formData.consent} className="w-full bg-primary text-white hover:bg-primary/90">{formStatus === 'submitting' ? 'Registrando solicitud...' : 'Solicitar demo'} <ArrowRight className="ml-2 h-4 w-4" /></Button></form>}</div></div></section>
      </main>

      <footer className="bg-[#04133b] px-5 py-10 text-white sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"><div><EkosLogo textClassName="text-white" /><p className="mt-4 max-w-xs text-sm leading-6 text-white/55">EKOSCRM por EKOS Solutions. Plataforma CRM modular para relaciones comerciales con contexto.</p></div><div className="flex flex-col gap-3 text-sm text-white/60 sm:items-end"><a href="#contacto" className="hover:text-white">Solicitar demo</a><Link href="/login" className="hover:text-white">Iniciar sesión</Link><span className="text-xs text-white/35">Funciones marcadas como demo son ilustrativas.</span></div></div></footer>
    </div>
  );
}

function ProductMockup() {
  return <div className="relative mx-auto w-full max-w-2xl"><div className="absolute -right-5 -top-6 hidden rounded-xl border border-white/15 bg-[#10285d] px-4 py-3 shadow-xl sm:block"><p className="text-[10px] uppercase tracking-widest text-white/50">Próxima acción</p><p className="mt-1 text-sm font-semibold">Contactar a Laura</p></div><div className="absolute -bottom-7 -left-5 hidden rounded-xl border border-white/15 bg-[#10285d] px-4 py-3 shadow-xl sm:block"><p className="text-[10px] uppercase tracking-widest text-[#63dce5]">Vista ilustrativa</p><p className="mt-1 text-xs text-white/65">Datos demo · no actividad real</p></div><div className="overflow-hidden rounded-2xl border border-white/15 bg-[#f6f8fc] shadow-2xl"><div className="flex items-center justify-between border-b bg-white px-4 py-3"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#63dce5]" /><span className="text-xs font-semibold text-[#10224e]">EKOSCRM / Resumen</span></div><span className="rounded-full bg-[#e9fbfc] px-2 py-1 text-[10px] font-semibold text-[#087f8a]">Datos demo</span></div><div className="grid grid-cols-[112px_1fr] sm:grid-cols-[150px_1fr]"><div className="min-h-[310px] bg-[#071a4d] p-3 text-white sm:min-h-[380px] sm:p-4"><div className="mb-7 text-[11px] font-semibold tracking-[.18em] text-white/85">EKOSCRM</div>{['Resumen', 'Clientes', 'Ventas', 'Pedidos', 'Seguimiento'].map((item, i) => <div key={item} className={`mb-1.5 rounded-lg px-2 py-2 text-[10px] ${i === 0 ? 'bg-[#63dce5] font-semibold text-[#071a4d]' : 'text-white/55'}`}>{item}</div>)}</div><div className="p-4 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-medium uppercase tracking-widest text-[#00a3b3]">Resumen comercial</p><h3 className="mt-1 text-lg font-bold text-[#11224b] sm:text-2xl">Todo en contexto</h3></div><Activity className="h-5 w-5 text-[#00a3b3]" /></div><div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Clientes" value="284" /><Stat label="Ventas" value="42" /><Stat label="Tareas" value="16" /></div><div className="mt-4 rounded-xl border border-[#e2e8f1] bg-white p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#11224b]">Actividad reciente</p><span className="text-[10px] text-[#8b98aa]">Datos demo</span></div>{['Laura Méndez · nueva compra', 'Pedido #EK-2048 · en preparación', 'Tarea · enviar propuesta'].map((item, index) => <div key={item} className="mt-3 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-[#63dce5]' : index === 1 ? 'bg-[#00afef]' : 'bg-[#a8b6c9]'}`} /><span className="text-[11px] text-[#44536d]">{item}</span></div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#eaf6f8] p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#16808c]">Seguimiento</p><p className="mt-2 text-sm font-bold text-[#11224b]">9 acciones hoy</p></div><div className="rounded-xl bg-[#eef1f8] p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#56647a]">Pedidos</p><p className="mt-2 text-sm font-bold text-[#11224b]">12 en proceso</p></div></div></div></div></div></div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#f1f5f9] p-2.5"><p className="text-[10px] text-[#7b8798]">{label}</p><p className="mt-1 text-base font-bold text-[#11224b]">{value}</p></div>; }
function Benefit({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) { return <div className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f8fa] text-[#008b97]"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{text}</p></div>; }
function IdentityMockup({ identity }: { identity: typeof identities[keyof typeof identities] }) { return <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xl"><div className="flex items-center justify-between px-5 py-4 text-white" style={{ backgroundColor: identity.primary }}><div><p className="text-xs uppercase tracking-[.2em] opacity-70">{identity.name}</p><p className="mt-1 text-sm font-semibold">{identity.descriptor}</p></div><div className="rounded-lg px-3 py-1.5 text-[10px] font-bold" style={{ backgroundColor: identity.accent, color: identity.primary }}>CRM</div></div><div className="grid gap-4 p-5 sm:grid-cols-[.7fr_1.3fr]"><div className="space-y-2 rounded-xl p-3" style={{ backgroundColor: identity.soft }}><div className="h-2 w-16 rounded-full" style={{ backgroundColor: identity.primary }} />{['Resumen', 'Clientes', 'Seguimiento', 'Ajustes'].map((item, i) => <div key={item} className={`rounded-lg px-3 py-2 text-xs ${i === 0 ? 'font-semibold text-white' : 'text-muted-foreground'}`} style={i === 0 ? { backgroundColor: identity.primary } : undefined}>{item}</div>)}</div><div><p className="text-xs font-semibold text-muted-foreground">{identity.active}</p><div className="mt-3 grid grid-cols-3 gap-2"><div className="h-16 rounded-xl" style={{ backgroundColor: identity.soft }} /><div className="h-16 rounded-xl" style={{ backgroundColor: `${identity.accent}55` }} /><div className="h-16 rounded-xl bg-[#f3f5f8]" /></div><div className="mt-3 h-3 rounded-full bg-[#edf1f5]" /><div className="mt-2 h-3 w-3/4 rounded-full bg-[#edf1f5]" /></div></div></div>; }
function Roadmap({ icon: Icon, title, text, active = false }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; active?: boolean }) { return <div className={`rounded-2xl border p-5 ${active ? 'border-success/30 bg-success/5' : 'border-dashed border-border bg-card'}`}><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary"><Icon className="h-5 w-5" /></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${active ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{active ? 'Disponible' : 'Hoja de ruta'}</span></div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>; }
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div><Label htmlFor={id} className="text-foreground">{label}</Label><div className="mt-1.5">{children}</div></div>; }
