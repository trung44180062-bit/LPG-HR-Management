/* ============================================================
   BOOT — khoi tao ung dung
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== BOOT =================== */
function renderAll(){
  syncAccounts();                 // mã NV mới → tự thành tài khoản đăng nhập
  applyRoleUI();
  fillMonthSelects();renderCal();renderSetup();renderReg();renderAppr();renderData();refreshBadge();
  renderGate();
  if(curView==='mp')renderMp();
  if(curView==='me')renderMe();
  if(curView==='stats')renderStats();
}

load();
applyPerm();                      // quyền lấy từ cột Quyền của người đang đăng nhập
fillMonthSelects();
syncAccounts();
renderAll();
initFb();

/* Trang chính của nhân viên là màn hình đầu tiên ngay sau khi đăng nhập */
renderGate();
go('me');
renderMe(true);
