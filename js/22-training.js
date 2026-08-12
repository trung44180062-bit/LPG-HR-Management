/* ============================================================
   LỊCH ĐÀO TẠO  (S.trainings)
   LPGT Cavern — Quan ly Cong Ca
   ------------------------------------------------------------
   VẤN ĐỀ

   Đào tạo ở nhà máy trước nay đi bằng miệng và tin nhắn lẻ: quản lý
   nhắn "thứ Năm anh đi học an toàn", người nghe tự nhớ. Đến ngày mới
   phát hiện hôm đó anh ta trực ca đêm, hoặc học ngoài giờ mà không ai
   khai đơn tăng ca nên không được tính giờ.

   Ba việc phải giải quyết cùng lúc:
     1. GHI Ở ĐÂU     — lịch đào tạo phải nằm chung chỗ với lịch ca,
                        nhìn bảng ca thực tế là thấy ngay ai đi học.
     2. AI ĐƯỢC XẾP   — cá nhân chỉ sửa được của mình; quản trị / SC /
                        thư ký / quản lý người Hàn xếp được cho cả tổ.
     3. TÍNH GIỜ SAO  — học trong ca thì không phát sinh gì; học ngoài
                        ca là TĂNG CA, phải ra đơn thật để tính lương.

   ------------------------------------------------------------
   CÁCH LÀM

   · Một BUỔI ĐÀO TẠO = một bản ghi `S.trainings[id]`, gồm nhiều ngày và
     nhiều người. Xếp cho 8 người học 2 ngày vẫn chỉ là MỘT bản ghi —
     sửa một lần là sửa cho tất cả, đúng cách người ta nghĩ về việc này.

   · CHẾ ĐỘ (`mode`) — ★ v7.1: quyết định theo TỪNG NGƯỜI TỪNG NGÀY.

     Một buổi kéo hai ngày thì hai ngày đó thường KHÁC NHAU về bản chất:
     ngày 18 anh A nghỉ ca (R) nên đi học là TĂNG CA, ngày 19 anh A trực
     ca hành chính (O) nên học ngay trong giờ làm. Ép cả buổi vào một chế
     độ là sai với thực tế — và người xếp lịch không có cách nào khai đúng.

     Tệ hơn: cùng MỘT NGÀY, anh A có thể đang R còn anh B đang O. Nên đơn
     vị quyết định nhỏ nhất phải là CẶP (người, ngày), không phải buổi.

        'auto'  — MẶC ĐỊNH. App tự soi ca THỰC TẾ của từng người từng ngày:
                    · không có ca (R / nghỉ phép / trống)  → TĂNG CA
                    · có ca, giờ học NẰM TRONG ca đó        → TRONG CA
                    · có ca, giờ học TRÀN RA ngoài ca       → TĂNG CA
                  (chưa khai giờ thì chỉ xét vế đầu: có ca là trong ca)
        'shift' — ép TẤT CẢ là trong ca, kể cả người đang nghỉ.
        'ot'    — ép TẤT CẢ là tăng ca, kể cả người đang trực.

     Ép tay theo TỪNG NGÀY để riêng ở `dayMode = {iso: 'shift'|'ot'}` —
     ngày nào không khai thì theo `mode`. Dùng khi thực tế trái với suy
     đoán của app (VD đang trực ca O nhưng buổi học được tính OT riêng).

   · TÍNH GIỜ: mỗi người MỘT đơn tăng ca thật (type 'ot'), trong đơn CHỈ
     có những ngày rơi vào diện tăng ca của CHÍNH người đó. Đơn đi đúng
     luồng duyệt FE › SC › QL người Hàn, in được biểu mẫu, vào báo cáo giờ
     OT và suất cơm, ghi lý do "Đào tạo: <tên>". Người mà mọi ngày đều
     trong ca thì KHÔNG có đơn nào — không đẻ giấy tờ rỗng.

   · DUYỆT: nhân viên tự khai cho mình thì bản ghi ở `status:'pending'`,
     quản lý bấm duyệt mới thành 'active'. Quản lý tự xếp thì 'active'
     ngay. Bản 'pending' vẫn hiện trên lịch nhưng gạch sọc, để người xếp
     ca biết là "có người xin đi học ngày này" mà chưa chốt.
     (Đơn tăng ca đi luồng duyệt riêng của nó — hai việc khác nhau:
      duyệt ĐÀO TẠO là chốt lịch, duyệt ĐƠN OT là chốt tiền.)

   · THÔNG BÁO: sửa hoặc xoá thì THU HỒI thông báo cũ (xoá hẳn khỏi
     S.notifs, rút luôn khỏi hàng đợi Zalo) rồi gửi lại bản mới — cùng
     một cơ chế với sự kiện (js/20-events.js) và đổi lịch. Tin Zalo đi
     kênh 'batch' nên nhiều người trong một buổi gộp thành MỘT tin.

   Lưu ở nhánh Firebase riêng `trainings` (đồng bộ delta như requests /
   notifs / events) — xem FB_MAP_BRANCHES ở js/02-storage.js.
   ============================================================ */

/* ---------- Phân quyền ---------- */
/* Ai xếp được lịch cho NGƯỜI KHÁC: quản trị (admin), quản lý người Hàn
   (kmgr), SC / duyệt đơn (appr), thư ký (sec). Đúng bằng cờ `secr` đã có
   sẵn — không đẻ thêm khái niệm quyền mới. */
function trCanManage(){return !!secr;}
/* Ai cũng tự khai được cho mình, miễn là người đó có mặt trong lịch ca. */
function trCanSelf(){const id=meId();return !!id&&!noSelf;}
function trCanOpen(){return trCanManage()||trCanSelf();}

/* ---------- Đọc dữ liệu ---------- */
function trAll(){
  return Object.values(S.trainings||{})
    .filter(Boolean)
    .sort((a,b)=>String(trDays(a)[0]||'').localeCompare(String(trDays(b)[0]||'')));
}
function trById(id){return (S.trainings||{})[id]||null;}
/* ★ v7.8 — buổi có thể thuộc một KHOÁ (js/23-course.js). Tên đầy đủ dùng cho
   thông báo, ghi chú đơn OT và bảng tổng hợp: "<tên khoá> · <tên buổi>".
   Buổi lẻ (không khoá) trả về đúng tên buổi như trước — không đổi gì cho
   dữ liệu cũ, và các phép so chuỗi trong harness vẫn đúng. */
function trCourseOf(tr){
  const cid=tr&&tr.courseId;
  return cid?((S.courses||{})[cid]||null):null;
}
function trFullTitle(tr){
  const c=trCourseOf(tr), s=String((tr&&tr.title)||'').trim();
  if(!c)return s;
  const ct=String(c.title||'').trim();
  if(!ct)return s;
  return (!s||s===ct)?ct:(ct+' · '+s);
}
function trDays(tr){
  if(!tr)return [];
  if(Array.isArray(tr.days))return tr.days.filter(Boolean).slice().sort();
  return [];
}
function trEmps(tr){
  if(!tr)return [];
  return (Array.isArray(tr.emps)?tr.emps:[]).filter(Boolean).map(String);
}
function trIsActive(tr){return !!tr&&tr.status!=='pending';}

/* ============================================================
   ★ v8.0 — NGƯỜI LAO ĐỘNG XÁC NHẬN ĐÃ THAM GIA
   ------------------------------------------------------------
   Xếp lịch đào tạo mới chỉ là DỰ ĐỊNH. Ai thật sự có mặt là chuyện khác:
   người bận xử lý sự cố, người đổi ca, người quên. Trước đây app không có
   chỗ nào ghi việc đó, nên hồ sơ đào tạo chỉ trả lời được "ai được xếp",
   không trả lời được câu kiểm định hay hỏi: "ai ĐÃ HỌC?".

   Một khoá `tr.done = {empId: mốc thời gian}` là đủ:
     · chính người đó bấm xác nhận (tự khai, không ai khai hộ được cảm giác
       mình có mặt hay không),
     · quản lý cũng tích được — điểm danh hộ là việc thật, nhất là với
       người không dùng app,
     · CHỈ xác nhận được khi buổi đã diễn ra (ngày đầu ≤ hôm nay) — xác
       nhận trước là hứa, không phải điểm danh,
     · KHÔNG sinh thông báo: đây là dấu tích theo dõi, bắn tin cho cả tổ
       mỗi lần một người điểm danh là tra tấn.
   ============================================================ */
function trAttended(tr,empId){
  return !!(tr&&tr.done&&tr.done[String(empId)]);
}
/* Buổi đã diễn ra chưa — mốc là NGÀY ĐẦU của buổi, để buổi nhiều ngày vẫn
   xác nhận dần từng người sau buổi đầu tiên. */
function trHappened(tr){
  const d=trDays(tr);
  return !!d.length&&d[0]<=todayIso();
}
function trCanAttend(tr,empId){
  if(!tr||!trIsActive(tr)||!trHappened(tr))return false;
  if(!trEmps(tr).includes(String(empId)))return false;
  const me=(typeof meId==='function')?meId():'';
  return trCanManage()||String(me)===String(empId);
}
/* Bật / tắt dấu đã tham gia. Trả về {ok, on, err}. */
function trSetAttend(trId,empId,on){
  const tr=trById(trId);
  if(!tr)return {ok:false,err:t('Không tìm thấy buổi đào tạo')};
  if(!trCanAttend(tr,empId))
    return {ok:false,err:trHappened(tr)?t('Bạn chỉ xác nhận được cho chính mình')
                                       :t('Buổi này chưa diễn ra')};
  tr.done=tr.done||{};
  if(on===undefined)on=!trAttended(tr,empId);
  if(on)tr.done[String(empId)]=Date.now();
  else delete tr.done[String(empId)];
  /* Object rỗng để lại trên Firebase sẽ bị coi là null — dọn cho gọn */
  if(!Object.keys(tr.done).length)delete tr.done;
  save();
  return {ok:true,on:!!on};
}
/* Chia danh sách người của buổi thành đã / chưa tham gia */
function trAttendSplit(tr){
  const done=[],todo=[];
  trEmps(tr).forEach(id=>{(trAttended(tr,id)?done:todo).push(id);});
  return {done,todo};
}

/* ============================================================
   ★ v7.1 — TRONG CA hay TĂNG CA: quyết theo TỪNG CẶP (người, ngày)
   ------------------------------------------------------------
   Ba tầng, tầng trên thắng tầng dưới:
     1. `tr.dayMode[iso]`  — người xếp ép tay cho riêng ngày đó
     2. `tr.mode`          — ép tay cho cả buổi ('shift' / 'ot')
     3. 'auto'             — app tự soi ca thực tế của chính người đó
   ============================================================ */
function trHm(s){
  const m=/^(\d{1,2}):(\d{2})$/.exec(String(s||''));
  return m?(+m[1]*60 + +m[2]):null;
}

