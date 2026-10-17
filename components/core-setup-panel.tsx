'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tenantHostname } from '@/lib/core-config';
interface Setup {
  tenant: {
    infrastructure_mode: 'shared' | 'dedicated';
    plan_id: string | null;
  };
  plans: {
    id: string;
    name: string;
    monthly_price_usd: number | null;
    infrastructure_mode: string;
  }[];
  database: {
    project_ref: string | null;
    supabase_url: string | null;
    secret_ref: string | null;
    connection_status: string;
  } | null;
  domain: {
    hostname: string;
    verification_status: string;
    verification_error: string | null;
  } | null;
  memberships: { id: string; role: string; status: string }[];
  invitations: {
    id: string;
    email: string;
    status: string;
    expires_at: string;
  }[];
  subscription: { status: string } | null;
}
export function CoreSetupPanel({
  tenantId,
  slug,
}: {
  tenantId: string;
  slug: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<Setup | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState('');
  const [project, setProject] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState('');
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/tenants/${tenantId}/setup`, {
      cache: 'no-store',
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    const s = b as Setup;
    setData(s);
    setPlan(s.tenant.plan_id ?? '');
    setProject(s.database?.project_ref ?? '');
    setUrl(s.database?.supabase_url ?? '');
    setSecret(s.database?.secret_ref ?? '');
  }, [tenantId]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function action(path: string, body: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch(`/api/admin/tenants/${tenantId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage(
        b.message ?? 'Cambios guardados. Puedes continuar con otro apartado.',
      );
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault();
    fn();
  };
  return (
    <section className="mb-8 space-y-5 rounded-2xl border border-[#E2DACB] bg-[#F6F2E9] p-5">
      <div>
        <h2 className="font-jakarta text-xl font-bold text-[#285C49]">
          Configuración progresiva
        </h2>
        <p className="mt-1 text-sm">
          La empresa ya existe. Guarda y verifica cada apartado cuando esté
          listo.
        </p>
        <p className="mt-2 break-all text-sm">
          Subdominio reservado: <strong>{tenantHostname(slug)}</strong>
        </p>
        <Link className="text-sm underline" href={`/t/${slug}`}>
          Abrir portal provisional
        </Link>
        <Button
          className="ml-3"
          variant="outline"
          disabled={busy}
          onClick={() => void action('setup', { section: 'readiness' })}
        >
          Validar preparación de Core
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!data && !error && <p>Cargando configuración…</p>}
      {data && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form
            onSubmit={submit(
              () => void action('setup', { section: 'plan', plan_id: plan }),
            )}
            className="space-y-3 rounded-xl border bg-white p-4"
          >
            <h3 className="font-semibold">Plan y suscripción</h3>
            <p className="text-sm">
              {data.subscription
                ? `Suscripción: ${data.subscription.status}`
                : 'Pendiente de asignar plan'}
            </p>
            <Label htmlFor="core-plan">
              Plan disponible para {data.tenant.infrastructure_mode}
            </Label>
            <select
              id="core-plan"
              required
              className="h-10 w-full rounded-md border px-2"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              <option value="">Seleccionar después</option>
              {data.plans
                .filter(
                  (p) =>
                    p.infrastructure_mode === data.tenant.infrastructure_mode,
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ·{' '}
                    {p.monthly_price_usd === null
                      ? 'Precio pendiente'
                      : `US$${p.monthly_price_usd}/mes`}
                  </option>
                ))}
            </select>
            <Button disabled={busy || !plan}>Guardar plan</Button>
            <Link
              className="ml-3 text-sm underline"
              href={`/admin/billing?tenant=${tenantId}`}
            >
              Cobros y Pago Móvil
            </Link>
          </form>
          <form
            onSubmit={submit(
              () =>
                void action('setup', {
                  section: 'database',
                  mode: data.tenant.infrastructure_mode,
                  project_ref: project,
                  supabase_url: url,
                  secret_ref: secret,
                }),
            )}
            className="space-y-3 rounded-xl border bg-white p-4"
          >
            <h3 className="font-semibold">
              Base de datos · {data.tenant.infrastructure_mode}
            </h3>
            <p className="text-sm">
              Estado: {data.database?.connection_status ?? 'Pendiente'}
            </p>
            {data.tenant.infrastructure_mode === 'dedicated' ? (
              <>
                <Label htmlFor="core-project">
                  Proyecto (puede quedar pendiente)
                </Label>
                <Input
                  id="core-project"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
                <Label htmlFor="core-url">URL Supabase</Label>
                <Input
                  id="core-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Label htmlFor="core-secret">
                  Nombre de variable del secreto
                </Label>
                <Input
                  id="core-secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nunca ingreses la clave aquí. El secreto se configura en el
                  servidor.
                </p>
              </>
            ) : (
              <p className="text-sm">
                Prepara un espacio aislado por empresa dentro de la base
                compartida. La conexión Core no significa que los módulos
                comerciales estén implementados.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy}>Guardar configuración</Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !data.database}
                onClick={() => void action('test-connection', {})}
              >
                Verificar conexión
              </Button>
            </div>
          </form>
          <div className="space-y-3 rounded-xl border bg-white p-4">
            <h3 className="font-semibold">Dominio y DNS</h3>
            <p className="break-all text-sm">
              {data.domain?.hostname ?? tenantHostname(slug)}
            </p>
            <p className="text-sm">
              {data.domain?.verification_status === 'verified'
                ? 'DNS y HTTPS verificados'
                : 'Pendiente de configuración manual'}
            </p>
            <p className="text-sm text-muted-foreground">
              Agrega el subdominio al proyecto de hosting, configura los
              registros DNS que indique tu proveedor y habilita HTTPS. Después
              verifica aquí.
            </p>
            {data.domain?.verification_error && (
              <p className="text-sm">{data.domain.verification_error}</p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void action('setup', { section: 'verify_domain' })}
            >
              Verificar DNS y HTTPS
            </Button>
          </div>
          <form
            onSubmit={submit(
              () => void action('membership', { email, role: 'tenant_admin' }),
            )}
            className="space-y-3 rounded-xl border bg-white p-4"
          >
            <h3 className="font-semibold">Administrador</h3>
            <p className="text-sm">
              {
                data.memberships.filter(
                  (m) =>
                    m.status === 'active' &&
                    ['tenant_admin', 'admin'].includes(m.role),
                ).length
              }{' '}
              administradores activos
            </p>
            <Label htmlFor="core-email">Correo del administrador</Label>
            <Input
              id="core-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button disabled={busy}>Asignar administrador</Button>
            <p className="text-xs text-muted-foreground">
              Si aún no tiene cuenta, se registra como pendiente. El envío y
              aceptación de invitaciones requiere completar el servicio de
              correo.
            </p>
            {data.invitations.map((i) => (
              <p className="text-xs" key={i.id}>
                {i.email} · {i.status}
              </p>
            ))}
          </form>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Marca, datos de empresa, módulos y funciones se configuran en las
        pestañas inferiores. Las configuraciones pendientes no impiden guardar
        las demás.
      </p>
    </section>
  );
}
