// Pruebas de la persistencia del POS en PGlite (sin conexión a Supabase).
// Instala @electric-sql/pglite en un directorio temporal y pasa su ruta absoluta:
//   node scripts/test-pos.cjs <ruta>/node_modules/@electric-sql/pglite
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');

const root = join(__dirname, '..');
const admin = '00000000-0000-0000-0000-000000000001';
const cajera = '00000000-0000-0000-0000-000000000002';
const supervisor = '00000000-0000-0000-0000-000000000003';
const otraCajera = '00000000-0000-0000-0000-000000000004';
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
  const svc = (sql, args) => as('service_role', sql, args);
  const one = async (sql, args) => (await svc(sql, args)).rows[0];
  const num = async (sql, args) => Number(Object.values(await one(sql, args))[0]);

  const tA = (await as('authenticated', "SELECT vora_create_tenant('Alfa','alfa','shared')->>'id' AS id", [], admin)).rows[0].id;
  const tB = (await as('authenticated', "SELECT vora_create_tenant('Beta','beta','shared')->>'id' AS id", [], admin)).rows[0].id;

  // Sede, caja y catálogos de prueba.
  const branch = (await one("INSERT INTO tenant_branches(tenant_id,code,name) VALUES($1,'S1','Sede 1') RETURNING id", [tA])).id;
  const register = (await one("INSERT INTO pos_registers(tenant_id,branch_id,code,name) VALUES($1,$2,'C1','Caja 1') RETURNING id", [tA, branch])).id;
  const register2 = (await one("INSERT INTO pos_registers(tenant_id,branch_id,code,name) VALUES($1,$2,'C2','Caja 2') RETURNING id", [tA, branch])).id;
  const branchB = (await one("INSERT INTO tenant_branches(tenant_id,code,name) VALUES($1,'S1','Sede B') RETURNING id", [tB])).id;
  const registerB = (await one("INSERT INTO pos_registers(tenant_id,branch_id,code,name) VALUES($1,$2,'C1','Caja B') RETURNING id", [tB, branchB])).id;

  await svc('SELECT warehouse_bootstrap($1)', [tA]);
  const whA = (await one('SELECT default_warehouse_id AS id FROM warehouse_settings WHERE tenant_id=$1', [tA])).id;
  const und = (await one("SELECT id FROM warehouse_units WHERE tenant_id=$1 AND code='UND'", [tA])).id;
  const filtro = (await one("INSERT INTO warehouse_items(tenant_id,sku,name,item_type,unit_id,price_usd) VALUES($1,'REP-001','Filtro','physical',$2,10) RETURNING id", [tA, und])).id;
  await svc(`SELECT warehouse_apply_movement($1,$2,$3,'receipt',5,4,'on_hand',NULL,'test','INIT','carga','init:filtro',$4)`, [tA, filtro, whA, admin]);
  const cafe = (await one("INSERT INTO pos_products(tenant_id,branch_id,sku,name,category,price_usd,stock_quantity) VALUES($1,$2,'CAF-1','Café','Bebidas',2,3) RETURNING id", [tA, branch])).id;

  const whStock = async () => num('SELECT on_hand FROM warehouse_balances WHERE item_id=$1 AND warehouse_id=$2', [filtro, whA]);
  const openShift = (actor, reg = register, tenant = tA, br = branch) =>
    one('SELECT pos_open_shift($1,$2,$3,$4,$5,$6,$7,$8) AS id', [tenant, actor, br, reg, 'Cajera', 20, 100, null]).then((r) => r.id);
  const sale = (shift, extra = {}) => ({
    idempotency_key: randomUUID(), shift_id: shift, catalog_source: 'warehouse', track_stock: true,
    exchange_rate: 40, subtotal_usd: 10, discount_total_usd: 0, tax_total_usd: 1.6, total_usd: 11.6,
    total_ves: 464, paid_total_usd: 11.6, paid_total_ves: 464, balance_due_usd: 0, balance_due_ves: 0,
    payment_status: 'pagada',
    lines: [{ item_id: filtro, sku: 'REP-001', name: 'Filtro', quantity: 1, unit_price_usd: 10, tax_rate_percent: 16,
      tax_amount_usd: 1.6, line_subtotal_usd: 10, line_total_usd: 11.6 }],
    payments: [{ method: 'efectivo', currency: 'USD', amount_received: 20, amount_applied: 11.6, change_amount: 0 }],
    ...extra,
  });
  const record = (actor, payload, tenant = tA) =>
    one('SELECT pos_record_sale($1,$2,$3::jsonb) AS r', [tenant, actor, JSON.stringify(payload)]).then((r) => r.r);

  let shift;
  await test('a register admits only one open shift and one cashier cannot hold two', async () => {
    shift = await openShift(cajera);
    await assert.rejects(openShift(otraCajera), /ya tiene un turno abierto/);
    await assert.rejects(openShift(cajera, register2), /Ya tienes un turno abierto/);
    await assert.rejects(openShift(otraCajera, registerB), /no pertenece a la sede/);
    const s = await one('SELECT status, expected_totals FROM pos_shifts WHERE id=$1', [shift]);
    assert.equal(s.status, 'abierto');
    assert.equal(Number(s.expected_totals.efectivo_usd), 20);
  });

  await test('a sale persists header, lines, payments, document and Warehouse exit atomically', async () => {
    const r = await record(cajera, sale(shift));
    assert.equal(r.sale_number, 'VTA-0000001');
    assert.equal(r.document_number, 'COMP-INT-000001');
    assert.equal(await num('SELECT count(*) FROM pos_sale_lines WHERE sale_id=$1', [r.sale_id]), 1);
    assert.equal(await num('SELECT count(*) FROM pos_sale_payments WHERE sale_id=$1', [r.sale_id]), 1);
    assert.equal(await num('SELECT count(*) FROM pos_commercial_documents WHERE sale_id=$1', [r.sale_id]), 1);
    assert.equal(await whStock(), 4);
    const exp = (await one('SELECT expected_totals FROM pos_shifts WHERE id=$1', [shift])).expected_totals;
    assert.equal(Number(exp.efectivo_usd), 31.6);
  });

  await test('replaying the same idempotency key returns the same sale without moving stock again', async () => {
    const payload = sale(shift);
    const a = await record(cajera, payload);
    const b = await record(cajera, payload);
    assert.equal(b.replay, true);
    assert.equal(a.sale_id, b.sale_id);
    assert.equal(await whStock(), 3);
  });

  await test('selling beyond Warehouse stock fails and leaves no sale behind', async () => {
    const before = await num('SELECT count(*) FROM pos_sales WHERE tenant_id=$1', [tA]);
    const p = sale(shift);
    p.lines[0].quantity = 99;
    await assert.rejects(record(cajera, p), /Stock insuficiente/);
    assert.equal(await num('SELECT count(*) FROM pos_sales WHERE tenant_id=$1', [tA]), before);
    assert.equal(await whStock(), 3);
  });

  await test('only the shift owner can sell on it, and a closed shift rejects sales', async () => {
    await assert.rejects(record(otraCajera, sale(shift)), /otro cajero/);
    await assert.rejects(record(cajera, sale(shift), tB), /no existe o se encuentra cerrado/);
  });

  await test('POS catalog sales decrement pos_products and block overselling under strict policy', async () => {
    const p = sale(shift, {
      catalog_source: 'pos', stock_policy: 'strict_block',
      lines: [{ product_id: cafe, sku: 'CAF-1', name: 'Café', quantity: 2, unit_price_usd: 2, line_subtotal_usd: 4, line_total_usd: 4 }],
    });
    await record(cajera, p);
    assert.equal(await num('SELECT stock_quantity FROM pos_products WHERE id=$1', [cafe]), 1);
    assert.equal(await num("SELECT count(*) FROM pos_inventory_kardex WHERE product_id=$1 AND movement_type='venta_pos'", [cafe]), 1);
    const p2 = sale(shift, { catalog_source: 'pos', stock_policy: 'strict_block', lines: [{ ...p.lines[0], quantity: 5 }] });
    await assert.rejects(record(cajera, p2), /Stock insuficiente/);
    const p3 = sale(shift, { catalog_source: 'pos', stock_policy: 'warn_and_allow', lines: [{ ...p.lines[0], quantity: 2 }] });
    await record(cajera, p3);
    assert.equal(await num('SELECT stock_quantity FROM pos_products WHERE id=$1', [cafe]), -1);
  });

  await test('a product from another company cannot be sold', async () => {
    const otro = (await one("INSERT INTO tenant_branches(tenant_id,code,name) VALUES($1,'S9','X') RETURNING id", [tB])).id;
    const ajeno = (await one("INSERT INTO pos_products(tenant_id,branch_id,sku,name,category,price_usd,stock_quantity) VALUES($1,$2,'AJ-1','Ajeno','X',1,9) RETURNING id", [tB, otro])).id;
    const p = sale(shift, { catalog_source: 'pos', lines: [{ product_id: ajeno, sku: 'AJ-1', name: 'Ajeno', quantity: 1, unit_price_usd: 1, line_subtotal_usd: 1, line_total_usd: 1 }] });
    await assert.rejects(record(cajera, p), /no encontrado en el catálogo/);
  });

  await test('a discount authorization can be used once only', async () => {
    const auth = (await one(`INSERT INTO pos_authorizations(tenant_id,branch_id,shift_id,operation_type,requested_by,approved_by,reason,expires_at)
      VALUES($1,$2,$3,'discount_override',$4,$5,'cliente frecuente',now()+interval '10 minutes') RETURNING id`, [tA, branch, shift, cajera, supervisor])).id;
    await whStockSafe();
    await record(cajera, sale(shift, { discount_authorization_id: auth }));
    await assert.rejects(record(cajera, sale(shift, { discount_authorization_id: auth })), /ya fue usada/);
  });
  async function whStockSafe() {
    if ((await whStock()) < 2) await svc(`SELECT warehouse_apply_movement($1,$2,$3,'receipt',10,4,'on_hand',NULL,'test','R2','carga',$5,$4)`, [tA, filtro, whA, admin, randomUUID()]);
  }

  let returnable;
  await test('returns refund proportionally, restock sellable units and send damaged ones to the damaged bucket', async () => {
    await whStockSafe();
    const p = sale(shift);
    p.lines[0].quantity = 2;
    p.lines[0].line_subtotal_usd = 20; p.lines[0].tax_amount_usd = 3.2; p.lines[0].line_total_usd = 23.2;
    returnable = await record(cajera, p);
    const line = (await one('SELECT id FROM pos_sale_lines WHERE sale_id=$1', [returnable.sale_id])).id;
    const stockBefore = await whStock();
    const ret = (q, cond) => one('SELECT pos_record_return($1,$2,$3::jsonb) AS r', [tA, cajera, JSON.stringify({
      idempotency_key: randomUUID(), original_sale_id: returnable.sale_id, shift_id: shift, return_type: 'devolucion_parcial',
      reason: 'cliente', refund_method: 'efectivo_usd', approved_by: supervisor, track_stock: true,
      lines: [{ sale_line_id: line, quantity: q, condition: cond }] })]).then((r) => r.r);
    const r1 = await ret(1, 'sellable');
    assert.match(r1.return_number, /^DEV-/);
    assert.equal(await num('SELECT total_refunded_usd FROM pos_sale_returns WHERE id=$1', [r1.return_id]), 11.6);
    assert.equal(await whStock(), stockBefore + 1);
    assert.equal((await one('SELECT commercial_status FROM pos_sales WHERE id=$1', [returnable.sale_id])).commercial_status, 'parcialmente_devuelta');
    await ret(1, 'damaged');
    assert.equal(await whStock(), stockBefore + 1);
    assert.equal(await num('SELECT damaged FROM warehouse_balances WHERE item_id=$1 AND warehouse_id=$2', [filtro, whA]), 1);
    assert.equal((await one('SELECT commercial_status FROM pos_sales WHERE id=$1', [returnable.sale_id])).commercial_status, 'devuelta');
    await assert.rejects(ret(1, 'sellable'), /anulada o devuelta/);
  });

  await test('cash movements cannot withdraw more than expected cash', async () => {
    await assert.rejects(svc('SELECT pos_add_cash_movement($1,$2,$3,$4,$5,$6,$7,NULL)', [tA, cajera, shift, 'retiro_efectivo', 'USD', 100000, 'retiro']), /excede/);
    await svc('SELECT pos_add_cash_movement($1,$2,$3,$4,$5,$6,$7,NULL)', [tA, cajera, shift, 'retiro_efectivo', 'USD', 5, 'depósito banco']);
    assert.equal(await num("SELECT count(*) FROM pos_cash_movements WHERE shift_id=$1", [shift]), 1);
  });

  await test('credit sales accept payments up to the balance, once per idempotency key', async () => {
    await whStockSafe();
    const credit = await record(cajera, sale(shift, {
      paid_total_usd: 1.6, paid_total_ves: 64, balance_due_usd: 10, balance_due_ves: 400, payment_status: 'parcial',
      payments: [{ method: 'efectivo', currency: 'USD', amount_received: 1.6, amount_applied: 1.6, change_amount: 0 }],
    }));
    const pay = (amount, key = randomUUID()) => one('SELECT pos_record_debt_payment($1,$2,$3,$4,$5::jsonb) AS r', [tA, cajera, credit.sale_id, shift,
      JSON.stringify({ method: 'pago_movil', currency: 'VES', amount, idempotency_key: key })]).then((r) => r.r);
    const key = randomUUID();
    await pay(200, key);
    assert.equal((await pay(200, key)).replay, true);
    let s = await one('SELECT balance_due_usd::float AS b, payment_status FROM pos_sales WHERE id=$1', [credit.sale_id]);
    assert.equal(s.b, 5);
    assert.equal(s.payment_status, 'parcial');
    await pay(1000);
    s = await one('SELECT balance_due_usd::float AS b, payment_status FROM pos_sales WHERE id=$1', [credit.sale_id]);
    assert.equal(s.b, 0);
    assert.equal(s.payment_status, 'pagada');
    await assert.rejects(pay(10), /saldada/);
  });

  await test('closing with differences requires a justification, and a closed shift is final', async () => {
    const exp = (await one('SELECT expected_totals FROM pos_shifts WHERE id=$1', [shift])).expected_totals;
    const declared = { ...Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, Number(v)])), efectivo_usd: Number(exp.efectivo_usd) - 1 };
    await assert.rejects(svc('SELECT pos_close_shift($1,$2,$3,$4::jsonb,$5)', [tA, cajera, shift, JSON.stringify(declared), '']), /justificación/);
    const diffs = (await one('SELECT pos_close_shift($1,$2,$3,$4::jsonb,$5) AS d', [tA, cajera, shift, JSON.stringify(declared), 'faltante de 1 USD'])).d;
    assert.equal(Number(diffs.efectivo_usd), -1);
    await assert.rejects(svc('SELECT pos_close_shift($1,$2,$3,$4::jsonb,$5)', [tA, cajera, shift, '{}', 'otra vez']), /ya se encuentra cerrado/);
    await assert.rejects(record(cajera, sale(shift)), /no existe o se encuentra cerrado/);
  });

  await test('clients cannot call POS functions or read PINs', async () => {
    await assert.rejects(as('authenticated', 'SELECT pos_record_sale($1,$2,$3::jsonb)', [tA, cajera, '{}'], cajera), /permission denied/);
    await assert.rejects(as('authenticated', 'SELECT pos_open_shift($1,$2,$3,$4,$5,$6,$7,$8)', [tA, cajera, branch, register, 'x', 0, 0, null], cajera), /permission denied/);
    await assert.rejects(as('authenticated', 'SELECT * FROM pos_staff_pins', [], cajera), /permission denied/);
    await assert.rejects(as('anon', 'SELECT pos_close_shift($1,$2,$3,$4::jsonb,$5)', [tA, cajera, shift, '{}', 'x']), /permission denied/);
  });

  console.log(`${passed} POS persistence tests passed`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
