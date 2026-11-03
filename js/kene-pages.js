/* Kể Nè — page controllers. A single data source is used across all twelve pages. */
(function () {
  'use strict';
  const K=window.KENE,D=K.data,E=K.engine,esc=K.escape;
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const service=id=>D.services.find(s=>s.id===id);
  const expert=id=>D.experts.find(e=>e.id===id);
  const topic=id=>D.topics.find(t=>t.id===id);
  const price=s=>s.price===0?'Miễn phí':s.price==null?'Tìm hiểu thêm':K.money(s.price);
  const alert=(message,error=false)=>`<div class="kn-alert ${error?'kn-alert-error':''}" role="status">${esc(message)}</div>`;
  const empty=(title,text,href,label)=>`<div class="kn-empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${href?`<a class="kn-btn" href="${href}">${esc(label||'Tiếp tục')}</a>`:''}</div>`;
  function serviceCard(s) {
    return `<article class="dv-card kn-service-card"><a class="kn-card-link" href="html_dichvu.html?id=${s.id}"><div class="dv-card-img">${K.mediaImage(s.imageKey,s.name)}</div><div class="dv-card-body"><div class="dv-card-meta">${s.icon} ${esc(s.category)}</div><h3 class="dv-card-title">${esc(s.name)}</h3><p class="kn-card-excerpt">${esc(s.summary)}</p><div class="dv-card-foot"><div><small>${s.id==='dong-hanh-6'?'Giá tham khảo':s.action==='book'?'Giá tham khảo':esc(s.category)}</small><div class="dv-card-price">${price(s)}</div></div><span aria-hidden="true">↗</span></div></div></a><button class="kn-save" data-wish="${s.id}" aria-label="Lưu ${esc(s.name)}" aria-pressed="false">♡</button></article>`;
  }
  function blogCard(p) {
    return `<article class="blog-card kn-blog-card"><a class="kn-card-link" href="html_blog.html?post=${p.id}">${K.mediaImage(p.imageKey,p.title)}<div class="blog-card-body"><span class="kn-tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><small>${p.minutes} phút đọc · Kể Nè</small></div></a></article>`;
  }
  function summaryHTML(t) {
    return `<div class="kn-summary-line"><span>Tạm tính</span><strong>${K.money(t.subtotal)}</strong></div><div class="kn-summary-line"><span>Phí dịch vụ bổ sung</span><span>0đ</span></div><div class="kn-summary-line"><span>Giảm giá đủ điều kiện</span><strong>−${K.money(t.discount)}</strong></div><div class="kn-summary-line kn-summary-total"><span>Tổng</span><span>${K.money(t.total)}</span></div>`;
  }
  async function beginCheckout(navigate=true) {
    const u=K.requireUser('html_giohang.html');if(!u)return null;
    try {
      const hold=await K.lock(()=>K.repo.createHold(u.id,K.cart(),K.clearance()));
      K.write('kene_current_hold',hold.id,true);
      if(navigate)location.href='html_thanhtoan.html';
      return hold;
    } catch(error) {
      if(error.code==='SCREEN_REQUIRED'){
        K.modal('Hoàn thành bước an toàn',`<p>${esc(error.message)}</p><a class="kn-btn" href="html_diadiem.html#sang-loc">Mở sàng lọc miễn phí</a>`);
      }else K.toast(error.message);
      return null;
    }
  }
  K.beginCheckout=beginCheckout;
  function slotsFor(expertId,date,period) {
    const u=K.getUser(),now=Date.now(),idx=Number(expertId.replace(/\D/g,''))||1;
    return [7,8,9,10,11,13,14,15,16,19,20,21,22].filter(h=>(h+idx)%3!==0).map(h=>{
      const startMs=Date.parse(date+'T'+String(h).padStart(2,'0')+':00:00+07:00');
      return {hour:h,startMs,available:Number.isFinite(startMs)&&startMs>now+15*60000&&K.repo.isAvailable(expertId,startMs,u?.id)};
    }).filter(s=>!period||(period==='day'?s.hour>=8&&s.hour<17:s.hour>=19));
  }
  K.startBooking=function(serviceId,expertId,options={}) {
    const s=service(serviceId);if(!s)return;
    if(s.action==='screen'){location.href='html_diadiem.html#sang-loc';return;}
    if(s.action==='inquiry'){location.href='html_lienhe_chinhsach.html?topic='+encodeURIComponent(s.id);return;}
    const pending=K.read('kene_resume_booking',null,true);if(!options.mode&&pending?.serviceId===s.id&&Date.now()-pending.at<86400000){options=pending.options;expertId=expertId||pending.expertId;}if(options.mode)K.write('kene_resume_booking',{serviceId:s.id,expertId,options,at:Date.now()},true);
    const next=`html_dichvu.html?id=${s.id}&book=1${expertId?'&expert='+encodeURIComponent(expertId):''}`;
    const u=K.requireUser(next);if(!u)return;
    const clearance=K.clearance();
    if(!clearance||clearance.adult!==true||Date.now()-clearance.at>86400000){
      location.href=`html_diadiem.html?service=${s.id}${expertId?'&expert='+encodeURIComponent(expertId):''}#sang-loc`;return;
    }
    if(!clearance.allowed){K.sos();return;}
    const mode=options.mode||'new';sessionStorage.removeItem('kene_resume_booking');
    let selectedMs=null,currentExpert=expert(expertId)?.id||D.experts[0].id;
    const dates=Array.from({length:15},(_,i)=>E.dayKey(Date.now()+i*86400000));
    let currentDate=dates.find(date=>slotsFor(currentExpert,date).some(x=>x.available))||dates[1];
    const title=mode==='reschedule'?'Chọn khung giờ thay thế':mode==='prepaid'?'Đặt buổi tiếp theo trong gói':'Chọn cách đồng hành & Thời gian';
    const body=K.modal(title,`<p><strong>${esc(s.name)}</strong> · ${s.minutes} phút/buổi · ${mode==='prepaid'?'Đã nằm trong gói':price(s)}</p><p class="kn-note">Hồ sơ và khung giờ đều là dữ liệu dự kiến. Lựa chọn trong giỏ chưa phải lịch đã xác nhận.</p><form id="booking-form"><div class="kn-form-grid"><label>Cách đồng hành mong muốn<select id="book-expert">${D.experts.map(x=>`<option value="${x.id}" ${x.id===currentExpert?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label>Hình thức<select id="book-channel"></select></label><label>Ngày hẹn<input type="date" id="book-date" value="${currentDate}" min="${dates[0]}" max="${dates[14]}" required></label></div><p class="kn-note">Theo giờ Việt Nam (UTC+7). Đổi lịch miễn phí trước ít nhất 12 giờ. Ô không còn phù hợp sẽ bị khoá.</p><div id="book-slots" class="kn-schedule-slots"></div><div id="book-result" aria-live="polite"></div><div class="kn-chips mt-4"><button class="kn-btn" type="submit" name="intent" value="checkout">${mode==='new'?'Xem lại & Lưu yêu cầu':'Xác nhận khung giờ mong muốn'}</button>${mode==='new'?'<button class="kn-btn kn-btn-light" type="submit" name="intent" value="cart">Thêm vào giỏ dự kiến</button>':''}</div></form>`);
    function render(){
      currentExpert=$('book-expert').value;
      const x=expert(currentExpert),channel=$('book-channel').value;
      $('book-channel').innerHTML=x.channels.map(c=>`<option value="${c}" ${channel===c?'selected':''}>${D.config.channels[c]}</option>`).join('');
      currentDate=$('book-date').value;selectedMs=null;
      const slots=slotsFor(currentExpert,currentDate);
      $('book-slots').innerHTML=slots.map(slot=>`<button type="button" class="kn-slot" data-slot="${slot.startMs}" ${slot.available?'':'disabled'} aria-pressed="false">${String(slot.hour).padStart(2,'0')}:00<small>${slot.available?(E.isDaytime(slot.startMs,D.config)&&s.id==='ca-nhan'?'Có mã ban ngày −15%':'Còn khung phù hợp'):'Không còn phù hợp'}</small></button>`).join('');
      if(!slots.some(x=>x.available))$('book-result').innerHTML=alert('Chưa có khung phù hợp. Bạn có thể đổi ngày hoặc lưu mong muốn trong danh sách chờ.');
      else $('book-result').innerHTML='';
    }
    $('book-expert').addEventListener('change',render);$('book-date').addEventListener('change',render);
    body.addEventListener('click',e=>{
      const b=e.target.closest('[data-slot]');if(!b)return;
      selectedMs=Number(b.dataset.slot);body.querySelectorAll('[data-slot]').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on));});
    });
    $('booking-form').addEventListener('submit',async e=>{
      e.preventDefault();if(!selectedMs){$('book-result').innerHTML=alert('Chọn một khung giờ còn phù hợp.',true);return;}
      const item={serviceId:s.id,expertId:currentExpert,channel:$('book-channel').value,startMs:selectedMs};
      const buttons=body.querySelectorAll('button[type=submit]');buttons.forEach(b=>b.disabled=true);
      try {
        if(mode==='reschedule'){
          await K.lock(()=>K.repo.reschedule(u.id,options.orderId,options.appointmentId,item,K.clearance()));
          K.closeModal();K.toast('Đã cập nhật khung giờ trong lịch dự kiến.');K.refreshAccount?.();return;
        }
        if(mode==='prepaid'){
          await K.lock(()=>K.repo.nextSession(u.id,options.orderId,options.itemIndex,item,K.clearance()));
          K.closeModal();K.toast('Đã thêm buổi trong gói, không tính tiền lần nữa.');K.refreshAccount?.();return;
        }
        const normalized=K.repo.normalizeItem(item),cart=K.cart();
        if(cart.length>=6)throw new Error('Giỏ dự kiến tối đa 6 lựa chọn.');
        if(cart.some(x=>E.overlaps(x,normalized)))throw new Error('Khung này trùng với một lựa chọn trong giỏ.');
        normalized.lineId=K.uid('line');K.saveCart(cart.concat(normalized));K.closeModal();
        if(e.submitter?.value==='checkout')await beginCheckout();else K.toast('Đã thêm vào giỏ dự kiến; khung chưa được giữ.');
      }catch(error){$('book-result')&&($('book-result').innerHTML=alert(error.message,true));K.toast(error.message);}
      finally{buttons.forEach(b=>b.disabled=false);}
    });
    render();
  };
  function home(){
    function recent(){
      const stored=K.read('kene_recent',[]),rows=(Array.isArray(stored)?stored:[]).map(service).filter(Boolean).map(s=>({...s,imageKey:s.recentImageKey||s.imageKey}));
      $('kn-recent').innerHTML=rows.length?rows.map(serviceCard).join(''):empty('Bạn chưa xem dịch vụ nào','Các lựa chọn bạn tìm hiểu gần đây sẽ xuất hiện tại đây.','html_dichvu.html','Xem dịch vụ');
      K.syncHeader();
    }
    recent();document.addEventListener('kene:change',()=>K.syncHeader());
    document.addEventListener('click',e=>{if(e.target.closest('[data-action="clear-recent"]')){K.write('kene_recent',[]);recent();K.toast('Đã xoá lịch sử xem trên thiết bị.');}});
  }
  function intro(){
    let index=0;
    $('imageStack')?.addEventListener('click',()=>{
      index=(index+1)%3;
      $('imageStack').classList.toggle('shuffled',index===1);$('imageStack').classList.toggle('shuffled2',index===2);
      document.querySelectorAll('.story-content-card').forEach((c,i)=>c.classList.toggle('active',i===index));
    });
    document.querySelectorAll('[data-reason]').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('[data-reason]').forEach(b=>{const on=b===button;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
      document.querySelectorAll('.reason-content-panel').forEach(p=>{const on=p.id==='reason-'+button.dataset.reason;p.hidden=!on;p.classList.toggle('active',on);});
    }));
  }
  function services(){
    let category='',selectedTopic='',query=params.get('search')||'',sort='default';
    $('service-search').value=query;
    $('dv-cate-wrap').innerHTML=[{category:'',icon:'💙',label:'Tất cả'},...D.services.map(s=>({category:s.category,icon:s.icon,label:s.category}))].map(x=>`<button class="dv-cate-item ${x.category?'':'active'}" data-service-category="${esc(x.category)}" aria-pressed="${!x.category}"><span class="dv-cate-icon">${x.icon}</span><span class="dv-cate-label">${esc(x.label)}</span></button>`).join('');
    $('dv-city-row').innerHTML=`<button class="dv-chip active" data-service-topic="" aria-pressed="true">Mọi chủ đề</button>${D.topics.map(t=>`<button class="dv-chip" data-service-topic="${t.id}" aria-pressed="false">${t.icon} ${esc(t.name)}</button>`).join('')}`;
    function render(){
      let list=D.services.filter(s=>(!category||s.category===category)&&(!selectedTopic||s.topicIds.includes(selectedTopic))&&(!query||K.fold(s.name+' '+s.summary+' '+s.category).includes(K.fold(query))));
      if(sort==='price')list.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
      if(sort==='duration')list.sort((a,b)=>(a.minutes??Infinity)-(b.minutes??Infinity));
      $('grid-count').textContent=list.length+' lựa chọn';
      $('grid-title').textContent=category||'Tất cả lựa chọn';
      $('dv-grid').innerHTML=list.length?list.map(s=>`<div class="col-12 col-sm-6 col-lg-3 mb-4">${serviceCard(s)}</div>`).join(''):`<div class="col-12">${empty('Chưa có kết quả phù hợp','Thử chủ đề khác hoặc xoá bộ lọc.')}</div>`;
      K.syncHeader();
    }
    function detail(id,push=true){
      const s=service(id);if(!s){$('dv-grid').innerHTML=empty('Không tìm thấy dịch vụ','Bạn có thể quay lại danh sách.','html_dichvu.html','Xem danh sách');return;}
      K.recent(id);$('home-view').classList.add('d-none');$('detail-view').classList.remove('d-none');
      document.querySelector('.dv-hero').hidden=true;
      $('dv-gallery').innerHTML=s.gallery.map((key,i)=>K.mediaFigure(key,i?"Không gian đồng hành":s.name,"service-gallery",{eager:true,sizes:"(max-width:900px) 100vw, 70vw"})).join('');
      $('dv-detail-tags').innerHTML=`<span class="kn-tag">${esc(s.category)}</span> <span class="kn-tag">${s.sessions?esc(s.sessions+' buổi'):'Tìm hiểu'}</span>`;
      $('dv-detail-title').textContent=s.name;
      $('dv-detail-desc').innerHTML=`<p>${esc(s.description)}</p>`;
      $('dv-highlights').innerHTML=[['Thời lượng',s.minutes?s.minutes+' phút/buổi':'Theo thoả thuận'],['Giá',price(s)],['Lựa chọn','Không tự gia hạn']].map(x=>`<div class="col-md-4 mb-3"><div class="kn-white-card h-100"><small>${x[0]}</small><strong class="d-block">${esc(x[1])}</strong></div></div>`).join('');
      $('dv-itinerary').innerHTML=s.steps.map((x,i)=>`<div class="kn-process-step"><span>0${i+1}</span><div><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></div></div>`).join('');
      $('dv-include-section').innerHTML=`<div class="col-md-6 mb-3"><div class="kn-detail-list"><h3>Bao gồm</h3><ul>${s.included.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div><div class="col-md-6 mb-3"><div class="kn-detail-list"><h3>Giới hạn cần biết</h3><ul>${s.excluded.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
      $('dv-booking-box').innerHTML=`<small>${s.price===null?'Chưa mở thanh toán':'Giá tham khảo'}</small><div class="kn-book-price">${price(s)}</div><p class="kn-note my-3">${esc(s.priceNote)}</p><button class="kn-btn kn-btn-full" data-book-service="${s.id}">${s.action==='screen'?'Làm sàng lọc miễn phí':s.action==='inquiry'?'Gửi yêu cầu tìm hiểu':'Chọn chuyên gia & Giờ hẹn'}</button><button class="kn-btn kn-btn-light kn-btn-full mt-3" data-wish="${s.id}" aria-label="Lưu ${esc(s.name)}">♡</button><p class="kn-note mt-3">Yêu cầu được lưu để bạn xem lại. Chuyên gia, khung giờ và chi phí cần được xác nhận trước khi sử dụng dịch vụ.</p><a href="html_lienhe_chinhsach.html#doi-lich">Điều kiện đổi lịch →</a>`;
      if(push)history.pushState({},'','html_dichvu.html?id='+s.id);
      K.syncHeader();
    }
    function back(){
      $('home-view').classList.remove('d-none');$('detail-view').classList.add('d-none');document.querySelector('.dv-hero').hidden=false;
      history.pushState({},'','html_dichvu.html');render();
    }
    $('service-search').addEventListener('input',()=>{query=$('service-search').value;render();});
    $('service-sort').addEventListener('change',()=>{sort=$('service-sort').value;render();});
    document.addEventListener('click',e=>{
      const cat=e.target.closest('[data-service-category]');if(cat){category=cat.dataset.serviceCategory;document.querySelectorAll('[data-service-category]').forEach(b=>{const on=b===cat;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});render();}
      const t=e.target.closest('[data-service-topic]');if(t){selectedTopic=t.dataset.serviceTopic;document.querySelectorAll('[data-service-topic]').forEach(b=>{const on=b===t;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});render();}
      const b=e.target.closest('[data-book-service]');if(b)K.startBooking(b.dataset.bookService);
      if(e.target.closest('[data-action="service-back"]'))back();
      if(e.target.closest('[data-action="reset-services"]')){category='';selectedTopic='';query='';sort='default';$('service-search').value='';$('service-sort').value='default';document.querySelectorAll('[data-service-category],[data-service-topic]').forEach(b=>{const on=!(b.dataset.serviceCategory||b.dataset.serviceTopic);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});render();}
    });
    window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('id');if(id)detail(id,false);else{$('home-view').classList.remove('d-none');$('detail-view').classList.add('d-none');document.querySelector('.dv-hero').hidden=false;render();}});
    render();if(params.get('id'))detail(params.get('id'),false);
    if(params.get('book')==='1'&&params.get('id'))setTimeout(()=>K.startBooking(params.get('id'),params.get('expert')),100);
  }
  function experts(){
    let suggestions=[],currentTopic=params.get('topic')||'';
    $('match-topic').innerHTML=`<option value="">Chưa chọn chủ đề</option>${D.topics.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}`;
    if(topic(currentTopic))$('match-topic').value=currentTopic;
    $('expert-topics').innerHTML=`<button class="kn-chip ${currentTopic?'':'active'}" data-expert-topic="">Tất cả</button>${D.topics.map(t=>`<button class="kn-chip ${t.id===currentTopic?'active':''}" data-expert-topic="${t.id}">${t.icon} ${esc(t.name)}</button>`).join('')}`;
    function match(){
      const selected=$('match-topic').value,channel=$('match-channel').value,style=$('match-style').value,gender=$('match-gender').value,period=$('match-period').value,budget=Number($('match-budget').value);
      let list=D.experts.filter(x=>(!selected||x.topics.includes(selected))&&(!channel||x.channels.includes(channel))&&(!style||x.style===style)&&(!gender||x.gender===gender)&&x.price<=budget);
      list=list.map(x=>{
        const reasons=[];
        if(selected)reasons.push('Trùng thẻ '+topic(selected).name);
        if(channel)reasons.push('Có hình thức '+D.config.channels[channel]);
        if(style)reasons.push('Phong cách '+style.toLowerCase());
        if(gender)reasons.push('Đúng ưu tiên giới tính đã chọn');
        const next=Array.from({length:8},(_,i)=>E.dayKey(Date.now()+i*86400000)).flatMap(date=>slotsFor(x.id,date,period)).find(s=>s.available);
        if(next)reasons.push('Có khung phù hợp '+K.date(next.startMs));
        reasons.push('Giá tham khảo '+K.money(x.price));
        return {...x,reasons,next};
      }).filter(x=>x.next).sort((a,b)=>a.next.startMs-b.next.startMs).slice(0,3);
      suggestions=list;
      $('match-summary').innerHTML=`<p>${list.length} gợi ý theo tiêu chí đã chọn. Các gợi ý mô tả phong cách, hình thức và thời gian bạn mong muốn. Hồ sơ chuyên gia chưa mở lịch trực tuyến.</p>`;
      $('expert-grid').innerHTML=list.length?list.map(x=>`<article class="kn-expert-card">${K.mediaImage(x.contextImage,"Minh hoạ không gian trao đổi; không phải ảnh chuyên gia",{className:"ke-expert-context"})}<span class="kn-tag">Định hướng ghép nối</span><div class="kn-expert-header"><div class="kn-avatar" style="background:${x.color}">${x.id.slice(-1)}</div><div><h3>${esc(x.name)}</h3><small>${esc(x.style)} · ${x.gender}</small></div></div><div class="kn-chips">${x.topics.map(t=>`<span class="kn-tag">${esc(topic(t).name)}</span>`).join('')}</div><ul class="kn-reasons-list">${x.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><strong>${K.money(x.price)} / 50 phút</strong><p>${esc(x.verification)}</p><button class="kn-btn kn-btn-full" data-book-expert="${x.id}">Xem khung giờ mong muốn</button><button class="kn-link mt-3" data-expert-profile="${x.id}">Xem thông tin minh bạch</button></article>`).join(''):empty('Chưa có gợi ý đủ tiêu chí','Bạn có thể nới phong cách, giới tính, ngân sách hoặc lưu mong muốn vào danh sách chờ.');
      $('expert-compare').innerHTML='';
    }
    $('match-form').addEventListener('submit',e=>{e.preventDefault();match();});
    document.addEventListener('click',e=>{
      const t=e.target.closest('[data-expert-topic]');if(t){$('match-topic').value=t.dataset.expertTopic;document.querySelectorAll('[data-expert-topic]').forEach(b=>b.classList.toggle('active',b===t));match();}
      const b=e.target.closest('[data-book-expert]');if(b)K.startBooking(service(params.get('service'))?.id||'ca-nhan',b.dataset.bookExpert);
      const p=e.target.closest('[data-expert-profile]');
      if(p){const x=expert(p.dataset.expertProfile);K.modal(x.name,`<span class="kn-tag">Định hướng ghép nối</span><p class="mt-3">${esc(x.bio)}</p><h3 class="kn-h3">Trước khi xác nhận người đồng hành</h3><ul><li>Xác minh hồ sơ, bằng cấp và chứng chỉ phù hợp.</li><li>Phỏng vấn, đóng vai và đào tạo theo quy trình được duyệt.</li><li>Công bố chuyên môn, giá và lịch khả dụng có căn cứ.</li></ul><p>Bạn được xem thông tin chuyên môn và điều kiện trước khi đồng ý sử dụng dịch vụ.</p>`);}
      if(e.target.closest('[data-action="compare"]')){
        $('expert-compare').innerHTML=suggestions.length?`<div class="kn-compare-wrap"><table class="kn-compare"><caption>So sánh các định hướng đồng hành</caption><thead><tr><th>Tiêu chí</th>${suggestions.map(x=>`<th>${esc(x.name)}</th>`).join('')}</tr></thead><tbody>${[['Phong cách',x=>x.style],['Hình thức',x=>x.channels.map(c=>D.config.channels[c]).join(', ')],['Giá/50 phút',x=>K.money(x.price)],['Khung gần nhất',x=>K.date(x.next.startMs)],['Trạng thái',()=> 'Chưa mở lịch trực tuyến']].map(([label,value])=>`<tr><th>${label}</th>${suggestions.map(x=>`<td>${esc(value(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:alert('Chưa có gợi ý để so sánh.');
        $('expert-compare').scrollIntoView({behavior:(window.KENE_EXPERIENCE?.reduced()?'auto':'smooth'),block:'center'});
      }
    });
    $('wait-date').min=E.dayKey(Date.now());$('wait-date').value=E.dayKey(Date.now()+86400000);
    $('waitlist-form').addEventListener('submit',e=>{
      e.preventDefault();
      const date=$('wait-date').value;if(date<E.dayKey(Date.now())){$('waitlist-result').innerHTML=alert('Vui lòng chọn ngày từ hôm nay.',true);return;}
      K.write('kene_waitlist',{date,period:$('wait-period').value,at:Date.now()},true);
      $('waitlist-result').innerHTML=alert('Đã lưu mong muốn trong tab trình duyệt. Phiên bản hiện tại chưa gửi thông báo khi có chỗ.');
    });
    match();screeningApp();
  }
  function screeningApp(){
    const saved=K.read('kene_screen_draft',null,true);
    const fresh=()=>({phase:'intro',index:0,answers:Array(16).fill(null),storeScore:false,saveDraft:false,adult:false,processing:false});
    let state=saved&&saved.version===1&&Date.now()-saved.at<86400000?{...fresh(),...saved}:fresh();
    function persist(){
      if(state.saveDraft)K.write('kene_screen_draft',{...state,at:Date.now(),version:1},true);
      else sessionStorage.removeItem('kene_screen_draft');
    }
    function blocked(message){
      state.phase='blocked';sessionStorage.removeItem('kene_screen_draft');
      K.saveClearance({allowed:false,review:true,adult:state.adult,at:Date.now()});
      $('screen-app').innerHTML=`<h3>Ưu tiên hỗ trợ trực tiếp</h3><p>${esc(message)}</p><p>Luồng chọn lịch thông thường đã tạm dừng. Đây không phải kết luận chẩn đoán. Website không gửi cảnh báo tới nhân viên.</p><button class="kn-btn" data-screen="sos">Xem hướng dẫn hỗ trợ ngay</button><p class="kn-note mt-3">Nếu không có nguy cơ tức thời nhưng cần đánh giá thêm, hãy tìm người có chuyên môn. Ngưỡng điều phối của phiên bản hiện tại cần được hội đồng chuyên môn phê duyệt trước vận hành.</p>`;
      K.sos();
    }
    function result(){
      const result=E.screening(state.answers.slice(0,9),state.answers.slice(9),false);
      if(result.review){blocked('Một câu trả lời hoặc tổng điểm gợi ý cần có người có chuyên môn xem lại trước khi đặt lịch thông thường.');return;}
      const at=Date.now();
      K.saveClearance({allowed:true,adult:true,tier:result.tier,at,...(state.storeScore?{scores:{phq:result.phq,gad:result.gad},storeScore:true}:{})});
      if(state.storeScore&&K.getUser()){
        const p=K.profile();K.saveProfile({screenings:p.screenings.concat({phq:result.phq,gad:result.gad,at}).slice(-12)});
      }
      sessionStorage.removeItem('kene_screen_draft');state.phase='result';
      const go=`html_dichvu.html?id=${service(params.get('service'))?.id||'ca-nhan'}&book=1${params.get('expert')?'&expert='+encodeURIComponent(params.get('expert')):''}`;
      $('screen-app').innerHTML=`<h3>Một góc nhìn để mở đầu trao đổi</h3><div class="kn-score-grid"><div>PHQ-9<strong>${result.phq}/27</strong><span>${result.phqLabel}</span></div><div>GAD-7<strong>${result.gad}/21</strong><span>${result.gadLabel}</span></div></div><p>Đây là kết quả sàng lọc, không phải chẩn đoán. Tổng điểm không phản ánh đầy đủ hoàn cảnh và nhu cầu của bạn.</p><p class="kn-note">${state.storeScore?(K.getUser()?'Bạn đã chọn lưu tổng điểm vào tài khoản.':'Bạn đã chọn lưu tổng điểm tạm trong tab; chưa có tài khoản để lưu lịch sử.'):'Không lưu tổng điểm hoặc câu trả lời chi tiết.'}</p><div class="kn-chips"><a class="kn-btn" href="${go}">Chọn khung giờ mong muốn</a><a class="kn-btn kn-btn-light" href="#ghep-noi">Xem gợi ý chuyên gia</a><button class="kn-link" data-screen="restart">Làm lại bảng hỏi</button></div>`;
    }
    function render(){
      const root=$('screen-app');
      if(state.phase==='intro'){
        root.innerHTML=`<h3>Bạn chủ động quyết định</h3><p>Bảng hỏi gồm 9 mục PHQ-9 và 7 mục GAD-7 về <strong>hai tuần qua</strong>. Câu hỏi an toàn ở đầu và mục 9 PHQ-9 sẽ được ưu tiên xử lý.</p><form id="screen-consent"><label class="kn-check"><input type="checkbox" name="adult" required ${state.adult?'checked':''}> Tôi từ 18 tuổi trở lên.</label><label class="kn-check"><input type="checkbox" name="processing" required ${state.processing?'checked':''}> Tôi đồng ý dùng câu trả lời trong tab này để tính điểm tham khảo và kiểm tra bước an toàn.</label><label class="kn-check"><input type="checkbox" name="storeScore" ${state.storeScore?'checked':''}> Tôi muốn lưu tổng điểm vào tài khoản nếu đã đăng nhập.</label><label class="kn-check"><input type="checkbox" name="saveDraft" ${state.saveDraft?'checked':''}> Lưu nháp trong tab để có thể quay lại trong 24 giờ. Không dùng trên máy chung.</label><fieldset><legend class="kn-h4">Ngay lúc này, bạn có cảm thấy không an toàn hoặc có ý định làm hại bản thân không?</legend><label class="kn-check"><input type="radio" name="immediate" value="no" required> Không</label><label class="kn-check"><input type="radio" name="immediate" value="yes" required> Có / Tôi cần hỗ trợ trực tiếp</label></fieldset><button class="kn-btn" type="submit">Tiếp tục theo lựa chọn</button></form><p class="kn-note mt-3">Bản Việt hoá tham khảo SBIRT Oregon; có diễn đạt lại một số câu. Cần chuyên gia duyệt trước khi dùng thật. Không có chẩn đoán hoặc tư vấn thuốc tự động.</p>`;
        $('screen-consent').addEventListener('submit',e=>{
          e.preventDefault();const f=new FormData(e.target);state.adult=f.has('adult');state.processing=f.has('processing');state.storeScore=f.has('storeScore');state.saveDraft=f.has('saveDraft');
          if(f.get('immediate')==='yes'){blocked('Bạn đã chọn rằng mình cần hỗ trợ trực tiếp ngay lúc này.');return;}
          state.phase='questions';persist();render();
        });
        return;
      }
      if(state.phase==='paused'){
        root.innerHTML=`<h3>Bạn có thể tạm dừng</h3><p>${state.saveDraft?'Nháp được giữ tạm trong tab này theo lựa chọn của bạn.':'Câu trả lời chỉ ở bộ nhớ trang; tải lại hoặc đóng trang sẽ làm mất phần đang làm.'}</p><button class="kn-btn" data-screen="resume">Tiếp tục</button> <button class="kn-link" data-screen="discard">Xoá nháp</button>`;return;
      }
      if(state.phase!=='questions')return;
      const i=state.index,isPHQ=i<9,question=isPHQ?D.screening.phq[i]:D.screening.gad[i-9];
      root.innerHTML=`<span class="kn-tag">${isPHQ?'PHQ-9':'GAD-7'} · Câu ${isPHQ?i+1:i-8}/${isPHQ?9:7}</span><div class="kn-screen-progress" aria-label="Đã tới câu ${i+1} trên 16"><span style="width:${(i+1)/16*100}%"></span></div><p class="kn-note">Trong hai tuần qua, điều sau xuất hiện với tần suất nào?</p><h3 id="screen-question" tabindex="-1">${esc(question)}</h3><div class="kn-screen-choices" role="group" aria-labelledby="screen-question">${D.screening.choices.map((x,n)=>`<button class="kn-answer" data-answer="${n}" aria-pressed="${state.answers[i]===n}">${n} · ${esc(x)}</button>`).join('')}</div><div class="kn-screen-nav"><button class="kn-btn kn-btn-light" data-screen="back">← Quay lại</button><button class="kn-link" data-screen="pause">Tạm dừng</button><button class="kn-btn" data-screen="next" ${state.answers[i]===null?'disabled':''}>${i===15?'Xem kết quả':'Tiếp tục →'}</button></div>`;
    }
    $('screen-app').addEventListener('click',e=>{
      const answer=e.target.closest('[data-answer]');
      if(answer){state.answers[state.index]=Number(answer.dataset.answer);if(state.index===8&&state.answers[8]>0){blocked('Mục an toàn trong bảng hỏi gợi ý cần có người hỗ trợ trực tiếp xem xét.');return;}persist();render();return;}
      const action=e.target.closest('[data-screen]')?.dataset.screen;if(!action)return;
      if(action==='sos'){K.sos();return;}
      if(action==='next'){if(state.answers[state.index]===null)return;if(state.index===15){result();return;}state.index++;persist();render();$('screen-question')?.focus();return;}
      if(action==='back'){if(state.index>0)state.index--;else state.phase='intro';persist();render();return;}
      if(action==='pause'){state.phase='paused';persist();render();return;}
      if(action==='resume'){state.phase='questions';render();return;}
      if(action==='discard'||action==='restart'){state=fresh();sessionStorage.removeItem('kene_screen_draft');sessionStorage.removeItem('kene_screening_state');render();}
    });
    const clearance=K.clearance();
    if(clearance?.allowed===false){state.adult=clearance.adult;state.phase='blocked';$('screen-app').innerHTML=`<h3>Luồng đặt lịch đang tạm dừng</h3><p>Bước an toàn trước đó gợi ý cần có người có chuyên môn xem lại. Website không tự xác nhận đã có người đánh giá.</p><button class="kn-btn" data-screen="sos">Xem hỗ trợ trực tiếp</button>`;}
    else render();
  }

  function blog(){
    let category='',query=params.get('search')||'',page=1;
    const size=9,categories=[...new Set(D.articles.map(p=>p.category))];
    $('blog-chips').innerHTML=`<button class="blog-chip active" data-blog-category="">Tất cả</button>${categories.map(c=>`<button class="blog-chip" data-blog-category="${esc(c)}">${esc(c)}</button>`).join('')}`;
    $('blog-search-input').value=query;
    function render(){
      const list=D.articles.filter(p=>(!category||p.category===category)&&(!query||K.fold(p.title+' '+p.excerpt+' '+p.category).includes(K.fold(query))));
      const pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages);
      $('blog-result-count').textContent=list.length+' bài viết'+(query?' theo từ khoá “'+query+'”':'');
      $('blog-grid').innerHTML=list.length?list.slice((page-1)*size,page*size).map(blogCard).join(''):empty('Chưa tìm thấy bài viết','Thử từ khoá khác hoặc chọn Tất cả.');
      $('blog-pag').innerHTML=pages>1?Array.from({length:pages},(_,i)=>`<button data-blog-page="${i+1}" class="${page===i+1?'active':''}" aria-label="Trang ${i+1}" ${page===i+1?'aria-current="page"':''}>${i+1}</button>`).join(''):'';
    }
    function open(id,push=true){
      const p=D.articles.find(p=>p.id===id);
      if(!p){K.toast('Không tìm thấy bài viết.');return;}
      $('blog-home-view').hidden=true;$('blog-detail-view').hidden=false;
      $('bdetail-hero-slot').innerHTML=`<div class="kn-article-hero"><div class="container"><span class="kn-tag">${esc(p.category)}</span><h1 class="mt-3">${esc(p.title)}</h1><p>${esc(p.author)} · 03/11/2026 · ${p.minutes} phút đọc</p><button class="kn-link" data-share-article="${p.id}">Sao chép liên kết bài viết</button></div></div>`;
      $('bdetail-body-slot').innerHTML=`${K.mediaImage(p.imageKey,p.title,{eager:true,sizes:"(max-width:900px) 100vw, 800px"})}<p class="mt-4">${esc(p.paragraphs[0])}</p><h2 id="bai-boi-canh">Nhìn vào bối cảnh cụ thể</h2><p>${esc(p.paragraphs[1])}</p><h2 id="bai-chu-dong">Những điều bạn có thể chủ động</h2><ul>${p.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h2 id="bai-tiep-theo">Một bước tiếp theo</h2><p>${esc(p.paragraphs[2])}</p><p class="kn-note">Nội dung do đội Kể Nè biên soạn để giới thiệu và chuẩn bị sử dụng dịch vụ. Không thay thế đánh giá, chẩn đoán hoặc hướng dẫn điều trị của người có chuyên môn.</p>`;
      $('article-toc').innerHTML='<h2 class="kn-h4">Trong bài này</h2><a class="d-block mb-2" href="#bai-boi-canh">Nhìn vào bối cảnh</a><a class="d-block mb-2" href="#bai-chu-dong">Điều bạn chủ động</a><a href="#bai-tiep-theo">Bước tiếp theo</a>';
      const related=D.articles.filter(x=>x.id!==p.id&&(x.topicId===p.topicId||x.category===p.category)).slice(0,3);
      $('bdetail-related-slot').innerHTML=`<h2 class="kn-h3 mb-4">Có thể bạn muốn đọc thêm</h2><div class="kn-grid-3">${related.map(blogCard).join('')}</div>`;
      if(push)history.pushState({},'','html_blog.html?post='+p.id);
      if(!K.profile()?.quiet)document.title=p.title+' | Kể Nè';
      scrollTo({top:0,behavior:'auto'});
    }
    function back(push=true){
      $('blog-home-view').hidden=false;$('blog-detail-view').hidden=true;$('read-progress-bar').style.width='0';
      if(push)history.pushState({},'','html_blog.html');render();if(!K.profile()?.quiet)document.title='Góc đọc | Kể Nè';
    }
    $('blog-search-form').addEventListener('submit',e=>{e.preventDefault();query=$('blog-search-input').value.trim();page=1;render();});
    $('blog-search-input').addEventListener('input',()=>{query=$('blog-search-input').value;page=1;render();});
    document.addEventListener('click',e=>{
      const cat=e.target.closest('[data-blog-category]');if(cat){category=cat.dataset.blogCategory;page=1;document.querySelectorAll('[data-blog-category]').forEach(b=>b.classList.toggle('active',b===cat));render();}
      const pag=e.target.closest('[data-blog-page]');if(pag){page=Number(pag.dataset.blogPage);render();$('blog-result-count').scrollIntoView({behavior:(window.KENE_EXPERIENCE?.reduced()?'auto':'smooth'),block:'start'});}
      if(e.target.closest('[data-action="blog-back"]'))back();
      const share=e.target.closest('[data-share-article]');if(share)K.copy(new URL('html_blog.html?post='+share.dataset.shareArticle,location.href).href);
      const a=e.target.closest('a[href]');if(a){try{const url=new URL(a.href);if(url.pathname.endsWith('/html_blog.html')&&url.searchParams.has('post')){e.preventDefault();open(url.searchParams.get('post'));}}catch(_){}}
    });
    window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('post');id?open(id,false):back(false);});
    window.addEventListener('scroll',()=>{
      if($('blog-detail-view').hidden)return;
      const article=$('bdetail-body-slot'),top=article.getBoundingClientRect().top+scrollY;
      const progress=Math.max(0,Math.min(1,(scrollY-top+150)/Math.max(1,article.offsetHeight-innerHeight+200)));
      $('read-progress-bar').style.width=progress*100+'%';
    },{passive:true});
    render();if(params.get('post'))open(params.get('post'),false);
  }
  function auth(){
    const next=K.safeNext(params.get('next'));
    function mode(value){
      const register=value==='register';$('register-form').hidden=!register;$('login-form').hidden=register;
      document.querySelectorAll('[data-auth-mode]').forEach(b=>{const on=b.dataset.authMode===value;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
      $('auth-message').innerHTML='';
    }
    document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>mode(b.dataset.authMode)));
    function recoveryModal(code,title,href){
      K.modal(title,`<p>Đây là mã khôi phục tài khoản <strong>trên thiết bị này</strong>. Phiên bản hiện tại không gửi email hay OTP. Hãy lưu mã nếu muốn dùng chức năng đặt lại mật khẩu.</p><div class="kn-voucher-code">${esc(code)}</div><div class="kn-chips"><button class="kn-btn" data-copy="${esc(code)}">Sao chép mã</button><a class="kn-btn kn-btn-light" href="${href}">Tiếp tục</a></div><p class="kn-note mt-3">Không có quyền truy cập từ thiết bị khác chỉ bằng email. Mã này không khôi phục được dữ liệu trình duyệt đã xoá.</p>`);
    }
    for(const id of ['login-form','register-form']){
      $(id).addEventListener('submit',async e=>{
        e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;
        $('auth-message').innerHTML='';
        try{
          const f=new FormData(e.target),values=Object.fromEntries(f);
          if(id==='register-form'){
            values.adult=f.has('adult');values.terms=f.has('terms');values.notifications=f.has('notifications');
            const result=await K.register(values);recoveryModal(result.recovery,'Tài khoản đã được tạo',next);
          }else{values.remember=f.has('remember');await K.login(values);location.href=next;}
        }catch(error){$('auth-message').innerHTML=alert(error.message,true);}
        finally{button.disabled=false;}
      });
    }
    document.addEventListener('click',e=>{
      if(!e.target.closest('[data-action="forgot-password"]'))return;
      const body=K.modal('Khôi phục tài khoản',`<p>Dùng mã khôi phục đã nhận khi tạo tài khoản. Không có email khôi phục thật được gửi.</p><form id="recovery-form"><label>Email<input type="email" name="email" required></label><label>Mã khôi phục<input name="recovery" required maxlength="100" autocomplete="off"></label><label>Mật khẩu mới<input type="password" name="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><label>Nhập lại mật khẩu<input type="password" name="confirm" required autocomplete="new-password"></label><p class="kn-note">Mật khẩu cần chữ hoa, chữ thường, số và ký tự đặc biệt.</p><div id="recovery-message"></div><button class="kn-btn" type="submit">Đặt lại mật khẩu</button></form>`);
      body.querySelector('form').addEventListener('submit',async event=>{
        event.preventDefault();const b=event.target.querySelector('button[type=submit]');b.disabled=true;
        try{const code=await K.resetPassword(Object.fromEntries(new FormData(event.target)));recoveryModal(code,'Đã đặt lại mật khẩu và đổi mã khôi phục','html_dangnhap_dangky.html');}
        catch(error){const message=body.querySelector('#recovery-message');if(message?.isConnected)message.innerHTML=alert(error.message,true);}
        finally{b.disabled=false;}
      });
    });
    mode(params.get('mode')==='register'?'register':'login');
  }
  function cart(){
    let removed=null,undoTimer=null;
    function render(){
      const rows=K.cart();
      $('cart-items').innerHTML=rows.length?rows.map(x=>{
        const s=service(x.serviceId),p=expert(x.expertId);
        if(!s||!p)return '';
        return `<article class="kn-cart-item"><div class="kn-cart-item-top">${K.mediaImage(s.imageKey,s.name,{sizes:"120px"})}<div><h2>${esc(s.name)}</h2><p>${esc(p.name)} · Định hướng ghép nối</p><p>${K.date(x.startMs)} · ${D.config.channels[x.channel]}</p><p>${s.sessions} buổi trong lựa chọn · ${K.money(s.price)}</p></div></div><div class="kn-chips mt-3"><button class="kn-link" data-cart-remove="${esc(x.lineId)}">Xoá lựa chọn</button><a class="kn-link" href="html_dichvu.html?id=${s.id}">Xem điều kiện</a></div></article>`;
      }).join(''):empty('Giỏ dịch vụ đang trống','Chọn dịch vụ rồi chọn chuyên gia và giờ dự kiến.','html_dichvu.html','Xem dịch vụ');
      let code=K.read('kene_applied_voucher','',true),totals;
      try{totals=K.repo.totals(rows,code,K.getUser()?.id);}
      catch(error){K.write('kene_applied_voucher','',true);code='';$('cart-coupon-result').innerHTML=alert(error.message,true);totals=K.repo.totals(rows,'',K.getUser()?.id);}
      $('cart-summary').innerHTML=summaryHTML(totals);
      $('cart-coupon').value=code;
      const checkout=document.querySelector('[data-action="checkout"]');checkout.disabled=!rows.length;
      K.syncHeader();
    }
    function apply(code){
      try{
        const result=K.repo.totals(K.cart(),code,K.getUser()?.id);
        K.write('kene_applied_voucher',result.coupon,true);
        $('cart-coupon-result').innerHTML=alert('Đã áp dụng cho các phiên đủ điều kiện: giảm '+K.money(result.discount)+'.');
        render();
      }catch(error){$('cart-coupon-result').innerHTML=alert(error.message,true);}
    }
    $('cart-coupon-form').addEventListener('submit',e=>{e.preventDefault();apply($('cart-coupon').value);});
    document.addEventListener('click',e=>{
      const remove=e.target.closest('[data-cart-remove]');
      if(remove){
        const rows=K.cart(),index=rows.findIndex(x=>x.lineId===remove.dataset.cartRemove);
        if(index<0)return;removed={item:rows[index],index};rows.splice(index,1);K.saveCart(rows);
        clearTimeout(undoTimer);$('undo-toast').hidden=false;undoTimer=setTimeout(()=>{removed=null;$('undo-toast').hidden=true;},5000);
      }
      if(e.target.closest('[data-action="undo-cart"]')&&removed){
        const rows=K.cart();if(rows.some(x=>E.overlaps(x,removed.item))){K.toast('Khung đã trùng với lựa chọn khác.');return;}
        rows.splice(Math.min(removed.index,rows.length),0,removed.item);removed=null;clearTimeout(undoTimer);$('undo-toast').hidden=true;K.saveCart(rows);
      }
      if(e.target.closest('[data-action="checkout"]'))beginCheckout();
      if(e.target.closest('[data-action="best-coupon"]'))apply('KENENGAY15');
    });
    document.addEventListener('kene:change',render);
    render();
  }
  async function checkout(){
    const u=K.requireUser('html_thanhtoan.html');if(!u)return;
    let holdId=K.read('kene_current_hold',null,true),hold=holdId?K.repo.getHold(u.id,holdId):null,done=false,busy=false,timer;
    if(!hold&&K.cart().length){hold=await beginCheckout(false);holdId=hold?.id;}
    function noHold(){
      $('checkout-form').hidden=true;$('checkout-empty').hidden=false;
      $('checkout-empty').innerHTML=empty('Chưa có khung giờ đang giữ','Giữ chỗ có thể đã hết hạn hoặc chưa được tạo. Bạn có thể kiểm tra lại lựa chọn.','html_giohang.html','Về giỏ dịch vụ');
    }
    if(!hold){noHold();return;}
    $('checkout-nickname').value=u.nickname;$('checkout-email').value=u.email;
    $('checkout-notify').checked=!!K.profile().notifications;
    $('checkout-items').innerHTML=hold.items.map(x=>`<div class="kn-cart-item"><h2 class="kn-h3">${esc(service(x.serviceId).name)}</h2><p>${esc(expert(x.expertId).name)} · Thông tin đang cập nhật</p><p>${K.date(x.startMs)} · ${D.config.channels[x.channel]} · ${x.sessions} buổi/gói</p></div>`).join('');
    let code=K.read('kene_applied_voucher','',true);
    function prices(){
      let totals;
      try{totals=K.repo.totals(hold.items,code,u.id);}
      catch(error){code='';K.write('kene_applied_voucher','',true);$('checkout-coupon-result').innerHTML=alert(error.message,true);totals=K.repo.totals(hold.items,'',u.id);}
      $('checkout-summary').innerHTML=summaryHTML(totals);$('checkout-coupon').value=code;
    }
    function tick(){
      if(done)return;
      const live=K.repo.getHold(u.id,holdId),remaining=live?live.expiresAt-Date.now():0;
      if(remaining<=0){$('hold-message').textContent='Giữ chỗ đã hết hạn. Vui lòng kiểm tra lại giỏ để chọn khung giờ.';$('place-order').disabled=true;clearInterval(timer);return;}
      const seconds=Math.ceil(remaining/1000);
      $('hold-message').textContent='Khung giờ đang được giữ · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' còn lại';
    }
    prices();tick();timer=setInterval(tick,1000);
    document.addEventListener('visibilitychange',tick);window.addEventListener('pagehide',()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);},{once:true});

    function applyCoupon(){
      const requested=$('checkout-coupon').value.trim().toUpperCase();
      try{const t=K.repo.totals(hold.items,requested,u.id);code=t.coupon;K.write('kene_applied_voucher',code,true);$('checkout-coupon-result').innerHTML=alert('Đã kiểm tra điều kiện: giảm '+K.money(t.discount)+'.');prices();}
      catch(error){$('checkout-coupon-result').innerHTML=alert(error.message,true);}
    }
    $('checkout-coupon').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCoupon();}});
    document.addEventListener('click',e=>{if(e.target.closest('[data-action="checkout-coupon"]'))applyCoupon();});
    $('checkout-form').addEventListener('submit',async e=>{
      e.preventDefault();if(busy||done)return;busy=true;$('place-order').disabled=true;
      try{
        if(!$('checkout-terms').checked)throw new Error('Vui lòng xem và đồng ý điều kiện phiên bản hiện tại.');
        const nickname=$('checkout-nickname').value.trim(),email=$('checkout-email').value.trim();
        if(nickname.length<2||!K.validEmail(email))throw new Error('Kiểm tra lại biệt danh và email trên thiết bị.');
        const method='after_confirmation';
        const order=await K.lock(()=>K.repo.confirm(u.id,holdId,code,K.clearance(),method));
        done=true;clearInterval(timer);K.saveCart([]);K.saveProfile({notifications:$('checkout-notify').checked});
        sessionStorage.removeItem('kene_current_hold');sessionStorage.removeItem('kene_applied_voucher');
        $('checkout-form').hidden=true;$('checkout-success').hidden=false;
        $('checkout-success').innerHTML=`<span class="kn-big-icon">💙</span><h1>Đã lưu yêu cầu của bạn</h1><p>Mã đơn: <strong>${esc(order.id)}</strong></p><p>Giá trị tham khảo: <strong>${K.money(order.total)}</strong></p><p>Yêu cầu được lưu trên thiết bị này, chưa được gửi đến chuyên gia. Chưa có lịch hoặc giao dịch thanh toán được xác nhận.</p><div class="kn-chips justify-content-center mt-4"><a class="kn-btn" href="html_thongtin.html?tab=bookings">Xem lịch hẹn của tôi</a>${order.appointments.map(x=>`<button class="kn-btn kn-btn-light" data-success-ics="${x.id}">Thêm lịch trung tính (.ics)</button>`).join('')}<button class="kn-btn kn-btn-light" data-success-receipt>Tải tóm tắt yêu cầu</button></div>`;
        $('checkout-success').addEventListener('click',event=>{
          const btn=event.target.closest('[data-success-ics]');if(btn)K.ics(order,order.appointments.find(a=>a.id===btn.dataset.successIcs));
          if(event.target.closest('[data-success-receipt]'))K.download('yeu-cau-ke-ne-'+order.id+'.json',JSON.stringify(order,null,2));
        });
        K.confetti();scrollTo({top:0,behavior:(window.KENE_EXPERIENCE?.reduced()?'auto':'smooth')});
      }catch(error){K.toast(error.message,7000);}
      finally{busy=false;if(!done)$('place-order').disabled=!K.repo.getHold(u.id,holdId);}
    });
  }
  function voucherCard(c){
    const used=K.getUser()?K.repo.orders(K.getUser().id).some(o=>o.coupon===c.code):false;
    return `<article class="kn-voucher">${K.mediaImage(c.imageKey,c.title,{className:"ke-voucher-photo"})}<div class="kn-voucher-top"><span>${c.icon}</span><h3>${esc(c.title)}</h3></div><div class="kn-voucher-body"><span class="kn-tag mb-3">${esc(c.category)}</span><p>${esc(c.description)}</p>${c.kind==='discount'?`<div class="kn-voucher-code">${c.code}</div><div class="kn-chips"><button class="kn-btn" data-copy="${c.code}">Sao chép</button><button class="kn-btn kn-btn-light" data-save-voucher="${c.id}" ${used?'disabled':''}>${used?'Đã sử dụng':'Lưu mã'}</button></div><small class="kn-note mt-3">Mã ưu đãi ban ngày theo điều kiện hiển thị. Mỗi tài khoản dùng một lần.</small>`:`<a class="kn-btn" href="${c.link}">Gửi yêu cầu tìm hiểu</a>`}</div></article>`;
  }
  function promo(){
    let filter='';
    $('voucher-filters').innerHTML=`<button class="kn-chip active" data-voucher-category="">Tất cả</button>${[...new Set(D.coupons.map(c=>c.category))].map(c=>`<button class="kn-chip" data-voucher-category="${c}">${c}</button>`).join('')}`;
    function render(){$('voucher-grid').innerHTML=D.coupons.filter(c=>!filter||c.category===filter).map(voucherCard).join('');}
    document.addEventListener('click',e=>{const b=e.target.closest('[data-voucher-category]');if(b){filter=b.dataset.voucherCategory;document.querySelectorAll('[data-voucher-category]').forEach(x=>x.classList.toggle('active',x===b));render();}});
    document.addEventListener('kene:change',render);render();
  }

  function account(){
    if(!K.requireUser('html_thongtin.html'+location.search))return;
    let filter='all',tab=['overview','bookings','wishlist','vouchers','settings'].includes(params.get('tab'))?params.get('tab'):'overview';
    const cc=K.clearance();
    if(cc?.storeScore&&cc.scores&&!K.profile().screenings.some(x=>x.at===cc.at))
      K.saveProfile({screenings:K.profile().screenings.concat({...cc.scores,at:cc.at}).slice(-12)});
    function switchTab(next){
      if(!['overview','bookings','wishlist','vouchers','settings'].includes(next))return;
      tab=next;
      document.querySelectorAll('.tab-panel').forEach(p=>{const on=p.id==='tab-'+tab;p.hidden=!on;p.classList.toggle('active',on);});
      document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');});
      history.replaceState({},'','html_thongtin.html?tab='+tab);
    }
    function status(a){
      if(a.status==='cancelled')return 'Đã huỷ lịch';
      if(a.status==='cancellation_requested')return 'Yêu cầu huỷ cần xem xét';
      if(a.status==='completed')return 'Đã phản hồi sau phiên dự kiến';
      if(Date.now()>a.startMs+a.minutes*60000)return 'Đến lượt phản hồi';
      return 'Yêu cầu đã lưu';
    }
    function buttons(order,a){
      const attrs=`data-order="${order.id}" data-appt="${a.id}"`;
      return `<div class="kn-booking-actions"><button class="kn-btn kn-btn-light" data-booking-action="detail" ${attrs}>Chi tiết</button><button class="kn-btn kn-btn-light" data-booking-action="ics" ${attrs}>Tải lịch .ics</button>${a.status==='requested'?`<button class="kn-btn" data-booking-action="room" ${attrs}>Chuẩn bị trước phiên</button><button class="kn-btn kn-btn-light" data-booking-action="reschedule" ${attrs}>Đổi lịch</button><button class="kn-btn kn-btn-light" data-booking-action="cancel" ${attrs}>Huỷ lịch</button>`:''}${Date.now()>=a.startMs+a.minutes*60000&&['requested','completed'].includes(a.status)?`<button class="kn-btn kn-btn-light" data-booking-action="feedback" ${attrs}>Phản hồi riêng</button>`:''}<button class="kn-btn kn-btn-light" data-booking-action="issue" ${attrs}>Ghi nhận ghi chú sự cố</button></div>`;
    }
    function render(){
      const u=K.getUser();if(!u){K.requireUser('html_thongtin.html');return;}
      const p=K.profile(),orders=K.repo.orders(u.id);
      $('account-name').textContent=u.nickname;
      const bits=u.email.split('@');$('account-email').textContent=bits[0].slice(0,1)+'***@'+(bits[1]||'');
      const avatar=$('account-avatar');
      if(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.avatar))avatar.innerHTML=`<img src="${p.avatar}" alt="Ảnh đại diện tài khoản">`;
      else avatar.textContent=u.nickname.slice(0,2).toUpperCase();
      const appointments=orders.flatMap(o=>o.appointments.map(a=>({...a,order:o})));
      const next=appointments.filter(a=>a.status==='requested'&&a.startMs>=Date.now()).sort((a,b)=>a.startMs-b.startMs)[0];
      $('account-stats').innerHTML=[[appointments.filter(a=>a.status==='requested').length,'Yêu cầu đã lưu đã xác nhận'],[p.wishlist.length,'Dịch vụ đã lưu'],[p.vouchers.length,'Mã đã lưu']].map(([n,label])=>`<div class="kn-stat-card"><strong>${n}</strong><span>${label}</span></div>`).join('');
      $('next-appointment').innerHTML=next?`<article class="kn-booking-card"><span class="kn-tag">Yêu cầu đã lưu gần nhất</span><h3>${esc(service(next.serviceId).name)}</h3><p>${K.date(next.startMs)} · ${esc(expert(next.expertId).name)}</p><a class="kn-btn" href="html_thongtin.html?tab=bookings">Xem lịch hẹn</a></article>`:empty('Chưa có lịch hẹn sắp tới','Bạn có thể tìm hiểu dịch vụ và chọn một khung giờ mong muốn.','html_dichvu.html','Tìm hiểu dịch vụ');
      const moods=p.moods.slice(-12);
      if(moods.length>=2){
        const points=moods.map((m,i)=>`${25+i*(430/(moods.length-1))},${130-(Number(m.value)-1)*25}`).join(' ');
        $('mood-chart').innerHTML=`<svg class="kn-mood-chart" viewBox="0 0 480 160" role="img" aria-label="Nhật ký tâm trạng tự ghi, không phải chỉ số lâm sàng"><path d="M25 130H455M25 80H455M25 30H455" stroke="#cedfe9" fill="none"></path><polyline points="${points}" fill="none" stroke="#0077b6" stroke-width="3" stroke-linecap="round"></polyline>${moods.map((m,i)=>`<circle cx="${25+i*(430/(moods.length-1))}" cy="${130-(Number(m.value)-1)*25}" r="4" fill="#0077b6"><title>${esc(K.shortDate(m.at))}: ${m.value}/5</title></circle>`).join('')}<text x="2" y="135" font-size="10">1</text><text x="2" y="35" font-size="10">5</text></svg><p class="kn-note">Các bản ghi do bạn tự chọn, không phải thang chẩn đoán hoặc bằng chứng hiệu quả điều trị.</p><ul class="kn-note">${moods.slice(-3).map(m=>`<li>${esc(K.shortDate(m.at))} · ${m.value}/5${m.note?' · '+esc(m.note):''}</li>`).join('')}</ul>`;
      }else $('mood-chart').innerHTML=alert(moods.length?'Đã có một bản ghi. Biểu đồ sẽ xuất hiện khi có ít nhất hai lần ghi.':'Chưa có ghi chú. Bạn không cần ghi mỗi ngày.');
      $('screening-history').innerHTML=p.screenings.length?`<div class="kn-compare-wrap"><table class="kn-compare"><caption>Tổng điểm bạn đã chủ động chọn lưu</caption><thead><tr><th>Thời điểm</th><th>PHQ-9 / 27</th><th>GAD-7 / 21</th></tr></thead><tbody>${p.screenings.map(s=>`<tr><td>${K.date(s.at)}</td><td>${s.phq}</td><td>${s.gad}</td></tr>`).join('')}</tbody></table></div><p class="kn-note mt-3">Điểm chỉ mở đầu trao đổi, không phải chẩn đoán. Phiên bản hiện tại chưa chia sẻ với chuyên gia thật.</p>`:alert('Chưa có tổng điểm được chọn lưu. Bạn có thể làm sàng lọc mà không lưu lịch sử.');
      $('booking-list').innerHTML=orders.length?orders.map(order=>{
        const list=order.appointments.filter(a=>filter==='all'||a.status===filter);
        const appts=list.map(a=>`<article class="kn-booking-card"><span class="kn-tag">${status(a)}</span><h3>${esc(service(a.serviceId).name)}</h3><p>${K.date(a.startMs)} · ${D.config.channels[a.channel]}</p><p>${esc(expert(a.expertId).name)} · Thông tin đang cập nhật</p><p>Mã đơn: ${esc(order.id)} · Mã lịch: ${esc(a.id)}</p>${a.issue?'<p class="kn-note">Đã ghi nhận ghi chú sự cố; chưa gửi tới nhân viên.</p>':''}${a.feedback?`<p class="kn-note">Phản hồi riêng đã lưu: ${a.feedback.score}/5</p>`:''}${buttons(order,a)}</article>`).join('');
        const packages=filter==='all'?order.items.map((item,i)=>{
          if(item.sessions<2)return '';
          const used=order.appointments.filter(a=>a.itemIndex===i&&a.status!=='cancelled').length,completed=order.appointments.filter(a=>a.itemIndex===i&&a.status==='completed').length;
          return `<div class="kn-white-card mb-4"><h3 class="kn-h3">Gói 6 buổi · ${esc(order.id)}</h3><p>Đã đặt ${used}/${item.sessions} buổi · Phản hồi sau ${completed} buổi dự kiến.</p><div class="kn-package-progress"><span style="width:${completed/item.sessions*100}%"></span></div>${used<item.sessions?`<button class="kn-btn" data-next-package="${i}" data-order="${order.id}">Chọn buổi tiếp theo · Không tính tiền lại</button>`:'<p>Đã đặt đủ số buổi trong gói.</p>'}</div>`;
        }).join(''):'';
        return appts+packages;
      }).join(''):empty('Chưa có yêu cầu lịch hẹn','Các lịch bạn tạo sẽ được hiển thị tại đây.','html_dichvu.html','Xem dịch vụ');
      if(orders.length&&!$('booking-list').textContent.trim())$('booking-list').innerHTML=empty('Không có lịch trong trạng thái này','Bạn có thể chọn bộ lọc Tất cả.');
      const wished=p.wishlist.map(service).filter(Boolean);
      $('account-wishlist').innerHTML=wished.length?wished.map(serviceCard).join(''):empty('Chưa có dịch vụ đã lưu','Chạm biểu tượng trái tim để lưu một lựa chọn.','html_dichvu.html','Xem dịch vụ');
      const vouchers=p.vouchers.map(id=>D.coupons.find(c=>c.id===id)).filter(Boolean);
      $('account-vouchers').innerHTML=vouchers.length?`<div class="kn-grid-3">${vouchers.map(voucherCard).join('')}</div>`:empty('Chưa lưu mã ưu đãi','Bạn có thể xem điều kiện trước khi lưu.','html_khuyenmaivatiepthi.html','Xem ưu đãi');
      const f=$('profile-form');
      if(!f.dataset.dirty){f.elements.nickname.value=u.nickname;f.elements.email.value=u.email;f.elements.quiet.checked=!!p.quiet;f.elements.notifications.checked=!!p.notifications;}
      const passport=$('passport-form');
      if(!passport.dataset.dirty){passport.elements.story.value=p.passport.story||'';passport.elements.preference.value=p.passport.preference||'';passport.elements.share.checked=!!p.passport.share;}
      K.syncHeader();switchTab(tab);
    }
    K.refreshAccount=render;
    $('mood-form').addEventListener('submit',e=>{
      e.preventDefault();const f=new FormData(e.target),value=Number(f.get('mood'));
      if(!f.has('consent')||!Number.isInteger(value)||value<1||value>5){K.toast('Chọn tâm trạng và đồng ý lưu phiên bản hiện tại.');return;}
      const p=K.profile();K.saveProfile({moods:p.moods.concat({value,note:String(f.get('note')||'').trim().slice(0,150),at:Date.now()}).slice(-30)});
      e.target.reset();K.toast('Đã lưu bản ghi bạn chọn.');
    });
    $('passport-form').addEventListener('input',e=>e.currentTarget.dataset.dirty='true');
    $('passport-form').addEventListener('submit',e=>{
      e.preventDefault();const f=new FormData(e.target);if(!f.has('consent'))return;
      delete e.target.dataset.dirty;
      K.saveProfile({passport:{story:String(f.get('story')||'').trim().slice(0,500),preference:String(f.get('preference')||'').trim().slice(0,120),share:f.has('share'),at:Date.now()}});
      K.toast('Đã lưu bản tóm tắt trên thiết bị.');
    });
    $('profile-form').addEventListener('input',e=>e.currentTarget.dataset.dirty='true');
    $('profile-form').addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.target);
      try{await K.updateIdentity({nickname:f.get('nickname'),email:f.get('email'),quiet:f.has('quiet'),notifications:f.has('notifications')});delete e.target.dataset.dirty;render();K.toast('Đã lưu thay đổi tài khoản.');}
      catch(error){K.toast(error.message);}
    });
    $('avatar-input').addEventListener('change',async e=>{
      const file=e.target.files[0];if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){K.toast('Chọn PNG, JPG hoặc WebP không quá 5 MB.');e.target.value='';return;}
      const url=URL.createObjectURL(file);
      try{
        const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
        if(image.naturalWidth>10000||image.naturalHeight>10000)throw new Error('Ảnh quá lớn; chọn ảnh có kích thước nhỏ hơn.');
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
        const context=canvas.getContext('2d'),size=Math.min(image.naturalWidth,image.naturalHeight);
        context.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,256,256);
        K.saveProfile({avatar:canvas.toDataURL('image/webp',.8)});K.toast('Đã lưu ảnh đại diện trên thiết bị.');
      }catch(error){K.toast(error.message||'Không đọc được ảnh.');}
      finally{URL.revokeObjectURL(url);}
    });
    $('password-form').addEventListener('submit',async e=>{
      e.preventDefault();try{await K.changePassword(Object.fromEntries(new FormData(e.target)));e.target.reset();}catch(error){K.toast(error.message);}
    });
    document.addEventListener('click',async e=>{
      const t=e.target.closest('[data-tab]');if(t){switchTab(t.dataset.tab);return;}
      const filterButton=e.target.closest('[data-booking-filter]');
      if(filterButton){filter=filterButton.dataset.bookingFilter;document.querySelectorAll('[data-booking-filter]').forEach(b=>b.classList.toggle('active',b===filterButton));render();return;}
      const packageButton=e.target.closest('[data-next-package]');
      if(packageButton){
        const order=K.repo.orders(K.getUser().id).find(o=>o.id===packageButton.dataset.order),i=Number(packageButton.dataset.nextPackage),item=order?.items[i];
        if(item)K.startBooking(item.serviceId,item.expertId,{mode:'prepaid',orderId:order.id,itemIndex:i});return;
      }
      const actionButton=e.target.closest('[data-booking-action]');
      if(actionButton){
        const order=K.repo.orders(K.getUser().id).find(o=>o.id===actionButton.dataset.order),a=order?.appointments.find(a=>a.id===actionButton.dataset.appt);
        if(!order||!a){K.toast('Không tìm thấy lịch của tài khoản này.');return;}
        const action=actionButton.dataset.bookingAction;
        try{
          if(action==='ics')K.ics(order,a);
          if(action==='detail')K.modal('Chi tiết lịch dự kiến',`<h3 class="kn-h3">${esc(service(a.serviceId).name)}</h3><p>${K.date(a.startMs)} · ${esc(expert(a.expertId).name)}</p><p>Trạng thái: ${status(a)}</p><p>Đơn ${esc(order.id)} · Giá trị tham khảo ${K.money(order.total)}</p><p class="kn-note">Yêu cầu chỉ được lưu trên thiết bị và chưa được gửi đến chuyên gia. Chưa có thanh toán phát sinh.</p><button class="kn-btn" id="receipt-download">Tải tóm tắt yêu cầu</button>`).querySelector('#receipt-download').addEventListener('click',()=>K.download('yeu-cau-ke-ne-'+order.id+'.json',JSON.stringify(order,null,2)));
          if(action==='reschedule'){
            if(a.startMs-Date.now()<D.config.rescheduleHours*3600000){K.toast('Còn dưới 12 giờ. Vui lòng tạo yêu cầu hỗ trợ để được xem xét.');return;}
            K.startBooking(a.serviceId,a.expertId,{mode:'reschedule',orderId:order.id,appointmentId:a.id});
          }
          if(action==='cancel'){
            const body=K.modal('Bạn muốn huỷ lịch dự kiến này?',`<p>${K.date(a.startMs)} · ${esc(service(a.serviceId).name)}</p><p>Trong phiên bản hiện tại, yêu cầu hoàn tiền chỉ được ghi nhận để xem xét; không có tiền thật được hoàn. Nếu còn dưới 12 giờ, yêu cầu huỷ chưa tự giải phóng khung.</p><button class="kn-btn kn-btn-danger" id="confirm-cancel">Xác nhận huỷ lịch dự kiến</button>`);
            body.querySelector('button').addEventListener('click',async()=>{
              try{const result=await K.lock(()=>K.repo.cancel(K.getUser().id,order.id,a.id));K.closeModal();render();K.toast(result.status==='cancelled'?'Đã huỷ lịch dự kiến. Yêu cầu hoàn phí cần được xem xét.':'Đã ghi yêu cầu huỷ muộn trong phiên bản hiện tại.');}catch(error){K.toast(error.message);}
            });
          }
          if(action==='room')room(order,a);
          if(action==='feedback'){
            const body=K.modal('Phản hồi riêng sau phiên dự kiến',`<p>Phản hồi được giữ trong tài khoản, không hiển thị thành đánh giá khách hàng thật.</p><form id="feedback-form"><label>Mức hài lòng<select name="score" required><option value="">Chọn mức</option><option value="1">1 — Chưa phù hợp</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 — Phù hợp</option></select></label><button class="kn-btn" type="submit">Lưu phản hồi</button></form>`);
            body.querySelector('form').addEventListener('submit',async event=>{
              event.preventDefault();try{await K.lock(()=>K.repo.feedback(K.getUser().id,order.id,a.id,Number(new FormData(event.target).get('score'))));K.closeModal();render();K.toast('Đã lưu phản hồi riêng.');}catch(error){K.toast(error.message);}
            });
          }
          if(action==='issue'){
            await K.lock(()=>K.repo.issue(K.getUser().id,order.id,a.id));render();
            K.modal('Đã ghi nhận ghi chú sự cố',`<p>Mã lịch: ${esc(a.id)}</p><p>Yêu cầu chỉ được lưu trong trình duyệt, chưa gửi nhân viên. Kể Nè đặt mục tiêu xử lý hoàn phiên do lỗi hệ thống trong 48 giờ; phiên bản hiện tại không xác nhận đã hoàn tiền.</p><a class="kn-btn" href="html_lienhe_chinhsach.html?topic=doi-lich">Tìm hiểu hỗ trợ</a>`);
          }
        }catch(error){K.toast(error.message);}
        return;
      }
      const action=e.target.closest('[data-action]')?.dataset.action;
      if(action==='export-data'){
        const u=K.getUser();K.download('du-lieu-ke-ne-cua-toi.json',JSON.stringify({exportedAt:new Date().toISOString(),user:u,profile:K.profile(),orders:K.repo.orders(u.id)},null,2));return;
      }
      if(action==='clear-moods'){
        const body=K.modal('Xoá các ghi chú tâm trạng?',`<p>Các ghi chú tâm trạng trên thiết bị của tài khoản này sẽ được xoá khỏi thiết bị.</p><button class="kn-btn kn-btn-danger" id="confirm-clear-moods">Xoá ghi chú</button>`);
        body.querySelector('button').addEventListener('click',()=>{K.saveProfile({moods:[]});K.closeModal();K.toast('Đã xoá ghi chú tâm trạng.');});return;
      }
      if(action==='clear-sensitive'){
        const body=K.modal('Xoá ghi chú và điểm đã lưu?',`<p>Xoá nhật ký tâm trạng, tổng điểm sàng lọc và Hộ chiếu câu chuyện. Yêu cầu lịch hẹn và thông tin tài khoản được quản lý riêng.</p><button class="kn-btn kn-btn-danger" id="confirm-clear-sensitive">Xoá dữ liệu đã chọn</button>`);
        body.querySelector('button').addEventListener('click',()=>{K.clearSensitiveData();K.closeModal();K.toast('Đã xoá các dữ liệu đã chọn.');});return;
      }
      if(action==='delete-account'){
        const body=K.modal('Xoá tài khoản?',`<p>Tài khoản, giỏ dịch vụ, lịch hẹn và thông tin đã lưu của chính tài khoản này sẽ được xoá trên thiết bị. Tài khoản khác không bị xoá.</p><button class="kn-btn kn-btn-danger" id="confirm-delete-account">Xoá tài khoản này</button>`);
        body.querySelector('button').addEventListener('click',async()=>{try{await K.deleteAccount();}catch(error){K.toast(error.message);}});return;
      }
    });
    function room(order,a){
      let camera;const dispose=()=>{camera?.dispose();window.removeEventListener('pagehide',dispose);};
      const body=K.modal('Chuẩn bị trước phiên — '+K.shortDate(a.startMs),`<span class="kn-tag">Chuẩn bị thiết bị của bạn</span><p>${K.date(a.startMs)} · ${esc(expert(a.expertId).name)}</p><video id="preview-video" autoplay playsinline muted hidden style="width:100%;max-height:260px;border-radius:15px;background:#eaf5fa"></video><p id="device-status">Chưa bật camera hoặc micro. Chỉ kiểm tra thiết bị nếu bạn chủ động chọn.</p><div class="kn-chips"><button class="kn-btn" id="try-camera">Thử camera cục bộ</button><button class="kn-btn kn-btn-light" id="stop-camera">Tắt thiết bị</button></div><p class="kn-note mt-3">Hình ảnh không được gửi tới máy chủ hoặc ghi hình. Cuộc gọi trực tuyến và thông báo nhắc lịch chưa được kích hoạt.</p><h3 class="kn-h4 mt-4">Điều muốn nói hôm nay</h3><p>${K.profile().passport.share?esc(K.profile().passport.story||'Chưa có bản tóm tắt được chọn hiển thị.'):'Bạn chưa chọn hiển thị Hộ chiếu câu chuyện trong phần chuẩn bị.'}</p>`,dispose);
      const video=body.querySelector('#preview-video'),status=body.querySelector('#device-status'),start=body.querySelector('#try-camera');
      camera=window.KeneRuntime.createCameraPreview({requestMedia:()=>navigator.mediaDevices?.getUserMedia?navigator.mediaDevices.getUserMedia({video:true,audio:false}):Promise.reject(new Error('Trình duyệt chưa hỗ trợ camera ở địa chỉ này.')),isCurrent:()=>video.isConnected&&!document.getElementById('kn-modal').hidden,onBusy:b=>{if(start.isConnected)start.disabled=b;},onReady:stream=>{video.srcObject=stream;video.hidden=false;status.textContent='Camera đang được xem trước trên thiết bị; chưa có cuộc gọi được kết nối.';},onError:error=>{status.textContent='Chưa bật được camera: '+error.message;}});
      start.addEventListener('click',()=>camera.start());body.querySelector('#stop-camera').addEventListener('click',()=>{camera.stop();video.srcObject=null;video.hidden=true;status.textContent='Thiết bị đã tắt.';});window.addEventListener('pagehide',dispose,{once:true});
    }
    document.addEventListener('kene:change',render);render();
  }
  function contact(){
    const topicValues=Array.from($('contact-topic').options).map(x=>x.value);
    const requested=params.get('topic');
    if(topicValues.includes(requested))$('contact-topic').value=requested;
    else if(service(requested)){$('contact-topic').value='dich-vu';$('contact-form').elements.message.value='Tôi muốn tìm hiểu: '+service(requested).name+'.';}
    const user=K.getUser();if(user){$('contact-form').elements.nickname.value=user.nickname;$('contact-form').elements.email.value=user.email;}
    $('contact-form').addEventListener('submit',e=>{
      e.preventDefault();const values=Object.fromEntries(new FormData(e.target));
      if(!values.consent||!K.validEmail(values.email)||String(values.message).trim().length<10){$('contact-result').innerHTML=alert('Kiểm tra email, nội dung tối thiểu 10 ký tự và lựa chọn đồng ý.',true);return;}
      const request={id:K.uid('YC'),at:Date.now(),nickname:String(values.nickname).trim().slice(0,50),email:String(values.email).trim().slice(0,150),topic:values.topic,organization:String(values.organization||'').trim().slice(0,150),message:String(values.message).trim().slice(0,500),deliveryStatus:'not_sent'};
      try{
        if(K.getUser()){const p=K.profile();K.saveProfile({inquiries:(p.inquiries||[]).concat(request).slice(-20)});}
        else{const old=K.read('kene_guest_inquiries',[],true);K.write('kene_guest_inquiries',old.concat(request).slice(-10),true);}
        $('contact-result').innerHTML=alert('Đã lưu lời nhắn '+request.id+'. Nội dung được lưu trên thiết bị, chưa gửi đến bộ phận tiếp nhận.');
        e.target.reset();
      }catch(error){$('contact-result').innerHTML=alert(error.message,true);}
    });
    const headings=Array.from($('policy-content').querySelectorAll('h3[id]'));
    $('policy-toc').innerHTML=`<label for="policy-search">Tìm trong chính sách</label><input id="policy-search" placeholder="Nhập từ khoá…" maxlength="100"><div id="policy-search-results"></div>${headings.map(h=>`<a href="#${h.id}">${esc(h.textContent)}</a>`).join('')}`;
    $('policy-search').addEventListener('input',e=>{
      const q=K.fold(e.target.value);
      if(!q){$('policy-search-results').innerHTML='';return;}
      const matches=headings.filter(h=>{let text=h.textContent;for(let n=h.nextElementSibling;n&&n.tagName!=='H3';n=n.nextElementSibling)text+=' '+n.textContent;return K.fold(text).includes(q);});
      $('policy-search-results').innerHTML=matches.length?`<p class="kn-note mt-2">${matches.length} mục phù hợp</p>${matches.map(h=>`<a href="#${h.id}">${esc(h.textContent)}</a>`).join('')}`:'<p class="kn-note mt-2">Chưa có mục phù hợp.</p>';
    });
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-action="print-policy"]')){
        const copy=$('policy-content').cloneNode(true);
        copy.removeAttribute('id');
        copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
        K.modal('Chính sách Kể Nè',copy.outerHTML);
        document.body.classList.add('kn-print-policy');
        window.addEventListener('afterprint',()=>document.body.classList.remove('kn-print-policy'),{once:true});
        setTimeout(()=>window.print(),100);
      }
    });
    function b2b(){
      const value=Number($('b2b-size').value);
      if(!Number.isInteger(value)||value<1||value>1000){$('b2b-result').innerHTML=alert('Nhập số nguyên từ 1 đến 1.000.',true);return;}
      $('b2b-result').innerHTML=value<D.config.minimumB2BGroup?alert('Ẩn báo cáo: nhóm dưới 10 người. Không có dữ liệu cá nhân được xuất.'):
        alert('Nhóm giả lập đủ ngưỡng 10 người để xem xét báo cáo tổng hợp. Vẫn cần kiểm soát nhóm con, truy vấn lặp và tái nhận diện. Không có số liệu hiệu quả thật trong công cụ này.');
    }
    $('b2b-form').addEventListener('submit',e=>{e.preventDefault();b2b();});b2b();
  }
  function init(){
    const page=document.body.dataset.page;
    const controllers={home,intro,services,experts,blog,auth,cart,checkout,account,promo,contact,sitemap:()=>{}};
    try{
      const result=controllers[page]?.();if(result?.catch)result.catch(error=>{console.error('Kể Nè page:',error);K.toast('Chưa khởi tạo được trang: '+error.message);});
    }catch(error){console.error('Kể Nè page:',error);K.toast('Chưa khởi tạo được trang: '+error.message);}
    K.syncHeader();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
