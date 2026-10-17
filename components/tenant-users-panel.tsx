'use client';

import type { TenantUserDisplay } from '@/lib/tenant-users';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function TenantUsersPanel({
  users,
  error,
}: {
  users: TenantUserDisplay[];
  error?: string;
}) {
  const labels: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    pending: 'Pendiente de cuenta',
    expired: 'Invitación vencida',
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usuarios de la empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!users.length ? (
          <p className="text-sm text-muted-foreground">
            Esta empresa aún no tiene usuarios ni invitaciones registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Correo del usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">
                        {user.email ?? 'Correo no disponible temporalmente'}
                      </p>
                      {user.kind === 'invitation' ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Asignación registrada; cuenta pendiente. No se ha
                          enviado correo.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Usuario vinculado · {user.auth_user_id?.slice(0, 8)}…
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.role === 'tenant_admin'
                        ? 'Administrador de empresa'
                        : user.role.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === 'active' ? 'default' : 'secondary'
                        }
                      >
                        {labels[user.status] ?? user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('es-VE', {
                        timeZone: 'America/Caracas',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