/* ============================================================
   ★ v7.2 — GIỜ HỌC KHAI RIÊNG TỪNG NGÀY
   ------------------------------------------------------------
   Rất ít buổi đào tạo chiếm trọn một ngày. Phần lớn là vài tiếng hoặc
   nửa buổi, và một khoá 3 ngày thì ngày đầu học cả ngày, ngày sau chỉ
   sáng, ngày cuối hai tiếng rồi thi. Bản trước chỉ có MỘT khung giờ cho
   cả buổi nên hoặc phải tách thành ba buổi rời (mất tính liền mạch của
   khoá học), hoặc khai một khung giờ sai cho hai ngày còn lại — mà khung
   giờ đó lại là căn cứ tính tiền tăng ca.

   Nay:
     · `tr.timeIn` / `tr.timeOut` / `overnight` / `noLunch` = khung giờ CHUNG,
       dùng làm MẶC ĐỊNH cho mọi ngày.
     · `tr.dayTime = { iso: {from,to,overnight,noLunch} }` = ngày nào khác
       thì khai đè riêng.
   Mọi chỗ cần giờ của một ngày đều đi qua trTimeOf() — không nơi nào đọc
   thẳng tr.timeIn nữa.
   ============================================================ */
/* Mẫu giờ HỌC (khác OT_PRESETS ở js/01-core.js — cái đó là mẫu giờ TĂNG CA).
   Bốn mẫu này lấy theo nhịp làm việc thật của nhà máy. */
const TRAIN_PRESETS=[
  /* noLunch:1 — 08:00→17:00 là 9 giờ đồng hồ, trừ 1 giờ nghỉ trưa còn 8 giờ học */
  {v:'full', label:'Cả ngày 08:00–17:00',   from:'08:00', to:'17:00', noLunch:1},
  {v:'am',   label:'Buổi sáng 08:00–12:00', from:'08:00', to:'12:00'},
  {v:'pm',   label:'Buổi chiều 13:00–17:00',from:'13:00', to:'17:00'},
  {v:'',     label:'Tự điền giờ',           from:'',      to:''}
];
function trPresetOf(v){return TRAIN_PRESETS.find(p=>p.v===v)||TRAIN_PRESETS[TRAIN_PRESETS.length-1];}
/* Mẫu nào khớp đúng khung giờ này (để ô chọn hiện đúng mục đang dùng) */
function trPresetMatch(from,to){
  const p=TRAIN_PRESETS.find(x=>x.from&&x.from===from&&x.to===to);
  return p?p.v:'';
}
/* KHUNG GIỜ CỦA MỘT NGÀY — khai riêng thì lấy riêng, không thì lấy khung chung */
function trTimeOf(tr,iso){
  const d=tr&&tr.dayTime&&typeof tr.dayTime==='object'?tr.dayTime[iso]:null;
  if(d&&d.from&&d.to)
    return {from:d.from,to:d.to,overnight:!!d.overnight,noLunch:!!d.noLunch,own:true};
  return {from:(tr&&tr.timeIn)||'',to:(tr&&tr.timeOut)||'',
          overnight:!!(tr&&tr.overnight),noLunch:!!(tr&&tr.noLunch),own:false};
}
/* Ngày này có khai giờ riêng không (để giao diện đánh dấu) */
function trHasOwnTime(tr,iso){return trTimeOf(tr,iso).own;}
/* Khung giờ này có phủ 12:00–13:00 không — quyết định ô "trừ trưa" có nghĩa
   hay không. Cùng luật với đơn tăng ca (v6.9): ô tích CHỈ hiện khi thật sự
   phủ trưa, và cờ cũ phải RƠI khi sửa giờ ra ngoài trưa — nếu không, người
   xếp nhìn thấy ô đang tích mà số giờ lại không trừ, tưởng app tính sai. */
function trSpansLunch(iso,w){
  if(!w||!w.from||!w.to)return false;
  return (typeof otSpansLunch==='function')
    && otSpansLunch(iso||todayIso(),w.from,w.overnight?trShiftEndIso(iso||todayIso()):'',w.to);
}
/* SỐ GIỜ HỌC của một ngày — tính cho MỌI ngày, không riêng ngày tăng ca.
   Buổi học trong ca cũng có số giờ, và đó chính là con số vào cột
   "Giờ đào tạo" của báo cáo. */
function trHoursOfDay(tr,iso){
  const w=trTimeOf(tr,iso);
  if(!w.from||!w.to)return 0;
  return otNetHours(iso,w.from,w.overnight?trShiftEndIso(iso):'',w.to,w.noLunch);
}
/* Mã ca tăng ca hợp với khung giờ này. Ưu tiên khớp ĐÚNG một mẫu OT chuẩn
   của công ty (OTL/OT2/OT3/OTO/OTD/OTN); không khớp thì quy theo khung ca mà
   đoạn giờ đó nằm vào — biểu mẫu HR chỉ có mấy ký hiệu này. */
function trOtCodeFor(from,to,overnight){
  if(typeof OT_PRESETS!=='undefined'){
    const ex=OT_PRESETS.find(p=>p.from&&p.from===from&&p.to===to&&!!p.overnight===!!overnight);
    if(ex)return ex.code;
  }
  const a=trHm(from), z=trHm(to);
  if(a===null||z===null)return 'OTD';
  if(overnight||z<=a)return 'OTN';       // vắt qua nửa đêm
  if(a>=20*60)       return 'OTN';
  if(z<=17*60)       return 'OTO';       // gói gọn trong giờ hành chính
  if(a>=17*60)       return 'OT3';       // sau giờ hành chính
  return 'OTD';
}
/* Ngày kết thúc của một dòng OT vắt qua nửa đêm: hôm sau của chính ngày đó */
function trShiftEndIso(iso){return addDaysIso(iso,1);}
/* Khung giờ [from → to] có NẰM GỌN trong ca `b` (D/N/O) không?
   Quy về phút tính từ 00:00 hôm đó; ca đêm N = 20:00 → 08:00 hôm sau nên
   đuôi cộng thêm một ngày, và mốc bắt đầu trước 08:00 cũng thuộc phần
   "hôm sau" của ca đêm (học lúc 02:00 là đang giữa ca N, không phải ngoài ca). */
function trShiftCovers(b,from,to,overnight){
  const W={D:[8*60,20*60], N:[20*60,32*60], O:[8*60,17*60]}[b];
  if(!W)return false;
  let a=trHm(from), z=trHm(to);
  if(a===null||z===null)return false;
  if(overnight||z<=a)z+=1440;
  if(b==='N'&&a<8*60){a+=1440;z+=1440;}
  return a>=W[0]&&z<=W[1];
}
/* App tự đoán cho MỘT cặp (người, ngày) */
function trAutoModeFor(tr,empId,iso){
  const b=(typeof baseShiftOf==='function')
    ? baseShiftOf(workCodeOf(eff(empId,iso).code))
    : null;
  if(!b)return 'ot';                       // R / nghỉ phép / trống → học là tăng ca
  const w=trTimeOf(tr,iso);                // ★ v7.2 — giờ CỦA NGÀY ĐÓ
  if(!w.from||!w.to)return 'shift';        // chưa khai giờ: có ca là trong ca
  return trShiftCovers(b,w.from,w.to,w.overnight)?'shift':'ot';
}
/* Ép tay của riêng một ngày ('' = không ép) */
function trDayForced(tr,iso){
  const m=tr&&tr.dayMode;
  const v=m&&typeof m==='object'?m[iso]:'';
  return (v==='shift'||v==='ot')?v:'';
}
/* KẾT LUẬN cuối cùng cho một cặp (người, ngày): 'shift' | 'ot' */
function trModeFor(tr,empId,iso){
  const f=trDayForced(tr,iso);
  if(f)return f;
  if(tr&&(tr.mode==='shift'||tr.mode==='ot'))return tr.mode;
  return trAutoModeFor(tr,empId,iso);
}
/* Chế độ đang áp cho cả một NGÀY, gộp mọi người: 'shift' | 'ot' | 'mix' */
function trDayMode(tr,iso){
  const emps=trEmps(tr);
  if(!emps.length)return trDayForced(tr,iso)||(tr&&tr.mode!=='auto'?tr.mode:'shift');
  let s=0,o=0;
  emps.forEach(id=>{trModeFor(tr,id,iso)==='ot'?o++:s++;});
  return o&&s?'mix':(o?'ot':'shift');
}
/* Chia người của một ngày làm hai rổ — cho giao diện và cho tin Zalo */
function trDaySplit(tr,iso){
  const out={shift:[],ot:[]};
  trEmps(tr).forEach(id=>{out[trModeFor(tr,id,iso)].push(id);});
  return out;
}
/* Mọi cặp (người, ngày) rơi vào diện TĂNG CA — nguồn duy nhất để sinh đơn */
function trOtPairs(tr){
  const out=[];
  trDays(tr).forEach(iso=>{
    trEmps(tr).forEach(id=>{if(trModeFor(tr,id,iso)==='ot')out.push({empId:id,iso});});
  });
  return out;
}
/* Buổi này CÓ phần tăng ca không (dù chỉ một người một ngày) */
function trIsOt(tr){return trOtPairs(tr).length>0;}
/* Số giờ tăng ca của MỘT ngày (giống nhau cho mọi người — một buổi một khung giờ) */
function trOtHoursOfDay(tr,iso){return trHoursOfDay(tr,iso);}
/* Tổng giờ tăng ca cả buổi (cộng mọi cặp) */
function trOtTotalHours(tr){
  return rnd1(trOtPairs(tr).reduce((a,p)=>a+trOtHoursOfDay(tr,p.iso),0));
}

/* Chỉ mục (empId|iso) → buổi đào tạo. Ô lịch hỏi cho TỪNG ô nên phải
   nhanh; nhớ theo S.rev, dữ liệu đổi là dựng lại. Cùng khuôn với
   evIndex() ở js/20-events.js. */
let _trIdx=null,_trIdxRev=-1;
function trResetCache(){_trIdx=null;_trIdxRev=-1;}
function trIndex(){
  if(_trIdx&&_trIdxRev===S.rev)return _trIdx;
  const idx={};
  trAll().forEach(tr=>{
    trDays(tr).forEach(iso=>{
      trEmps(tr).forEach(id=>{
        const k=id+'|'+iso;
        (idx[k]=idx[k]||[]).push(tr);
      });
    });
  });
  _trIdx=idx;_trIdxRev=S.rev;
  return idx;
}
/* Buổi đào tạo của MỘT người trong MỘT ngày (mảng, thường 0 hoặc 1) */
function trOfCell(empId,iso){return trIndex()[empId+'|'+iso]||[];}
/* Cả tổ có ai đi học hôm đó không — dùng cho tiêu đề cột / dải nhắc */
function trOfDay(iso){
  const out=[],seen={};
  trAll().forEach(tr=>{
    if(seen[tr.id])return;
    if(trDays(tr).includes(iso)){seen[tr.id]=1;out.push(tr);}
  });
  return out;
}
/* Buổi đào tạo của một người trong một khoảng ngày */
function trOfEmp(empId,fromIso,toIso){
  return trAll().filter(tr=>trEmps(tr).includes(String(empId))&&
    trDays(tr).some(iso=>(!fromIso||iso>=fromIso)&&(!toIso||iso<=toIso)));
}

