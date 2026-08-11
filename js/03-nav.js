/* ============================================================
   NAV — chuyen tab, bottom sheet
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== NAV (v4: bottom bar + top tabs, go(v,opts)) =================== */
function go(v,opts){
  opts=opts||{};
  if(v==='sched'){go('cal',Object.assign({mode:'std'},opts));return;}
  if(v==='real'){go('cal',Object.assign({mode:'real'},opts));return;}
  curView=v;
  document.querySelectorAll('.tab,.bb').forEach(t=>t.classList.toggle('on',t.dataset.v===v));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  $('v-'+v).classList.add('on');
  closeMoreSheet();
  if(v==='me')renderMe();
  if(v==='cal')renderCal(opts);
  if(v==='setup')renderSetup();
  if(v==='rep')renderReport();
  if(v==='appr')renderAppr();
  if(v==='data')renderData();
  /* Băng nhắc "đang giữ thông báo lịch" phải theo người dùng qua MỌI tab,
     không chỉ tab Lịch — nếu không sẽ có người quên bấm gửi. */
  if(typeof renderHoldBar==='function')renderHoldBar();
}
function refreshBadge(){
  const rs=Object.values(S.requests||{});
  /* ★ v6.5 — tab Duyệt nay mở cho mọi người, nhưng con số đỏ là LỜI GỌI
     HÀNH ĐỘNG: chỉ hiện với người thật sự phải bấm duyệt. Nhân viên vào đó
     để XEM, đeo huy hiệu "12 đơn chờ" cho họ là báo động giả. */
  const canAct=(typeof apprCanAct==='function')?apprCanAct():true;
  const n=!canAct ? 0
    : ((typeof reqNeedsMyAction==='function')
        ? rs.filter(reqNeedsMyAction).length
        : rs.filter(r=>r.status==='pending').length);
  [$('pendBdg'),$('pendBdgM')].forEach(b=>{if(!b)return;b.style.display=n?'':'none';b.textContent=n;});
  if(typeof refreshPrintBadge==='function')refreshPrintBadge();
  if(typeof refreshMealBadge==='function')refreshMealBadge();
  refreshTrainBadge();
  refreshBellBadge();
}
/* Số buổi đào tạo nhân viên tự khai đang chờ quản lý duyệt (js/22-training.js) */
function refreshTrainBadge(){
  const b=$('trainBdg');if(!b)return;
  const n=(typeof trPendingCount==='function')?trPendingCount():0;
  b.style.display=n?'':'none';
  b.textContent=n;
}
/* Chuông trên header — CHỈ dành cho người không có Trang chính (thư ký, quản
   lý người Hàn, ai đặt Kiểu ca = Không xếp lịch). Nhân viên thường đã có
   chuông ngay trên Trang chính rồi nên không nhân đôi.
   Trước đây nhóm noSelf không có chỗ nào xem được thông báo của app. */
function refreshBellBadge(){
  const id=(typeof meId==='function')?meId():null;
  const n=(id&&typeof notifUnseenCount==='function')?notifUnseenCount(id):0;
  [$('hdrBellBdg'),$('sheetBellBdg')].forEach(b=>{
    if(!b)return;
    b.style.display=n?'':'none';
    b.textContent=n>9?'9+':n;
  });
  const btn=$('hdrBell');
  if(btn)btn.classList.toggle('has-new',!!n);
}
/* ============================================================
   GIỮ NGUYÊN CHỖ ĐANG ĐỨNG KHI VẼ LẠI MỘT HỘP THOẠI   ★ v7.3
   ------------------------------------------------------------
   Các màn hộp thoại của app (Sự kiện, Đào tạo…) vẽ lại bằng cách ghi đè
   TOÀN BỘ innerHTML. Nhanh và dễ viết, nhưng trình duyệt vứt sạch mọi
   trạng thái không nằm trong HTML:
     · vị trí cuộn của hộp thoại và của các danh sách cuộn bên trong
     · ô đang gõ (focus) và vị trí con trỏ trong ô đó

   Người dùng thấy: tích một ô là màn hình NHẢY VỀ ĐẦU; gõ một chữ vào ô
   tìm kiếm là mất focus ngay sau ký tự đầu.

   Cách chữa: chụp trạng thái trước khi ghi innerHTML, đặt lại ngay sau.
     const snap=uiSnap('trBody',['.tr-people','.tr-days']);
     box.innerHTML=…;
     uiRestore(snap);

   Ô nào cần giữ focus phải có thuộc tính `data-k` để nhận diện lại — nhận
   diện theo vị trí trong DOM là không được, vì cây DOM vừa bị dựng mới.
   ============================================================ */
function uiSnap(boxId,scrollers){
  const box=$(boxId);if(!box)return null;
  const snap={box:boxId,sel:scrollers||[],sc:{},k:'',a:null,b:null};
  snap.sc.__box=box.scrollTop;
  snap.sel.forEach(sel=>{const el=box.querySelector(sel);if(el)snap.sc[sel]=el.scrollTop;});
  const ae=document.activeElement;
  if(ae&&box.contains(ae)&&ae.dataset&&ae.dataset.k){
    snap.k=ae.dataset.k;
    /* selectionStart chỉ có ở ô chữ; ô type=time hay <select> đọc là ném lỗi */
    try{snap.a=ae.selectionStart;snap.b=ae.selectionEnd;}catch(e){snap.a=snap.b=null;}
  }
  return snap;
}
function uiRestore(snap){
  if(!snap)return;
  const box=$(snap.box);if(!box)return;
  if(snap.sc.__box!==undefined)box.scrollTop=snap.sc.__box;
  snap.sel.forEach(sel=>{
    if(snap.sc[sel]===undefined)return;
    const el=box.querySelector(sel);if(el)el.scrollTop=snap.sc[sel];
  });
  if(!snap.k)return;
  const el=box.querySelector('[data-k="'+snap.k+'"]');
  if(!el)return;
  try{
    el.focus({preventScroll:true});          // preventScroll: đừng kéo màn hình lần nữa
    if(snap.a!=null&&el.setSelectionRange)el.setSelectionRange(snap.a,snap.b);
  }catch(e){}
}

/* bottom sheet "Thêm" & legend sheet */
function openMoreSheet(){refreshBellBadge();$('moreMask').classList.add('on');}
function closeMoreSheet(){const m=$('moreMask');if(m)m.classList.remove('on');}
function openLegendSheet(){
  const L=[['O','Office (08–17h)'],['D','Day time (08–20h)'],['N','Night time (20–08h)'],['R','Rest']];
  let s=L.map(([c,d])=>`<span class="lg"><span class="box" style="${cellStyle(c)}">${c}</span>${d}</span>`).join('');
  s+=allCodes().filter(c=>c.cat==='leave'||c.cat==='ot'||c.cat==='swap'||c.cat==='combo').map(c=>(c.cat==='combo'
      ? `<span class="lg">${chip(c.c)}${c.l}</span>`                       /* ca kép vẽ chip 2 nửa */
      : `<span class="lg"><span class="box" style="background:${c.col};color:#fff">${c.c}</span>${c.l}</span>`)).join('');
  $('legendSheetBody').innerHTML=s;
  $('legendMask').classList.add('on');
}
function closeLegendSheet(){$('legendMask').classList.remove('on');}
/* mobile/desktop re-layout on rotate / resize */
window.matchMedia('(max-width:767px)').addEventListener('change',()=>{if(curView==='cal')renderCal();if(curView==='me')renderMe(true);});
