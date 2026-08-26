/* ============================================================
   ZALO BOT — CẦU NỐI PHÍA TRÌNH DUYỆT
   LPGT Cavern — Quản lý Công Ca v6.0
   ------------------------------------------------------------
   ★ FILE NÀY KHÔNG CHỨA VÀ KHÔNG BAO GIỜ ĐƯỢC CHỨA BOT TOKEN ★

   Repo publish công khai trên GitHub Pages. Bất kỳ ai xem source đều đọc
   được file này. Nếu token lọt ra, người ngoài gửi tin giả danh công ty tới
   toàn bộ nhân viên — "đơn đã duyệt", "đổi ca gấp". Rủi ro vận hành thật.

   Vì vậy trình duyệt KHÔNG BAO GIỜ gọi thẳng bot-api.zapps.me.
   Nó chỉ ghi một hàng đợi vào Firebase:

       trình duyệt ──ghi──▶ Firebase  <dbPath>/zaloQueue/<notifId>
                                          │
                              (mỗi phút)  ▼
                            Google Apps Script  ★ nơi duy nhất giữ token
                                          │
                                          ▼
                                    Zalo Bot API

   Xem ZALO-BOT.md mục 1 (kiến trúc) và mục 5 (nguyên tắc).
   ------------------------------------------------------------
   NHÁNH zaloQueue NẰM NGOÀI ĐỐI TƯỢNG S
   02-storage.js chỉ đồng bộ các nhánh liệt kê trong FB_MAP_BRANCHES /
   FB_VAL_BRANCHES. zaloQueue không nằm trong đó nên:
     · không máy nào tải nó về  → không tốn băng thông gói Spark
     · không lọt vào localStorage → không phình dữ liệu máy nhân viên
     · Apps Script xoá bản ghi sau khi gửi → nhánh luôn gần như rỗng
   ============================================================ */

/* ---- Bật/tắt toàn cục. Tắt là app chạy y như trước, không mất gì. ---- */
function zaloOn(){
  return !(S.settings && S.settings.zaloOff);
}
function zaloSetOn(on){
  S.settings = S.settings || {};
  S.settings.zaloOff = !on;
  if (typeof save === 'function') save();
  if (typeof toast === 'function') toast(on ? 'Đã bật thông báo Zalo' : 'Đã tắt thông báo Zalo');
}

/* ============================================================
   MA TRẬN KÊNH — bảng dịch từ ZALO-BOT.md mục 5 + ZALO-PHUONG-AN.xlsx
   'now'   = 🔴 bắn ngay
   'batch' = 🟡 xếp hàng, Apps Script gộp trong 10 phút rồi bắn 1 tin
   null    = ⚪ chỉ hiện trong app, KHÔNG tốn tin Zalo
   ============================================================ */
const ZALO_CHANNEL = {
  /* --- Nhóm A: cần người nhận bấm xác nhận --- */
  schedChange : 'now',      // A1 đổi ca mà không biết = đi làm sai giờ
  swapConfirm : 'now',      // A2 B không xác nhận thì đơn kẹt ở hàng duyệt
  coverConfirm: 'now',      // A3/A4 vai trò hay bị quên nhất

  /* --- Nhóm D: sự kiện trên lịch --- */
  event       : 'batch',    // D1 admin đã chủ động bấm gửi

  /* --- Nhóm G: lịch đào tạo (js/22-training.js) ---
     'batch' chứ không 'now': đào tạo luôn được xếp trước vài ngày, biết
     muộn 10 phút không ai đi sai giờ. Đổi lại, một buổi xếp cho 8 người
     đẻ ra 8 thông báo trong app nhưng chỉ tốn ĐÚNG MỘT tin Zalo — chúng
     sinh cùng lúc trên cùng một máy nên hộp gửi gộp được (xem zaloOut*).
     KHÔNG cho vào kênh 'digest': digest chỉ nhận tin giấy tờ thuần
     (apprNeed / approved / cancelled), còn đây là tin đổi lịch đi làm. */
  training    : 'batch'
};

/* Nhóm B & C đi chung kind:'info' nên phân biệt bằng trường phụ `zk`
   (zalo kind) do nơi gọi gắn thêm. Không có `zk` thì coi là tin phụ. */
const ZALO_INFO_CHANNEL = {
  /* Nhóm E — người duyệt cần biết có đơn đang chờ mình.
     MỘT tin cho MỖI lần đơn chuyển sang cấp mới:
       tạo đơn → cấp đầu · FE duyệt → Hoàng Trung · Trung duyệt → QL người Hàn
     Tin này thay luôn cho hai tin trạng thái trung gian 'fe' và 'provapproved'
     (vẫn để null) nên tổng số tin KHÔNG tăng mà lại tới đúng người cần biết. */
  apprNeed    : 'now',

  /* ★ v7.9 — LỜI MỜI GHI NHẬN GỬI CẤP CUỐI.
     Đơn đã được Section Chief duyệt và lịch đã ghi; phần còn lại của Quản lý
     người Hàn là GHI NHẬN, không phải điều kiện để việc chạy. Bắn ngay từng
     đơn cho một người gần như không mở app thì chỉ tạo tiếng ồn — và tệ hơn,
     ai đọc chung kênh cũng tưởng đơn còn treo. Nên gom về bản tin 08:00. */
  finalNote   : 'digest',

  /* Nhóm B — kết quả duyệt đơn */
  approved    : 'now',      // B3 kết quả cuối, ảnh hưởng lịch đi làm
  /* Cấp cuối ghi nhận một đơn ĐÃ báo "đã duyệt" — im lặng, chỉ trong app.
     Báo lần hai cho cùng một đơn là làm người nhận tưởng có gì đổi. */
  final       : null,
  rejected    : 'now',      // B4 phải làm lại đơn
  revoked     : 'now',      // B5 lịch vừa bị đổi ngược
  cancelled   : 'batch',    // B6 đơn bị người khác huỷ
  fe          : null,       // B1 tin trung gian — QUY TẮC R1, chỗ cắt lớn nhất
  provapproved: null,       // B2 tin trung gian — apprNeed đã nói thay rồi

  /* Nhóm F — sửa lịch hàng loạt (nhập tàu, bảo dưỡng…).
     Quản lý bấm 🔕 Giữ thông báo, sửa lịch bao nhiêu người tuỳ ý, rồi bấm
     🔔 Gửi. Trong app mỗi người vẫn nhận đúng một việc-chờ-xác-nhận riêng
     (các tin đó mang nz:1 nên không tốn tin Zalo); Zalo chỉ tốn ĐÚNG MỘT
     tin này, liệt kê mọi người mọi ngày. Xem js/06-calendar.js schedHold*. */
  schedBulk   : 'now',

  /* ★ v8.9 — TÁI CƠ CẤU NHÓM (js/24-reorg.js).
     'now' vì đây là tin đổi LỊCH ĐI LÀM của cả tổ, biết muộn là đi sai ca.
     Fan-out được xử lý ở nơi gọi: mỗi người nhận một tin trong app mang nz:1
     (không tốn Zalo), còn Zalo chỉ nhận ĐÚNG MỘT tin gộp liệt kê cả đợt —
     cùng cách làm với schedBulk ở trên. */
  reorg       : 'now',

  /* Nhóm C — phản hồi hai chiều giữa nhân viên */
  schedRevoke : 'now',      // C2 NV có thể đã gửi đơn theo thay đổi đó
  swapNo      : 'now',      // C4 A phải tìm người khác gấp
  coverNo     : 'now',      // C6 phải chọn người khác, không thì đơn kẹt
  schedDecline: 'batch',    // C1 QL cần biết để xếp người khác
  coverRemoved: 'batch',    // C7 họ đã sắp xếp lịch cá nhân theo đó rồi
  swapOk      : null,       // C3 tin tốt xuôi chiều
  coverOk     : null        // C5 tin tốt xuôi chiều
};

/* ============================================================
   ★ v6.8 — KÊNH 'digest': GOM VỀ MỘT BẢN TIN 08:00 MỖI SÁNG
   ------------------------------------------------------------
   VÌ SAO CẦN

   Hộp gửi `zaloOut*` (v6.3) chỉ gộp được những tin sinh ra TRÊN CÙNG MỘT
   MÁY trong vòng 4 giây. Đơn tăng ca thì ngược hẳn: 20 người gửi từ 20
   điện thoại, rải rác cả ngày. Không có hai tin nào rơi vào cùng một hộp
   gửi, nên KHÔNG có phép gộp nào chạm tới được — mỗi đơn một tin Zalo.
   Đây là lý do "gom OT lúc 08:00" trước nay không hoạt động: nó chưa từng
   được viết, và hộp gửi thì về nguyên lý không làm nổi việc này.

   CÁCH LÀM

   Tin thuộc kênh 'digest' KHÔNG đi vào `zaloQueue` ngay. Nó nằm ở sổ chờ
   `S.digest` trên Firebase — mọi máy đều thấy. Máy nào mở app từ 08:00 trở
   đi sẽ:
     1. giành quyền bằng transaction trên `meta/digestDay` (đúng MỘT máy
        thắng trong ngày, kể cả 5 máy cùng mở lúc 08:00:00),
     2. gom sổ chờ theo THỂ LOẠI (khoá `group`) → mỗi thể loại đúng một tin,
     3. ghi các tin đó vào `zaloQueue`, rồi dọn sổ chờ.

   Không phụ thuộc Apps Script: phía máy chủ vẫn chỉ thấy những hàng
   `zaloQueue` bình thường như mọi khi.

   ĐÁNH ĐỔI đã cân nhắc: nếu cả ngày không ai mở app thì bản tin dời sang
   lần mở kế tiếp, và khi đó tiêu đề ghi rõ khoảng thời gian gom. Chấp nhận
   được vì đây là tin KHÔNG GẤP — việc gấp (đổi ca, cover, sửa lịch) vẫn đi
   kênh 'now' như cũ, không hề bị chạm tới.
   ============================================================ */
const DIGEST_HOUR      = 8;        // 08:00 giờ máy người dùng
const DIGEST_MAX_LINES = 60;       // quá dài thì cắt, kèm dòng "… và N mục nữa"
/* Loại ĐƠN được gom. Chỉ những loại thuần giấy tờ, không loại nào mà biết
   muộn vài giờ là đi làm sai giờ. */
const DIGEST_REQ_TYPES = ['ot','multi','late','wt'];
/* Loại TIN được gom:
     · apprNeed  — "có đơn chờ duyệt", đúng cái đang bắn rời rạc
     · approved  — ★ v6.9: KẾT QUẢ DUYỆT của các đơn trên cũng gom nốt.
                   App chỉ để phê duyệt và lưu dữ liệu; hệ thống chấm công
                   chính thức nằm ở HR ngoài app, nên báo từng đơn "đã
                   duyệt" ngay lập tức không đổi được việc gì ở hiện trường
                   — chỉ tốn tin. Bản tin sáng liệt kê đủ ai · OT kiểu gì ·
                   mấy giờ là dùng được cho cả việc đối chiếu.
     · cancelled — đơn bị huỷ, vốn đã là kênh 'batch' (không gấp)
   KHÔNG gom `rejected` và `revoked`: người đã đăng ký OT tối nay mà bị từ
   chối thì phải biết SỚM, không thì họ đi làm thừa. Hai tin này ở lại kênh
   'now'. Nghỉ phép và đổi ca thì mọi tin đều 'now' như cũ — chúng đổi lịch
   đi làm thật, biết muộn là đi sai ca. */