/* ---------- Nhãn hiển thị ---------- */
/* Nhãn của một CHẾ ĐỘ ('shift' | 'ot' | 'mix') */
function trModeName(m){
  return m==='ot'  ? t('Tăng ca để đào tạo')
       : m==='mix' ? t('Vừa trong ca vừa tăng ca')
                   : t('Trong ca làm việc');
}
/* Nhãn gộp của cả một buổi — nói thật là buổi này có mấy kiểu */
function trModeLabel(tr){
  if(!tr)return '';
  const days=trDays(tr);
  if(!days.length)return trModeName(tr.mode==='ot'?'ot':'shift');
  const set={};days.forEach(iso=>{set[trDayMode(tr,iso)]=1;});
  const ks=Object.keys(set);
  return ks.length===1?trModeName(ks[0]):trModeName('mix');
}
/* Nhãn khung giờ CHUNG của buổi */
function trTimeLabel(tr){
  if(!tr||!tr.timeIn||!tr.timeOut)return '';
  return tr.timeIn+'–'+tr.timeOut;
}
/* Nhãn khung giờ của MỘT NGÀY, kèm số giờ: "08:00–12:00 · 4h" */
function trTimeLabelOf(tr,iso){
  const w=trTimeOf(tr,iso);
  if(!w.from||!w.to)return '';
  const h=trHoursOfDay(tr,iso);
  return w.from+'–'+w.to+(w.overnight?' (+1d)':'')+(h?' · '+h+'h':'');
}
/* Tổng giờ HỌC của cả buổi cho MỘT người (mọi ngày, cả trong ca lẫn tăng ca) */
function trHoursOfEmp(tr,empId){
  if(!trEmps(tr).includes(String(empId)))return 0;
  return rnd1(trDays(tr).reduce((a,iso)=>a+trHoursOfDay(tr,iso),0));
}
/* GIỜ ĐÀO TẠO của MỘT người trong MỘT ngày — nguồn của cột báo cáo.
   Chỉ tính buổi ĐÃ CÓ HIỆU LỰC; bản nhân viên tự khai còn chờ duyệt thì
   chưa phải là giờ đã học.
   LƯU Ý: đây KHÔNG cộng vào giờ công cũng KHÔNG cộng vào giờ OT. Học trong
   ca thì giờ công đã tính theo mã ca rồi; học ngoài ca thì đã có đơn tăng ca
   riêng. Cộng thêm lần nữa là tính hai lần. Cột này chỉ để trả lời câu
   "kỳ này ai đã học bao nhiêu giờ". */
function trHoursFor(empId,iso){
  let h=0;
  trOfCell(empId,iso).forEach(tr=>{if(trIsActive(tr))h+=trHoursOfDay(tr,iso);});
  return h;
}
/* Cộng dồn theo một khoảng ngày */
function trHoursInRange(empId,fromIso,toIso){
  let h=0;
  trAll().forEach(tr=>{
    if(!trIsActive(tr)||!trEmps(tr).includes(String(empId)))return;
    trDays(tr).forEach(iso=>{
      if(fromIso&&iso<fromIso)return;
      if(toIso&&iso>toIso)return;
      h+=trHoursOfDay(tr,iso);
    });
  });
  return rnd1(h);
}
function trDateLabel(tr){
  const d=trDays(tr);
  if(!d.length)return '';
  if(d.length===1)return fmtVN(d[0]);
  const cont=d.every((x,i)=>i===0||x===addDaysIso(d[i-1],1));
  return cont?(fmtVN(d[0])+' → '+fmtVN(d[d.length-1])):d.map(fmtVN).join(', ');
}
/* Nhãn gắn vào ô lịch (tooltip) — nói đúng chế độ của CHÍNH ô đó */
function trCellTitle(empId,iso){
  const list=trOfCell(empId,iso);
  if(!list.length)return '';
  return list.map(tr=>{
    const ot=trModeFor(tr,empId,iso)==='ot';
    /* Giờ hiện cho MỌI ô, không riêng ô tăng ca — nhìn ô lịch phải biết hôm
       đó học cả ngày hay chỉ hai tiếng. */
    return '🎓 '+(tr.title||t('Đào tạo'))
      +' · '+(trTimeLabelOf(tr,iso)||t('chưa khai giờ'))
      +' · '+(ot?t('tăng ca'):t('trong ca'))
      +(trIsActive(tr)?'':' · '+t('chờ duyệt'));
  }).join(' · ');
}
/* Lớp CSS của ô lịch: '' / ' trday' / ' trday trpend' / ' trday trot' */
function trCellCls(empId,iso){
  const list=trOfCell(empId,iso);
  if(!list.length)return '';
  return ' trday'
    +(list.some(trIsActive)?'':' trpend')
    +(list.some(tr=>trModeFor(tr,empId,iso)==='ot')?' trot':'');
}

/* ============================================================
   SINH ĐƠN TĂNG CA CHO BUỔI ĐÀO TẠO OT
   ------------------------------------------------------------
   Mỗi NGƯỜI một đơn, trong đơn mỗi NGÀY một dòng — đúng quy định "mỗi
   ngày một dòng" của biểu mẫu công ty (xem reqDays() ở js/08-requests.js).
   Đơn mang cờ `trId` để về sau sửa / xoá buổi đào tạo còn tìm lại được.

   Đơn đã ĐƯỢC DUYỆT thì KHÔNG đụng vào nữa: giấy tờ đã chốt, có thể đã in
   nộp nhân sự. Sửa buổi đào tạo trong trường hợp đó chỉ sinh thêm đơn cho
   phần ngày/người MỚI, còn phần cũ giữ nguyên và ghi rõ trong toast để
   người xếp biết mà xử lý tay.
   ============================================================ */
function trReqsOf(trId){
  return Object.values(S.requests||{}).filter(r=>r&&r.trId===trId);
}
/* Gỡ các đơn OT do buổi đào tạo này sinh ra mà CHƯA duyệt.
   Trả về {removed, kept} — kept là số đơn đã duyệt nên không dám đụng. */
function trDropReqs(trId,onlyEmpIds){
  let removed=0,kept=0;
  trReqsOf(trId).forEach(r=>{
    if(onlyEmpIds&&!onlyEmpIds.includes(String(r.empId)))return;
    if(r.status!=='pending'){kept++;return;}
    /* cancelReq() dọn kèm thông báo + bia mộ Firebase — đi qua nó để đơn
       không hồi sinh ở máy khác (xem js/08-requests.js và v6.7). */
    if(typeof cancelReq==='function')cancelReq(r.id,true);
    else delete S.requests[r.id];
    removed++;
  });
  return {removed,kept};
}
/* Tạo đơn tăng ca cho từng người của buổi đào tạo. Gọi SAU khi đã ghi
   S.trainings[id] vì notifyApprovers() đọc lại chi tiết đơn. */
function trMakeReqs(tr){
  const me=meId()||'admin';
  if(!trDays(tr).length)return 0;
  /* Gom các cặp (người, ngày) thuộc diện TĂNG CA về theo người. Người nào
     mọi ngày đều học trong ca thì không có mặt ở đây → không có đơn nào.
     Đây là điểm khác cốt lõi của v7.1: trước kia cả buổi một chế độ nên
     đơn nào cũng có đủ mọi ngày, kể cả ngày người ta đang trực ca. */
  const byEmp={};
  trOtPairs(tr).forEach(p=>{(byEmp[p.empId]=byEmp[p.empId]||[]).push(p.iso);});
  let n=0;
  Object.keys(byEmp).forEach(empId=>{
    if(!empById(empId))return;
    /* Đã có đơn chưa duyệt cho đúng người này ở buổi này → bỏ qua, tránh
       bấm Lưu hai lần ra hai đơn trùng. */
    if(trReqsOf(tr.id).some(r=>String(r.empId)===String(empId)&&r.status==='pending'))return;
    const rows=byEmp[empId].slice().sort().map(iso=>{
      /* ★ v7.2 — giờ của CHÍNH NGÀY ĐÓ, và mã OT suy từ đúng khung giờ đó.
         Khoá 3 ngày mà ngày cuối chỉ học 2 tiếng thì dòng đó phải là 2 giờ,
         không phải bê khung giờ của ngày đầu sang. */
      const w=trTimeOf(tr,iso);
      const d={iso,code:trOtCodeFor(w.from,w.to,w.overnight),preset:'',
               timeIn:w.from||'',timeOut:w.to||''};
      if(w.overnight)d.isoEnd=trShiftEndIso(iso);
      if(w.noLunch&&otSpansLunch(d.iso,d.timeIn,d.isoEnd,d.timeOut))d.noLunch=1;
      d.hours=otNetHours(d.iso,d.timeIn,d.isoEnd,d.timeOut,d.noLunch);
      return d;
    }).filter(d=>+d.hours>0);
    if(!rows.length)return;
    const r={
      id:uid(),empId:String(empId),type:'ot',byId:me,
      trId:tr.id,                                   // ← sợi dây nối về buổi đào tạo
      note:t2('Đào tạo')+': '+(trFullTitle(tr)||t2('Đào tạo'))+(tr.place?' · '+tr.place:''),
      status:'pending',source:'training',createdAt:Date.now(),
      noPrint:(typeof defaultNoPrint==='function')?defaultNoPrint('ot'):true,
      days:rows,from:rows[0].iso,to:rows[rows.length-1].iso,
      code:rows[0].code,withId:''
    };
    r.before={};rows.forEach(d=>{r.before[d.iso]=eff(r.empId,d.iso).code||'';});
    S.requests[r.id]=r;
    if(typeof notifyApprovers==='function')notifyApprovers(r,me);
    n++;
  });
  return n;
}

/* ============================================================
   THÔNG BÁO
   ------------------------------------------------------------
   Bản 'active' → báo cho TỪNG NGƯỜI ĐI HỌC (kind 'training').
   Bản 'pending' (nhân viên tự khai) → báo cho NGƯỜI DUYỆT được, để họ
   vào bấm duyệt; người khai thì đã biết rồi, không tự gửi cho mình.
   ============================================================ */
function trRevokeNotifs(trId){
  if(!S.notifs)return 0;
  if(typeof notifDrop==='function')
    return notifDrop(x=>x.kind==='training'&&x.trId===trId);
  let n=0;
  for(const k in S.notifs){
    const x=S.notifs[k];
    if(x&&x.kind==='training'&&x.trId===trId){delete S.notifs[k];n++;}
  }
  return n;
}
/* Ai nhận tin "có lịch đào tạo chờ duyệt" — cùng nhóm người được vào màn
   xếp lịch, trừ chính người khai. */
function trApprovers(exceptId){
  return (S.employees||[])
    .filter(e=>e&&e.active!==false&&e.id!==exceptId&&
      (typeof permOf==='function') &&
      ['admin','kmgr','appr','sec'].includes(permOf(e.id)))
    .map(e=>e.id);
}
/* Câu tóm tắt một buổi — dùng chung cho tin trong app và tin Zalo.
   `forId` có thì nói theo góc nhìn của CHÍNH người đó (ngày nào họ học
   trong ca, ngày nào tính tăng ca) — nhân viên nhận tin chỉ quan tâm phần
   của mình, chứ không phải bảng phân loại của cả tổ. */
