import Image from 'next/image';
import { ArrowRight, BellRing, Check, CircleDashed, Clock3, Handshake, Hammer, Repeat2, ShoppingBag, TrendingUp, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { landingModules, type FeatureStatus, type LandingModule } from './landing-data';

const featureIcons: Record<FeatureStatus, { icon: typeof Check; className: string }> = {
  Disponible: { icon: Check, className: 'text-[#285C49]' },
  'En desarrollo': { icon: Hammer, className: 'text-[#A4573A]' },
  Próximamente: { icon: CircleDashed, className: 'text-[#8C8172]' },
};
import { InterestLink } from './interest-link';
import { SectionHeading, StatusBadge, focusRing } from './landing-ui';

export function ModulesSection() {
  return (
    <section aria-labelledby="soluciones-title" id="soluciones" className="scroll-mt-24 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            id="soluciones-title"
            eyebrow="Soluciones VORA"
            title="Un módulo para cada desafío de tu empresa."
            description="Elige lo que necesitas hoy y amplía tu solución a medida que tu negocio crece."
          />
          <ul className="flex flex-wrap gap-2 text-xs text-[#52675A]" aria-label="Estados de disponibilidad">
            <li className="flex items-center gap-2"><StatusBadge status="Disponible" /> ya funciona en VORA</li>
            <li className="flex items-center gap-2"><StatusBadge status="En desarrollo" /> en construcción</li>
            <li className="flex items-center gap-2"><StatusBadge status="Próximamente" /> planificado</li>
          </ul>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {landingModules.map((module, index) => (
            <ModuleCard key={module.id} module={module} wide={index === landingModules.length - 1} />
          ))}
        </div>

        <p className="mt-8 text-sm text-[#52675A]">
          Las imágenes con pantallas de VORA son material conceptual y no capturas de funciones operativas. Las funciones marcadas como «Próximamente» o «En desarrollo» todavía no están disponibles.
        </p>
      </div>
    </section>
  );
}

function ModuleCard({ module, wide }: { module: LandingModule; wide?: boolean }) {
  const Icon = module.icon;
  return (
    <article
      id={`modulo-${module.id}`}
      aria-labelledby={`modulo-${module.id}-title`}
      className={cn(
        'group flex scroll-mt-28 flex-col overflow-hidden rounded-[1.75rem] border border-[#E2DACB] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#25332D]/10',
        wide && 'md:col-span-2 md:flex-row xl:col-span-3',
      )}
    >
      <div className={cn('relative', wide && 'md:w-[44%] md:shrink-0')}>
        <ModuleVisual module={module} wide={wide} />
        {module.visual.kind === 'illustration' && (
          <span className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-[#285C49] shadow-md">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h3 id={`modulo-${module.id}-title`} className="font-jakarta text-2xl font-extrabold tracking-[-0.02em] text-[#285C49]">
            {module.name}
          </h3>
          <StatusBadge status={module.status} className="mt-1.5" />
        </div>
        <p className="mt-1 font-semibold text-[#A4573A]">{module.tagline}</p>
        <p className="mt-3 leading-7 text-[#52675A]">{module.description}</p>

        <ul className="mt-5 space-y-2.5" aria-label={`Funciones de ${module.name}`}>
          {module.features.map((feature) => {
            const { icon: FeatureIcon, className } = featureIcons[feature.status];
            return (
              <li key={feature.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-[#25332D]">
                  <FeatureIcon className={cn('h-4 w-4 shrink-0', className)} aria-hidden="true" /> {feature.label}
                </span>
                <StatusBadge status={feature.status} />
              </li>
            );
          })}
        </ul>

        <div className="mt-5 rounded-2xl bg-[#F6F2E9] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#52675A]">Beneficios</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[#25332D]">
            {module.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>
        {module.note && <p className="mt-3 text-xs leading-5 text-[#6B5E4F]">{module.note}</p>}

        <div className="mt-auto pt-6">
          <InterestLink
            interest={module.name}
            className={cn('inline-flex items-center gap-2 rounded-full border-2 border-[#285C49] px-5 py-2.5 text-sm font-semibold text-[#285C49] transition hover:bg-[#285C49] hover:text-white', focusRing)}
          >
            Quiero conocer {module.name.replace('VORA ', '')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </InterestLink>
        </div>
      </div>
    </article>
  );
}

function ModuleVisual({ module, wide }: { module: LandingModule; wide?: boolean }) {
  const { visual } = module;
  const frame = cn('relative aspect-[3/2] overflow-hidden', wide && 'md:aspect-auto md:h-full md:min-h-[18rem]');
  if (visual.kind === 'photo') {
    return (
      <div className={cn(frame, 'bg-[#E9DCC8]')}>
        <Image
          src={visual.src}
          alt={visual.alt}
          width={visual.width}
          height={visual.height}
          sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
          className="h-full w-full object-cover object-left-top transition duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[#52675A]">Imagen conceptual</span>
      </div>
    );
  }
  return (
    <div className={cn(frame, 'bg-gradient-to-br from-[#E6EBDF] via-[#F6F2E9] to-[#E9DCC8]')} role="img" aria-label={`Ilustración conceptual de ${module.name}`}>
      {visual.variant === 'distribution' && <DistributionIllustration />}
      {visual.variant === 'intelligence' && <IntelligenceIllustration />}
      {visual.variant === 'partners' && <PartnersIllustration />}
      <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[#52675A]">Ilustración conceptual</span>
    </div>
  );
}

function DistributionIllustration() {
  const advisors = ['left-[12%] top-[20%]', 'right-[12%] top-[18%]', 'left-[16%] bottom-[18%]', 'right-[16%] bottom-[20%]'];
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 200" preserveAspectRatio="none">
        <g stroke="#A9BEA5" strokeWidth="1.5" strokeDasharray="4 4" fill="none">
          <path d="M150 100 L60 52" />
          <path d="M150 100 L240 48" />
          <path d="M150 100 L66 150" />
          <path d="M150 100 L232 146" />
        </g>
      </svg>
      <div className="absolute left-1/2 top-1/2 w-36 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-3 shadow-lg">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A4573A]"><ShoppingBag className="h-3 w-3" /> Mi catálogo</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {['bg-[#A9BEA5]', 'bg-[#E9DCC8]', 'bg-[#C97857]/70'].map((bg) => <span key={bg} className={cn('h-7 rounded-lg', bg)} />)}
        </div>
        <p className="mt-2 text-[10px] font-semibold text-[#285C49]">Comisión 15%</p>
      </div>
      {advisors.map((position, index) => (
        <span key={position} className={cn('absolute flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-md', position, index % 2 ? 'bg-[#C97857] text-white' : 'bg-[#285C49] text-white')}>
          <UserRound className="h-5 w-5" />
        </span>
      ))}
    </div>
  );
}

function IntelligenceIllustration() {
  const bars = [38, 52, 46, 64, 58, 76, 84];
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-[17rem] rounded-2xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#52675A]">Ventas del mes</p>
          <span className="flex items-center gap-1 rounded-full bg-[#DDE8D8] px-2 py-0.5 text-[10px] font-semibold text-[#1F4A3A]"><TrendingUp className="h-3 w-3" /> Tendencia</span>
        </div>
        <div className="mt-3 flex h-20 items-end gap-1.5">
          {bars.map((height, index) => (
            <span key={index} className={cn('flex-1 rounded-t-md', index === bars.length - 1 ? 'bg-[#C97857]' : 'bg-[#A9BEA5]')} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
      <div className="absolute right-5 top-5 flex items-center gap-2 rounded-xl bg-[#285C49] px-3 py-2 text-[10px] font-semibold text-white shadow-md">
        <BellRing className="h-3.5 w-3.5" /> Alerta: reponer inventario
      </div>
    </div>
  );
}

function PartnersIllustration() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-4 p-6">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#285C49] text-white shadow-lg">
        <Handshake className="h-11 w-11" />
      </div>
      <div className="space-y-2">
        {[
          { icon: UserRound, label: 'Referido activo' },
          { icon: Repeat2, label: 'Comisión recurrente' },
          { icon: Clock3, label: 'Seguimiento mensual' },
        ].map(({ icon: ItemIcon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-[#285C49] shadow-md">
            <ItemIcon className="h-3.5 w-3.5 text-[#C97857]" /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}
