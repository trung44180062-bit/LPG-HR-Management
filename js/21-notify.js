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
  event       : 'batch'     // D1 admin đã chủ động bấm gửi
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

  /* Nhóm B — kết quả duyệt đơn */
  approved    : 'now',      // B3 kết quả cuối, ảnh hưởng lịch đi làm
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

  /* Nhóm C — phản hồi hai chiều giữa nhân viên */
  schedRevoke : 'now',      // C2 NV có thể đã gửi đơn theo thay đổi đó
  swapNo      : 'now',      // C4 A phải tìm người khác gấp
  coverNo     : 'now',      // C6 phải chọn người khác, không thì đơn kẹt
  schedDecline: 'batch',    // C1 QL cần biết để xếp người khác
  coverRemoved: 'batch',    // C7 họ đã sắp xếp lịch cá nhân theo đó rồi
  swapOk      : null,       // C3 tin tốt xuôi chiều
  coverOk     : null        // C5 tin tốt xuôi chiều
};

/* Khoá gộp: cùng người nhận + cùng khoá này trong 10 phút → gộp 1 tin. */
const ZALO_GROUP_KEY = {
  apprNeed:'apprNeed', schedBulk:'sched',
  approved:'reqResult', rejected:'reqResult', revoked:'reqResult', cancelled:'reqResult',
  schedChange:'sched', schedRevoke:'sched', schedDecline:'sched',
  swapConfirm:'swap', swapNo:'swap',
  coverConfirm:'cover', coverNo:'cover', coverRemoved:'cover',
  event:'event'
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

/* Tiêu đề tin — dòng đầu phải là kết luận, liếc 1 giây là hiểu. */
const ZALO_TITLE = {
  apprNeed    : '📥 APPROVAL REQUIRED',
  schedBulk   : '📅 WORK SCHEDULE UPDATED',
  schedChange : '📅 YOUR WORK SCHEDULE HAS CHANGED',
  swapConfirm : '🔄 SHIFT SWAP REQUESTED WITH YOU',
  coverConfirm: '🙋 YOU ARE ASKED TO COVER OVERTIME',
  event       : '📢 ANNOUNCEMENT',
  approved    : '✅ REQUEST APPROVED',
  rejected    : '❌ REQUEST REJECTED',
  revoked     : '↩️ APPROVAL WITHDRAWN',
  cancelled   : '🗑️ REQUEST CANCELLED',
  schedRevoke : '↩️ SCHEDULE CHANGE WITHDRAWN',
  schedDecline: '⚠️ EMPLOYEE DECLINED YOUR SCHEDULE CHANGE',
  swapNo      : '❌ SHIFT SWAP DECLINED',
  coverNo     : '❌ OT COVER DECLINED',
  coverRemoved: 'ℹ️ YOU HAVE BEEN REMOVED FROM OT COVER'
};

/* Việc người nhận phải làm — dòng cuối, luôn phải có. */
const ZALO_ACTION = {
  apprNeed    : 'Open the app › Approvals to approve or reject.',
  schedBulk   : 'Everyone listed above: open the app to confirm or decline your own change.',
  schedChange : 'Open the app to confirm or decline this change.',
  swapConfirm : 'Open the app to accept or decline.',
  coverConfirm: 'Open the app to accept or decline the OT cover.',
  rejected    : 'Check the reason in the app and submit a new request if needed.',
  revoked     : 'Check your working schedule in the app.',
  schedRevoke : 'If you already submitted a request based on this change, cancel it in the app.',
  swapNo      : 'Open the app and choose another colleague.',
  coverNo     : 'Open the app and choose another person to cover.'
};

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
/* "Wed 19/08/2026" — luôn tiếng Anh, không phụ thuộc LANG của người đang mở app */
function zDate(iso){
  if(!iso)return '';
  const p=String(iso).split('-');
  if(p.length!==3)return String(iso);
  let dw='';
  try{dw=Z_DOW[new Date(iso+'T00:00:00').getDay()]+' ';}catch(e){}
  return dw+p[2]+'/'+p[1]+'/'+p[0];
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
    return n?('Site Manager ('+n+')'):'Site Manager';
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
  return {fe:'Field Engineer',trung:'Site Manager',kmgr:'Korean Manager'}[k]||k||'';
}
/* ---- Chi tiết một đơn, dạng nhiều dòng, tiếng Anh ----
   Dùng chung cho tin "cần duyệt", "đã duyệt", "bị từ chối"… nên người đọc
   không phải mở app mới biết đơn nói gì (yêu cầu ZALO-PHUONG-AN ô K14). */
function zReqLines(r){
  const L=[];
  if(!r)return L;
  const e=(typeof empById==='function')?empById(r.empId):null;
  const days=(typeof reqDays==='function')?reqDays(r):[];

  L.push('Employee: '+zName(r.empId)+' ('+(r.empId||'')+')'
        +((e&&e.team)?' · Team '+e.team:''));
  L.push('Type: '+(Z_TYPE[r.type]||r.type||''));

  /* Ngày & nội dung từng dòng — tối đa 5 dòng rồi gộp cho tin khỏi dài */
  if(r.type==='multi'){
    L.push('Period: '+zDate(r.from)+' → '+zDate(r.to)
          +((r.timeIn||r.timeOut)?'  ('+(r.timeIn||'')+'–'+(r.timeOut||'')+')':''));
  }else{
    const MAXD=5;
    days.slice(0,MAXD).forEach(d=>{
      const before=(r.before&&r.before[d.iso]!==undefined)?r.before[d.iso]
                  :((typeof eff==='function')?(eff(r.empId,d.iso).code||''):'');
      if(r.type==='swap'){
        const bw=(r.beforeW&&r.beforeW[d.iso]!==undefined)?r.beforeW[d.iso]
                :((typeof eff==='function')?(eff(r.withId,d.iso).code||''):'');
        L.push('• '+zDate(d.iso)+' :  '+(before||'OFF')+' ⇄ '+(bw||'OFF')
              +'  ('+zName(r.withId)+')');
      }else if(r.type==='ot'){
        const h=(typeof reqDayHours==='function')?reqDayHours(d):(d.hours||0);
        L.push('• '+zDate(d.iso)+' :  '+(d.code||'OT')+'  '+(d.timeIn||'')+'–'+(d.timeOut||'')
              +((d.isoEnd&&d.isoEnd!==d.iso)?' (+1d)':'')
              +(h?'  = '+(Math.round(h*10)/10)+'h':''));
      }else if(r.type==='wt'||r.type==='late'){
        L.push('• '+zDate(d.iso)+' :  '+(d.timeIn||'')+'–'+(d.timeOut||''));
      }else{
        L.push('• '+zDate(d.iso)+' :  '+(before||'OFF')+' → '+(d.code||'OFF'));
      }
    });
    if(days.length>MAXD)L.push('• … and '+(days.length-MAXD)+' more day(s)');
  }

  /* Con số quyết định */
  if(r.type==='ot'&&typeof reqHours==='function'){
    const h=reqHours(r);
    if(h)L.push('Total overtime: '+(Math.round(h*10)/10)+' h');
  }
  if(r.type==='leave'){
    const n=(typeof reqLeaveDays==='function')?reqLeaveDays(r):days.length;
    if(n)L.push('Total leave: '+(Math.round(n*10)/10)+' day(s)');
  }

  /* Người liên quan */
  if(r.withId)L.push('Swap with: '+zName(r.withId)
    +(r.confirmW?' — '+(Z_CONFIRM_ST[r.confirmW]||r.confirmW):''));
  if(r.coverId)L.push('OT cover: '+zName(r.coverId)
    +' — '+(Z_COVER_ST[r.coverSt||'pending']||r.coverSt));
  if(r.guarantorId)L.push('Guarantor: '+zName(r.guarantorId));

  /* Lý do / ghi chú */
  if(r.type==='wt'&&typeof wtReasonLabel==='function'){
    const wl=wtReasonLabel(r);
    if(wl)L.push('Reason: '+wl);
  }
  if(r.note)L.push('Note: "'+r.note+'"');
  if(r.reason)L.push('Rejection reason: '+r.reason);

  /* Nguồn gốc */
  const by=(r.byId&&r.byId!==r.empId)?(' by '+zName(r.byId)):'';
  L.push('Submitted'+by+' at '+zDateTime(r.createdAt));
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

/* ---- Thân tin "sửa lịch nhiều người", nhóm theo NGƯỜI ----
   Mỗi người một dòng gồm mọi ngày của họ, để ai cũng dò được tên mình mà
   không phải đọc hết. Dùng chung cho HAI đường:
     · schedBulk — quản lý chủ động bấm 🔕 giữ rồi 🔔 gửi (06-calendar.js)
     · gộp tự động — quản lý quên bấm giữ, hộp gửi tự cuộn các thay đổi rời
       rạc trong cùng một khoảng thời gian lại (zaloOutMergeSched bên dưới)
   rows = [{to,iso,was,now}] */
function zHoldLines(rows, fromId){
  const L=[];
  rows=rows||[];
  if(!rows.length)return L;
  const byPerson={};
  rows.forEach(x=>{ (byPerson[x.to]=byPerson[x.to]||[]).push(x); });
  const ids=Object.keys(byPerson)
    .sort((a,b)=>String(zName(a)).localeCompare(String(zName(b)),'vi'));
  L.push(ids.length+' employee(s) · '+rows.length+' change(s)');
  if(fromId)L.push('Changed by: '+zName(fromId));
  L.push('');
  const MAXP=25;                          // trần người, phòng tin dài quá
  ids.slice(0,MAXP).forEach(id=>{
    const days=byPerson[id]
      .sort((a,b)=>String(a.iso).localeCompare(String(b.iso)))
      .map(x=>zDate(x.iso).replace(/\/\d{4}$/,'')+' '+(x.was||'OFF')+'→'+(x.now||'OFF'));
    L.push('• '+zName(id)+' :  '+days.join('  ·  '));
  });
  if(ids.length>MAXP)L.push('• … and '+(ids.length-MAXP)+' more employee(s) — see the app');
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
    const lvl=n.lvl||'';
    if(lvl==='kmgr')return '📥 FINAL APPROVAL REQUIRED';
    if(lvl==='fe')  return '📥 APPROVAL REQUIRED — FIELD ENGINEER';
    return '📥 APPROVAL REQUIRED';
  }
  if(zk==='schedBulk'){
    /* Số người ngay trên tiêu đề — người ta nhìn preview thông báo là biết
       ngay đây là đợt sửa lịch lớn hay chỉ vài ô lẻ. */
    const p=new Set(((n&&n.hold)||[]).map(x=>x.to)).size;
    return '📅 WORK SCHEDULE UPDATED' + (p?(' — ' + p + ' PEOPLE'):'');
  }
  return ZALO_TITLE[zk] || '🔔 NOTIFICATION';
}
/* Tin gửi CHUNG cho cả nhóm chứ không phải riêng một người → Apps Script bỏ
   dòng "👤 <tên người nhận>" ở đầu tin, vì ghi tên một người là gây hiểu nhầm. */
function zaloIsBroadcast(n, zk){
  return (zk==='event' || zk==='schedBulk') ? 1 : 0;
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
  host.title=np>1?('📅 WORK SCHEDULE UPDATED — '+np+' PEOPLE')
                 :ZALO_TITLE.schedChange;
  host.lines=zHoldLines(host.rows,host.fromId||from);
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
    const pri = (n.kind==='info') ? ZALO_INFO_CHANNEL[zk] : ZALO_CHANNEL[n.kind];
    if(!pri) return;                  // ⚪ APP-ONLY hoặc kind lạ → im lặng

    /* --- người nhận --- */
    const emp = (typeof empById==='function') ? empById(n.to) : null;
    if(!emp) return;                  // không tra được người thì thôi, đừng bắn mù

    /* --- nội dung --- */
    const lines = zaloLines(n, zk);
    if(!lines.length) return;

    const item = {
      to      : n.to,
      toName  : emp.name || n.to,
      title   : zaloTitle(n, zk),
      lines   : lines,
      action  : ZALO_ACTION[zk] || '',
      group   : ZALO_GROUP_KEY[zk] || 'misc',
      bcast   : zaloIsBroadcast(n, zk),
      pri     : pri,                  // now | batch
      notifId : n.id,

      /* --- các trường chỉ sống trong hộp gửi, không ghi xuống Firebase --- */
      zk      : zk,
      fromId  : n.from || '',
      /* một dòng sửa lịch, để phép gộp 1 cuộn nhiều người vào một tin */
      sc      : (zk==='schedChange')
                ? {to:n.to, iso:n.iso||'', was:n.oldCode||'', now:n.newCode||''}
                : null,
      /* tin gộp của nút 🔔 mang sẵn cả bó dòng */
      rows    : (zk==='schedBulk') ? ((n.hold||[]).slice()) : null
    };
    item.fp = zaloFp(item);

    /* Vào hộp gửi thay vì ghi thẳng. Khoá hàng đợi vẫn là một notifId (quy
       tắc R6 chống trùng) — chỉ khác là sau khi gộp, một khoá có thể đại
       diện cho nhiều thông báo, liệt kê ở `notifIds`. */
    zaloOutPush(item);
  }catch(e){
    console.warn('[zalo] bỏ qua lỗi, app vẫn chạy bình thường', e);
  }
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
    /* ---- Nhóm E: có đơn đang chờ duyệt (tin giá trị nhất) ---- */
    case 'apprNeed': {
      if(!req) break;
      L.push('Waiting for: ' + zLevel(n.lvl || (typeof reqNextLevel==='function'?reqNextLevel(req):'')));
      L.push('');
      zReqLines(req).forEach(x=>L.push(x));
      const ch = zChainLines(req);
      if(ch.length){ L.push(''); ch.forEach(x=>L.push(x)); }
      /* Lời mời xác nhận của người đổi ca / người OT cover được GỘP vào đây
         thay vì bắn thành tin riêng — xem js/13-portal.js (cờ nz:1). */
      if(req.withId && req.confirmW==='pending')
        L.push('⚠️ ' + zName(req.withId) + ' has not confirmed the swap yet.');
      if(req.coverId && (req.coverSt||'pending')==='pending')
        L.push('⚠️ ' + zName(req.coverId) + ' has not accepted the OT cover yet.');
      break;
    }

    /* ---- Nhóm F: sửa lịch hàng loạt, gộp thành MỘT tin ----
       Nhóm theo NGƯỜI: mỗi người một dòng gồm mọi ngày của họ, để ai cũng
       dò được tên mình mà không phải đọc hết. Dữ liệu nằm ở n.hold (mảng
       {to,iso,was,now}) do schedHoldFlush() ở js/06-calendar.js dựng. */
    case 'schedBulk':
      zHoldLines((n && n.hold) || [], n && n.from).forEach(x=>L.push(x));
      break;

    /* ---- Nhóm A: cần người nhận bấm xác nhận ---- */
    case 'schedChange':
      L.push('• ' + zDate(n.iso) + ' :  ' + (n.oldCode||'OFF') + '  →  ' + (n.newCode||'OFF'));
      if(n.from) L.push('Changed by: ' + zName(n.from));
      break;

    case 'swapConfirm':
      L.push('Requested by: ' + zName(n.from));
      if(n.iso) L.push('Date: ' + zDate(n.iso));
      if(req){ L.push(''); zReqLines(req).forEach(x=>L.push(x)); }
      break;

    case 'coverConfirm':
      L.push('Requested by: ' + zName(n.from));
      if(n.iso) L.push('Date: ' + zDate(n.iso));
      if(req){ L.push(''); zReqLines(req).forEach(x=>L.push(x)); }
      break;

    case 'event':
      if(n.text) L.push(n.text);
      if(n.iso)  L.push('Date: ' + zDate(n.iso));
      break;

    /* ---- Nhóm B: kết quả duyệt đơn — kèm nguyên chi tiết đơn ---- */
    case 'approved': case 'rejected': case 'revoked': case 'cancelled': {
      if(req){
        const lastBy = (zk==='approved' && req.decidedBy) ? req.decidedBy : (n.from||'');
        if(zk==='approved')      L.push('Final approval by: ' + zLevel('kmgr') + (lastBy?' — '+zName(lastBy):''));
        else if(zk==='rejected') L.push('Rejected by: ' + zName(lastBy));
        else if(zk==='revoked')  L.push('Withdrawn by: ' + zName(lastBy));
        else                     L.push('Cancelled by: ' + zName(lastBy));
        L.push('');
        zReqLines(req).forEach(x=>L.push(x));
        if(zk==='approved'){
          const ch=zChainLines(req);
          if(ch.length){ L.push(''); ch.forEach(x=>L.push(x)); }
          L.push('The actual working schedule has been updated.');
        }
      }else if(n.text){
        /* Đơn đã bị xoá khỏi S.requests (huỷ / dọn kỳ cũ) — vẫn phải gửi được */
        L.push(String(n.text).replace(/^[^\p{L}\p{N}]+/u,'').trim());
      }
      break;
    }

    /* ---- Nhóm C: phản hồi hai chiều giữa nhân viên ---- */
    case 'swapNo':       L.push(zName(n.from) + ' declined your shift swap request.');
                         if(req){L.push('');zReqLines(req).forEach(x=>L.push(x));} break;
    case 'coverNo':      L.push(zName(n.from) + ' declined your OT cover request.');
                         if(req){L.push('');zReqLines(req).forEach(x=>L.push(x));} break;
    case 'coverRemoved': L.push('You are no longer assigned as OT cover'
                                + (n.iso?(' for '+zDate(n.iso)):'') + '.'); break;
    case 'schedDecline': L.push(zName(n.from) + ' declined the schedule change you created'
                                + (n.iso?(' for '+zDate(n.iso)):'') + '.'); break;
    case 'schedRevoke':  L.push('The schedule change'
                                + (n.iso?(' for '+zDate(n.iso)):'')
                                + ' has been withdrawn'
                                + (n.from?(' by '+zName(n.from)):'') + '.');
                         if(n.oldCode||n.newCode)
                           L.push('Your shift stays: ' + (n.oldCode||'OFF')); break;

    default:
      /* Loại tin chưa có bản tiếng Anh riêng — dùng lại câu app đã dựng,
         bỏ emoji đầu dòng vì tiêu đề đã nói rồi. Không nuốt tin. */
      if(n.text) L.push(String(n.text).replace(/^[^\p{L}\p{N}]+/u,'').trim());
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