const DIGEST_ZK        = ['apprNeed','approved','cancelled','finalNote'];
/* Tiêu đề bản tin gom, theo khoá nhóm (ZALO_GROUP_KEY) */
const DIGEST_TITLE = {
  apprNeed :'📥 DAILY DIGEST — APPROVAL REQUIRED',
  reqResult:'✅ DAILY DIGEST — REQUESTS APPROVED / CLOSED',
  /* ★ v8.1 — gói RIÊNG của Quản lý người Hàn: mọi đơn cần họ xem, gom một
     lần mỗi sáng để review tổng. Không dùng chữ "required" — phần lớn đơn
     ở đây đã được Section Chief duyệt và đang chạy. */
  finalNote:'🧾 DAILY REVIEW — KOREAN MANAGER',
  misc     :'🗂 DAILY DIGEST'
};

/* Khoá gộp: cùng người nhận + cùng khoá này trong 10 phút → gộp 1 tin. */
const ZALO_GROUP_KEY = {
  apprNeed:'apprNeed', finalNote:'finalNote', schedBulk:'sched',
  approved:'reqResult', rejected:'reqResult', revoked:'reqResult', cancelled:'reqResult',
  schedChange:'sched', schedRevoke:'sched', schedDecline:'sched',
  swapConfirm:'swap', swapNo:'swap',
  coverConfirm:'cover', coverNo:'cover', coverRemoved:'cover',
  event:'event', training:'training', reorg:'reorg'
};

/* ============================================================
   CHỮ NGHĨA TIN ZALO — TIẾNG ANH
   ------------------------------------------------------------
   Toàn bộ tin Zalo viết bằng TIẾNG ANH theo yêu cầu (Quản lý người Hàn đọc
   cùng một kênh với người Việt). Giao diện app vẫn song ngữ như cũ — hai
   thứ tách biệt, sửa ở đây không đụng gì tới js/14-i18n.js.

   Tên người, mã ca (D/N/O/AL8…), mã nhân viên và ngày tháng giữ nguyên vì
   đó là dữ liệu, không phải câu chữ.
   ============================================================ */

/* ============================================================
   KHUÔN 3 DÒNG  ★ v6.4
   ------------------------------------------------------------
       [1]  <emoji> TIÊU ĐỀ 2–3 CHỮ
       [2]  <ngày>  <tên>  <ca chuẩn> → <ca mới>      ← gói trong MỘT dòng
       [3]  <ai làm> — <việc phải làm>

   Bản trước mỗi tin 10–16 dòng vì bê nguyên khối chi tiết đơn (Employee /
   Type / Total / Submitted at…) vào Zalo. Người đọc trên điện thoại chỉ
   cần biết: AI, NGÀY NÀO, TỪ CA GÌ SANG CA GÌ, và phải làm gì. Chi tiết
   còn lại đã nằm sẵn trong app.

   HAI LUẬT CỨNG:
     · CHỈ in mã ca D / N / O / R. KHÔNG in khung giờ — TRỪ tăng ca, vì giờ
       OT là con số tính lương.
     · KHÔNG BAO GIỜ in mã nội bộ SD / SN / SO / O+N / D+N / OTD / OTN…
       Hệ thống HR không có những ký hiệu đó; người đối chiếu bảng công sẽ
       không tìm thấy. Xem zShift() ngay dưới.
   ============================================================ */

/* Tiêu đề tin — dòng đầu phải là kết luận, liếc 1 giây là hiểu. */
const ZALO_TITLE = {
  apprNeed    : '📥 APPROVAL REQUIRED',
  /* Gói review của cấp cuối (luôn đi kênh digest — xem ZALO_INFO_CHANNEL) */
  finalNote   : '🧾 FOR REVIEW',
  schedBulk   : '📅 SCHEDULE UPDATED',
  schedChange : '📅 SHIFT CHANGED',
  swapConfirm : '🔄 SWAP REQUEST',
  coverConfirm: '🙋 OT COVER REQUEST',
  event       : '📢 ANNOUNCEMENT',
  reorg       : '🔀 TEAM RESTRUCTURE',
  training    : '🎓 TRAINING SCHEDULE',
  approved    : '✅ APPROVED',
  rejected    : '❌ REJECTED',
  revoked     : '↩️ APPROVAL WITHDRAWN',
  cancelled   : '🗑️ REQUEST CANCELLED',
  schedRevoke : '↩️ CHANGE WITHDRAWN',
  schedDecline: '⚠️ CHANGE DECLINED',
  swapNo      : '❌ SWAP DECLINED',
  coverNo     : '❌ OT COVER DECLINED',
  coverRemoved: 'ℹ️ OT COVER REMOVED'
};

/* Việc người nhận phải làm — dòng cuối. Ngắn: người ta biết "app" là gì. */
const ZALO_ACTION = {
  apprNeed    : 'Approve in app',
  /* ★ v8.1 — finalNote KHÔNG có dòng "việc phải làm". Bản tin sáng của cấp
     cuối là bản REVIEW TỔNG; thêm một câu giục ở cuối chỉ làm dài tin mà
     không nói thêm gì họ chưa biết. */
  schedBulk   : 'Confirm in app',
  schedChange : 'Confirm in app',
  swapConfirm : 'Accept / decline in app',
  coverConfirm: 'Accept / decline in app',
  rejected    : 'Submit a new request if needed',
  training    : 'See the training schedule in app',
  reorg       : 'Check your new roster in app',
  swapNo      : 'Choose another colleague',
  coverNo     : 'Assign another colleague'
};

/* ============================================================
   MÃ CA → CHỮ IN RA ZALO
   ------------------------------------------------------------
   Bảng cứng, KHÔNG lấy nhãn tiếng Việt của app. SD/SN/SO là mã nội bộ
   ("đổi sang ca D/N/O") — quy thẳng về ca đích. Ô trống in "—", KHÔNG in
   "OFF" vì OFF là một mã CÓ THẬT (nghỉ bù bản cũ).
   ============================================================ */
const Z_SHIFT = {
  O:'O', D:'D', N:'N', R:'R',
  SD:'D', SN:'N', SO:'O',                       /* ← mã nội bộ, quy về ca đích */
  AL8:'AL (full day)', AL4:'AL (half day)',
  NP:'Unpaid', COM:'Comp off', OFF:'Day off',
  WED:'Marriage', FUN:'Bereavement', MAT:'Maternity', ALP:'AL extra',
  BT:'Business trip',
  OTD:'OT 08:00–20:00', OTN:'OT 20:00–08:00', OTO:'OT 08:00–17:00', OTL:'OT 12:00–13:00',
  OT2:'OT 18:00–20:00', OT3:'OT 17:00–20:00'
};
function zShift(code){
  if(!code)return '—';
  /* Ca kép: nửa trái ca chuẩn, nửa phải tăng ca — in tách, không in "O+N" */
  const cb=(typeof comboOf==='function')?comboOf(code):null;
  if(cb)return zShift(cb.work)+' + '+zShift(cb.ot);
  return Z_SHIFT[code]||code;
}
/* Ca CHUẨN của một người trong một ngày — lấy thẳng từ lịch chuẩn S.base,
   không lấy eff() vì eff trả về ca THỰC TẾ (có thể đã bị đổi rồi). */
function zStd(empId,iso){
  return ((S.base&&S.base[empId])||{})[iso]||'';
}
/* ------------------------------------------------------------
   DÒNG SỐ 2 — "ca chuẩn → ca mới", gói trong một dòng.
     std===cur          →  "D → N"
     std!==cur          →  "D → O (was N)"      (sửa chồng lên thay đổi cũ)
     now trùng std      →  "back to D"          (thu hồi / về ca chuẩn)
     không có ca mới    →  "stays D"            (huỷ đơn, đối phương từ chối)
   ------------------------------------------------------------ */
function zMove(std,cur,now){
  const S1=zShift(std), C1=zShift(cur), N1=zShift(now);
  if(!now||now===cur)            return 'stays '+(C1!=='—'?C1:S1);
  if(std&&now===std)             return 'back to '+S1;
  if(std&&cur&&cur!==std)        return S1+' → '+N1+'  (was '+C1+')';
  return (S1!=='—'?S1:C1)+' → '+N1;
}
/* Một dòng đầy đủ: "Wed 19/08  Tran Van A  D → N" */
function zLine(iso,empId,std,cur,now){
  return zDate(iso)+'  '+zName(empId)+'  '+zMove(std,cur,now);
}
/* Phần tăng ca của một dòng đơn OT — giờ THẬT người ta khai, kèm số giờ.
   d = một phần tử của reqDays(). */
function zOt(d){
  const h=(typeof reqDayHours==='function')?reqDayHours(d):(d.hours||0);
  const from=d.timeIn||'', to=d.timeOut||'';
  const t=(from||to)?('OT '+from+'–'+to):zShift(d.code||'OTD');
  /* ★ v6.9 — nói rõ đã trừ nghỉ trưa, không thì người đọc thấy 08:00–20:00
     mà chỉ 11h sẽ tưởng app tính sai. */
  const hh=h?(Math.round(h*10)/10)+'h'+(d.noLunch?', −1h lunch':''):'';
  return t+((d.isoEnd&&d.isoEnd!==d.iso)?' (+1d)':'')+(hh?(' ('+hh+')'):'');
}

/* ---- Từ vựng tiếng Anh dùng để dựng thân tin ---- */
const Z_TYPE = {
  leave :'Annual leave',  swap:'Shift swap',            ot   :'Overtime',
  change:'Shift change',  wt  :'Work-time supplement',  late :'Late arrival / early leave',
  multi :'Continuous duty'
};
const Z_DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const Z_COVER_ST = {pending:'awaiting confirmation', accepted:'accepted',
                    confirmed:'accepted', declined:'declined'};
const Z_CONFIRM_ST = {pending:'awaiting confirmation', confirmed:'confirmed', declined:'declined'};

function zName(id){
  const e=(typeof empById==='function')?empById(id):null;
  return (e&&e.name)?e.name:(id||'');
}
/* "Wed 19/08" — luôn tiếng Anh, không phụ thuộc LANG của người đang mở app.
   ★ v6.4: BỎ NĂM khi ngày nằm trong năm hiện tại. Tin nào cũng nói về việc
   sắp tới vài ngày; in "/2026" ở mọi dòng chỉ tốn 5 ký tự mà không thêm
   thông tin. Ngày sang năm khác thì vẫn in năm để không gây hiểu nhầm. */
function zDate(iso){
  if(!iso)return '';
  const p=String(iso).split('-');
  if(p.length!==3)return String(iso);
  let dw='';
  try{dw=Z_DOW[new Date(iso+'T00:00:00').getDay()]+' ';}catch(e){}
  const yr=(p[0]===String(new Date().getFullYear()))?'':('/'+p[0]);
  return dw+p[2]+'/'+p[1]+yr;
}
function zDateTime(ts){
  if(!ts)return '';
  const d=new Date(ts);
  const p=n=>String(n).padStart(2,'0');
  return p(d.getHours())+':'+p(d.getMinutes())+' '+p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
}
/* Tên cấp duyệt bằng tiếng Anh. Cấp 'trung' dùng đúng tên người thật cho
   khỏi mơ hồ; cấp cuối hiện tên người đang được uỷ quyền nếu công tắc bật. */
function zLevel(k){
  if(k==='fe')return 'Field Engineer';
  if(k==='trung'){
    const n=(typeof ROOT_ADMIN!=='undefined')?zName(ROOT_ADMIN):'';
    return n?('Section Chief ('+n+')'):'Section Chief';
  }
  if(k==='kmgr'){
    const d=(typeof kmgrDelegate==='function')?kmgrDelegate():null;
    if(d)return 'Korean Manager — delegated to '+zName(d.to);
    const n=(typeof krMgrName==='function')?krMgrName():'';
    return n?('Korean Manager ('+n+')'):'Korean Manager';
  }
  return k||'';
}
/* Tên cấp KHÔNG kèm tên người — dùng ở dòng "Already approved by" vì ngay
   sau đó đã có tên người duyệt thật rồi, kèm nữa thành lặp. */
