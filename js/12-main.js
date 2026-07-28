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
if(mgrPass()){                    // đã mở chế độ quản lý trong phiên trình duyệt này
  mgr=true;
  const p=$('mgrPill');if(p){p.classList.add('on');p.textContent='🔓 Quản lý';}
}
fillMonthSelects();
syncAccounts();
renderAll();
initFb();

/* Trang chính của nhân viên là màn hình đầu tiên ngay sau khi đăng nhập */
renderGate();
go('me');
renderMe(true);

/* Đếm ngược ca kế tiếp tự cập nhật mỗi phút (không phá khi đang mở sheet) */
setInterval(()=>{
  if(curView==='me'&&meId()&&!document.querySelector('.sheetmask.on'))renderMe();
},60000);
