import { redirect } from 'next/navigation';
import { Layers, CheckCircle2, Clock, XCircle, GitBranch } from 'lucide-react';

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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import type { Feature, ImplementationStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* ------------------------------- constants -------------------------------- */

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM',
  integration: 'Integraciones',
  channel: 'Canales',
  automation: 'Automatizacion',
  analytics: 'Analitica',
  commerce: 'Comercio y facturacion',
  finance: 'Finanzas y pagos',
  fiscal: 'Gestion fiscal',
};

const CATEGORY_ORDER = ['crm', 'integration', 'channel', 'automation', 'analytics', 'commerce', 'finance', 'fiscal'];

const STATUS_LABELS: Record<ImplementationStatus, string> = {
  implemented: 'Implementado',
  planned: 'Planificado',
  unavailable: 'No disponible',
};

const STATUS_BADGE: Record<ImplementationStatus, string> = {
  implemented: 'border-transparent bg-success/15 text-success',
  planned: 'border-transparent bg-warning/15 text-warning',
  unavailable: 'border-transparent bg-muted text-muted-foreground',
};

const STATUS_ICON: Record<ImplementationStatus, typeof CheckCircle2> = {
  implemented: CheckCircle2,
  planned: Clock,
  unavailable: XCircle,
};

/* -------------------------------- helpers --------------------------------- */

function groupByCategory(features: Feature[]): Record<string, Feature[]> {
  const groups: Record<string, Feature[]> = {};
  for (const f of features) {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  }
  return groups;
}

/* --------------------------------- page ----------------------------------- */

export default async function ModulesPage() {
  const user = await requireSuperAdmin();
  if (!user) redirect('/login?redirect=/admin');

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('features')
    .select(
      'key, name, description, category, dependencies, implementation_status, sort_order'
    )
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[admin/modules] fetch error', error.message);
  }

  const features = (data ?? []) as Feature[];
  const grouped = groupByCategory(features);

  const totalCount = features.length;
  const implementedCount = features.filter(
    (f) => f.implementation_status === 'implemented'
  ).length;
  const plannedCount = features.filter(
    (f) => f.implementation_status === 'planned'
  ).length;
  const unavailableCount = features.filter(
    (f) => f.implementation_status === 'unavailable'
  ).length;

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Modulos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catalogo de modulos e integraciones disponibles en la plataforma
          VORA.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Total modulos
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-accent">
              {totalCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Implementados
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-success">
              {implementedCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Planificados
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-warning">
              {plannedCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              No disponibles
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-muted-foreground">
              {unavailableCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Grouped tables */}
      {totalCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                No hay modulos registrados
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                El catalogo de features esta vacio. Verifica que las migraciones
                de datos de referencia se hayan ejecutado.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.filter((cat) => (grouped[cat] ?? []).length > 0).map(
            (category) => {
              const catFeatures = grouped[category] ?? [];
              const catImplemented = catFeatures.filter(
                (f) => f.implementation_status === 'implemented'
              ).length;
              return (
                <Card key={category}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1.5">
                      <CardTitle className="text-lg">
                        {CATEGORY_LABELS[category] ?? category}
                      </CardTitle>
                      <CardDescription>
                        {catImplemented} de {catFeatures.length} modulos
                        implementados
                      </CardDescription>
                    </div>
                    <Layers className="h-5 w-5 text-accent" />
                  </CardHeader>
                  <CardContent className="px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Clave</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="pr-6">Dependencias</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catFeatures.map((f) => {
                          const StatusIcon = STATUS_ICON[f.implementation_status];
                          const deps = f.dependencies ?? [];
                          return (
                            <TableRow key={f.key}>
                              <TableCell className="pl-6">
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                                  {f.key}
                                </code>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-foreground">
                                  {f.name}
                                </div>
                                <div className="max-w-md truncate text-xs text-muted-foreground">
                                  {f.description}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    STATUS_BADGE[f.implementation_status]
                                  }
                                >
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {STATUS_LABELS[f.implementation_status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="pr-6">
                                {deps.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <GitBranch className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                                    {deps.map((d) => (
                                      <code
                                        key={d}
                                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                      >
                                        {d}
                                      </code>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Sin dependencias
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