function zLevelPlain(k){
  return {fe:'Field Engineer',trung:'Section Chief',kmgr:'Korean Manager'}[k]||k||'';
}
/* ============================================================
   MỘT ĐƠN = MỘT DÒNG   ★ v6.4
   ------------------------------------------------------------
   Trả về MẢNG, thường đúng 1 phần tử:
     nghỉ phép   Wed 19/08  Tran Van A  D → AL (full day)
     đổi ca      Wed 19/08  Tran Van A  D ⇄ N  Le Thi C
     tăng ca     Wed 19/08  Tran Van A  O → O + OT 17:00–21:00 (4h)
     bổ sung giờ Wed 19/08  Tran Van A  D  07:30–20:30
   Nhiều ngày thì mỗi ngày một dòng, trần 4 dòng rồi "+N more".
   Ghi chú / lý do đi thành dòng riêng vì đó là thứ người đọc cần nhất.

   Bản cũ đẩy ra 10–14 dòng (Employee / Type / Total / Submitted at…). Bỏ
   hết: tên đã có trong dòng dữ liệu, loại đơn đã có trong tiêu đề, giờ gửi
   đơn không ai dùng để ra quyết định, và app có đủ.
   ============================================================ */
function zReqLines(r,opt){
  const L=[]; opt=opt||{};
  if(!r)return L;
  const e=(typeof empById==='function')?empById(r.empId):null;
  const days=(typeof reqDays==='function')?reqDays(r):[];
  const who=zName(r.empId)+(opt.full?(' ('+(r.empId||'')+((e&&e.team)?'·'+e.team:'')+')'):'');

  if(r.type==='multi'){
    L.push(zDate(r.from)+' → '+zDate(r.to)+'  '+who
          +((r.timeIn||r.timeOut)?('  '+(r.timeIn||'')+'–'+(r.timeOut||'')):''));
  }else{
    const MAXD=4;
    days.slice(0,MAXD).forEach(d=>{
      const std=zStd(r.empId,d.iso);
      const cur=(r.before&&r.before[d.iso]!==undefined)?r.before[d.iso]
               :((typeof eff==='function')?(eff(r.empId,d.iso).code||''):'');
      if(r.type==='swap'){
        const bw=(r.beforeW&&r.beforeW[d.iso]!==undefined)?r.beforeW[d.iso]
                :((typeof eff==='function')?(eff(r.withId,d.iso).code||''):'');
        L.push(zDate(d.iso)+'  '+who+'  '+zShift(cur||std)+' ⇄ '+zShift(bw)+'  '+zName(r.withId));
      }else if(r.type==='ot'){
        /* Tăng ca KHÔNG mất ca chuẩn → "O → O + OT …". Ca chuẩn là nghỉ
           (R / trống) thì chỉ có phần OT, không bịa ra ca. */
        const keep=zShift(cur||std);
        const work=(keep==='—'||keep==='R')?'':(keep+' + ');
        L.push(zDate(d.iso)+'  '+who+'  '+keep+' → '+work+zOt(d));
      }else if(r.type==='wt'||r.type==='late'){
        L.push(zDate(d.iso)+'  '+who+'  '+zShift(cur||std)+'  '+(d.timeIn||'')+'–'+(d.timeOut||''));
      }else{
        L.push(zDate(d.iso)+'  '+who+'  '+zMove(std,cur,d.code));
      }
    });
    if(days.length>MAXD)L.push('+'+(days.length-MAXD)+' more day(s) — see app');
  }

  /* Chỉ giữ những gì thay đổi quyết định duyệt.
     ★ v6.5 — một đơn có thể có NHIỀU người cover, mỗi người vài ngày.
     Một người thì in gọn "Cover: A ⏳"; nhiều người thì kèm ngày của từng
     người, vì người duyệt cần biết ngày nào còn hổng. */
  const ICO={pending:'⏳',accepted:'✅',confirmed:'✅',declined:'❌'};
  const gsC=(typeof reqCoverGroups==='function')?reqCoverGroups(r):[];
  if(gsC.length){
    const one=gsC.length===1;
    L.push('Cover: '+gsC.map(g=>zName(g.id)+' '+(ICO[g.st||'pending']||'⏳')
          +(one?'':' ('+g.isos.map(i=>String(i).slice(8)+'/'+String(i).slice(5,7)).join(',')+')')
          ).join(' · '));
  }else if(r.coverId){
    L.push('Cover: '+zName(r.coverId)+' '+(ICO[r.coverSt||'pending']||'⏳'));
  }
  const gsW=(typeof reqWithGroups==='function')?reqWithGroups(r):[];
  const pend=gsW.filter(g=>g.st&&g.st!=='confirmed');
  if(pend.length)
    L.push('Swap partner: '+pend.map(g=>zName(g.id)+' '+(g.st==='declined'?'❌':'⏳')).join(' · '));
  if(r.type==='wt'&&typeof wtReasonLabel==='function'){
    const wl=wtReasonLabel(r);if(wl)L.push('Reason: '+wl);
  }
  if(r.note)L.push('Note: "'+r.note+'"');
  if(r.reason)L.push('Reason: '+r.reason);
  return L;
}
/* Các cấp đã duyệt xong — để tin "cần duyệt" nói rõ đơn đang ở đâu */
function zChainLines(r){
  const L=[];
  if(!r||typeof reqChain!=='function')return L;
  const ap=r.appr||{};
  const done=reqChain(r).filter(k=>ap[k]&&!ap[k].reject)
    .map(k=>zLevelPlain(k)+(ap[k].by?' ('+zName(ap[k].by)+')':'')
           +(ap[k].cascade?' [cascaded]':''));
  if(done.length)L.push('Already approved by: '+done.join('  ›  '));
  return L;
}
/* Bản một dòng của chuỗi cấp đã duyệt: "passed FE › SM".
   Dùng trong tin "chờ duyệt" để người duyệt biết đơn đã qua tay ai mà không
   tốn cả một dòng dài. Trả '' nếu chưa cấp nào duyệt. */
function zChainShort(r){
  if(!r||typeof reqChain!=='function')return '';
  const ap=r.appr||{};
  const SHORT={fe:'FE',trung:'SC',kmgr:'KM'};
  const done=reqChain(r).filter(k=>ap[k]&&!ap[k].reject).map(k=>SHORT[k]||k);
  return done.length?('passed '+done.join(' › ')):'';
}

/* ---- Thân tin "sửa lịch nhiều người", nhóm theo NGƯỜI ----
   Mỗi người một dòng gồm mọi ngày của họ, để ai cũng dò được tên mình mà
   không phải đọc hết. Dùng chung cho HAI đường:
     · schedBulk — quản lý chủ động bấm 🔕 giữ rồi 🔔 gửi (06-calendar.js)
     · gộp tự động — quản lý quên bấm giữ, hộp gửi tự cuộn các thay đổi rời
       rạc trong cùng một khoảng thời gian lại (zaloOutMergeSched bên dưới)
   rows = [{to,iso,std,was,now}]

   ★ v6.4 — MỖI THAY ĐỔI MỘT DÒNG, thẳng cột:
       19/08  Tran Van A  D → N
       20/08  Tran Van A  R → D
       19/08  Le Thi C    N → R
   Bản cũ nhồi mọi ngày của một người vào một dòng dài, đọc trên điện thoại
   phải cuộn ngang. Bỏ dòng đếm và dòng "Changed by" riêng — cả hai dồn lên
   tiêu đề và dòng cuối. Trần hạ 25 → 15 người cho tin khỏi quá dài. */
function zHoldLines(rows, fromId){
  const L=[];
  rows=(rows||[]).slice();
  if(!rows.length)return L;
  rows.sort((a,b)=>{
    const c=String(zName(a.to)).localeCompare(String(zName(b.to)),'vi');
    return c||String(a.iso).localeCompare(String(b.iso));
  });
  const MAXL=15;
  const use=rows.slice(0,MAXL);
  /* Đệm tên cho cùng bề rộng → cột mã ca thẳng hàng, dò tên mình nhanh hơn.
     Zalo dùng phông tỉ lệ nên không thẳng tuyệt đối, nhưng vẫn đỡ rối. */
  const W=Math.min(16,use.reduce((m,x)=>Math.max(m,zName(x.to).length),0));
  const pad=s=>s.length>=W?s:(s+' '.repeat(W-s.length));
  let last='';
  use.forEach(x=>{
    /* Tên lặp lại thì để trống — cùng người, nhiều ngày, khỏi đọc lại */
    const nm=zName(x.to), show=(nm===last)?' '.repeat(W):pad(nm);
    last=nm;
    L.push(zDate(x.iso).replace(/^\w+ /,'')
          +'  '+show+'  '+zMove(x.std,x.was,x.now));
  });
  if(rows.length>MAXL)L.push('+'+(rows.length-MAXL)+' more — see app');
  return L;
}
/* Số người trong một bó dòng sửa lịch — dùng để đặt tiêu đề */
function zHoldPeople(rows){
  return new Set((rows||[]).map(x=>x.to)).size;
}

/* Tiêu đề tin — phần lớn tra bảng tĩnh, riêng tin "cần duyệt" nói rõ đang
   chờ cấp nào để người đọc biết ngay có phải việc của mình không. */
function zaloTitle(n, zk){
  if(zk==='apprNeed'){
    /* Cấp đang chờ nằm ngay tiêu đề để người đọc biết CÓ PHẢI VIỆC CỦA MÌNH
       không, mà không tốn thêm một dòng "Waiting for:" trong thân tin. */
    const L={fe:'Field Engineer',trung:'Section Chief',kmgr:'Final'}[n.lvl||''];
    return '📥 APPROVAL REQUIRED' + (L?(' — '+L):'');
  }
  if(zk==='schedBulk'){
    /* Số người + số ô ngay trên tiêu đề — nhìn preview là biết đợt sửa lịch
       lớn hay chỉ vài ô lẻ, khỏi phải mở tin. */
    const rows=(n&&n.hold)||[];
    const p=new Set(rows.map(x=>x.to)).size;
    return '📅 SCHEDULE UPDATED'
         + (p?(' — '+p+' people / '+rows.length+' changes'):'');
  }
  /* ★ v8.9 — LỊCH TÀU NHIỀU PHƯƠNG ÁN (js/25-vessel.js).
     Tin đi chung kênh 'event', nhưng tiêu đề phải nói ngay đây là lịch DỰ
     KIẾN hay đã CHỐT — đọc preview mà tưởng đã chốt thì cả tổ chuẩn bị sai. */
  if(zk==='event'&&n&&n.vs){
    return n.vs.fixed ? '🚢 VESSEL SCHEDULE — CONFIRMED'
                      : '🚢 VESSEL SCHEDULE — TENTATIVE';
  }
  /* ★ v8.9 — TÁI CƠ CẤU NHÓM: số người ngay trên tiêu đề, như schedBulk. */
  if(zk==='reorg'&&n&&n.ro){
    const r=n.ro;
    const k=(r.moves||[]).length+(r.leavers||[]).length
           +(r.joiners||[]).length+(r.pauses||[]).length;
    /* Tiêu đề nói đúng việc CHÍNH của đợt: không có ai đổi nhóm thì gọi là
       "STAFF CHANGE", đừng bắt người đọc mở tin ra mới biết. */
    const head=(r.moves||[]).length ? '🔀 TEAM RESTRUCTURE' : '👥 STAFF CHANGE';
    return head+(k?(' — '+k+' people'):'');
  }
  return ZALO_TITLE[zk] || '🔔 NOTIFICATION';
}
/* Tin gửi CHUNG cho cả nhóm chứ không phải riêng một người → Apps Script bỏ
   dòng "👤 <tên người nhận>" ở đầu tin, vì ghi tên một người là gây hiểu nhầm. */