function trSummaryText(tr,forId){
  const who=trEmps(tr).map(id=>shortName((empById(id)||{}).name||id)).join(', ');
  const days=trDays(tr);
  let how;
  if(forId&&trEmps(tr).includes(String(forId))){
    /* ★ v7.2 — liệt kê TỪNG NGÀY kèm giờ, vì mỗi ngày một khung giờ khác nhau.
       Người đi học cần biết "mai 08–12, mốt 14–16", không phải một câu chung. */
    how=days.map(iso=>fmtVN(iso)+' '+(trTimeLabelOf(tr,iso)||'')
        +' '+(trModeFor(tr,forId,iso)==='ot'?t2('tăng ca'):t2('trong ca'))).join(' · ');
  }else{
    how=days.map(iso=>fmtVN(iso)+' '+(trTimeLabelOf(tr,iso)||'')).join(' · ')
        +' · '+trModeLabel(tr).toLowerCase();
  }
  /* Tên khoá đứng trước tên buổi (★ v7.8) — người nhận tin biết ngay đây là
     buổi thứ mấy của khoá nào, khỏi phải mở app tra. */
  return (trFullTitle(tr)||t2('Đào tạo'))+' — '+how
    +(tr.place?' · '+tr.place:'')
    +(who?(' · '+who):'');
}
/* ------------------------------------------------------------
   DÒNG NGÀY CHO TIN ZALO (tiếng Anh) — js/21-notify.js gọi hàm này.
   Mỗi ngày một dòng, nói rõ ngày đó là trong ca hay tăng ca, ngày nào
   trộn cả hai thì ghi số người mỗi bên. Nhờ vậy tin gửi chung vẫn đúng
   với mọi người nhận, không phải nói dối một nửa.
   ------------------------------------------------------------ */
function trZaloDayLines(tr){
  return trDays(tr).map(iso=>{
    const d=(typeof zDate==='function')?zDate(iso):fmtVN(iso);
    const sp=trDaySplit(tr,iso);
    const w=trTimeOf(tr,iso);
    const h=trHoursOfDay(tr,iso);
    /* Khung giờ đứng ngay sau ngày — đây là thứ người đọc cần nhất, và mỗi
       ngày một khác nên KHÔNG gộp lên một dòng chung được. */
    const win=(w.from&&w.to)?(w.from+'–'+w.to+(w.overnight?' (+1d)':'')):'';
    const head=d+(win?'  '+win:'')+(h?'  ('+h+'h)':'');
    if(!sp.ot.length)   return head+'  during shift';
    if(!sp.shift.length)return head+'  overtime';
    return head+'  overtime for '+sp.ot.length+' · during shift for '+sp.shift.length;
  });
}
function trSendNotifs(tr){
  trRevokeNotifs(tr.id);
  if(tr.notify===false)return 0;
  const by=meId()||'admin';
  const iso=trDays(tr)[0]||'';
  if(!trIsActive(tr)){
    /* Chờ duyệt: chỉ gọi người duyệt. aud = nhãn nhóm người nhận, để các
       tin gộp thành ĐÚNG MỘT tin Zalo (xem zaloFp ở js/21-notify.js). */
    const ids=trApprovers(tr.by);
    ids.forEach(id=>newNotif({kind:'training',to:id,from:by,trId:tr.id,iso,
      aud:'Approvers',trSt:'pending',status:'sent',
      text:'🎓 '+t2('Lịch đào tạo chờ duyệt')+': '+trSummaryText(tr)}));
    return ids.length;
  }
  const ids=trEmps(tr).filter(id=>empById(id));
  ids.forEach(id=>newNotif({kind:'training',to:id,from:by,trId:tr.id,iso,
    aud:'Training attendees',trSt:'active',status:'sent',
    /* Câu trong app nói theo góc nhìn của CHÍNH người nhận (`id`) — họ chỉ
       cần biết ngày nào của MÌNH là tăng ca. Tin Zalo thì gộp chung nên
       dựng riêng ở trZaloDayLines(). */
    text:'🎓 '+t2('Bạn có lịch đào tạo')+': '+trSummaryText(tr,id)}));
  return ids.length;
}

/* ============================================================
   GHI / SỬA / XOÁ
   ============================================================ */
/* Kiểm tra dữ liệu trước khi lưu. Trả về chuỗi lỗi ('' = hợp lệ). */
function trValidate(o){
  if(!o.days||!o.days.length)   return t('Chưa chọn ngày đào tạo');
  if(!o.emps||!o.emps.length)   return t('Chưa chọn người đi đào tạo');
  if(!String(o.title||'').trim())return t('Chưa đặt tên buổi đào tạo');
  /* Chỉ đòi khung giờ khi THẬT SỰ có phần tăng ca. Bắt khai giờ cho buổi
     mà mọi người đều học trong ca là hỏi thừa.
     KHÔNG vòng luẩn quẩn: khi chưa có giờ, trAutoModeFor() chỉ xét "có ca
     hay không" — vế đó không phụ thuộc vào giờ. */
  /* Giờ học là dữ liệu của buổi, không riêng của phần tăng ca — mọi ngày đều
     phải có giờ, kể cả ngày học trong ca (số giờ đó vào cột báo cáo). */
  const noTime=(o.days||[]).find(iso=>{const w=trTimeOf(o,iso);return !w.from||!w.to;});
  if(noTime)return t('Chưa khai giờ học cho ngày')+' '+fmtVN(noTime);
  const zero=(o.days||[]).find(iso=>!(trHoursOfDay(o,iso)>0));
  if(zero)return t('Khung giờ ra 0 giờ ở ngày')+' '+fmtVN(zero);
  return '';
}
/* Lọc bảng ép tay theo ngày: chỉ giữ ngày còn được chọn và giá trị hợp lệ.
   Bỏ ngày ra khỏi buổi rồi chọn lại thì ép tay cũ KHÔNG được sống lại — người
   xếp đã không còn thấy nó trên màn hình, để nó âm thầm có hiệu lực là bẫy. */
function trCleanDayMode(m,days){
  const out={};
  if(!m||typeof m!=='object')return out;
  (days||[]).forEach(iso=>{
    const v=m[iso];
    if(v==='shift'||v==='ot')out[iso]=v;
  });
  return out;
}
/* Lọc bảng giờ riêng theo ngày — cùng lý do với trCleanDayMode: ngày đã bỏ
   chọn thì giờ riêng của nó phải biến mất, không được âm thầm sống lại. */
function trCleanDayTime(m,days){
  const out={};
  if(!m||typeof m!=='object')return out;
  (days||[]).forEach(iso=>{
    const v=m[iso];
    if(v&&v.from&&v.to){
      const w={from:v.from,to:v.to,overnight:!!v.overnight,noLunch:!!v.noLunch};
      if(w.noLunch&&!trSpansLunch(iso,w))w.noLunch=false;   // cờ vô nghĩa thì bỏ hẳn
      out[iso]=w;
    }
  });
  return out;
}
/* Lưu một buổi. `o` là bản mô tả đã gom từ giao diện.
   Trả về {ok, id, nNotif, nReq, keptReq, err}. */
function trSave(o){
  if(!trCanOpen())return {ok:false,err:t('Bạn không có quyền xếp lịch đào tạo')};
  const me=meId()||'';
  const editing=o.id?trById(o.id):null;
  /* Nhân viên thường: chỉ được xếp cho CHÍNH MÌNH, và chỉ sửa được bản của
     mình khi bản đó chưa duyệt. Chặn ở đây chứ không chỉ ở giao diện. */
  if(!trCanManage()){
    const emps=(o.emps||[]).map(String);
    if(emps.length!==1||emps[0]!==String(me))
      return {ok:false,err:t('Bạn chỉ xếp được lịch đào tạo cho chính mình')};
    if(editing&&(String(editing.by)!==String(me)||trIsActive(editing)))
      return {ok:false,err:t('Lịch đã duyệt — nhờ quản lý sửa giúp')};
  }
  const err=trValidate(o);
  if(err)return {ok:false,err};

  const id=o.id||uid();
  const days=(o.days||[]).slice().sort();
  const emps=(o.emps||[]).map(String);
  /* Quản lý xếp → có hiệu lực ngay. Nhân viên tự khai → chờ duyệt.
     Bản đang sửa mà đã 'active' rồi thì giữ 'active' (quản lý sửa lại
     chi tiết không làm nó rơi về chờ duyệt). */
  const status=trCanManage()?'active':(editing&&trIsActive(editing)?'active':'pending');

  /* Đơn OT cũ phải gỡ TRƯỚC khi ghi bản mới, vì ngày/người/giờ có thể đã
     đổi hết — giữ lại là để đơn mồ côi khai sai giờ. */
  let dropped={removed:0,kept:0};
  if(editing)dropped=trDropReqs(id);

  S.trainings=S.trainings||{};
  /* Khoá đã bị xoá trong lúc form còn mở thì bỏ liên kết, đừng lưu một
     courseId trỏ vào hư vô (bảng tổng hợp sẽ đọc ra khoá rỗng). */
  const cid=String(o.courseId||'').trim();
  S.trainings[id]={
    id,
    courseId:(cid&&(S.courses||{})[cid])?cid:'',
    title:String(o.title||'').trim(),
    place:String(o.place||'').trim(),
    note :String(o.note ||'').trim(),
    days,emps,
    /* mode/dayMode: xem khối ★ v7.1 ở đầu file. Khung giờ LUÔN được lưu, kể
       cả buổi hiện đang toàn "trong ca" — nó là dữ liệu của buổi học, và
       chính nó quyết định phép soi "giờ học có nằm trong ca không". Xoá đi
       thì thêm một người đang nghỉ ca vào buổi là mất giờ. */
    mode:(o.mode==='shift'||o.mode==='ot')?o.mode:'auto',
    dayMode:trCleanDayMode(o.dayMode,days),
    /* Khung giờ CHUNG = mặc định cho mọi ngày; dayTime = ngày nào khai khác */
    dayTime:trCleanDayTime(o.dayTime,days),
    preset :o.preset||'',
    timeIn :o.timeIn ||'',
    timeOut:o.timeOut||'',
    overnight:!!o.overnight,
    noLunch  :!!o.noLunch,
    notify:o.notify!==false,
    status,
    by:(editing&&editing.by)||me||'admin',
    at:(editing&&editing.at)||Date.now(),
    editBy:me||'admin',editAt:Date.now()
  };
  /* ★ v8.0 — GIỮ LẠI DẤU ĐIỂM DANH khi sửa buổi. trSave() dựng lại bản ghi
     từ đầu, nên không chép sang là mọi xác nhận "đã tham gia" bốc hơi mỗi
     lần quản lý sửa giờ học. Chỉ giữ dấu của người CÒN trong danh sách —
     người đã bị bỏ khỏi buổi thì dấu điểm danh của họ cũng hết nghĩa. */
  if(editing&&editing.done){
    const keep={};
    emps.forEach(id=>{if(editing.done[id])keep[id]=editing.done[id];});
    if(Object.keys(keep).length)S.trainings[id].done=keep;
  }
  trResetCache();

  /* Đơn tăng ca chỉ sinh khi buổi đã có hiệu lực. Bản chờ duyệt mà đẻ đơn
     ngay thì người duyệt nhận hai luồng cho một việc chưa chốt. */
  const nReq=trIsActive(S.trainings[id])?trMakeReqs(S.trainings[id]):0;
  const nNotif=trSendNotifs(S.trainings[id]);
  save();
  return {ok:true,id,nNotif,nReq,keptReq:dropped.kept,status};
}
/* Quản lý duyệt một buổi do nhân viên tự khai */
function trApprove(id){
  if(!trCanManage())return {ok:false,err:t('Chỉ quản lý mới duyệt được lịch đào tạo')};
  const tr=trById(id);
  if(!tr)return {ok:false,err:t('Không tìm thấy buổi đào tạo')};
  if(trIsActive(tr))return {ok:false,err:t('Buổi này đã có hiệu lực rồi')};
  tr.status='active';
  tr.apprBy=meId()||'admin';tr.apprAt=Date.now();
  trResetCache();
  const nReq=trMakeReqs(tr);
  const nNotif=trSendNotifs(tr);
  save();
  return {ok:true,nReq,nNotif};
}
/* Xoá hẳn một buổi: thu hồi thông báo + gỡ đơn OT chưa duyệt */
function trDelete(id){
  const tr=trById(id);
  if(!tr)return {ok:false,err:t('Không tìm thấy buổi đào tạo')};
  const me=meId()||'';
  if(!trCanManage()&&(String(tr.by)!==String(me)||trIsActive(tr)))
    return {ok:false,err:t('Bạn không xoá được buổi đào tạo này')};
  const nNotif=trRevokeNotifs(id);
  const d=trDropReqs(id);
  delete S.trainings[id];
  /* KHÔNG tự gọi tombSet ở đây. fbDiff() thấy khoá biến mất là tự dựng bia mộ
     VÀ nhét `del/trainings/<id>` vào gói ghi. Gọi trước thì tombSet trả false
     ở trong fbDiff, đường dẫn del không được gửi lên, và bản ghi sống lại ở
     máy khác — đúng cái bẫy đã sửa ở v6.7 (xem js/02-storage.js). */
  trResetCache();
  save();
  return {ok:true,nNotif,nReq:d.removed,keptReq:d.kept};
}

