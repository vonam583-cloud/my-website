const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{webcrypto}=require('crypto');
const path=require('path');
const root=path.resolve(__dirname,'..');
const E=require(root+'/js/kene-engine.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(root+'/js/kene-data.js','utf8'),sandbox);
const D=JSON.parse(JSON.stringify(sandbox.window.KENE_DATA));
const results=[];
function storage(){const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};}
function fixture(){
 let now=Date.parse('2026-11-03T00:00:00Z'),seq=0;
 const store=storage(),repo=E.createRepository(D,store,()=>now,()=>String(++seq).padStart(7,'0'));
 const clear=()=>({allowed:true,adult:true,at:now});
 const item=(date='2026-11-05',hour=10,expertId='CG01',serviceId='ca-nhan')=>({serviceId,expertId,channel:'video',startMs:Date.parse(date+'T'+String(hour).padStart(2,'0')+':00:00+07:00')});
 return {repo,store,clear,item,setTime:ms=>now=ms,get now(){return now;}};
}
async function test(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.stack});}}
function throwsCode(fn,code){assert.throws(fn,e=>e.code===code);}
(async()=>{
 await test('PHQ-9/GAD-7: zero and maximum scores; missing answers rejected',()=>{
  assert.equal(E.screening(Array(9).fill(0),Array(7).fill(0),false).allowed,true);
  const high=E.screening(Array(9).fill(3),Array(7).fill(3),false);assert.equal(high.phq,27);assert.equal(high.gad,21);assert.equal(high.allowed,false);
  throwsCode(()=>E.screening([0],Array(7).fill(0),false),'SCREEN_INCOMPLETE');
  throwsCode(()=>E.screening(Array(9).fill(-1),Array(7).fill(0),false),'SCREEN_INCOMPLETE');
 });
 await test('Any positive PHQ item 9 blocks ordinary booking, including low total',()=>{
  const p=Array(9).fill(0);p[8]=1;assert.equal(E.screening(p,Array(7).fill(0),false).allowed,false);
  assert.equal(E.screening(Array(9).fill(0),Array(7).fill(0),true).allowed,false);
 });
 await test('Review thresholds do not silently diagnose or allow high scores',()=>{
  const p=Array(9).fill(2);p[0]=3;p[1]=3;p[8]=0;
  assert.equal(E.screening(Array(9).fill(0),[3,3,3,3,3,0,0],false).review,true);
  assert.equal(E.screening([3,3,3,3,3,3,2,0,0],Array(7).fill(0),false).review,true);
 });
 await test('Vietnam time boundaries for 15% discount',()=>{
  const f=fixture();
  assert.equal(E.isDaytime(f.item('2026-11-05',7).startMs,D.config),false);
  assert.equal(E.isDaytime(f.item('2026-11-05',8).startMs,D.config),true);
  assert.equal(E.isDaytime(f.item('2026-11-05',16).startMs,D.config),true);
  assert.equal(E.isDaytime(f.item('2026-11-05',17).startMs,D.config),false);
 });
 await test('No booking without adult/current safe intake; flags cannot pass checkout',()=>{
  const f=fixture();throwsCode(()=>f.repo.createHold('A',[f.item()],null),'SCREEN_REQUIRED');
  throwsCode(()=>f.repo.createHold('A',[f.item()],{...f.clear(),allowed:false}),'SCREEN_REQUIRED');
  throwsCode(()=>f.repo.createHold('A',[f.item()],{...f.clear(),adult:false}),'SCREEN_REQUIRED');
  throwsCode(()=>f.repo.createHold('A',[f.item()],{...f.clear(),at:f.now-86400001}),'SCREEN_REQUIRED');
 });
 await test('Prices come from service data, not cart injection',()=>{
  const f=fixture(),h=f.repo.createHold('A',[{...f.item(),price:1,sessions:999}],f.clear());
  assert.equal(h.items[0].price,400000);assert.equal(h.items[0].sessions,1);
  const order=f.repo.confirm('A',h.id,'',f.clear(),'card');assert.equal(order.total,400000);
 });
 await test('Unsupported service, expert, channel, date and non-hour start are rejected',()=>{
  const f=fixture();
  throwsCode(()=>f.repo.createHold('A',[f.item('2026-11-05',10,'CG99')],f.clear()),'INVALID_ITEM');
  throwsCode(()=>f.repo.createHold('A',[f.item('2026-11-05',10,'CG01','ke-nhanh')],f.clear()),'INVALID_ITEM');
  throwsCode(()=>f.repo.createHold('A',[{...f.item(),channel:'telepathy'}],f.clear()),'INVALID_ITEM');
  throwsCode(()=>f.repo.createHold('A',[{...f.item(),startMs:f.now-1}],f.clear()),'INVALID_TIME');
  throwsCode(()=>f.repo.createHold('A',[{...f.item(),startMs:f.item().startMs+60000}],f.clear()),'INVALID_TIME');
 });
 await test('A hold blocks another user and lasts exactly 10 minutes',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear());
  assert.equal(h.expiresAt-h.createdAt,600000);
  throwsCode(()=>f.repo.createHold('B',[f.item()],f.clear()),'SLOT_HELD');
  f.setTime(f.now+600000);assert.equal(f.repo.getHold('A',h.id),null);
  assert.ok(f.repo.createHold('B',[f.item()],f.clear()));
 });
 await test('Expired holds cannot become confirmed orders',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear());
  f.setTime(f.now+600001);
  throwsCode(()=>f.repo.confirm('A',h.id,'',f.clear(),'card'),'HOLD_EXPIRED');
  assert.equal(f.repo.orders('A').length,0);
 });
 await test('Confirmed appointment blocks later holds; different expert can serve another user',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear());f.repo.confirm('A',h.id,'',f.clear(),'card');
  throwsCode(()=>f.repo.createHold('B',[f.item()],f.clear()),'SLOT_TAKEN');
  assert.ok(f.repo.createHold('B',[f.item('2026-11-05',10,'CG02')],f.clear()));
  throwsCode(()=>f.repo.createHold('A',[f.item('2026-11-05',10,'CG03')],f.clear()),'SLOT_TAKEN');
 });
 await test('All-or-nothing hold creation and own conflicting cart appointments',()=>{
  const f=fixture();
  throwsCode(()=>f.repo.createHold('A',[f.item(),f.item('2026-11-05',10,'CG02')],f.clear()),'USER_CONFLICT');
  assert.equal(f.repo.read().holds.length,0);
 });
 await test('Coupon discounts eligible appointments only; package and evening excluded',()=>{
  const f=fixture(),items=[f.item(),f.item('2026-11-06',19,'CG02'),f.item('2026-11-07',10,'CG03','dong-hanh-6')];
  const h=f.repo.createHold('A',items,f.clear()),o=f.repo.confirm('A',h.id,'KENENGAY15',f.clear(),'wallet');
  assert.equal(o.subtotal,3200000);assert.equal(o.discount,60000);assert.equal(o.total,3140000);
  assert.equal(o.fee,0);
 });
 await test('Unknown, ineligible and previously used coupons rejected',()=>{
  const f=fixture();
  throwsCode(()=>f.repo.totals([f.item()],'NOTREAL','A'),'COUPON_UNKNOWN');
  throwsCode(()=>f.repo.totals([f.item('2026-11-05',19)],'KENENGAY15','A'),'COUPON_CONDITIONS');
  let h=f.repo.createHold('A',[f.item()],f.clear());f.repo.confirm('A',h.id,'KENENGAY15',f.clear(),'bank');
  h=f.repo.createHold('A',[f.item('2026-11-06',10)],f.clear());
  throwsCode(()=>f.repo.confirm('A',h.id,'KENENGAY15',f.clear(),'bank'),'COUPON_USED');
 });
 await test('Confirmation is idempotent and hold ownership is enforced',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear());
  throwsCode(()=>f.repo.confirm('B',h.id,'',f.clear(),'card'),'HOLD_EXPIRED');
  const o=f.repo.confirm('A',h.id,'',f.clear(),'card'),again=f.repo.confirm('A',h.id,'',f.clear(),'card');
  assert.equal(o.id,again.id);assert.equal(f.repo.orders('A').length,1);assert.equal(f.repo.orders('B').length,0);
 });
 await test('Safety flag rechecked at confirmation, not only during hold',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear());
  throwsCode(()=>f.repo.confirm('A',h.id,'',{...f.clear(),allowed:false},'card'),'SCREEN_REQUIRED');
  assert.equal(f.repo.orders('A').length,0);
 });
 await test('Reschedule is free before cutoff, collision-safe and owner-scoped',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear()),o=f.repo.confirm('A',h.id,'',f.clear(),'card'),a=o.appointments[0];
  throwsCode(()=>f.repo.reschedule('B',o.id,a.id,f.item('2026-11-06',10),f.clear()),'NOT_FOUND');
  const changed=f.repo.reschedule('A',o.id,a.id,f.item('2026-11-06',10),f.clear());assert.equal(changed.startMs,f.item('2026-11-06',10).startMs);
  assert.equal(f.repo.orders('A')[0].total,400000);assert.equal(changed.reschedules,1);
  f.setTime(changed.startMs-11*3600000);throwsCode(()=>f.repo.reschedule('A',o.id,a.id,f.item('2026-11-07',10),f.clear()),'LATE_CHANGE');
 });
 await test('Rescheduling cannot change a paid individual session into an unpaid package',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear()),o=f.repo.confirm('A',h.id,'',f.clear(),'card');
  const a=f.repo.reschedule('A',o.id,o.appointments[0].id,f.item('2026-11-06',10,'CG01','dong-hanh-6'),f.clear());
  assert.equal(a.serviceId,'ca-nhan');assert.equal(a.sessions,1);assert.equal(a.price,400000);
  assert.equal(f.repo.orders('A')[0].total,400000);
 });
 await test('Daytime-discount booking cannot silently become an evening-discount booking',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear()),o=f.repo.confirm('A',h.id,'KENENGAY15',f.clear(),'card');
  throwsCode(()=>f.repo.reschedule('A',o.id,o.appointments[0].id,f.item('2026-11-06',19),f.clear()),'DISCOUNT_TIME');
 });
 await test('Early cancellation releases slot; late cancellation awaits review',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear()),o=f.repo.confirm('A',h.id,'',f.clear(),'card');
  assert.equal(f.repo.cancel('A',o.id,o.appointments[0].id).status,'cancelled');
  assert.ok(f.repo.createHold('B',[f.item()],f.clear()));
  const g=fixture(),hh=g.repo.createHold('A',[g.item()],g.clear()),oo=g.repo.confirm('A',hh.id,'',g.clear(),'card');
  g.setTime(oo.appointments[0].startMs-3600000);
  assert.equal(g.repo.cancel('A',oo.id,oo.appointments[0].id).status,'cancellation_requested');
  throwsCode(()=>g.repo.createHold('B',[g.item()],g.clear()),'SLOT_TAKEN');
 });
 await test('Prepaid six-session package cannot be charged again or overbooked',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item('2026-11-05',10,'CG01','dong-hanh-6')],f.clear()),o=f.repo.confirm('A',h.id,'',f.clear(),'card');
  for(let i=6;i<=10;i++)f.repo.nextSession('A',o.id,0,f.item('2026-11-'+String(i).padStart(2,'0'),10),f.clear());
  assert.equal(f.repo.orders('A')[0].appointments.length,6);assert.equal(f.repo.orders('A')[0].total,2400000);
  throwsCode(()=>f.repo.nextSession('A',o.id,0,f.item('2026-11-11',10),f.clear()),'PACKAGE_FULL');
 });
 await test('Feedback requires elapsed appointment time and valid score',()=>{
  const f=fixture(),h=f.repo.createHold('A',[f.item()],f.clear()),o=f.repo.confirm('A',h.id,'',f.clear(),'card'),a=o.appointments[0];
  throwsCode(()=>f.repo.feedback('A',o.id,a.id,5),'NOT_FINISHED');
  f.setTime(a.startMs+50*60000);throwsCode(()=>f.repo.feedback('A',o.id,a.id,9),'INVALID_SCORE');
  assert.equal(f.repo.feedback('A',o.id,a.id,4).feedback.score,4);
 });
 await test('Deleting one demo account data does not delete another account orders',()=>{
  const f=fixture();for(const [u,day] of [['A','2026-11-05'],['B','2026-11-06']]){const h=f.repo.createHold(u,[f.item(day,10)],f.clear());f.repo.confirm(u,h.id,'',f.clear(),'card');}
  f.repo.removeUser('A');assert.equal(f.repo.orders('A').length,0);assert.equal(f.repo.orders('B').length,1);
 });
 await test('Expert weekly capacity never exceeds 25 confirmed or held sessions',()=>{
  const f=fixture();
  for(let i=0;i<25;i++){
   const day='2026-11-'+String(5+Math.floor(i/16)).padStart(2,'0'),hour=7+i%16;
   const h=f.repo.createHold('A',[f.item(day,hour)],f.clear());f.repo.confirm('A',h.id,'',f.clear(),'card');
  }
  throwsCode(()=>f.repo.createHold('B',[f.item('2026-11-06',16)],f.clear()),'WEEK_LIMIT');
 });
 await test('Valid hold can confirm inside final five minutes before appointment',()=>{
  const f=fixture(),item=f.item();f.setTime(item.startMs-10*60000);
  const h=f.repo.createHold('A',[item],f.clear());f.setTime(f.now+6*60000);
  assert.equal(f.repo.confirm('A',h.id,'',f.clear(),'card').total,400000);
 });
 // Isolated VM: no browser, network, real user account, or real credential is used.
 const local=storage(),sessionStore=storage(),listeners={};let chain=Promise.resolve();
 const context={window:{KENE_DATA:D,KeneEngine:E},localStorage:local,sessionStorage:sessionStore,crypto:webcrypto,
  TextEncoder,Uint8Array,Uint32Array,URL,URLSearchParams,Intl,Date,console,setTimeout,clearTimeout,
  CustomEvent:class{constructor(type){this.type=type;}},
  navigator:{locks:{request:(_,fn)=>{const next=chain.then(fn);chain=next.catch(()=>{});return next;}}},
  location:{href:'https://kene.example/html_dangnhap_dangky.html',origin:'https://kene.example',pathname:'/html_dangnhap_dangky.html',search:'',hash:''},
  document:{readyState:'loading',title:'Kể Nè',addEventListener:(n,f)=>listeners[n]=f,dispatchEvent:()=>{},querySelectorAll:()=>[],getElementById:()=>null}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/js/kene-core.js','utf8'),context);
 const K=context.window.KENE;let A,B,recovery;
 await test('Demo registration uses salted password derivation; no plaintext password stored',async()=>{
  const r=await K.register({nickname:'Tài khoản QA A',email:'qa-a@example.com',password:'DemoOnly1!',confirm:'DemoOnly1!',adult:true,terms:true});
  A=r.user;recovery=r.recovery;
  const raw=local.getItem('kene_demo_accounts_v1');assert.ok(!raw.includes('DemoOnly1!'));
  const a=JSON.parse(raw)[0];assert.equal(a.salt.length,32);assert.equal(a.pwHash.length,64);assert.ok(!raw.includes(recovery));
 });
 await test('Registration validates age, consent, password confirmation and duplicate email',async()=>{
  await assert.rejects(()=>K.register({nickname:'QA',email:'qa-new@example.com',password:'DemoOnly1!',confirm:'DemoOnly1!',adult:false,terms:true}));
  await assert.rejects(()=>K.register({nickname:'QA',email:'qa-new@example.com',password:'weak',confirm:'weak',adult:true,terms:true}));
  await assert.rejects(()=>K.register({nickname:'QA',email:'QA-A@EXAMPLE.COM',password:'DemoOnly1!',confirm:'DemoOnly1!',adult:true,terms:true}));
 });
 await test('Login rejects wrong passwords and isolates saved items and carts by account',async()=>{
  await assert.rejects(()=>K.login({email:'qa-a@example.com',password:'WrongOnly1!'}));
  await K.login({email:'qa-a@example.com',password:'DemoOnly1!'});K.saveProfile({wishlist:['ca-nhan']});K.saveCart([{serviceId:'ca-nhan'}]);
  B=(await K.register({nickname:'Tài khoản QA B',email:'qa-b@example.com',password:'DemoOnly2!',confirm:'DemoOnly2!',adult:true,terms:true})).user;
  assert.equal(K.cart().length,0);assert.equal(K.profile().wishlist.length,0);
  await K.login({email:'qa-a@example.com',password:'DemoOnly1!'});assert.equal(K.cart().length,1);assert.equal(K.profile().wishlist[0],'ca-nhan');
 });
 await test('Open redirects and HTML injection in user strings are prevented',()=>{
  assert.equal(K.safeNext('https://other.example/html_thongtin.html'),'html_thongtin.html');
  assert.equal(K.safeNext('javascript:alert(1)'),'html_thongtin.html');
  assert.equal(K.safeNext('html_thongtin.html?tab=bookings'),'html_thongtin.html?tab=bookings');
  assert.equal(K.escape('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');
 });
 await test('Password change checks existing secret; reset rotates recovery token',async()=>{
  await assert.rejects(()=>K.changePassword({old:'WrongOnly1!',password:'NewDemoOnly1!',confirm:'NewDemoOnly1!'}));
  await K.changePassword({old:'DemoOnly1!',password:'NewDemoOnly1!',confirm:'NewDemoOnly1!'});
  await assert.rejects(()=>K.login({email:'qa-a@example.com',password:'DemoOnly1!'}));
  await K.login({email:'qa-a@example.com',password:'NewDemoOnly1!'});
  const next=await K.resetPassword({email:'qa-a@example.com',recovery,password:'ResetDemoOnly1!',confirm:'ResetDemoOnly1!'});
  assert.notEqual(next,recovery);
  await assert.rejects(()=>K.resetPassword({email:'qa-a@example.com',recovery,password:'ResetDemoOnly2!',confirm:'ResetDemoOnly2!'}));
  await K.login({email:'qa-a@example.com',password:'ResetDemoOnly1!'});assert.equal(K.getUser().id,A.id);
 });
 await test('Clearing sensitive data removes saved scores and draft without bypassing the safety flag',()=>{
  const at=Date.now();
  K.saveClearance({allowed:false,adult:true,review:true,at,scores:{phq:8,gad:4},storeScore:true});
  K.write('kene_screen_draft',{answers:[1]},true);
  K.saveProfile({moods:[{score:3}],screenings:[{phq:8}],passport:{story:'Demo'}});
  K.clearSensitiveData();
  assert.equal(K.profile().moods.length,0);assert.equal(K.profile().screenings.length,0);
  assert.equal(Object.keys(K.profile().passport).length,0);
  assert.equal(K.clearance().scores,undefined);assert.equal(K.clearance().storeScore,undefined);
  assert.equal(K.clearance().allowed,false);assert.equal(K.clearance().at,at);
  assert.equal(sessionStore.getItem('kene_screen_draft'),null);
 });
 await test('Quiet mode restores the page title when disabled',()=>{
  context.document.title='Tài khoản | Kể Nè';K.saveProfile({quiet:true});K.syncHeader();
  assert.equal(context.document.title,'Không gian cá nhân');
  K.saveProfile({quiet:false});K.syncHeader();assert.equal(context.document.title,'Tài khoản | Kể Nè');
 });
 await test('Eight real team members and thirty unique mental-health/service articles',()=>{
  assert.equal(D.team.length,8);assert.equal(new Set(D.team.map(x=>x.id)).size,8);
  assert.equal(D.team[0].name,'Lưu Tố Anh');assert.equal(D.articles.length,30);
  assert.equal(new Set(D.articles.map(x=>x.id)).size,30);
  assert.equal(new Set(D.articles.map(x=>x.title)).size,30);
  assert.ok(D.articles.every(a=>a.paragraphs.length===3&&a.bullets.length===3));
  for(const t of D.topics)assert.ok(D.experts.filter(x=>x.topics.includes(t.id)).length>=3);
 });
 const failed=results.filter(x=>x.status==='FAIL');
 fs.writeFileSync(path.join(__dirname,'test-results.json'),JSON.stringify({passed:results.length-failed.length,total:results.length,results},null,2));
 console.log(JSON.stringify({passed:results.length-failed.length,total:results.length,failed},null,2));
 process.exitCode=failed.length?1:0;
})();
