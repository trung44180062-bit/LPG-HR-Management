/* ============================================================
   I18N — giao dien Tieng Viet / English
   LPGT Cavern — Quan ly Cong Ca v4

   Cach hoat dong:
   - Toan bo app van viet bang tieng Viet nhu cu (khong phai sua template).
   - Khi LANG==='en', ham i18nApply() quet DOM va thay the CAC NUT VAN BAN
     khop CHINH XAC voi khoa trong tu dien duoi day (sau khi trim).
     Ten nguoi / ma NV / so lieu khong nam trong tu dien nen khong bi dung toi.
   - MutationObserver goi lai i18nApply() moi khi co phan giao dien ve lai.
   - #printRoot (bieu mau in) va moi phan tu co data-noi18n LUON bi bo qua —
     bieu mau in la giay to chinh thuc, giu nguyen song ngu Viet/Anh.

   Nap file nay NGAY SAU js/01-core.js (can bien LS).
   ============================================================ */

const LANG_KEY_BASE=LS+'_lang';
let LANG='vi';

/* Ngôn ngữ mặc định theo quyền: Quản lý người Hàn (kmgr) → English */
function langOfPerm(p){return p==='kmgr'?'en':'vi';}
function langKeyFor(id){return LANG_KEY_BASE+(id?('_'+id):'');}
/* Lựa chọn người dùng tự đổi (nếu có) — ưu tiên hơn mặc định theo quyền */
function savedLang(id){
  try{const v=localStorage.getItem(langKeyFor(id));return (v==='vi'||v==='en')?v:null;}catch(e){return null;}
}

/* Chuẩn hoá chuỗi trước khi tra: gộp khoảng trắng/xuống dòng, đổi &amp; → & */
function i18nKey(s){
  return String(s==null?'':s).replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
}
/* Bảng tra đã chuẩn hoá — dựng 1 lần từ I18N_EN */
let _I18N_MAP=null;
function i18nMap(){
  if(!_I18N_MAP){
    _I18N_MAP=Object.create(null);
    for(const k in I18N_EN)_I18N_MAP[i18nKey(k)]=I18N_EN[k];
  }
  return _I18N_MAP;
}
/* ---- Dịch một chuỗi (dùng cho chuỗi ghép động: toast, nhãn…) ---- */
function t(s){
  if(LANG!=='en')return s;
  const r=i18nLookup(i18nKey(s));
  return (r==null)?s:r;
}
/* Tra đầy đủ: từ điển → quy tắc có số → ghép mã ca → phần đuôi là ngày/số */
function i18nLookup(k){
  if(!k)return null;
  const m=i18nMap();
  if(m[k]!==undefined)return m[k];
  const r=i18nRegex(k);
  if(r!=null)return r;
  // "AL8 — Phép năm 8h", "D — Ca ngày 08–20h" (mục trong danh sách chọn mã ca)
  const c=k.match(/^([A-Za-z0-9]{1,5}) — (.+)$/);
  if(c&&m[c[2]]!==undefined)return c[1]+' — '+m[c[2]];
  // "Đổi ca 03/08", "Duyệt: 10:50 29/7/2026" — phần đầu dịch được, đuôi là ngày/giờ
  const parts=k.split(' ');
  for(let cut=1;cut<=4&&cut<parts.length;cut++){
    const head=parts.slice(0,parts.length-cut).join(' ');
    const tail=parts.slice(parts.length-cut).join(' ');
    if(head.length<4||!/\d/.test(tail))continue;
    if(m[head]!==undefined)return m[head]+' '+tail;
  }
  return null;
}
/* Bí danh cho những hàm đã dùng biến cục bộ tên `t` (loại đơn) — cùng chức năng */
function t2(s){return t(s);}
/* Ngày tháng theo ngôn ngữ */
function localeTag(){return LANG==='en'?'en-GB':'vi-VN';}

/* ============================================================
   TỪ ĐIỂN VIỆT → ANH
   Khoá = đúng đoạn văn bản hiển thị (đã trim). Chia nhóm cho dễ bảo trì.
   ============================================================ */
