const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sent = [];
let fail = false;
let responseOk = true;
const env = {};
function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process: { env }, console: { error() {} }, AbortController, setTimeout, clearTimeout, fetch: async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); if (fail) throw new Error('private error'); sent.push({ ...JSON.parse(options.body), headers: options.headers }); return { ok: responseOk, json: async () => ({ id: 'provider-id' }) }; } })(
    name => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, mod, mod.exports);
  return mod.exports;
}
const mail = load('lib/demo-request-mail.ts', {});
const applicant = { full_name: 'Prueba', email: 'applicant@example.test', consent: true, interest: '<script>test</script>' };
async function main() {
  assert.equal(await mail.notifyDemoRequest(applicant, 'id-1'), 'not_configured');
  env.DEMO_REQUEST_FROM = 'VORA <avisos@notificaciones.example.test>'; env.RESEND_API_KEY = 'test-key';
  assert.equal(await mail.notifyDemoRequest(applicant, 'id-1'), 'accepted');
  assert.equal(sent[0].to.join(','), 'info@venesoftca.com');
  assert.equal(sent[0].from, env.DEMO_REQUEST_FROM);
  assert.equal(sent[0].reply_to, applicant.email); assert.equal(sent[0].headers['Idempotency-Key'], 'demo-request/id-1');
  assert.ok(sent[0].text.includes(applicant.interest));
  assert.equal(sent[0].html, undefined);
  fail = true;
  assert.equal(await mail.notifyDemoRequest(applicant, 'id-2'), 'failed');
  fail = false; responseOk = false; assert.equal(await mail.notifyDemoRequest(applicant, 'id-3'), 'failed');
  let stored = 0, notices = 0, dbFails = false;
  const route = load('app/api/demo-requests/route.ts', {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    zod: require('zod'),
    '@/lib/supabase-server': { getSupabaseServiceClient: () => ({ from: () => ({ insert: () => ({ select: () => ({ single: async () => { stored++; return dbFails ? { error: true } : { data: { id: 'saved' } }; } }) }) }) }) },
    '@/lib/demo-request-mail': { notifyDemoRequest: async () => { assert.ok(stored > 0); notices++; return 'failed'; } },
  });
  const request = data => ({ json: async () => data });
  assert.equal((await route.POST(request({ ...applicant, consent: false }))).status, 400);
  assert.equal(stored, 0);
  const saved = await route.POST(request(applicant));
  assert.equal(saved.status, 201); assert.equal(saved.body.notification, 'failed');
  assert.equal(notices, 1);
  dbFails = true;
  assert.equal((await route.POST(request(applicant))).status, 500);
  assert.equal(notices, 1);
  console.log('PASS: Resend configuration, fixed recipient, reply-to, plain text, provider and network failure, persistence before send, invalid input and database failure.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
