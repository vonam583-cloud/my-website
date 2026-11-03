/* Kể Nè v2 — progressive, accessible motion and visual interactions. */
(function(){
  'use strict';
  const X=window.KENE_EXPERIENCE={version:'3.0.0'};
  const K=window.KENE,D=K.data,M=window.KENE_MEDIA;
  const $=s=>document.querySelector(s),all=(s,root)=>Array.from((root||document).querySelectorAll(s));
  const osMotion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
  const running=new Set(),seen=new WeakSet(),prepared=new WeakSet();
  let reduced=true,observer=null,mutationFrame=0,scrollFrame=0,carouselPaused=false;
  const pages=[
    ['html_trangchu.html','Trang chủ','home','care-conversation'],['html_gioithieu.html','Về Kể Nè','intro','care-hands'],
    ['html_dichvu.html','Dịch vụ & Bảng giá','services','care-notes'],['html_diadiem.html','Chuyên gia & Ghép nối','experts','friends-listen'],
    ['html_blog.html','Góc đọc','blog','journal-window'],['html_dangnhap_dangky.html','Đăng nhập / Đăng ký','auth','online-home'],
    ['html_giohang.html','Giỏ dịch vụ','cart','journal-planning'],['html_thanhtoan.html','Xem lại yêu cầu','checkout','privacy-laptop'],
    ['html_thongtin.html','Tài khoản của tôi','account','tea-notes'],['html_khuyenmaivatiepthi.html','Ưu đãi','promo','study-together'],
    ['html_lienhe_chinhsach.html','Liên hệ & Tin cậy','contact','mindful-room'],['html_sitemap.html','Sơ đồ website','sitemap','leaves-light']
  ];
  const readArray=key=>{const value=K.read(key,[]);return Array.isArray(value)?value:[];};
  let compare=readArray('kene_compare_services_v2').filter(id=>D.services.some(s=>s.id===id)).slice(0,3);
  let saved=readArray('kene_saved_articles_v2').filter(id=>D.articles.some(a=>a.id===id));
  function animate(el,frames,options){
    if(reduced||!el||!el.animate)return null;
    const a=el.animate(frames,Object.assign({duration:560,easing:'cubic-bezier(.2,.7,.25,1)'},options));
    running.add(a);a.finished.catch(()=>{}).finally(()=>running.delete(a));return a;
  }
  function motion(){
    reduced=osMotion.matches||K.read('kene_reduce_motion_v2',false)===true;
    document.documentElement.classList.toggle('ke-reduced-motion',reduced);
    if(reduced){running.forEach(a=>a.cancel());running.clear();}
    all('[data-ke-motion]').forEach(b=>{b.setAttribute('aria-pressed',String(reduced));b.textContent=reduced?'Chuyển động: Đã giảm':'Chuyển động: Êm dịu';b.disabled=osMotion.matches;});
    X.carouselMotion?.();document.dispatchEvent(new CustomEvent('kene:motion',{detail:{reduced}}));
  }
  function observe(){
    all('.ke-reveal,.kn-step-card,.team-card-wrap,.member-card,.ke-visual-card').forEach(el=>{
      if(seen.has(el))return;seen.add(el);
      if(observer)observer.observe(el);
    });
  }
  function imageState(img){
    if(prepared.has(img))return;prepared.add(img);
    const holder=img.closest('.ke-picture');if(!holder)return;
    function loaded(){holder.classList.remove('ke-loading');if(img.naturalWidth)animate(img,[{filter:'blur(4px)',opacity:.65},{filter:'blur(0)',opacity:1}],{duration:260});}
    function fallback(){
      if(img.dataset.keFallback)return;img.dataset.keFallback='1';
      all('source',holder).forEach(s=>s.remove());img.removeAttribute('srcset');img.src='img/scene-care.svg';
      holder.classList.remove('ke-loading');holder.classList.add('ke-fallback');
    }
    if(img.complete){if(img.naturalWidth)loaded();else fallback();}
    else{holder.classList.add('ke-loading');img.addEventListener('load',loaded,{once:true});img.addEventListener('error',fallback,{once:true});}
  }
  function compareButtons(){
    all('.dv-card').forEach(card=>{
      const link=card.querySelector('a[href*="html_dichvu.html?id="]');if(!link)return;
      const id=new URL(link.href,location.href).searchParams.get('id');if(!D.services.some(s=>s.id===id))return;
      if(!card.querySelector('[data-ke-compare]')){
        const b=document.createElement('button');b.type='button';b.className='ke-compare-add';b.dataset.keCompare=id;card.append(b);
      }
      card.classList.add('ke-visual-card');
    });
    all('[data-ke-compare]').forEach(b=>{
      const on=compare.includes(b.dataset.keCompare);b.setAttribute('aria-pressed',String(on));const label=on?'✓ Đã thêm vào so sánh':'+ So sánh lựa chọn này';if(b.textContent!==label)b.textContent=label;
    });
  }
  function tray(){
    const el=$('#ke-compare-tray');if(!el)return;el.hidden=!compare.length;
    $('#ke-compare-count').textContent=compare.length+' / 3 lựa chọn';compareButtons();
  }
  function comparison(){
    const list=compare.map(id=>D.services.find(s=>s.id===id)).filter(Boolean);if(!list.length)return;
    const rows=[['Thời lượng',s=>s.minutes?s.minutes+' phút':'Theo thoả thuận'],['Mức giá',s=>s.price==null?'Cần tìm hiểu báo giá':s.price===0?'Miễn phí':K.money(s.price)],['Số buổi',s=>s.sessions||'Theo chương trình'],['Lưu ý giá',s=>s.priceNote],['Phù hợp để tìm hiểu',s=>s.summary]];
    let html='<p>So sánh thông tin công khai của dịch vụ. Giá chưa được chốt sẽ không được tính thành 0đ.</p><div class="kn-compare-wrap"><table class="ke-compare-table"><caption>Đối chiếu các lựa chọn Kể Nè</caption><thead><tr><th>Tiêu chí</th>';
    list.forEach(s=>{html+='<th>'+K.mediaImage(s.imageKey,s.name)+'<strong>'+K.escape(s.name)+'</strong></th>';});
    html+='</tr></thead><tbody>';
    rows.forEach(row=>{html+='<tr><th>'+row[0]+'</th>';list.forEach(s=>{html+='<td>'+K.escape(row[1](s))+'</td>';});html+='</tr>';});
    html+='<tr><th>Tìm hiểu</th>';list.forEach(s=>{html+='<td><a class="kn-btn" href="html_dichvu.html?id='+s.id+'">Xem chi tiết</a></td>';});
    K.modal('So sánh dịch vụ',html+'</tr></tbody></table></div>');
  }
  function menu(){
    let html='<label for="ke-menu-search">Tìm nhanh trong Kể Nè</label><input class="ke-menu-search" id="ke-menu-search" type="search" placeholder="Dịch vụ, chủ đề, bài viết…" maxlength="100" autocomplete="off"><div id="ke-menu-results" class="ke-menu-results" aria-live="polite"></div><nav class="ke-menu-grid" id="ke-menu-grid" aria-label="Điều hướng toàn website">';
    pages.forEach(p=>{html+='<a class="ke-menu-link" href="'+p[0]+'">'+K.mediaImage(p[3],p[1],{sizes:'60px'})+'<span>'+p[1]+'<small>Kể Nè</small></span></a>';});
    const body=K.modal('Bạn muốn đến đâu?',html+'</nav>');
    const input=body.querySelector('#ke-menu-search');input.addEventListener('input',()=>{
      const q=input.value.trim(),results=K.searchResults(q);
      body.querySelector('#ke-menu-grid').hidden=!!q;
      body.querySelector('#ke-menu-results').innerHTML=q?(results.length?results.map(r=>'<a href="'+r.href+'"><small>'+K.escape(r.kind)+'</small>'+K.escape(r.name)+'</a>').join(''):'<p>Chưa có kết quả. Thử từ khoá khác hoặc xoá ô tìm kiếm.</p>'):'';
    });
    input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const a=body.querySelector('#ke-menu-results a,#ke-menu-grid a');if(a){e.preventDefault();a.focus();}}});input.focus();
  }
  function lightbox(key,group){
    const buttons=all('[data-ke-lightbox]').filter(b=>b.dataset.keGallery===group),keys=Array.from(new Set(buttons.map(b=>b.dataset.keLightbox))).filter(k=>M.assets[k]);
    if(!keys.includes(key))keys.push(key);if(!M.assets[key])return;
    let index=keys.indexOf(key),gesture=null,suppressClickUntil=0;
    const body=K.modal('Ảnh minh hoạ Kể Nè','<div id="ke-lb-stage" class="ke-lb-stage"></div><div class="ke-lb-controls"><button type="button" data-ke-lb="prev" aria-label="Ảnh trước">← Ảnh trước</button><span id="ke-lb-count"></span><button type="button" data-ke-lb="zoom">Phóng lớn</button><button type="button" data-ke-lb="next" aria-label="Ảnh tiếp theo">Ảnh sau →</button></div><p class="ke-lb-credit" id="ke-lb-credit"></p>',()=>document.removeEventListener('keydown',keyboard));
    const stage=body.querySelector('#ke-lb-stage');
    function render(){
      const a=M.assets[keys[index]];stage.classList.remove('is-zoomed');
      stage.innerHTML=K.mediaImage(a.id,a.alt,{eager:true,sizes:'95vw'});
      body.querySelector('#ke-lb-count').textContent=(index+1)+' / '+keys.length;
      body.querySelector('#ke-lb-credit').innerHTML='Ảnh minh hoạ · '+K.escape(a.credit)+' · <a href="'+K.escape(a.source)+'" target="_blank" rel="noopener noreferrer">Xem nguồn Pexels</a><br>Nhân vật trong ảnh không được giới thiệu là thành viên, chuyên gia hoặc khách hàng Kể Nè.';
      body.querySelector('[data-ke-lb="zoom"]').textContent='Phóng lớn';
      all('[data-ke-lb="prev"],[data-ke-lb="next"]',body).forEach(b=>b.disabled=keys.length<2);
      animate(stage,[{opacity:.5},{opacity:1}],{duration:250});
    }
    function step(n){index=(index+n+keys.length)%keys.length;render();}
    function zoom(){const on=stage.classList.toggle('is-zoomed');body.querySelector('[data-ke-lb="zoom"]').textContent=on?'Thu về':'Phóng lớn';}
    function keyboard(e){if($('#kn-modal').hidden||!$('#kn-sos').hidden)return;if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}}
    body.addEventListener('click',e=>{const b=e.target.closest('[data-ke-lb]');if(b){if(b.dataset.keLb==='prev')step(-1);if(b.dataset.keLb==='next')step(1);if(b.dataset.keLb==='zoom')zoom();}else if(e.target.closest('#ke-lb-stage img')){if(performance.now()<suppressClickUntil)return;zoom();}});
    stage.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.pointerType!=='mouse')gesture={id:e.pointerId,x:e.clientX,y:e.clientY};});stage.addEventListener('pointercancel',()=>gesture=null);
    stage.addEventListener('pointerup',e=>{const g=gesture;gesture=null;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!stage.classList.contains('is-zoomed')&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)){suppressClickUntil=performance.now()+450;step(dx<0?1:-1);}});
    document.addEventListener('keydown',keyboard);render();
  }
  function credits(){
    let html='<p>Ảnh được tải và đóng gói cục bộ theo Pexels License. Các đường dẫn nguồn dưới đây dùng để đối chiếu; hiển thị ảnh trong website không cần kết nối Pexels.</p><div class="ke-image-list">';
    Object.values(M.assets).forEach(a=>{html+='<article class="ke-image-credit">'+K.mediaImage(a.id,a.alt,{sizes:'300px'})+'<strong>'+K.escape(a.alt)+'</strong>'+K.escape(a.credit)+'<a href="'+K.escape(a.source)+'" target="_blank" rel="noopener noreferrer">Trang ảnh gốc ↗</a></article>';});
    K.modal('Nguồn ảnh & Quyền sử dụng',html+'</div><p class="kn-note mt-3">Ảnh minh hoạ không xác nhận danh tính, nghề nghiệp hoặc tình trạng sức khoẻ của người trong ảnh.</p>');
  }
  function savedArticles(){
    const list=saved.map(id=>D.articles.find(a=>a.id===id)).filter(Boolean);
    const html=list.length?'<div class="ke-menu-grid">'+list.map(a=>'<a class="ke-menu-link" href="html_blog.html?post='+a.id+'">'+K.mediaImage(a.imageKey,a.title,{sizes:'80px'})+'<span>'+K.escape(a.title)+'<small>'+a.minutes+' phút đọc</small></span></a>').join('')+'</div>':'<p>Bạn chưa lưu bài viết nào. Mở một bài trong Góc đọc và chọn “Lưu bài viết”. Danh sách này chỉ được lưu trên thiết bị.</p>';
    K.modal('Bài viết đã lưu trên thiết bị',html);
  }
  function reader(){
    const body=$('#bdetail-body-slot'),detail=$('#blog-detail-view');if(!body||!detail||detail.hidden)return;
    const id=new URLSearchParams(location.search).get('post');if(!D.articles.some(a=>a.id===id))return;
    if(!body.querySelector('.ke-reader-toolbar')){
      const tools=document.createElement('div');tools.className='ke-reader-toolbar';tools.setAttribute('aria-label','Tuỳ chọn đọc');
      tools.innerHTML='<span>Cỡ chữ</span><button type="button" data-ke-reader="size" data-size="18" aria-pressed="true">A</button><button type="button" data-ke-reader="size" data-size="20" aria-pressed="false">A+</button><button type="button" data-ke-reader="size" data-size="22" aria-pressed="false">A++</button><button type="button" data-ke-reader="focus" aria-pressed="false">Đọc tập trung</button><button type="button" data-ke-save-article="'+id+'" aria-pressed="false">Lưu bài viết</button>';
      body.prepend(tools);
    }
    all('[data-ke-save-article]').forEach(b=>{const on=saved.includes(b.dataset.keSaveArticle);b.setAttribute('aria-pressed',String(on));const label=on?'✓ Đã lưu bài viết':'Lưu bài viết';if(b.textContent!==label)b.textContent=label;});
  }
  function carousel(){
    const hero=$('#keneHeroCarousel');if(!hero||!window.jQuery)return;hero.removeAttribute('data-ride');hero.removeAttribute('data-interval');const jq=window.jQuery(hero),slides=all('.carousel-item',hero),duration=6500;jq.carousel({interval:false,pause:false,ride:false,keyboard:true});jq.carousel('pause');
    const tool=document.createElement('div');tool.className='ke-carousel-toolbar';tool.innerHTML=slides.map((_,i)=>'<button type="button" class="ke-slide-dot" data-ke-slide="'+i+'" aria-label="Thông điệp '+(i+1)+'" aria-current="'+(i===0)+'"></button>').join('')+'<button type="button" class="ke-carousel-pause" data-ke-carousel-pause aria-pressed="false" aria-label="Tạm dừng chuyển ảnh">Ⅱ Dừng</button>';hero.append(tool);const line=document.createElement('div');line.className='ke-carousel-timeline';line.setAttribute('aria-hidden','true');line.innerHTML='<span></span>';hero.append(line);
    let remaining=duration,started=0,timer=0,frame=0,hover=false,focus=false,sliding=false,away=false;const blocked=()=>reduced||carouselPaused||hover||focus||document.hidden||sliding||away;
    function freeze(){if(timer){remaining=Math.max(0,remaining-(performance.now()-started));clearTimeout(timer);timer=0;}if(frame){cancelAnimationFrame(frame);frame=0;}}
    function progress(t){frame=0;if(blocked()||!timer)return;line.firstElementChild.style.transform='scaleX('+Math.min(1,(duration-remaining+t-started)/duration)+')';frame=requestAnimationFrame(progress);}
    function reconcile(){freeze();hero.classList.toggle('ke-carousel-paused',blocked());if(blocked())return;if(remaining<30)remaining=duration;started=performance.now();timer=setTimeout(()=>{timer=0;remaining=duration;jq.carousel('next');},remaining);frame=requestAnimationFrame(progress);}
    function active(){const i=slides.findIndex(el=>el.classList.contains('active'));if(i<0)return;all('[data-ke-slide]',hero).forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.keSlide)===i)));slides.forEach((el,j)=>el.setAttribute('aria-hidden',String(i!==j)));const text=slides[i].querySelector('.carousel-caption-custom .container');if(text)animate(text,[{opacity:.5,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:500});remaining=duration;line.firstElementChild.style.transform='scaleX(0)';sliding=false;reconcile();}
    jq.on('slide.bs.carousel',()=>{freeze();sliding=true;});jq.on('slid.bs.carousel',active);tool.addEventListener('click',e=>{const dot=e.target.closest('[data-ke-slide]');if(dot)jq.carousel(Number(dot.dataset.keSlide));const pause=e.target.closest('[data-ke-carousel-pause]');if(pause){carouselPaused=!carouselPaused;pause.textContent=carouselPaused?'▶ Tiếp':'Ⅱ Dừng';pause.setAttribute('aria-pressed',String(carouselPaused));pause.setAttribute('aria-label',carouselPaused?'Tiếp tục chuyển ảnh':'Tạm dừng chuyển ảnh');reconcile();}});hero.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hover=true;reconcile();}});hero.addEventListener('pointerleave',()=>{hover=false;reconcile();});hero.addEventListener('focusin',()=>{focus=true;reconcile();});hero.addEventListener('focusout',e=>{if(!hero.contains(e.relatedTarget)){focus=false;reconcile();}});document.addEventListener('visibilitychange',reconcile);window.addEventListener('pagehide',()=>{away=true;freeze();});window.addEventListener('pageshow',()=>{away=false;reconcile();});X.carouselMotion=reconcile;active();
  }
  function scroll(){
    if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{
      scrollFrame=0;const root=document.documentElement,total=root.scrollHeight-root.clientHeight;
      $('#ke-scroll-progress').style.transform='scaleX('+(total>0?Math.min(1,scrollY/total):0)+')';document.body.classList.toggle('ke-scrolled',scrollY>28);
    });
  }
  function enhance(){
    mutationFrame=0;all('img[data-ke-photo]').forEach(imageState);
    all('.dv-card,.blog-card,.kn-expert-card,.kn-voucher,.sm-tech,.kn-step-card,.member-card').forEach(el=>el.classList.add('ke-visual-card'));
    all('.kn-white-card,.kn-expert-card,.kn-voucher').forEach(el=>el.classList.add('ke-glow'));
    compareButtons();reader();observe();
    const detail=$('#blog-detail-view');if(detail&&detail.hidden)document.body.classList.remove('ke-reading-focus');
  }
  function offline(){
    const status=$('#ke-offline-state');if(!status)return;status.textContent='Ảnh cục bộ · Không cần Internet';if(!('serviceWorker' in navigator)||!window.isSecureContext)return;const expected=window.KENE_OFFLINE_VERSION;
    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{status.textContent='Đang lưu giao diện & Ảnh ngoại tuyến…';const ping=worker=>worker?.postMessage({type:'KENE_OFFLINE_STATUS'});navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='KENE_OFFLINE_STATUS'&&expected&&event.data.version.endsWith('-'+expected)){status.textContent='Đã lưu giao diện & Ảnh ngoại tuyến';status.dataset.cached='true';}});navigator.serviceWorker.ready.then(ready=>ping(ready.active));ping(reg.active);navigator.serviceWorker.addEventListener('controllerchange',()=>ping(navigator.serviceWorker.controller));reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='activated')ping(worker);});});}).catch(()=>status.textContent='Ảnh cục bộ · Mở bằng localhost để lưu giao diện');
  }
  function init(){
    if(document.documentElement.dataset.keEnhanced)return;document.documentElement.dataset.keEnhanced='true';
    const progress=document.createElement('div');progress.id='ke-scroll-progress';progress.className='ke-scroll-progress';progress.setAttribute('aria-hidden','true');document.body.prepend(progress);
    const auth=$('#auth-zone');if(auth){const b=document.createElement('button');b.type='button';b.className='ke-menu-launch';b.dataset.keMenu='';b.setAttribute('aria-label','Mở điều hướng và tìm kiếm');b.innerHTML='<span aria-hidden="true">☰</span>';auth.parentElement.insertBefore(b,auth);}
    const compareTray=document.createElement('aside');compareTray.id='ke-compare-tray';compareTray.className='ke-compare-tray';compareTray.hidden=true;compareTray.setAttribute('aria-label','So sánh dịch vụ đã chọn');
    compareTray.innerHTML='<div><strong>So sánh dịch vụ</strong><small id="ke-compare-count"></small></div><button class="ke-compare-main" type="button" data-ke-open-compare>Xem so sánh</button><button class="ke-clear-compare" type="button" data-ke-clear-compare aria-label="Xoá các lựa chọn so sánh">Xoá chọn</button>';document.body.append(compareTray);
    motion();osMotion.addEventListener('change',motion);
    if('IntersectionObserver' in window)observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;observer.unobserve(entry.target);
      const el=entry.target,index=Array.from(el.parentElement.children).indexOf(el)%4;
      animate(el,[{opacity:.35,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{delay:index*55,duration:610});
    }),{threshold:.1,rootMargin:'0px 0px -14px 0px'});
    const relevant='picture.ke-picture,img[data-ke-photo],.dv-card,.blog-card,.kn-expert-card,.kn-voucher,.sm-tech,.member-card,#bdetail-body-slot';const changes=new MutationObserver(records=>{const useful=records.some(r=>!r.target.closest?.('[data-ke-decorative],.ke-ripple')&&Array.from(r.addedNodes).some(n=>n.nodeType===1&&!n.matches('[data-ke-decorative],.ke-ripple')&&(n.matches(relevant)||n.querySelector(relevant))));if(useful&&!mutationFrame)mutationFrame=requestAnimationFrame(enhance);});changes.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-ke-menu]'))menu();
      const image=e.target.closest('[data-ke-lightbox]');if(image){e.preventDefault();lightbox(image.dataset.keLightbox,image.dataset.keGallery);}
      if(e.target.closest('[data-ke-credits]'))credits();
      if(e.target.closest('[data-ke-saved-articles]'))savedArticles();
      if(e.target.closest('[data-ke-motion]')){try{K.write('kene_reduce_motion_v2',!reduced);motion();}catch(error){K.toast(error.message);}}
      const c=e.target.closest('[data-ke-compare]');if(c){
        const id=c.dataset.keCompare;if(compare.includes(id))compare=compare.filter(x=>x!==id);else if(compare.length<3)compare.push(id);else{K.toast('Bạn có thể so sánh tối đa 3 lựa chọn.');return;}
        try{K.write('kene_compare_services_v2',compare);}catch(error){K.toast(error.message);}tray();
      }
      if(e.target.closest('[data-ke-open-compare]'))comparison();
      if(e.target.closest('[data-ke-clear-compare]')){try{K.write('kene_compare_services_v2',[]);compare=[];tray();}catch(error){K.toast(error.message);}}
      const bookmark=e.target.closest('[data-ke-save-article]');if(bookmark){const id=bookmark.dataset.keSaveArticle;const next=saved.includes(id)?saved.filter(x=>x!==id):saved.concat(id);try{K.write('kene_saved_articles_v2',next);saved=next;reader();}catch(error){K.toast(error.message);}}
      const control=e.target.closest('[data-ke-reader]');if(control){
        if(control.dataset.keReader==='size'){const size=Number(control.dataset.size);$('#bdetail-body-slot').style.setProperty('--ke-reading-size',size+'px');all('[data-ke-reader="size"]').forEach(b=>b.setAttribute('aria-pressed',String(b===control)));}
        if(control.dataset.keReader==='focus'){const on=document.body.classList.toggle('ke-reading-focus');control.setAttribute('aria-pressed',String(on));control.textContent=on?'Thoát đọc tập trung':'Đọc tập trung';}
      }
      if(e.target.closest('[data-action="blog-back"]'))document.body.classList.remove('ke-reading-focus');
    });
    document.addEventListener('pointerdown',e=>{
      if(reduced)return;const b=e.target.closest('.kn-btn,.kn-slot,.dv-chip,.blog-chip');if(!b||b.disabled)return;
      b.classList.add('ke-ripple-target');const r=b.getBoundingClientRect(),span=document.createElement('span');span.className='ke-ripple';span.setAttribute('aria-hidden','true');span.style.setProperty('--ke-ripple-x',(e.clientX-r.left)+'px');span.style.setProperty('--ke-ripple-y',(e.clientY-r.top)+'px');b.append(span);setTimeout(()=>span.remove(),650);
    });
    let pointerFrame=0,target=null,rect=null,point=null;
    function resetPointer(){if(pointerFrame)cancelAnimationFrame(pointerFrame);pointerFrame=0;if(target){target.style.setProperty('--ke-rx','0deg');target.style.setProperty('--ke-ry','0deg');target.classList.remove('ke-pointer-active');}target=null;rect=null;}
    document.addEventListener('pointermove',e=>{if(reduced||!fine.matches)return;const el=e.target.closest('.ke-tilt,.ke-glow');if(!el){resetPointer();return;}if(el!==target){resetPointer();target=el;rect=el.getBoundingClientRect();el.classList.add('ke-pointer-active');}point={x:e.clientX,y:e.clientY};if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;if(!target||!rect||!rect.width||!rect.height)return;const x=Math.max(0,Math.min(rect.width,point.x-rect.left)),y=Math.max(0,Math.min(rect.height,point.y-rect.top));target.style.setProperty('--ke-rx',(-(y/rect.height-.5)*2)+'deg');target.style.setProperty('--ke-ry',((x/rect.width-.5)*2)+'deg');target.style.setProperty('--ke-mx',x+'px');target.style.setProperty('--ke-my',y+'px');});},{passive:true});document.addEventListener('pointerout',e=>{if(target&&!target.contains(e.relatedTarget))resetPointer();},{passive:true});document.addEventListener('kene:motion',resetPointer);window.addEventListener('scroll',resetPointer,{passive:true});window.addEventListener('pagehide',resetPointer);
    window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',scroll,{passive:true});window.addEventListener('popstate',()=>document.body.classList.remove('ke-reading-focus'));
    all('[data-ke-count]').forEach(el=>{const value=Number(el.dataset.keCount);if(!Number.isFinite(value))return;el.classList.add('ke-count');el.setAttribute('aria-label',String(value));if(!reduced){let begin=null;function frame(t){if(reduced){el.textContent=String(value);return;}if(!begin)begin=t;const p=Math.min(1,(t-begin)/850);el.textContent=String(Math.round(value*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(frame);}requestAnimationFrame(frame);}});
    carousel();enhance();tray();scroll();offline();
  }
  X.reduced=()=>reduced;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