const I18N_EN={

/* ---------- Đăng nhập / khung app ---------- */
'LPGT Cavern · Công Ca':'LPGT Cavern · Shift Work',
'LPGT Cavern — Quản lý Công Ca':'LPGT Cavern — Shift Work Management',
'Quản lý Công Ca · Working Schedule':'Shift Work Management · Working Schedule',
'Mã nhân viên':'Employee ID',
'Mật khẩu':'Password',
'Đăng nhập':'Sign in',
'Đăng xuất':'Sign out',
'Chỉ nhập':'Enter only the',
'phần số':'number part',
'của mã nhân viên (bỏ chữ đầu).':'of your employee ID (drop the leading letters).',
'Lần đầu đăng nhập:':'First sign-in:',
'mật khẩu = mã số':'password = that number',
'đó. Vào rồi nhớ đổi mật khẩu ở mục':'. Once inside, change your password under',
'Tài khoản':'Account',
'Đang kết nối…':'Connecting…',
'Hiện/ẩn mật khẩu':'Show / hide password',
'Trạng thái đồng bộ':'Sync status',
'Nhập cả mã nhân viên và mật khẩu.':'Enter both employee ID and password.',
'Xin chào':'Welcome',
'Đã đăng xuất':'Signed out',
'🔐 Chưa đăng nhập':'🔐 Not signed in',
'Đăng nhập bằng mã nhân viên để xem trang cá nhân.':'Sign in with your employee ID to see your personal page.',
'Về màn hình đăng nhập':'Back to sign-in',
'Đăng nhập để xem':'Sign in to view',
'Phiên đăng nhập đã hết':'Your session has expired',
'Phiên đăng nhập đã hết — đăng nhập lại':'Your session has expired — please sign in again',
'Sai mật khẩu. Nếu chưa từng đổi, mật khẩu chính là mã số của bạn: <b>':'Wrong password. If you have never changed it, your password is your ID number: <b>',
'Không tìm thấy mã nhân viên <b>':'Employee ID not found: <b>',
'. Nhập phần số trong ô':'. Enter the number part in the',
'ở tab Nhóm &amp; Lịch, ví dụ':'field on the Teams & Schedule tab, e.g.',
'</b>. Nhập phần số trong ô <b>Mã NV</b> ở tab Nhóm &amp; Lịch, ví dụ <b>44180062</b>.':'</b>. Enter the number part in the <b>Employee ID</b> field on the Teams &amp; Schedule tab, e.g. <b>44180062</b>.',
'</b>. Nhờ quản lý sửa lại cho mỗi người một mã riêng.':'</b>. Ask your manager to give each person a unique ID.',
'người cùng mã số <b>':'people share the ID number <b>',
'</b> chưa có họ tên trong danh sách nên chưa được cấp tài khoản. Nhờ quản lý điền họ tên giúp.':'</b> has no name on the roster yet, so no account was created. Ask your manager to fill in the name.',
'Mã <b>':'ID <b>',
'Không tạo được tài khoản cho mã này — liên hệ quản lý.':'Could not create an account for this ID — contact your manager.',
'Chưa tải được danh sách nhân sự. Kiểm tra kết nối mạng rồi thử lại — hoặc nhờ quản lý mở app một lần trên máy này để đồng bộ.':'Employee list not loaded yet. Check your connection and try again — or ask a manager to open the app once on this device to sync.',

/* ---------- Điều hướng ---------- */
'Trang chính':'Home',
'Lịch':'Schedule',
'Duyệt':'Approvals',
'Nhân lực':'Manpower',
'Thống kê':'Statistics',
'Thêm':'More',
'Gửi đơn':'Submit a request',
'⚡ Tăng ca của tôi':'⚡ My overtime',
'Tăng ca của tôi':'My overtime',
'📋 Đơn của tôi':'📋 My requests',
'Đơn của tôi':'My requests',
'🔑 Tài khoản':'🔑 Account',
'🛠️ Nhóm &amp; Lịch':'🛠️ Teams &amp; Schedule',
'Nhóm &amp; Lịch':'Teams &amp; Schedule',
'⚙️ Dữ liệu':'⚙️ Data',
'Dữ liệu':'Data',
'🖨️ In đơn':'🖨️ Print requests',
'In đơn':'Print requests',
'↪ Đăng xuất':'↪ Sign out',
'📊 Thống kê':'📊 Statistics',
'📝 Gửi đơn':'📝 Submit a request',

/* ---------- Trang chính nhân viên ---------- */
'Tuần':'Week',
'Tháng':'Month',
'Hôm nay':'Today',
'hôm nay':'today',
'Chú giải':'Legend',
'Chú giải mã ca':'Shift code legend',
'ca điều chỉnh':'adjusted shift',
'đơn chờ':'pending request',
'đơn duyệt':'approved request',
'Giờ công':'Work hours',
'Tăng ca đã duyệt':'Approved overtime',
'Phép năm còn lại':'Annual leave left',
'Đơn đang chờ duyệt':'Requests awaiting approval',
'cần khai':'needs entry',
'Chưa xếp ca':'No shift assigned',
'Lịch chuẩn là':'Standard shift is',
'— đã điều chỉnh':'— adjusted',
'📋 Đơn của ngày này':'📋 Requests for this day',
'CHỜ':'PENDING',
'DUYỆT':'APPROVED',
'TỪ CHỐI':'REJECTED',
'Huỷ':'Cancel',
'Huỷ đơn này?':'Cancel this request?',
'Đã huỷ đơn':'Request cancelled',
'Lý do từ chối:':'Rejection reason:',
'với':'with',
'ngày':'days',
'Nhân sự ngày':'Staff on',
'người':'people',
'✍️ Gửi đơn':'✍️ Submit a request',
'⚠️ Bạn đã làm':'⚠️ You have worked',
'ngày liên tục':'consecutive days',
'. Cân nhắc xin nghỉ bù.':'. Consider requesting a day off.',
'đơn vừa có kết quả:':'request(s) have been decided:',
'✅ duyệt':'✅ approved',
'❌ từ chối':'❌ rejected',
'Xem':'View',

/* ---------- Loại đơn ---------- */
'Nghỉ phép':'Annual leave',
'nghỉ phép':'annual leave',
'Đổi ca':'Shift swap',
'đổi ca':'shift swap',
'Tăng ca':'Overtime',
'tăng ca':'overtime',
'Đổi mã ca':'Change shift code',
'đổi mã ca':'change shift code',
'Bổ sung công':'Working time confirmation',
'bổ sung công':'working time confirmation',
'Đi trễ / Về sớm':'Come late / Leave early',
'đi trễ / về sớm':'come late / leave early',
'Đi trễ/Về sớm':'Come late / Leave early',
'Làm liên tục nhiều ngày':'Continuous multi-day work',
'làm liên tục nhiều ngày':'continuous multi-day work',
'Đăng ký nghỉ':'Leave request',
'Đi trễ':'Come late',
'Về sớm':'Leave early',
'Đi trễ / Come late':'Come late',
'Về sớm / Leave early':'Leave early',

/* ---------- Form đơn nhiều dòng ---------- */
'Ngày':'Date',
'Mã áp dụng':'Code applied',
'Giờ vào':'Time in',
'Giờ ra':'Time out',
'Ca hiện tại':'Current shift',
'Ca hai bên':'Both sides',
'Xoá dòng':'Remove row',
'＋ Thêm ngày':'＋ Add a day',
'Thêm ngày':'Add a day',
'Nghỉ nhiều ngày rời rạc thì bấm':'For non-consecutive days press',
'cho từng ngày. Tối đa':'for each day. Up to',
'dòng / đơn.':'rows per request.',
'Lý do / ghi chú':'Reason / note',
'VD: việc gia đình, khám bệnh...':'e.g. family matters, medical appointment…',
'Người đứng đơn':'Request owner',
'Đổi ca với':'Swap shift with',
'Chưa chọn ai':'Nobody selected yet',
'Chọn':'Select',
'Đổi':'Change',
'Gõ tên hoặc mã NV… (không cần dấu)':'Type a name or employee ID… (accents optional)',
'Không tìm thấy ai khớp.':'No matching person found.',
'Mặc định là bạn. Đổi sang người khác nếu bạn khai hộ.':'Defaults to you. Pick someone else if you are filing on their behalf.',
'⚠️ Bạn đang khai hộ người này.':'⚠️ You are filing this request on their behalf.',
'Người đang <b>nghỉ ca R</b> ngày đó được xếp lên đầu danh sách.':'People on <b>rest (R)</b> that day are listed first.',
'cả hai người':'both people',
'— khi in ra mỗi ngày có 2 dòng thể hiện hai bên đổi ca cho nhau. Bạn có thể':'— when printed, each day produces 2 rows showing both sides of the swap. You may also',
'khai hộ':'file on behalf of',
'đồng nghiệp.':'a colleague.',
'Đơn đổi ca ghi nhận cho':'A shift-swap request is recorded for',
'Loại đơn này khai theo':'This request type is filed as a',
'khoảng ngày liên tục':'continuous date range',
'(một lần vào – một lần ra).':'(one time in – one time out).',
'Từ ngày':'From date',
'Đến ngày':'To date',
'Giờ vào (ngày đầu)':'Time in (first day)',
'Giờ ra (ngày cuối)':'Time out (last day)',
'Loại đơn':'Request type',
'Lý do':'Reason',
'Quên thẻ':'Left the card at home',
'Quên quẹt thẻ':'Forgot to scan the card',
'Mất thẻ':'Lost the card',
'Thẻ hỏng':'The card was damaged',
'Lý do khác':'Other reason',
'Ghi rõ lý do khác...':'Describe the other reason…',
'Người bảo lãnh (không bắt buộc)':'Guarantor (optional)',
'Các ngày xin nghỉ phép — mỗi ngày một dòng':'Leave days — one row per day',
'Các ngày xin đổi ca — mỗi ngày một dòng':'Swap days — one row per day',
'Các ngày xin tăng ca — mỗi ngày một dòng':'Overtime days — one row per day',
'Các ngày xin đổi mã ca — mỗi ngày một dòng':'Shift-code change days — one row per day',
'Các ngày xin bổ sung công — mỗi ngày một dòng':'Working-time confirmation days — one row per day',
'Các ngày xin đi trễ / về sớm — mỗi ngày một dòng':'Come-late / leave-early days — one row per day',
'Chọn ngày bắt đầu':'Pick a start date',
'Ngày kết thúc nhỏ hơn ngày bắt đầu':'End date is earlier than start date',
'⚠️ Ngày kết thúc nhỏ hơn ngày bắt đầu.':'⚠️ End date is earlier than start date.',
'Thêm ít nhất 1 ngày cho đơn':'Add at least one day to the request',
'Đơn phải có ít nhất 1 ngày':'A request must have at least one day',
'Một đơn tối đa':'A request holds at most',
'ngày — gửi thêm đơn mới':'days — please submit another request',
'Chọn người đổi ca hợp lệ':'Pick a valid person to swap with',
'⚠️ Chưa chọn người đổi ca.':'⚠️ No swap partner selected.',
'⚠️ Không thể đổi ca với chính mình.':'⚠️ You cannot swap with yourself.',
'Người đứng đơn không hợp lệ':'Invalid request owner',
'Đã gửi đơn':'Submitted request',
'cho':'for',
'— chờ duyệt ✔':'— awaiting approval ✔',
'In đơn ngay':'Print now',
'Có ngày bị khai trùng:':'Duplicate days entered:',
'Đã có':'There are already',
'đơn khác phủ lên ngày đang khai':'other request(s) covering these days',
'. Gửi tiếp có thể bị trùng.':'. Submitting again may create a duplicate.',
'Đơn gồm':'This request has',
'dòng':'rows',
'— khi in ra mỗi ngày là một dòng riêng':'— each day prints as its own row',
'cho mỗi người':'per person',
'Phép năm: còn':'Annual leave: ',
'(đang chờ duyệt':'(pending',
'· đơn này':'· this request',
'ngày → còn lại':'days → remaining',
'⚠️ Vượt quá số phép còn lại.':'⚠️ Exceeds your remaining leave.',

/* ---------- Bảng phụ: tăng ca / đơn / phép năm / tài khoản ---------- */
'⚡ Tăng ca':'⚡ Overtime',
'🏖 Phép năm':'🏖 Annual leave',
'Đã duyệt (kỳ này)':'Approved (this period)',
'Chờ duyệt':'Pending',
'Ca tăng ca':'Overtime shifts',
'Cả năm':'Full year',
'✅ Đã duyệt & vào lịch':'✅ Approved & applied to schedule',
'⏳ Đang chờ duyệt':'⏳ Awaiting approval',
'Không có đơn tăng ca nào đang chờ.':'No overtime requests pending.',
'Kỳ này chưa có ca tăng ca nào được duyệt.':'No approved overtime shifts in this period.',
'❌ Bị từ chối gần đây':'❌ Recently rejected',
'＋ Đăng ký tăng ca mới':'＋ Request new overtime',
'＋ Đăng ký nghỉ phép':'＋ Request annual leave',
'Không có đơn nào đang chờ.':'No pending requests.',
'✅ Đã duyệt':'✅ Approved',
'❌ Bị từ chối':'❌ Rejected',
'Chưa có.':'None yet.',
'Bạn khai hộ':'You filed on behalf of',
'Khai hộ bởi':'Filed on behalf by',
'Còn lại':'Remaining',
'còn lại':'remaining',
'Đã dùng':'Used',
'Đã dùng từ mốc':'Used since baseline',
'Đơn nghỉ chờ duyệt':'Leave requests pending',
'ngày đã dùng':'days used',
'(từ':'(from',
'✏️ Khai số phép còn lại':'✏️ Set your remaining leave',
'Nhập số ngày phép':'Enter the number of leave days',
'tại một mốc ngày (lấy theo bảng công / phòng nhân sự). Hệ thống sẽ trừ dần các ngày nghỉ phép':'at a baseline date (take it from the timesheet / HR). The system will then deduct leave days',
'kể từ mốc đó':'from that baseline',
'trở đi.':'onward.',
'Số phép còn lại (ngày)':'Remaining leave (days)',
'Tính từ ngày':'Baseline date',
'💾 Lưu':'💾 Save',
'Đã lưu — còn':'Saved —',
'ngày phép':'leave days left',
'Nhập đủ số ngày và mốc ngày':'Fill in both the number of days and the baseline date',
'Số ngày phép không hợp lệ':'Invalid number of leave days',
'Bỏ mốc đã khai và quay lại tính theo quỹ phép năm?':'Remove the baseline and go back to the yearly quota?',
'Đã bỏ mốc':'Baseline removed',
'Cập nhật lần cuối':'Last updated',
'bởi':'by',
'Các ngày nghỉ trong năm':'Leave days this year',
'Chưa dùng ngày nghỉ nào trong năm.':'No leave taken this year.',
'Dòng mờ là ngày':'Dimmed rows are days',
'trước mốc':'before the baseline',
'— không trừ lần nữa vì đã nằm trong số bạn khai.':'— not deducted again, they are already included in the figure you entered.',
'Phần mềm mới đưa vào dùng giữa năm nên chưa có số phép bạn đã nghỉ trước đó. Hãy nhập':'The software was introduced mid-year, so leave taken earlier is not in the system. Please enter your',
'số phép còn lại':'remaining leave',
'theo bảng công của công ty ở ô bên dưới — từ mốc đó hệ thống tự trừ dần.':'from the company timesheet in the field below — from that point the system deducts automatically.',
'🔑 Tài khoản của tôi':'🔑 My account',
'Họ tên':'Full name',
'Tên đăng nhập':'Username',
'Mã NV trên hồ sơ':'Employee ID on record',
'Vị trí':'Position',
'Nhóm':'Team',
'Đã đổi':'Changed',
'Đang dùng mặc định (=':'Still default (=',
'Mật khẩu của bạn đang bằng mã NV — ai biết mã cũng đăng nhập được. Nên đổi ngay.':'Your password equals your employee ID — anyone who knows it can sign in. Change it now.',
'Đổi mật khẩu':'Change password',
'Mật khẩu hiện tại':'Current password',
'Mật khẩu mới (≥ 4 ký tự)':'New password (≥ 4 characters)',
'Nhập lại mật khẩu mới':'Repeat new password',
'↪ Đăng xuất khỏi thiết bị này':'↪ Sign out of this device',
'Mật khẩu hiện tại không đúng':'Current password is incorrect',
'Mật khẩu mới tối thiểu 4 ký tự':'New password must be at least 4 characters',
'Hai ô mật khẩu mới chưa khớp':'The two new-password fields do not match',
'Không dùng lại mã nhân viên làm mật khẩu':'Do not reuse your employee ID as the password',
'Đã đổi mật khẩu ✔':'Password changed ✔',

/* ---------- Mã ca ---------- */
'Office / Hành chính 08–17h':'Office hours 08:00–17:00',
'Ca ngày 08–20h':'Day shift 08:00–20:00',
'Ca đêm 20–08h':'Night shift 20:00–08:00',
'Nghỉ ca (Rest)':'Rest day',
'Phép năm 8h':'Annual leave 8h',
'Phép năm 4h':'Annual leave 4h',
'Nghỉ không lương':'Unpaid leave',
'Nghỉ bù / OFF':'Compensatory day off',
'Đổi sang ca D':'Swapped to day shift',
'Đổi sang ca N':'Swapped to night shift',
'Đổi sang ca O':'Swapped to office hours',
'Tăng ca ngày':'Day overtime',
'Tăng ca đêm':'Night overtime',
'Tăng ca nhập tàu':'Vessel-unloading overtime',
'Office (08–17h)':'Office (08:00–17:00)',
'Day time (08–20h)':'Day shift (08:00–20:00)',
'Night time (20–08h)':'Night shift (20:00–08:00)',

/* ---------- Tab Lịch ---------- */
'Chuẩn':'Standard',
'Thực tế':'Actual',
'Thu/Mở tất cả':'Collapse / expand all',
'👁 Theo ngày':'👁 By day',
'📅 Xem tuần':'📅 Week view',
'Cả kỳ (21→20)':'Whole period (21→20)',
'21 → cuối tháng':'21 → end of month',
'Tất cả nhóm':'All teams',
'Chỉ tô ô khác chuẩn':'Highlight only cells differing from standard',
'Cavern Process · LỊCH CHUẨN (tham chiếu)':'Cavern Process · STANDARD SCHEDULE (reference)',
'Cavern Process · LỊCH THỰC TẾ (biến động ca)':'Cavern Process · ACTUAL SCHEDULE (shift changes)',
'Đây là':'This is the',
'lịch ca chuẩn':'standard shift schedule',
'— cố định, dùng làm tham chiếu. Chỉ tạo/điền ở tab':'— fixed, used as reference. Generate or fill it only on the',
'. Mọi biến động thực tế xem &amp; sửa ở chế độ':'tab. All actual changes are viewed &amp; edited in',
'lịch thực tế':'actual schedule',
'rồi chạm ô để sửa ca thực tế; lịch chuẩn không đổi. Yêu cầu đã duyệt (nghỉ/đổi ca/tăng ca) cũng hiện ở đây.':'— tap a cell to edit the actual shift; the standard schedule stays unchanged. Approved requests (leave / swap / overtime) also appear here.',
'Chưa có lịch. Vào tab 🛠️':'No schedule yet. Go to the 🛠️',
'để tạo nhóm và điền lịch.':'tab to create teams and fill the schedule.',
'Chưa có lịch. Vào 🛠️ Nhóm &amp; Lịch để tạo nhóm và điền lịch.':'No schedule yet. Go to 🛠️ Teams &amp; Schedule to create teams and fill it.',
'Chưa có nhân sự / lịch trong kỳ này.':'No staff / schedule in this period.',
'Không có ngày nào khớp bộ lọc.':'No day matches the filter.',
'Chạm vào từng ngày để xem danh sách tên':'Tap a day to see the name list',
'Chạm tên (gạch chân) để mở sheet chỉnh ca thực tế ngày này.':'Tap an underlined name to open the sheet and edit that day’s actual shift.',
'Sửa ca':'Edit shift',
'↩︎ Về ca chuẩn':'↩︎ Back to standard shift',
'⌫ Xoá ô (trống)':'⌫ Clear cell',
'Đóng':'Close',
'Đã cập nhật lịch thực tế':'Actual schedule updated',
'◀ hôm qua':'◀ yesterday',
'ngày mai ▶':'tomorrow ▶',
'Ca làm việc':'Working shift',
'Nghỉ ca':'Rest',
'(chưa phân nhóm)':'(no team)',
'(Chưa phân nhóm)':'(No team)',
'(chưa đặt tên)':'(unnamed)',
'Cần quyền quản trị':'Administrator rights required',

/* ---------- Nhân lực ---------- */
'Chỉ hiện ngày thiếu nhân lực':'Show only understaffed days',
'Định mức tối thiểu: D ≥':'Minimum required: D ≥',
'(chỉnh ở tab Dữ liệu)':'(set on the Data tab)',
'⚠ thiếu nhân lực':'⚠ understaffed',
'✓ Đủ nhân lực toàn khoảng':'✓ Fully staffed over the whole range',
'ngày thiếu nhân lực':'understaffed days',
'Chọn khoảng ngày':'Pick a date range',
'Chọn khoảng ngày hợp lệ.':'Pick a valid date range.',
'Khoảng ngày không hợp lệ':'Invalid date range',
'Có thể huy động tăng ca':'Available for overtime',
'— có thể huy động tăng ca':'— available for overtime',
'NGÀY':'DAY',
'ĐÊM':'NIGHT',
'NGHỈ CA':'REST',
'NHÂN SỰ':'STAFF',

/* ---------- Thống kê ---------- */
'📤 Xuất Excel':'📤 Export to Excel',
'Tính theo':'Calculated from the',
'(chuẩn + điều chỉnh + yêu cầu đã duyệt). Số giờ mỗi mã ca khai báo ở tab':'(standard + adjustments + approved requests). Hours per shift code are set on the',
'TỔNG GIỜ CÔNG':'TOTAL WORK HOURS',
'TỔNG GIỜ TĂNG CA':'TOTAL OVERTIME HOURS',
'TỔNG GIỜ PHÉP':'TOTAL LEAVE HOURS',
'TỔNG CỘNG':'GRAND TOTAL',
'TỔNG':'TOTAL',
'Tổng':'Total',
'Giờ OT':'OT hours',
'Giờ phép':'Leave hours',
'Σ Ca ngày (D)':'Σ Day shift (D)',
'Σ Ca đêm (N)':'Σ Night shift (N)',
'Σ Văn phòng (O)':'Σ Office (O)',
'LPGT CAVERN — THỐNG KÊ CÔNG CA':'LPGT CAVERN — SHIFT WORK STATISTICS',
'Kỳ':'Period',
'Mã NV':'Employee ID',

/* ---------- Duyệt đơn ---------- */
'🔒 Khu vực quản lý':'🔒 Management area',
'Tài khoản của bạn chưa được cấp quyền duyệt đơn. Quản trị viên cấp quyền ở cột':'Your account has no approval rights. An administrator grants them in the',
'trong tab Nhóm &amp; Lịch.':'column on the Teams &amp; Schedule tab.',
'Quyền':'Permission',
'🗂️ Lịch sử':'🗂️ History',
'Trống.':'Empty.',
'Không có yêu cầu chờ duyệt. 👍':'No requests awaiting approval. 👍',
'✓ Duyệt':'✓ Approve',
'✕ Từ chối':'✕ Reject',
'🖨️ In':'🖨️ Print',
'CHỜ DUYỆT':'PENDING',
'ĐÃ DUYỆT':'APPROVED',
'🖨️ đã in':'🖨️ printed',
'Gửi:':'Sent:',
'Duyệt:':'Decided:',
'Lý do:':'Reason:',
'Lý do từ chối (tuỳ chọn):':'Rejection reason (optional):',
'Đã từ chối':'Rejected',
'Đã duyệt & cập nhật lịch thực tế':'Approved & actual schedule updated',
'Ghi chú:':'Note:',
'Người bảo lãnh:':'Guarantor:',
'⚠️ Nếu duyệt: ngày':'⚠️ If approved: on',
'ca D còn':'day shift would drop to',
'ca N còn':'night shift would drop to',
'ngày khác':'other days',

/* ---------- In đơn ---------- */
'Chưa in (':'Not printed (',
'Đã in':'Printed',
'in lại':'reprint',
'Bố cục in':'Print layout',
'2 đơn/tờ A4 đứng — tiết kiệm giấy (mặc định)':'2 forms per A4 portrait sheet — saves paper (default)',
'1 đơn/tờ A5 ngang (chữ to hơn)':'1 form per A5 landscape sheet (larger text)',
'Tìm theo tên nhân viên...':'Search by employee name…',
'Không có đơn nào đang chờ in.':'No requests waiting to be printed.',
'Chưa có lịch sử in.':'No print history yet.',
'🔁 In lại nguyên lô':'🔁 Reprint whole batch',
'Chưa chọn đơn nào':'No request selected',
'Chưa chọn đơn nào.':'No request selected.',
'Không có nội dung để in':'Nothing to print',
'Không tìm thấy đơn':'Request not found',
'Loại đơn không hỗ trợ in':'This request type cannot be printed',
'Đơn không có dòng nào để in':'This request has no rows to print',
'Không tìm thấy lô in':'Print batch not found',
'Không tìm thấy đơn trong lô này (có thể đã bị xoá)':'No requests found in this batch (they may have been deleted)',
'Đã in lại lô ✔':'Batch reprinted ✔',
'Đã đánh dấu đã in ✔':'Marked as printed ✔',
'Bật chế độ Quản lý trước để in đơn':'Switch to Management mode first to print',
'đơn)?':'requests)?',
'Đã in thành công? Đánh dấu đã in (':'Printed successfully? Mark as printed (',
'tờ':'sheets',

/* ---------- Nhóm & Lịch ---------- */
'🗓️ Tạo / điền lịch ca':'🗓️ Generate / fill the shift schedule',
'Kỳ lịch (21→20)':'Schedule period (21→20)',
'📍 Theo mốc':'📍 From anchor',
'⚡ Điền lịch tự động':'⚡ Auto-fill schedule',
'➡️ Tạo lịch tháng kế tiếp':'➡️ Generate next month',
'🗑️ Xóa lịch (khoảng)':'🗑️ Clear schedule (range)',
'🗑️ Xóa toàn bộ lịch':'🗑️ Clear entire schedule',
'＋ Thêm nhóm (2 kỹ sư + 2 oper)':'＋ Add team (2 engineers + 2 operators)',
'＋ Thêm người lẻ':'＋ Add single person',
'＋ Người':'＋ Person',
'✎ Tên nhóm':'✎ Team name',
'✕ Nhóm':'✕ Team',
'Vai trò':'Role',
'Kỹ sư':'Engineer',
'Operator':'Operator',
'Khác':'Other',
'Kiểu ca':'Shift pattern',
'Kiểu':'Pattern',
'Ca 8 ngày (OODDNNRR)':'8-day cycle (OODDNNRR)',
'Ca 6 ngày (DDNNRR)':'6-day cycle (DDNNRR)',
'Hành chính (T2–T6)':'Office hours (Mon–Fri)',
'Hành chính':'Office',
'Ca 8 ngày':'8-day cycle',
'Ca 6 ngày':'6-day cycle',
'Mốc 1':'Anchor 1',
'Mốc 2':'Anchor 2',
'Ngày đầu của cặp Office / ca đầu':'First day of the Office pair / first shift',
'Cặp kế tiếp (để đo chu kỳ)':'Next pair (to measure the cycle)',
'Nhân viên':'Employee',
'Duyệt đơn':'Approver',
'Quản trị':'Administrator',
'Quản lý người Hàn (EN)':'Korean manager (EN)',
'Quản lý người Hàn':'Korean manager',
'Quản trị gốc — không thể hạ quyền':'Root administrator — cannot be demoted',
'Đã đặt quyền':'Permission set to',
'Đã tạo nhóm':'Team created',
'Đã xóa nhóm':'Team deleted',
'Đổi tên nhóm:':'Rename team:',
'Tên nhóm (VD: A, B, C, D):':'Team name (e.g. A, B, C, D):',
'Xóa nhóm "':'Delete team "',
'" và toàn bộ người trong nhóm?':'" and everyone in it?',
'" khỏi danh sách?':'" from the list?',
'Chưa có nhân sự. Bấm':'No staff yet. Press',
'để tạo nhóm gồm 2 kỹ sư + 2 operator, rồi sửa tên / mã số.':'to create a team of 2 engineers + 2 operators, then edit names / IDs.',
'Kỳ theo mốc:':'Period from anchor:',
'Chưa có Mốc 1 nào để nhận diện kỳ':'No Anchor 1 set, cannot detect the period',
'Chọn Kỳ lịch hoặc điền Mốc 1 trước':'Pick a schedule period or fill Anchor 1 first',
'. Kiểm tra Mốc rồi bấm “Điền lịch”.':'. Check the anchors then press “Fill schedule”.',
'Tạo lịch chuẩn cho':'Standard schedule generated for',
'Đã điền':'Filled',
'ô ca':'shift cells',
'Đã xóa lịch trong khoảng':'Schedule cleared for the range',
'Đã xóa toàn bộ lịch':'Entire schedule cleared',
'Xóa TOÀN BỘ lịch ca? (giữ danh sách nhân sự)':'Clear the ENTIRE shift schedule? (staff list is kept)',
'Xóa lịch từ':'Clear schedule from',
'đến':'to',
'Tạo lịch cho kỳ tháng (nhập YYYY-MM, ví dụ 2026-07 = kỳ Tháng 7 = 21/06→20/07):':'Generate the schedule for a period (enter YYYY-MM, e.g. 2026-07 = period of July = 21/06→20/07):',
'— nối tiếp từ khai báo nhóm hiện tại?':'— continuing from the current team setup?',
'Định dạng YYYY-MM':'Format must be YYYY-MM',
'Kỳ lịch Hyosung: kỳ Tháng N = 21 tháng trước → 20 tháng này':'Hyosung schedule period: period of month N = 21st of the previous month → 20th of this month',
'(VD kỳ Tháng 7 = 21/06 → 20/07). Chọn':'(e.g. period of July = 21/06 → 20/07). Pick',
'(hoặc bấm':'(or press',
'để phần mềm tự nhận kỳ chứa Mốc 1) rồi bấm':'to let the app detect the period containing Anchor 1) then press',
'— hệ thống tạo đủ lịch cả kỳ.':'— the system fills the whole period.',
'Mỗi người chọn':'Each person picks a',
'= T2–T6 làm (O), T7/CN nghỉ. Với ca 8/6 ngày: điền':'= work Mon–Fri (O), off Sat/Sun. For the 8/6-day cycles fill in',
'(ngày đầu của cặp Office/ca đầu) và':'(first day of the Office pair / first shift) and',
'(cặp kế tiếp) — phần mềm đo khoảng cách 2 mốc để suy ra chu kỳ. Bỏ trống Mốc 2 sẽ dùng chu kỳ mặc định (8 / 6 ngày). Sau khi điền, có thể chỉnh tay từng ô ở tab':'(the next pair) — the app measures the gap between the two anchors to derive the cycle. Leaving Anchor 2 empty uses the default cycle (8 / 6 days). After filling you can still edit each cell on the',
'(chế độ Quản lý) cho các trường hợp đặc biệt.':'tab (Management mode) for special cases.',
'Đã đổi mã NV':'Employee ID changed',
'Đã đổi mã NV — đăng nhập':'Employee ID changed — username',
'Mã đã tồn tại':'That ID already exists',
'Mã không được trống':'ID cannot be empty',
'Lỗi quyền':'Permission error',

/* ---------- Dữ liệu ---------- */
'📤 Export Excel':'📤 Export to Excel',
'Ca thực tế (chuẩn + sửa tay)':'Actual shifts (standard + manual edits)',
'Bảng ca chuẩn':'Standard shift table',
'Xuất .xlsx':'Export .xlsx',
'☁️ Kết nối Firebase (đồng bộ nhiều máy)':'☁️ Firebase connection (multi-device sync)',
'App tự kết nối Firebase theo cấu hình trong':'The app connects to Firebase using the configuration in',
'khi mở. Muốn dùng dự án khác thì dán':'on start-up. To use another project, paste',
'(JSON) vào ô dưới rồi Lưu &amp; kết nối (chỉ áp dụng cho máy này).':'(JSON) below then Save &amp; connect (applies to this device only).',
'Lưu &amp; kết nối':'Save &amp; connect',
'Về mặc định':'Back to default',
'Đã lưu — đang kết nối':'Saved — connecting',
'Chưa dán config':'No configuration pasted',
'JSON không hợp lệ':'Invalid JSON',
'Config lỗi':'Configuration error',
'Lỗi kết nối':'Connection error',
'SDK chưa tải':'SDK not loaded',
'Đã đồng bộ':'Synced',
'⏱️ Khai báo giờ công theo mã ca':'⏱️ Working hours per shift code',
'Số giờ dùng cho tab':'These hours are used by the',
'. Có thể chỉnh giờ từng mã hoặc':'. You can edit each code or',
'thêm mã ca mới':'add a new shift code',
'(mã mới sẽ xuất hiện trong bảng chọn ca khi sửa lịch / đăng ký).':'(new codes appear in the shift picker when editing the schedule or filing requests).',
'＋ Thêm mã ca mới':'＋ Add new shift code',
'Mã':'Code',
'Diễn giải':'Description',
'Loại':'Type',
'Giờ/ngày':'Hours/day',
'h/ngày':'h/day',
'Mã ca mới (viết tắt, VD: XT, H8):':'New shift code (abbreviation, e.g. XT, H8):',
'Diễn giải (VD: Tăng ca xuất tàu):':'Description (e.g. Vessel-loading overtime):',
'Loại — nhập 1 trong: work (ca làm việc) / ot (tăng ca) / leave (nghỉ phép) / rest (nghỉ ca):':'Type — enter one of: work / ot (overtime) / leave / rest:',
'Số giờ / ngày:':'Hours per day:',
'Đã thêm mã':'Code added',
'" đã tồn tại':'" already exists',
'Xóa mã "':'Delete code "',
'"? (các ô lịch đang dùng mã này vẫn giữ nguyên chữ)':'"? (schedule cells already using it keep the text)',
'👤 Tài khoản đăng nhập nhân viên':'👤 Employee sign-in accounts',
'Nhân viên vào tab':'Employees open the',
'đăng nhập bằng':'tab and sign in with',
'Mã NV + mật khẩu':'Employee ID + password',
'để xem lịch của mình và gửi đăng ký. Quản trị viên cấp / reset / thu hồi mật khẩu tại đây. Mật khẩu được mã hoá (hash) trước khi lưu lên Firebase.':'to see their own schedule and file requests. Administrators issue / reset / revoke passwords here. Passwords are hashed before being stored in Firebase.',
'Trạng thái':'Status',
'Đã cấp':'Issued',
'Chưa cấp':'Not issued',
'🔑 Cấp MK':'🔑 Issue password',
'✕ Thu hồi':'✕ Revoke',
'Mật khẩu cho':'Password for',
'(tối thiểu 4 ký tự):':'(at least 4 characters):',
'Tối thiểu 4 ký tự':'At least 4 characters',
'Đã cấp mật khẩu cho':'Password issued to',
'Thu hồi tài khoản đăng nhập của':'Revoke the sign-in account of',
'Đã thu hồi tài khoản':'Account revoked',
'Đã tạo tài khoản':'Account created',
'(mật khẩu = mã số)':'(password = ID number)',
'🖨️ Cài đặt in đơn':'🖨️ Print settings',
'Bộ phận (Department) mặc định':'Default department',
'Phê duyệt bởi cấp trên trực tiếp':'Approved by immediate superior',
'Phê duyệt bởi Trưởng Bộ Phận':'Approved by Department Chief',
'⚙️ Cài đặt':'⚙️ Settings',
'Tối thiểu ca ngày (D)':'Minimum day shift (D)',
'Tối thiểu ca đêm (N)':'Minimum night shift (N)',
'Phân quyền (Nhân viên · Duyệt đơn · Quản trị) khai báo ở cột':'Permissions (Employee · Approver · Administrator) are set in the',
'🗑️ Xoá toàn bộ dữ liệu trên máy':'🗑️ Wipe all data on this device',
'Xoá toàn bộ dữ liệu trên máy này?':'Wipe all data on this device?',
'Bộ phận':'Department',
'Ca cũ':'Old shift',
'Ca mới xin đổi':'New shift requested',
'Ca làm':'Shift',
'Chữ ký':'Signature',
'Cộng':'Total',
'cộng':'total',
'Đã lưu:':'Saved:',

/* ---------- Bổ sung ---------- */
'VD 7.5':'e.g. 7.5',
'Nghỉ phép / vắng mặt':'On leave / absent',
'Đang xem lịch thực tế: lịch chuẩn + điều chỉnh + đơn đã duyệt.':'Showing the actual schedule: standard shifts + adjustments + approved requests.',
'Ô viền cam là người có ca khác lịch chuẩn, hiện dạng chuẩn → thực tế.':'An orange-bordered chip marks someone whose shift differs from the standard, shown as standard → actual.',
'Ngày này chưa có ai đổi so với lịch chuẩn.':'Nobody differs from the standard schedule on this day.',
'Quên thẻ / Left the card at home':'Left the card at home',
'Quên quẹt thẻ / Forgot to scan the card':'Forgot to scan the card',
'Mất thẻ / Lost the card':'Lost the card',
'Thẻ hỏng / The card was damaged':'The card was damaged',
'Lý do khác / Others':'Other reason',
'Người đang':'People on',
'ngày đó được xếp lên đầu danh sách.':'that day are listed first.',
'⚠️ Nếu duyệt: ngày':'⚠️ If approved: on',
'ca D còn':'day shift drops to',
'ca N còn':'night shift drops to',
'ngày khác)':'more day(s))',
'Kỳ lịch':'Schedule period',
'Lịch ca':'Shift schedule',
'👤 Của tôi':'👤 My page',
'＋ Thêm nhóm':'＋ Add team',
'Quản lý':'Management',
'● cam = ca đã đổi so với chuẩn (viền cam). Bật':'● orange = shift changed from standard (orange border). Turn on',
'rồi chạm ô để sửa ca thực tế; lịch chuẩn không đổi. Yêu cầu đã duyệt (nghỉ/đổi ca/tăng ca) cũng hiện ở đây.':'then tap a cell to edit the actual shift; the standard schedule stays unchanged. Approved requests (leave / swap / overtime) also show here.',
'nghỉ ca R':'rest (R)',
'Σ D / N / O':'Σ D / N / O',
'Đã đặt':'Set to',
'Đã tự nhận':'Auto-detected',
'(chưa phân nhóm)':'(no team)',
'kỹ sư':'engineers',
'oper':'operators',
'VD: Field Engineer':'e.g. Field Engineer',
'người thiếu Mốc 1':'people missing Anchor 1',
'📱 App NV':'📱 Employee app',
'Web':'Web',

/* ---------- Chung ---------- */
'Có':'Yes',
'Không':'No',
'Đã lưu':'Saved',
'Tổ':'Group',
'Ngày làm đơn/ Date:':'Application date:',
'Người làm đơn':'Written by',
'Xác nhận bởi Người bảo lãnh':'Confirmed by guarantor',
'· chưa có dữ liệu nhân sự':'· no staff data yet',
'nhân viên':'employees'
};

