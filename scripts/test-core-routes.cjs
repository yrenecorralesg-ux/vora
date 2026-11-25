const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.join(__dirname, '..');
let passed = 0;
function load(relative, mocks = {}) {
  const file = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const customRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks);
    if (name.startsWith('./') || name.startsWith('../')) return load(path.relative(root, path.join(path.dirname(file), name)) + '.ts', mocks);
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(customRequire, module, module.exports);
  return module.exports;
}
const rejectService = () => { throw new Error('Privileged client reached before authorization'); };
const anonymous = {
  '@/lib/auth': { requireSuperAdmin: async () => null, requireSession: async () => null, isSuperAdmin: async () => false },
  '@/lib/supabase-server': { getSupabaseServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }), getSupabaseServiceClient: rejectService },
};
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
async function main() {
  for (const [route, status] of [
    ['app/api/admin/tenants/[id]/features/route.ts',403],
    ['app/api/admin/tenants/[id]/config-permissions/route.ts',403],
    ['app/api/admin/tenants/[id]/setup/route.ts',403],
    ['app/api/admin/billing/route.ts',403],
    ['app/api/t/[slug]/modules/route.ts',401],
    ['app/api/t/[slug]/billing/route.ts',403],
  ]) await test(`anonymous GET blocked: ${route}`, async () => {
    const response = await load(route, anonymous).GET(new Request('https://vora.venesoftca.com/api/test'), { params: { id:'test',slug:'pepito' } });
    assert.equal(response.status,status);
  });
  for (const route of ['app/api/admin/tenants/route.ts','app/api/admin/billing/route.ts','app/api/admin/tenants/[id]/setup/route.ts']) {
    await test(`anonymous mutation blocked: ${route}`,async()=>{
      const response=await load(route,anonymous).POST(new Request('https://vora.venesoftca.com/api/test',{method:'POST',body:'{}'}),{params:{id:'test'}});
      assert.equal(response.status,403);
    });
  }
  // Every POS and Warehouse handler must reject anonymous calls before touching data.
  const tenantApiMocks = { ...anonymous, 'server-only': {}, '@/lib/pos-service': { posStore: {}, casheaProvider: {} } };
  const walk = (dir) => !fs.existsSync(path.join(root, dir)) ? [] : fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name === 'route.ts' ? [`${dir}/${e.name}`] : []);
  for (const route of [...walk('app/api/t/[slug]/pos'), ...walk('app/api/t/[slug]/warehouse')]) {
    const handlers = load(route, tenantApiMocks);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => handlers[m])) {
      await test(`anonymous ${method} blocked: ${route}`, async () => {
        const init = method === 'GET' ? {} : { method, body: '{}' };
        const r = await handlers[method](new NextRequest('https://vora.venesoftca.com/api/test', init), { params: { slug: 'pepito', id: 'x', saleId: 'x' } });
        assert.equal(r.status, 401);
      });
    }
  }
  const signed = { ...anonymous, '@/lib/auth':{...anonymous['@/lib/auth'],requireSuperAdmin:async()=>({id:'admin'})} };
  await test('reserved subdomain rejected before database access',async()=>{
    const r=await load('app/api/admin/tenants/route.ts',signed).POST(new Request('https://vora.venesoftca.com/api/admin/tenants',{method:'POST',body:JSON.stringify({commercial_name:'Admin',slug:'admin'})}));assert.equal(r.status,400);
  });
  await test('negative exchange rate rejected before privileged access',async()=>{
    const r=await load('app/api/admin/billing/route.ts',signed).POST(new Request('https://vora.venesoftca.com/api/admin/billing',{method:'POST',body:JSON.stringify({action:'rate',ves_per_usd:-1,source:'Test'})}));assert.equal(r.status,400);
  });
  const mwMocks = {'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user:{id:'signed'}}})}})}};
  const middleware=load('middleware.ts',mwMocks).middleware;
  await test('subdomain routes to the matching tenant',async()=>{
    const r=await middleware(new NextRequest('https://pepito.vora.venesoftca.com/products'));
    assert.equal(new URL(r.headers.get('x-middleware-rewrite')).pathname,'/t/pepito/products');
  });
  await test('subdomain cannot route to another company page or API',async()=>{
    assert.equal((await middleware(new NextRequest('https://pepito.vora.venesoftca.com/t/otra/customers'))).status,403);
    assert.equal((await middleware(new NextRequest('https://pepito.vora.venesoftca.com/api/t/otra/modules'))).status,403);
  });
  await test('unrecognized nested subdomain is rejected',async()=>{
    assert.equal((await middleware(new NextRequest('https://otra.pepito.vora.venesoftca.com/'))).status,404);
  });
  await test('client cannot forge the subscription path header',async()=>{
    const r=await middleware(new NextRequest('https://vora.venesoftca.com/t/pepito/products',{headers:{'x-vora-path':'/t/pepito/subscription','x-vora-preview':'1'}}));
    assert.equal(r.headers.get('x-middleware-request-x-vora-path'),'/t/pepito/products');
    assert.equal(r.headers.get('x-middleware-request-x-vora-preview'),'0');
  });
  await test('domain challenge is reachable before login',async()=>{
    const r=await middleware(new NextRequest('https://pepito.vora.venesoftca.com/api/tenant-domain-check'));
    assert.equal(r.headers.get('x-middleware-next'),'1');
  });
  await test('forged POS session cookie does not bypass login',async()=>{
    const anonMw=load('middleware.ts',{'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user:null}})}})}}).middleware;
    const r=await anonMw(new NextRequest('https://vora.venesoftca.com/t/pepito/pos',{headers:{cookie:'vora_pos_session=pepito'}}));
    assert.equal(r.status,307);
    assert.equal(new URL(r.headers.get('location')).pathname,'/t/pepito/login');
  });
  await test('tenant login and public branding stay reachable before login',async()=>{
    const anonMw=load('middleware.ts',{'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user:null}})}})}}).middleware;
    assert.equal((await anonMw(new NextRequest('https://vora.venesoftca.com/t/pepito/login'))).headers.get('x-middleware-next'),'1');
    assert.equal((await anonMw(new NextRequest('https://vora.venesoftca.com/api/t/pepito/branding'))).headers.get('x-middleware-next'),'1');
  });
  await tenantIsolationAndPermissionTests();
  await warehouseMvpTests();
  console.log(`${passed} route and middleware tests passed`);
}
/** Cliente Supabase simulado: filtra por .eq()/.in() y registra escrituras y RPC. */
function fakeDb(tables, calls = [], rpcResults = {}) {
  const builder = (table) => {
    const filters = [];
    const rows = () => (tables[table] || []).filter((r) => filters.every((fn) => fn(r)));
    let pending = null;
    const result = () => {
      if (pending) calls.push(pending);
      return rows();
    };
    const q = {
      select: () => q, order: () => q, limit: () => q, or: () => q,
      eq: (k, v) => { filters.push((r) => r[k] === v); return q; },
      neq: (k, v) => { filters.push((r) => r[k] !== v); return q; },
      in: (k, vs) => { filters.push((r) => vs.includes(r[k])); return q; },
      insert: (v) => { pending = ['insert', table, v]; return q; },
      upsert: (v) => { pending = ['upsert', table, v]; return q; },
      update: (v) => { pending = ['update', table, v]; return q; },
      delete: () => { pending = ['delete', table]; return q; },
      maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
      single: async () => ({ data: result()[0] ?? { id: 'new-row', created_at: '2026-11-21' }, error: null }),
      then: (ok, ko) => Promise.resolve({ data: result(), error: null }).then(ok, ko),
    };
    return q;
  };
  return {
    from: builder,
    rpc: async (fn, args) => {
      calls.push(['rpc', fn, args]);
      return rpcResults[fn] ?? { data: null, error: null };
    },
    auth: { admin: { getUserById: async (id) => ({ data: { user: { id, email: `${id}@test.local`, user_metadata: {} } } }) } },
  };
}

async function tenantIsolationAndPermissionTests() {
  const posServer = load('lib/pos/server.ts', { 'server-only': {} });
  const supervisorPinHash = posServer.hashPin('4826');
  const db = {
    tenants: [
      { id: 'tA', slug: 'empresa-a', commercial_name: 'Empresa A', commercial_status: 'active' },
      { id: 'tB', slug: 'empresa-b', commercial_name: 'Empresa B', commercial_status: 'active' },
    ],
    tenant_memberships: [
      { tenant_id: 'tA', auth_user_id: 'cajero-a', role: 'pos_cashier', status: 'active' },
      { tenant_id: 'tA', auth_user_id: 'super-a', role: 'pos_supervisor', status: 'active' },
      { tenant_id: 'tA', auth_user_id: 'almacen-a', role: 'wh_clerk', status: 'active' },
      { tenant_id: 'tB', auth_user_id: 'cajero-b', role: 'pos_cashier', status: 'active' },
    ],
    role_permissions: [
      { role_key: 'pos_cashier', permission: 'pos.sales.create', scope: 'tenant' },
      { role_key: 'pos_supervisor', permission: 'pos.sales.create', scope: 'tenant' },
      { role_key: 'pos_supervisor', permission: 'pos.refunds.approve', scope: 'tenant' },
      { role_key: 'pos_supervisor', permission: 'pos.sales.discount.override', scope: 'tenant' },
    ],
    tenant_features: [
      { tenant_id: 'tA', feature_key: 'commerce.pos', enabled: true, contracted: true, config: { catalog_source: 'pos' } },
      { tenant_id: 'tA', feature_key: 'warehouse.inventory', enabled: true, contracted: true, config: {} },
    ],
    warehouse_settings: [{ tenant_id: 'tA' }],
    pos_tenant_settings: [
      { tenant_id: 'tA', active_exchange_rate: 40, max_cashier_discount_percent: 5, allow_partial_payments: true,
        active_methods: ['efectivo', 'pago_movil', 'tarjeta', 'cashea'], internal_doc_prefix: 'COMP-INT-' },
    ],
    pos_products: [
      { id: 'prod-a', tenant_id: 'tA', sku: 'CAF-1', name: 'Café', price_usd: 10, tax_rate_percent: 16, is_service: false, status: 'disponible' },
    ],
    pos_sales: [
      { id: 'venta-a', tenant_id: 'tA', sale_number: 'VTA-0000001', created_at: '2026-11-21', metadata: {} },
      { id: 'venta-b', tenant_id: 'tB', sale_number: 'VTA-0000001', created_at: '2026-11-21', metadata: {} },
    ],
    pos_staff_pins: [{ tenant_id: 'tA', auth_user_id: 'super-a', pin_hash: supervisorPinHash, failed_attempts: 0, locked_until: null }],
  };
  const calls = [];
  const service = fakeDb(db, calls, {
    pos_record_sale: { data: { sale_id: 'venta-a', replay: false }, error: null },
    pos_record_return: { data: { return_id: 'dev-1' }, error: null },
  });
  const asUser = (id) => ({
    'server-only': {},
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/lib/auth': { requireSession: async () => ({ id, email: `${id}@test.local` }), isSuperAdmin: async () => false, requireSuperAdmin: async () => null },
    '@/lib/supabase-server': { getSupabaseServerClient: () => ({}), getSupabaseServiceClient: () => service },
  });
  const ctx = (slug) => ({ params: { slug } });
  const post = (body) => new NextRequest('https://vora.venesoftca.com/api/test', { method: 'POST', body: JSON.stringify(body) });
  const get = () => new NextRequest('https://vora.venesoftca.com/api/test');
  const salesRoute = (user) => load('app/api/t/[slug]/pos/sales/route.ts', asUser(user));
  const rpcCalls = (fn) => calls.filter(([k, name]) => k === 'rpc' && name === fn);

  await test('POS sales are read from Supabase filtered by the caller company', async () => {
    const asB = await salesRoute('cajero-b').GET(get(), ctx('empresa-b'));
    assert.equal(asB.status, 200);
    assert.deepEqual((await asB.json()).sales.map((s) => s.id), ['venta-b']);
    const asA = await salesRoute('cajero-a').GET(get(), ctx('empresa-a'));
    assert.deepEqual((await asA.json()).sales.map((s) => s.id), ['venta-a']);
  });
  await test('member of company A cannot read company B POS data', async () => {
    assert.equal((await salesRoute('cajero-a').GET(get(), ctx('empresa-b'))).status, 403);
  });
  await test('role without pos.sales.create cannot register POS sales', async () => {
    assert.equal((await salesRoute('almacen-a').POST(post({ lines: [] }), ctx('empresa-a'))).status, 403);
  });
  await test('the server prices the sale from the catalog, not from the browser', async () => {
    calls.length = 0;
    const r = await salesRoute('cajero-a').POST(post({
      idempotency_key: 'k1', shift_id: 'turno-1',
      lines: [{ productId: 'prod-a', quantity: 2, unitPriceUsd: 0.01, lineTotalUsd: 0.02 }],
      payments: [{ method: 'efectivo', currency: 'USD', amountReceived: 30, amountApplied: 23.2, changeAmount: 0 }],
    }), ctx('empresa-a'));
    assert.equal(r.status, 200);
    const [, , args] = rpcCalls('pos_record_sale')[0];
    assert.equal(args.p_tenant, 'tA');
    assert.equal(args.p_actor, 'cajero-a');
    assert.equal(args.p_sale.lines[0].unit_price_usd, 10);
    assert.equal(args.p_sale.total_usd, 23.2);
    assert.equal(args.p_sale.exchange_rate, 40);
  });
  await test('a cashier cannot give a discount above the limit without a supervisor authorization', async () => {
    calls.length = 0;
    const body = { idempotency_key: 'k2', shift_id: 'turno-1', lines: [{ productId: 'prod-a', quantity: 1, discountPercent: 50 }], payments: [] };
    assert.equal((await salesRoute('cajero-a').POST(post(body), ctx('empresa-a'))).status, 403);
    assert.equal(rpcCalls('pos_record_sale').length, 0);
    assert.equal((await salesRoute('super-a').POST(post({ ...body, idempotency_key: 'k3' }), ctx('empresa-a'))).status, 200);
  });
  await test('a product from another company is rejected before reaching the database function', async () => {
    calls.length = 0;
    const r = await salesRoute('cajero-b').POST(post({ idempotency_key: 'k4', shift_id: 't', lines: [{ productId: 'prod-a', quantity: 1 }], payments: [] }), ctx('empresa-b'));
    assert.equal(r.status, 400);
    assert.equal(rpcCalls('pos_record_sale').length, 0);
  });

  const returnsRoute = (user) => load('app/api/t/[slug]/pos/returns/route.ts', asUser(user));
  const returnBody = { original_sale_id: 'VTA-0000001', shift_id: 'turno-1', return_type: 'devolucion_parcial', reason: 'x', refund_method: 'efectivo_usd', lines: [] };
  await test('a cashier cannot approve a return by sending approved_by', async () => {
    calls.length = 0;
    const r = await returnsRoute('cajero-a').POST(post({ ...returnBody, approved_by: 'super-a' }), ctx('empresa-a'));
    assert.equal(r.status, 403);
    assert.equal(rpcCalls('pos_record_return').length, 0);
  });
  await test('a wrong supervisor PIN is rejected and counted', async () => {
    calls.length = 0;
    const r = await returnsRoute('cajero-a').POST(post({ ...returnBody, supervisor_id: 'super-a', supervisor_pin: '0000' }), ctx('empresa-a'));
    assert.equal(r.status, 403);
    assert.equal(rpcCalls('pos_record_return').length, 0);
    assert.ok(calls.some(([k, t, v]) => k === 'update' && t === 'pos_staff_pins' && v.failed_attempts === 1));
  });
  await test('the right supervisor PIN approves the return with the supervisor as approver', async () => {
    calls.length = 0;
    const r = await returnsRoute('cajero-a').POST(post({ ...returnBody, supervisor_id: 'super-a', supervisor_pin: '4826' }), ctx('empresa-a'));
    assert.equal(r.status, 200);
    const [, , args] = rpcCalls('pos_record_return')[0];
    assert.equal(args.p_return.approved_by, 'super-a');
    assert.equal(args.p_actor, 'cajero-a');
  });
  await test('POS quick-create cannot write Warehouse catalog/stock without warehouse permissions', async () => {
    db.tenant_features[0].config = { catalog_source: 'warehouse' };
    calls.length = 0;
    const r = await load('app/api/t/[slug]/pos/products/route.ts', asUser('cajero-a')).POST(
      post({ sku: 'X1', name: 'Prueba', price_usd: 5, initial_stock: 10, unit_cost: 2 }), ctx('empresa-a'));
    assert.equal(r.status, 403);
    assert.equal(calls.filter(([k, t]) => k === 'insert' && t === 'warehouse_items').length, 0);
    assert.equal(rpcCalls('warehouse_apply_movement').length, 0);
    db.tenant_features[0].config = { catalog_source: 'pos' };
  });
  await test('PIN hashes are salted and verified without storing the PIN', async () => {
    const a = posServer.hashPin('4826');
    assert.notEqual(a, posServer.hashPin('4826'));
    assert.ok(!a.includes('4826'));
    assert.equal(posServer.verifyPinHash('4826', a), true);
    assert.equal(posServer.verifyPinHash('4827', a), false);
    assert.throws(() => posServer.validatePinFormat('1111'), /predecible/);
    assert.throws(() => posServer.validatePinFormat('12'), /entre 4 y 8/);
  });

  await test('admin user creation never resets the password of an existing account', async () => {
    let passwordChanged = false;
    const adminService = fakeDb(db, []);
    adminService.auth = { admin: {
      // La cuenta existente está en la página 2: antes solo se leía la primera.
      listUsers: async ({ page }) => ({ data: { users: page === 1
        ? Array.from({ length: 1000 }, (_, i) => ({ id: `u${i}`, email: `u${i}@x.com` }))
        : [{ id: 'victima', email: 'Victima@Otra.com' }] }, error: null }),
      updateUserById: async () => { passwordChanged = true; return { error: null }; },
      createUser: async () => { throw new Error('no debe crear una cuenta duplicada'); },
    } };
    const route = load('app/api/admin/tenants/[id]/users/route.ts', {
      '@/lib/auth': { requireSuperAdmin: async () => ({ id: 'admin' }) },
      '@/lib/supabase-server': { getSupabaseServiceClient: () => adminService },
    });
    const r = await route.POST(new Request('https://vora.venesoftca.com/api/admin', { method: 'POST',
      body: JSON.stringify({ email: 'victima@otra.com', password: 'otraClave123', name: 'X', role: 'pos_cashier' }) }), { params: { id: 'tA' } });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.user.auth_user_id, 'victima');
    assert.equal(body.reused_existing_account, true);
    assert.equal(passwordChanged, false);
  });
}


async function warehouseMvpTests() {
  const db = {
    tenants: [{ id: 'tA', slug: 'empresa-a', commercial_name: 'Empresa A', commercial_status: 'active' }],
    tenant_memberships: [
      { tenant_id: 'tA', auth_user_id: 'admin-a', role: 'tenant_admin', status: 'active' },
      { tenant_id: 'tA', auth_user_id: 'clerk-a', role: 'wh_clerk', status: 'active' },
    ],
    role_permissions: [
      { role_key: 'wh_clerk', permission: 'stock.transfer', scope: 'tenant' },
      { role_key: 'wh_clerk', permission: 'stock.receive', scope: 'tenant' },
    ],
    tenant_features: [{ tenant_id: 'tA', feature_key: 'warehouse.inventory', enabled: true, contracted: true, config: {} }],
    warehouse_settings: [{ tenant_id: 'tA' }],
    tenant_role_matrix: [],
    warehouse_user_scopes: [{ tenant_id: 'tA', auth_user_id: 'clerk-a', warehouse_id: 'wh-1' }],
  };
  const calls = [];
  const service = fakeDb(db, calls);
  const asUser = (id) => ({
    'server-only': {},
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/lib/auth': { requireSession: async () => ({ id, email: `${id}@test.local` }), isSuperAdmin: async () => false, requireSuperAdmin: async () => null },
    '@/lib/supabase-server': { getSupabaseServerClient: () => ({}), getSupabaseServiceClient: () => service },
  });
  const post = (body) => new Request('https://vora.venesoftca.com/api/test', { method: 'POST', body: JSON.stringify(body) });
  const ctx = { params: { slug: 'empresa-a' } };

  await test('only the company admin can edit the warehouse role matrix', async () => {
    const route = (u) => load('app/api/t/[slug]/warehouse/roles/route.ts', asUser(u));
    const body = { action: 'set_role', role_key: 'wh_clerk', permissions: ['stock.receive'] };
    assert.equal((await route('clerk-a').POST(post(body), ctx)).status, 403);
    calls.length = 0;
    assert.equal((await route('admin-a').POST(post(body), ctx)).status, 200);
    assert.ok(calls.some(([k, t]) => k === 'upsert' && t === 'tenant_role_matrix'));
    assert.equal((await route('admin-a').POST(post({ ...body, permissions: ['pos.sales.create'] }), ctx)).status, 400);
    assert.equal((await route('admin-a').POST(post({ ...body, role_key: 'tenant_admin' }), ctx)).status, 400);
  });

  await test('the tenant role matrix replaces only the warehouse permissions of a role', async () => {
    const access = load('lib/warehouse/access.ts', asUser('clerk-a'));
    db.role_permissions.push({ role_key: 'wh_clerk', permission: 'pos.sales.create', scope: 'tenant' });
    db.tenant_role_matrix.push({ tenant_id: 'tA', role_key: 'wh_clerk', permissions: ['stock.issue'] });
    const perms = await access.resolveRolePermissions(service, 'tA', 'wh_clerk');
    assert.deepEqual(Array.from(perms).sort(), ['pos.sales.create', 'stock.issue']);
    db.tenant_role_matrix.length = 0;
    db.role_permissions.pop();
  });

  await test('a user limited to some warehouses cannot transfer from another one', async () => {
    const route = load('app/api/t/[slug]/warehouse/transfers/route.ts', asUser('clerk-a'));
    calls.length = 0;
    const line = [{ item_id: '00000000-0000-4000-8000-000000000001', quantity: 1 }];
    const key = '00000000-0000-4000-8000-0000000000aa';
    const r = await route.POST(post({ idempotency_key: key, from_warehouse_id: 'wh-2', to_warehouse_id: 'wh-1', lines: line }), ctx);
    assert.equal(r.status, 403);
    assert.equal(calls.filter(([k, fn]) => k === 'rpc' && fn === 'warehouse_ship_transfer').length, 0);
    const ok = await route.POST(post({ idempotency_key: key, from_warehouse_id: 'wh-1', to_warehouse_id: 'wh-2', lines: line }), ctx);
    assert.equal(ok.status, 201);
  });

  await test('anonymous PATCH blocked: app/api/admin/tenants/[id]/config-permissions/route.ts', async () => {
    const response = await load('app/api/admin/tenants/[id]/config-permissions/route.ts', anonymous).PATCH(
      new Request('https://vora.venesoftca.com/api/test', { method: 'PATCH', body: '{"allowed_roles":["tenant_admin"]}' }),
      { params: { id: 'test' } },
    );
    assert.equal(response.status, 403);
  });

  await test('custom config_allowed_roles controls pos.settings.manage and warehouse.configure', async () => {
    const tAuth = load('lib/tenant-api-auth.ts', asUser('clerk-a'));
    const access = load('lib/warehouse/access.ts', asUser('clerk-a'));
    db.tenant_features.push({
      tenant_id: 'tA',
      feature_key: 'crm.dashboard',
      enabled: true,
      contracted: true,
      config: { config_allowed_roles: ['tenant_admin', 'pos_supervisor'] },
    });
    assert.equal(await tAuth.hasTenantPermission({ tenantId: 'tA', userId: 'u1', role: 'pos_supervisor', email: null }, 'pos.settings.manage'), true);
    assert.equal(await tAuth.hasTenantPermission({ tenantId: 'tA', userId: 'u2', role: 'wh_manager', email: null }, 'pos.settings.manage'), false);
    assert.equal(await tAuth.hasTenantPermission({ tenantId: 'tA', userId: 'u3', role: 'tenant_admin', email: null }, 'pos.settings.manage'), true);
    const supPerms = await access.resolveRolePermissions(service, 'tA', 'pos_supervisor');
    const whMgrPerms = await access.resolveRolePermissions(service, 'tA', 'wh_manager');
    assert.equal(supPerms.has('warehouse.configure'), true);
    assert.equal(whMgrPerms.has('warehouse.configure'), false);
    db.tenant_features.pop();
  });

  await test('scheduled reports are due once per day on their configured day', async () => {
    const rs = load('lib/warehouse/report-schedules.ts', { ...asUser('admin-a'), '@/lib/resend-mail': { sendVoraMail: async () => 'accepted' } });
    // 2026-11-23 es lunes; 12:00 UTC = 08:00 en Caracas.
    const monday = new Date('2026-11-23T12:00:00Z');
    const base = { active: true, last_run_at: null, weekday: null, month_day: null };
    assert.equal(rs.isDue({ ...base, frequency: 'daily' }, monday), true);
    assert.equal(rs.isDue({ ...base, frequency: 'daily', last_run_at: '2026-11-23T11:05:00Z' }, monday), false);
    assert.equal(rs.isDue({ ...base, frequency: 'daily', last_run_at: '2026-11-22T11:05:00Z' }, monday), true);
    assert.equal(rs.isDue({ ...base, frequency: 'weekly', weekday: 1 }, monday), true);
    assert.equal(rs.isDue({ ...base, frequency: 'weekly', weekday: 2 }, monday), false);
    assert.equal(rs.isDue({ ...base, frequency: 'monthly', month_day: 23 }, monday), true);
    assert.equal(rs.isDue({ ...base, frequency: 'daily', active: false }, monday), false);
  });

  await test('the reports cron requires its secret', async () => {
    const route = load('app/api/cron/warehouse-reports/route.ts', { ...asUser('admin-a'), '@/lib/resend-mail': { sendVoraMail: async () => 'accepted' } });
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    assert.equal((await route.GET(new Request('https://x/api/cron/warehouse-reports'))).status, 503);
    process.env.CRON_SECRET = 's3cr3t-largo';
    assert.equal((await route.GET(new Request('https://x/api/cron/warehouse-reports', { headers: { authorization: 'Bearer otro' } }))).status, 401);
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });
}

main().catch(e=>{console.error(e);process.exitCode=1;});
