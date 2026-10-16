import { redirect } from 'next/navigation';
import {
  Shield,
  Users,
  Building2,
  Mail,
  CalendarDays,
  Crown,
} from 'lucide-react';

import { requireSuperAdmin } from '@/lib/auth';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
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

export const dynamic = 'force-dynamic';

/* -------------------------------- helpers --------------------------------- */

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

function emailOrFallback(
  userId: string,
  emailMap: Map<string, string>
): { display: string; isEmail: boolean } {
  const email = emailMap.get(userId);
  if (email) return { display: email, isEmail: true };
  return { display: shortId(userId), isEmail: false };
}

/* --------------------------------- page ----------------------------------- */

export default async function UsersPage() {
  const user = await requireSuperAdmin();
  if (!user) redirect('/login?redirect=/admin');

  const supabase = getSupabaseServerClient();
  const serviceClient = getSupabaseServiceClient();

  /* Fetch platform user roles with role details ----------------------------- */
  const [
    rolesRes,
    platformRolesRes,
    membershipsRes,
    tenantsRes,
  ] = await Promise.all([
    supabase
      .from('platform_user_roles')
      .select(
        'id, user_id, role_id, assigned_by, created_at, platform_roles!inner(id, key, name, description, scope)'
      )
      .order('created_at', { ascending: false }),
    supabase.from('platform_roles').select('id, key, name, scope'),
    supabase
      .from('tenant_memberships')
      .select(
        'id, tenant_id, auth_user_id, role, status, created_at, tenants!inner(id, commercial_name, slug)'
      )
      .order('created_at', { ascending: false }),
    supabase.from('tenants').select('id, commercial_name, slug'),
  ]);

  if (rolesRes.error) {
    console.error('[admin/users] platform_user_roles error', rolesRes.error.message);
  }
  if (membershipsRes.error) {
    console.error('[admin/users] tenant_memberships error', membershipsRes.error.message);
  }

  const platformUserRoles = (rolesRes.data ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    role_id: string;
    assigned_by: string | null;
    created_at: string;
    platform_roles: {
      id: string;
      key: string;
      name: string;
      description: string | null;
      scope: string;
    };
  }>;

  const memberships = (membershipsRes.data ?? []) as unknown as Array<{
    id: string;
    tenant_id: string;
    auth_user_id: string;
    role: string;
    status: string;
    created_at: string;
    tenants: {
      id: string;
      commercial_name: string;
      slug: string;
    };
  }>;

  /* Build user-id -> email map via service-role auth admin ------------------- */
  const emailMap = new Map<string, string>();

  // Collect all unique user IDs from both sources
  const userIds = new Set<string>();
  for (const r of platformUserRoles) userIds.add(r.user_id);
  for (const m of memberships) userIds.add(m.auth_user_id);

  if (userIds.size > 0) {
    try {
      // listUsers returns up to 1000 per page; collect all pages if needed
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await serviceClient.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (result.error) {
          console.error(
            '[admin/users] auth.admin.listUsers error',
            result.error.message
          );
          break;
        }
        for (const u of result.data.users ?? []) {
          if (u.email) emailMap.set(u.id, u.email);
        }
        const total = result.data.total ?? 0;
        const fetched = page * 1000;
        hasMore = fetched < total;
        page += 1;
      }
    } catch (err) {
      console.error('[admin/users] failed to list auth users', err);
    }
  }

  /* Group platform admins by user ------------------------------------------- */
  const adminByUser = new Map<
    string,
    { userId: string; roles: typeof platformUserRoles; firstAssigned: string }
  >();
  for (const r of platformUserRoles) {
    const existing = adminByUser.get(r.user_id);
    if (existing) {
      existing.roles.push(r);
    } else {
      adminByUser.set(r.user_id, {
        userId: r.user_id,
        roles: [r],
        firstAssigned: r.created_at,
      });
    }
  }
  const admins = Array.from(adminByUser.values()).sort((a, b) =>
    a.firstAssigned < b.firstAssigned ? 1 : -1
  );

  /* Group tenant memberships by tenant -------------------------------------- */
  const membershipsByTenant = new Map<
    string,
    { tenantName: string; tenantSlug: string; members: typeof memberships }
  >();
  for (const m of memberships) {
    const existing = membershipsByTenant.get(m.tenant_id);
    if (existing) {
      existing.members.push(m);
    } else {
      membershipsByTenant.set(m.tenant_id, {
        tenantName: m.tenants?.commercial_name ?? '—',
        tenantSlug: m.tenants?.slug ?? '',
        members: [m],
      });
    }
  }
  const tenantsWithMembers = Array.from(membershipsByTenant.entries()).sort(
    ([, a], [, b]) => a.tenantName.localeCompare(b.tenantName)
  );

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Usuarios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administradores de plataforma y usuarios asignados a empresas
          (tenants).
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Admins de plataforma
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-accent">
              {admins.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Usuarios en tenants
            </CardDescription>
            <CardTitle className="text-3xl font-bold">
              {memberships.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Empresas con miembros
            </CardDescription>
            <CardTitle className="text-3xl font-bold">
              {tenantsWithMembers.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Roles de plataforma
            </CardDescription>
            <CardTitle className="text-3xl font-bold">
              {(platformRolesRes.data ?? []).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Platform Admins section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Administradores de plataforma
            </CardTitle>
            <CardDescription>
              Usuarios con roles a nivel global de la plataforma
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {admins.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay administradores de plataforma asignados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="pr-6">Asignado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const { display, isEmail } = emailOrFallback(
                    admin.userId,
                    emailMap
                  );
                  const isSuperAdmin = admin.roles.some(
                    (r) => r.platform_roles?.key === 'super_admin'
                  );
                  return (
                    <TableRow key={admin.userId}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {isEmail
                              ? display.charAt(0).toUpperCase()
                              : '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-foreground">
                                {isEmail ? display : 'Usuario'}
                              </span>
                              {isSuperAdmin && (
                                <Crown className="h-3.5 w-3.5 text-accent" />
                              )}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {isEmail ? (
                                <span className="flex items-center gap-1">
                                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                                    {shortId(admin.userId)}
                                  </code>
                                </span>
                              ) : (
                                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                                  {admin.userId}
                                </code>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {admin.roles.map((r) => (
                            <Badge
                              key={r.role_id}
                              className={
                                r.platform_roles?.key === 'super_admin'
                                  ? 'border-transparent bg-primary/15 text-primary'
                                  : 'border-transparent bg-muted text-muted-foreground'
                              }
                            >
                              {r.platform_roles?.name ?? 'Desconocido'}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(admin.firstAssigned)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tenant Users section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-accent" />
              Usuarios de empresas
            </CardTitle>
            <CardDescription>
              Usuarios asignados a cada empresa (tenant) con su rol
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenantsWithMembers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay usuarios asignados a empresas.
              </p>
            </div>
          ) : (
            tenantsWithMembers.map(([tenantId, { tenantName, tenantSlug, members }]) => (
              <div key={tenantId}>
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    {tenantName}
                  </span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {tenantSlug}
                  </code>
                </div>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Usuario</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="pr-4">Asignado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => {
                        const { display, isEmail } = emailOrFallback(
                          m.auth_user_id,
                          emailMap
                        );
                        const isActive = m.status === 'active';
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="pl-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                                  {isEmail
                                    ? display.charAt(0).toUpperCase()
                                    : '?'}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {isEmail ? (
                                      <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                        {display}
                                      </span>
                                    ) : (
                                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                                        {shortId(m.auth_user_id)}
                                      </code>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className="border-transparent bg-secondary text-secondary-foreground"
                                variant="secondary"
                              >
                                {m.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  isActive
                                    ? 'border-transparent bg-success/15 text-success'
                                    : 'border-transparent bg-muted text-muted-foreground'
                                }
                              >
                                {isActive ? 'Activo' : m.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-4">
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(m.created_at)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
