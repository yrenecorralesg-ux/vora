'use client';

import { CheckCircle2, CreditCard, Info, Server, Share2 } from 'lucide-react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { INFRASTRUCTURE_MODES } from '@/lib/tenant-management';
import type { Plan } from '@/lib/types';
import type { WizardData } from '@/lib/wizard-types';

export function StepPlan({
  data,
  update,
  plans,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  plans: Plan[];
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CreditCard className="h-5 w-5 text-accent" />
          Plan inicial y modalidad
        </CardTitle>
        <CardDescription>El plan se puede cambiar después. Registrar la empresa no genera cobros ni activa la suscripción.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <fieldset>
          <legend className="text-sm font-semibold text-foreground">
            Plan inicial <span className="text-destructive">*</span>
          </legend>
          {plans.length === 0 ? (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
              No hay planes activos. Crea o activa un plan antes de registrar empresas.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => {
                const selected = data.plan_id === plan.id;
                const maxUsers = plan.limits?.max_users;
                return (
                  <label
                    key={plan.id}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#285C49]',
                      selected ? 'border-[#285C49] bg-[#EFF4EC]' : 'border-border hover:border-[#A9BEA5]',
                    )}
                  >
                    <input type="radio" name="plan_id" value={plan.id} checked={selected} onChange={() => update('plan_id', plan.id)} className="mt-1 accent-[#285C49]" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{plan.name}</span>
                      {plan.description && <span className="mt-0.5 block text-xs text-muted-foreground">{plan.description}</span>}
                      {maxUsers !== undefined && <span className="mt-1 block text-xs text-muted-foreground">Hasta {maxUsers} usuarios</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground">
            Modalidad de infraestructura <span className="text-destructive">*</span>
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {INFRASTRUCTURE_MODES.map((mode) => {
              const selected = data.infrastructure_mode === mode.value;
              const Icon = mode.value === 'dedicated' ? Server : Share2;
              return (
                <label
                  key={mode.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#285C49]',
                    selected ? 'border-[#285C49] bg-[#EFF4EC]' : 'border-border hover:border-[#A9BEA5]',
                  )}
                >
                  <input
                    type="radio"
                    name="infrastructure_mode"
                    value={mode.value}
                    checked={selected}
                    onChange={() => update('infrastructure_mode', mode.value)}
                    className="mt-1 accent-[#285C49]"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <Icon className="h-4 w-4 text-[#285C49]" aria-hidden="true" /> {mode.label}
                      {selected && <CheckCircle2 className="h-4 w-4 text-[#285C49]" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{mode.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3 rounded-md border border-info/30 bg-info/5 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
            <p>
              La empresa se registra con <strong className="text-foreground">aprovisionamiento pendiente</strong>. No se crean proyectos Supabase automáticamente
              y la empresa no se marca como operativa hasta que su infraestructura esté verificada.
              {data.infrastructure_mode === 'shared' && ' Las tablas comerciales y el aislamiento por tenant_id de la modalidad Shared todavía están en preparación.'}
            </p>
          </div>
        </fieldset>
      </CardContent>
    </>
  );
}
