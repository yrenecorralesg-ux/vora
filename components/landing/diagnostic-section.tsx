'use client';

import { useState } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { diagnosticNeeds, landingModules } from './landing-data';
import { InterestLink } from './interest-link';
import { SectionHeading, StatusBadge, focusRing } from './landing-ui';

export function DiagnosticSection() {
  const [selectedId, setSelectedId] = useState(diagnosticNeeds[0].id);
  const need = diagnosticNeeds.find((item) => item.id === selectedId) ?? diagnosticNeeds[0];
  const recommended = need.modules
    .map((id) => landingModules.find((module) => module.id === id))
    .filter((module): module is (typeof landingModules)[number] => Boolean(module));

  return (
    <section aria-labelledby="diagnostico-title" id="diagnostico" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <SectionHeading
            id="diagnostico-title"
            eyebrow="Diagnóstico empresarial"
            title="¿Qué quieres mejorar en tu empresa?"
            description="Elige tu prioridad y te mostramos los módulos de VORA relacionados."
          />
          <div role="group" aria-label="Necesidades de tu empresa" className="mt-8 grid gap-3 sm:grid-cols-2">
            {diagnosticNeeds.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'rounded-2xl border px-5 py-4 text-left font-semibold transition',
                    active ? 'border-[#285C49] bg-[#DDE8D8] text-[#1F4A3A] shadow-sm' : 'border-[#DCE3D6] bg-[#FBF9F4] text-[#25332D] hover:border-[#A9BEA5]',
                    focusRing,
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div aria-live="polite" className="rounded-[2rem] bg-[#285C49] p-7 text-white shadow-2xl shadow-[#285C49]/25 sm:p-10">
          <div className="flex items-center gap-3 text-[#DCE6D9]">
            <Compass className="h-6 w-6" aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-[0.18em]">Recomendado para «{need.label.toLowerCase()}»</p>
          </div>
          <p className="mt-5 font-jakarta text-2xl font-bold leading-snug sm:text-[1.7rem]">{need.summary}</p>

          <ul className="mt-8 space-y-3">
            {recommended.map((module) => {
              const Icon = module.icon;
              return (
                <li key={module.id}>
                  <a
                    href={`#modulo-${module.id}`}
                    className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2E9]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6F2E9] text-[#285C49]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{module.name}</span>
                      <span className="block text-sm text-[#DCE6D9]">{module.tagline}</span>
                    </span>
                    <StatusBadge status={module.status} />
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#DCE6D9]">Recomendación orientativa. Revisa la disponibilidad de cada módulo.</p>
            <InterestLink
              interest={`Diagnóstico: ${need.label}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#F6F2E9] px-6 py-3 font-semibold text-[#285C49] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2E9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#285C49]"
            >
              Hablar con un asesor <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </InterestLink>
          </div>
        </div>
      </div>
    </section>
  );
}
