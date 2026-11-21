// Pruebas aisladas del núcleo Warehouse en PGlite (sin conexión a Supabase).
// Instala @electric-sql/pglite en un directorio temporal y pasa su ruta absoluta:
//   node scripts/test-warehouse.cjs <ruta>/node_modules/@electric-sql/pglite
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');

const root = join(__dirname, '..');
const admin = '00000000-0000-0000-0000-000000000001';
const alice = '00000000-0000-0000-0000-000000000002';
const bob = '00000000-0000-0000-0000-000000000003';
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
  const names = readdirSync(join(root, 'supabase/migrations'))
    .sort()
    .filter((n) => n.endsWith('.sql') && n !== '20261006000000_initial_schema.sql');
  for (const name of names) {
    try {
      await db.exec(readFileSync(join(root, 'supabase/migrations', name), 'utf8').replace(/^﻿/, ''));
    } catch (e) {
      throw new Error(`${name}: ${e.message}`);
    }
  }
  await db.exec(
    `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
     INSERT INTO platform_user_roles(user_id,role_id) SELECT '${admin}',id FROM platform_roles WHERE key='super_admin';`,
  );
  async function as(role, sql, args = [], sub = null) {
    await db.exec(`SET ROLE ${role};` + (sub ? ` SET request.jwt.claim.sub='${sub}';` : ''));
    try {
      return await db.query(sql, args);
    } finally {
      await db.exec('RESET ROLE; RESET request.jwt.claim.sub;');
    }
  }
  // Las rutas API llaman a las funciones con la clave service_role.
  const svc = (sql, args) => as('service_role', sql, args);
  const one = async (sql, args) => (await svc(sql, args)).rows[0];

  const tA = (await as('authenticated', "SELECT vora_create_tenant('Alfa','alfa','shared')->>'id' AS id", [], admin)).rows[0].id;
  const tB = (await as('authenticated', "SELECT vora_create_tenant('Beta','beta','shared')->>'id' AS id", [], admin)).rows[0].id;
  await db.query(
    `INSERT INTO tenant_memberships(tenant_id,auth_user_id,role,status) VALUES($1,$3,'wh_clerk','active'),($2,$4,'tenant_admin','active')`,
    [tA, tB, alice, bob],
  );

  let whA, und, kg, g, item, flour, service;
  const doc = async (tenant, payload, post = true) =>
    (await one('SELECT warehouse_create_document($1,$2,$3::jsonb,$4) AS id', [tenant, alice, JSON.stringify({ idempotency_key: randomUUID(), ...payload }), post])).id;
  const bal = async (itemId, wh = whA) =>
    (await one('SELECT on_hand::float AS on_hand, damaged::float AS damaged, avg_cost::float AS avg FROM warehouse_balances WHERE item_id=$1 AND warehouse_id=$2', [itemId, wh])) ?? { on_hand: 0, damaged: 0, avg: 0 };
  const moves = async (itemId) => (await one('SELECT count(*)::int AS n FROM warehouse_movements WHERE item_id=$1', [itemId])).n;

  await test('bootstrap creates settings, base units and main warehouse idempotently', async () => {
    await svc('SELECT warehouse_bootstrap($1)', [tA]);
    await svc('SELECT warehouse_bootstrap($1)', [tA]);
    await svc('SELECT warehouse_bootstrap($1)', [tB]);
    const s = await one('SELECT default_warehouse_id FROM warehouse_settings WHERE tenant_id=$1', [tA]);
    whA = s.default_warehouse_id;
    assert.ok(whA);
    assert.equal((await one('SELECT count(*)::int AS n FROM warehouse_warehouses WHERE tenant_id=$1', [tA])).n, 1);
    und = (await one("SELECT id FROM warehouse_units WHERE tenant_id=$1 AND code='UND'", [tA])).id;
    kg = (await one("SELECT id FROM warehouse_units WHERE tenant_id=$1 AND code='KG'", [tA])).id;
    g = (await one("SELECT id FROM warehouse_units WHERE tenant_id=$1 AND code='G'", [tA])).id;
    item = (await one("INSERT INTO warehouse_items(tenant_id,sku,name,item_type,unit_id) VALUES($1,'REP-001','Filtro de aceite','physical',$2) RETURNING id", [tA, und])).id;
    flour = (await one("INSERT INTO warehouse_items(tenant_id,sku,name,item_type,unit_id) VALUES($1,'HAR-001','Harina','weighted',$2) RETURNING id", [tA, kg])).id;
    service = (await one("INSERT INTO warehouse_items(tenant_id,sku,name,item_type,unit_id) VALUES($1,'SRV-001','Instalación','service',$2) RETURNING id", [tA, und])).id;
  });

  await test('receipts compute weighted average cost', async () => {
    await doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: item, quantity: 10, unit_cost: 5 }] });
    await doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: item, quantity: 10, unit_cost: 7 }] });
    const b = await bal(item);
    assert.equal(b.on_hand, 20);
    assert.equal(b.avg, 6);
  });

  await test('receipt in grams converts quantity and cost to the item unit (kg)', async () => {
    await doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: flour, quantity: 2500, unit_id: g, unit_cost: 0.002 }] });
    const b = await bal(flour);
    assert.equal(b.on_hand, 2.5);
    assert.equal(b.avg, 2);
    await assert.rejects(doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: item, quantity: 1, unit_id: g, unit_cost: 1 }] }), /convertible/);
  });

  await test('an issue larger than available stock fails and changes nothing', async () => {
    const before = await moves(item);
    await assert.rejects(
      doc(tA, { doc_type: 'issue', warehouse_id: whA, lines: [{ item_id: flour, quantity: 1 }, { item_id: item, quantity: 999 }] }),
      /Stock insuficiente/,
    );
    assert.equal((await bal(item)).on_hand, 20);
    assert.equal((await bal(flour)).on_hand, 2.5);
    assert.equal(await moves(item), before);
  });

  await test('issues keep the average cost and documents are idempotent', async () => {
    const key = randomUUID();
    const payload = JSON.stringify({ idempotency_key: key, doc_type: 'issue', warehouse_id: whA, reason: 'Consumo', lines: [{ item_id: item, quantity: 4 }] });
    const a = (await one('SELECT warehouse_create_document($1,$2,$3::jsonb,true) AS id', [tA, alice, payload])).id;
    const b = (await one('SELECT warehouse_create_document($1,$2,$3::jsonb,true) AS id', [tA, alice, payload])).id;
    assert.equal(a, b);
    const s = await bal(item);
    assert.equal(s.on_hand, 16);
    assert.equal(s.avg, 6);
  });

  await test('services and rental assets do not hold stock', async () => {
    await assert.rejects(doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: service, quantity: 1, unit_cost: 1 }] }), /no maneja existencias/);
  });

  await test('pending adjustment changes nothing until approved; approval sets stock to the count', async () => {
    const id = await doc(tA, { doc_type: 'adjustment', warehouse_id: whA, reason: 'Conteo', lines: [{ item_id: item, counted_qty: 13 }] }, false);
    assert.equal((await one('SELECT status FROM warehouse_documents WHERE id=$1', [id])).status, 'pending_approval');
    assert.equal((await bal(item)).on_hand, 16);
    await svc('SELECT warehouse_post_document($1,$2,$3)', [tA, id, admin]);
    const d = await one('SELECT status, decided_by FROM warehouse_documents WHERE id=$1', [id]);
    assert.equal(d.status, 'posted');
    assert.equal(d.decided_by, admin);
    assert.equal((await bal(item)).on_hand, 13);
    await assert.rejects(svc('SELECT warehouse_post_document($1,$2,$3)', [tA, id, admin]), /ya fue procesado/);
    const rej = await doc(tA, { doc_type: 'adjustment', warehouse_id: whA, lines: [{ item_id: item, counted_qty: 1 }] }, false);
    await svc("SELECT warehouse_reject_document($1,$2,$3,'No cuadra')", [tA, rej, admin]);
    assert.equal((await bal(item)).on_hand, 13);
  });

  await test('a damaged return never increases sellable stock', async () => {
    await doc(tA, { doc_type: 'return', warehouse_id: whA, reference: 'V-0001', lines: [{ item_id: item, quantity: 2, condition: 'damaged' }, { item_id: item, quantity: 1, condition: 'sellable' }] });
    const b = await bal(item);
    assert.equal(b.on_hand, 14);
    assert.equal(b.damaged, 2);
    await assert.rejects(doc(tA, { doc_type: 'return', warehouse_id: whA, lines: [{ item_id: item, quantity: 1 }] }), /condición/);
  });

  await test('reversal undoes a document once and is blocked when stock was consumed', async () => {
    const id = await doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: item, quantity: 5, unit_cost: 6 }] });
    assert.equal((await bal(item)).on_hand, 19);
    await svc("SELECT warehouse_reverse_document($1,$2,$3,'Error de digitación')", [tA, id, admin]);
    assert.equal((await bal(item)).on_hand, 14);
    await assert.rejects(svc("SELECT warehouse_reverse_document($1,$2,$3,'otra vez')", [tA, id, admin]), /contabilizados/);
    const big = await doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: flour, quantity: 1, unit_cost: 2 }] });
    await doc(tA, { doc_type: 'issue', warehouse_id: whA, lines: [{ item_id: flour, quantity: 3 }] });
    await assert.rejects(svc("SELECT warehouse_reverse_document($1,$2,$3,'tarde')", [tA, big, admin]), /Stock insuficiente/);
  });

  await test('movements are immutable', async () => {
    await assert.rejects(db.query('UPDATE warehouse_movements SET quantity=1'), /inmutables/);
    await assert.rejects(db.query('DELETE FROM warehouse_movements'), /inmutables/);
  });

  await test('a barcode identifies one item only', async () => {
    await svc("INSERT INTO warehouse_item_barcodes(tenant_id,item_id,code) VALUES($1,$2,'7890123456789')", [tA, item]);
    await assert.rejects(svc("INSERT INTO warehouse_item_barcodes(tenant_id,item_id,code) VALUES($1,$2,'7890123456789')", [tA, flour]));
  });

  await test('POS sale is idempotent, aggregates repeated SKUs and cannot oversell', async () => {
    const ev = (ref, lines, kind = 'sale') => svc('SELECT warehouse_register_pos_event($1,$2,$3::jsonb) AS n', [tA, alice, JSON.stringify({ kind, reference: ref, lines })]);
    await ev('V-100', [{ sku: 'REP-001', quantity: 2 }, { sku: 'REP-001', quantity: 1 }, { sku: 'SRV-001', quantity: 1 }]);
    await ev('V-100', [{ sku: 'REP-001', quantity: 2 }, { sku: 'REP-001', quantity: 1 }]);
    assert.equal((await bal(item)).on_hand, 11);
    await assert.rejects(ev('V-101', [{ sku: 'REP-001', quantity: 12 }]), /Stock insuficiente/);
    await ev('V-100', [{ sku: 'REP-001', quantity: 3 }], 'return');
    assert.equal((await bal(item)).on_hand, 14);
  });

  await test('an applied import cannot be applied twice nor re-imported', async () => {
    const sha = 'a'.repeat(64);
    const mk = async () => (await one(
      "INSERT INTO warehouse_import_jobs(tenant_id,operation,file_name,file_sha256,status,total_rows,valid_rows) VALUES($1,'initial_stock','stock.csv',$2,'validated',1,1) RETURNING id",
      [tA, sha])).id;
    const job = await mk();
    await svc("INSERT INTO warehouse_import_rows(tenant_id,job_id,row_number,action,data) VALUES($1,$2,2,'movement',$3::jsonb)",
      [tA, job, JSON.stringify({ item_id: flour, warehouse_id: whA, quantity: 10, unit_cost: 2 })]);
    const before = (await bal(flour)).on_hand;
    await svc('SELECT warehouse_apply_import($1,$2,$3,false)', [tA, job, alice]);
    assert.equal((await bal(flour)).on_hand, before + 10);
    await assert.rejects(svc('SELECT warehouse_apply_import($1,$2,$3,false)', [tA, job, alice]), /ya fue aplicada/);
    const again = await mk();
    await assert.rejects(svc('SELECT warehouse_apply_import($1,$2,$3,false)', [tA, again, alice]), /ya fue importado/);
    assert.equal((await bal(flour)).on_hand, before + 10);
  });

  await test('tenants are isolated by RLS and clients cannot write or call functions', async () => {
    assert.ok((await as('authenticated', 'SELECT count(*)::int AS n FROM warehouse_items', [], alice)).rows[0].n >= 3);
    assert.equal((await as('authenticated', 'SELECT count(*)::int AS n FROM warehouse_items', [], bob)).rows[0].n, 0);
    assert.equal((await as('authenticated', 'SELECT count(*)::int AS n FROM warehouse_movements WHERE tenant_id=$1', [tA], bob)).rows[0].n, 0);
    await assert.rejects(as('authenticated', "INSERT INTO warehouse_items(tenant_id,sku,name,item_type,unit_id) VALUES($1,'X','X','physical',$2)", [tA, und], alice));
    await assert.rejects(as('authenticated', 'SELECT warehouse_bootstrap($1)', [tA], alice));
    await assert.rejects(as('anon', 'SELECT count(*) FROM warehouse_balances'));
  });

  await test('a document cannot use another tenant\'s warehouse or item', async () => {
    const whB = (await one('SELECT default_warehouse_id AS id FROM warehouse_settings WHERE tenant_id=$1', [tB])).id;
    await assert.rejects(doc(tB, { doc_type: 'receipt', warehouse_id: whB, lines: [{ item_id: item, quantity: 1, unit_cost: 1 }] }), /no encontrado/);
    await assert.rejects(doc(tA, { doc_type: 'receipt', warehouse_id: whB, lines: [{ item_id: item, quantity: 1, unit_cost: 1 }] }), /Almacén no disponible/);
  });

  await test('a transfer moves stock to in-transit and the destination receives it at origin cost', async () => {
    const whB2 = (await one("INSERT INTO warehouse_warehouses(tenant_id,code,name) VALUES($1,'SUC-2','Sucursal 2') RETURNING id", [tA])).id;
    await doc(tA, { doc_type: 'receipt', warehouse_id: whA, lines: [{ item_id: item, quantity: 10, unit_cost: 6 }] });
    const before = await bal(item);
    const ship = (key, qty) => one('SELECT warehouse_ship_transfer($1,$2,$3::jsonb) AS id', [tA, alice, JSON.stringify({
      idempotency_key: key, from_warehouse_id: whA, to_warehouse_id: whB2, lines: [{ item_id: item, quantity: qty }] })]).then((r) => r.id);
    const key = randomUUID();
    const t1 = await ship(key, 4);
    assert.equal(await ship(key, 4), t1); // idempotente
    assert.equal((await bal(item)).on_hand, before.on_hand - 4);
    const dest = () => one('SELECT on_hand::float AS on_hand, in_transit::float AS in_transit, avg_cost::float AS avg FROM warehouse_balances WHERE item_id=$1 AND warehouse_id=$2', [item, whB2]);
    assert.deepEqual([(await dest()).on_hand, (await dest()).in_transit], [0, 4]);
    await svc('SELECT warehouse_close_transfer($1,$2,$3,$4)', [tA, admin, t1, 'receive']);
    const d = await dest();
    assert.deepEqual([d.on_hand, d.in_transit], [4, 0]);
    assert.ok(Math.abs(d.avg - before.avg) < 0.01, `costo destino ${d.avg} vs origen ${before.avg}`);
    await assert.rejects(svc('SELECT warehouse_close_transfer($1,$2,$3,$4)', [tA, admin, t1, 'cancel']), /ya fue cerrada/);
    // Cancelar devuelve al origen y libera el tránsito.
    const t2 = await ship(randomUUID(), 2);
    await svc('SELECT warehouse_close_transfer($1,$2,$3,$4)', [tA, admin, t2, 'cancel']);
    assert.equal((await dest()).in_transit, 0);
    assert.equal((await bal(item)).on_hand, before.on_hand - 4);
    // No se puede enviar más de lo disponible ni al mismo almacén.
    await assert.rejects(ship(randomUUID(), 100000), /Stock insuficiente/);
    await assert.rejects(one('SELECT warehouse_ship_transfer($1,$2,$3::jsonb) AS id', [tA, alice, JSON.stringify({
      idempotency_key: randomUUID(), from_warehouse_id: whA, to_warehouse_id: whA, lines: [{ item_id: item, quantity: 1 }] })]), /distintos/);
  });

  await test('new warehouse tables are readable only by members and functions only by the server', async () => {
    await assert.rejects(as('authenticated', 'SELECT warehouse_ship_transfer($1,$2,$3::jsonb)', [tA, alice, '{}'], alice), /permission denied/);
    await assert.rejects(as('authenticated', 'INSERT INTO tenant_role_matrix(tenant_id,role_key) VALUES($1,$2)', [tA, 'wh_clerk'], alice));
    assert.equal((await as('authenticated', 'SELECT count(*)::int AS n FROM warehouse_transfers', [], bob)).rows[0].n, 0);
    assert.ok((await as('authenticated', 'SELECT count(*)::int AS n FROM warehouse_transfers', [], alice)).rows[0].n >= 2);
  });

  console.log(`${passed} warehouse tests passed`);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
