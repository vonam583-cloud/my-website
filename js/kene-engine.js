/* Kể Nè — deterministic booking rules. Browser storage is a demo repository. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KeneEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HOUR = 3600000, DAY = 24 * HOUR;
  function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
  function vnParts(ms) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(ms));
    return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  function dayKey(ms) { const p = vnParts(ms); return p.year + '-' + p.month + '-' + p.day; }
  function isDaytime(ms, config) {
    const p = vnParts(ms), minute = Number(p.hour) * 60 + Number(p.minute);
    return minute >= config.dayDiscountStart * 60 && minute < config.dayDiscountEnd * 60;
  }
  function overlaps(a, b) {
    return a.startMs < b.startMs + 60 * 60000 && b.startMs < a.startMs + 60 * 60000;
  }
  function screening(phq, gad, immediate) {
    if (!Array.isArray(phq) || phq.length !== 9 || !Array.isArray(gad) || gad.length !== 7 ||
        !phq.concat(gad).every(n => Number.isInteger(n) && n >= 0 && n <= 3) ||
        typeof immediate !== 'boolean') fail('SCREEN_INCOMPLETE', 'Vui lòng trả lời đủ các câu hỏi.');
    const p = phq.reduce((a,b) => a+b,0), g = gad.reduce((a,b) => a+b,0);
    const review = immediate || phq[8] > 0 || p >= 20 || g >= 15;
    return {phq:p, gad:g, review, immediate, allowed:!review,
      tier:review ? 'review' : (p >= 10 || g >= 10 ? 'moderate' : 'low'),
      phqLabel:p < 5 ? 'Ít dấu hiệu' : p < 10 ? 'Mức nhẹ' : p < 15 ? 'Mức vừa' : p < 20 ? 'Mức tương đối cao' : 'Mức cao',
      gadLabel:g < 5 ? 'Ít dấu hiệu' : g < 10 ? 'Mức nhẹ' : g < 15 ? 'Mức vừa' : 'Mức cao'};
  }
  function createRepository(data, storage, clock, random) {
    const now = clock || Date.now;
    const rng = random || (() => Math.random().toString(36).slice(2,10));
    const config = data.config;
    const key = 'kene_booking_repository_v1';
    function read() {
      let db;
      try { db = JSON.parse(storage.getItem(key) || 'null'); } catch (_) { db = null; }
      if (!db || !Array.isArray(db.orders) || !Array.isArray(db.holds)) db = {version:1, orders:[], holds:[]};
      db.orders.forEach(o=>{if(o.status==='demo_paid'){o.status='pending_confirmation';o.paymentStatus='not_processed';o.recordType='local_booking_request';}if(Array.isArray(o.appointments))o.appointments.forEach(a=>{if(a.status==='confirmed')a.status='requested';});});
      db.holds = db.holds.filter(h => Number.isFinite(h.expiresAt) && h.expiresAt > now());
      return db;
    }
    function write(db) { storage.setItem(key, JSON.stringify(db)); }
    function id(prefix) { return prefix + '-' + now().toString(36).toUpperCase() + '-' + rng().slice(0,7).toUpperCase(); }
    function requireClearance(clearance) {
      if (!clearance || clearance.allowed !== true || clearance.adult !== true ||
          !Number.isFinite(clearance.at) || clearance.at > now() + 60000 || now()-clearance.at > DAY)
        fail('SCREEN_REQUIRED','Cần hoàn thành sàng lọc và câu hỏi an toàn trước khi đặt lịch.');
    }
    function normalizeItem(item,requireLead=true) {
      const service = data.services.find(s => s.id === item.serviceId && s.action === 'book');
      const expert = data.experts.find(e => e.id === item.expertId);
      const startMs = Number(item.startMs);
      if (!service || !expert || !Object.hasOwn(config.channels,item.channel))
        fail('INVALID_ITEM','Lựa chọn dịch vụ hoặc chuyên gia không hợp lệ.');
      if (!expert.channels.includes(item.channel)) fail('INVALID_CHANNEL','Hình thức này không có trong hồ sơ đang cập nhật đã chọn.');
      if (!Number.isSafeInteger(startMs) || startMs < now()+(requireLead?5*60000:0) || startMs > now()+60*DAY)
        fail('INVALID_TIME','Vui lòng chọn một khung giờ còn phù hợp.');
      const p = vnParts(startMs);
      if (startMs%60000!==0 || Number(p.minute)!==0 || Number(p.hour)<7 || Number(p.hour)>22)
        fail('INVALID_TIME','Khung giờ phải bắt đầu vào giờ tròn trong khoảng 07:00–22:00.');
      return {serviceId:service.id,expertId:expert.id,channel:item.channel,startMs,
        price:service.price,sessions:service.sessions,minutes:service.minutes,
        title:service.name};
    }
    function activeAppointments(db) {
      return db.orders.flatMap(order => order.appointments.map(appointment => ({...appointment,owner:order.userId,orderId:order.id})))
        .filter(a => a.status !== 'cancelled');
    }
    function validateAvailability(db, items, userId, ignoreAppointmentId) {
      const weekStart=ms=>{
        const midnight=Date.parse(dayKey(ms)+'T00:00:00+07:00');
        const weekday=new Date(midnight+12*HOUR).getUTCDay();
        return midnight-((weekday+6)%7)*DAY;
      };
      for (let i=0;i<items.length;i++) {
        const start=weekStart(items[i].startMs),end=start+7*DAY;
        const booked=activeAppointments(db).filter(a=>a.id!==ignoreAppointmentId&&a.expertId===items[i].expertId&&a.startMs>=start&&a.startMs<end).length;
        const pending=db.holds.filter(h=>h.userId!==userId).flatMap(h=>h.items).filter(a=>a.expertId===items[i].expertId&&a.startMs>=start&&a.startMs<end).length;
        const inBatch=items.slice(0,i).filter(a=>a.expertId===items[i].expertId&&a.startMs>=start&&a.startMs<end).length;
        if(booked+pending+inBatch>=(config.maxExpertSessionsPerWeek||25))
          fail('WEEK_LIMIT','Thông tin đang cập nhật đã đạt giới hạn 25 phiên trong tuần. Vui lòng chọn hồ sơ hoặc tuần khác.');
        for (let j=0;j<i;j++) if (overlaps(items[i],items[j]))
          fail('USER_CONFLICT','Bạn không thể đặt hai phiên trùng thời gian.');
        for (const a of activeAppointments(db)) {
          if (a.id===ignoreAppointmentId) continue;
          if ((a.expertId===items[i].expertId || a.owner===userId) && overlaps(a,items[i]))
            fail('SLOT_TAKEN','Khung giờ trùng với một lịch đã được xác nhận. Vui lòng chọn lại.');
        }
        for (const h of db.holds) {
          if (h.userId===userId) continue;
          if (h.items.some(x => x.expertId===items[i].expertId && overlaps(x,items[i])))
            fail('SLOT_HELD','Khung giờ đang được giữ. Bạn có thể chọn giờ khác.');
        }
      }
    }
    function totals(items, code, userId, db) {
      const normalized = String(code || '').trim().toUpperCase();
      let coupon = null, eligible = [];
      if (normalized) {
        coupon=data.coupons.find(c => c.kind==='discount' && c.code===normalized);
        if (!coupon) fail('COUPON_UNKNOWN','Mã ưu đãi không tồn tại.');
        if (db && db.orders.some(o => o.userId===userId && o.coupon===normalized))
          fail('COUPON_USED','Tài khoản đã dùng mã này.');
        eligible=items.filter(x => coupon.serviceIds.includes(x.serviceId) && isDaytime(x.startMs,config));
        if (!eligible.length) fail('COUPON_CONDITIONS','Mã chỉ áp dụng cho phiên cá nhân bắt đầu từ 08:00 đến trước 17:00.');
      }
      const priced=items.map(item => {
        const s=data.services.find(x=>x.id===item.serviceId && x.action==='book');
        if(!s) fail('INVALID_ITEM','Dịch vụ không có giá thanh toán.');
        const discounted=!!coupon && eligible.includes(item);
        const discount=discounted ? Math.round(s.price*coupon.percent/100) : 0;
        return {...item,price:s.price,discount,total:s.price-discount};
      });
      const subtotal=priced.reduce((s,x)=>s+x.price,0);
      const discount=priced.reduce((s,x)=>s+x.discount,0);
      return {items:priced,subtotal,discount,fee:0,total:subtotal-discount,coupon:normalized};
    }
    function createHold(userId, rawItems, clearance) {
      requireClearance(clearance);
      if(!userId || !Array.isArray(rawItems) || !rawItems.length || rawItems.length>6)
        fail('EMPTY_CART','Giỏ dịch vụ cần có từ 1 đến 6 lựa chọn.');
      const items=rawItems.map(item=>normalizeItem(item,true)),db=read();
      validateAvailability(db,items,userId);
      const hold={id:id('H'),userId,items,createdAt:now(),expiresAt:now()+config.holdMinutes*60000};
      db.holds=db.holds.filter(h=>h.userId!==userId);
      db.holds.push(hold);write(db);return hold;
    }
    function getHold(userId, holdId) { return read().holds.find(h=>h.id===holdId && h.userId===userId) || null; }
    function releaseHold(userId,holdId) {
      const db=read();db.holds=db.holds.filter(h=>!(h.id===holdId && h.userId===userId));write(db);
    }
    function confirm(userId,holdId,code,clearance,method) {
      const db=read();
      const existing=db.orders.find(o=>o.userId===userId && o.holdId===holdId);
      if(existing) return existing;
      requireClearance(clearance);
      const hold=db.holds.find(h=>h.id===holdId && h.userId===userId);
      if(!hold) fail('HOLD_EXPIRED','Giữ chỗ đã hết hạn. Vui lòng chọn lại khung giờ.');
      const items=hold.items.map(item=>normalizeItem(item,false));
      validateAvailability(db,items,userId);
      if(!['card','wallet','bank','after_confirmation'].includes(method)) fail('INVALID_PAYMENT','Phương thức lưu yêu cầu không hợp lệ.');
      const price=totals(items,code,userId,db);
      const order={id:id('KN'),holdId,userId,createdAt:now(),...price,method,status:'pending_confirmation',paymentStatus:'not_processed',recordType:'local_booking_request',
        appointments:price.items.map((item,i)=>({...item,id:id('AP')+'-'+i,itemIndex:i,status:'requested',reschedules:0}))};
      db.orders.push(order);db.holds=db.holds.filter(h=>h.id!==holdId);write(db);return order;
    }
    function orders(userId) { return read().orders.filter(o=>o.userId===userId).sort((a,b)=>b.createdAt-a.createdAt); }
    function owned(db,userId,orderId) {
      const order=db.orders.find(o=>o.id===orderId && o.userId===userId);
      if(!order) fail('NOT_FOUND','Không tìm thấy lịch của tài khoản này.');
      return order;
    }
    function reschedule(userId,orderId,appointmentId,replacement,clearance) {
      requireClearance(clearance);
      const db=read(),order=owned(db,userId,orderId),a=order.appointments.find(x=>x.id===appointmentId);
      if(!a || a.status!=='requested') fail('NOT_CHANGEABLE','Lịch này không thể đổi trực tiếp.');
      if(a.startMs-now()<config.rescheduleHours*HOUR) fail('LATE_CHANGE','Còn dưới 12 giờ. Vui lòng tạo yêu cầu hỗ trợ để được xem xét.');
      const next=normalizeItem({...a,...replacement,serviceId:a.serviceId});
      if(a.discount>0 && !isDaytime(next.startMs,config))
        fail('DISCOUNT_TIME','Lịch dùng ưu đãi ban ngày cần đổi sang một khung ban ngày; yêu cầu khác cần được xem xét.');
      validateAvailability(db,[next],userId,a.id);
      Object.assign(a,next,{discount:a.discount,total:a.total,reschedules:a.reschedules+1});
      if(order.items[a.itemIndex]) order.items[a.itemIndex].startMs=a.startMs;
      write(db);return a;
    }
    function cancel(userId,orderId,appointmentId) {
      const db=read(),order=owned(db,userId,orderId),a=order.appointments.find(x=>x.id===appointmentId);
      if(!a || a.status!=='requested') fail('NOT_CHANGEABLE','Lịch này không thể huỷ trực tiếp.');
      const early=a.startMs-now()>=config.rescheduleHours*HOUR;
      a.status=early?'cancelled':'cancellation_requested';
      a.cancelRequestedAt=now();a.refundStatus='requires_review';write(db);return a;
    }
    function nextSession(userId,orderId,itemIndex,rawItem,clearance) {
      requireClearance(clearance);
      const db=read(),order=owned(db,userId,orderId),item=order.items[itemIndex];
      if(!item || item.sessions<2) fail('NO_PACKAGE','Không tìm thấy gói nhiều buổi.');
      const used=order.appointments.filter(a=>a.itemIndex===itemIndex && a.status!=='cancelled').length;
      if(used>=item.sessions) fail('PACKAGE_FULL','Gói này đã có đủ lịch cho số buổi đã mua.');
      const next=normalizeItem({...item,...rawItem,serviceId:item.serviceId});
      validateAvailability(db,[next],userId);
      const appointment={...next,id:id('AP'),itemIndex,status:'requested',reschedules:0,discount:0,total:0,prepaid:true};
      order.appointments.push(appointment);write(db);return appointment;
    }
    function feedback(userId,orderId,appointmentId,score) {
      const db=read(),order=owned(db,userId,orderId),a=order.appointments.find(x=>x.id===appointmentId);
      if(!a || !['requested','completed'].includes(a.status) || now()<a.startMs+a.minutes*60000)
        fail('NOT_FINISHED','Chỉ có thể phản hồi sau thời gian phiên dự kiến.');
      if(!Number.isInteger(score) || score<1 || score>5) fail('INVALID_SCORE','Chọn mức phản hồi từ 1 đến 5.');
      a.feedback={score,at:now()};a.status='completed';write(db);return a;
    }
    function issue(userId,orderId,appointmentId) {
      const db=read(),order=owned(db,userId,orderId),a=order.appointments.find(x=>x.id===appointmentId);
      if(!a) fail('NOT_FOUND','Không tìm thấy phiên.');
      a.issue={at:now(),status:'demo_request'};write(db);return a;
    }
    function removeUser(userId) {
      const db=read();db.orders=db.orders.filter(o=>o.userId!==userId);db.holds=db.holds.filter(h=>h.userId!==userId);write(db);
    }
    function isAvailable(expertId,startMs,userId) {
      try {validateAvailability(read(),[{expertId,startMs}],userId||'');return true;}catch(_){return false;}
    }
    return {createHold,getHold,releaseHold,confirm,orders,reschedule,cancel,nextSession,feedback,issue,removeUser,
      isAvailable,totals:(items,code,userId)=>totals(items,code,userId,read()),normalizeItem,read};
  }
  return {createRepository,screening,vnParts,dayKey,isDaytime,overlaps};
});
