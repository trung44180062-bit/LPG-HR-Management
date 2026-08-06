/* ============================================================
   BOOT — khoi tao ung dung
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== BOOT =================== */
function renderAll(){
  syncAccounts();                 // mã NV mới → tự thành tài khoản đăng nhập
  /* Dọn thông báo đã lỗi thời sau mỗi lượt đồng bộ Firebase: máy khác vừa
     huỷ đơn / đổi người cover / trả ô lịch về ca chuẩn thì việc-chờ-xác-nhận
     tương ứng ở máy này phải biến mất theo. Có tiết chế 30 giây và chỉ ghi
     khi thật sự gỡ được cái gì (xem sweepStaleNotifs ở js/13-portal.js). */
  if(typeof sweepStaleNotifsThrottled==='function')sweepStaleNotifsThrottled();
  applyRoleUI();
  fillMonthSelects();renderCal();renderSetup();renderAppr();renderData();refreshBadge();
  /* Băng "đang giữ thông báo lịch" — dựng lại sau mỗi lượt đồng bộ Firebase,
     để quản trị khác cũng thấy và bấm gửi hộ được (js/06-calendar.js). */
  if(typeof renderHoldBar==='function')renderHoldBar();
  renderGate();
  if(curView==='me')renderMe();
  if(curView==='rep')renderReport();
}

load();
applyPerm();                      // quyền lấy từ cột Quyền của người đang đăng nhập
fillMonthSelects();
syncAccounts();
/* Dọn thông báo lúc khởi động: (1) việc chờ đã lỗi thời — đơn đã xoá, ô lịch
   đã trả về ca chuẩn, đã đổi người cover; (2) tin cũ hơn ~2 kỳ công.
   Gộp một lần save() cho cả hai để chỉ tốn đúng một lượt ghi Firebase. */
{
  let _pn=0;
  if(typeof sweepStaleNotifs==='function')_pn+=sweepStaleNotifs(false);
  if(typeof pruneOldNotifs==='function')  _pn+=pruneOldNotifs();
  if(_pn)save();
}
renderAll();
initFb();

/* Màn hình đầu tiên sau khi đăng nhập: nhân viên → Trang chính;
   thư ký / quản lý người Hàn (không thuộc diện chấm công) → Lịch thực tế */
renderGate();
go(homeView());
if(!noSelf)renderMe(true);

/* Ngôn ngữ: Quản lý người Hàn (quyền kmgr) mặc định vào là tiếng Anh,
   ai đã tự bấm nút EN/VI thì theo lựa chọn đã lưu. Xem js/14-i18n.js. */
applyLangForUser();