function zaloIsBroadcast(n, zk){
  /* Tin gộp tái cơ cấu liệt kê cả tổ — ghi tên một người ở đầu tin là gán
     nhầm cả đợt cho đúng người đó (xem zaloAudienceName ngay dưới). */
  if(zk==='reorg') return (n && n.ro) ? 1 : 0;
  return (zk==='event' || zk==='schedBulk' || zk==='training') ? 1 : 0;
}
/* NHÃN NGƯỜI NHẬN — tin gửi CHUNG ghi nhãn NHÓM, tin cá nhân ghi tên cá nhân.
   ------------------------------------------------------------
   Tin sự kiện / sửa lịch hàng loạt đẻ ra MỘT thông báo cho MỖI người trong
   một vòng lặp; nếu lấy `toName` = tên người ĐẦU TIÊN của vòng lặp thì nhật ký
   và mọi chỗ hiển thị đều gán nhầm cả tổ cho đúng một cái tên (VD "Phan Quỳnh
   Vân" cho tin gửi everyone). Ở đây quy về nhãn nhóm:
     · event 'all'     → All staff
     · event 'teams'   → Team A · Team B  (nhãn do js/20-events.js dựng, n.aud)
     · event 'working' → On-duty staff …
     · schedBulk       → N employees
   Còn tin liên quan CÁ NHÂN (duyệt đơn, đổi ca, cover, đổi lịch một người…)
   giữ nguyên tên cá nhân. */
function zaloAudienceName(n, zk, emp){
  if(zk==='event')     return (n && n.aud) || 'All staff';
  /* Đào tạo: nhãn nhóm do js/22-training.js gắn ('Training attendees' hoặc
     'Approvers'). Giống nhau ở mọi tin của cùng một buổi → vân tay trùng →
     8 người vẫn chỉ tốn MỘT tin Zalo. */
  if(zk==='training')  return (n && n.aud) || 'Training attendees';
  if(zk==='schedBulk'){
    const p=new Set(((n&&n.hold)||[]).map(x=>x.to)).size;
    return p>1 ? (p+' employees') : (emp ? (emp.name||n.to) : n.to);
  }
  if(zk==='reorg'&&n&&n.ro){
    const r=n.ro;
    const k=(r.moves||[]).length+(r.leavers||[]).length
           +(r.joiners||[]).length+(r.pauses||[]).length;
    return k+' employees';
  }
  return emp ? (emp.name||n.to) : n.to;
}
/* Băm 32-bit (FNV-1a) của tiêu đề + thân tin + nhóm. Không phải mật mã —
   chỉ để so "hai tin này có y hệt nhau không". */
function zaloFp(item){
  const s=(item.group||'')+'|'+(item.title||'')+'|'+(item.lines||[]).join('\n')+'|'+(item.action||'');
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h*0x01000193)>>>0;}
  return h.toString(36);
}

/* ============================================================
   HỘP GỬI — GỘP TIN NGAY Ở TRÌNH DUYỆT   ★ v6.3
   ------------------------------------------------------------
   VÌ SAO PHẢI LÀM Ở ĐÂY, KHÔNG PHÓ MẶC MÁY CHỦ

   Bản trước đặt việc gộp ở Apps Script (vân tay `fp`, cờ ONE_CHAT_DEDUPE),
   với lý lẽ "23 trình duyệt không thể thống nhất với nhau cái gì nên gộp".
   Lý lẽ đó SAI Ở CHỖ QUAN TRỌNG NHẤT: fan-out KHÔNG do 23 máy sinh ra.
   Một người bấm "Tạo sự kiện" trên MỘT máy, rồi máy đó chạy một vòng lặp
   đẻ ra 23 thông báo. Máy đó biết thừa 23 tin ấy giống hệt nhau.

   Hậu quả của việc đẩy sang máy chủ: gộp chỉ chạy nếu bản Apps Script đang
   triển khai là bản mới, và chỉ gộp được những gói CÙNG ĐẾN LƯỢT trong một
   lượt quét. Sai một trong hai điều là cả tổ ăn 23 tin y hệt nhau.

   Nay trình duyệt gom trước rồi mới ghi:

       newNotif ─▶ zaloEnqueue ─▶ [hộp gửi, đệm 4 giây] ─┐
                                                          ├─ gộp ─▶ 1 hàng đợi
       newNotif ─▶ zaloEnqueue ─▶ [hộp gửi]  ────────────┘

   BA PHÉP GỘP, theo thứ tự:
     1. Cuộn lịch  — nhiều `schedChange` rời rạc (quản lý sửa lịch mà quên
        bấm 🔕 Giữ) tự cuộn thành MỘT tin "WORK SCHEDULE UPDATED — N PEOPLE",
        đúng khuôn tin gộp của nút 🔔. Trong app mỗi người vẫn nhận riêng
        một việc-chờ-xác-nhận, không mất gì.
     2. Vân tay   — cùng `fp` (nhóm+tiêu đề+thân+việc-phải-làm) là hai tin
        y hệt nhau; mọi tin hiện đổ vào CÙNG một chat nhóm nên chỉ giữ một,
        kèm dòng liệt kê người nhận.
     3. Cùng người + cùng nhóm tin — nối thân tin, một tin nhiều mục.

   Đệm 4 giây KHÔNG làm tin tới chậm: Apps Script quét mỗi phút, nên 4 giây
   nằm gọn trong thời gian chờ vốn có.

   Việc bị huỷ trong lúc còn nằm trong hộp gửi (tạo sự kiện xong xoá ngay)
   thì tin bốc hơi mà không tốn gì — xem `zaloWithdraw`.
   ============================================================ */
const ZALO_FLUSH_IDLE_MS = 4000;    // ngừng thao tác 4 giây thì đẩy đi
const ZALO_FLUSH_MAX_MS  = 20000;   // còn thao tác thì cũng không giữ quá 20 giây
const ZALO_FLUSH_MAX_N   = 60;      // hộp đầy thì đẩy ngay, khỏi phình bộ nhớ

let _zOut   = [];      // các gói đang chờ gộp
let _zTimer = null;
let _zFirst = 0;       // mốc gói đầu tiên vào hộp
/* notifId → khoá hàng đợi thật sự chứa nó (sau khi gộp). Bản đồ này cũng
   được ghi vào chính thông báo (`n.zq`) nên máy khác đồng bộ về vẫn thu hồi
   được — xem zaloWithdraw. */
const _zq = Object.create(null);

function zaloOutPending(){ return _zOut.length; }

function zaloOutPush(item){
  /* Cùng một thông báo đẩy lại (sửa đi sửa lại một ô lịch) → ĐÈ, không cộng */
  const i=_zOut.findIndex(x=>x.notifId===item.notifId);
  if(i>=0)_zOut[i]=item; else _zOut.push(item);
  if(!_zFirst)_zFirst=Date.now();
  if(_zOut.length>=ZALO_FLUSH_MAX_N){ zaloFlush(); return; }
  if(_zTimer)clearTimeout(_zTimer);
  const left=Math.max(0,ZALO_FLUSH_MAX_MS-(Date.now()-_zFirst));
  _zTimer=setTimeout(zaloFlush,Math.min(ZALO_FLUSH_IDLE_MS,left));
}

/* ---- Phép gộp 1: cuộn các thay đổi lịch rời rạc thành một tin ---- */
function zaloOutMergeSched(list){
  const scs=list.filter(x=>x.zk==='schedChange'&&x.sc);
  if(scs.length<2)return list;                 // một thay đổi thì để nguyên,
                                               // tin riêng còn rõ hơn tin gộp
  const rows=scs.map(x=>x.sc);
  const from=scs[0].fromId||'';
  const rest=list.filter(x=>scs.indexOf(x)<0);
  /* Nếu trong hộp đã có sẵn một tin gộp của nút 🔔 thì nhập chung vào đó,
     không đẻ thêm tin thứ hai nói cùng một chuyện. */
  const bulk=rest.find(x=>x.zk==='schedBulk');
  const host=bulk||Object.assign({},scs[0]);
  host.rows=(host.rows||[]).concat(rows);
  host.zk='schedBulk';
  host.sc=null;
  host.group='sched';
  host.pri='now';
  /* Nhiều ngày nhưng CÙNG MỘT người thì vẫn là tin riêng của người đó —
     ghi "1 PEOPLE" và bỏ tên người nhận đi thì vừa sai chữ vừa khó đọc. */
  const np=zHoldPeople(host.rows);
  host.bcast=np>1?1:0;                         // tin chung thì đừng ghi tên một người
  host.action=np>1?ZALO_ACTION.schedBulk:ZALO_ACTION.schedChange;
  host.title=np>1?('📅 SCHEDULE UPDATED — '+np+' people / '+host.rows.length+' changes')
                 :ZALO_TITLE.schedChange;
  host.lines=zHoldLines(host.rows,host.fromId||from);
  const by=host.fromId||from;
  if(by)host.lines=host.lines.concat('By '+zName(by));
  host.notifIds=(host.notifIds||[host.notifId]).concat(scs.map(x=>x.notifId))
                 .filter((v,i,a)=>a.indexOf(v)===i);
  host.tos=(host.tos||[host.to]).concat(rows.map(r=>r.to))
            .filter((v,i,a)=>v&&a.indexOf(v)===i);
  return bulk?rest:[host].concat(rest);
}

/* ---- Phép gộp 2 & 3: vân tay nội dung, rồi cùng người + cùng nhóm ---- */
function zaloOutMergeFp(list){
  const out=[],byFp=Object.create(null);
  list.forEach(it=>{
    it.notifIds=it.notifIds||[it.notifId];
    it.tos=it.tos||[it.to];
    it.fp=zaloFp(it);
    const lead=byFp[it.fp];
    if(!lead){ byFp[it.fp]=it; out.push(it); return; }
    /* Trùng nội dung → nhập người nhận vào gói dẫn đầu, không ghi gói mới */
    lead.notifIds=lead.notifIds.concat(it.notifIds);
    it.tos.forEach(t=>{ if(t&&lead.tos.indexOf(t)<0)lead.tos.push(t); });
    lead.merged=1;
  });
  /* Gói nào gộp nhiều người thì thành tin chung: bỏ dòng "👤 một người",
     thay bằng một dòng liệt kê đủ người phải làm việc đó. */
  out.forEach(it=>{
    if(it.tos.length>1&&!it.bcast){
      it.bcast=1;
      const MAXN=12;
      const names=it.tos.map(zName).filter(Boolean)
        .sort((a,b)=>String(a).localeCompare(String(b),'vi'));
      it.lines=it.lines.concat(['',
        'For: '+names.slice(0,MAXN).join(' · ')
        +(names.length>MAXN?(' … +'+(names.length-MAXN)):'')]);
    }
    it.n=it.notifIds.length;
    it.fp=zaloFp(it);
  });
  return out;
}
function zaloOutMergeSame(list){
  const out=[],byKey=Object.create(null);
  list.forEach(it=>{
    const k=it.tos.join(',')+'|'+it.group+'|'+it.pri+'|'+(it.bcast?1:0);
    const lead=byKey[k];
    if(!lead||lead.title!==it.title){ if(!lead)byKey[k]=it; out.push(it); return; }
    lead.lines=lead.lines.concat(['— — —'],it.lines);
    lead.notifIds=lead.notifIds.concat(it.notifIds);
    lead.n=lead.notifIds.length;
    lead.fp=zaloFp(lead);
  });
  return out;
}

