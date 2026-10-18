const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const React=require('react');
let admin=false,member=true,ready=true,checks=0,deny=false;
const profile=()=>({id:'tenant-test',commercial_name:'test1',technical_status:ready?'ready':'pending_setup'});
const client={from(table){const data=table==='tenants'?profile():table==='tenant_memberships'?(member?{id:'member'}:null):table==='tenant_branding'?{primary_color:'#5c4428',logo_url:'/logo-test1.png'}:[{feature_key:'crm.dashboard',enabled:true,contracted:true,features:{name:'Resumen',description:'Panel'}}];const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data}),then:resolve=>Promise.resolve({data}).then(resolve)};return q;}};
function load(file,mocks){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const mod={exports:{}};vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);return mod.exports;}
const icons=new Proxy({},{get:()=>()=>null});
const helper={canPreviewTenant:(a,requested,m)=>a&&(requested||!m),parseTenantBanners:()=>({header:null})};
const preview=()=>null;
const page=load('app/t/[slug]/page.tsx',{
 '@/lib/auth':{requireSession:async()=>({id:'client'}),isSuperAdmin:async()=>admin},
 '@/lib/tenant-preview':helper,
 '@/components/tenant-dashboard-preview':{TenantDashboardPreview:preview},
 '@/lib/tenant-access':{requireTenantFeature:async(slug,key)=>{checks++;assert.equal(slug,'test1');assert.equal(key,'crm.dashboard');if(deny)throw new Error('denied');}},
 '@/lib/supabase-server':{getSupabaseServerClient:()=>client},'lucide-react':icons,
}).default;
async function main(){
 const args={params:{slug:'test1'},searchParams:{}};
 let result=await page(args);assert.equal(result.type,preview);assert.equal(result.props.name,'test1');assert.equal(result.props.canConfigure,false);assert.equal(result.props.preview,false);assert.equal(checks,1);
 assert.equal(result.props.primary,'#5c4428');assert.equal(result.props.logoUrl,'/logo-test1.png');
 deny=true;await assert.rejects(page(args));deny=false;
 ready=false;checks=0;result=await page(args);assert.notEqual(result.type,preview);assert.equal(checks,0);
 admin=true;result=await page({...args,searchParams:{preview:'1'}});assert.equal(result.type,preview);assert.equal(result.props.canConfigure,true);assert.equal(result.props.preview,true);
 const component=load('components/tenant-dashboard-preview.tsx',{'next/link':()=>null,'next/image':()=>null,'lucide-react':icons}).TenantDashboardPreview;
 const tree=component({...result.props,canConfigure:false,preview:false});const output=JSON.stringify(tree);assert.ok(!output.includes('/admin/tenants/'));assert.ok(!output.includes('Cada aroma'));assert.ok(!output.includes('$18,4'));assert.ok(output.includes('menú de tu empresa'));
 console.log('PASS client dashboard uses tenant branding and assignments, enforces feature access, preserves pending and admin preview, hides platform controls and legacy demo metrics');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
