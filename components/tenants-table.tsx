'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Building2,
  ArrowRight,
  CircleDot,
  Database as DatabaseIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  CommercialStatus,
  TechnicalStatus,
  ConnectionStatus,
} from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface TenantRow {
  id: string;
  commercial_name: string;
  slug: string;
  commercial_status: CommercialStatus;
  technical_status: TechnicalStatus;
  template_name: string | null;
  connection_status: ConnectionStatus | null;
  branding_primary: string | null;
  branding_logo_url: string | null;
}

/* ------------------------------- badges ---------------------------------- */

const COMMERCIAL_LABEL: Record<CommercialStatus, string> = {
  trial: 'Prueba',
  active: 'Activo',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
};

const COMMERCIAL_BADGE: Record<CommercialStatus, string> = {
  trial: 'bg-warning text-warning-foreground',
  active: 'bg-success text-success-foreground',
  suspended: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

const TECHNICAL_LABEL: Record<TechnicalStatus, string> = {
  pending_setup: 'Pendiente',
  ready: 'Listo',
  error: 'Error',
};

const TECHNICAL_BADGE: Record<TechnicalStatus, string> = {
  pending_setup: 'bg-muted text-muted-foreground',
  ready: 'bg-success text-success-foreground',
  error: 'bg-destructive text-destructive-foreground',
};

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  not_configured: 'No configurada',
  checking: 'Verificando',
  connected: 'Conectada',
  error: 'Error',
};

const CONNECTION_DOT: Record<ConnectionStatus, string> = {
  not_configured: 'bg-muted-foreground',
  checking: 'bg-warning',
  connected: 'bg-success',
  error: 'bg-destructive',
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function TenantsTable({ tenants }: { tenants: TenantRow[] }) {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<CommercialStatus | 'all'>('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      const matchesQuery =
        !q ||
        t.commercial_name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || t.commercial_status === status;
      return matchesQuery && matchesStatus;
    });
  }, [tenants, query, status]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o slug…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as CommercialStatus | 'all')}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Estado comercial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="trial">Prueba</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="suspended">Suspendido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva empresa
          </Link>
        </Button>
      </div>

      {/* Table / empty state */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary" />
            Empresas
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              ({filtered.length}
              {filtered.length !== tenants.length ? ` de ${tenants.length}` : ''})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState hasTenants={tenants.length > 0} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Estado comercial</TableHead>
                  <TableHead>Estado técnico</TableHead>
                  <TableHead>Conexión</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell>
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="flex items-center gap-3 font-medium text-foreground hover:text-primary"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                          style={{
                            backgroundColor:
                              t.branding_primary ?? 'hsl(225 93% 23%)',
                          }}
                        >
                          {t.commercial_name.slice(0, 2).toUpperCase()}
                        </span>
                        {t.commercial_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {t.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border-transparent',
                          COMMERCIAL_BADGE[t.commercial_status],
                        )}
                      >
                        {COMMERCIAL_LABEL[t.commercial_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border-transparent',
                          TECHNICAL_BADGE[t.technical_status],
                        )}
                      >
                        {TECHNICAL_LABEL[t.technical_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ConnectionBadge
                        status={t.connection_status ?? 'not_configured'}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.template_name ?? (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
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

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <CircleDot
        className={cn('h-2.5 w-2.5 fill-current', CONNECTION_DOT[status])}
      />
      <span className="text-muted-foreground">{CONNECTION_LABEL[status]}</span>
    </span>
  );
}

function EmptyState({ hasTenants }: { hasTenants: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <DatabaseIcon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">
          {hasTenants
            ? 'Sin resultados para tu búsqueda'
            : 'No hay empresas registradas'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasTenants
            ? 'Ajusta los filtros o el término de búsqueda para encontrar empresas.'
            : 'Crea la primera empresa para empezar a gestionar tu plataforma.'}
        </p>
      </div>
      {!hasTenants && (
        <Button asChild className="mt-2">
          <Link href="/admin/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva empresa
          </Link>
        </Button>
      )}
    </div>
  );
}
