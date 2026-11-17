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
  const tenantApiMocks = { ...anonymous, 'server-only': {}, '@/lib/pos-service': { posStore: {}, hkaProvider: {}, casheaProvider: {} } };
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
  console.log(`${passed} route and middleware tests passed`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
