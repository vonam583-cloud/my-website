/* Test the actual worker in a deterministic VM; no browser or network is used. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'offline-assets.json'),'utf8'));
const results=[];
async function test(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(error){results.push({name,status:'FAIL',error:error.stack});}}
function fixture(workerSource=source){
 const handlers={},bins=new Map();let online=true,network=0,activated=0,claimed=0;
 class Cache{
  constructor(){this.items=new Map();}
  async put(key,response){this.items.set(typeof key==='string'?key:key.url,{body:Buffer.from(await response.arrayBuffer()),status:response.status,headers:Array.from(response.headers)});}
  async match(key){const r=this.items.get(typeof key==='string'?key:key.url);return r?new Response(r.body,{status:r.status,headers:r.headers}):undefined;}
 }
 const caches={async open(name){if(!bins.has(name))bins.set(name,new Cache());return bins.get(name);},async keys(){return [...bins.keys()];},async delete(name){return bins.delete(name);}};
 const context={URL,Request,Response,Set,Promise,Array,Error,encodeURIComponent,caches,
  self:{registration:{scope:'https://kene.example/project/'},location:{origin:'https://kene.example'},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{activated++;},addEventListener:(name,fn)=>handlers[name]=fn},
  fetch:async request=>{
   network++;if(!online)throw new Error('simulated offline');
   const url=new URL(typeof request==='string'?request:request.url),rel=decodeURIComponent(url.pathname.replace(/^\/project\//,''));
   const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return new Response('missing',{status:404});
   return new Response(fs.readFileSync(file),{status:200});
  }};
 vm.runInNewContext(workerSource,context);
 async function life(name){let task;handlers[name]({waitUntil:p=>task=p});return task;}
 async function get(rel,mode='cors',method='GET'){
  let promise;handlers.fetch({request:{url:rel.startsWith('https:')?rel:'https://kene.example/project/'+rel,mode,method},respondWith:p=>promise=p});
  return promise===undefined?undefined:await promise;
 }
 return {bins,caches,life,get,handlers,setOffline:()=>online=false,get network(){return network;},get activated(){return activated;},get claimed(){return claimed;}};
}
(async()=>{
 await test('Every precached public file exists and matches its recorded checksum',()=>{
  assert.ok(manifest.files.length>=150);
  for(const f of manifest.files){const b=fs.readFileSync(path.join(root,f.path));assert.equal(b.length,f.size,f.path);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256,f.path);}
 });
 const f=fixture();
 await test('Installation caches the complete public bundle before activation',async()=>{
  await f.life('install');assert.equal(f.activated,1);
  const cache=f.bins.values().next().value;assert.equal(cache.items.size,manifest.files.length);
 });
 await test('All twelve HTML pages remain readable when the simulated network is unavailable',async()=>{
  f.setOffline();const pages=manifest.files.filter(x=>/^html_.*\.html$/.test(x.path));assert.equal(pages.length,12);
  for(const file of pages){const response=await f.get(file.path,'navigate');assert.equal(response.status,200);assert.equal(await response.text(),fs.readFileSync(path.join(root,file.path),'utf8'));}
 });
 await test('Navigation parameters and the project root resolve to the correct cached HTML',async()=>{
  const a=await f.get('html_blog.html?post=bai-03','navigate');assert.equal(await a.text(),fs.readFileSync(path.join(root,'html_blog.html'),'utf8'));
  const b=await f.get('?ref=demo','navigate');assert.equal(await b.text(),fs.readFileSync(path.join(root,'index.html'),'utf8'));
 });
 await test('All 258 photo variants are available from cache without another network request',async()=>{
  const before=f.network,images=manifest.files.filter(x=>x.path.startsWith('img/photos/'));assert.equal(images.length,258);
  for(const image of images){const response=await f.get(image.path);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),image.sha256,image.path);}
  assert.equal(f.network,before);
 });
 await test('POST, external resources and future private APIs are not intercepted',async()=>{
  assert.equal(await f.get('html_blog.html','cors','POST'),undefined);
  assert.equal(await f.get('https://other.example/photo.jpg'),undefined);
  assert.equal(await f.get('api/personal-record'),undefined);
 });
 await test('Activation only clears older caches for this project scope',async()=>{
  const old='kene-public-v2-%2Fproject%2F-older',other='kene-public-v2-%2Fother%2F-older';
  await f.caches.open(old);await f.caches.open(other);await f.caches.open('other-app');await f.life('activate');
  assert.equal(f.bins.has(old),false);assert.equal(f.bins.has(other),true);assert.equal(f.bins.has('other-app'),true);assert.equal(f.claimed,1);
 });
 await test('A missing required asset aborts installation and removes the partial cache',async()=>{
  const src=source.replace(/const ASSETS = \[[^\n]*\];/,'const ASSETS = ["index.html","img/photos/__missing__.webp"];'),bad=fixture(src);
  await assert.rejects(()=>bad.life('install'));assert.equal(bad.activated,0);assert.equal(bad.bins.size,0);
 });
 await test('Responsive photo markup escapes alt text and provides an offline local fallback',()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ctx={window:{KENE:{escape:esc}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'js/kene-media-data.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(root,'js/kene-media.js'),'utf8'),ctx);
  const out=ctx.window.KENE.mediaImage('care-conversation','<img src=x onerror=alert(1)>');
  assert.ok(out.includes('sizes='));assert.ok(out.includes('960w'));assert.ok(out.includes('1920w'));assert.ok(out.includes('&lt;img'));assert.ok(!out.includes('src="https://'));
  assert.ok(ctx.window.KENE.mediaImage('unknown','sample').includes('img/scene-care.svg'));
 });
 const failed=results.filter(r=>r.status==='FAIL');
 fs.writeFileSync(path.join(__dirname,'offline-results.json'),JSON.stringify({passed:results.length-failed.length,total:results.length,results},null,2));
 console.log(JSON.stringify({passed:results.length-failed.length,total:results.length,failed},null,2));process.exitCode=failed.length?1:0;
})();