/* ============================================================
   MÀN XẾP LỊCH ĐÀO TẠO
   Một lịch nhỏ cả kỳ để bấm chọn ngày · danh sách người có tìm kiếm ·
   chế độ trong ca / tăng ca · danh sách buổi đã xếp để sửa lại.
   ============================================================ */
let trYm='';                 // kỳ đang xem trong màn đào tạo
let trSel={};                // {iso:true} ngày đang chọn
let trPick={};               // {empId:true} người đang chọn
let trEditId='';             // đang sửa buổi nào ('' = tạo mới)
let trTitle='', trPlace='', trNote='';
let trMode='auto';           // 'auto' | 'shift' | 'ot' — xem khối ★ v7.1
let trDayM={};               // {iso:'shift'|'ot'} ép tay theo từng ngày
let trDayT={};               // {iso:{from,to,overnight,noLunch}} giờ riêng từng ngày ★ v7.2
let trPreset='full', trTimeIn='08:00', trTimeOut='17:00';
let trOvernight=false, trNoLunch=true, trNotify=true;
let trQ='';                  // ô tìm người
let trTeamF='__all';         // lọc theo nhóm
let trCourseId='';           // buổi đang soạn thuộc KHOÁ nào ('' = buổi lẻ) ★ v7.8
/* ★ v7.8 — ba màn trong CÙNG hộp thoại Đào tạo:
     'form'   — xếp / sửa một buổi (như cũ)
     'course' — khai khoá đào tạo và phân bổ người vào từng buổi (js/23-course.js)
     'table'  — bảng tổng hợp để tra cứu
   Một hộp thoại thay vì ba modal: người dùng đi qua đi lại giữa ba việc này
   liên tục, mỗi lần mở modal mới là một lần mất chỗ đang đứng. */
let trView='form';

/* Bản mô tả buổi đang soạn — dùng lại đúng các hàm suy luận của bản đã lưu,
   nhờ vậy màn hình xem trước và kết quả lưu KHÔNG BAO GIỜ lệch nhau. */
function trDraft(){
  return {id:trEditId||'__new',
    courseId:trCourseId,
    title:trTitle,place:trPlace,note:trNote,
    days:Object.keys(trSel).sort(), emps:Object.keys(trPick),
    mode:trMode, dayMode:trDayM, dayTime:trDayT,
    preset:trPreset, timeIn:trTimeIn, timeOut:trTimeOut,
    overnight:trOvernight, noLunch:trNoLunch, notify:trNotify};
}

function trPeriod(){return trYm||curSchedMonth();}
function trShiftYm(d){trYm=schedYmShift(trPeriod(),d);renderTrainMgr();}

function trResetForm(){
  trEditId='';trSel={};trPick={};trDayM={};trDayT={};
  trTitle='';trPlace='';trNote='';trCourseId='';
  trMode='auto';trSetPreset('full',true);trNotify=true;
  /* Nhân viên thường chỉ xếp cho mình → chọn sẵn chính họ, khỏi phải bấm */
  if(!trCanManage()){const me=meId();if(me)trPick[me]=true;}
}
function openTrainMgr(iso,empId,view){
  if(!trCanOpen()){toast(t('Bạn không có quyền xếp lịch đào tạo'));return;}
  trResetForm();
  /* Chỉ người xếp cho cả tổ mới có màn khoá đào tạo / bảng tổng hợp */
  trView=(trCanManage()&&(view==='course'||view==='table'))?view:'form';
  if(iso){trSel[iso]=true;trYm=schedMonthOf(iso);}
  else if(!trYm)trYm=curSchedMonth();
  if(empId&&trCanManage())trPick[empId]=true;
  const m=$('trMask');if(!m)return;
  m.classList.add('on');
  renderTrainMgr();
}
function closeTrainMgr(){const m=$('trMask');if(m)m.classList.remove('on');}

function trToggleDay(iso){
  if(trSel[iso]){delete trSel[iso];delete trDayM[iso];delete trDayT[iso];}  // bỏ ngày là bỏ hết khai riêng của nó
  else trSel[iso]=true;
  renderTrainMgr();
}
/* Ép tay chế độ của MỘT ngày. Bấm lại đúng giá trị đang chọn = trả về Tự động. */
function trSetDayMode(iso,v){
  if(!v||trDayM[iso]===v)delete trDayM[iso];
  else trDayM[iso]=v;
  renderTrainMgr();
}
function trClearDayModes(){trDayM={};renderTrainMgr();}
function trSelRange(){
  const d=Object.keys(trSel).sort();
  if(d.length<2){toast(t('Chọn ít nhất 2 ngày rồi bấm Chọn dải'));return;}
  let x=d[0];const end=d[d.length-1];
  for(let i=0;i<400&&x<=end;i++){trSel[x]=true;x=addDaysIso(x,1);}
  renderTrainMgr();
}
function trClearDays(){trSel={};trDayM={};trDayT={};renderTrainMgr();}
function trTogglePerson(id){
  if(!trCanManage()){toast(t('Bạn chỉ xếp được lịch đào tạo cho chính mình'));return;}
  if(trPick[id])delete trPick[id];else trPick[id]=true;
  renderTrainMgr();
}
function trPickTeam(tm){
  if(!trCanManage())return;
  const mem=schedEmps().filter(e=>(e.team||'')===tm);
  const allOn=mem.every(e=>trPick[e.id]);
  mem.forEach(e=>{if(allOn)delete trPick[e.id];else trPick[e.id]=true;});
  renderTrainMgr();
}
function trClearPeople(){if(!trCanManage())return;trPick={};renderTrainMgr();}
function trSetMode(v){
  trMode=(v==='shift'||v==='ot')?v:'auto';
  /* Ép tay cho cả buổi thì mọi ép tay theo ngày thành vô nghĩa — xoá đi cho
     khỏi có hai lớp luật chồng nhau mà người dùng không thấy. */
  trDayM={};
  renderTrainMgr();
}
/* Mẫu giờ CHUNG của buổi (TRAIN_PRESETS). Đặt lại khung chung KHÔNG xoá giờ
   riêng của từng ngày — ai đã khai riêng là cố ý. */
function trSetPreset(v,quiet){
  trPreset=v;
  const p=trPresetOf(v);
  if(p.from){
    trTimeIn=p.from;trTimeOut=p.to;trOvernight=!!p.overnight;
    trNoLunch=!!p.noLunch;
  }
  if(!quiet)renderTrainMgr();
}
/* ---- giờ riêng của MỘT ngày ---- */
function trDayTimeOf(iso){
  const d=trDayT[iso];
  return (d&&d.from&&d.to)?d
    :{from:trTimeIn,to:trTimeOut,overnight:trOvernight,noLunch:trNoLunch};
}
function trSetDayPreset(iso,v){
  if(!v){delete trDayT[iso];renderTrainMgr();return;}   // '' = theo khung chung
  const p=trPresetOf(v);
  const c=trDayTimeOf(iso);
  trDayT[iso]=p.from
    ? {from:p.from,to:p.to,overnight:!!p.overnight,noLunch:!!p.noLunch}
    : {from:c.from,to:c.to,overnight:!!c.overnight,noLunch:!!c.noLunch};
  trFixDayLunch(iso);
  renderTrainMgr();
}
function trSetDayTime(iso,k,v){
  const c=trDayTimeOf(iso);
  trDayT[iso]={from:c.from,to:c.to,overnight:!!c.overnight,noLunch:!!c.noLunch};
  trDayT[iso][k]=(k==='from'||k==='to')?v:!!v;
  trFixDayLunch(iso);
  renderTrainMgr();
}
/* Cờ trừ trưa của một ngày phải rơi khi khung giờ không còn phủ trưa */
function trFixDayLunch(iso){
  const d=trDayT[iso];
  if(d&&d.noLunch&&!trSpansLunch(iso,d))d.noLunch=false;
}
function trClearDayTimes(){trDayT={};renderTrainMgr();}
/* Gõ vào ô tìm chỉ vẽ lại DANH SÁCH NGƯỜI, không đụng tới cả hộp thoại.
   Vẽ lại toàn bộ sau mỗi phím là vừa nặng vừa làm mất con trỏ — và bảng
   từng ngày, ước tính giờ… đều không phụ thuộc vào chữ đang tìm. */
function trRenderPeople(){
  const box=$('trPeopleBox');
  if(!box){renderTrainMgr();return;}          // hộp thoại chưa dựng → vẽ đủ
  const old=box.querySelector('.tr-people');
  const top=old?old.scrollTop:0;
  box.innerHTML=trPeopleHtml();
  const nw=box.querySelector('.tr-people');
  if(nw)nw.scrollTop=top;                     // giữ chỗ đang cuộn trong danh sách
}
function trSetQ(v){trQ=v||'';trRenderPeople();}
function trSetTeamF(v){trTeamF=v||'__all';renderTrainMgr();}
function trSetNotify(on){trNotify=!!on;renderTrainMgr();}
function trSetNoLunch(on){trNoLunch=!!on;renderTrainMgr();}