/* ---- Đẩy hộp gửi xuống Firebase ---- */
function zaloFlush(){
  try{
    if(_zTimer){clearTimeout(_zTimer);_zTimer=null;}
    _zFirst=0;
    let list=_zOut; _zOut=[];
    if(!list.length)return;
    if(typeof firebase==='undefined')return;
    if(typeof fbRef==='undefined'||!fbRef)return;

    /* Thông báo đã bị gỡ trong lúc còn nằm trong hộp → tin biến mất, miễn phí.
       Đây là chỗ chặn rẻ nhất: chưa ghi gì thì chẳng phải thu hồi gì. */
    list=list.filter(x=>!S.notifs||S.notifs[x.notifId]);
    if(!list.length)return;

    list=zaloOutMergeSched(list);
    list=zaloOutMergeFp(list);
    list=zaloOutMergeSame(list);

    let touched=false;
    list.forEach(it=>{
      const key=it.notifIds[0];
      /* Ghi dấu gói nào chứa thông báo nào — cả trong bộ nhớ (nhanh) lẫn
         trong chính thông báo (đồng bộ sang máy khác) để còn thu hồi. */
      it.notifIds.forEach(id=>{
        _zq[id]=key;
        if(S.notifs&&S.notifs[id]&&S.notifs[id].zq!==key){S.notifs[id].zq=key;touched=true;}
      });
      const row={
        to:it.to, toName:it.toName, title:it.title, lines:it.lines,
        action:it.action||'', group:it.group, bcast:it.bcast?1:0,
        pri:it.pri, notifId:key, notifIds:it.notifIds, tos:it.tos,
        n:it.notifIds.length, fp:it.fp,
        state:'pending', createdAt:Date.now()
      };
      fbRef.child('zaloQueue').child(key).set(row)
           .catch(e=>console.warn('[zalo] không ghi được hàng đợi',e));
    });
    if(touched&&typeof save==='function')save();
  }catch(e){
    console.warn('[zalo] bỏ qua lỗi khi đẩy hộp gửi, app vẫn chạy bình thường',e);
  }
}

/* Không để tin kẹt trong hộp khi người dùng đóng tab hoặc chuyển sang app khác */
try{
  window.addEventListener('beforeunload',function(){ zaloFlush(); });
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')zaloFlush();
  });
}catch(e){}

/* ============================================================
   ĐẨY MỘT THÔNG BÁO VÀO HỘP GỬI
   Gọi từ newNotif() ở 13-portal.js. Bọc kín trong try/catch:
   Zalo hỏng thì app phải chạy y như cũ — nguyên tắc thiết kế bắt buộc,
   không được để Zalo thành điểm chết (ZALO-BOT.md mục 1).
   ============================================================ */
function zaloEnqueue(n){
  try{
    if(!zaloOn())                     return;
    if(!n || !n.to || !n.id)          return;
    /* nz=1 → thông báo này CHỈ hiện trong app. Dùng khi một sự việc sinh ra
       nhiều thông báo mà nội dung Zalo đã được gộp vào một tin khác:
         · lời mời xác nhận đổi ca / OT cover đã gộp vào tin "cần duyệt"
         · người duyệt thứ 2, 3… (mọi tin Zalo hiện đổ vào CÙNG một chat nhóm
           nên gửi 4 người là 4 tin y hệt nhau)
       Bỏ cờ này khi đã làm xong liên kết 1-1 — xem ZALO-BOT.md mục 3.3. */
    if(n.nz)                          return;

    /* --- chọn kênh --- */
    const zk  = (n.kind==='info') ? (n.zk||'') : n.kind;
    let   pri = (n.kind==='info') ? ZALO_INFO_CHANNEL[zk] : ZALO_CHANNEL[n.kind];
    if(!pri) return;                  // ⚪ APP-ONLY hoặc kind lạ → im lặng
    if(digestApplies(n,zk)) pri='digest';   // ★ v6.8 — hạ xuống bản tin 08:00

    /* --- người nhận --- */
    const emp = (typeof empById==='function') ? empById(n.to) : null;
    if(!emp) return;                  // không tra được người thì thôi, đừng bắn mù

    /* --- nội dung --- */
    const lines = zaloLines(n, zk);
    if(!lines.length) return;

    const item = {
      to      : n.to,
      toName  : zaloAudienceName(n, zk, emp),
      title   : zaloTitle(n, zk),
      lines   : lines,
      action  : ZALO_ACTION[zk] || '',
      group   : ZALO_GROUP_KEY[zk] || 'misc',
      bcast   : zaloIsBroadcast(n, zk),
      pri     : pri,                  // now | batch
      notifId : n.id,

      /* --- các trường chỉ sống trong hộp gửi, không ghi xuống Firebase --- */
      zk      : zk,
      /* ★ v8.1 — sổ chờ 08:00 giữ luôn mã đơn để lúc gom còn dựng lại được
         bảng tổng theo loại đơn / theo giờ. Nếu chỉ giữ mấy dòng chữ đã
         dựng sẵn thì bản tin sáng vĩnh viễn chỉ là một chồng dòng rời. */
      reqId   : n.reqId || '',
      fromId  : n.from || '',
      /* một dòng sửa lịch, để phép gộp 1 cuộn nhiều người vào một tin */
      sc      : (zk==='schedChange')
                ? {to:n.to, iso:n.iso||'', std:n.std||'', was:n.oldCode||'', now:n.newCode||''}
                : null,
      /* tin gộp của nút 🔔 mang sẵn cả bó dòng */
      rows    : (zk==='schedBulk') ? ((n.hold||[]).slice()) : null
    };
    item.fp = zaloFp(item);

    /* Kênh 'digest' KHÔNG vào hộp gửi 4 giây (hộp đó chỉ gộp được tin cùng
       máy cùng lúc — vô dụng với đơn rải rác cả ngày). Nó vào sổ chờ chung
       trên Firebase, sáng hôm sau gom một thể. */
    if(pri==='digest'){ digestHold(item); return; }

    /* Vào hộp gửi thay vì ghi thẳng. Khoá hàng đợi vẫn là một notifId (quy
       tắc R6 chống trùng) — chỉ khác là sau khi gộp, một khoá có thể đại
       diện cho nhiều thông báo, liệt kê ở `notifIds`. */
    zaloOutPush(item);
  }catch(e){
    console.warn('[zalo] bỏ qua lỗi, app vẫn chạy bình thường', e);
  }
}

/* ============================================================
   SỔ CHỜ BẢN TIN 08:00
   ------------------------------------------------------------
   S.digest[notifId] = { to,toName,title,lines,action,group,bcast,zk,at }
   Là một NHÁNH BẢNG của Firebase (xem FB_MAP_BRANCHES ở js/02-storage.js)
   nên mọi máy thấy như nhau, và xoá khỏi sổ là xoá thật (có bia mộ) — cùng
   một cơ chế đã sửa ở v6.7, không đẻ thêm đường đồng bộ riêng.
   ============================================================ */
/* Tin này có thuộc diện gom về 08:00 không? */
function digestApplies(n,zk){
  if(!n||DIGEST_ZK.indexOf(zk)<0)return false;
  if(!n.reqId)return false;
  const r=(typeof S!=='undefined'&&S.requests)?S.requests[n.reqId]:null;
  if(!r)return false;
  /* ★ v7.9 — lời mời ghi nhận gửi cấp cuối luôn gom, KHÔNG xét loại đơn.
     Danh sách DIGEST_REQ_TYPES tồn tại để tin gấp (nghỉ phép, đổi ca) không
     bị hoãn tới sáng mai; còn tin này thì không có gì gấp cả — đơn đã duyệt
     và đã áp dụng rồi, giục ngay chỉ làm phiền. */
  if(zk==='finalNote')return true;
  return DIGEST_REQ_TYPES.indexOf(r.type)>=0;
}
function digestHold(item){
  S.digest=S.digest||{};
  S.digest[item.notifId]={
    to:item.to, toName:item.toName, title:item.title, lines:item.lines,
    action:item.action||'', group:item.group||'misc', bcast:item.bcast?1:0,
    zk:item.zk||'', reqId:item.reqId||'', at:Date.now()
  };
  if(typeof save==='function')save();
}
function digestDrop(notifId){
  if(!notifId||!S.digest||S.digest[notifId]===undefined)return false;
  delete S.digest[notifId];
  return true;
}
/* Khoá ngày dùng cho transaction. Ngày ĐỊA PHƯƠNG của máy đang mở — cả tổ
   cùng một múi giờ nên không có chuyện hai máy hiểu khác ngày. */
