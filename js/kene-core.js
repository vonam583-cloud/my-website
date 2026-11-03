/* Kể Nè — shared UI, local demo accounts and browser storage. */
(function () {
  'use strict';
  const D = window.KENE_DATA, E = window.KeneEngine;
  const K = window.KENE = {data:D, engine:E};
  const ACCOUNTS='kene_demo_accounts_v1', SESSION='kene_demo_session_v1';
  K.escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  K.fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
  K.money = value => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
  K.date = ms => new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(ms);
  K.shortDate = ms => new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short',day:'2-digit',month:'2-digit'}).format(ms);
  K.read = (key, fallback, session=false) => {
    try {const raw=(session?sessionStorage:localStorage).getItem(key);return raw===null?fallback:JSON.parse(raw);}
    catch (_) {return fallback;}
  };
  K.write = (key,value,session=false) => {
    try {(session?sessionStorage:localStorage).setItem(key,JSON.stringify(value));}
    catch (_) {throw new Error('Không thể lưu trên trình duyệt. Hãy kiểm tra dung lượng hoặc chế độ lưu trữ.');}
  };
  K.uid = prefix => prefix + '-' + crypto.getRandomValues(new Uint32Array(3)).join('-');
  K.repo = E.createRepository(D,localStorage);
  K.lock = async fn => navigator.locks ? navigator.locks.request('kene-booking-demo',fn) : fn();
  function accounts(){const a=K.read(ACCOUNTS,[]);return Array.isArray(a)?a:[];}
  function session(){return K.read(SESSION,null,true)||K.read(SESSION,null);}
  K.getUser = () => {
    const s=session();if(!s)return null;
    const a=accounts().find(x=>x.id===s.id && Array.isArray(x.sessions) && x.sessions.includes(s.token));
    return a ? {id:a.id,nickname:a.nickname,email:a.email} : null;
  };
  K.profile = () => {
    const u=K.getUser();if(!u)return null;
    const p=K.read('kene_profile_'+u.id,{});
    return {wishlist:[],vouchers:[],moods:[],screenings:[],passport:{},quiet:false,notifications:false,avatar:'',...p};
  };
  K.saveProfile = patch => {
    const u=K.getUser();if(!u)throw new Error('Cần đăng nhập tài khoản.');
    const p={...K.profile(),...patch};K.write('kene_profile_'+u.id,p);K.changed();return p;
  };
  K.cart = () => {const u=K.getUser();const a=K.read('kene_cart_'+(u?.id||'guest'),[]);return Array.isArray(a)?a:[];};
  K.saveCart = items => {
    const u=K.getUser();if(!u)throw new Error('Cần đăng nhập để lưu giỏ dịch vụ.');
    K.write('kene_cart_'+u.id,items);K.changed();
  };
  K.clearance = () => K.read('kene_screening_state',null,true);
  K.saveClearance = result => K.write('kene_screening_state',result,true);
  K.clearSensitiveData = () => {
    const clearance=K.clearance();
    if(clearance){
      const {scores,storeScore,...routing}=clearance;
      K.saveClearance(routing);
    }
    sessionStorage.removeItem('kene_screen_draft');
    K.saveProfile({moods:[],screenings:[],passport:{}});
  };
  K.safeNext = candidate => {
    try {
      const url=new URL(candidate||'html_thongtin.html',location.href);
      const allowed=new Set(['html_trangchu.html','html_gioithieu.html','html_dichvu.html','html_diadiem.html','html_blog.html','html_giohang.html','html_thanhtoan.html','html_thongtin.html','html_khuyenmaivatiepthi.html','html_lienhe_chinhsach.html','html_sitemap.html']);
      const leaf=url.pathname.split('/').pop();
      return url.origin===location.origin && allowed.has(leaf) ? leaf+url.search+url.hash : 'html_thongtin.html';
    } catch (_) {return 'html_thongtin.html';}
  };
  K.requireUser = next => {
    const u=K.getUser();if(u)return u;
    location.href='html_dangnhap_dangky.html?next='+encodeURIComponent(K.safeNext(next||location.pathname.split('/').pop()+location.search+location.hash));
    return null;
  };
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const unhex=text=>new Uint8Array(text.match(/.{2}/g).map(x=>parseInt(x,16)));
  async function digest(text) {return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));}
  async function hashPassword(password,salt) {
    if(!crypto.subtle)throw new Error('Hãy mở website qua localhost để dùng tài khoản.');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:120000,hash:'SHA-256'},key,256)));
  }
  K.validPassword=p=>typeof p==='string' && p.length>=8 && p.length<=128 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^a-zA-Z0-9]/.test(p);
  const validEmail=s=>typeof s==='string' && s.length<=150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  K.validEmail=validEmail;
  function setSession(account,remember) {
    const state={id:account.id,token:K.uid('session')};
    account.sessions=(account.sessions||[]).slice(-4).concat(state.token);
    const list=accounts().filter(a=>a.id!==account.id);list.push(account);K.write(ACCOUNTS,list);
    K.write(SESSION,state,true);
    if(remember)K.write(SESSION,state);else localStorage.removeItem(SESSION);
    K.changed();return K.getUser();
  }
  K.register = async values => {
    const email=String(values.email||'').trim().toLowerCase(),nickname=String(values.nickname||'').trim();
    if(!validEmail(email))throw new Error('Email chưa đúng định dạng.');
    if(nickname.length<2||nickname.length>50)throw new Error('Biệt danh cần từ 2 đến 50 ký tự.');
    if(!K.validPassword(values.password))throw new Error('Mật khẩu cần từ 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.');
    if(values.password!==values.confirm)throw new Error('Hai mật khẩu chưa trùng nhau.');
    if(!values.adult||!values.terms)throw new Error('Cần xác nhận từ 18 tuổi và đồng ý điều khoản phiên bản hiện tại.');
    const salt=hex(crypto.getRandomValues(new Uint8Array(16))),recovery=hex(crypto.getRandomValues(new Uint8Array(12)));
    const pwHash=await hashPassword(values.password,salt),recoveryHash=await digest(recovery);
    const user=await K.lock(()=>{
      const list=accounts();
      if(list.some(a=>a.email===email))throw new Error('Email này đã có tài khoản.');
      const a={id:K.uid('u'),email,nickname,salt,pwHash,recoveryHash,sessions:[],consent:{version:D.config.version,at:Date.now(),adult:true,terms:true}};
      list.push(a);K.write(ACCOUNTS,list);return setSession(a,false);
    });
    K.saveProfile({notifications:!!values.notifications});
    return {user,recovery};
  };
  K.login = async values => {
    const email=String(values.email||'').trim().toLowerCase(),a=accounts().find(a=>a.email===email);
    if(!a || await hashPassword(String(values.password||''),a.salt)!==a.pwHash)
      throw new Error('Email hoặc mật khẩu chưa đúng.');
    return K.lock(()=>setSession(a,!!values.remember));
  };
  K.updateIdentity = async values => {
    const u=K.getUser();if(!u)throw new Error('Cần đăng nhập.');
    const nickname=String(values.nickname||'').trim(),email=String(values.email||'').trim().toLowerCase();
    if(nickname.length<2||nickname.length>50||!validEmail(email))throw new Error('Kiểm tra lại biệt danh và email.');
    await K.lock(()=>{
      const list=accounts();if(list.some(a=>a.id!==u.id&&a.email===email))throw new Error('Email đã thuộc tài khoản khác.');
      const a=list.find(a=>a.id===u.id);a.nickname=nickname;a.email=email;K.write(ACCOUNTS,list);
    });
    K.saveProfile({quiet:!!values.quiet,notifications:!!values.notifications});
  };
  K.changePassword = async values => {
    const u=K.getUser(),a=accounts().find(a=>a.id===u?.id);
    if(!a)throw new Error('Cần đăng nhập.');
    if(await hashPassword(values.old,a.salt)!==a.pwHash)throw new Error('Mật khẩu hiện tại chưa đúng.');
    if(!K.validPassword(values.password)||values.password!==values.confirm)throw new Error('Mật khẩu mới chưa đủ điều kiện hoặc chưa trùng.');
    const salt=hex(crypto.getRandomValues(new Uint8Array(16))),pwHash=await hashPassword(values.password,salt);
    await K.lock(()=>{const list=accounts(),x=list.find(x=>x.id===u.id);x.salt=salt;x.pwHash=pwHash;K.write(ACCOUNTS,list);});
    K.toast('Đã đổi mật khẩu trên thiết bị.');
  };
  K.resetPassword = async values => {
    const email=String(values.email||'').trim().toLowerCase(),a=accounts().find(x=>x.email===email);
    if(!a || await digest(String(values.recovery||'').trim())!==a.recoveryHash)throw new Error('Email hoặc mã khôi phục chưa đúng.');
    if(!K.validPassword(values.password)||values.password!==values.confirm)throw new Error('Mật khẩu mới chưa đủ điều kiện hoặc chưa trùng.');
    const salt=hex(crypto.getRandomValues(new Uint8Array(16))),pwHash=await hashPassword(values.password,salt);
    const recovery=hex(crypto.getRandomValues(new Uint8Array(12))),recoveryHash=await digest(recovery);
    await K.lock(()=>{const list=accounts(),x=list.find(x=>x.id===a.id);Object.assign(x,{salt,pwHash,recoveryHash,sessions:[]});K.write(ACCOUNTS,list);});
    sessionStorage.removeItem(SESSION);localStorage.removeItem(SESSION);K.changed();return recovery;
  };
  K.logout = async () => {
    const u=K.getUser(),s=session();
    if(u)await K.lock(()=>{
      const list=accounts(),a=list.find(a=>a.id===u.id);a.sessions=(a.sessions||[]).filter(t=>t!==s.token);K.write(ACCOUNTS,list);
      const hold=K.read('kene_current_hold',null,true);if(hold)K.repo.releaseHold(u.id,hold);
    });
    sessionStorage.removeItem(SESSION);localStorage.removeItem(SESSION);
    ['kene_screening_state','kene_screen_draft','kene_current_hold'].forEach(k=>sessionStorage.removeItem(k));
    location.href='html_trangchu.html';
  };
  K.deleteAccount = async () => {
    const u=K.getUser();if(!u)throw new Error('Cần đăng nhập tài khoản muốn xoá.');
    await K.lock(()=>{
      K.repo.removeUser(u.id);
      K.write(ACCOUNTS,accounts().filter(a=>a.id!==u.id));
      localStorage.removeItem('kene_profile_'+u.id);localStorage.removeItem('kene_cart_'+u.id);
    });
    sessionStorage.removeItem(SESSION);localStorage.removeItem(SESSION);
    ['kene_screening_state','kene_screen_draft','kene_current_hold','kene_applied_voucher'].forEach(k=>sessionStorage.removeItem(k));
    location.href='html_trangchu.html';
  };
  K.changed = () => {
    K.syncHeader();document.dispatchEvent(new CustomEvent('kene:change'));
  };
  K.toggleWish = id => {
    if(!D.services.some(s=>s.id===id))return;
    if(!K.getUser()){K.requireUser();return;}
    const p=K.profile(),has=p.wishlist.includes(id);
    K.saveProfile({wishlist:has?p.wishlist.filter(x=>x!==id):p.wishlist.concat(id)});
    K.toast(has?'Đã bỏ khỏi danh sách lưu.':'Đã lưu dịch vụ.');
  };
  K.saveVoucher = id => {
    if(!K.getUser()){K.requireUser();return;}
    const c=D.coupons.find(c=>c.id===id&&c.kind==='discount');if(!c)return;
    const p=K.profile();if(!p.vouchers.includes(id))K.saveProfile({vouchers:p.vouchers.concat(id)});
    K.toast('Đã lưu mã và điều kiện sử dụng.');
  };
  K.recent = id => {
    if(!D.services.some(s=>s.id===id))return;
    const stored=K.read('kene_recent',[]),old=Array.isArray(stored)?stored:[];K.write('kene_recent',[id,...old.filter(x=>x!==id)].slice(0,4));
  };
  let normalTitle=document.title;
  K.syncHeader = () => {
    const u=K.getUser(),zone=document.getElementById('auth-zone'),cart=K.cart();
    if(zone){
      zone.innerHTML=u ? `<div class="dropdown kn-profile-menu"><button class="user-avatar-btn" id="kn-profile-toggle" aria-expanded="false" aria-label="Mở tài khoản">${K.escape(u.nickname.slice(0,1).toUpperCase())}</button><div class="dropdown-menu dropdown-menu-right" id="kn-profile-menu" hidden><a class="dropdown-item" href="html_thongtin.html">${K.escape(u.nickname)}</a><a class="dropdown-item" href="html_thongtin.html?tab=bookings">Lịch hẹn của tôi</a><button class="dropdown-item" data-action="logout">Đăng xuất</button></div></div>` :
        '<a class="nav-item nav-link mr-2 font-weight-bold" href="html_dangnhap_dangky.html?mode=register">Đăng ký</a><a class="btn btn-login font-weight-bold" href="html_dangnhap_dangky.html">Đăng nhập</a>';
    }
    document.querySelectorAll('#cart-badge,[data-cart-badge]').forEach(el=>{el.textContent=String(cart.length);el.style.display=cart.length?'flex':'none';});
    const wishlist=K.profile()?.wishlist||[];
    document.querySelectorAll('[data-wish]').forEach(el=>{
      const on=wishlist.includes(el.dataset.wish);el.setAttribute('aria-pressed',String(on));el.textContent=on?'♥':'♡';
    });
    if(K.profile()?.quiet){
      if(document.title!=='Không gian cá nhân')normalTitle=document.title;
      document.title='Không gian cá nhân';
    }else if(document.title==='Không gian cá nhân')document.title=normalTitle;
  };
  let toastTimer;
  K.toast = (message,ms=4500) => {
    const el=document.getElementById('kn-toast');if(!el)return;
    clearTimeout(toastTimer);el.textContent=String(message);el.hidden=false;
    toastTimer=setTimeout(()=>el.hidden=true,ms);
  };
  let lastFocus=null,modalCleanup=null,modalTicket=0,sosFocus=null;
  const canFocus=el=>!!(el&&el.isConnected&&el.getClientRects().length&&!el.disabled);
  const firstFocus=root=>root.querySelector('[autofocus],input:not([type="hidden"]),select,textarea,button,a[href],[tabindex="0"]');
  K.modal=(title,content,cleanup)=>{
    const modal=document.getElementById('kn-modal'),body=document.getElementById('kn-modal-body');if(!modal||!body)return null;
    if(modal.hidden&&canFocus(document.activeElement)&&!modal.contains(document.activeElement))lastFocus=document.activeElement;
    const previous=modalCleanup;modalCleanup=null;previous?.();modalCleanup=cleanup||null;const ticket=++modalTicket;
    document.getElementById('kn-modal-title').textContent=title;body.innerHTML=content;modal.hidden=false;document.body.classList.add('ke-overlay-open');document.body.style.overflow='hidden';
    requestAnimationFrame(()=>{if(ticket!==modalTicket||modal.hidden||!document.getElementById('kn-sos').hidden)return;if(body.contains(document.activeElement)&&canFocus(document.activeElement))return;(firstFocus(body)||modal.querySelector('[data-action="close-modal"]'))?.focus();});return body;
  };
  K.closeModal=()=>{modalTicket++;const cleanup=modalCleanup;modalCleanup=null;cleanup?.();document.getElementById('kn-modal').hidden=true;if(document.getElementById('kn-sos').hidden){document.body.style.overflow='';document.body.classList.remove('ke-overlay-open');if(canFocus(lastFocus))lastFocus.focus();}lastFocus=null;};
  K.sos=()=>{const modal=document.getElementById('kn-sos');if(modal.hidden)sosFocus=document.activeElement;modal.hidden=false;document.body.classList.add('ke-overlay-open');document.body.style.overflow='hidden';document.getElementById('kn-support-hours').textContent='Kể Nè không phải kênh cấp cứu. Đừng chờ phản hồi trên website khi bạn đang không an toàn.';modal.querySelector('a[href]')?.focus();};
  K.closeSos=()=>{document.getElementById('kn-sos').hidden=true;const other=document.getElementById('kn-modal');if(other.hidden){document.body.style.overflow='';document.body.classList.remove('ke-overlay-open');}if(canFocus(sosFocus))sosFocus.focus();else if(!other.hidden)firstFocus(document.getElementById('kn-modal-body'))?.focus();sosFocus=null;};
  K.copy = async text => {
    try {
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else {const a=document.createElement('textarea');a.value=text;a.style.position='fixed';a.style.opacity='0';document.body.append(a);a.select();if(!document.execCommand('copy'))throw new Error();a.remove();}
      K.toast('Đã sao chép.');
    } catch (_) {K.modal('Nội dung để sao chép',`<p><code>${K.escape(text)}</code></p><p>Bạn có thể chọn và sao chép thủ công.</p>`);}
  };
  K.download = (filename,content,type='application/json') => {
    const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  K.ics = (order,appointment) => {
    const utc=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const text=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ke Ne//Personal Demo Calendar//VI','CALSCALE:GREGORIAN','BEGIN:VEVENT',
      'UID:'+appointment.id+'@kene.example','DTSTAMP:'+utc(Date.now()),'DTSTART:'+utc(appointment.startMs),
      'DTEND:'+utc(appointment.startMs+appointment.minutes*60000),'SUMMARY:Lich hen ca nhan (mo phong)',
      'DESCRIPTION:Ban trinh dien. Khong co thong tin suc khoe hoac lien ket phong that.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
    K.download('lich-hen-'+appointment.id+'.ics',text,'text/calendar;charset=utf-8');
  };
  K.confetti = () => {
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||window.KENE_EXPERIENCE?.reduced?.())return;
    for(let i=0;i<30;i++){
      const p=document.createElement('i');p.className='kn-confetti';p.style.left=(Math.random()*100)+'vw';
      p.style.background=['#0077b6','#00b4d8','#1a1f6e','#d5edf5'][i%4];p.style.animationDelay=(Math.random()*.7)+'s';
      document.body.append(p);setTimeout(()=>p.remove(),3500);
    }
  };
  function searchResults(query) {
    const q=K.fold(query);if(q.length<2)return [];
    return [
      ...D.services.filter(s=>K.fold(s.name+' '+s.summary).includes(q)).map(s=>({name:s.name,kind:'Dịch vụ',href:'html_dichvu.html?id='+s.id})),
      ...D.topics.filter(t=>K.fold(t.name+' '+t.tags.join(' ')).includes(q)).map(t=>({name:t.name,kind:'Ghép nối',href:'html_diadiem.html?topic='+t.id})),
      ...D.articles.filter(p=>K.fold(p.title+' '+p.category).includes(q)).map(p=>({name:p.title,kind:'Góc đọc',href:'html_blog.html?post='+p.id}))
    ].slice(0,8);
  }
  K.searchResults=searchResults;
  function help() {
    K.modal('Trợ giúp thao tác',`<p>Trợ lý chỉ hướng dẫn sử dụng website, không tư vấn tâm lý. Website không có nhân viên trực.</p><div class="kn-help-options"><button class="kn-btn kn-btn-light" data-help="booking">Tôi bắt đầu đặt lịch thế nào?</button><button class="kn-btn kn-btn-light" data-help="price">Giá dịch vụ được tính ra sao?</button><button class="kn-btn kn-btn-light" data-help="privacy">Tôi xem hoặc xoá dữ liệu ở đâu?</button><button class="kn-btn kn-btn-light" data-help="change">Tôi cần đổi lịch</button></div><div id="kn-help-reply" class="kn-alert mt-3">Bạn có thể chọn một câu hỏi phía trên.</div>`);
  }
  function init() {
    K.syncHeader();
    const input=document.getElementById('header-search-inp'),dropdown=document.getElementById('header-dropdown');
    if(input&&dropdown){
      input.addEventListener('input',()=>{
        const list=searchResults(input.value);
        dropdown.innerHTML=list.length?list.map(x=>`<a class="kn-search-result" href="${x.href}"><small>${x.kind}</small><span>${K.escape(x.name)}</span></a>`).join(''):'<div class="p-3 kn-note">Gõ ít nhất hai ký tự để tìm kiếm; chưa có kết quả phù hợp.</div>';
        dropdown.style.display=input.value?'block':'none';
      });
      input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();location.href='html_dichvu.html?search='+encodeURIComponent(input.value);}if(e.key==='Escape')dropdown.style.display='none';});
      input.addEventListener('focus',()=>{if(input.value)input.dispatchEvent(new Event('input'));});
      document.addEventListener('click',e=>{if(!e.target.closest('.header-search-wrap'))dropdown.style.display='none';});
    }
    document.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input?.focus();}
      const overlay=!document.getElementById('kn-sos').hidden?document.getElementById('kn-sos'):
        !document.getElementById('kn-modal').hidden?document.getElementById('kn-modal'):null;
      if(e.key==='Escape'&&overlay){if(overlay.id==='kn-sos'){overlay.hidden=true;if(document.getElementById('kn-modal').hidden)document.body.style.overflow='';}else K.closeModal();}
      if(e.key==='Tab'&&overlay){
        const focusable=Array.from(overlay.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')).filter(x=>!x.disabled&&x.getClientRects().length);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    document.addEventListener('click',async e=>{
      const wish=e.target.closest('[data-wish]');if(wish){e.preventDefault();try{K.toggleWish(wish.dataset.wish);}catch(err){K.toast(err.message);}return;}
      const toggle=e.target.closest('#kn-profile-toggle');
      if(toggle){const menu=document.getElementById('kn-profile-menu');menu.hidden=!menu.hidden;menu.classList.toggle('show',!menu.hidden);toggle.setAttribute('aria-expanded',String(!menu.hidden));return;}
      if(!e.target.closest('.kn-profile-menu')){const menu=document.getElementById('kn-profile-menu');if(menu){menu.hidden=true;menu.classList.remove('show');}}
      const password=e.target.closest('[data-toggle-password]');
      if(password){const field=password.previousElementSibling;const show=field.type==='password';field.type=show?'text':'password';password.setAttribute('aria-label',show?'Ẩn mật khẩu':'Hiện mật khẩu');return;}
      const copy=e.target.closest('[data-copy]');if(copy){e.preventDefault();K.copy(copy.dataset.copy);return;}
      const save=e.target.closest('[data-save-voucher]');if(save){e.preventDefault();K.saveVoucher(save.dataset.saveVoucher);return;}
      const h=e.target.closest('[data-help]');
      if(h){
        const replies={booking:'Mở Sàng lọc miễn phí, trả lời câu hỏi an toàn, chọn chuyên gia và khung giờ rồi kiểm tra lưu yêu cầu.',price:'Giá tham khảo tham chiếu là 400.000đ/phiên 50 phút. Giá gói 6 buổi hiển thị cách tính minh hoạ; dịch vụ chưa chốt giá chỉ nhận yêu cầu.',privacy:'Đăng nhập rồi vào Tài khoản → Cài đặt & Quyền dữ liệu để tải hoặc xoá dữ liệu trên thiết bị.',change:'Vào Tài khoản → Lịch hẹn → Đổi lịch. Phiên bản hiện tại cho đổi trực tiếp khi còn ít nhất 12 giờ trước phiên.'};
        document.getElementById('kn-help-reply').textContent=replies[h.dataset.help]||'';return;
      }
      const button=e.target.closest('[data-action]');if(!button)return;
      const action=button.dataset.action;
      if(['sos','close-sos','close-modal','quick-exit','help','logout','cinema','copy-demo-payment'].includes(action)){
        e.preventDefault();
        if(action==='sos')K.sos();
        if(action==='close-sos')K.closeSos();
        if(action==='close-modal')K.closeModal();
        if(action==='quick-exit'){['kene_screening_state','kene_screen_draft'].forEach(k=>sessionStorage.removeItem(k));location.replace('about:blank');}
        if(action==='help')help();
        if(action==='logout')await K.logout();
        if(action==='cinema')K.modal('Hành trình Kể Nè','<div class="kn-video-frame"><iframe src="video/kene-intro.html" title="Giới thiệu hành trình Kể Nè"></iframe></div>');
        if(action==='copy-demo-payment')K.copy('KENE DEMO');
      }
    });
    document.querySelectorAll('.kn-newsletter').forEach(form=>form.addEventListener('submit',e=>{
      e.preventDefault();const email=form.querySelector('input').value.trim();
      if(!validEmail(email)){K.toast('Vui lòng kiểm tra email.');return;}
      try{K.write('kene_newsletter_demo',{email,at:Date.now(),consent:true});K.toast('Đã lưu lựa chọn trên thiết bị. Phiên bản hiện tại chưa gửi email.');form.reset();}catch(err){K.toast(err.message);}
    }));
    const back=document.getElementById('back-to-top');
    window.addEventListener('scroll',()=>{if(back)back.hidden=scrollY<500;},{passive:true});
    back?.addEventListener('click',()=>scrollTo({top:0,behavior:(window.KENE_EXPERIENCE?.reduced()?'auto':'smooth')}));
    window.addEventListener('storage',e=>{if(e.key?.startsWith('kene_'))K.changed();});
    document.querySelectorAll('.team-card').forEach(button=>{const front=button.querySelector('.tcard-front'),back=button.querySelector('.tcard-back');back?.setAttribute('aria-hidden','true');button.addEventListener('click',()=>{const on=button.classList.toggle('flipped');button.setAttribute('aria-pressed',String(on));front?.setAttribute('aria-hidden',String(on));back?.setAttribute('aria-hidden',String(!on));});});
    document.querySelectorAll('a[href]').forEach(a=>{
      if(a.getAttribute('href')===location.pathname.split('/').pop())a.setAttribute('aria-current','page');
    });
    if('IntersectionObserver' in window && !window.KENE_EXPERIENCE){
      const targets=document.querySelectorAll('.member-card,.team-card-wrap,.kn-step-card');
      const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        const el=entry.target;
        el.animate?.([{opacity:.4,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:500,delay:(Number(el.dataset.delay||0)%4)*80});
        observer.unobserve(el);
      }),{threshold:.1});targets.forEach(el=>observer.observe(el));
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