/* Mở một buổi có sẵn để sửa */
function trEdit(id){
  const tr=trById(id);if(!tr){toast(t('Không tìm thấy buổi đào tạo'));return;}
  const me=meId()||'';
  if(!trCanManage()&&(String(tr.by)!==String(me)||trIsActive(tr))){
    toast(t('Lịch đã duyệt — nhờ quản lý sửa giúp'));return;
  }
  trEditId=id;
  trView='form';                       // bấm Sửa từ bảng / màn khoá thì phải thấy form
  trCourseId=tr.courseId||'';
  trSel={};trDays(tr).forEach(iso=>{trSel[iso]=true;});
  trPick={};trEmps(tr).forEach(x=>{trPick[x]=true;});
  trDayM=trCleanDayMode(tr.dayMode,trDays(tr));
  trDayT=trCleanDayTime(tr.dayTime,trDays(tr));
  trTitle=tr.title||'';trPlace=tr.place||'';trNote=tr.note||'';
  /* Bản ghi CŨ (trước v7.1) chỉ có 'shift'/'ot' cho cả buổi — giữ nguyên
     đúng ý người đã xếp, KHÔNG tự nâng lên 'auto' rồi phân loại lại sau
     lưng họ. Chỉ bản mới mặc định 'auto'. */
  trMode=(tr.mode==='shift'||tr.mode==='ot')?tr.mode:'auto';
  trTimeIn=tr.timeIn||'08:00';trTimeOut=tr.timeOut||'17:00';
  trOvernight=!!tr.overnight;trNoLunch=!!tr.noLunch;trNotify=tr.notify!==false;
  trPreset=trPresetMatch(trTimeIn,trTimeOut);
  const first=trDays(tr)[0];if(first)trYm=schedMonthOf(first);
  renderTrainMgr();
}
function trNewFrom(){const v=trView;trResetForm();trView=v;renderTrainMgr();}
/* ---- ★ v7.8: chuyển màn & gắn buổi vào khoá ---- */
function trSetView(v){
  trView=(trCanManage()&&(v==='course'||v==='table'))?v:'form';
  renderTrainMgr();
}
function trSetCourse(id){
  trCourseId=String(id||'');
  const c=trCourseId?((S.courses||{})[trCourseId]||null):null;
  /* Chọn khoá mà chưa đặt tên buổi thì lấy luôn tên khoá — buổi 1 của khoá
     "An toàn hoá chất" đặt tên gì khác cũng chỉ là gõ lại. Đã gõ tên riêng
     rồi thì KHÔNG đè lên. */
  if(c){
    if(!String(trTitle||'').trim())trTitle=c.title||'';
    if(!String(trPlace||'').trim()&&c.place)trPlace=c.place;
    /* Học viên của khoá là gợi ý mặc định cho buổi mới — người xếp bỏ bớt
       ai không đi buổi này, thay vì tích lại từ đầu cho mỗi buổi. */
    if(!trEditId&&!Object.keys(trPick).length)
      (Array.isArray(c.emps)?c.emps:[]).forEach(x=>{if(empById(x))trPick[x]=true;});
  }
  renderTrainMgr();
}
/* Mở form xếp buổi MỚI cho đúng một khoá (nút "Thêm buổi" ở màn Khoá) */
function trNewForCourse(cid){
  trResetForm();
  trView='form';
  trSetCourse(cid);
}

function trSubmit(){
  const d=trDraft();
  d.id=trEditId||'';
  const r=trSave(d);
  if(!r.ok){toast(r.err);return;}
  trEditId=r.id;
  renderTrainMgr();
  if(typeof renderCal==='function')renderCal();
  if(typeof renderMe==='function'&&!noSelf)renderMe(true);
  if(typeof renderAppr==='function')renderAppr();
  let msg=(r.status==='pending')
    ? t('Đã gửi lịch đào tạo — chờ quản lý duyệt')
    : t('Đã lưu lịch đào tạo');
  if(r.nReq)   msg+=' · '+r.nReq+' '+t('đơn tăng ca đã tạo');
  if(r.nNotif) msg+=' · '+t('báo cho')+' '+r.nNotif+' '+t('người');
  if(r.keptReq)msg+=' · ⚠ '+r.keptReq+' '+t('đơn đã duyệt được giữ nguyên, kiểm tra lại');
  toast(msg);
}
function trDoApprove(id){
  const r=trApprove(id);
  if(!r.ok){toast(r.err);return;}
  renderTrainMgr();
  if(typeof renderCal==='function')renderCal();
  if(typeof renderMe==='function'&&!noSelf)renderMe(true);
  toast(t('Đã duyệt lịch đào tạo')+(r.nReq?' · '+r.nReq+' '+t('đơn tăng ca đã tạo'):''));
}
function trDoDelete(id){
  const tr=trById(id);if(!tr)return;
  if(!confirm(t('Xoá buổi đào tạo')+' "'+(tr.title||'')+'"? '
    +t('Thông báo đã gửi và đơn tăng ca chưa duyệt cũng bị thu hồi.')))return;
  const r=trDelete(id);
  if(!r.ok){toast(r.err);return;}
  if(trEditId===id)trResetForm();
  renderTrainMgr();
  if(typeof renderCal==='function')renderCal();
  if(typeof renderMe==='function'&&!noSelf)renderMe(true);
  let msg=t('Đã xoá buổi đào tạo');
  if(r.nNotif)msg+=' · '+t('thu hồi')+' '+r.nNotif+' '+t('thông báo');
  if(r.nReq)  msg+=' · '+t('gỡ')+' '+r.nReq+' '+t('đơn tăng ca');
  if(r.keptReq)msg+=' · ⚠ '+r.keptReq+' '+t('đơn đã duyệt vẫn còn');
  toast(msg);
}

/* ---------- Giao diện ---------- */
function trMiniCal(){
  const ym=trPeriod(),days=daysOfPeriod(ym);
  if(!days.length)return `<p class="muted">${t('Kỳ này chưa có lịch.')}</p>`;
  const lead=(new Date(days[0]+'T00:00:00').getDay()+6)%7;
  const tIso=todayIso();
  let h='<div class="ev-mini">';
  for(let i=0;i<7;i++)h+=`<div class="hd${i>4?' we':''}">${dowShort(i)}</div>`;
  for(let k=0;k<lead;k++)h+='<div class="pd"></div>';
  days.forEach(iso=>{
    const other=trOfDay(iso).filter(x=>x.id!==trEditId);
    h+=`<button type="button" class="d${trSel[iso]?' on':''}${iso===tIso?' today':''}${other.length?' has':''}"
        onclick="trToggleDay('${iso}')" title="${other.length?esc(other.map(x=>x.title||'').join(' · ')):fmtVNfull(iso)}">
        <b>${+iso.slice(8)}</b><i>${dowOf(iso)}</i></button>`;
  });
  return h+'</div>';
}
/* ------------------------------------------------------------
   BẢNG TỪNG NGÀY — nơi câu hỏi "ngày này trong ca hay tăng ca" được trả lời
   ------------------------------------------------------------
   Mỗi ngày một dòng: ngày · ca của những người đang chọn · kết luận của app
   · ba nút Tự động / Trong ca / Tăng ca. Người xếp nhìn một lượt là thấy
   "18 mọi người đang R nên app tính tăng ca, 19 đang O nên học trong giờ" —
   đúng câu họ định hỏi, và sửa được ngay tại chỗ nếu thực tế khác.
   ------------------------------------------------------------ */
function trDaysHtml(){
  const days=Object.keys(trSel).sort();
  if(!days.length)return '';
  const d=trDraft(), picked=Object.keys(trPick);
  const forced=Object.keys(trDayM).length;
  /* v='' là nút "Tự động"; nó sáng khi ngày đó KHÔNG bị ép tay */
  const btn=(iso,v,lb)=>
    `<button type="button" class="dm${(trDayM[iso]||'')===v?' on':''}"
      onclick="trSetDayMode('${iso}','${v}')">${lb}</button>`;
  const ownT=Object.keys(trDayT).length;
  return `<div class="tr-daybar">
      <b>${t('Giờ học và cách tính của từng ngày')}</b>
      <span class="muted sm2">${t('Mỗi ngày lấy khung giờ chung ở trên; ngày nào khác thì sửa ngay tại dòng đó.')}</span>
      ${forced?`<button class="btn sec sm" onclick="trClearDayModes()">${t('Bỏ ép tay')} (${forced})</button>`:''}
      ${ownT?`<button class="btn sec sm" onclick="trClearDayTimes()">${t('Về giờ chung')} (${ownT})</button>`:''}
    </div>
    <div class="tr-days">${days.map(iso=>{
      const sp=trDaySplit(d,iso);
      const h=trHoursOfDay(d,iso);
      const cur=trDayM[iso]||'';
      const w=trDayTimeOf(iso), own=!!trDayT[iso];
      const pv=trPresetMatch(w.from,w.to);
      /* Ca của những người đang chọn trong ngày này — gom lại thành "3×R · 2×O" */
      const cnt={};picked.forEach(id=>{const c=eff(id,iso).code||'';cnt[c]=(cnt[c]||0)+1;});
      const codes=Object.keys(cnt).sort().map(c=>
        `${c?chip(c):'<i class="dash">—</i>'}<u>×${cnt[c]}</u>`).join(' ');
      const verdict=!picked.length
        ? `<i class="muted">${t('chưa chọn người')}</i>`
        : (!sp.ot.length ? `<i class="ok">${t('trong ca')}</i>`
        :  !sp.shift.length ? `<i class="ot">${t('tăng ca')} ${sp.ot.length} ${t('người')}</i>`
        :  `<i class="mix">${sp.ot.length} ${t('tăng ca')} · ${sp.shift.length} ${t('trong ca')}</i>`);
      return `<div class="tr-day${cur?' forced':''}${own?' owntime':''}">
        <span class="dt"><b>${fmtVN(iso)}</b><i>${dowOf(iso)}</i></span>
        <span class="tms">
          <select class="inp sm" data-k="dp-${iso}" onchange="trSetDayPreset('${iso}',this.value)" title="${t('Mẫu giờ học của ngày này')}">
            ${own?'':`<option value="" selected>${t('Theo giờ chung')}</option>`}
            ${TRAIN_PRESETS.map(p=>`<option value="${p.v||'__own'}" ${own&&pv===p.v?'selected':''}>${t(p.label)}</option>`).join('')}
            ${own?`<option value="">${t('Theo giờ chung')}</option>`:''}
          </select>
          <input type="time" class="inp sm tm" data-k="df-${iso}" value="${esc(w.from)}" onchange="trSetDayTime('${iso}','from',this.value)">
          <input type="time" class="inp sm tm" data-k="dt-${iso}" value="${esc(w.to)}" onchange="trSetDayTime('${iso}','to',this.value)">
          ${trSpansLunch(iso,w)?`<label class="lz" title="${t('Trừ 1 giờ nghỉ trưa')}"><input type="checkbox" data-k="dl-${iso}" ${w.noLunch?'checked':''}
            onchange="trSetDayTime('${iso}','noLunch',this.checked)">🍚</label>`:''}
          <b class="hh">${h}h</b>
        </span>
        <span class="cds">${codes||'<i class="muted">—</i>'}</span>
        <span class="vd">${verdict}${cur?` <em>${t('đã ép tay')}</em>`:''}</span>
        <span class="dms">${btn(iso,'',t('Tự động'))}${btn(iso,'shift',t('Trong ca'))}${btn(iso,'ot',t('Tăng ca'))}</span>
      </div>`;
    }).join('')}</div>`;
}