function digestDayKey(dt){
  const d=dt||new Date();
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
/* Đã tới giờ bắn chưa, và hôm nay đã bắn chưa. */
function digestDue(now){
  if(!zaloOn())return false;
  const d=now||new Date();
  if(d.getHours()<DIGEST_HOUR)return false;
  const last=(S.meta&&S.meta.digestDay)||'';
  if(last===digestDayKey(d))return false;
  return true;
}
/* ------------------------------------------------------------
   MỤC NÀO TRONG SỔ CHỜ ĐÃ LỖI THỜI                 ★ v7.7
   ------------------------------------------------------------
   Sổ chờ chỉ nhận tin lúc `newNotif()` sinh ra nó, nên MỖI MỤC LÀ MỘT VIỆC
   MỚI CHƯA GỬI LẦN NÀO — không có đường nào quét lại màn Phê duyệt. Nhưng từ
   lúc vào sổ (VD 15h chiều) tới lúc bắn (08:00 sáng sau) có gần 17 tiếng, và
   trong khoảng đó việc có thể đã hết giá trị:

     · Đơn bị HUỶ / XOÁ. `cancelReq()` chỉ gọi `notifDropForReq()`, mà hàm đó
       chỉ dọn các tin CHỜ XÁC NHẬN (swapConfirm / coverConfirm / schedChange)
       — tin `apprNeed` / `approved` là loại `info`, CỐ Ý giữ lại làm lịch sử.
       Giữ trong app thì đúng, nhưng để nó bắn Zalo sáng mai là báo một đơn
       không còn tồn tại. `zaloWithdraw()` có nhánh gỡ sổ chờ, chỉ là đường
       huỷ đơn không đi qua đó.
     · Đơn ĐÃ CÓ QUYẾT ĐỊNH rồi. Nhắc "còn đơn chờ duyệt" trong khi người ta
       đã duyệt từ tối hôm trước là nhắc việc đã xong. Kết quả duyệt vốn có
       tin `approved` riêng nên không mất thông tin gì.

   Lọc ở đây thay vì đi sửa `cancelReq` là cố ý: sổ chờ tự soi lại mình ngay
   trước khi bắn thì đúng MỘT chỗ lo việc này, không phụ thuộc vào việc mọi
   đường huỷ/duyệt/xoá trong app có nhớ gọi hàm dọn hay không.
   ------------------------------------------------------------ */
function digestStale(id,row){
  const n=(S.notifs||{})[id];
  if(!n)return 'notif';                            // thông báo đã bị gỡ
  const rid=n.reqId;
  if(!rid)return '';
  const r=(S.requests||{})[rid];
  if(!r)return 'req';                              // đơn đã bị huỷ / xoá hẳn
  /* Nhắc "cần duyệt" chỉ còn nghĩa khi đơn vẫn đang chờ */
  const zk=(row&&row.zk)||n.zk||'';
  if(zk==='apprNeed'&&r.status!=='pending')return 'decided';
  /* ★ v8.1 — mục review của cấp cuối còn nghĩa khi đơn CHƯA được chính họ
     ký. Đơn đang chờ Section Chief vẫn phải nằm trong bản tin sáng (họ cần
     thấy toàn cảnh), nên KHÔNG được lấy "chưa approved" làm cớ để loại —
     đó đúng là lỗi sẽ nuốt sạch bản tin sau khi mọi tin gửi cấp cuối
     chuyển hết sang kênh này.
     Chỉ bỏ khi: cấp cuối đã ký, hoặc đơn bị từ chối. */
  if(zk==='finalNote'){
    if(r.status==='rejected')return 'rejected';
    const ap=r.appr||{};
    const fin=(typeof LVL_FINAL!=='undefined')?LVL_FINAL:'kmgr';
    if(ap[fin]&&!ap[fin].reject)return 'endorsed';
  }
  return '';
}
/* Sổ chờ còn mục nào ĐÁNG gửi không — bỏ mục đã lỗi thời. Không lọc thì bản
   tin sáng sẽ nhắc những việc đã không còn. */
function digestLive(){
  const out=[];
  const all=S.digest||{};
  Object.keys(all).forEach(id=>{
    if(digestStale(id,all[id]))return;
    out.push(Object.assign({notifId:id},all[id]));
  });
  return out.sort((a,b)=>(a.at||0)-(b.at||0));
}
/* Gom sổ chờ thành CÁC GÓI, mỗi THỂ LOẠI một gói. */
/* ============================================================
   ★ v8.1 — BẢN TIN 08:00 CỦA QUẢN LÝ NGƯỜI HÀN LÀ MỘT BẢNG REVIEW
   ------------------------------------------------------------
   Các gói digest khác chỉ cần nối các dòng đã dựng sẵn lại: người nhận là
   nhân viên, mỗi dòng là việc của chính họ, đọc tới đâu hiểu tới đó.

   Gói của cấp cuối thì khác hẳn về mục đích: một người bận, mỗi sáng liếc
   MỘT tin để nắm cả nhà máy. Nối 20 khối dòng rời rạc là bắt họ tự cộng
   nhẩm. Nên gói này được dựng lại từ CHÍNH các đơn (nhờ `reqId` lưu trong
   sổ chờ):

       · một khối TỔNG QUAN: mỗi loại đơn mấy cái, tăng ca tổng bao nhiêu giờ,
         bao nhiêu đơn đã được Section Chief duyệt / còn chờ duyệt;
       · rồi từng loại một khối, đơn xếp theo NGÀY, mỗi đơn một dòng gọn;
       · đơn còn chờ Section Chief đánh dấu "⏳" để phân biệt với đơn đã duyệt.

   Đơn nào tra không ra (đã xoá, hoặc mục cũ chưa có reqId) thì rơi về cách
   nối dòng cũ — không bao giờ nuốt mất một mục nào của sổ chờ.
   ============================================================ */
const DG_TYPE_ORDER=['ot','multi','leave','swap','change','wt','late'];
const DG_TYPE_EN={leave:'LEAVE',swap:'SHIFT SWAP',ot:'OVERTIME',change:'SHIFT CHANGE',
                  wt:'MISSING SCAN',late:'LATE / EARLY LEAVE',multi:'CONSECUTIVE DAYS'};
/* Tổng giờ tăng ca của một đơn — dùng đúng số giờ đã tính trong đơn */
/* reqDays() nằm ở js/08-requests.js. File này vốn chạy được độc lập (bộ
   kiểm thử nạp riêng), nên đọc thẳng r.days khi không có hàm đó — mất giờ
   OT trong bản tin review là mất đúng con số người ta cần nhất. */
function dgDays(r){
  if(typeof reqDays==='function')return reqDays(r)||[];
  return (r&&Array.isArray(r.days))?r.days:[];
}
function dgOtHours(r){
  if(!r||r.type!=='ot')return 0;
  return dgDays(r).reduce((a,d)=>a+(+d.hours||0),0);
}
/* Một đơn = MỘT dòng trong bảng review. Ngắn hơn zReqLines vì ở đây người
   đọc quét cả chục dòng, không soi từng đơn. */
function dgOneRow(r){
  const days=dgDays(r);
  const d0=days[0]||{iso:r.from};
  const when=(r.type==='multi')
    ? (zDate(r.from)+' → '+zDate(r.to))
    : (zDate(d0.iso)+(days.length>1?(' +'+(days.length-1)+'d'):''));
  const who=zName(r.empId);
  let what='';
  if(r.type==='ot'){
    const h=dgOtHours(r);
    what=(d0.timeIn||'')+'–'+(d0.timeOut||'')+(h?('  '+rnd1x(h)+'h'):'');
  }else if(r.type==='swap'){
    what=zShift(zStd(r.empId,d0.iso))+' ⇄ '+zName(r.withId);
  }else if(r.type==='wt'||r.type==='late'){
    what=(d0.timeIn||'')+'–'+(d0.timeOut||'');
  }else{
    what=zShift(d0.code||r.code||'');
  }
  /* ⏳ = còn chờ Section Chief; không dấu = đã duyệt, đang áp dụng */
  return {wait:(r.status!=='approved'),when,who,what};
}
/* Đệm cột NGÀY và cột TÊN cho một khối — Zalo dùng phông tỉ lệ nên không
   thẳng tuyệt đối, nhưng mắt vẫn dò được cột giờ nhanh hơn hẳn so với các
   dòng dài ngắn tuỳ tiện. Cùng cách làm với zHoldLines(). */
function dgPadBlock(rows){
  const w1=Math.min(16,rows.reduce((m,x)=>Math.max(m,x.when.length),0));
  const w2=Math.min(20,rows.reduce((m,x)=>Math.max(m,x.who.length),0));
  const pad=(s,w)=>s.length>=w?s:(s+' '.repeat(w-s.length));
  return rows.map(x=>'  '+(x.wait?'⏳ ':'   ')+pad(x.when,w1)+'  '+pad(x.who,w2)+'  '+x.what);
}
function rnd1x(v){return Math.round((+v||0)*10)/10;}
/* Thân tin review — trả null nếu không dựng được (để rơi về cách cũ) */
function dgReviewLines(rows){
  const reqs=[],seen={};
  rows.forEach(x=>{
    const id=x&&x.reqId;
    if(!id||seen[id])return;
    const r=(typeof S!=='undefined'&&S.requests)?S.requests[id]:null;
    if(!r)return;
    seen[id]=1;reqs.push(r);
  });
  if(!reqs.length)return null;

  const byType={};
  reqs.forEach(r=>{(byType[r.type]=byType[r.type]||[]).push(r);});
  const types=DG_TYPE_ORDER.filter(k=>byType[k]).concat(
    Object.keys(byType).filter(k=>DG_TYPE_ORDER.indexOf(k)<0));

  const nWait=reqs.filter(r=>r.status!=='approved').length;
  const otH=reqs.reduce((a,r)=>a+dgOtHours(r),0);
  const people=new Set(reqs.map(r=>r.empId)).size;

  const L=[];
  L.push('SUMMARY');
  const wT=Math.min(20,types.reduce((m,k)=>Math.max(m,(DG_TYPE_EN[k]||k).length),0));
  types.forEach(k=>{
    const n=byType[k].length;
    const nm=(DG_TYPE_EN[k]||String(k).toUpperCase());
    const extra=(k==='ot'&&otH)?('   '+rnd1x(otH)+'h total'):'';
    L.push('  '+(nm.length>=wT?nm:nm+' '.repeat(wT-nm.length))+'  '+n+extra);
  });
  L.push('  ── '+reqs.length+' request(s) · '+people+' employee(s)');
  L.push(nWait?('  '+(reqs.length-nWait)+' approved by Section Chief · '+nWait+' still waiting for Section Chief')
              :'  All approved by Section Chief — schedule already updated');

  types.forEach(k=>{
    const list=byType[k].slice().sort((a,b)=>String(a.from||'').localeCompare(String(b.from||'')));
    L.push('');
    L.push((DG_TYPE_EN[k]||String(k).toUpperCase())+' ('+list.length+')');
    dgPadBlock(list.map(dgOneRow)).forEach(x=>L.push(x));
  });
  return L;
}

function digestBuild(rows,dayLabel){
  const byGroup=Object.create(null);
  rows.forEach(r=>{(byGroup[r.group||'misc']=byGroup[r.group||'misc']||[]).push(r);});
  return Object.keys(byGroup).map(g=>{
    const list=byGroup[g];
    const tos=[];list.forEach(r=>{if(r.to&&tos.indexOf(r.to)<0)tos.push(r.to);});
    let lines=null;
    /* Gói của cấp cuối dựng lại thành BẢNG REVIEW (xem khối ★ v8.1 ở trên);
       tra không ra đơn nào thì rơi về cách nối dòng cũ. */
    if(g==='finalNote')lines=dgReviewLines(list);
    if(!lines){
      lines=[];
      list.forEach((r,i)=>{
        if(i)lines.push('— — —');
        lines=lines.concat(r.lines||[]);
      });
    }
    if(lines.length>DIGEST_MAX_LINES){
      const cut=lines.length-DIGEST_MAX_LINES;
      lines=lines.slice(0,DIGEST_MAX_LINES).concat(['','… and '+cut+' more line(s) — open the app to see all']);
    }
    const item={
      to:list[0].to,
      toName:tos.length>1?(tos.length+' employees'):(list[0].toName||''),
      title:(DIGEST_TITLE[g]||DIGEST_TITLE.misc)+' · '+list.length+
            (g==='finalNote'?' request(s)':' item(s)')+(dayLabel?(' · '+dayLabel):''),
      lines:lines,
      action:list[0].action||'',
      group:g, bcast:1, pri:'batch',
      notifId:list[0].notifId,
      notifIds:list.map(r=>r.notifId),
      tos:tos
    };
    item.n=item.notifIds.length;
    item.fp=zaloFp(item);
    return item;
  });
}
/* ------------------------------------------------------------
   BẮN BẢN TIN — chỉ MỘT máy được làm việc này mỗi ngày.
   Transaction trên `meta/digestDay`: máy nào ghi được khoá ngày hôm nay thì
   thắng, các máy khác thấy khoá đã đúng ngày nên bỏ cuộc (trả undefined =
   huỷ transaction). Đây là cách duy nhất chắc chắn khi 23 máy có thể cùng
   mở app lúc 08:00 — so giờ ở phía máy thì máy nào cũng thấy "chưa ai bắn".
   ------------------------------------------------------------ */
let _digestBusy=false;
function digestFlush(force,cb){
  const done=ok=>{_digestBusy=false;cb&&cb(!!ok);};
  try{
    if(_digestBusy){cb&&cb(false);return;}
    if(typeof fbRef==='undefined'||!fbRef){cb&&cb(false);return;}
    if(typeof fbReady==='function'&&!fbReady()){cb&&cb(false);return;}
    if(!force&&!digestDue()){cb&&cb(false);return;}
    const rows=digestLive();
    /* Sổ chờ chỉ toàn mục lỗi thời → vẫn phải dọn, nhưng KHÔNG gửi tin rỗng
       (quy tắc R5 ở ZALO-BOT.md). */
    if(!rows.length){
      digestSweep([]);
      digestStamp();
      done(true);return;
    }
    _digestBusy=true;
    const day=digestDayKey();
    const prevDay=(S.meta&&S.meta.digestDay)||'';
    fbRef.child('meta').child('digestDay').transaction(cur=>{
      if(!force&&cur===day)return;          // máy khác vừa bắn xong → bỏ cuộc
      return day;
    },(err,committed)=>{
      if(err||!committed){done(false);return;}
      /* Ghi mốc vào bộ nhớ NGAY, không đợi listener `meta` bay về. Nếu trong
         khoảng chờ đó có một save() vì việc khác, nó sẽ đẩy nguyên nhánh
         `meta` cũ (chưa có digestDay) đè lên máy chủ → hôm sau bắn lại lần
         hai. Một dòng gán chặn đứt được chuyện đó. */
      S.meta=S.meta||{};S.meta.digestDay=day;
      /* Thắng quyền bắn. Từ đây mới được ghi hàng đợi.
         ★ Dọn sổ chờ theo TỪNG GÓI GHI ĐƯỢC, không dọn cả lượt. Ghi trượt
         gói nào thì mục của gói đó Ở LẠI sổ chờ, và mốc ngày được trả về
         để lần mở app sau bắn lại — đúng bài học của v6.7: không bao giờ
         coi là xong khi máy chủ chưa nhận. */
      const label=digestSpanLabel(rows);
      const items=digestBuild(rows,label);
      const jobs=items.map(it=>{
        const row={
          to:it.to, toName:it.toName, title:it.title, lines:it.lines,
          action:it.action||'', group:it.group, bcast:1,
          pri:it.pri, notifId:it.notifId, notifIds:it.notifIds, tos:it.tos,
          n:it.n, fp:it.fp, digest:1,
          state:'pending', createdAt:Date.now()
        };
        let pr;
        try{ pr=fbRef.child('zaloQueue').child(it.notifId).set(row); }
        catch(e){ console.warn('[zalo] gói bản tin gom không hợp lệ',e); return Promise.resolve(null); }
        return pr.then(()=>it).catch(e=>{
          console.warn('[zalo] không ghi được bản tin gom',e);return null;
        });
      });
      Promise.all(jobs).then(res=>{
        const sentIds=[];
        res.filter(Boolean).forEach(it=>{ sentIds.push.apply(sentIds,it.notifIds); });
        digestSweep(rows.filter(r=>sentIds.indexOf(r.notifId)>=0));
        const allOk=res.every(Boolean);
        if(!allOk){
          /* Trả mốc ngày về để hôm nay còn bắn lại phần còn thiếu */
          S.meta.digestDay=prevDay;
          fbRef.child('meta').child('digestDay').set(prevDay||null).catch(()=>{});
        }
        done(allOk);
      });
    });
  }catch(e){
    console.warn('[zalo] bỏ qua lỗi bản tin gom, app vẫn chạy bình thường',e);
    done(false);
  }
}
/* Nhãn khoảng thời gian đã gom — để người đọc biết bản tin phủ từ bao giờ.
   Quan trọng khi cả ngày không ai mở app và bản tin dồn sang hôm sau. */
function digestSpanLabel(rows){
  if(!rows.length)return '';
  const a=new Date(rows[0].at||Date.now()), b=new Date(rows[rows.length-1].at||Date.now());
  const f=x=>pad(x.getDate())+'/'+pad(x.getMonth()+1);
  return f(a)===f(b)?f(a):(f(a)+'→'+f(b));
}
/* Dọn sổ chờ: bỏ các mục vừa gửi + mọi mục đã lỗi thời còn sót. */
function digestSweep(sent){
  const keep=Object.create(null);
  (sent||[]).forEach(r=>{keep[r.notifId]=1;});
  let touched=false;
  Object.keys(S.digest||{}).forEach(id=>{
    /* Xoá: đã gửi rồi (keep), hoặc đã lỗi thời (đơn bị huỷ / đã duyệt xong) */
    if(keep[id]||digestStale(id,S.digest[id])){ delete S.digest[id]; touched=true; }
  });
  if(touched&&typeof save==='function')save();
}
function digestStamp(){
  const day=digestDayKey();
  S.meta=S.meta||{};S.meta.digestDay=day;
  if(typeof fbRef==='undefined'||!fbRef)return;
  fbRef.child('meta').child('digestDay').set(day).catch(()=>{});
}
/* Bao nhiêu mục đang chờ bản tin sáng — cho màn Dữ liệu và cho harness. */
function digestPending(){return digestLive().length;}
/* Bấm tay: gửi ngay không cần chờ 08:00 (nút ở màn Dữ liệu, quản trị dùng). */
function digestSendNow(){
  if(!digestPending()){toast(t('Chưa có mục nào chờ bản tin sáng'));return;}
  if(!confirm(t('Gửi ngay bản tin gom? Sổ chờ sẽ được dọn.')))return;
  digestFlush(true,ok=>toast(ok?t('Đã gửi bản tin gom'):t('Chưa gửi được — thử lại sau')));
}
/* ------------------------------------------------------------
   HẸN GIỜ: kiểm lúc mở app và mỗi 5 phút sau đó. Máy để mở qua đêm cũng
   bắn đúng 08:00 mà không cần ai đụng vào.
   ------------------------------------------------------------ */
const DIGEST_TICK_MS=5*60*1000;
let _digestTick=null;
function digestStartTimer(){
  if(_digestTick)return;
  _digestTick=setInterval(()=>{ try{ digestFlush(); }catch(e){} },DIGEST_TICK_MS);
  try{
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='visible')try{digestFlush();}catch(e){}
    });
  }catch(e){}
}

