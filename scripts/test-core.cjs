// Isolated PostgreSQL tests. Install @electric-sql/pglite in a temporary directory,
// then pass its absolute package path as argv[2]. No production connection is used.
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const root = join(__dirname, '..');
const admin = '00000000-0000-0000-0000-000000000001';
const alice = '00000000-0000-0000-0000-000000000002';
const bob = '00000000-0000-0000-0000-000000000003';
const extra = '00000000-0000-0000-0000-000000000004';
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function main() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
  // Replay the historical modular baseline, excluding the consolidated duplicate
  // (which includes legacy bootstrap data and an unsupported pgcrypto extension).
  const names = readdirSync(join(root, 'supabase/migrations'))
    .sort()
    .filter(
      (n) => n.endsWith('.sql') && n !== '20261006000000_initial_schema.sql',
    );
  for (const name of names) {
    try {
      await db.exec(
        readFileSync(join(root, 'supabase/migrations', name), 'utf8').replace(
          /^\uFEFF/,
          '',
        ),
      );
    } catch (e) {
      throw new Error(`${name}: ${e.message}`);
    }
  }
  await db.exec(
    'GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role; GRANT SELECT,INSERT,UPDATE,DELETE ON tenants,tenant_features,tenant_memberships,tenant_databases,tenant_domains,tenant_branding,plans,platform_user_roles,platform_roles,tenant_subscriptions,platform_audit_logs TO authenticated;',
  );
  await db.exec(
    `INSERT INTO platform_user_roles(user_id,role_id) SELECT '${admin}',id FROM platform_roles WHERE key='super_admin';`,
  );
  async function asUser(id, sql, args = []) {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${id}';`);
    try {
      return await db.query(sql, args);
    } finally {
      await db.exec('RESET ROLE; RESET request.jwt.claim.sub;');
    }
  }
  let t1, t2, ded, plan, inv, payment;
  await test('migration replay and minimal atomic Shared creation', async () => {
    t1 = (
      await asUser(
        admin,
        "SELECT vora_create_tenant('Pepito','pepito','shared') AS t",
      )
    ).rows[0].t;
    assert.equal(t1.currency, 'USD');
    assert.equal(t1.technical_status, 'pending_setup');
    assert.equal(
      (
        await db.query(
          'SELECT hostname,verification_status FROM tenant_domains WHERE tenant_id=$1',
          [t1.id],
        )
      ).rows[0].hostname,
      'pepito.vora.venesoftca.com',
    );
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM tenant_databases WHERE tenant_id=$1',
          [t1.id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          'SELECT primary_color FROM tenant_branding WHERE tenant_id=$1',
          [t1.id],
        )
      ).rows[0].primary_color,
      '#285C49',
    );
  });
  await test('duplicate and reserved subdomains rejected atomically', async () => {
    await assert.rejects(
      asUser(admin, "SELECT vora_create_tenant('Otro','pepito','shared')"),
    );
    await assert.rejects(
      asUser(admin, "SELECT vora_create_tenant('Admin','admin','shared')"),
    );
    const n = (
      await db.query(
        "SELECT count(*)::int AS n FROM tenants WHERE slug='pepito'",
      )
    ).rows[0].n;
    assert.equal(n, 1);
  });
  await test('ordinary user cannot create a tenant', async () => {
    await assert.rejects(
      asUser(alice, "SELECT vora_create_tenant('Intruso','intruso','shared')"),
    );
  });
  t2 = (
    await asUser(
      admin,
      "SELECT vora_create_tenant('Otra tienda','otra','shared') AS t",
    )
  ).rows[0].t;
  ded = (
    await asUser(
      admin,
      "SELECT vora_create_tenant('Enterprise','enterprise','dedicated') AS t",
    )
  ).rows[0].t;
  plan = (await db.query("SELECT id FROM plans WHERE name='Emprende'")).rows[0]
    .id;
  await test('Shared plan assignment and Dedicated mismatch rejection', async () => {
    await asUser(admin, 'SELECT vora_assign_plan($1,$2)', [t1.id, plan]);
    await assert.rejects(
      asUser(admin, 'SELECT vora_assign_plan($1,$2)', [ded.id, plan]),
    );
  });
  await db.query(
    'INSERT INTO tenant_memberships(tenant_id,auth_user_id) VALUES($1,$2),($3,$4)',
    [t1.id, alice, t2.id, bob],
  );
  await db.query('INSERT INTO tenant_workspaces(tenant_id) VALUES($1),($2)', [
    t1.id,
    t2.id,
  ]);
  await test('Shared workspace and tenant profile isolation enforced by RLS', async () => {
    assert.equal(
      (await asUser(alice, 'SELECT count(*)::int AS n FROM tenant_workspaces'))
        .rows[0].n,
      1,
    );
    assert.equal(
      (
        await asUser(
          alice,
          'SELECT count(*)::int AS n FROM tenant_workspaces WHERE tenant_id=$1',
          [t2.id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await asUser(
          alice,
          'SELECT count(*)::int AS n FROM tenants WHERE id=$1',
          [t2.id],
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      asUser(alice, 'INSERT INTO tenant_workspaces(tenant_id) VALUES($1)', [
        ded.id,
      ]),
    );
  });
  await test('plan user quota enforced in PostgreSQL', async () => {
    await db.query(
      'INSERT INTO tenant_memberships(tenant_id,auth_user_id) VALUES($1,$2)',
      [t1.id, extra],
    );
    await assert.rejects(
      db.query(
        'INSERT INTO tenant_memberships(tenant_id,auth_user_id) VALUES($1,gen_random_uuid())',
        [t1.id],
      ),
    );
  });
  await test('pending database does not prevent profile creation; readiness requires connection', async () => {
    assert.equal(
      (
        await asUser(admin, 'SELECT vora_validate_readiness($1) AS ready', [
          t1.id,
        ])
      ).rows[0].ready,
      false,
    );
    await db.query(
      "INSERT INTO tenant_databases(tenant_id,connection_status) VALUES($1,'connected')",
      [t1.id],
    );
    assert.equal(
      (
        await asUser(admin, 'SELECT vora_validate_readiness($1) AS ready', [
          t1.id,
        ])
      ).rows[0].ready,
      true,
    );
    assert.equal(
      (
        await db.query(
          'SELECT verification_status FROM tenant_domains WHERE tenant_id=$1',
          [t1.id],
        )
      ).rows[0].verification_status,
      'pending',
    );
  });
  await test('invoicing blocked without daily exchange rate and recipient', async () => {
    await assert.rejects(
      asUser(admin, "SELECT vora_issue_invoice($1,'2026-10-01')", [t1.id]),
    );
  });
  await db.exec(`INSERT INTO platform_exchange_rates(effective_date,ves_per_usd,source,created_by) VALUES((now() AT TIME ZONE 'America/Caracas')::date,50,'Test rate','${admin}');
 INSERT INTO platform_billing_settings(bank_code,phone,tax_id) VALUES('0102','04121234567','J-12345678-9');`);
  await test('invoice snapshots USD, rate, VES and recipient', async () => {
    inv = (
      await asUser(admin, "SELECT vora_issue_invoice($1,'2026-10-01') AS i", [
        t1.id,
      ])
    ).rows[0].i;
    assert.equal(Number(inv.amount_usd), 15);
    assert.equal(Number(inv.amount_ves), 750);
    assert.equal(Number(inv.ves_per_usd), 50);
    await db.exec(
      "UPDATE platform_billing_settings SET phone='04129999999'; UPDATE plans SET monthly_price_usd=20 WHERE name='Emprende';",
    );
    const stored = (
      await db.query('SELECT * FROM platform_invoices WHERE id=$1', [inv.id])
    ).rows[0];
    assert.equal(Number(stored.amount_usd), 15);
    assert.equal(stored.recipient.phone, '04121234567');
  });
  await test('duplicate or overlapping billing periods rejected', async () => {
    await assert.rejects(
      asUser(admin, "SELECT vora_issue_invoice($1,'2026-10-01')", [t1.id]),
    );
    await assert.rejects(
      asUser(admin, "SELECT vora_issue_invoice($1,'2026-10-15')", [t1.id]),
    );
  });
  await test('ordinary user cannot issue or read another company invoice', async () => {
    await assert.rejects(
      asUser(alice, "SELECT vora_issue_invoice($1,'2026-12-01')", [t1.id]),
    );
    assert.equal(
      (
        await asUser(
          bob,
          'SELECT count(*)::int AS n FROM platform_invoices WHERE id=$1',
          [inv.id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await asUser(
          alice,
          'SELECT count(*)::int AS n FROM platform_invoices WHERE id=$1',
          [inv.id],
        )
      ).rows[0].n,
      1,
    );
  });
  await test('cross-tenant payment foreign key and direct client writes rejected', async () => {
    const sql =
      "INSERT INTO platform_payment_reports(tenant_id,invoice_id,reference,bank_code,phone,paid_on,amount_ves,reported_by) VALUES($1,$2,'123456','0102','04121234567',current_date,750,$3)";
    await assert.rejects(db.query(sql, [t2.id, inv.id, bob]));
    await assert.rejects(asUser(alice, sql, [t1.id, inv.id, alice]));
  });
  payment = (
    await db.query(
      "INSERT INTO platform_payment_reports(tenant_id,invoice_id,reference,bank_code,phone,paid_on,amount_ves,reported_by) VALUES($1,$2,'123456','0102','04121234567',current_date,750,$3) RETURNING id",
      [t1.id, inv.id, alice],
    )
  ).rows[0].id;
  await test('reported payment stays pending until manual admin review', async () => {
    assert.equal(
      (
        await db.query('SELECT status FROM platform_invoices WHERE id=$1', [
          inv.id,
        ])
      ).rows[0].status,
      'pending',
    );
    await assert.rejects(
      asUser(alice, "SELECT vora_review_payment($1,true,'Confirmado')", [
        payment,
      ]),
    );
    await asUser(
      admin,
      "SELECT vora_review_payment($1,true,'Verificado en el banco')",
      [payment],
    );
    assert.equal(
      (
        await db.query('SELECT status FROM platform_invoices WHERE id=$1', [
          inv.id,
        ])
      ).rows[0].status,
      'paid',
    );
    assert.equal(
      (
        await db.query(
          'SELECT status FROM tenant_subscriptions WHERE tenant_id=$1',
          [t1.id],
        )
      ).rows[0].status,
      'active',
    );
    await assert.rejects(
      asUser(admin, "SELECT vora_review_payment($1,true,'Repetido')", [
        payment,
      ]),
    );
  });
  await test('rates cannot be overwritten from authenticated client', async () => {
    await assert.rejects(
      asUser(admin, 'UPDATE platform_exchange_rates SET ves_per_usd=1'),
    );
    assert.equal(
      (
        await db.query(
          'SELECT ves_per_usd FROM platform_exchange_rates LIMIT 1',
        )
      ).rows[0].ves_per_usd,
      '50.000000',
    );
  });
  let invitedTenant, invitation;
  await db.exec(`INSERT INTO auth.users VALUES('${alice}','alice@example.test',now()),('${bob}','bob@example.test',now()),('${extra}','unconfirmed@example.test',NULL);`);
  await test('only Super Admin prepares invitations; pending does not grant access', async () => {
    invitedTenant = (await asUser(admin,"SELECT vora_create_tenant('Invitaciones','invitaciones','shared') AS t")).rows[0].t;
    await asUser(admin,'SELECT vora_assign_plan($1,$2)',[invitedTenant.id,plan]);
    await assert.rejects(asUser(alice,'SELECT vora_prepare_admin_invitation($1,$2,$3)',[invitedTenant.id,'alice@example.test','a'.repeat(64)]));
    invitation=(await asUser(admin,'SELECT vora_prepare_admin_invitation($1,$2,$3) AS i',[invitedTenant.id,'alice@example.test','a'.repeat(64)])).rows[0].i;
    assert.equal((await asUser(alice,'SELECT id FROM tenants WHERE id=$1',[invitedTenant.id])).rows.length,0);
    assert.equal((await asUser(alice,'SELECT token_hash FROM tenant_invitations')).rows.length,0);
  });
  await test('another verified email cannot accept an invitation',async()=>{
    await assert.rejects(asUser(bob,'SELECT vora_accept_admin_invitation($1)',[invitation.id]));
  });
  await test('matching verified identity activates exactly the invited tenant',async()=>{
    assert.equal((await asUser(alice,'SELECT vora_accept_admin_invitation($1) AS slug',[invitation.id])).rows[0].slug,'invitaciones');
    assert.equal((await asUser(alice,'SELECT id FROM tenants WHERE id=$1',[invitedTenant.id])).rows.length,1);
    assert.equal((await asUser(alice,'SELECT token_hash FROM tenant_invitations')).rows.length,0);
    const member=(await db.query('SELECT role,status FROM tenant_memberships WHERE tenant_id=$1 AND auth_user_id=$2',[invitedTenant.id,alice])).rows[0];
    assert.equal(member.role,'tenant_admin'); assert.equal(member.status,'active');
    assert.equal((await db.query('SELECT count(*)::int n FROM platform_user_roles WHERE user_id=$1',[alice])).rows[0].n,0);
  });
  await test('acceptance is idempotent and does not revive a deactivated membership',async()=>{
    await asUser(alice,'SELECT vora_accept_admin_invitation($1)',[invitation.id]);
    await db.query("UPDATE tenant_memberships SET status='inactive' WHERE tenant_id=$1 AND auth_user_id=$2",[invitedTenant.id,alice]);
    await assert.rejects(asUser(alice,'SELECT vora_accept_admin_invitation($1)',[invitation.id]));
    await db.query("UPDATE tenant_memberships SET status='active' WHERE tenant_id=$1 AND auth_user_id=$2",[invitedTenant.id,alice]);
  });
  await test('expired, revoked and unconfirmed invitations cannot activate memberships',async()=>{
    const second=(await asUser(admin,'SELECT vora_prepare_admin_invitation($1,$2,$3) AS i',[invitedTenant.id,'bob@example.test','b'.repeat(64)])).rows[0].i;
    await db.query("UPDATE tenant_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1",[second.id]);
    await assert.rejects(asUser(bob,'SELECT vora_accept_admin_invitation($1)',[second.id]));
    await db.query("UPDATE tenant_invitations SET status='revoked',expires_at=now()+interval '1 hour' WHERE id=$1",[second.id]);
    await assert.rejects(asUser(bob,'SELECT vora_accept_admin_invitation($1)',[second.id]));
    const unconfirmed=(await asUser(admin,'SELECT vora_prepare_admin_invitation($1,$2,$3) AS i',[invitedTenant.id,'unconfirmed@example.test','c'.repeat(64)])).rows[0].i;
    await assert.rejects(asUser(extra,'SELECT vora_accept_admin_invitation($1)',[unconfirmed.id]));
  });
  await test('resend replaces the token and applies a cooldown after sending',async()=>{
    const fresh=(await asUser(admin,'SELECT vora_prepare_admin_invitation($1,$2,$3) AS i',[invitedTenant.id,'bob@example.test','d'.repeat(64)])).rows[0].i;
    assert.equal((await db.query('SELECT token_hash FROM tenant_invitations WHERE id=$1',[fresh.id])).rows[0].token_hash,'d'.repeat(64));
    await db.query("UPDATE tenant_invitations SET email_status='accepted',email_sent_at=now() WHERE id=$1",[fresh.id]);
    await assert.rejects(asUser(admin,'SELECT vora_prepare_admin_invitation($1,$2,$3)',[invitedTenant.id,'bob@example.test','e'.repeat(64)]));
    await asUser(bob,'SELECT vora_accept_admin_invitation($1)',[fresh.id]);
  });
  await test('user quotas also prevent activation of an already pending invitation',async()=>{
    await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[extra]);
    const pending=(await db.query("SELECT id FROM tenant_invitations WHERE tenant_id=$1 AND email='unconfirmed@example.test'",[invitedTenant.id])).rows[0];
    await assert.rejects(asUser(extra,'SELECT vora_accept_admin_invitation($1)',[pending.id]));
    assert.equal((await db.query('SELECT status FROM tenant_invitations WHERE id=$1',[pending.id])).rows[0].status,'pending');
  });
  await db.close();
  console.log(`${passed} PostgreSQL integration tests passed`);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
