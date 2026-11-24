const { createClient } = require('@supabase/supabase-js');

const devUrl = process.env.DEV_SUPABASE_URL || 'https://ilrbrpfyfzqpwdgklgmc.supabase.co';
const devKey = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const dev = createClient(devUrl, devKey);

const prodUrl = process.env.PROD_SUPABASE_URL || 'https://tadnasbbzxrudparnywt.supabase.co';
const prodKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
const prod = createClient(prodUrl, prodKey);

const STUNT_ID = 'd3ac2192-b6d7-48e3-8f0d-ee6c12dc3a9a';
const IMPACTO_ID = 'f87187a4-50a6-4b3e-bd20-f0d5e79d8a16';
const PASSWORD = 'Vora2026!';

const USERS = [
  // Inv. Impacto
  {
    email: 'supervisor.impacto@vora.test',
    fullName: 'Supervisor Impacto',
    commercialName: 'Inv. Impacto',
    tenantId: IMPACTO_ID,
    role: 'pos_supervisor',
  },
  {
    email: 'cajero.impacto@vora.test',
    fullName: 'Cajero Impacto',
    commercialName: 'Inv. Impacto',
    tenantId: IMPACTO_ID,
    role: 'pos_cashier',
  },
  {
    email: 'almacen.impacto@vora.test',
    fullName: 'Gerente Almacén Impacto',
    commercialName: 'Inv. Impacto',
    tenantId: IMPACTO_ID,
    role: 'wh_manager',
  },
  // Stunt Riders
  {
    email: 'almacen.stunt@vora.test',
    fullName: 'Gerente Almacén Stunt',
    commercialName: 'Stunt Riders',
    tenantId: STUNT_ID,
    role: 'wh_manager',
  },
];

async function setupClient(client, envName) {
  console.log(`\n=== CONFIGURANDO EN ${envName} ===`);

  // 1. Configurar features de Inv. Impacto clonadas de Stunt Riders si faltan
  const { data: stuntFeatures } = await client.from('tenant_features').select('*').eq('tenant_id', STUNT_ID);
  if (stuntFeatures && stuntFeatures.length > 0) {
    const impactoFeatures = stuntFeatures.map(f => ({
      ...f,
      id: undefined,
      tenant_id: IMPACTO_ID,
    }));
    const { error: errF } = await client.from('tenant_features').upsert(impactoFeatures, { onConflict: 'tenant_id,feature_key' });
    if (errF) console.warn('Aviso features impacto:', errF.message);
    else console.log(`✓ Features para Inv. Impacto (${stuntFeatures.length}) configuradas.`);
  }

  // 2. Configurar sede y caja para Inv. Impacto si faltan
  const { data: existingBranch } = await client.from('tenant_branches').select('id').eq('tenant_id', IMPACTO_ID).maybeSingle();
  let branchId = existingBranch?.id;
  if (!branchId) {
    const { data: newBranch, error: errB } = await client.from('tenant_branches').insert({
      tenant_id: IMPACTO_ID,
      code: 'SEDE-01',
      name: 'Sede Principal',
      is_primary: true,
      status: 'active',
      timezone: 'America/Caracas',
    }).select('id').single();
    if (!errB) {
      branchId = newBranch?.id;
      console.log('✓ Sede principal creada para Inv. Impacto.');
    }
  }

  if (branchId) {
    const { data: existingReg } = await client.from('pos_registers').select('id').eq('tenant_id', IMPACTO_ID).maybeSingle();
    if (!existingReg) {
      await client.from('pos_registers').insert({
        tenant_id: IMPACTO_ID,
        branch_id: branchId,
        code: 'CAJA-01',
        name: 'Caja 01 - Principal',
        status: 'active',
      });
      console.log('✓ Caja 01 creada para Inv. Impacto.');
    }
  }

  // 3. Configurar almacén y settings para Inv. Impacto si faltan
  const { data: existingWh } = await client.from('warehouse_warehouses').select('id').eq('tenant_id', IMPACTO_ID).limit(1);
  let whId = existingWh?.[0]?.id;
  if (!whId) {
    const { data: newWh } = await client.from('warehouse_warehouses').insert({
      tenant_id: IMPACTO_ID,
      code: 'ALM-01',
      name: 'Almacén Principal',
      is_active: true,
    }).select('id').single();
    whId = newWh?.id;
    console.log('✓ Almacén creado para Inv. Impacto.');
  }

  if (whId) {
    await client.from('warehouse_settings').upsert({
      tenant_id: IMPACTO_ID,
      default_warehouse_id: whId,
    }, { onConflict: 'tenant_id' });
  }

  // 4. Crear usuarios Auth y membresías
  for (const u of USERS) {
    let authUserId;
    const { data: { users } } = await client.auth.admin.listUsers();
    const found = users?.find(x => x.email?.toLowerCase() === u.email.toLowerCase());

    if (!found) {
      const { data: created, error: errC } = await client.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: u.fullName,
          commercial_name: u.commercialName,
        },
      });
      if (errC) {
        console.error(`Error creando ${u.email}:`, errC.message);
        continue;
      }
      authUserId = created.user.id;
      console.log(`✓ Creado usuario auth: ${u.email} (ID: ${authUserId})`);
    } else {
      authUserId = found.id;
      await client.auth.admin.updateUserById(authUserId, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: u.fullName,
          commercial_name: u.commercialName,
        },
      });
      console.log(`✓ Actualizado usuario auth: ${u.email} (ID: ${authUserId})`);
    }

    // Insertar/actualizar membresía
    const { error: errM } = await client.from('tenant_memberships').upsert({
      tenant_id: u.tenantId,
      auth_user_id: authUserId,
      role: u.role,
      status: 'active',
    }, { onConflict: 'tenant_id,auth_user_id' });

    if (errM) console.error(`Error membership para ${u.email}:`, errM.message);
    else console.log(`✓ Membresía asignada: ${u.email} -> ${u.role} en ${u.commercialName}`);
  }
}

async function main() {
  await setupClient(dev, 'DESARROLLO (ilrbrpfyfzqpwdgklgmc)');
  await setupClient(prod, 'PRODUCCIÓN (tadnasbbzxrudparnywt)');
  console.log('\n=== TODO CONFIGURADO EXITOSAMENTE ===');
}

main().catch(err => {
  console.error('Error general:', err);
  process.exit(1);
});