/* ============================================================
   RÚT MỘT TIN KHỎI HÀNG ĐỢI  (thu hồi)
   ------------------------------------------------------------
   Thông báo trong app bị gỡ (đơn huỷ, đổi người cover, ô lịch trả về ca
   chuẩn…) thì tin tương ứng còn nằm chờ ở `zaloQueue` cũng phải biến mất —
   nếu không, người ta vẫn nhận tin nhắn Zalo cho một việc đã không còn.

   Khoá hàng đợi CHÍNH LÀ notifId (quy tắc R6 chống trùng ở zaloEnqueue),
   nên rút chỉ là xoá đúng một nhánh con.

   ★ LỖI CŨ — THU HỒI CHƯA TỪNG CHẠY MỘT LẦN NÀO
   Bản trước đọc `zaloQueue/<id>` trước khi xoá, để tránh đụng tin đã gửi.
   Nhưng luật Firebase đặt `zaloQueue: {".read": false}` (cố ý — nhân viên
   không được đọc tin gửi cho người khác), nên `once('value')` LUÔN bị từ
   chối quyền. Lỗi đó rơi vào `.catch(console.warn)` nên im lặng: nhánh xoá
   nằm sau lời hứa đọc, không bao giờ tới lượt chạy. Mọi tin đã vào hàng đợi
   đều bắn đi bằng hết, kể cả tin của việc vừa bị xoá.

   Nay xoá THẲNG, không đọc. An toàn: Apps Script tự xoá hàng ngay sau khi
   gửi, nên hàng còn nằm đó tức là chưa gửi. Trường hợp xấu nhất là xoá đúng
   lúc nó vừa gửi xong — kết quả y hệt việc Apps Script tự xoá.

   Sau khi có lớp gộp, một hàng đợi đại diện cho NHIỀU thông báo. Chỉ được
   xoá hàng khi thông báo CUỐI CÙNG trong nhóm đó biến mất, nếu không thì
   huỷ một người là mất tin của cả 22 người còn lại. Nhóm tra bằng `n.zq`
   (ghi lúc đẩy hộp gửi, nằm trong S.notifs nên đồng bộ sang máy khác).
   `notifDrop` xoá tuần tự nên tới lượt cuối, những cái trước đã rời
   S.notifs → đếm ra 0 → xoá hàng. Vừa đúng.

   Bọc kín try/catch: Zalo hỏng thì app vẫn phải chạy nguyên vẹn.
   ============================================================ */
function zaloWithdraw(notifId){
  try{
    if(!notifId)return;

    /* 0) Còn nằm ở sổ chờ bản tin sáng → gỡ ra, chưa tốn tin nào.
       Thiếu nhánh này thì đơn OT huỷ lúc 15h hôm nay vẫn được nhắc trong
       bản tin 08:00 sáng mai. */
    if(digestDrop(notifId)){
      if(typeof save==='function')save();
      return;
    }

    /* 1) Còn nằm trong hộp gửi → nhấc ra, chưa tốn gì cả */
    const i=_zOut.findIndex(x=>x.notifId===notifId);
    if(i>=0){
      _zOut.splice(i,1);
      if(!_zOut.length&&_zTimer){clearTimeout(_zTimer);_zTimer=null;_zFirst=0;}
      return;
    }

    if(typeof firebase==='undefined')return;
    if(typeof fbRef==='undefined'||!fbRef)return;

    /* 2) Đã ghi xuống Firebase → tìm hàng đợi thật sự chứa nó */
    const n=(S.notifs||{})[notifId];
    const key=_zq[notifId]||(n&&n.zq)||notifId;

    /* 3) Còn thông báo nào khác cùng hàng đó không? */
    let others=0;
    const all=S.notifs||{};
    for(const k in all){
      const x=all[k];
      if(!x||x.id===notifId||k===notifId)continue;
      if((_zq[x.id]||x.zq||x.id)===key){others++;break;}
    }
    if(others)return;                       // hàng còn phục vụ người khác

    fbRef.child('zaloQueue').child(key).remove()
         .catch(e=>console.warn('[zalo] không rút được tin',e));
    delete _zq[notifId];
  }catch(e){
    console.warn('[zalo] bỏ qua lỗi khi rút tin, app vẫn chạy bình thường',e);
  }
}

/* ============================================================
   DỰNG PHẦN THÂN TIN
   Trình duyệt dựng chữ vì nó có sẵn dữ liệu (tên người, mã ca, ngày).
   Apps Script chỉ ghép lại và gửi — giữ cho phía máy chủ càng ngu càng tốt,
   sửa chữ nghĩa về sau chỉ phải sửa ở đây, không phải deploy lại.
   ============================================================ */
