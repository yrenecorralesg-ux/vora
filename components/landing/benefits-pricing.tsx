import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differentiators, landingPlans } from './landing-data';
import { InterestLink } from './interest-link';
import { SectionHeading, focusRing } from './landing-ui';

export function DifferentiatorsSection() {
  return (
    <section aria-labelledby="beneficios-title" id="beneficios" className="scroll-mt-24 bg-[#E6EBDF] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          id="beneficios-title"
          eyebrow="Por qué VORA"
          title="Tecnología cercana para las personas que hacen crecer tu empresa."
          description="Una plataforma pensada para cómo trabajan los negocios: por etapas, con equipos reales y con la vista puesta en crecer."
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-[1.5rem] bg-[#F6F2E9] p-6 ring-1 ring-[#285C49]/10">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#285C49] text-[#F6F2E9]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-jakarta text-lg font-bold text-[#285C49]">{title}</h3>
              <p className="mt-2 leading-7 text-[#52675A]">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section aria-labelledby="precios-title" id="precios" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          id="precios-title"
          eyebrow="Planes"
          title="Un plan para cada etapa de tu negocio."
          description="Precios de referencia en dólares estadounidenses. La contratación se coordina con nuestro equipo comercial."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {landingPlans.map((plan) => (
            <article
              key={plan.name}
              aria-labelledby={`plan-${plan.name}`}
              className={cn(
                'relative flex flex-col rounded-[1.75rem] border p-7',
                plan.highlighted ? 'border-[#285C49] bg-[#EFF4EC] shadow-xl shadow-[#285C49]/10' : 'border-[#E2DACB] bg-[#FBF9F4]',
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-[#A4573A] px-3 py-1 text-xs font-semibold text-white">Recomendado</span>
              )}
              <h3 id={`plan-${plan.name}`} className="font-jakarta text-xl font-extrabold text-[#285C49]">{plan.name}</h3>
              <p className="mt-2 min-h-[3rem] text-sm leading-6 text-[#52675A]">{plan.description}</p>
              <p className="mt-4 flex min-h-[4rem] flex-wrap items-end gap-x-1 font-jakarta text-[#285C49]">
                <span className={cn('font-extrabold tracking-[-0.03em]', plan.period ? 'text-4xl' : 'text-2xl leading-tight')}>{plan.price}</span>
                {plan.period && <span className="text-sm font-medium text-[#52675A]"> {plan.period}</span>}
              </p>
              <div className="my-6 h-px bg-[#E2DACB]" />
              <ul className="flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[#25332D]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#285C49]" aria-hidden="true" /> {feature}
                  </li>
                ))}
              </ul>
              <InterestLink
                interest={`Plan ${plan.name}`}
                className={cn(
                  'mt-8 rounded-full px-5 py-3 text-center text-sm font-semibold transition',
                  plan.highlighted ? 'bg-[#285C49] text-white hover:bg-[#1F4A3A]' : 'border-2 border-[#285C49] text-[#285C49] hover:bg-[#E6EBDF]',
                  focusRing,
                )}
              >
                {plan.cta}
              </InterestLink>
            </article>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-sm leading-6 text-[#52675A]">
          Precios propuestos, sujetos a validación antes del lanzamiento comercial. Por ahora no hay cobro en línea ni activación automática de suscripciones; las funciones de cada plan se habilitan según su disponibilidad.
        </p>
      </div>
    </section>
  );
}
