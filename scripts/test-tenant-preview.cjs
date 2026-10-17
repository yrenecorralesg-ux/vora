const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync(
  path.join(__dirname, '../lib/tenant-preview.ts'),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(module,exports){${js}\n})`)(mod, mod.exports);
const { canPreviewTenant, parseTenantBanners } = mod.exports;
assert.equal(canPreviewTenant(true, true, true), true);
assert.equal(canPreviewTenant(true, false, false), true);
assert.equal(canPreviewTenant(false, true, true), false);
assert.equal(canPreviewTenant(false, true, false), false);
assert.equal(canPreviewTenant(true, false, true), false);
console.log(
  'PASS only Super Admin can preview, including when also assigned as client administrator',
);
assert.deepEqual(
  parseTenantBanners(
    '{"header":"https://example.test/header.webp","sidebar":"https://example.test/sidebar.webp"}',
  ),
  {
    header: 'https://example.test/header.webp',
    sidebar: 'https://example.test/sidebar.webp',
  },
);
assert.deepEqual(parseTenantBanners('https://example.test/banner.webp'), {
  header: 'https://example.test/banner.webp',
  sidebar: null,
});
assert.deepEqual(parseTenantBanners(null), { header: null, sidebar: null });
assert.deepEqual(parseTenantBanners('{"header":{"invalid":true}}'), {
  header: null,
  sidebar: null,
});
console.log(
  'PASS configured header and sidebar images are read safely in both supported formats',
);
