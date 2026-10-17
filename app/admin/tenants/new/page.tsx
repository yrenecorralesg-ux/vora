'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify } from '@/lib/wizard-types';
import { tenantHostname, validTenantSlug } from '@/lib/core-config';
export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const [legal, setLegal] = useState('');
  const [tax, setTax] = useState('');
  const [mode, setMode] = useState('shared');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commercial_name: name,
          slug,
          legal_name: legal,
          tax_id: tax,
          infrastructure_mode: mode,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      router.push(`/admin/tenants/${body.tenant.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear la empresa.',
      );
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/tenants">← Empresas</Link>
      <div>
        <h1 className="font-jakarta text-2xl font-bold">Crear empresa</h1>
        <p className="mt-2 text-muted-foreground">
          Crea su espacio ahora. Configura DNS, base de datos, plan, servicios y
          administrador después, en el orden que necesites.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-2xl border bg-white p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Nombre comercial *</Label>
          <Input
            id="name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!touched) setSlug(slugify(e.target.value).slice(0, 63));
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Subdominio *</Label>
          <Input
            id="slug"
            required
            maxLength={63}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
          <p className="break-all text-sm">
            {tenantHostname(slug || 'mi-empresa')}
          </p>
          <p className="text-xs text-muted-foreground">
            Quedará reservado, pendiente de tu configuración manual de DNS y
            HTTPS.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="legal">Razón social</Label>
          <Input
            id="legal"
            value={legal}
            onChange={(e) => setLegal(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax">RIF</Label>
          <Input
            id="tax"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            maxLength={40}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mode">Modalidad de base de datos</Label>
          <select
            id="mode"
            className="h-10 w-full rounded-md border px-3"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="shared">
              Shared — base compartida, planes económicos
            </option>
            <option value="dedicated">Dedicated — base dedicada</option>
          </select>
          <p className="text-xs text-muted-foreground">
            La elección no conecta ni aprovisiona una base de datos
            automáticamente.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy || !name.trim() || !validTenantSlug(slug)}>
          {busy ? 'Creando…' : 'Crear y continuar configurando'}
        </Button>
      </form>
    </div>
  );
}
