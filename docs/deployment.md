# Despliegue — VORA

## Visión General

VORA se despliega como una aplicación Next.js sobre Vercel (recomendado) o Netlify, con Supabase como backend. El despliegue incluye la aplicación web y la configuración de variables de entorno para la Platform DB y las Tenant DBs.

---

## Arquitectura de Despliegue

```
┌──────────────────────────────────────────────────┐
│                  Vercel / Netlify                 │
│            (Next.js App — VORA)                │
│                                                  │
│  env vars:                                       │
│  • NEXT_PUBLIC_SUPABASE_URL                      │
│  • NEXT_PUBLIC_SUPABASE_ANON_KEY                 │
│  • SUPABASE_SERVICE_ROLE_KEY                     │
│  • TENANT_<UUID>_SUPABASE_URL (por tenant)       │
│  • TENANT_<UUID>_SUPABASE_SERVER_KEY (por tenant)│
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌────────────┐ ┌──────────┐
   │ Platform │ │  Tenant A  │ │  Tenant B │
   │  Supabase│ │  Supabase  │ │  Supabase │
   │  Project │ │  Project   │ │  Project  │
   └──────────┘ └────────────┘ └──────────┘
```

---

## Vercel (Recomendado)

### Primer despliegue

1. **Conectar el repositorio** a Vercel
2. **Configurar variables de entorno** en Settings → Environment Variables:

   | Variable | Entorno |
   |----------|---------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview |

3. **Deploy** — Vercel detecta automáticamente Next.js y ejecuta `npm run build`

### Configuración de build

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

No se requiere configuración adicional de build. Vercel usa Next.js 13.5 con App Router nativamente.

### Dominios

- **Dominio principal:** `vora.venesoftca.com` (ejemplo)
- **Subdominios por tenant:** `<slug>.vora.venesoftca.com` (futuro — Sprint 1 usa `/t/[slug]`)
- **Staging:** `<branch>.vercel.app` (auto-generado por Vercel)

---

## Netlify (Alternativo)

### Configuración

El proyecto incluye `netlify.toml`:

```toml
[build]
  publish = ".next"
```

Y usa el plugin oficial `@netlify/plugin-nextjs` (en `package.json`).

### Consideraciones

- Netlify soporta Next.js App Router desde la versión 5+ del plugin
- Las variables de entorno se configuran en Site settings → Environment variables
- El middleware de Next.js funciona correctamente en Netlify

---

## Supabase

### Platform DB

1. **Crear proyecto** en [supabase.com](https://supabase.com)
2. **Obtener credenciales** desde Project Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`
3. **Aplicar migraciones** desde `supabase/migrations/`
4. **Desactivar confirmación de email** en Authentication → Settings → "Confirm email" = OFF
5. **Crear el primer super admin** (ver `onboarding.md`)

### Tenant DBs

Por cada nuevo tenant:

1. Crear un proyecto Supabase dedicado
2. Añadir las variables de entorno `TENANT_<UUID>_SUPABASE_URL` y `TENANT_<UUID>_SUPABASE_SERVER_KEY`
3. Redeploy de la aplicación
4. (Futuro) Aplicar el esquema del CRM a la Tenant DB

---

## Entornos

### Staging

| Aspecto | Configuración |
|---------|--------------|
| URL | `<branch>.vercel.app` o `staging.vora.venesoftca.com` |
| Supabase | Proyecto Supabase de staging (separado de producción) |
| Datos | Seed data + tenants de prueba |
| Auth | Email confirmation OFF |
| Propósito | QA, validación con cliente, pruebas de wizard |

### Production

| Aspecto | Configuración |
|---------|--------------|
| URL | `vora.venesoftca.com` (dominio principal) |
| Supabase | Proyecto Supabase de producción |
| Datos | Tenants reales |
| Auth | Email confirmation OFF (Sprint 1) |
| Variables | Todas configuradas incluyendo `TENANT_*` |

---

## DNS

### Configuración para Vercel

| Registro | Tipo | Valor |
|----------|------|-------|
| `@` | A | `76.76.21.21` (Vercel) |
| `www` | CNAME | `cname.vercel-dns.com` |
| `*` | CNAME | `cname.vercel-dns.com` (para subdominios de tenants) |

> El wildcard `*` permite futuros subdominios por tenant (`solee.vora.venesoftca.com`).

### Configuración para Netlify

| Registro | Tipo | Valor |
|----------|------|-------|
| `@` | A | `75.2.60.5` (Netlify) |
| `www` | CNAME | `<site>.netlify.app` |

### Dominios personalizados de tenants (futuro)

Cuando se implemente `tenant_domains`, los clientes podrán usar dominios propios (`crm.cliente.com`). Esto requerirá:

1. El cliente añade un CNAME apuntando a `vora.venesoftca.com`
2. El super admin registra el dominio en `tenant_domains`
3. El middleware resuelve el tenant por hostname
4. Verificación DNS automática

---

## Comandos de Despliegue

```bash
# Build local
npm run build

# Type check antes de deploy
npm run typecheck

# Lint
npm run lint

# Start producción local
npm run start
```

### En Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy a staging
vercel

# Deploy a producción
vercel --prod
```

---

## Rollback

### Vercel

1. Ir al dashboard de Vercel → proyecto VORA → Deployments
2. Encontrar el último deployment estable
3. Click en "..." → "Instant Rollback"
4. Confirmar

### Supabase

Supabase no tiene rollback automático de migraciones. Si una migración falla:

1. Identificar la migración problemática en `migration_runs` (status = `failed`)
2. Preparar un script de rollback manual (revertir los cambios DDL)
3. Ejecutar el rollback en Supabase SQL Editor
4. Marcar el `migration_run` como `rolled_back`

### Consideraciones

- **Migraciones aditivas:** Siempre que sea posible, usar migraciones aditivas (ADD COLUMN, CREATE TABLE IF NOT EXISTS) para minimizar el riesgo de rollback
- **Seed data:** El seed es idempotente (`ON CONFLICT DO UPDATE/NOTHING`), puede re-ejecutarse sin riesgo
- **RLS:** Las policies son idempotentes (`DROP POLICY IF EXISTS` + `CREATE`), pueden re-aplicarse

---

## Checklist Pre-Deploy

- [ ] Variables de entorno configuradas
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run lint` pasa sin errores
- [ ] `npm run build` completa exitosamente
- [ ] Migraciones de Platform DB aplicadas
- [ ] Seed data aplicada
- [ ] Primer super admin creado y verificado
- [ ] Email confirmation OFF en Supabase Auth
- [ ] RLS habilitado en todas las tablas (verificado por advisors)
