import { redirect } from 'next/navigation';
import { CreditCard, CheckCircle2, FileText } from 'lucide-react';

import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Plan } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* ------------------------------- constants -------------------------------- */

const LIMIT_LABELS: Record<string, string> = {
  max_users: 'Usuarios maximos',
  max_concurrent_users: 'Usuarios concurrentes',
  max_customers: 'Clientes maximos',
  max_orders_month: 'Pedidos por mes',
  storage_gb: 'Almacenamiento (GB)',
  max_stores: 'Tiendas maximas',
  max_nit: 'NIT maximos',
};

function formatLimitKey(key: string): string {
  return LIMIT_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* --------------------------------- page ----------------------------------- */

export default async function PlansPage() {
  const user = await requireSuperAdmin();
  if (!user) redirect('/login?redirect=/admin');

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('plans')
    .select('id, name, description, limits, is_active')
    .order('name', { ascending: true });

  if (error) {
    console.error('[admin/plans] fetch error', error.message);
  }

  const plans = (data ?? []) as Plan[];

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Planes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Planes de suscripcion disponibles para las empresas en la plataforma.
        </p>
      </div>

      {/* Proposal note */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Solicita una propuesta
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los planes mostrados definen los limites operativos de cada
              empresa. El precio no se muestra publicamente: cada cliente
              recibe una propuesta comercial personalizada segun sus
              requerimientos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plan cards */}
      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                No hay planes configurados
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                No se encontraron planes en la base de datos. Verifica que los
                datos de referencia se hayan sembrado correctamente.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const limits = plan.limits ?? {};
            const limitEntries = Object.entries(limits);
            return (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <Badge
                      className={
                        plan.is_active
                          ? 'border-transparent bg-success/15 text-success'
                          : 'border-transparent bg-muted text-muted-foreground'
                      }
                    >
                      {plan.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  {plan.description ? (
                    <CardDescription>{plan.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-4 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-accent" />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Limites del plan
                    </span>
                  </div>
                  {limitEntries.length > 0 ? (
                    <dl className="space-y-2">
                      {limitEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0"
                        >
                          <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                            {formatLimitKey(key)}
                          </dt>
                          <dd className="text-sm font-semibold text-foreground">
                            {typeof value === 'number'
                              ? value.toLocaleString('es')
                              : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin limites definidos.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