function zaloLines(n, zk){
  const L = [];
  const req = (n && n.reqId && S.requests) ? S.requests[n.reqId] : null;

  switch(zk){
    /* ---- Nhóm E: có đơn đang chờ duyệt (tin giá trị nhất) ----
       Một khối = một đơn. Cấp đang chờ đã nằm trên tiêu đề (zaloTitle) nên
       ở đây không lặp lại. Chuỗi cấp đã duyệt rút thành "passed FE › SM". */
    case 'apprNeed': {
      if(!req) break;
      zReqLines(req,{full:1}).forEach(x=>L.push(x));
      const ch=zChainShort(req);
      if(ch)L.push(ch);
      break;
    }

    /* ---- ★ v7.9: mời cấp cuối ghi nhận ----
       Cùng thân tin với apprNeed (người đọc vẫn cần biết ai · ngày nào ·
       bao nhiêu giờ), nhưng thêm MỘT dòng nói rõ đơn đã duyệt và đang áp
       dụng — để không ai hiểu là công việc đang chờ họ mới chạy được. */
    case 'finalNote': {
      if(!req) break;
      zReqLines(req,{full:1}).forEach(x=>L.push(x));
      break;
    }

    /* ---- Nhóm F: sửa lịch hàng loạt, gộp thành MỘT tin ----
       Mỗi thay đổi một dòng thẳng cột. Dữ liệu ở n.hold (mảng
       {to,iso,std,was,now}) do schedHoldFlush() ở js/06-calendar.js dựng. */
    case 'schedBulk':
      zHoldLines((n && n.hold) || [], n && n.from).forEach(x=>L.push(x));
      if(n && n.from) L.push('By ' + zName(n.from));
      break;

    /* ---- Nhóm A: cần người nhận bấm xác nhận ---- */
    case 'schedChange':
      L.push(zLine(n.iso, n.to, n.std, n.oldCode, n.newCode));
      if(n.from) L.push('By ' + zName(n.from));
      break;

    case 'swapConfirm':
    case 'coverConfirm':
      if(req) zReqLines(req).forEach(x=>L.push(x));
      else if(n.iso) L.push(zDate(n.iso)+'  '+zName(n.to));
      L.push('Requested by ' + zName(n.from));
      break;

    case 'event':
      /* Dòng đầu = NHÓM người nhận + ngày, để đọc preview là biết ngay tin
         này gửi cho ai và cho hôm nào. */
      L.push(((n.aud)?('👥 '+n.aud):'')+(n.iso?('  '+zDate(n.iso)):''));
      /* ★ v8.9 — PHƯƠNG ÁN NHẬP TÀU (js/25-vessel.js). Dựng câu tiếng Anh
         từ chính dữ liệu phương án thay vì bê câu tiếng Việt của app sang.
         Bốn thứ người đọc cần: tàu nào · phương án mấy trên mấy · ngày nào ·
         đã chốt hay chưa. Chữ "TENTATIVE" phải nằm TRONG thân tin nữa, không
         chỉ ở tiêu đề: tin gộp nhiều phương án thì tiêu đề chỉ hiện một lần. */
      if(n.vs){
        const v=n.vs;
        L.push((v.vessel||'Vessel')+'  ·  Option '+(v.opt||1)
               +((v.n>1)?('/'+v.n):'')+'  ·  '+(v.dates||''));
        L.push(v.fixed ? '✅ CONFIRMED arrival date — plan your shift accordingly.'
                       : '⏳ TENTATIVE — arrival date not fixed yet. Other options may follow.');
        if(n.text){
          /* Ghi chú riêng của phương án (nếu có) — cắt phần tiêu đề tiếng Việt
             đã nói ở hai dòng trên, chỉ giữ đuôi ghi chú. */
          const tail=String(n.text).split(' · ').slice(2).join(' · ').trim();
          if(tail) L.push(tail);
        }
        break;
      }
      if(n.text) L.push(n.text);
      break;

    /* ---- ★ v8.9: TÁI CƠ CẤU NHÓM (js/24-reorg.js) ----
       Chỉ tin GỘP (mang n.ro) mới tới được đây — tin riêng của từng người
       gắn nz:1 nên không vào Zalo. Mỗi người một dòng thẳng cột:
           <tên>   <nhóm cũ> › <nhóm mới>   <mẫu ca>
       Người nghỉ việc gom xuống cuối, ghi rõ ngày làm việc cuối cùng. */
    case 'reorg': {
      const ro=n.ro;
      if(!ro){ if(n.text) L.push(String(n.text).replace(/^[^\p{L}\p{N}]+/u,'').trim()); break; }
      L.push('Effective '+zDate(ro.effFrom||'')+(ro.title?('  ·  '+ro.title):''));
      const mv=(ro.moves||[]).slice(0,25);
      mv.forEach(m=>{
        L.push('· '+zName(m.id)+'   '+(m.old||'—')+' › '+(m.team||'—')
               +(m.pat?('   '+m.pat):''));
      });
      if((ro.moves||[]).length>mv.length) L.push('… +'+((ro.moves||[]).length-mv.length)+' more');
      (ro.joiners||[]).forEach(x=>{
        L.push('· '+zName(x.id)+'   joins '+(x.team||'—')+' from '+zDate(x.from||''));
      });
      (ro.pauses||[]).forEach(x=>{
        L.push('· '+zName(x.id)+'   long leave '+(x.code||'')+'  '
               +zDate(x.from||'')+' → '+zDate(x.to||''));
      });
      (ro.leavers||[]).forEach(x=>{
        L.push('· '+zName(x.id)+'   leaving — last working day '+zDate(x.last||''));
      });
      L.push('Rosters from '+zDate(ro.effFrom||'')+' to '+zDate(ro.toIso||'')+' have been rebuilt.');
      break;
    }

    /* ---- Nhóm G: lịch đào tạo (js/22-training.js) ----
       Dựng thân tin từ CHÍNH BẢN GHI đào tạo, không bê câu tiếng Việt của
       app sang. Ba thứ người đọc cần: ngày nào · trong ca hay tăng ca (mấy
       giờ) · ai đi. Tên buổi đứng đầu vì đó là kết luận. */
    case 'training': {
      const tr=(n && n.trId && S.trainings) ? S.trainings[n.trId] : null;
      if(!tr){ if(n.text) L.push(String(n.text).replace(/^[^\p{L}\p{N}]+/u,'').trim()); break; }
      const days=(typeof trDays==='function')?trDays(tr):(tr.days||[]);
      const emps=(typeof trEmps==='function')?trEmps(tr):(tr.emps||[]);
      /* Tên khoá đứng trước tên buổi khi buổi thuộc một khoá (★ v7.8) */
      L.push(String(((typeof trFullTitle==='function')&&trFullTitle(tr))||tr.title||'Training').trim());
      /* ★ v7.1 — MỖI NGÀY MỘT DÒNG, nói rõ ngày đó là trong ca hay tăng ca.
         Trước đây in một câu duy nhất cho cả buổi; nay chế độ quyết theo
         từng cặp (người, ngày) nên một câu là NÓI SAI với một nửa người
         nhận. trZaloDayLines() ở js/22-training.js dựng các dòng này.
         Tối đa 5 ngày rồi "+N more" — tin đọc trên điện thoại. */
      const dls=(typeof trZaloDayLines==='function')
        ? trZaloDayLines(tr)
        : [days.slice(0,5).map(zDate).join(' · ')];
      dls.slice(0,5).forEach(x=>L.push(x));
      if(dls.length>5)L.push('… +'+(dls.length-5)+' more days');
      if(tr.overnight||tr.noLunch)
        L.push((tr.overnight?'Ends next day.':'')+(tr.noLunch?' Lunch hour deducted.':'').trim());
      if(tr.place) L.push('Venue: '+tr.place);
      const who=emps.slice(0,12).map(zName).join(', ');
      if(who) L.push('Attendees ('+emps.length+'): '+who+(emps.length>12?', …':''));
      if(tr.note) L.push(tr.note);
      /* Chờ duyệt thì nói thẳng — người nhận là cấp duyệt, không phải người
         đi học, mà hai tin nhìn giống nhau thì họ bỏ qua. */
      if(n.trSt==='pending')
        L.push('⏳ Requested by '+zName(tr.by)+' — pending approval');
      else if(typeof trIsOt==='function' && trIsOt(tr))
        L.push('An overtime request has been created for each affected attendee.');
      break;
    }

    /* ---- Nhóm B: kết quả duyệt đơn ---- */
    case 'approved': case 'rejected': case 'revoked': case 'cancelled': {
      if(req){
        const lastBy=(zk==='approved'&&req.decidedBy)?req.decidedBy:(n.from||'');
        zReqLines(req).forEach(x=>L.push(x));
        /* ★ v7.9 — đơn qua Section Chief là ĐÃ DUYỆT và lịch đã ghi. Nói
           "Final:" ở đây là sai sự thật khi cấp cuối chưa ghi nhận, mà nói
           "pending the Korean manager" thì người nhận tưởng đơn còn treo.
           Câu dưới nói đúng cả hai: đã duyệt, đã áp dụng, phần ghi nhận của
           cấp cuối sẽ tới sau. */
        if(zk==='approved'){
          const prov=(typeof reqIsProvisional==='function')&&reqIsProvisional(req);
          L.push((prov?'Approved by ':'Final: ')
                +(lastBy?zName(lastBy):zLevelPlain('kmgr'))+' — schedule updated');
          if(prov)L.push('Final endorsement by the Korean manager will follow.');
        }
        else if(zk==='rejected') L.push('Rejected by '+zName(lastBy));
        else if(zk==='revoked')  L.push('Withdrawn by '+zName(lastBy)+' — back to standard');
        else                     L.push('Cancelled by '+zName(lastBy));
      }else if(n.text){
        /* Đơn đã bị xoá khỏi S.requests (huỷ / dọn kỳ cũ) — vẫn phải gửi được */
        L.push(String(n.text).replace(/^[^\p{L}\p{N}]+/u,'').trim());
      }
      break;
    }

    /* ---- Nhóm C: phản hồi hai chiều giữa nhân viên ---- */
    case 'swapNo':
      L.push((n.iso?zDate(n.iso)+'  ':'')+zName(n.from)+' said no'
            +(n.oldCode?(' — you stay '+zShift(n.oldCode)):''));
      break;
    case 'coverNo':
      L.push((n.iso?zDate(n.iso)+'  ':'')+zName(n.from)+' said no — OT still uncovered');
      break;
    case 'coverRemoved':
      L.push((n.iso?zDate(n.iso)+'  ':'')+'You are off OT cover'
            +(n.iso?(' — your shift '+zShift(zStd(n.to,n.iso))):''));
      break;
    case 'schedDecline':
      L.push(zLine(n.iso, n.from, n.std, n.oldCode, n.newCode)+'  declined');
      L.push('Back to standard — reassign someone');
      break;
    case 'schedRevoke':
      L.push((n.iso?zDate(n.iso)+'  ':'')+zName(n.to)+'  '
            +'back to '+zShift(n.std||n.oldCode));
      if(n.from) L.push('By ' + zName(n.from));
      break;

    default:
      /* Loại tin chưa có bản tiếng Anh riêng — dùng lại câu app đã dựng,
         bỏ emoji đầu dòng vì tiêu đề đã nói rồi. Không nuốt tin. */
      if(n.text) L.push(String(n.text).replace(/^[^\p{L}\p{N}]+/u,'').trim());
  }

  /* ------------------------------------------------------------
     LƯỚI AN TOÀN — KHÔNG BAO GIỜ NUỐT TIN   ★ v6.4
     zaloEnqueue bỏ qua gói có lines rỗng. Khuôn ngắn dựng thân tin CHỈ từ
     dữ liệu (ngày, ca, tên) nên đơn hỏng — mất mảng days, đơn cũ thiếu
     trường, hoặc reqDays chưa nạp — sẽ ra mảng rỗng và tin biến mất trong
     im lặng. Bản dài trước đây vô tình không dính vì luôn in "Employee:".
     Ở đây bắt lại: rỗng thì lấy câu app đã dựng, cùng lắm là một dòng tối
     thiểu. Thà tin xấu còn hơn không có tin.
     ------------------------------------------------------------ */
  if(!L.filter(x=>x&&String(x).trim()).length){
    if(n && n.text) L.push(String(n.text).replace(/^[^\p{L}\p{N}]+/u,'').trim());
    else if(n && n.iso) L.push(zDate(n.iso)+'  '+zName(n.to));
    else if(n && n.to)  L.push(zName(n.to));
    if(!L.length)L.push('See the app for details.');
  }

  /* Giữ lại dòng trống ở GIỮA (để chia đoạn), chỉ cắt ở hai đầu */
  while(L.length && !L[0])        L.shift();
  while(L.length && !L[L.length-1]) L.pop();
  return L;
}

/* ============================================================
   ĐỒNG HỒ HẠN MỨC — đọc số liệu Apps Script ghi ngược lại
   Gói free Zalo Bot: 3.000 tin/tháng · 50 user. Ở 20 người dự kiến dùng ~11%.
   Hàm này để màn quản trị gọi; chưa gắn giao diện thì gọi tay trong console.
   ============================================================ */
function zaloQuota(cb){
  if(typeof fbRef==='undefined' || !fbRef){ cb && cb(null); return; }
  const ym = new Date().toISOString().slice(0,7);   // "2026-08"
  fbRef.child('zaloStat').child(ym).once('value')
    .then(s=>cb && cb(s.val() || {sent:0, failed:0}))
    .catch(()=>cb && cb(null));
}
