'use client';

import { useId, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading, StatusBadge, focusRing } from './landing-ui';

const SCENARIOS = [10, 50, 100] as const;

/** Deterministic formatting (no Intl) so server and browser render the same text. */
function formatUsd(value: number) {
  const rounded = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `US$ ${rounded}`;
}

export function GrowthSimulator() {
  const [advisors, setAdvisors] = useState<(typeof SCENARIOS)[number]>(50);
  const [avgSales, setAvgSales] = useState(300);
  const [commission, setCommission] = useState(20);
  const salesId = useId();
  const commissionId = useId();

  const networkSales = advisors * avgSales;
  const commissions = (networkSales * commission) / 100;
  const brandGross = networkSales - commissions;
  const maxScenarioSales = SCENARIOS[SCENARIOS.length - 1] * avgSales;

  return (
    <section aria-labelledby="simulador-title" id="simulador" className="scroll-mt-24 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <SectionHeading
            id="simulador-title"
            eyebrow="Simulador comercial"
            title="Imagina cómo podría crecer tu red de asesoras."
            description="Un ejercicio ilustrativo para planificar con VORA Distribution. Ajusta los supuestos y compara escenarios."
          />
          <p className="flex items-center gap-2 text-sm text-[#52675A]">
            VORA Distribution <StatusBadge status="Próximamente" />
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-[#E2DACB] bg-white p-6 sm:p-8">
            <p className="flex items-center gap-2 font-jakarta text-lg font-bold text-[#285C49]">
              <Calculator className="h-5 w-5" aria-hidden="true" /> Supuestos
            </p>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-[#25332D]">Número de vendedoras</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SCENARIOS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={advisors === count}
                    onClick={() => setAdvisors(count)}
                    className={cn(
                      'rounded-2xl border px-3 py-3 text-center font-jakarta text-lg font-bold transition',
                      advisors === count ? 'border-[#285C49] bg-[#285C49] text-white' : 'border-[#DCE3D6] bg-[#FBF9F4] text-[#285C49] hover:border-[#A9BEA5]',
                      focusRing,
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-7">
              <div className="flex items-center justify-between">
                <label htmlFor={salesId} className="text-sm font-semibold text-[#25332D]">Venta mensual promedio por vendedora</label>
                <span className="font-semibold text-[#285C49]">{formatUsd(avgSales)}</span>
              </div>
              <input
                id={salesId}
                type="range"
                min={50}
                max={2000}
                step={50}
                value={avgSales}
                onChange={(event) => setAvgSales(Number(event.target.value))}
                className="mt-3 w-full accent-[#285C49]"
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label htmlFor={commissionId} className="text-sm font-semibold text-[#25332D]">Comisión de la vendedora</label>
                <span className="font-semibold text-[#285C49]">{commission}%</span>
              </div>
              <input
                id={commissionId}
                type="range"
                min={5}
                max={40}
                step={1}
                value={commission}
                onChange={(event) => setCommission(Number(event.target.value))}
                className="mt-3 w-full accent-[#285C49]"
              />
            </div>
          </div>

          <div aria-live="polite" className="rounded-[1.75rem] bg-[#25332D] p-6 text-[#F6F2E9] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9D6C5]">Proyección hipotética con {advisors} vendedoras</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <Result label="Ventas de la red al mes" value={formatUsd(networkSales)} />
              <Result label="Comisiones para vendedoras" value={formatUsd(commissions)} />
              <Result label="Ingreso bruto de tu marca" value={formatUsd(brandGross)} />
            </dl>

            <div className="mt-8">
              <p className="text-sm font-semibold text-[#DCE6D9]">Ventas mensuales por escenario</p>
              <ul className="mt-4 space-y-3">
                {SCENARIOS.map((count) => {
                  const sales = count * avgSales;
                  return (
                    <li key={count} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
                      <span className={cn('w-[7.5rem] whitespace-nowrap', count === advisors ? 'font-semibold text-white' : 'text-[#C9D6C5]')}>{count} vendedoras</span>
                      <span className="h-3 overflow-hidden rounded-full bg-white/10">
                        <span
                          className={cn('block h-full rounded-full transition-all duration-500', count === advisors ? 'bg-[#C97857]' : 'bg-[#A9BEA5]')}
                          style={{ width: `${Math.max(4, (sales / maxScenarioSales) * 100)}%` }}
                        />
                      </span>
                      <span className={cn('tabular-nums', count === advisors ? 'font-semibold text-white' : 'text-[#C9D6C5]')}>{formatUsd(sales)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="mt-8 flex gap-2 rounded-2xl bg-white/5 p-4 text-sm leading-6 text-[#DCE6D9]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Proyección hipotética calculada solo con los supuestos que elijas. No son ingresos garantizados ni resultados de clientes reales, y no incluye costos de productos, logística ni impuestos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <dt className="text-xs text-[#C9D6C5]">{label}</dt>
      <dd className="mt-2 font-jakarta text-xl font-extrabold tabular-nums text-white">{value}</dd>
    </div>
  );
}
