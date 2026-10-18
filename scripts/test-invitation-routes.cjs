const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const { NextResponse, NextRequest } = require('next/server');
const id = '00000000-0000-0000-0000-000000000123';
const origin = 'https://vora.venesoftca.com';
let invitation, user, verified, updated, accepted, signedOut, rpcError;
function reset() {
  invitation = { id, email:'client@example.test', token_hash:'a'.repeat(64), status:'pending', expires_at:new Date(Date.now()+3600000).toISOString() };
  user = { id:'client', email:invitation.email, email_confirmed_at:new Date().toISOString() };
  verified=updated=accepted=signedOut=0; rpcError=null;
}
const client = { auth: {
  getUser:async()=>({data:{user}}),
  verifyOtp:async(params)=>{verified++; assert.equal(params.token_hash,invitation.token_hash); return {data:{user}};},
  signOut:async()=>{signedOut++;}, updateUser:async()=>{updated++; return {};},
}, rpc:async(name,args)=>{accepted++; assert.equal(name,'vora_accept_admin_invitation'); assert.equal(args.p_invitation,id); return {data:rpcError?null:'client-company',error:rpcError};} };
const service = { from: () => {const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:invitation})}; return q;} };
function load(file, extra={}) {
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod={exports:{}};
  const mocks={'next/server':{NextResponse},zod:require('zod'),'@/lib/supabase-server':{getSupabaseServerClient:()=>client,getSupabaseServiceClient:()=>service},...extra};
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name=>{if(name in mocks)return mocks[name];throw new Error(name);},mod,mod.exports);
  return mod.exports;
}
const activate=load('app/api/auth/activate/route.ts').POST;
const accept=load('app/api/auth/accept-invitation/route.ts').POST;
const req=(body,from=origin)=>new Request(origin+'/api/auth/test',{method:'POST',headers:{'Content-Type':'application/json',Origin:from},body:JSON.stringify(body)});
const payload=()=>({invitation:id,token_hash:invitation.token_hash,type:'invite'});
async function main(){
  reset(); assert.equal((await activate(req(payload(),'https://evil.test'))).status,403); assert.equal(verified,0);
  assert.equal((await activate(req({...payload(),type:'recovery'}))).status,400); assert.equal(verified,0);
  assert.equal((await activate(req({...payload(),token_hash:'b'.repeat(64)}))).status,400); assert.equal(verified,0);
  invitation.expires_at=new Date(0).toISOString(); assert.equal((await activate(req(payload()))).status,400); assert.equal(verified,0);
  reset(); user.email='other@example.test'; assert.equal((await activate(req(payload()))).status,400); assert.equal(signedOut,1);
  reset(); assert.equal((await activate(req(payload()))).status,200); assert.equal(verified,1);
  reset(); user=null; assert.equal((await accept(req({invitation:id,password:'a'.repeat(12)}))).status,401); assert.equal(updated,0);
  reset(); assert.equal((await accept(req({invitation:id,password:'short'}))).status,400); assert.equal(updated,0);
  reset(); user.email='other@example.test'; assert.equal((await accept(req({invitation:id,password:'a'.repeat(12)}))).status,403); assert.equal(updated,0);
  reset(); invitation.status='revoked'; assert.equal((await accept(req({invitation:id,password:'a'.repeat(12)}))).status,403); assert.equal(updated,0);
  reset(); const r=await accept(req({invitation:id,password:'a'.repeat(12),role:'super_admin',tenant_id:'other'})); assert.equal(r.status,200); assert.equal((await r.json()).destination,'/t/client-company'); assert.equal(updated,1); assert.equal(accepted,1);
  reset(); rpcError=true; assert.equal((await accept(req({invitation:id,password:'a'.repeat(12)}))).status,409);
  const denied=load('app/api/admin/tenants/[id]/membership/route.ts',{'@/lib/auth':{requireSuperAdmin:async()=>null},'@/lib/resend-mail':{},'@/lib/core-config':{VORA_DOMAIN:'vora.venesoftca.com'}}).POST;
  assert.equal((await denied(req({email:'client@example.test'}),{params:{id}})).status,403);
  console.log('13 invitation route security cases passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