/* Danh sách người — có lọc nhóm + tìm theo tên/mã. Mỗi người kèm CA THỰC TẾ
   của từng ngày đang chọn, để người xếp thấy ngay "anh này hôm đó trực ca
   đêm, học ban ngày là ép người ta thức". Tên đứng RIÊNG MỘT DÒNG nên không
   còn bị cắt cụt như bản trước. */
function trPeopleHtml(){
  const days=Object.keys(trSel).sort();
  const d=trDraft();
  const q=noAccent(String(trQ||'')).trim();
  let list=schedEmps();
  if(!trCanManage())list=list.filter(e=>e.id===meId());
  if(trTeamF!=='__all')list=list.filter(e=>(e.team||'')===trTeamF);
  if(q)list=list.filter(e=>noAccent((e.name||'')+' '+e.id).includes(q));
  if(!list.length)return `<p class="muted sm2">${t('Không có ai khớp bộ lọc.')}</p>`;
  /* Hiện tối đa 4 ngày trên thẻ; nhiều hơn thì bảng Từng ngày ở trên đã nói đủ */
  const show=days.slice(0,4);
  return `<div class="tr-people">${list.map(e=>{
    const on=!!trPick[e.id];
    const busy=days.some(iso=>trOfCell(e.id,iso).some(x=>x.id!==trEditId));
    const cells=show.map(iso=>{
      const c=eff(e.id,iso).code||'';
      const m=on?trModeFor(d,e.id,iso):'';
      return `<span class="dy${m?' '+m:''}" title="${esc(fmtVN(iso)+' '+dowOf(iso)
        +(m?(' — '+(m==='ot'?t('tăng ca'):t('trong ca'))):''))}">
        <u>${+iso.slice(8)}</u>${c?chip(c):'<i class="dash">—</i>'}</span>`;
    }).join('');
    return `<label class="tr-p${on?' on':''}${busy?' busy':''}">
      <span class="hd">
        <input type="checkbox" data-k="p-${esc(e.id)}" ${on?'checked':''} onchange="trTogglePerson('${esc(e.id)}')">
        <span class="nm" title="${esc(e.name||e.id)}">${esc(e.name||e.id)}</span>
        ${busy?`<span class="bz" title="${esc(t('Người này đã có lịch đào tạo khác'))}">🎓</span>`:''}
      </span>
      <span class="sub">
        <span class="mt">${esc(e.team?t('Nhóm')+' '+e.team:t('(chưa nhóm)'))}</span>
        <span class="dys">${cells}${days.length>show.length?`<i class="more">+${days.length-show.length}</i>`:''}</span>
      </span>
    </label>`;
  }).join('')}</div>`;
}
/* Hai danh sách có thanh cuộn riêng bên trong hộp thoại — phải giữ cả chỗ
   cuộn của chúng, không chỉ của hộp thoại. Xem uiSnap/uiRestore ở js/03-nav.js. */
const TR_SCROLLERS=['.tr-people','.tr-days'];
function renderTrainMgr(){
  const box=$('trBody');if(!box)return;
  const snap=(typeof uiSnap==='function')?uiSnap('trBody',TR_SCROLLERS):null;
  const per=periodFor(trPeriod());
  const days=Object.keys(trSel).sort();
  const picked=Object.keys(trPick);
  const manage=trCanManage();
  const teams=teamList();
  /* Tổng giờ tăng ca sẽ sinh ra — con số này quyết định tiền, phải hiện
     TRƯỚC khi bấm lưu chứ không phải để người ta phát hiện ở bảng lương.
     Tính bằng CHÍNH hàm dùng lúc lưu (trOtPairs) nên xem trước và kết quả
     thật không thể lệch nhau. */
  const draft=trDraft();
  const pairs=trOtPairs(draft);
  const otTot=trOtTotalHours(draft);
  const otPeople=new Set(pairs.map(p=>p.empId)).size;
  /* ★ v7.2 — khung giờ LUÔN hiện. Giờ học là dữ liệu của buổi (vào cột báo
     cáo "Giờ đào tạo"), không phải phụ kiện của phần tăng ca. */

  /* ★ v7.8 — thanh chuyển màn. Nhân viên tự khai chỉ có form, không có
     khoá / bảng tổng hợp (họ không xếp cho ai). */
  const tabs=manage?`<div class="ev-tabs">
    <button class="evtab${trView==='form'?' on':''}"   onclick="trSetView('form')">✏️ ${t('Xếp buổi')}</button>
    <button class="evtab${trView==='course'?' on':''}" onclick="trSetView('course')">📚 ${t('Khoá đào tạo')}</button>
    <button class="evtab${trView==='table'?' on':''}"  onclick="trSetView('table')">📋 ${t('Bảng tổng hợp')}</button>
  </div>`:'';

  if(manage&&trView!=='form'){
    box.innerHTML=`<h3>🎓 ${t('Lịch đào tạo')}</h3>`+tabs+
      (trView==='course'
        ? ((typeof coBodyHtml==='function')?coBodyHtml():'')
        : ((typeof trTableHtml==='function')?trTableHtml():''))+`
    <div class="row" style="gap:8px;margin-top:10px">
      <button class="btn sec" style="flex:1" onclick="trSetView('form')">➕ ${t('Xếp buổi mới')}</button>
      <button class="btn sec" onclick="closeTrainMgr()">${t('Đóng')}</button>
    </div>`;
    if(typeof uiRestore==='function')uiRestore(snap);
    return;
  }

  box.innerHTML=`
  <h3>🎓 ${t('Lịch đào tạo')}</h3>${tabs}
  <p class="muted sm2">${manage
    ? t('Xếp lịch đào tạo cho nhân viên. Ô lịch của họ sẽ đổi màu, app tự gửi thông báo và tin Zalo gộp.')
    : t('Khai lịch đào tạo của bạn. Quản lý duyệt xong mới có hiệu lực trên lịch.')}</p>

  <div class="ev-per">
    <button class="btn sec sm" onclick="trShiftYm(-1)">◀</button>
    <b>${esc(per.label)}</b>
    <button class="btn sec sm" onclick="trShiftYm(1)">▶</button>
    <span style="flex:1"></span>
    <span class="muted sm2">${t('Chạm vào ngày để chọn / bỏ chọn')}</span>
  </div>
  ${trMiniCal()}
  <div class="ev-selbar">
    <span class="ev-cnt">${days.length?('<b>'+days.length+'</b> '+t('ngày')+': '+esc(trDateLabel({days})))
                                      :('<i class="muted">'+t('chưa chọn ngày nào')+'</i>')}</span>
    <button class="btn sec sm" onclick="trSelRange()">${t('Chọn cả dải')}</button>
    <button class="btn sec sm" onclick="trClearDays()">${t('Bỏ chọn hết')}</button>
  </div>

  ${manage?`<div class="fg"><label class="fl">${t('Thuộc khoá đào tạo')}</label>
    <div class="row" style="gap:8px">
      <select class="inp" data-k="course" style="flex:1" onchange="trSetCourse(this.value)">
        <option value="">${t('— Buổi lẻ (không thuộc khoá nào) —')}</option>
        ${((typeof coAll==='function')?coAll():[]).map(c=>`<option value="${c.id}"${
          trCourseId===c.id?' selected':''}>${esc(c.title||t('Khoá đào tạo'))}</option>`).join('')}
      </select>
      <button class="btn sec" onclick="trSetView('course')">📚 ${t('Quản lý khoá')}</button>
    </div>
    <p class="muted sm2">${t('Một khoá gồm nhiều buổi. Khai khoá một lần rồi thêm từng buổi vào đó — sau này chuyển người qua lại giữa các buổi ngay trong màn Khoá đào tạo.')}</p>
  </div>`:''}

  <div class="fg"><label class="fl">${t('Nội dung đào tạo')}</label>
    <input class="inp" data-k="title" value="${esc(trTitle)}" placeholder="${t('VD: Huấn luyện an toàn hoá chất')}"
           oninput="trTitle=this.value"></div>
  <div class="row" style="gap:8px">
    <div class="fg" style="flex:1"><label class="fl">${t('Địa điểm (không bắt buộc)')}</label>
      <input class="inp" data-k="place" value="${esc(trPlace)}" placeholder="${t('VD: Phòng họp tầng 2')}"
             oninput="trPlace=this.value"></div>
  </div>

  <div class="fg"><label class="fl">${t('Người đi đào tạo')} ${picked.length?`<b>(${picked.length})</b>`:''}</label>
    ${manage?`<div class="tr-filter">
      <select class="inp sm" data-k="teamF" onchange="trSetTeamF(this.value)">
        <option value="__all">${t('Tất cả nhóm')}</option>
        ${teams.map(tm=>`<option value="${esc(tm)}" ${trTeamF===tm?'selected':''}>${
          esc(tm?t('Nhóm')+' '+tm:t('(chưa phân nhóm)'))}</option>`).join('')}
      </select>
      <input class="inp sm" data-k="q" value="${esc(trQ)}" placeholder="${t('Tìm tên hoặc mã NV')}" oninput="trSetQ(this.value)">
      ${trTeamF!=='__all'?`<button class="btn sec sm" onclick="trPickTeam('${esc(trTeamF)}')">${t('Chọn cả nhóm')}</button>`:''}
      <button class="btn sec sm" onclick="trClearPeople()">${t('Bỏ chọn hết')}</button>
    </div>`:`<p class="muted sm2">${t('Bạn chỉ xếp được cho chính mình.')}</p>`}
    <div id="trPeopleBox">${trPeopleHtml()}</div>
  </div>

  <div class="fg"><label class="fl">${t('Hình thức')}</label>
    <div class="ev-scope">
      <button type="button" class="sc${trMode==='auto'?' on':''}" onclick="trSetMode('auto')">
        <b>🤖 ${t('Để app tự xác định')}</b><i>${t('Ngày nào người đó nghỉ ca thì tính tăng ca; đang trực và giờ học nằm trong ca thì tính trong ca')}</i></button>
      <button type="button" class="sc${trMode==='shift'?' on':''}" onclick="trSetMode('shift')">
        <b>${t('Tất cả trong ca làm việc')}</b><i>${t('Ép mọi người mọi ngày là trong giờ trực — không phát sinh tăng ca')}</i></button>
      <button type="button" class="sc${trMode==='ot'?' on':''}" onclick="trSetMode('ot')">
        <b>${t('Tất cả tính tăng ca')}</b><i>${t('Ép mọi người mọi ngày là tăng ca — app tạo đơn tăng ca cho từng người')}</i></button>
    </div>
  </div>

  <div class="row" style="gap:8px;align-items:flex-end">
    <div class="fg" style="flex:2;min-width:180px"><label class="fl">${t('Khung giờ học (áp cho mọi ngày)')}</label>
      <select class="inp" data-k="preset" onchange="trSetPreset(this.value)">
        ${TRAIN_PRESETS.map(p=>`<option value="${p.v}" ${trPreset===p.v?'selected':''}>${t(p.label)}</option>`).join('')}
      </select>
    </div>
    <div class="fg" style="flex:1;min-width:96px"><label class="fl">${t('Từ')}</label>
      <input type="time" class="inp" data-k="tIn" value="${esc(trTimeIn)}" oninput="trTimeIn=this.value" onchange="renderTrainMgr()"></div>
    <div class="fg" style="flex:1;min-width:96px"><label class="fl">${t('Đến')}</label>
      <input type="time" class="inp" data-k="tOut" value="${esc(trTimeOut)}" oninput="trTimeOut=this.value" onchange="renderTrainMgr()"></div>
  </div>
  <div class="row" style="gap:14px;flex-wrap:wrap">
    <label class="cal-chk"><input type="checkbox" data-k="ovn" ${trOvernight?'checked':''}
      onchange="trOvernight=this.checked;renderTrainMgr()"> ${t('Kết thúc vào hôm sau (qua đêm)')}</label>
    ${trSpansLunch(days[0]||todayIso(),{from:trTimeIn,to:trTimeOut,overnight:trOvernight})
      ?`<label class="cal-chk"><input type="checkbox" data-k="lunch" ${trNoLunch?'checked':''}
        onchange="trSetNoLunch(this.checked)"> ${t('Trừ 1 giờ nghỉ trưa')}</label>`:''}
  </div>
  <p class="muted sm2">${t('Đây là giờ mặc định — ngày nào học khác giờ thì sửa ngay ở bảng bên dưới. Khung giờ cũng là căn cứ để app soi "giờ học có nằm trong ca của người đó không".')}</p>

  ${trDaysHtml()}

  ${days.length&&picked.length?`<div class="pv-alert sm">🎓 ${t('Mỗi người học')}
    <b>${trHoursOfEmp(draft,picked[0])}</b> ${t('giờ')} (${days.length} ${t('ngày')}) ·
    ${t('cả lớp')} <b>${rnd1(trHoursOfEmp(draft,picked[0])*picked.length)}</b> ${t('giờ đào tạo')}.</div>`:''}
  ${pairs.length?`<div class="pv-alert info sm">⚡ ${t('Sẽ tạo')}
    <b>${otPeople}</b> ${t('đơn tăng ca')} · ${t('tổng')} <b>${otTot}</b> ${t('giờ')}
    (${pairs.length} ${t('lượt người-ngày')}).</div>`
   :(days.length&&picked.length?`<div class="pv-alert sm">✓ ${t('Không ngày nào phát sinh tăng ca — không tạo đơn nào.')}</div>`:'')}


  <div class="fg"><label class="fl">${t('Ghi chú (không bắt buộc)')}</label>
    <input class="inp" data-k="note" value="${esc(trNote)}" placeholder="${t('VD: Mang theo thẻ nhân viên')}"
           oninput="trNote=this.value"></div>

  <label class="cal-chk" style="margin:8px 0"><input type="checkbox" data-k="notify" ${trNotify?'checked':''}
    onchange="trSetNotify(this.checked)"> ${t('Gửi thông báo ngay khi lưu')}</label>
  ${!manage?`<div class="pv-alert warn sm">${t('Lịch bạn tự khai sẽ ở trạng thái chờ duyệt cho tới khi quản lý bấm duyệt.')}</div>`:''}
  ${trEditId?`<div class="pv-alert info sm">${t('Đang sửa buổi đã xếp — thông báo cũ sẽ được thu hồi và gửi lại bản mới. Đơn tăng ca chưa duyệt của buổi này cũng được tạo lại theo giờ mới.')}</div>`:''}

  <div class="row" style="gap:8px;margin-top:10px">
    <button class="btn ok" style="flex:1" onclick="trSubmit()">${trEditId?'💾 '+t('Lưu thay đổi'):'➕ '+t('Xếp lịch đào tạo')}</button>
    ${trEditId?`<button class="btn sec" onclick="trNewFrom()">${t('Xếp buổi mới')}</button>`:''}
    <button class="btn sec" onclick="closeTrainMgr()">${t('Đóng')}</button>
  </div>

  <h4 style="margin:14px 0 6px">${t('Buổi đào tạo đã xếp')}</h4>
  <div class="ev-list">${trListHtml()}</div>`;
  if(typeof uiRestore==='function')uiRestore(snap);
}
function trListHtml(){
  const me=meId()||'';
  const manage=trCanManage();
  /* Nhân viên thường chỉ thấy buổi có tên mình — danh sách cả tổ với họ
     vừa thừa vừa lộ lịch người khác. */
  let list=trAll();
  if(!manage)list=list.filter(tr=>trEmps(tr).includes(String(me))||String(tr.by)===String(me));
  if(!list.length)return `<p class="muted sm2">${t('Chưa có buổi đào tạo nào.')}</p>`;
  const tIso=todayIso();
  return list.map(tr=>{
    const d=trDays(tr), past=d.length&&d[d.length-1]<tIso, live=d.includes(tIso);
    const who=trEmps(tr).map(id=>shortName((empById(id)||{}).name||id));
    const canEdit=manage||(String(tr.by)===String(me)&&!trIsActive(tr));
    const nReq=trReqsOf(tr.id).length;
    const co=trCourseOf(tr);
    return `<div class="ev-it tr-it${past?' past':''}${live?' live':''}${tr.id===trEditId?' on':''}${trIsActive(tr)?'':' pend'}">
      <span class="tx"><b>🎓 ${co?`<span class="evtag">📚 ${esc(co.title||'')}</span> `:''}${esc(tr.title||t('Đào tạo'))}${
        trIsActive(tr)?'':' <span class="st pending">'+t('CHỜ DUYỆT')+'</span>'}</b>
        <i>${esc(trDateLabel(tr))} · ${esc(trModeLabel(tr))}${
          trIsOt(tr)&&trTimeLabel(tr)?' '+esc(trTimeLabel(tr))+' · '+trOtTotalHours(tr)+'h':''}${
          tr.place?' · '+esc(tr.place):''}</i>
        ${trDays(tr).length>1?`<i class="dm-line">${trDays(tr).map(iso=>{
          const m=trDayMode(tr,iso);
          return `<span class="dm-b ${m}">${fmtVN(iso)} ${
            m==='ot'?t('tăng ca'):m==='mix'?t('hỗn hợp'):t('trong ca')}</span>`;
        }).join('')}</i>`:''}
        <i>${who.length} ${t('người')}: ${esc(who.slice(0,8).join(', '))}${who.length>8?' …':''}</i>
        ${/* ★ v8.0 — điểm danh: chỉ hiện khi buổi ĐÃ diễn ra, vì trước đó
             con số "0/8 đã tham gia" chỉ làm người xem hoảng vô cớ. */''
         }${trHappened(tr)&&trIsActive(tr)?`<i class="att">✅ ${
            trAttendSplit(tr).done.length}/${trEmps(tr).length} ${t('đã xác nhận tham gia')}${
            trAttendSplit(tr).todo.length?` · ${t('chưa')}: `+esc(trAttendSplit(tr).todo
              .map(x=>shortName((empById(x)||{}).name||x)).slice(0,6).join(', ')):''}</i>`:''}
        ${nReq?`<i class="nt">${nReq} ${t('đơn tăng ca gắn với buổi này')}</i>`:''}
        ${tr.note?`<i class="nt">${esc(tr.note)}</i>`:''}</span>
      <span class="ac">
        ${(!trIsActive(tr)&&manage)?`<button class="btn ok sm ico" onclick="trDoApprove('${tr.id}')" title="${t('Duyệt')}">✓</button>`:''}
        ${canEdit?`<button class="btn sec sm ico" onclick="trEdit('${tr.id}')" title="${t('Sửa')}">✏️</button>`:''}
        ${canEdit?`<button class="btn warn sm ico" onclick="trDoDelete('${tr.id}')" title="${t('Xoá')}">✕</button>`:''}
      </span></div>`;
  }).join('');
}

