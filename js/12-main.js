/* ============================================================
   BOOT — khoi tao ung dung
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== BOOT =================== */
function renderAll(){
  fillMonthSelects();renderCal();renderSetup();renderReg();renderAppr();renderData();refreshBadge();
  if(curView==='mp')renderMp();
  if(curView==='me')renderMe();
  if(curView==='stats')renderStats();
}
load();
fillMonthSelects();
renderAll();
initFb();
// Nhân viên có phiên đăng nhập → mở thẳng tab Của tôi
if(meId())go('me');else renderMe();
