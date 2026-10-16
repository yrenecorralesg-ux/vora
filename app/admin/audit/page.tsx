import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ScrollText,
  Activity,
  Filter,
  CalendarDays,
  Building2,
  ArrowUpDown,
} from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import type { AuditLog } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* -------------------------------- helpers --------------------------------- */

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details || Object.keys(details).length === 0) return '—';
  try {
    return JSON.stringify(details);
  } catch {
    return '—';
  }
}

function actionBadgeClass(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('create') || a.includes('insert')) {
    return 'border-transparent bg-success/15 text-success';
  }
  if (a.includes('update') || a.includes('config') || a.includes('assign')) {
    return 'border-transparent bg-info/15 text-info';
  }
  if (
    a.includes('delete') ||
    a.includes('suspend') ||
    a.includes('cancel') ||
    a.includes('error')
  ) {
    return 'border-transparent bg-destructive/15 text-destructive';
  }
  return 'border-transparent bg-muted text-muted-foreground';
}

/* --------------------------------- page ----------------------------------- */

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { action?: string };
}) {
  const user = await requireSuperAdmin();
  if (!user) redirect('/login?redirect=/admin');

  const supabase = getSupabaseServerClient();
  const actionFilter = searchParams.action?.trim() || null;

  /* Fetch audit logs with tenant info --------------------------------------- */
  let query = supabase
    .from('platform_audit_logs')
    .select(
      'id, actor_id, tenant_id, action, resource, resource_id, details, correlation_id, created_at, tenants!left(id, commercial_name, slug)'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (actionFilter) {
    query = query.eq('action', actionFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[admin/audit] fetch error', error.message);
  }

  const logs = (data ?? []) as unknown as Array<
    AuditLog & {
      tenants: { id: string; commercial_name: string; slug: string } | null;
    }
  >;

  /* Fetch distinct actions for filter chips --------------------------------- */
  const { data: distinctActions } = await supabase
    .from('platform_audit_logs')
    .select('action')
    .order('action', { ascending: true });

  const uniqueActions = Array.from(
    new Set((distinctActions ?? []).map((r: { action: string }) => r.action))
  ).sort();

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Auditoria
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro de eventos de la plataforma (ultimos 100).
          </p>
        </div>
        <Badge className="border-transparent bg-primary/10 text-primary">
          <Activity className="mr-1 h-3 w-3" />
          {logs.length} eventos
        </Badge>
      </div>

      {/* Action filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-accent" />
            Filtrar por accion
          </CardTitle>
          <CardDescription>
            Muestra solo los eventos del tipo de accion seleccionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/audit">
              <Button
                variant={!actionFilter ? 'default' : 'outline'}
                size="sm"
                className="h-8"
              >
                Todos
              </Button>
            </Link>
            {uniqueActions.map((act) => (
              <Link key={act} href={`/admin/audit?action=${encodeURIComponent(act)}`}>
                <Button
                  variant={actionFilter === act ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                >
                  {act}
                </Button>
              </Link>
            ))}
            {uniqueActions.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No hay acciones registradas para filtrar.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit log table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScrollText className="h-5 w-5 text-primary" />
              Eventos de auditoria
            </CardTitle>
            <CardDescription>
              {actionFilter
                ? `Filtrado por: ${actionFilter}`
                : 'Todos los eventos'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ScrollText className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {actionFilter
                  ? `No hay eventos para la accion "${actionFilter}".`
                  : 'No hay eventos de auditoria registrados.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">
                    <span className="flex items-center gap-1">
                      <ArrowUpDown className="h-3 w-3" />
                      Fecha
                    </span>
                  </TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Accion</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="pr-6">Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="pl-6 whitespace-nowrap text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateTime(log.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actor_id ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                          {shortId(log.actor_id)}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">Sistema</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={actionBadgeClass(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {log.resource ? (
                        <span>
                          {log.resource}
                          {log.resource_id && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({shortId(log.resource_id)})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.tenants ? (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">
                            {log.tenants.commercial_name}
                          </span>
                          <code className="rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                            {log.tenants.slug}
                          </code>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6">
                      <span className="block max-w-xs truncate text-xs text-muted-foreground">
                        {formatDetails(log.details)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
