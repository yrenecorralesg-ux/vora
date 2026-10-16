import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Plus, Database, Activity, AlertCircle } from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CommercialStatus, TechnicalStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface RecentTenant {
  id: string;
  commercial_name: string;
  slug: string;
  commercial_status: CommercialStatus;
  technical_status: TechnicalStatus;
  created_at: string;
}

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  resource: string | null;
  created_at: string;
}

const commercialStatusLabels: Record<CommercialStatus, string> = {
  trial: 'Prueba',
  active: 'Activa',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

const technicalStatusLabels: Record<TechnicalStatus, string> = {
  pending_setup: 'Configuracion pendiente',
  ready: 'Lista',
  error: 'Error',
};

const commercialStatusBadge: Record<CommercialStatus, string> = {
  trial: 'border-transparent bg-info/15 text-info',
  active: 'border-transparent bg-success/15 text-success',
  suspended: 'border-transparent bg-warning/15 text-warning',
  cancelled: 'border-transparent bg-muted text-muted-foreground',
};

const technicalStatusBadge: Record<TechnicalStatus, string> = {
  pending_setup: 'border-transparent bg-warning/15 text-warning',
  ready: 'border-transparent bg-success/15 text-success',
  error: 'border-transparent bg-destructive/15 text-destructive',
};

function formatDate(iso: string): string {
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'turquoise';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle
          className={
            accent === 'turquoise'
              ? 'text-3xl font-bold text-accent'
              : 'text-3xl font-bold'
          }
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireSuperAdmin();
  if (!user) {
    redirect('/login?redirect=/admin');
  }

  const supabase = getSupabaseServerClient();

  const [
    tenantsRes,
    trialRes,
    activeRes,
    suspendedRes,
    cancelledRes,
    pendingRes,
    readyRes,
    errorRes,
    dbConnectedRes,
    recentTenantsRes,
    auditRes,
  ] = await Promise.all([
    supabase.from('tenants').select('id', { count: 'exact', head: true }),
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('commercial_status', 'trial'),
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('commercial_status', 'active'),
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('commercial_status', 'suspended'),
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('commercial_status', 'cancelled'),
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('technical_status', 'pending_setup'),
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('technical_status', 'ready'),
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('technical_status', 'error'),
    supabase
      .from('tenant_databases')
      .select('id', { count: 'exact', head: true })
      .eq('connection_status', 'connected'),
    supabase
      .from('tenants')
      .select(
        'id, commercial_name, slug, commercial_status, technical_status, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('platform_audit_logs')
      .select('id, actor_id, action, resource, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const totalTenants = tenantsRes.count ?? 0;
  const recentTenants = (recentTenantsRes.data ?? []) as RecentTenant[];
  const auditLogs = (auditRes.data ?? []) as AuditRow[];

  const stats = {
    trial: trialRes.count ?? 0,
    active: activeRes.count ?? 0,
    suspended: suspendedRes.count ?? 0,
    cancelled: cancelledRes.count ?? 0,
    pending_setup: pendingRes.count ?? 0,
    ready: readyRes.count ?? 0,
    error: errorRes.count ?? 0,
    connectedDatabases: dbConnectedRes.count ?? 0,
  };

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Panel de control
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen general de la plataforma VORA
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva empresa
          </Link>
        </Button>
      </div>

      {totalTenants === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Aun no hay empresas registradas
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Crea la primera empresa para comenzar a gestionar tenants,
                modulos y configuraciones dentro de VORA.
              </p>
            </div>
            <Button asChild>
              <Link href="/admin/tenants/new">
                <Plus className="mr-2 h-4 w-4" />
                Crear primera empresa
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top stat cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Empresas totales" value={totalTenants} accent="turquoise" />
            <StatCard label="Bases conectadas" value={stats.connectedDatabases} />
            <StatCard label="Listas para operar" value={stats.ready} />
            <StatCard label="Con errores" value={stats.error} />
          </div>

          {/* Status breakdowns */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estado comercial</CardTitle>
                <CardDescription>
                  Distribucion de empresas por estado comercial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusRow
                  label="Prueba"
                  value={stats.trial}
                  total={totalTenants}
                  barClass="bg-info"
                />
                <StatusRow
                  label="Activa"
                  value={stats.active}
                  total={totalTenants}
                  barClass="bg-success"
                />
                <StatusRow
                  label="Suspendida"
                  value={stats.suspended}
                  total={totalTenants}
                  barClass="bg-warning"
                />
                <StatusRow
                  label="Cancelada"
                  value={stats.cancelled}
                  total={totalTenants}
                  barClass="bg-muted-foreground"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estado tecnico</CardTitle>
                <CardDescription>
                  Distribucion de empresas por estado de configuracion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusRow
                  label="Configuracion pendiente"
                  value={stats.pending_setup}
                  total={totalTenants}
                  barClass="bg-warning"
                />
                <StatusRow
                  label="Lista"
                  value={stats.ready}
                  total={totalTenants}
                  barClass="bg-success"
                />
                <StatusRow
                  label="Error"
                  value={stats.error}
                  total={totalTenants}
                  barClass="bg-destructive"
                />
              </CardContent>
            </Card>
          </div>

          {/* Recent tenants + audit */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">Empresas recientes</CardTitle>
                  <CardDescription>Ultimas 5 empresas creadas</CardDescription>
                </div>
                <Building2 className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent className="space-y-2">
                {recentTenants.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No hay empresas para mostrar
                  </p>
                ) : (
                  recentTenants.map((t) => (
                    <Link
                      key={t.id}
                      href={`/admin/tenants/${t.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {t.commercial_name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {t.slug} · {formatDate(t.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <Badge
                          className={commercialStatusBadge[t.commercial_status]}
                        >
                          {commercialStatusLabels[t.commercial_status]}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">Actividad reciente</CardTitle>
                  <CardDescription>Ultimos 10 eventos de auditoria</CardDescription>
                </div>
                <Activity className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent className="space-y-2">
                {auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No hay eventos de auditoria registrados
                    </p>
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {log.action}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {log.resource ?? '—'} · {formatDate(log.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatusRow({
  label,
  value,
  total,
  barClass,
}: {
  label: string;
  value: number;
  total: number;
  barClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-medium text-muted-foreground">
          {value} · {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
