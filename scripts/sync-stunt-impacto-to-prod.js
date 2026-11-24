const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const devUrl = process.env.DEV_SUPABASE_URL || 'https://ilrbrpfyfzqpwdgklgmc.supabase.co';
const devKey = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const devClient = createClient(devUrl, devKey);

const prodUrl = process.env.PROD_SUPABASE_URL || 'https://tadnasbbzxrudparnywt.supabase.co';
const prodKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
const prodClient = createClient(prodUrl, prodKey);

const TENANT_IDS = [
  'd3ac2192-b6d7-48e3-8f0d-ee6c12dc3a9a', // Stunt Riders
  'f87187a4-50a6-4b3e-bd20-f0d5e79d8a16', // Inv. Impacto
];

const USERS_TO_SYNC = [
  {
    id: 'dce47e30-04b0-4e50-9704-748401149108',
    email: 'admin@vora.com',
    password: 'Vora2026!',
    user_metadata: { full_name: 'Admin VORA' },
    isSuperAdmin: true,
  },
  {
    id: 'd2247dc2-0650-4080-82c3-78fc9adcbb8d',
    email: 'supervisor.prueba@vora.test',
    password: 'Vora2026!',
    user_metadata: { full_name: 'Supervisor Prueba', commercial_name: 'Stunt Riders' },
  },
  {
    id: '5b1ebe18-2be1-43f0-bfa0-cd25fd97c9a1',
    email: 'cajero.prueba@vora.test',
    password: 'Vora2026!',
    user_metadata: { full_name: 'Cajero Prueba', commercial_name: 'Stunt Riders' },
  },
];

