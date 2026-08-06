/* ============================================================
   NAV — chuyen tab, bottom sheet
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== NAV (v4: bottom bar + top tabs, go(v,opts)) =================== */
function go(v,opts){
  opts=opts||{};
  if(v==='sched'){go('cal',Object.assign({mode:'std'},opts));return;}
  if(v==='real'){go('cal',Object.assign({mode:'real'},opts));return;}
  /* Người không thuộc đối tượng chấm công không có Trang chính cá nhân */
  if(v==='me'&&noSelf){go('real');return;}
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
  const n=(typeof reqNeedsMyAction==='function')
    ? rs.filter(reqNeedsMyAction).length
    : rs.filter(r=>r.status==='pending').length;
  [$('pendBdg'),$('pendBdgM')].forEach(b=>{if(!b)return;b.style.display=n?'':'none';b.textContent=n;});
  if(typeof refreshPrintBadge==='function')refreshPrintBadge();
  if(typeof refreshMealBadge==='function')refreshMealBadge();
  refreshBellBadge();
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