/* Dải nhắc đào tạo trên trang chính nhân viên & trong sheet ngày.
   Chỉ nhắc buổi CỦA CHÍNH NGƯỜI ĐANG XEM — nhắc buổi của người khác thì
   trang chính thành bảng tin, không ai đọc nữa. */
function trBannerHtml(isoList,empId){
  const id=empId||meId();
  if(!id)return '';
  const seen={},out=[];
  (isoList||[]).forEach(iso=>trOfCell(id,iso).forEach(tr=>{
    if(seen[tr.id])return;seen[tr.id]=1;out.push(tr);
  }));
  if(!out.length)return '';
  /* Sắp theo ngày gần nhất trước — buổi học ngày mai phải nằm trên buổi tuần sau */
  out.sort((a,b)=>String(trDays(a)[0]||'').localeCompare(String(trDays(b)[0]||'')));
  return `<div class="ev-banner">${out.map(tr=>`<div class="ev-b tr-b">
    <span class="ic">🎓</span>
    <span class="tx"><b>${esc(tr.title||t('Đào tạo'))}${trIsActive(tr)?'':' · '+t('chờ duyệt')}${
      trAttended(tr,id)?' <span class="evtag ok">✅ '+t('đã tham gia')+'</span>':''}</b>
      <i>${(isoList||[]).filter(x=>trOfCell(id,x).some(y=>y.id===tr.id)).map(x=>
          fmtVN(x)+' '+(trTimeLabelOf(tr,x)||'')+' '+
          (trModeFor(tr,id,x)==='ot'?t('tăng ca'):t('trong ca'))
        ).join(' · ')}${tr.place?' · '+esc(tr.place):''}${tr.note?' · '+esc(tr.note):''}</i></span>
    ${/* ★ v8.0 — nút điểm danh của CHÍNH người đang xem. Chỉ hiện sau khi
         buổi đã diễn ra; trước đó chỗ này vẫn là đồng hồ đếm ngược. */''
     }${trCanAttend(tr,id)
        ? `<button class="btn ${trAttended(tr,id)?'sec':'ok'} sm when"
             onclick="trToggleAttend('${tr.id}','${id}')">${
             trAttended(tr,id)?'✅ '+t('đã xác nhận'):t('Xác nhận đã tham gia')}</button>`
        : ((typeof nsWhen==='function')
            ? `<span class="when">${esc(nsWhen(trDays(tr).find(x=>x>=todayIso())||trDays(tr)[0]))}</span>`
            : '')}
  </div>`).join('')}</div>`;
}
/* Bấm xác nhận từ dải nhắc / bảng tổng hợp — vẽ lại đúng chỗ đang mở */
function trToggleAttend(trId,empId){
  const r=trSetAttend(trId,empId);
  if(!r.ok){toast(r.err);return;}
  if(typeof renderMe==='function'&&!noSelf)renderMe(true);
  if(typeof renderTrainMgr==='function'&&$('trMask')&&$('trMask').classList.contains('on'))renderTrainMgr();
  /* Sheet ngày tự đọc pvSheetDate nên gọi không tham số; chỉ vẽ khi đang mở */
  if(typeof renderDaySheet==='function'&&typeof pvSheetDate!=='undefined'&&pvSheetDate)renderDaySheet();
  toast(r.on?t('Đã ghi nhận bạn tham gia buổi đào tạo'):t('Đã bỏ xác nhận tham gia'));
}
/* Số buổi đào tạo đang chờ duyệt — cho phù hiệu trên nút */
function trPendingCount(){
  if(!trCanManage())return 0;
  return trAll().filter(tr=>!trIsActive(tr)).length;
}
