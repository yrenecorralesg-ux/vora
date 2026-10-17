const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const filename = path.join(__dirname, '../lib/tenant-users.ts');
const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(module,exports){${js}\n})`, { filename })(
  mod,
  mod.exports,
);
const { resolveTenantUsers } = mod.exports;
const now = Date.parse('2026-10-17T15:00:00Z');
const member = {
  id: 'membership-1',
  tenant_id: 'company-a',
  auth_user_id: 'linked-user',
  role: 'tenant_admin',
  status: 'active',
  created_at: '2026-10-17T10:00:00Z',
};
const invite = {
  id: 'pending-1',
  email: 'pending@example.test',
  role: 'tenant_admin',
  status: 'pending',
  created_at: '2026-10-17T10:00:00Z',
  expires_at: '2026-10-24T10:00:00Z',
};
async function main() {
  const lookups = [];
  const users = await resolveTenantUsers(
    [member],
    [invite],
    async (id) => {
      lookups.push(id);
      return 'admin@example.test';
    },
    now,
  );
  assert.deepEqual(lookups, ['linked-user']);
  assert.equal(users[0].email, 'admin@example.test');
  assert.equal(users[0].kind, 'membership');
  assert.equal(users[1].email, 'pending@example.test');
  assert.equal(users[1].status, 'pending');
  assert.equal(users[1].auth_user_id, null);
  console.log(
    'PASS linked identities and pending assignments appear together without unrelated Auth lookups',
  );
  const failed = await resolveTenantUsers(
    [member],
    [],
    async () => {
      throw new Error('Auth unavailable');
    },
    now,
  );
  assert.equal(failed.length, 1);
  assert.equal(failed[0].status, 'active');
  assert.equal(failed[0].email, null);
  console.log(
    'PASS temporary Auth failure keeps the assigned administrator visible',
  );
  const stale = await resolveTenantUsers(
    [member],
    [{ ...invite, email: ' ADMIN@example.test ' }],
    async () => 'admin@example.test',
    now,
  );
  assert.equal(stale.length, 1);
  console.log(
    'PASS stale invitations do not duplicate an active administrator',
  );
  const expired = await resolveTenantUsers(
    [],
    [
      { ...invite, expires_at: '2026-10-10T10:00:00Z' },
      { ...invite, id: 'accepted', status: 'accepted' },
    ],
    async () => {
      throw new Error('Unexpected Auth lookup');
    },
    now,
  );
  assert.equal(expired.length, 1);
  assert.equal(expired[0].status, 'expired');
  console.log(
    'PASS expired assignments are marked correctly and accepted invitations are excluded',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