/* ============================================================
   QUY TẮC CÓ CHÈN SỐ LIỆU
   Những đoạn ghép sẵn số/tên nên không khớp được từ điển ở trên.
   Áp dụng sau khi tra từ điển không thấy.
   ============================================================ */
const I18N_RE=[
  [/^Nhóm (.+)$/,               'Team $1'],
  [/^\(Nhóm (.+)\)$/,           '(Team $1)'],
  [/^(👥 )?Nhân sự ngày (.+)$/, '$1Staff on $2'],
  [/^(\d+) người$/,             '$1 people'],
  [/^(\d+) ngày$/,              '$1 days'],
  [/^Ngày (\S+) · (.+)$/,       'Day $1 · $2'],
  [/^Tuần (.+)$/,               'Week $1'],
  [/^(.+) ngày đã dùng$/,       '$1 days used'],
  [/^(.+) ngày đã dùng \(từ (.+)\)$/,'$1 days used (since $2)'],
  [/^Gửi đơn (.+)$/,            'Submit $1 request'],
  [/^Các ngày xin (.+) — mỗi ngày một dòng$/,'$1 days — one row per day'],
  [/^⏳ Đang chờ duyệt \((\d+)\)$/,'⏳ Awaiting approval ($1)'],
  [/^✅ Đã duyệt & vào lịch \((\d+)\)$/,'✅ Approved & applied ($1)'],
  [/^✅ Đã duyệt \((\d+)\)$/,   '✅ Approved ($1)'],
  [/^❌ Bị từ chối \((\d+)\)$/, '❌ Rejected ($1)'],
  [/^📋 Đơn của tôi \((\d+)\)$/,'📋 My requests ($1)'],
  [/^⏳ Chờ duyệt \($/,         '⏳ Pending ('],
  [/^Các ngày nghỉ trong năm \((\d+)\)$/,'Leave days this year ($1)'],
  [/^Chưa in \($/,              'Not printed ('],
  [/^⚡ Tăng ca — (.+)$/,       '⚡ Overtime — $1'],
  [/^🏖 Phép năm (\d{4})$/,     '🏖 Annual leave $1'],
  [/^Cả năm (\d{4})$/,          'Full year $1'],
  [/^Giờ công · (.+)$/,         'Work hours · $1'],
  [/^Tổng: (.+)$/,              'Total: $1'],
  [/^\((\d+) ngày\)$/,          '($1 days)'],
  [/^· (\d+) ngày \((.+)\)$/,   '· $1 days ($2)'],
  [/^· (.+) · với$/,            '· $1 · with'],
  [/^với (.+)$/,                'with $1'],
  [/^Đổi ca với (.+)$/,         'Shift swap with $1'],
  [/^cho từng ngày\. Tối đa (\d+) dòng \/ đơn\.$/,'for each day. Up to $1 rows per request.'],
  [/^Ghi chú: (.+)$/,           'Note: $1'],
  [/^Gửi: (.+)$/,               'Sent: $1'],
  [/^Duyệt: (.+)$/,             'Decided: $1'],
  [/^Lý do: (.+)$/,             'Reason: $1'],
  [/^Bỏ mốc \(dùng quỹ (\d+) ngày\)$/,'Remove baseline (use $1-day quota)'],
  [/^Đang dùng mặc định \(= (.+)\)$/,'Still default (= $1)'],
  [/^🔔 (\d+) đơn vừa có kết quả:$/,'🔔 $1 request(s) decided:'],
  [/^(✍️ )?Khai hộ bởi (.+)$/,  '$1Filed on behalf by $2'],
  [/^(✍️ )?khai hộ bởi (.+)$/,  '$1filed on behalf by $2'],
  [/^Bạn khai hộ (.+)$/,        'You filed on behalf of $1'],
  [/^(\d+) kỳ (.+)$/,           '$1 period $2'],
  [/^(\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?) ngày đã dùng \(từ (.+)\)$/,'$1 / $2 days used (since $3)'],
  [/^(\d+) người thiếu Mốc 1$/, '$1 people missing Anchor 1'],
  [/^(\d+) kỹ sư · (\d+) oper$/,'$1 engineers · $2 operators'],
  [/^(\d+) khác lịch chuẩn$/,   '$1 differ from standard']
];
function i18nRegex(k){
  for(let i=0;i<I18N_RE.length;i++){
    const m=I18N_RE[i][0];
    if(m.test(k))return k.replace(m,I18N_RE[i][1]);
  }
  return null;
}

/* ============================================================
   ÁP DỤNG LÊN DOM
   ============================================================ */
const I18N_SKIP_TAGS={SCRIPT:1,STYLE:1,CODE:1};
function i18nSkipEl(el){
  for(let n=el;n&&n.nodeType===1;n=n.parentElement){
    if(I18N_SKIP_TAGS[n.nodeName])return true;
    if(n.id==='printRoot')return true;              // biểu mẫu in giữ song ngữ
    if(n.hasAttribute&&n.hasAttribute('data-noi18n'))return true;
  }
  return false;
}
function i18nApply(root){
  if(LANG!=='en')return;
  const box=root||document.body;if(!box)return;
  const walk=document.createTreeWalker(box,NodeFilter.SHOW_TEXT,null);
  const nodes=[];let n;
  while((n=walk.nextNode()))nodes.push(n);
  nodes.forEach(node=>{
    const raw=node.nodeValue;if(!raw)return;
    const key=i18nKey(raw);if(!key||key.length>400)return;
    const val=i18nLookup(key);
    if(val==null||val===key)return;
    if(i18nSkipEl(node.parentElement))return;
    node.nodeValue=raw.replace(raw.trim(),val);
  });
  const attrs=['placeholder','title','aria-label'];
  box.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{
    if(i18nSkipEl(el))return;
    attrs.forEach(a=>{
      const cur=el.getAttribute(a);if(!cur)return;
      const val=i18nLookup(i18nKey(cur));
      if(val!=null&&val!==cur)el.setAttribute(a,val);
    });
  });
}

/* Vẽ lại giao diện xong là dịch — gom nhiều thay đổi vào 1 lần cho nhẹ */
let _i18nTimer=null,_i18nObs=null;
function i18nSchedule(){
  if(LANG!=='en')return;
  if(_i18nTimer)return;
  _i18nTimer=setTimeout(()=>{_i18nTimer=null;i18nApply();},0);
}
function i18nWatch(){
  if(_i18nObs||typeof MutationObserver==='undefined')return;
  _i18nObs=new MutationObserver(i18nSchedule);
  _i18nObs.observe(document.body,{childList:true,subtree:true,characterData:true});
}

/* ============================================================
   ĐỔI NGÔN NGỮ
   ============================================================ */
function setLang(l,remember){
  const want=(l==='en')?'en':'vi';
  const wasEn=(LANG==='en');
  LANG=want;
  if(remember){try{localStorage.setItem(langKeyFor(meId()),LANG);}catch(e){}}
  const b=$('langBtn');
  if(b){b.textContent=LANG==='en'?'VI':'EN';
        b.title=LANG==='en'?'Chuyển sang tiếng Việt':'Switch to English';}
  document.documentElement.setAttribute('lang',LANG);
  // Tiếng Việt là ngôn ngữ gốc trong mã nguồn: chữ đã dịch sang Anh không quay
  // ngược lại được, nên khi rời chế độ EN thì nạp lại trang cho sạch.
  if(wasEn&&LANG==='vi'){location.reload();return;}
  if(LANG==='en'){i18nApply();i18nWatch();}
}
function toggleLang(){setLang(LANG==='en'?'vi':'en',true);}
/* Gọi sau khi đăng nhập / đổi quyền: lấy lựa chọn đã lưu, không có thì theo quyền */
function applyLangForUser(){
  const id=meId();
  const saved=savedLang(id);
  setLang(saved||langOfPerm(permOf(id)),false);
}