async function sync() {
  console.log('--- 1. Extrayendo datos de desarrollo ---');

  const { data: tenants, error: errT } = await devClient
    .from('tenants')
    .select('*')
    .in('id', TENANT_IDS);
  if (errT) throw errT;

  const { data: branding } = await devClient
    .from('tenant_branding')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: domains } = await devClient
    .from('tenant_domains')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: features } = await devClient
    .from('tenant_features')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: memberships } = await devClient
    .from('tenant_memberships')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: branches } = await devClient
    .from('tenant_branches')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: registers } = await devClient
    .from('pos_registers')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: whSettings } = await devClient
    .from('warehouse_settings')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: warehouses } = await devClient
    .from('warehouse_warehouses')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: categories } = await devClient
    .from('warehouse_categories')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  const { data: units } = await devClient
    .from('warehouse_units')
    .select('*')
    .in('tenant_id', TENANT_IDS);

  console.log(`Extraidos: ${tenants.length} tenants, ${features?.length || 0} features, ${warehouses?.length || 0} warehouses, etc.`);

  console.log('--- 2. Creando usuarios Auth en Producción ---');
  for (const u of USERS_TO_SYNC) {
    // Check if user exists in prod
    const { data: existingUser } = await prodClient.auth.admin.getUserById(u.id);
    if (!existingUser?.user) {
      console.log(`Creando usuario auth: ${u.email}`);
      const { error: errCreate } = await prodClient.auth.admin.createUser({
        id: u.id,
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: u.user_metadata,
      });
      if (errCreate) {
        console.warn(`Aviso createUser ${u.email}:`, errCreate.message);
        // Try update password if already exists under diff id
        await prodClient.auth.admin.updateUserById(u.id, { password: u.password }).catch(() => {});
      }
    } else {
      console.log(`Usuario ya existe en auth: ${u.email}, actualizando password`);
      await prodClient.auth.admin.updateUserById(u.id, { password: u.password });
    }

    if (u.isSuperAdmin) {
      // Ensure super_admin role in platform_user_roles
      await prodClient.from('platform_user_roles').upsert({
        user_id: u.id,
        role: 'super_admin',
      }, { onConflict: 'user_id,role' });
    }
  }

  console.log('--- 3. Insertando configuración real en Producción ---');

  // Tenants
  if (tenants?.length) {
    const { error } = await prodClient.from('tenants').upsert(tenants, { onConflict: 'id' });
    if (error) console.error('Error tenants:', error.message);
    else console.log(`✓ ${tenants.length} tenants insertados.`);
  }

  // Branding
  if (branding?.length) {
    const { error } = await prodClient.from('tenant_branding').upsert(branding, { onConflict: 'tenant_id' });
    if (error) console.error('Error branding:', error.message);
    else console.log(`✓ ${branding.length} branding insertados.`);
  }

  // Domains
  if (domains?.length) {
    const { error } = await prodClient.from('tenant_domains').upsert(domains, { onConflict: 'tenant_id,hostname' });
    if (error) console.error('Error domains:', error.message);
    else console.log(`✓ ${domains.length} domains insertados.`);
  }

  // Features
  if (features?.length) {
    const { error } = await prodClient.from('tenant_features').upsert(features, { onConflict: 'tenant_id,feature_key' });
    if (error) console.error('Error features:', error.message);
    else console.log(`✓ ${features.length} features insertadas.`);
  }

  // Memberships
  if (memberships?.length) {
    const { error } = await prodClient.from('tenant_memberships').upsert(memberships, { onConflict: 'id' });
    if (error) console.error('Error memberships:', error.message);
    else console.log(`✓ ${memberships.length} memberships insertadas.`);
  }

  // Branches
  if (branches?.length) {
    const { error } = await prodClient.from('tenant_branches').upsert(branches, { onConflict: 'id' });
    if (error) console.error('Error branches:', error.message);
    else console.log(`✓ ${branches.length} branches insertadas.`);
  }

  // Registers
  if (registers?.length) {
    const { error } = await prodClient.from('pos_registers').upsert(registers, { onConflict: 'id' });
    if (error) console.error('Error registers:', error.message);
    else console.log(`✓ ${registers.length} registers insertadas.`);
  }

  // Warehouse settings
  if (whSettings?.length) {
    const { error } = await prodClient.from('warehouse_settings').upsert(whSettings, { onConflict: 'tenant_id' });
    if (error) console.error('Error whSettings:', error.message);
    else console.log(`✓ ${whSettings.length} warehouse_settings insertados.`);
  }

  // Warehouses
  if (warehouses?.length) {
    const { error } = await prodClient.from('warehouse_warehouses').upsert(warehouses, { onConflict: 'id' });
    if (error) console.error('Error warehouses:', error.message);
    else console.log(`✓ ${warehouses.length} warehouses insertados.`);
  }

  // Categories
  if (categories?.length) {
    const { error } = await prodClient.from('warehouse_categories').upsert(categories, { onConflict: 'id' });
    if (error) console.error('Error categories:', error.message);
    else console.log(`✓ ${categories.length} categories insertadas.`);
  }

  // Units
  if (units?.length) {
    const { error } = await prodClient.from('warehouse_units').upsert(units, { onConflict: 'id' });
    if (error) console.error('Error units:', error.message);
    else console.log(`✓ ${units.length} units insertadas.`);
  }

  // Generar archivo SQL de respaldo
  const sqlExport = `
-- ============================================================================
-- VORA — Semilla de Datos Reales: Stunt Riders & Inv. Impacto
-- ============================================================================

-- Tenants
INSERT INTO tenants (id, commercial_name, legal_name, tax_id, slug, country, currency, timezone, commercial_status, technical_status)
VALUES
  ('d3ac2192-b6d7-48e3-8f0d-ee6c12dc3a9a', 'Stunt Riders', 'Stunt Riders C.A.', 'J-12345678-0', 'stunt-riders', 'VE', 'USD', 'America/Caracas', 'active', 'ready'),
  ('f87187a4-50a6-4b3e-bd20-f0d5e79d8a16', 'Inv. Impacto', 'Inversiones Impacto C.A.', 'J-87654321-0', 'inv-impacto', 'VE', 'USD', 'America/Caracas', 'active', 'ready')
ON CONFLICT (id) DO UPDATE SET
  commercial_name = EXCLUDED.commercial_name,
  slug = EXCLUDED.slug,
  commercial_status = EXCLUDED.commercial_status;

-- Branding Stunt Riders
INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, font_family)
VALUES ('d3ac2192-b6d7-48e3-8f0d-ee6c12dc3a9a', '#7a3333', '#1E6B4E', '#A9BEA5', 'Inter')
ON CONFLICT (tenant_id) DO UPDATE SET
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;

-- Branding Inv. Impacto
INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, font_family)
VALUES ('f87187a4-50a6-4b3e-bd20-f0d5e79d8a16', '#3c9f7b', '#1E6B4E', '#A9BEA5', 'Inter')
ON CONFLICT (tenant_id) DO UPDATE SET
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;
`;
  fs.writeFileSync(path.join(__dirname, '..', 'supabase', 'seed_prod_stunt_impacto.sql'), sqlExport.trim() + '\n', 'utf8');

  console.log('--- MIGRACION COMPLETADA CON EXITO ---');
}

sync().catch(err => {
  console.error('Fallo en sincronizacion:', err);
  process.exit(1);
});
