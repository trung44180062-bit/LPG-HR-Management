/* ============================================================
   DANG KY + DUYET don
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== KHAI BÁO CHUNG =================== */
const WT_REASONS=[
  {v:'forgot_card',vn:'Quên thẻ',en:'Left the card at home'},
  {v:'forgot_scan',vn:'Quên quẹt thẻ',en:'Forgot to scan the card'},
  {v:'lost_card',vn:'Mất thẻ',en:'Lost the card'},
  {v:'damaged_card',vn:'Thẻ hỏng',en:'The card was damaged'},
  {v:'other',vn:'Lý do khác',en:'Others'}
];
const SHIFT_HOURS={D:['08:00','20:00'],N:['20:00','08:00'],O:['08:00','17:00']};
/* ------------------------------------------------------------
   MẶC ĐỊNH CHẾ ĐỘ IN THEO LOẠI ĐƠN
   Theo quy định nộp giấy tờ của công ty, chỉ hai loại đơn dưới đây bắt buộc
   in biểu mẫu nộp nhân sự nên mặc định vào hàng CHỜ IN; các loại còn lại
   mặc định "không cần in" (vẫn duyệt & ghi lịch bình thường).
   Người khai luôn đổi lại được ngay trong form, quản lý đổi được ở màn Duyệt.

   ★ v7.8 — hai loại BẮT BUỘC IN là:
       'multi' — làm liên tục nhiều ngày (nhân sự đòi tờ đơn có chữ ký để
                 đối chiếu chuỗi ngày làm liên tục)
       'swap'  — đổi ca (đụng tới hai người nên phải có giấy)
   Đơn bổ sung công ('wt') trước đây nằm trong danh sách này, nay bỏ ra:
   thực tế nhân sự nhận qua hệ thống HR, không cần tờ in.
   ------------------------------------------------------------ */
const REQ_MUST_PRINT=['multi','swap'];
function defaultNoPrint(type){return !REQ_MUST_PRINT.includes(type);}
function baseShiftOf(code){
  /* Ca kép lấy theo nửa CA CHUẨN — người trực O rồi tăng ca đêm thì
     buổi làm chính của họ hôm đó vẫn là ca O. */
  const cb=(typeof comboOf==='function')&&comboOf(code);
  if(cb)code=cb.work;
  if(code==='D'||code==='SD'||code==='OTD')return 'D';
  if(code==='N'||code==='SN'||code==='OTN')return 'N';
  if(code==='O'||code==='SO'||code==='OTO')return 'O';
  return null;
}
function shiftLabelOf(code){const b=baseShiftOf(code);return b==='D'?'Day':b==='N'?'Night':b==='O'?'Office':'—';}
/* ============================================================
   MỖI NGÀY 1 DÒNG
   Quy định công ty: đơn nghỉ phép / đổi ca / tăng ca … mỗi ngày là
   một dòng riêng. Đơn mới lưu danh sách dòng ở r.days:
       r.days = [{iso, code, timeIn, timeOut}, ...]
   Đơn cũ (chỉ có from → to) vẫn đọc được: suy ra dòng theo khoảng ngày.
   Riêng đơn "làm liên tục nhiều ngày" (multi) vẫn là 1 khoảng ngày.
   ============================================================ */
function reqDays(r){
  if(Array.isArray(r.days)&&r.days.length){
    return r.days.filter(d=>d&&(d.iso||typeof d==='string')).map(d=>
      typeof d==='string'
        ? {iso:d,code:r.code||'',timeIn:r.timeIn||'',timeOut:r.timeOut||''}
        : {iso:d.iso,code:d.code||r.code||'',timeIn:d.timeIn||r.timeIn||'',timeOut:d.timeOut||r.timeOut||'',
           isoEnd:d.isoEnd||'',hours:d.hours||0,preset:d.preset||''});
  }
  const out=[];
  for(const iso of dateRange(r.from,r.to||r.from))
    out.push({iso,code:r.code||'',timeIn:r.timeIn||'',timeOut:r.timeOut||''});
  return out;
}
/* Đơn có tác động tới ngày iso không (đơn nhiều dòng có thể bỏ trống ngày ở giữa) */
function reqHasDay(r,iso){
  if(r.type==='multi')return r.from<=iso&&iso<=(r.to||r.from);
  return reqDays(r).some(d=>d.iso===iso);
}
/* Tập ngày của đơn — dùng để soi trùng đơn */
function reqDaySet(r){
  if(r.type==='multi'){const s=new Set();for(const iso of dateRange(r.from,r.to||r.from))s.add(iso);return s;}
  return new Set(reqDays(r).map(d=>d.iso));
}
/* Người đứng đơn thực sự (đơn khai hộ: r.byId là người bấm gửi) */
function reqWriter(r){return r.byId&&r.byId!==r.empId?r.byId:r.empId;}

/* ============================================================
   CHẶN ĐƠN TRÙNG   ★ v8.3
   ------------------------------------------------------------
   MỘT NGƯỜI · MỘT LOẠI ĐƠN · MỘT NGÀY = chỉ được có MỘT đơn còn sống.

   Cảnh thật: xin nghỉ ngày 19/08, gửi xong mới nhớ chưa ghi lý do, nên gửi
   thêm một đơn nữa có lý do. Hai đơn y hệt nằm cạnh nhau ở hàng duyệt; duyệt
   cả hai thì ô lịch bị ghi hai lần và bản in nộp nhân sự có hai tờ cho cùng
   một ngày. Trước đây app chỉ CẢNH BÁO ở form (conflictReqs) rồi vẫn cho gửi.

   HAI NGOẠI LỆ CỐ Ý:
     · Tăng ca — một ngày tăng ca nhiều lần là bình thường (có từ v4.3, xem
       dsAddRow). Nên OT chỉ tính là trùng khi KHUNG GIỜ ĐÈ LÊN NHAU, chứ
       không phải cứ cùng ngày. OT 08:00–12:00 và OT 18:00–20:00 cùng ngày
       vẫn gửi được.
     · KHÁC loại đơn — nghỉ phép ngày 19 rồi xin đổi ca ngày 19 là mâu thuẫn
       nghiệp vụ chứ không phải đơn trùng. Chỗ đó giữ nguyên cảnh báo mềm của
       conflictReqs() để người làm đơn tự quyết.

   Đơn đã bị TỪ CHỐI không tính — người ta phải được làm lại đơn.
   ============================================================ */
const DUP_ALIVE=st=>st==='pending'||st==='approved';

/* Khung giờ một dòng tăng ca, quy về SỐ PHÚT tính từ 00:00 của ngày dòng đó.
   Giờ ra ≤ giờ vào, hoặc khai rõ isoEnd khác ngày → qua nửa đêm, cộng 1 ngày. */
function otRowSpan(d){
  if(!d)return null;
  const num=s=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(s||''));return m?(+m[1]*60+(+m[2])):null;};
  const a=num(d.timeIn), b0=num(d.timeOut);
  if(a===null||b0===null)return null;
  let b=b0;
  if(b<=a)b+=1440;
  else if(d.isoEnd&&d.isoEnd!==d.iso)b+=1440;
  return [a,b];
}
/* Hai dòng tăng ca CÙNG NGÀY có đè giờ lên nhau không.
   Thiếu giờ thì trả true — thà chặn nhầm còn hơn để lọt một đơn trùng. */
function otRowsOverlap(a,b){
  const x=otRowSpan(a),y=otRowSpan(b);
  if(!x||!y)return true;
  return x[0]<y[1]&&y[0]<x[1];
}
/* Những đơn CÒN SỐNG đang giẫm lên đúng loại + đúng ngày mình sắp gửi.
     rows   = [{iso,timeIn,timeOut,isoEnd}] — loại không phải OT chỉ cần iso
     skipId = bỏ qua chính đơn đang sửa (để sẵn cho lúc app có chức năng sửa đơn)
   Trả [{id, r, isos[]}]. */
function reqDupHits(empId,type,rows,skipId){
  const hits=[];
  const mine=(rows||[]).filter(d=>d&&d.iso);
  if(!empId||!type||!mine.length)return hits;
  const all=(typeof S!=='undefined'&&S.requests)?S.requests:{};
  for(const k in all){
    const r=all[k];
    if(!r||r.empId!==empId||r.type!==type)continue;
    if(!DUP_ALIVE(r.status))continue;
    if(skipId&&(k===skipId||r.id===skipId))continue;
    const isos=[];
    if(type==='ot'){
      const od=reqDays(r);
      mine.forEach(d=>{
        if(isos.indexOf(d.iso)>=0)return;
        if(od.some(o=>o.iso===d.iso&&otRowsOverlap(d,o)))isos.push(d.iso);
      });
    }else{
      const set=reqDaySet(r);
      mine.forEach(d=>{ if(set.has(d.iso)&&isos.indexOf(d.iso)<0)isos.push(d.iso); });
    }
    if(isos.length)hits.push({id:k,r:r,isos:isos.sort()});
  }
  return hits;
}
/* Một dòng người đọc hiểu ngay: "Nghỉ phép 19/08 — đang chờ duyệt" */
function reqDupLine(h){
  const tr=(typeof t==='function')?t:(x=>x);
  const lb=(typeof REQ_LABEL!=='undefined'&&REQ_LABEL[h.r.type])||h.r.type;
  const dd=h.isos.map(x=>(typeof fmtVN==='function')?fmtVN(x):x).join(', ');
  return tr(lb)+' '+dd+' — '+tr(h.r.status==='approved'?'đã duyệt':'đang chờ duyệt');
}

/* ============================================================
   NGƯỜI OT COVER (đơn nghỉ phép)
   Nhân viên xin nghỉ có thể chỉ luôn người ở lại tăng ca gánh ca cho mình.
   Lưu ở đơn: r.coverId (mã NV) + r.coverSt = pending | confirmed | declined.
   Người được chọn nhận thông báo kind='coverConfirm' có nút Đồng ý / Từ chối.
   Từ chối KHÔNG chặn duyệt — chỉ hiện cờ đỏ để người duyệt (hoặc người làm
   đơn) đổi sang người khác bằng reqSetCover().
   ============================================================ */
const COVER_ST={pending:{ic:'⏳',lb:'chờ xác nhận',cls:'pending'},
                confirmed:{ic:'✓',lb:'đã nhận cover',cls:'confirmed'},
                declined:{ic:'✕',lb:'từ chối cover',cls:'declined'}};

/* ============================================================
   ★ v6.5 — MỖI NGÀY MỘT NGƯỜI COVER / MỘT NGƯỜI ĐỔI CA
   ------------------------------------------------------------
   Trước đây một đơn chỉ có ĐÚNG MỘT r.coverId cho mọi ngày. Thực tế nghỉ
   3 ngày thì hôm thứ Hai anh A rảnh, thứ Ba anh B rảnh — ép một người gánh
   cả ba ngày là sai với cách tổ đang chạy.

   Nay lưu theo ngày:
       r.covers = { "2026-08-19": {id:'e3', st:'pending'}, … }   ← đơn nghỉ phép
       r.withs  = { "2026-08-19": {id:'e2', st:'pending'}, … }   ← đơn đổi ca

   TƯƠNG THÍCH NGƯỢC — đây là phần quan trọng nhất:
     · Đơn CŨ không có `covers` → đọc r.coverId và hiểu là người đó gánh MỌI
       ngày của đơn. Không phải chuyển đổi dữ liệu, không phải sửa Firebase.
     · r.coverId / r.coverSt (và r.withId / r.confirmW) vẫn được GIỮ như một
       BẢN TÓM TẮT: một người thì y như cũ; nhiều người thì coverId = người
       đầu tiên và coverSt = trạng thái gộp (có ai từ chối → declined; tất cả
       đồng ý → confirmed; còn lại → pending). Nhờ vậy mọi chỗ đang đọc hai
       trường cũ (bộ lọc màn Duyệt, js/18-advice.js, thống kê…) vẫn chạy
       đúng nghĩa mà không phải sửa hàng chục nơi cùng lúc.
   ============================================================ */

/* Bản đồ theo ngày, dựng từ dữ liệu mới hoặc suy ra từ đơn cũ */
function reqDayMap(r,kind){
  const out={};
  if(!r)return out;
  const key=(kind==='with')?'withs':'covers';
  const oldId=(kind==='with')?r.withId:r.coverId;
  const oldSt=(kind==='with')?r.confirmW:r.coverSt;
  const m=r[key];
  if(m&&typeof m==='object'&&Object.keys(m).length){
    Object.keys(m).forEach(iso=>{
      const v=m[iso];
      if(v&&v.id)out[iso]={id:v.id,st:v.st||'pending'};
    });
    return out;
  }
  if(oldId)reqDays(r).forEach(d=>{out[d.iso]={id:oldId,st:oldSt||'pending'};});
  return out;
}
function reqCoverMap(r){return reqDayMap(r,'cover');}
function reqWithMap(r){return reqDayMap(r,'with');}
/* Người phụ trách một NGÀY cụ thể */
function reqDayCover(r,iso){return reqCoverMap(r)[iso]||{id:'',st:''};}
function reqDayWith(r,iso){return reqWithMap(r)[iso]||{id:'',st:''};}

/* Gộp theo NGƯỜI → [{id, st, isos:[…]}], xếp theo ngày đầu tiên.
   Dùng để hiển thị "A: 19/08, 20/08 · B: 21/08" mà không lặp tên. */
function reqPartyGroups(r,kind){
  const m=reqDayMap(r,kind), g={};
  Object.keys(m).sort().forEach(iso=>{
    const v=m[iso];
    const k=v.id;
    if(!g[k])g[k]={id:v.id,st:v.st,isos:[]};
    g[k].isos.push(iso);
    /* Trạng thái xấu nhất thắng: một ngày bị từ chối là cả người đó "có vấn đề" */
    if(v.st==='declined')g[k].st='declined';
    else if(g[k].st!=='declined'&&v.st==='pending')g[k].st='pending';
  });
  return Object.keys(g).map(k=>g[k]).sort((a,b)=>String(a.isos[0]).localeCompare(String(b.isos[0])));
}
function reqCoverGroups(r){return reqPartyGroups(r,'cover');}
function reqWithGroups(r){return reqPartyGroups(r,'with');}
/* Mọi mã NV có mặt trong vai trò đó (không trùng) */
function reqCoverIds(r){return reqCoverGroups(r).map(x=>x.id);}
function reqWithIds(r){return reqWithGroups(r).map(x=>x.id);}

/* Trạng thái gộp của cả đơn: xấu nhất thắng */
function reqPartySt(r,kind){
  const gs=reqPartyGroups(r,kind);
  if(!gs.length)return '';
  if(gs.some(g=>g.st==='declined'))return 'declined';
  if(gs.every(g=>g.st==='confirmed'))return 'confirmed';
  return 'pending';
}
/* Ghi bản đồ theo ngày xuống đơn + cập nhật hai trường tóm tắt cũ */
function reqPartyWrite(r,kind,map){
  if(!r)return;
  const key=(kind==='with')?'withs':'covers';
  const clean={};
  Object.keys(map||{}).forEach(iso=>{
    const v=map[iso];
    if(v&&v.id)clean[iso]={id:v.id,st:v.st||'pending'};
  });
  if(Object.keys(clean).length)r[key]=clean; else delete r[key];

  /* ★ Gộp từ `clean` CHỨ KHÔNG đọc lại từ r.
     Bẫy: gỡ hết người → xoá r.covers → reqDayMap không thấy bản đồ mới nên
     rơi về nhánh tương thích ngược, đọc r.coverId CŨ và dựng lại y nguyên
     người vừa gỡ. Kết quả: bấm "Bỏ người cover" xong tên vẫn còn. */
  const tmp={};tmp[key]=clean;
  const gs=Object.keys(clean).length?reqPartyGroups(tmp,kind):[];
  const st=Object.keys(clean).length?reqPartySt(tmp,kind):'';
  if(kind==='with'){
    if(gs.length){r.withId=gs[0].id;r.confirmW=st;}
    else{delete r.withId;delete r.confirmW;}
  }else{
    if(gs.length){r.coverId=gs[0].id;r.coverSt=st;}
    else{delete r.coverId;delete r.coverSt;}
  }
}
/* Đặt người cho MỘT ngày. id rỗng = gỡ ngày đó. */
function reqPartySetDay(r,kind,iso,id){
  const m=reqDayMap(r,kind);
  if(id)m[iso]={id,st:'pending'};
  else delete m[iso];
  reqPartyWrite(r,kind,m);
}
/* Đổi trạng thái của một người — họ bấm Đồng ý / Từ chối.
   iso rỗng = áp cho MỌI ngày người đó phụ trách (nút bấm một phát). */
function reqPartySetSt(r,kind,who,st,iso){
  const m=reqDayMap(r,kind);
  Object.keys(m).forEach(k=>{
    if(m[k].id!==who)return;
    if(iso&&k!==iso)return;
    m[k]={id:who,st};
  });
  reqPartyWrite(r,kind,m);
}

function reqCoverName(r){
  const gs=reqCoverGroups(r);
  if(!gs.length)return '';
  const nm=id=>{const e=empById(id);return shortName((e&&e.name)||id);};
  return gs.length===1?nm(gs[0].id):gs.map(g=>nm(g.id)).join(' · ');
}
/* Ngày rút gọn "19/08" để ghép sau tên người cover */
function reqIsoShort(iso){const p=String(iso||'').split('-');return p.length===3?(p[2]+'/'+p[1]):iso;}
function reqGroupDays(g){return g.isos.map(reqIsoShort).join(', ');}

/* Chip trạng thái cover — dùng cả ở màn Duyệt lẫn "Đơn của tôi".
   Nhiều người thì mỗi người một chip, kèm đúng ngày của họ. */
function reqCoverChip(r){
  const gs=reqCoverGroups(r);
  if(!gs.length)return '';
  const one=gs.length===1;
  const nm=id=>{const e=empById(id);return shortName((e&&e.name)||id);};
  return gs.map(g=>{
    const s=COVER_ST[g.st||'pending']||COVER_ST.pending;
    const days=one?'':(' <u>'+esc(reqGroupDays(g))+'</u>');
    return `<span class="cvw ${s.cls}" title="${t('Người ở lại tăng ca gánh ca thay')}">🤝 ${t('Cover')}: ${esc(nm(g.id))}${days} · ${s.ic} ${t(s.lb)}</span>`;
  }).join(' ');
}
/* Ai được đổi người cover: người duyệt, hoặc chính người làm đơn */
function canSetCover(r,who){
  if(!r||r.type!=='leave')return false;
  if(REQ_DEAD(r.status))return false;
  if(typeof canAppr==='function'&&canAppr())return true;
  return r.empId===who||r.byId===who;
}
/* ------------------------------------------------------------
   Đặt / đổi / gỡ người cover.  newId rỗng = gỡ.
   iso rỗng  → áp cho MỌI ngày của đơn (giữ nguyên hành vi cũ)
   iso có    → chỉ đổi đúng NGÀY đó, các ngày khác giữ người cũ
   ------------------------------------------------------------ */
function reqSetCover(rid,newId,byId,iso){
  const r=S.requests[rid];if(!r)return false;
  const before=reqCoverMap(r);
  const isos=iso?[iso]:reqDays(r).map(d=>d.iso);
  /* Không đổi gì thì thôi — tránh bắn thông báo thừa */
  if(isos.every(k=>((before[k]||{}).id||'')===(newId||'')))return false;

  const after=Object.assign({},before);
  isos.forEach(k=>{ if(newId)after[k]={id:newId,st:'pending'}; else delete after[k]; });
  reqPartyWrite(r,'cover',after);

  /* Ai KHÔNG còn ngày nào trong đơn nữa thì mới thật sự bị "gỡ" và cần báo.
     Người còn ngày khác thì đừng báo — họ vẫn đang cover, báo là gây hoang mang. */
  const stillIn=new Set(Object.keys(after).map(k=>after[k].id));
  const dropped=[...new Set(Object.keys(before).map(k=>before[k].id))].filter(id=>id&&!stillIn.has(id));

  /* Dọn yêu cầu xác nhận đang chờ của người bị gỡ. Đi qua notifDrop để tin đã
     xếp hàng sang Zalo cũng được RÚT — nếu không, người cũ vẫn nhận tin nhắn
     nhờ cover cho một việc đã chuyển sang người khác. Xem js/13-portal.js. */
  const dropOne=who=>{
    if(typeof notifDrop==='function')
      notifDrop(n=>n.reqId===rid&&n.kind==='coverConfirm'&&n.to===who&&n.status==='pending');
    else if(S.notifs)for(const k in S.notifs){const n=S.notifs[k];
      if(n&&n.reqId===rid&&n.kind==='coverConfirm'&&n.to===who&&n.status==='pending')delete S.notifs[k];}
  };
  dropped.forEach(who=>{
    dropOne(who);
    if(typeof newNotif==='function')
      newNotif({kind:'info',to:who,from:byId||'',reqId:rid,zk:'coverRemoved',
        text:t2('đã gỡ bạn khỏi vai trò OT cover')+' · '+fmtVN(r.from)});
  });

  /* Người mới: một việc-chờ-xác-nhận cho MỖI người, không phải mỗi ngày —
     nút Đồng ý của họ áp cho tất cả ngày họ phụ trách. nz:1 nên KHÔNG tốn
     tin Zalo riêng, nội dung đã nằm trong tin "chờ duyệt". */
  if(newId&&typeof newNotif==='function'){
    dropOne(newId);
    const mine=Object.keys(after).filter(k=>after[k].id===newId).sort();
    newNotif({kind:'coverConfirm',to:newId,from:byId||'',reqId:rid,
              iso:mine[0]||r.from,nz:1});
  }
  return true;
}

/* ============================================================
   XÁC NHẬN ĐÃ NHẬP HỆ THỐNG HR CỦA CÔNG TY
   ------------------------------------------------------------
   Đơn duyệt xong trong app vẫn phải được gõ lại vào hệ thống nhân sự
   của công ty (chấm công chính thức). Trước đây không có chỗ nào đánh
   dấu việc đó → in xong tờ đơn rồi vẫn không biết đã nhập HR chưa,
   dễ sót cuối kỳ. Nay mỗi đơn mang thêm 2 trường:
       r.hrAt : mốc thời gian đã nhập (0 / không có = chưa nhập)
       r.hrBy : mã NV người bấm xác nhận
   Chỉ 2 trạng thái — CHƯA NHẬP / ĐÃ NHẬP — và MỌI người dùng đều bấm
   được, vì người gõ HR có thể là thư ký, quản lý hay chính người duyệt.
   Không sinh thông báo, không đụng lịch: đây thuần tuý là dấu tick
   theo dõi, thêm đúng 2 khoá nhỏ vào bản ghi đơn (gói Firebase Spark).
   ============================================================ */
/* ============================================================
   ★ v6.5 — MÀN DUYỆT MỞ CHO MỌI NGƯỜI, NHƯNG CHỈ XEM
   ------------------------------------------------------------
   Trước đây tab Duyệt mang class mgr-only nên nhân viên không vào được, dù
   thứ họ cần chỉ là NHÌN: hôm nào tổ đông người nghỉ, đơn của mình tới đâu,
   in lại tờ đơn của nhóm mình. Nay ai đăng nhập cũng vào được:

     · XEM      — mọi người, mọi đơn
     · IN       — đơn của chính mình và đơn của người CÙNG NHÓM
     · TÍCH HR  — mọi người (người gõ HR có thể là thư ký hay nhân viên)
     · DUYỆT / TỪ CHỐI / HUỶ / ĐỔI NGƯỜI COVER — chỉ người có quyền duyệt

   apprCanAct() là cái chốt duy nhất: mọi nút thay đổi dữ liệu đều hỏi nó,
   nên không có đường vòng nào lọt qua.
   ============================================================ */
function apprCanAct(){return typeof canAppr==='function'&&canAppr();}
/* ============================================================
   ★ v6.7 — AI ĐƯỢC XOÁ ĐƠN CỦA NGƯỜI KHÁC
   ------------------------------------------------------------
   Xoá đơn là thao tác KHÔNG HOÀN TÁC: đơn biến mất khỏi Firebase và khỏi
   mọi tài khoản, kèm bia mộ nên không dựng lại được. Trước đây mọi người
   có quyền vào màn Duyệt (mgr HOẶC Field Engineer của nhóm) đều bấm được
   nút xoá hàng loạt — quá rộng so với hệ quả.
   Nay chỉ ba vai trò giữ sổ sách: Quản trị (admin), Thư ký (sec), Quản lý
   người Hàn (kmgr). Field Engineer và Section Chief vẫn duyệt / từ chối /
   in như cũ, chỉ không xoá.
   Nhân viên vẫn tự rút được ĐƠN CỦA CHÍNH MÌNH khi chưa in — xem
   canCancelReq() ngay dưới. ============================================ */
const PURGE_PERMS=['admin','kmgr','sec'];
function canPurgeReqs(){
  if(typeof permOf!=='function'||typeof meId!=='function')return false;
  return PURGE_PERMS.includes(permOf(meId()));
}
/* In được đơn này không: người duyệt in tất; còn lại chỉ in đơn của mình
   hoặc của người cùng nhóm (tổ trưởng hay cầm tờ đơn đi nộp hộ cả nhóm). */
function canPrintReq(r,who){
  if(!r)return false;
  /* ★ v7.7 — thư ký in được MỌI đơn: chính họ là người in tờ đơn đem nộp
     nhân sự. Trước đây họ rơi vào nhánh "cùng nhóm" nên chỉ in được đơn của
     nhóm Office — đúng cái nhóm ít đơn nhất. */
  if(apprCanAct()||(typeof secr!=='undefined'&&secr))return true;
  who=who||(typeof meId==='function'?meId():'');
  if(!who)return false;
  if(r.empId===who||r.byId===who)return true;
  const a=empById(who), b=empById(r.empId);
  return !!(a&&b&&a.team&&b.team&&a.team===b.team);
}
function reqHrDone(r){return !!(r&&r.hrAt);}
/* Ai được bấm: mọi người đang đăng nhập (theo yêu cầu nghiệp vụ) */
function canSetHr(){return !!meId();}
/* Chip hiển thị — dùng chung cho bảng PC, thẻ mobile và ô chi tiết */
function reqHrChip(r,btn){
  const on=reqHrDone(r);
  const lb=on?'✅ '+t('đã nhập HR'):'○ '+t('chưa nhập HR');
  const who=on?(empById(r.hrBy)||{}).name||r.hrBy||'':'';
  const tip=on?`${t('Đã nhập HR')}: ${fmtDateTime(r.hrAt)}${who?' · '+who:''}`
             : t('Bấm để xác nhận đã nhập vào hệ thống HR công ty');
  if(!btn)return `<span class="hrs ${on?'yes':'no'}" title="${esc(tip)}">${lb}</span>`;
  return `<button type="button" class="hrs ${on?'yes':'no'}" title="${esc(tip)}"
    onclick="event.stopPropagation();toggleReqHr('${r.id}')">${lb}</button>`;
}
/* Bật / tắt dấu đã nhập HR cho MỘT đơn */
function toggleReqHr(id){
  const r=S.requests[id];if(!r)return;
  if(!canSetHr()){toast(t('Bạn cần đăng nhập để đánh dấu'));return;}
  if(reqHrDone(r)){
    if(!confirm(t('Bỏ dấu “đã nhập HR” của đơn này?')))return;
    delete r.hrAt;delete r.hrBy;
  }else{
    r.hrAt=Date.now();r.hrBy=meId()||'';
  }
  save();renderAppr();
  toast(reqHrDone(r)?t('Đã đánh dấu: đã nhập hệ thống HR'):t('Đã bỏ dấu nhập HR'));
}
/* Đánh dấu hàng loạt cho các đơn đang tích chọn ở màn Duyệt */
function markPickedHr(on){
  const ids=(typeof apprPicked==='function')?apprPicked():[];
  if(!ids.length){toast(t('Chưa chọn đơn nào'));return;}
  if(!confirm((on?t('Đánh dấu ĐÃ NHẬP HR cho'):t('Bỏ dấu nhập HR của'))+' '+ids.length+' '+t('đơn')+'?'))return;
  const me=meId()||'',now=Date.now();
  ids.forEach(id=>{
    const r=S.requests[id];if(!r)return;
    if(on){r.hrAt=now;r.hrBy=me;}else{delete r.hrAt;delete r.hrBy;}
  });
  save();renderAppr();
  toast(ids.length+' '+(on?t('đơn đã đánh dấu nhập HR'):t('đơn đã bỏ dấu nhập HR')));
}

/* ============================================================
   HUỶ / XOÁ ĐƠN
   Đơn đã duyệt đã ghi vào lịch thực tế (S.over[...] mang reqId).
   Huỷ đơn thì gỡ đúng những ô lịch do đơn đó sinh ra → lịch trả về
   ca chuẩn; đơn đổi ca gỡ cho CẢ HAI người.
   Huỷ đơn = XOÁ HẲN, không giữ bản ghi 'đã huỷ' — mỗi đơn nằm lại là
   thêm dữ liệu phải đồng bộ, mà gói Firebase Spark tính băng thông.
   ============================================================ */
const REQ_ST_LABEL={pending:'CHỜ DUYỆT',approved:'ĐÃ DUYỆT',rejected:'TỪ CHỐI'};
const REQ_DEAD=st=>st==='rejected';
/* ============================================================
   ★ v7.9 — SECTION CHIEF DUYỆT LÀ XONG VIỆC
   ------------------------------------------------------------
   Chuỗi duyệt vẫn là FE › Section Chief › Quản lý người Hàn, và cấp cuối
   vẫn ghi nhận được. Nhưng thực tế vận hành: Quản lý người Hàn gần như
   không mở app, nên mọi đơn dừng ở nhãn "TẠM DUYỆT (chờ Quản lý người Hàn
   chốt)" — nhân viên đọc thành "đơn của tôi CHƯA xong", rồi hỏi lại, rồi
   lo. Trong khi lịch thực tế ĐÃ được ghi và người ta đã đi làm theo nó.

   Nên đổi cách NÓI, không đổi cơ chế:
     · Với mọi người, đơn qua Section Chief là ĐÃ DUYỆT — hết việc.
     · Phần ghi nhận của Quản lý người Hàn thành một dấu phụ, chỉ người
       duyệt nhìn thấy (reqEndorseNote), và nói theo hướng trân trọng
       "chờ ghi nhận" chứ không phải "chưa được duyệt".
   Xem thêm khối notifyReqParties() và js/21-notify.js (kênh 'finalNote').
   ============================================================ */
function reqStatusLabel(r){
  if(!r)return '';
  if(r.status==='rejected')return t('TỪ CHỐI');
  /* Không còn nhãn "TẠM DUYỆT": qua cấp Section Chief là ĐÃ DUYỆT */
  if(r.status==='approved')return t('ĐÃ DUYỆT');
  const nx=typeof reqNextLevel==='function'?reqNextLevel(r):null;
  const someDone=r.appr&&Object.keys(r.appr).some(k=>r.appr[k]&&!r.appr[k].reject);
  if(nx&&someDone)return t('CHỜ')+' '+lvlLabel(nx);
  return t('CHỜ DUYỆT');
}
/* Dấu phụ "còn chờ Quản lý người Hàn ghi nhận" — CHỈ hiện cho người có
   quyền duyệt. Nhân viên không cần biết chi tiết nội bộ của chuỗi duyệt. */
function reqEndorseNote(r){
  if(!r||r.status!=='approved'||!reqIsProvisional(r))return '';
  if(!apprCanAct())return '';
  return t('chờ Quản lý người Hàn ghi nhận');
}
function reqStatusClass(r){
  if(!r)return '';
  if(r.status==='approved'&&reqIsProvisional(r))return 'prov';
  return r.status;
}
/* Dải các cấp trong chuỗi duyệt: ✓ đã duyệt (⤷ duyệt theo) · ⏳ đang chờ · ✕ từ chối */
function apprChainHtml(r){
  if(typeof reqChain!=='function')return '';
  const ch=reqChain(r),ap=r.appr||{};
  if(!ch.length)return '';
  const parts=ch.map(k=>{
    const a=ap[k];
    let cls='wait',ic='⏳';
    if(a&&a.reject){cls='rej';ic='✕';}
    else if(a){cls=a.cascade?'casc':'ok';ic=a.cascade?'⤷':'✓';}
    return `<span class="chn ${cls}" title="${a?(a.reject?t('từ chối'):(a.cascade?t('duyệt theo'):t('đã duyệt'))):t('đang chờ')}">${ic} ${esc(lvlLabel(k))}</span>`;
  });
  return `<div class="appr-chain">${parts.join('<span class="chn-sep">›</span>')}</div>`;
}

/* Gỡ mọi ô lịch do đơn này tạo ra. Trả về số ô đã hoàn tác. */
function revertReqSchedule(rid){
  let n=0;
  for(const empId in S.over){
    const m=S.over[empId]||{};
    for(const iso in m){
      if(m[iso]&&m[iso].reqId===rid){delete m[iso];n++;}
    }
  }
  return n;
}
/* Ai được huỷ đơn nào */
function canCancelReq(r,who){
  if(!r)return false;
  if(canPurgeReqs())return true;             // quản trị / thư ký / quản lý Hàn: huỷ được mọi đơn
  if(r.empId!==who&&r.byId!==who)return false;
  if(r.printedAt)return false;               // đã in nộp nhân sự → nhờ quản lý huỷ
  return r.status==='pending'||r.status==='approved';
}
/* HUỶ ĐƠN = XOÁ HẲN.
   Không giữ lại bản ghi "đã huỷ": mỗi đơn nằm lại là thêm dữ liệu phải đồng bộ
   qua Firebase, mà gói Spark tính băng thông — đơn đã huỷ thì không ai tra nữa.
   Nếu đơn đã duyệt thì gỡ luôn các ô lịch do nó tạo ra (đổi ca gỡ cho cả 2 người). */
function cancelReq(rid,notify){
  const r=S.requests[rid];if(!r)return null;
  const reverted=(r.status==='approved')?revertReqSchedule(rid):0;
  // Báo các bên liên quan TRƯỚC khi xoá (info notif không gắn dọn ở dưới)
  if(notify&&typeof notifyReqParties==='function')notifyReqParties(r,'cancelled',meId());
  delete S.requests[rid];
  /* Dọn mọi VIỆC CHỜ XÁC NHẬN gắn đơn này (đổi ca / OT cover / đổi lịch) và
     rút luôn tin còn nằm trong hàng đợi Zalo — giữ lại các tin 'info' vì
     chúng là lịch sử một chiều, chữ tự đứng được. Xem notifDrop ở 13-portal.js. */
  if(typeof notifDropForReq==='function')notifDropForReq(rid);
  else if(S.notifs)for(const k in S.notifs){const n=S.notifs[k];
    if(n.reqId===rid&&(n.kind==='swapConfirm'||n.kind==='schedChange'||n.kind==='coverConfirm'))delete S.notifs[k];}
  return{reverted};
}
/* Giữ tên cũ cho các chỗ đang gọi — nay cùng nghĩa với cancelReq */
function purgeReq(rid){const x=cancelReq(rid);return x?x.reverted:0;}
function codeChip(c){return c?chip(c):'<span class="muted" style="font-weight:700">—</span>';}
// Chi tiết theo từng ngày: hiện ca hiện tại → ca sau khi duyệt để người duyệt thấy rõ.
function wtReasonLabel(r){
  const def=WT_REASONS.find(x=>x.v===r.reasonCode);
  if(!def)return '';
  return def.v==='other'?('Khác: '+(r.reasonOther||'')):(def.vn+' / '+def.en);
}
function reqDetail(r){
  if(r.type==='multi'){
    return `<div class="reqdt"><div class="dt"><span class="dtd">${fmtVN(r.from)} → ${fmtVN(r.to)}</span>
      <span>${t('Giờ vào')}: ${esc(r.timeIn||'')}</span><span>${t('Giờ ra')}: ${esc(r.timeOut||'')}</span></div></div>`;
  }
  const days=reqDays(r);
  if(!days.length)return '';
  const beA=iso=>(r.before&&r.before[iso]!==undefined)?r.before[iso]:eff(r.empId,iso).code;
  /* ★ v6.5 — đối tác đổi ca lấy THEO NGÀY (mỗi ngày có thể một người) */
  const wOf=iso=>reqDayWith(r,iso).id||r.withId||'';
  const beB=iso=>(r.beforeW&&r.beforeW[iso]!==undefined)?r.beforeW[iso]:eff(wOf(iso),iso).code;
  let rows='';
  if(r.type==='wt'){
    const g=r.guarantorId?empById(r.guarantorId):null;
    rows=days.map(d=>`<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
      <span>${esc(d.timeIn||'')} → ${esc(d.timeOut||'')}</span></div>`).join('');
    rows+=`<div class="dt"><span>Lý do: <b>${esc(wtReasonLabel(r))}</b></span>
      ${g?`<span>Người bảo lãnh: <b>${esc(g.name)}</b></span>`:''}</div>`;
  }else if(r.type==='late'){
    const tn=r.subType==='leave_early'?'Về sớm':'Đi trễ';
    rows=days.map(d=>`<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
      <span><b>${tn}</b></span><span>${esc(d.timeIn||'')} → ${esc(d.timeOut||'')}</span></div>`).join('');
  }else if(r.type==='swap'){
    const a=empById(r.empId);
    rows=days.map(d=>{
      const b=empById(wOf(d.iso));
      const ca=beA(d.iso), cb=beB(d.iso);
      return `<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
        <span><b>${esc(a?a.name:'')}</b>: ${codeChip(ca)} → ${codeChip(cb)}</span>
        <span><b>${esc(b?b.name:'')}</b>: ${codeChip(cb)} → ${codeChip(ca)}</span></div>`;
    }).join('');
  }else if(r.type==='ot'){
    rows=days.map(d=>{
      const hrs=d.hours||otNetHours(d.iso,d.timeIn,d.isoEnd,d.timeOut,d.noLunch)||getHours(d.code||'OTD');
      const end=(d.isoEnd&&d.isoEnd!==d.iso)?(' '+fmtVN(d.isoEnd)):'';
      return `<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
        ${codeChip(d.code)}<span>${esc(d.timeIn||'')} → ${esc(d.timeOut||'')}${end}</span>
        <span><b>${rnd1(hrs)}h</b>${d.noLunch?' <i class="nolu">'+t('đã trừ 1h nghỉ trưa')+'</i>':''}</span></div>`;
    }).join('');
  }else{
    rows=days.map(d=>{
      const cur=beA(d.iso);
      return `<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
        <span>${codeChip(cur)} → ${codeChip(d.code)}</span></div>`;
    }).join('');
  }
  /* ★ v6.5 — mỗi người cover một dòng, kèm đúng ngày họ nhận */
  const cvGs=reqCoverGroups(r);
  cvGs.forEach(g=>{
    const cv=empById(g.id), st=COVER_ST[g.st||'pending']||COVER_ST.pending;
    rows+=`<div class="dt"><span>🤝 ${t('Người OT cover')}: <b>${esc((cv&&cv.name)||g.id)}</b>${
      cv&&cv.team?` <i class="muted">${t('Nhóm')} ${esc(cv.team)}</i>`:''}${
      cvGs.length>1?` <i class="muted">${esc(reqGroupDays(g))}</i>`:''}</span>
      <span class="cvw ${st.cls}">${st.ic} ${t(st.lb)}</span></div>`;
  });
  return `<div class="reqdt">${rows}</div>`;
}
function reqDesc(r){
  const e=empById(r.empId);
  const _wg=reqWithGroups(r);
  const w=_wg.length?empById(_wg[0].id):null;
  const nd=r.type==='multi'?0:reqDays(r).length;
  const range=r.type==='multi'
    ? fmtVNfull(r.from)+' → '+fmtVNfull(r.to)
    : (nd<=1?fmtVNfull(r.from):`${nd} ngày (${fmtVNfull(r.from)} → ${fmtVNfull(r.to)})`);
  const tn={leave:'Đăng ký nghỉ',swap:'Đổi ca',ot:'Tăng ca',change:'Đổi mã ca',wt:'Bổ sung công',late:'Đi trễ/Về sớm',multi:'Làm liên tục nhiều ngày'}[r.type]||r.type;
  let body=`<b>${tn}</b> · ${range}`;
  if(w)body+=` · với <b>${esc(w.name)}</b>`;
  if(r.byId&&r.byId!==r.empId){
    const by=empById(r.byId);
    body+=` <span class="src" style="background:#FEF3C7;color:#92400E">✍️ khai hộ bởi ${esc(by?by.name:r.byId)}</span>`;
  }
  body+=reqDetail(r);
  if(r.note)body+=`<div class="muted" style="margin-top:5px">Ghi chú: “${esc(r.note)}”</div>`;
  return {e,body};
}
/* Cảnh báo quân số khi duyệt — đếm TÁCH THEO KHỐI (sản xuất / văn phòng),
   vì hai khối không trực thay ca cho nhau được. Xem js/18-advice.js. */
function apprWarnLine(r){
  if(r.status!=='pending')return '';
  const catOf=c=>c==='D'||c==='SD'||c==='OTD'?'D':(c==='N'||c==='SN'||c==='OTN'?'N':null);
  const pool=poolOfId(r.empId);
  const warnings=[];
  for(const d of reqDays(r)){
    const iso=d.iso;
    const B=mpBuckets(iso,pool);let cD=B.D.length,cN=B.N.length;
    const applyDelta=(fromCode,toCode)=>{const fc=catOf(fromCode),tc=catOf(toCode);if(fc==='D')cD--;if(fc==='N')cN--;if(tc==='D')cD++;if(tc==='N')cN++;};
    const curA=eff(r.empId,iso).code;
    const wid=(r.type==='swap')?(reqDayWith(r,iso).id||r.withId||''):'';
    if(wid){const curB=eff(wid,iso).code;applyDelta(curA,curB);applyDelta(curB,curA);}
    else applyDelta(curA,d.code);
    /* ★ v8.0 — thiếu KỸ SƯ ở một trong hai khung 12 giờ cũng phải cảnh báo,
       kể cả khi đầu người ca D/N vẫn đủ: ba operator không thay được một kỹ
       sư. Người đang đi đào tạo đã bị trừ sẵn trong mpEngWhy(). */
    const engWhy=(typeof mpEngWhy==='function')?mpEngWhy(iso,pool):'';
    if(cD<S.settings.minD||cN<S.settings.minN||engWhy)warnings.push({iso,cD,cN,engWhy});
  }
  if(!warnings.length)return '';
  const w=warnings[0],parts=[];
  if(w.cD<S.settings.minD)parts.push(`${t('ca D còn')} ${w.cD}/${S.settings.minD}`);
  if(w.cN<S.settings.minN)parts.push(`${t('ca N còn')} ${w.cN}/${S.settings.minN}`);
  if(w.engWhy)parts.push(w.engWhy);
  return `<div class="hint" style="background:#FEF2F2;color:#991B1B;margin-top:6px">${t('⚠️ Nếu duyệt: ngày')} ${fmtVN(w.iso)} — ${t('khối')} ${t(POOL_LABEL[pool])} ${parts.join(', ')}${warnings.length>1?` (+${warnings.length-1} ${t('ngày khác)')}`:''}</div>`;
}
/* Nhãn khuyến nghị gọn hiện ngay trên dòng đơn (chưa cần bung chi tiết).
   Chỉ tính cho đơn CHỜ DUYỆT làm người đó vắng ca — các loại khác bỏ qua
   để danh sách 150 dòng không phải tính thừa. */
function apprAdviceBadge(r){
  if(!r||r.status!=='pending')return '';
  if(typeof leaveAdvice!=='function')return '';
  if(r.type!=='leave'&&r.type!=='change')return '';
  const days=reqDays(r)||[];
  if(!days.length)return '';
  const opt=(typeof advOptOfReq==='function')?advOptOfReq(r):null;
  let lv='ok';
  for(const d of days.slice(0,6)){
    if(r.type==='change'&&!advCodeLeavesShift(d.code))continue;
    const a=leaveAdvice(r.empId,d.iso,d.code||'AL8',r.id,opt);
    if(a.level==='block'){lv='block';break;}
    if(a.level==='warn')lv='warn';
  }
  if(lv==='ok')return '';
  return advChip(lv,'appr');
}
/* ============================================================
   MÀN DUYỆT — danh sách gọn, lọc nhanh, bấm để mở chi tiết
   Trước đây mỗi đơn là một thẻ to kèm 5 nút → rối và khó kiểm soát.
   Nay: 1 đơn = 1 dòng (ai · loại · ngày · trạng thái) + 2 nút chính;
   bấm vào dòng mới bung chi tiết từng ngày và các nút phụ.
   ============================================================ */
let apprFilter={status:'pending',print:'__all',hr:'__all',type:'__all',pg:'__all',q:'',
  ym:(typeof curSchedMonth==='function'?curSchedMonth():'__all'),from:'',to:'',flag:''};
/* ============================================================
   ★ v6.8 — LỌC THEO NHÓM VỊ TRÍ (Kỹ sư / Operator / Khác)
   ------------------------------------------------------------
   Người ngồi gõ đơn vào hệ thống HR của công ty làm hộ theo TỪNG NHÓM chứ
   không làm lẫn lộn: xong hết Operator rồi mới sang Kỹ sư. Trước đây phải
   tự dò tên từng người trong danh sách chung — vừa chậm vừa dễ sót.
   Nhóm vị trí lấy từ posGroupOf() ở js/01-core.js (field_eng + boardman =
   kỹ sư · operator = operator · còn lại = khác), tức là DÙNG CHUNG đúng
   cách phân nhóm mà bảng Nhân lực đang dùng — không đẻ thêm khái niệm mới.
   Lựa chọn được nhớ trên máy (không đồng bộ) để mở lại vẫn ở đúng nhóm
   mình đang làm dở. ============================================ */
/* HÀM chứ không phải hằng: hằng sẽ đọc POSG_* ngay lúc nạp file, mà thứ tự
   nạp script chỉ đúng trong trình duyệt — các harness nạp lẻ file này sẽ nổ.
   Gọi lúc vẽ thì lúc đó js/01-core.js chắc chắn đã chạy. */
function pgChips(){
  return [['__all','Mọi vị trí'],[POSG_OPER,'⚙️ Operator'],[POSG_ENG,'🛠️ Kỹ sư'],[POSG_OTHER,'👤 Khác']];
}
const PG_LS_KEY='lpgt_pgFilter';
function pgOfReq(r){
  if(!r)return POSG_OTHER;
  return (typeof posGroupOfId==='function')?posGroupOfId(r.empId):POSG_OTHER;
}
function pgMatch(r,pg){return !pg||pg==='__all'||pgOfReq(r)===pg;}
/* Ba màn (Duyệt · Báo cáo · Nhật ký tăng ca) dùng CHUNG một lựa chọn: người
   đang làm hộ nhóm Operator thì mọi màn đều nên đang ở Operator, không phải
   chỉnh lại ba lần. */
function pgRemember(pg){
  pg=pg||'__all';
  try{localStorage.setItem(PG_LS_KEY,pg);}catch(e){}
  apprFilter.pg=pg;
  try{ if(typeof otlogPg!=='undefined')otlogPg=pg; }catch(e){}
  try{ if(typeof repPg!==   'undefined')repPg   =pg; }catch(e){}
}
function pgRecall(){try{return localStorage.getItem(PG_LS_KEY)||'__all';}catch(e){return '__all';}}
apprFilter.pg=pgRecall();      // nhớ nhóm đang làm dở giữa các phiên
/* Mở/đóng khối bộ lọc nâng cao (mặc định gập cho gọn màn hình điện thoại) */
let apprAdvOpen=false;
/* Dời kỳ đang xem ở màn Duyệt (◀ ▶) */
function apprPeriodShift(delta){
  const base=/^\d{4}-\d{2}$/.test(apprFilter.ym)?apprFilter.ym:curSchedMonth();
  apprSetFilter('ym',schedYmShift(base,delta));
}
/* Tải thêm phạm vi: kỳ này + kỳ trước / cả năm / tất cả */
function apprScopeRecent(){
  const cur=curSchedMonth(),prev=schedYmShift(cur,-1);
  apprFilter.from=periodFor(prev).from;apprFilter.to=periodFor(cur).to;apprFilter.ym='__range';renderAppr();
}
function apprScopeYear(y){
  const r=yearRange(+y||new Date().getFullYear());
  apprFilter.from=r.from;apprFilter.to=r.to;apprFilter.ym='__range';renderAppr();
}
function apprScopeAll(){apprSetFilter('ym','__all');}
let apprOpen={};                       // id đơn đang bung chi tiết

function apprSetFilter(k,v){
  apprFilter[k]=v;
  if(k==='pg')pgRemember(v);
  if(k==='ym'&&v!=='__all'&&v!=='__range'){apprFilter.from='';apprFilter.to='';}
  if(k==='from'||k==='to')apprFilter.ym='__range';
  renderAppr();
}
function apprToggleRow(id){apprOpen[id]=!apprOpen[id];renderAppr();}
/* ★ v7.9 — mở đủ rộng để thấy MỌI đơn còn chờ tay mình: bỏ giới hạn kỳ và
   đưa trạng thái về "chờ duyệt". Giữ nguyên nhóm vị trí (pg) vì đó là "tôi
   đang làm hộ nhóm nào", không phải bộ lọc nhất thời. */
function apprShowOutside(){
  apprFilter.ym='__all';apprFilter.from='';apprFilter.to='';
  /* '__all' chứ không phải 'pending': đơn chờ Quản lý người Hàn GHI NHẬN có
     status 'approved' nhưng vẫn nằm trong danh sách cần tay người duyệt
     (reqNeedsMyAction). Lọc 'pending' sẽ giấu đúng những đơn vừa hứa cho xem. */
  apprFilter.status='__all';apprFilter.q='';apprFilter.flag='';
  apprFilter.type='__all';apprFilter.print='__all';apprFilter.hr='__all';
  renderAppr();
  toast(t('Đang xem tất cả các kỳ'));
}
function apprResetFilter(){
  /* Nhóm vị trí KHÔNG bị reset: đó là "tôi đang làm hộ nhóm nào", không phải
     một điều kiện lọc nhất thời như trạng thái hay từ khoá. */
  apprFilter={status:'pending',print:'__all',hr:'__all',type:'__all',pg:apprFilter.pg||'__all',
              q:'',ym:curSchedMonth(),from:'',to:'',flag:''};
  renderAppr();
}
/* Khoảng ngày đang lọc — trả về [from,to] hoặc null nếu không lọc theo ngày */
function apprRange(){
  if(apprFilter.ym==='__range'){
    const f=apprFilter.from,tt=apprFilter.to;
    if(!f&&!tt)return null;
    return [f||'0000-01-01', tt||'9999-12-31'];
  }
  if(apprFilter.ym&&apprFilter.ym!=='__all'){
    const p=periodFor(apprFilter.ym);
    return [p.from,p.to];
  }
  return null;
}
/* Đơn có dính vào khoảng ngày không (xét mọi ngày trong đơn) */
function reqInRange(r,f,tt){
  if(r.to<f||r.from>tt)return false;
  if(r.type==='multi')return true;
  return reqDays(r).some(d=>d.iso>=f&&d.iso<=tt);
}
/* Đơn còn CHỜ chính người đang đăng nhập xử lý (theo cấp của họ) */
function reqNeedsMyAction(r){
  if(!r||r.status==='rejected')return false;
  if(typeof apprLevelOf!=='function')return r.status==='pending';
  const lvl=apprLevelOf(meId(),r);
  if(!lvl)return false;
  const ap=r.appr||{};
  if(ap[lvl]&&!ap[lvl].reject)return false;               // mình đã duyệt cấp này rồi
  if(r.status==='approved'&&!reqIsProvisional(r))return false; // đã chốt hẳn
  return true;
}
/* Đơn khớp bộ lọc hiện tại */
function apprMatch(r){
  // Field Engineer (không phải quản lý) chỉ thấy đơn mình duyệt được (nhóm mình)
  if(myFE&&!mgr&&!(typeof apprLevelOf==='function'&&apprLevelOf(meId(),r)==='fe'))return false;
  if(apprFilter.status!=='__all'&&r.status!==apprFilter.status)return false;
  if(apprFilter.print==='yes'&&!r.printedAt)return false;
  if(apprFilter.print==='no'&&(r.printedAt||r.noPrint))return false;   // chưa in = chưa in & vẫn cần in
  if(apprFilter.print==='none'&&!r.noPrint)return false;               // không cần in
  /* Đã nhập hệ thống HR công ty hay chưa — ★ v7.8 chỉ còn ĐÚNG HAI trạng thái.
     Chip '⏰ Cần nhập HR' cũ (đã duyệt xong mà chưa gõ HR) đã bỏ: nó là trạng
     thái thứ ba trá hình, người dùng phải nhớ nó khác 'chưa nhập' ở chỗ nào.
     Giá trị 'todo' còn được nhận ở đây để bộ lọc cũ đang lưu trong phiên
     không rơi vào nhánh "không lọc gì" một cách âm thầm. */
  if(apprFilter.hr==='todo')apprFilter.hr='no';
  if(apprFilter.hr==='yes'&&!reqHrDone(r))return false;
  if(apprFilter.hr==='no'&&reqHrDone(r))return false;
  if(apprFilter.type!=='__all'&&r.type!==apprFilter.type)return false;
  // Nhóm vị trí của NGƯỜI ĐỨNG ĐƠN — để người nhập HR làm hộ theo từng nhóm
  if(!pgMatch(r,apprFilter.pg))return false;
  // Lọc theo cờ cảnh báo của bảng Tổng quan (js/17-appr-sum.js)
  if(apprFilter.flag&&typeof asFlagMatch==='function'&&!asFlagMatch(r,apprFilter.flag))return false;
  const rg=apprRange();
  if(rg&&!reqInRange(r,rg[0],rg[1]))return false;
  const q=noAccent(apprFilter.q||'');
  if(q){
    const e=empById(r.empId);
    /* ★ v6.5 — gõ tên BẤT KỲ người cover / người đổi ca nào cũng tìm ra đơn */
    const others=[].concat(reqWithIds(r),reqCoverIds(r))
                   .map(id=>{const x=empById(id);return (x&&x.name)||id;});
    const hay=noAccent([e&&e.name,r.empId,r.note].concat(others).filter(Boolean).join(' '));
    if(!hay.includes(q))return false;
  }
  return true;
}
/* ------------------------------------------------------------
   DÒNG TÓM TẮT NGAY TRÊN DÒNG ĐƠN (chỉ hiện trên PC)
   Màn hình rộng còn dư chỗ, nên đưa thẳng ra ngoài đúng những gì cần để
   BẤM DUYỆT ĐƯỢC LUÔN: từng ngày kèm ca cũ → ca mới, số giờ / số ngày phép,
   lý do nhân viên ghi và người OT cover. Bung chi tiết chỉ còn dành cho
   thông tin phụ (chuỗi duyệt, trợ lý duyệt đơn, mốc thời gian, nút phụ).
   ------------------------------------------------------------ */
const AQ_MAX_DAYS=4;                    // quá số ngày này thì gộp "+N ngày"
function apprDayBrief(r,d){
  const beA=iso=>(r.before&&r.before[iso]!==undefined)?r.before[iso]:eff(r.empId,iso).code;
  /* ★ v6.5 — đối tác đổi ca lấy THEO NGÀY (mỗi ngày có thể một người) */
  const wOf=iso=>reqDayWith(r,iso).id||r.withId||'';
  const beB=iso=>(r.beforeW&&r.beforeW[iso]!==undefined)?r.beforeW[iso]:eff(wOf(iso),iso).code;
  const dt=`<b>${fmtVN(d.iso)}</b><em>${dowOf(d.iso)}</em>`;
  if(r.type==='swap')
    return `<span class="aq-d">${dt}${codeChip(beA(d.iso))}<i>⇄</i>${codeChip(beB(d.iso))}</span>`;
  if(r.type==='ot'){
    const h=(typeof reqDayHours==='function')?reqDayHours(d):(d.hours||0);
    const over=(d.isoEnd&&d.isoEnd!==d.iso)?'<i class="ovn">+1</i>':'';
    /* ★ v6.9 — người duyệt phải thấy NGAY vì sao 08:00–20:00 mà chỉ 11h */
    const nl=d.noLunch?'<i class="nolu" title="Đã trừ 1h nghỉ trưa">−1h trưa</i>':'';
    return `<span class="aq-d">${dt}${codeChip(d.code)}<i>${esc(d.timeIn||'')}–${esc(d.timeOut||'')}${over}</i><u>${rnd1(h)}h</u>${nl}</span>`;
  }
  if(r.type==='wt'||r.type==='late')
    return `<span class="aq-d">${dt}<i>${esc(d.timeIn||'')}–${esc(d.timeOut||'')}</i></span>`;
  return `<span class="aq-d">${dt}${codeChip(beA(d.iso))}<i>→</i>${codeChip(d.code)}</span>`;
}
/* Con số quyết định của đơn: giờ tăng ca / số ngày phép / số ngày khai */
function apprMetric(r){
  if(r.type==='leave'){
    const n=(typeof reqLeaveDays==='function')?reqLeaveDays(r):reqDays(r).length;
    return n?`<span class="aq-m lv">${rnd1(n)} ${t('ngày phép')}</span>`:'';
  }
  if(r.type==='ot'){
    const h=(typeof reqHours==='function')?reqHours(r):0;
    return h?`<span class="aq-m ot">${rnd1(h)}h ${t('tăng ca')}</span>`:'';
  }
  if(r.type==='multi')return '';
  const n=reqDays(r).length;
  return n>1?`<span class="aq-m">${n} ${t('ngày')}</span>`:'';
}
function apprQuickHtml(r){
  let days='';
  if(r.type==='multi'){
    days=`<span class="aq-d"><b>${fmtVN(r.from)} → ${fmtVN(r.to)}</b>
      <i>${esc(r.timeIn||'')}–${esc(r.timeOut||'')}</i></span>`;
  }else{
    const list=reqDays(r);
    days=list.slice(0,AQ_MAX_DAYS).map(d=>apprDayBrief(r,d)).join('');
    if(list.length>AQ_MAX_DAYS)days+=`<span class="aq-more">+${list.length-AQ_MAX_DAYS} ${t('ngày')}</span>`;
  }
  const bits=[];
  if(r.type==='wt'&&typeof wtReasonLabel==='function'){
    const wl=wtReasonLabel(r);
    if(wl)bits.push(`<span class="aq-note">${esc(wl)}</span>`);
    if(r.guarantorId){const g=empById(r.guarantorId);
      bits.push(`<span class="aq-note">${t('Bảo lãnh')}: ${esc(shortName((g&&g.name)||r.guarantorId))}</span>`);}
  }
  if(r.note)bits.push(`<span class="aq-note">“${esc(r.note)}”</span>`);
  if(r.reason)bits.push(`<span class="aq-note rej">${t('Lý do từ chối')}: ${esc(r.reason)}</span>`);
  return `<div class="ar-sum pc-only">
    <div class="aq-days">${days}</div>
    <div class="aq-side">${apprMetric(r)}${reqCoverChip(r)}${bits.join('')}</div>
  </div>`;
}
/* Một dòng đơn */
function apprRow(r){
  const e=empById(r.empId);
  const wGs=reqWithGroups(r);
  const w=wGs.length?empById(wGs[0].id):null;
  const wName=wGs.length===1
    ? shortName((w&&w.name)||wGs[0].id)
    : wGs.map(g=>{const x=empById(g.id);return shortName((x&&x.name)||g.id);}).join(' · ');
  const open=!!apprOpen[r.id];
  const days=r.type==='multi'?0:reqDays(r).length;
  const when=r.type==='multi'
    ? fmtVN(r.from)+' → '+fmtVN(r.to)
    : (days<=1?fmtVNfull(r.from):`${fmtVN(r.from)} → ${fmtVN(r.to)} · ${days} ${t('ngày')}`);
  const sub=[when];
  if(wGs.length)sub.push(t('với')+' '+wName);
  if(r.byId&&r.byId!==r.empId)sub.push(t('khai hộ'));
  // Cờ xác nhận đổi ca của người B
  const cfBadge=(r.type==='swap'&&r.confirmW)
    ?`<span class="cfw ${r.confirmW}">${{pending:'⏳ '+t('chờ')+' '+wName+' '+t('xác nhận'),
        confirmed:'✓ '+wName+' '+t('đã xác nhận'),
        declined:'✕ '+wName+' '+t('từ chối')}[r.confirmW]||''}</span>`
    :'';
  return `<div class="ar ${r.status}${open?' open':''}${r.printedAt?' printed':''}">
    <div class="ar-h">
      <label class="ar-ck"><input type="checkbox" class="rqChk" value="${r.id}" onchange="apprPickCount()"></label>
      <span class="ar-ic">${REQ_ICON[r.type]||'📄'}</span>
      <button type="button" class="ar-txt" onclick="apprToggleRow('${r.id}')">
        <span class="l1"><b>${esc(e?e.name:r.empId)}</b>
          <i class="typ">${esc(REQ_LABEL[r.type]||r.type)}</i>
          <span class="st ${reqStatusClass(r)}">${reqStatusLabel(r)}</span>${
            reqEndorseNote(r)?`<span class="endnote" title="${t('Đơn đã duyệt và đã ghi vào lịch. Quản lý người Hàn ghi nhận sau — không chặn việc gì.')}">🧾 ${reqEndorseNote(r)}</span>`:''}
          <span class="prt ${r.printedAt?'yes':(r.noPrint?'none':'no')}">${r.printedAt?'🖨️ '+t('đã in'):(r.noPrint?'🚫 '+t('không in'):'○ '+t('chưa in'))}</span>${
            reqHrDone(r)?`<span class="hrs yes">✅ ${t('đã nhập HR')}</span>`:''}${cfBadge}${
            reqCoverGroups(r).length?`<span class="cvw ${(COVER_ST[reqPartySt(r,'cover')||'pending']||COVER_ST.pending).cls} mob-only">🤝</span>`:''}${apprAdviceBadge(r)}</span>
        <span class="l2">${esc(sub.join(' · '))}</span>
      </button>
      <span class="ar-act">
        ${(apprCanAct()&&r.status!=='rejected'&&!(r.status==='approved'&&!reqIsProvisional(r)))?`<button class="btn ok sm" onclick="decide('${r.id}',true)" title="Duyệt">✓</button>
        <button class="btn warn sm" onclick="decide('${r.id}',false)" title="Từ chối">✕</button>`:''}
        <button type="button" class="ar-more" onclick="apprToggleRow('${r.id}')" title="Chi tiết">▾</button>
      </span>
    </div>
    ${apprQuickHtml(r)}
    <div class="ar-d">
      ${apprChainHtml(r)}
      ${reqDetail(r)}
      ${r.status==='pending'?apprWarnLine(r):''}
      ${open&&typeof reqAdviceHtml==='function'?reqAdviceHtml(r):''}
      ${r.note?`<div class="muted sm2">Ghi chú: “${esc(r.note)}”</div>`:''}
      <div class="ar-meta">
        <span>Gửi: ${fmtDateTime(r.createdAt)}</span>
        ${r.decidedAt?`<span>Duyệt: ${fmtDateTime(r.decidedAt)}</span>`:''}
        ${r.printedAt?`<span>In: ${fmtDateTime(r.printedAt)}${r.printCount>1?' ×'+r.printCount:''}</span>`:''}
        ${r.reason?`<span>Lý do: ${esc(r.reason)}</span>`:''}
        <span class="src ${esc(r.source||'web')}">${{zalo:'Zalo',app:'📱 App NV'}[r.source]||'Web'}</span>
      </div>
      <div class="ar-more-act">
        ${canPrintReq(r,meId())?`<button class="btn sec sm pc-only" onclick="printOne('${r.id}')">🖨️ In</button>`:''}
        ${apprCanAct()?`<button class="btn sec sm" onclick="apprToggleNoPrint('${r.id}')">${r.noPrint?'🖨️ Đưa vào ds in':'🚫 Đánh dấu không cần in'}</button>`:''}
        <button class="btn sec sm" onclick="toggleReqHr('${r.id}')">${reqHrDone(r)?'↩️ '+t('Bỏ dấu nhập HR'):'✅ '+t('Đã nhập hệ thống HR')}</button>
        ${canSetCover(r,meId())?`<button class="btn sec sm" onclick="openCoverPicker('${r.id}')">🤝 ${reqCoverGroups(r).length?t('Đổi người OT cover'):t('Chỉ định người OT cover')}</button>`:''}
        ${apprCanAct()&&r.status==='approved'?`<button class="btn warn sm" onclick="revokeApproval('${r.id}')">↩️ Huỷ duyệt</button>`:''}
        ${canCancelReq(r,meId())?`<button class="btn warn sm" onclick="cancelOneReq('${r.id}')">🚫 Huỷ đơn</button>`:''}
      </div>
    </div>
  </div>`;
}
function reqCard(r,withActs,pick){return apprRow(r);}

/* ============================================================
   GIAO DIỆN DẠNG BẢNG (chỉ PC — mobile giữ dạng thẻ)
   Cùng dữ liệu, cùng bộ lọc, cùng thao tác với dạng thẻ ở trên; chỉ khác
   cách xếp. 11 cột: Ngày gửi · Nhân viên · Tổ · Loại đơn · Ngày áp dụng ·
   Nội dung · Con số · Cover/Với · Trạng thái · In · Thao tác.
   Bấm vào dòng để bung hàng chi tiết (dùng lại reqDetail / apprChainHtml).
   Chỉ dựng MỘT trong hai (bảng HOẶC thẻ) để không sinh checkbox trùng —
   xem apprIsMobile() ở renderApprList().
   ============================================================ */
const AT_MAX_DAYS=3;                     // số ngày hiện trực tiếp trong ô Nội dung
function atTeam(e){return (e&&e.team)?e.team:'—';}
/* Ô "Ngày áp dụng" — gọn, một dòng */
function atWhen(r){
  if(r.type==='multi')return `${fmtVN(r.from)} → ${fmtVN(r.to)}`;
  const n=reqDays(r).length;
  if(n<=1)return `${fmtVN(r.from)} <em>${dowOf(r.from)}</em>`;
  return `${fmtVN(r.from)} → ${fmtVN(r.to)} <em>${n} ${t('ngày')}</em>`;
}
/* Ô "Nội dung" — mã ca / khung giờ, tối đa AT_MAX_DAYS dòng rồi gộp "+N" */
function atContent(r){
  if(r.type==='multi')
    return `<span class="aq-d"><i>${esc(r.timeIn||'')}–${esc(r.timeOut||'')}</i></span>`;
  const list=reqDays(r);
  let h=list.slice(0,AT_MAX_DAYS).map(d=>apprDayBrief(r,d)).join('');
  if(list.length>AT_MAX_DAYS)h+=`<span class="aq-more">+${list.length-AT_MAX_DAYS} ${t('ngày')}</span>`;
  return h;
}
/* Ô "Cover / Đổi với" */
function atPartner(r){
  const bits=[];
  const wGs=reqWithGroups(r);
  wGs.forEach(g=>{
    const w=empById(g.id);
    const days=wGs.length>1?(' <u>'+esc(reqGroupDays(g))+'</u>'):'';
    bits.push(`<span class="at-w">⇄ ${esc(shortName((w&&w.name)||g.id))}${days}</span>`);
    if(g.st)bits.push(`<span class="cfw ${g.st}">${
      {pending:'⏳ '+t('chờ'),confirmed:'✓ '+t('đã xác nhận'),declined:'✕ '+t('từ chối')}[g.st]||''}</span>`);
  });
  if(reqCoverGroups(r).length)bits.push(reqCoverChip(r));
  if(r.type==='wt'&&r.guarantorId){
    const g=empById(r.guarantorId);
    bits.push(`<span class="at-w">🛡️ ${esc(shortName((g&&g.name)||r.guarantorId))}</span>`);
  }
  return bits.length?bits.join(' '):'<span class="muted">—</span>';
}
/* Ô "Con số" — giờ tăng ca / ngày phép / số ngày */
function atMetric(r){
  const m=apprMetric(r);
  return m||'<span class="muted">—</span>';
}
/* Một dòng của bảng + hàng chi tiết đi kèm */
function apprTr(r){
  const e=empById(r.empId);
  const open=!!apprOpen[r.id];
  const canAct=(r.status!=='rejected'&&!(r.status==='approved'&&!reqIsProvisional(r)));
  const nx=(typeof reqNextLevel==='function')?reqNextLevel(r):null;
  return `<tr class="at-r ${r.status}${open?' open':''}${r.printedAt?' printed':''}" data-id="${r.id}">
    <td class="at-ck"><input type="checkbox" class="rqChk" value="${r.id}" onchange="apprPickCount()"></td>
    <td class="at-sent">${fmtVN(isoOfTs(r.createdAt))}<em>${fmtHM(r.createdAt)}</em></td>
    <td class="at-emp" onclick="apprToggleRow('${r.id}')">
      <b>${esc(e?e.name:r.empId)}</b><em>${esc(r.empId)}${r.byId&&r.byId!==r.empId?' · '+t('khai hộ'):''}</em></td>
    <td class="at-team">${esc(atTeam(e))}</td>
    <td class="at-typ" onclick="apprToggleRow('${r.id}')">
      <span class="ar-ic">${REQ_ICON[r.type]||'📄'}</span><i>${esc(REQ_LABEL[r.type]||r.type)}</i></td>
    <td class="at-when" onclick="apprToggleRow('${r.id}')">${atWhen(r)}</td>
    <td class="at-cnt" onclick="apprToggleRow('${r.id}')">${atContent(r)}</td>
    <td class="at-met">${atMetric(r)}</td>
    <td class="at-par">${atPartner(r)}</td>
    <td class="at-st">
      <span class="st ${reqStatusClass(r)}">${reqStatusLabel(r)}</span>
      ${/* ★ v7.9 — đơn đã duyệt mà còn cấp cuối: KHÔNG viết "chờ <cấp>" như
           đơn chưa duyệt, vì việc đã chạy. Viết "chờ ghi nhận", và chỉ người
           duyệt mới thấy dòng này. */''
       }${(r.status==='approved'&&reqEndorseNote(r))
          ?`<em class="at-next soft">🧾 ${esc(reqEndorseNote(r))}</em>`
          :(nx&&r.status!=='approved'?`<em class="at-next">${t('chờ')} ${esc(lvlLabel(nx))}</em>`:'')}
      ${apprAdviceBadge(r)}</td>
    <td class="at-prt">
      <button type="button" class="prt ${r.printedAt?'yes':(r.noPrint?'none':'no')}"
        onclick="apprToggleNoPrint('${r.id}')"
        title="${t('Bấm để đổi giữa Chờ in và Không cần in')}">${
        r.printedAt?'🖨️ '+t('đã in'):(r.noPrint?'🚫 '+t('không in'):'○ '+t('chưa in'))}</button></td>
    <td class="at-hr">${reqHrChip(r,true)}</td>
    <td class="at-act">
      ${canAct?`<button class="btn ok sm" onclick="decide('${r.id}',true)" title="${t('Duyệt')}">✓</button>
      <button class="btn warn sm" onclick="decide('${r.id}',false)" title="${t('Từ chối')}">✕</button>`:''}
      <button type="button" class="ar-more" onclick="apprToggleRow('${r.id}')" title="${t('Chi tiết')}">▾</button>
    </td>
  </tr>
  <tr class="at-d ${open?'open':''}"><td colspan="13">
    <div class="at-dbox">
      ${apprChainHtml(r)}
      ${reqDetail(r)}
      ${r.status==='pending'?apprWarnLine(r):''}
      ${open&&typeof reqAdviceHtml==='function'?reqAdviceHtml(r):''}
      ${r.note?`<div class="muted sm2">${t('Ghi chú')}: “${esc(r.note)}”</div>`:''}
      ${r.reason?`<div class="muted sm2">${t('Lý do từ chối')}: ${esc(r.reason)}</div>`:''}
      <div class="ar-meta">
        <span>${t('Gửi')}: ${fmtDateTime(r.createdAt)}</span>
        ${r.decidedAt?`<span>${t('Duyệt')}: ${fmtDateTime(r.decidedAt)}</span>`:''}
        ${r.printedAt?`<span>${t('In')}: ${fmtDateTime(r.printedAt)}${r.printCount>1?' ×'+r.printCount:''}</span>`:''}
        ${r.hrAt?`<span>${t('Nhập HR')}: ${fmtDateTime(r.hrAt)}${r.hrBy?' · '+esc((empById(r.hrBy)||{}).name||r.hrBy):''}</span>`:''}
        <span class="src ${esc(r.source||'web')}">${{zalo:'Zalo',app:'📱 App NV'}[r.source]||'Web'}</span>
      </div>
      <div class="ar-more-act">
        <button class="btn sec sm" onclick="printOne('${r.id}')">🖨️ ${t('In')}</button>
        <button class="btn sec sm" onclick="apprToggleNoPrint('${r.id}')">${r.noPrint?'🖨️ '+t('Đưa vào ds in'):'🚫 '+t('Đánh dấu không cần in')}</button>
        ${canSetCover(r,meId())?`<button class="btn sec sm" onclick="openCoverPicker('${r.id}')">🤝 ${reqCoverGroups(r).length?t('Đổi người OT cover'):t('Chỉ định người OT cover')}</button>`:''}
        ${r.status==='approved'?`<button class="btn warn sm" onclick="revokeApproval('${r.id}')">↩️ ${t('Huỷ duyệt')}</button>`:''}
        ${canCancelReq(r,meId())?`<button class="btn warn sm" onclick="cancelOneReq('${r.id}')">🚫 ${t('Huỷ đơn')}</button>`:''}
      </div>
    </div>
  </td></tr>`;
}
/* Sắp xếp bảng — bấm tiêu đề cột để đổi. Lưu theo từng người dùng. */
let apprSort=(()=>{try{return JSON.parse(localStorage.getItem(LS+'_apprsort')||'null')||{k:'sent',dir:-1};}
                   catch(e){return {k:'sent',dir:-1};}})();
function apprSetSort(k){
  apprSort=(apprSort.k===k)?{k,dir:-apprSort.dir}:{k,dir:(k==='emp'||k==='team'||k==='typ')?1:-1};
  try{localStorage.setItem(LS+'_apprsort',JSON.stringify(apprSort));}catch(e){}
  renderApprList();
}
function apprSortVal(r,k){
  const e=empById(r.empId);
  switch(k){
    case 'sent': return r.createdAt||0;
    case 'emp':  return String((e&&e.name)||r.empId||'');
    case 'team': return String((e&&e.team)||'');
    case 'typ':  return String(REQ_LABEL[r.type]||r.type||'');
    case 'when': return String(r.from||'');
    case 'met':  return r.type==='ot'?(typeof reqHours==='function'?reqHours(r):0)
                     :(r.type==='leave'?(typeof reqLeaveDays==='function'?reqLeaveDays(r):reqDays(r).length)
                     :reqDays(r).length);
    case 'st':   return String(r.status||'')+(reqIsProvisional(r)?'1':'0');
    case 'prt':  return r.printedAt?2:(r.noPrint?1:0);
    case 'hr':   return reqHrDone(r)?1:0;
    default:     return 0;
  }
}
function apprSortList(list){
  const {k,dir}=apprSort;
  return list.slice().sort((a,b)=>{
    const va=apprSortVal(a,k),vb=apprSortVal(b,k);
    if(typeof va==='string'||typeof vb==='string'){
      const c=String(va).localeCompare(String(vb),'vi');
      return c?c*dir:(b.createdAt||0)-(a.createdAt||0);
    }
    return (va===vb)?((b.createdAt||0)-(a.createdAt||0)):(va<vb?-dir:dir);
  });
}
const AT_COLS=[
  ['sent','Ngày gửi'],['emp','Nhân viên'],['team','Tổ'],['typ','Loại đơn'],
  ['when','Ngày áp dụng'],[null,'Nội dung'],['met','Con số'],[null,'Cover / Đổi với'],
  ['st','Trạng thái'],['prt','In'],['hr','HR'],[null,'']
];
function apprTableHtml(list){
  const th=AT_COLS.map(([k,lb])=>k
    ? `<th class="srt${apprSort.k===k?' on':''}" onclick="apprSetSort('${k}')">${t(lb)}<i>${
        apprSort.k===k?(apprSort.dir>0?'▲':'▼'):'⇅'}</i></th>`
    : `<th>${lb?t(lb):''}</th>`).join('');
  /* Bề rộng cột khai cứng bằng colgroup + table-layout:fixed → bảng LUÔN vừa
     đúng bề ngang màn hình, không bao giờ đẻ ra thanh cuộn ngang. Ô nào chữ
     dài thì xuống dòng trong ô, chứ không đẩy cả bảng ra ngoài. */
  return `<div class="at-wrap">
    <table class="at">
      <colgroup><!-- cộng lại đúng 100% → không thừa, không thiếu chỗ nào -->
        <col style="width:2.4%">   <!-- ☑ -->
        <col style="width:5%">     <!-- Ngày gửi -->
        <col style="width:11%">    <!-- Nhân viên -->
        <col style="width:3.2%">   <!-- Tổ -->
        <col style="width:7.5%">   <!-- Loại đơn -->
        <col style="width:8%">     <!-- Ngày áp dụng -->
        <col style="width:16.4%">  <!-- Nội dung -->
        <col style="width:6%">     <!-- Con số -->
        <col style="width:10%">    <!-- Cover / Đổi với -->
        <col style="width:9.5%">   <!-- Trạng thái -->
        <col style="width:5.5%">   <!-- In -->
        <col style="width:8%">     <!-- HR -->
        <col style="width:7.5%">   <!-- Thao tác -->
      </colgroup>
      <thead><tr>
        <th class="at-ck"><input type="checkbox" onchange="apprPickAll(this.checked)" title="${t('Chọn tất cả')}"></th>
        ${th}
      </tr></thead>
      <tbody>${apprSortList(list).map(apprTr).join('')}</tbody>
    </table></div>`;
}
/* Mốc chuyển bảng ↔ thẻ. Trùng với @media(max-width:767px) trong css/app.css. */
function apprIsMobile(){
  try{return window.matchMedia('(max-width:767px)').matches;}catch(e){return false;}
}
/* Quản lý bật/tắt "không cần in" cho một đơn ở màn Duyệt */
function apprToggleNoPrint(id){
  const r=S.requests[id];if(!r)return;
  r.noPrint=!r.noPrint;save();
  renderApprList();
  if(typeof refreshPrintBadge==='function')refreshPrintBadge();
  toast(r.noPrint?t('Đã đánh dấu không cần in'):t('Đã đưa vào danh sách chờ in'));
}

/* =================== DUYỆT =================== */
/* Tab Duyệt chia 3 sub-tab:
     'list'  = danh sách đơn (mặc định)
     'sum'   = bảng Tổng quan cho quản lý (js/17-appr-sum.js)
     'otlog' = Nhật ký tăng ca (chuyển từ tab Báo cáo sang, js/15-report.js)
   Nhật ký tăng ca vốn nằm ở tab Báo cáo nhưng bản chất là hồ sơ phê duyệt
   tăng ca, để chung với màn Duyệt thì người duyệt tra cứu liền tay hơn. */
const APPR_TABS=['list','otlog','sum','stats','chart'];
/* ------------------------------------------------------------
   SUB-TAB TẠM ẨN — HIỆN TẠI CHƯA SỬ DỤNG
   'sum'   = 📊 Tổng quan phê duyệt (js/17-appr-sum.js)
   'chart' = 📈 Biểu đồ (repChartPanel trong js/15-report.js)
   Nghiệp vụ chưa dùng tới hai màn này nên ẩn khỏi thanh sub-tab cho gọn.
   TOÀN BỘ CODE VẪN GIỮ NGUYÊN — muốn bật lại chỉ cần xoá tên khỏi mảng dưới
   đây, không phải sửa gì thêm. Bộ lọc theo cờ rủi ro (apprFilter.flag) và các
   hàm asFlagMatch/AS_FLAGS vẫn hoạt động bình thường.
   ------------------------------------------------------------ */
const APPR_TABS_OFF=['sum','chart'];
const apprTabOn=v=>APPR_TABS.includes(v)&&!APPR_TABS_OFF.includes(v);
let apprTab=(()=>{try{const v=localStorage.getItem(LS+'_apprtab');return apprTabOn(v)?v:'list';}catch(e){return 'list';}})();
function apprSetTab(v){
  apprTab=apprTabOn(v)?v:'list';
  try{localStorage.setItem(LS+'_apprtab',apprTab);}catch(e){}
  renderAppr();
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderApprTabs(){
  const box=$('apprTabs');if(!box)return;
  /* Nhân viên thường & FE: chỉ có Danh sách đơn. Các sub-tab còn lại là
     số liệu điều hành của cả tổ.
     ★ v7.7 — mốc phân chia đổi từ `mgr` sang `secr`: THƯ KÝ không duyệt đơn
     nhưng vẫn phải xem được Tổng quan / Bảng công tổng hợp / Biểu đồ / Nhật ký
     tăng ca, vì làm bảng công cả tổ là việc của họ. */
  const feOnly=!secr;
  const nPend=feOnly
    ? Object.values(S.requests||{}).filter(reqNeedsMyAction).length
    : Object.values(S.requests||{}).filter(r=>r&&r.status==='pending').length;
  const tabs=(feOnly?[['list','📋 '+t('Danh sách đơn'),nPend]]
                   :[['list','📋 '+t('Danh sách đơn'),nPend],
                     ['otlog','🗂 '+t('Nhật ký tăng ca'),0],
                     ['sum','📊 '+t('Tổng quan'),0],
                     ['stats','🧾 '+t('Bảng công tổng hợp'),0],
                     ['chart','📈 '+t('Biểu đồ'),0]])
    .filter(([k])=>!APPR_TABS_OFF.includes(k));
  box.innerHTML=tabs
    .map(([k,l,n])=>`<button class="aptab${apprTab===k?' on':''}" onclick="apprSetTab('${k}')">${l}${n?`<i>${n}</i>`:''}</button>`).join('')
    +(feOnly?'':`<span class="aptab-off" title="${t('Đã ẩn khỏi thanh sub-tab, code vẫn giữ để bật lại khi cần')}">📊 ${t('Tổng quan')} · 📈 ${t('Biểu đồ')}: ${t('hiện tại chưa sử dụng')}</span>`);
  const set=(id,on)=>{const el=$(id);if(el)el.style.display=on?'':'none';};
  set('apprSum',   apprTab==='sum');
  set('apprStats', apprTab==='stats');
  set('apprChart', apprTab==='chart');
  set('apprOtlog', apprTab==='otlog');
  set('apprListWrap', apprTab==='list');
}
function renderAppr(){
  const lock=$('apprLock'),body=$('apprBody');
  if(!lock||!body)return;
  /* Mở cho mọi người đã đăng nhập — nội dung tự giới hạn theo apprCanAct() */
  const ok=!!meId();
  lock.style.display=ok?'none':'';
  body.style.display=ok?'':'none';
  if(!ok)return;
  // Field Engineer (không phải quản lý) và nhân viên thường: chỉ Danh sách đơn
  if(!secr)apprTab='list';
  if(!apprTabOn(apprTab))apprTab='list';        // sub-tab đã tắt (xem APPR_TABS_OFF)
  renderApprTabs();
  // Chỉ dựng đúng sub-tab đang mở — khỏi tính thừa
  if(apprTab==='sum'){if(typeof asRender==='function')asRender();return;}
  if(apprTab==='stats'){
    const box=$('apprStats');
    if(box&&typeof repStatsPanel==='function')box.innerHTML=repStatsPanel();
    return;
  }
  if(apprTab==='chart'){
    const box=$('apprChart');
    if(box&&typeof repChartPanel==='function')box.innerHTML=repChartPanel();
    return;
  }
  if(apprTab==='otlog'){
    const box=$('apprOtlog');
    if(box&&typeof repOtLog==='function')box.innerHTML=repOtLog();
    return;
  }
  const all=Object.values(S.requests).sort((a,b)=>b.createdAt-a.createdAt);
  /* Đếm theo từng chip: giữ nguyên các bộ lọc khác để con số phản ánh đúng */
  const countWith=(k,v)=>{
    const save=apprFilter[k];apprFilter[k]=v;
    const n=all.filter(apprMatch).length;apprFilter[k]=save;return n;
  };
  const stChips=[['pending','⏳ Chờ duyệt'],['approved','✅ Đã duyệt'],['rejected','❌ Từ chối'],['__all','Tất cả']];
  const prChips=[['__all','Mọi đơn'],['no','○ Chờ in'],['none','🚫 Không in'],['yes','🖨️ Đã in']];
  /* Hàng chip thứ 3: đã gõ vào hệ thống HR của công ty hay chưa.
     ★ v7.8 — HR chỉ có HAI trạng thái: chưa lên hệ thống HR / đã lên. Chip
     '⏰ Cần nhập HR' đã bỏ vì nó đẻ ra trạng thái thứ ba trong đầu người dùng
     ("cần nhập" khác "chưa nhập" chỗ nào?) trong khi dữ liệu chỉ có r.hrAt. */
  const hrChips=[['__all','Mọi đơn'],['no','○ Chưa lên hệ thống HR'],['yes','✅ Đã lên hệ thống HR']];
  const ms=monthsAvailable();
  const isRange=apprFilter.ym==='__range';
  const curYm=curSchedMonth();

  // Đang lọc theo một cảnh báo của bảng Tổng quan → nói rõ, kèm nút gỡ
  const fl=apprFilter.flag&&typeof AS_FLAGS!=='undefined'
    ? AS_FLAGS.find(f=>f[0]===apprFilter.flag):null;

  // Đang uỷ quyền phê duyệt cấp cuối → nói rõ ở đầu màn Duyệt cho mọi người biết
  const kd=(typeof kmgrDelegate==='function')?kmgrDelegate():null;

  /* ============================================================
     ★ v7.9 — ĐƠN CẦN BẠN DUYỆT NHƯNG NẰM NGOÀI BỘ LỌC ĐANG XEM
     ------------------------------------------------------------
     Huy hiệu đỏ trên tab Duyệt đếm TOÀN BỘ đơn còn chờ tay người đang đăng
     nhập, không xét kỳ. Danh sách bên dưới thì lọc theo kỳ đang chọn. Hai
     con số vì thế lệch nhau một cách hợp lý — nhưng người dùng chỉ thấy
     "huy hiệu bảo có 13, danh sách có 11", và kết luận là app đếm sai hoặc
     nuốt đơn. Hay gặp nhất với đơn tăng ca do XẾP ĐÀO TẠO sinh ra: buổi học
     thường rơi vào kỳ sau, nên đơn nằm ở kỳ mà màn Duyệt chưa mở tới.

     Chữa bằng cách nói thẳng: còn N đơn ở ngoài chỗ đang xem, kèm nút mở
     rộng bộ lọc. Không tự đổi bộ lọc giúp người dùng — họ đang xem kỳ đó có
     lý do của họ.
     ============================================================ */
  const outside=(typeof reqNeedsMyAction==='function'&&apprCanAct())
    ? all.filter(r=>reqNeedsMyAction(r)&&!apprMatch(r)) : [];
  const outNext=outside.map(r=>r.from).filter(Boolean).sort()[0]||'';

  $('apprBar').innerHTML=`
    ${kd?`<div class="ab-flag kd-flag">🔑 ${t('Đang uỷ quyền phê duyệt cấp cuối cho')}
        <b>${esc(kmgrDelegateLabel())}</b>${kd.note?` · ${esc(kd.note)}`:''}
        ${adm?`<button class="btn sec sm" onclick="go('data');setTimeout(()=>{const c=$('kdCard');c&&c.scrollIntoView({behavior:'smooth'});},120)">⚙ ${t('Chỉnh')}</button>`:''}
      </div>`:''}
    ${outside.length?`<div class="ab-flag ab-out">📌 ${t('Còn')} <b>${outside.length}</b>
        ${t('đơn cần bạn duyệt nằm ngoài bộ lọc đang xem')}${
          outNext?` · ${t('sớm nhất')} ${fmtVN(outNext)}`:''}
        <button class="btn sec sm" onclick="apprShowOutside()">${t('Xem tất cả')}</button></div>`:''}
    ${fl?`<div class="ab-flag">🔎 ${t('Đang xem riêng nhóm')}: <b>${fl[1]} ${t(fl[2])}</b>
        <button class="btn sec sm" onclick="apprSetFilter('flag','')">✕ ${t('Bỏ lọc này')}</button></div>`:''}
    <div class="ab-period">
      <button class="btn sec sm" onclick="apprPeriodShift(-1)" title="${t('Kỳ trước')}">◀</button>
      <select class="inp sm ab-per-sel" onchange="apprSetFilter('ym',this.value)" title="${t('Kỳ công đang xem')}">
        ${ms.map(m=>`<option value="${m}"${apprFilter.ym===m?' selected':''}>${periodFor(m).slim}</option>`).join('')}
        <option value="__all"${apprFilter.ym==='__all'?' selected':''}>${t('Tất cả các kỳ')}</option>
        <option value="__range"${isRange?' selected':''}>${t('Khoảng ngày tự chọn…')}</option>
      </select>
      <button class="btn sec sm" onclick="apprPeriodShift(1)" title="${t('Kỳ sau')}">▶</button>
      <span class="ab-scope">
        ${apprFilter.ym!==curYm?`<button class="fchip" onclick="apprSetFilter('ym','${curYm}')">${t('Kỳ hiện tại')}</button>`:''}
        <button class="fchip" onclick="apprScopeRecent()">${t('Kỳ này + kỳ trước')}</button>
        <button class="fchip" onclick="apprScopeYear()">${t('Cả năm nay')}</button>
      </span>
    </div>
    ${isRange?`<div class="ab-tools ab-range">
      <label class="fl2">${t('Từ')}</label><input type="date" class="inp sm" value="${apprFilter.from}" onchange="apprSetFilter('from',this.value)">
      <label class="fl2">${t('Đến')}</label><input type="date" class="inp sm" value="${apprFilter.to}" onchange="apprSetFilter('to',this.value)">
    </div>`:''}
    <div class="ab-chips">${stChips.map(([k,l])=>
      `<button class="abc${apprFilter.status===k?' on':''}" onclick="apprSetFilter('status','${k}')">${l}<i>${countWith('status',k)}</i></button>`).join('')}
    </div>
    <div class="ab-chips">${prChips.map(([k,l])=>
      `<button class="abc sm${apprFilter.print===k?' on':''}" onclick="apprSetFilter('print','${k}')">${l}<i>${countWith('print',k)}</i></button>`).join('')}
    </div>
    <div class="ab-chips ab-hr">${hrChips.map(([k,l])=>
      `<button class="abc sm hr${apprFilter.hr===k?' on':''}" onclick="apprSetFilter('hr','${k}')">${l}<i>${countWith('hr',k)}</i></button>`).join('')}
    </div>
    <div class="ab-chips ab-pg">${pgChips().map(([k,l])=>
      `<button class="abc sm pg${apprFilter.pg===k?' on':''}" onclick="apprSetFilter('pg','${k}')" title="${t('Lọc theo vị trí của người đứng đơn — để nhập hộ vào hệ thống HR theo từng nhóm')}">${t(l)}<i>${countWith('pg',k)}</i></button>`).join('')}
    </div>
    <div class="ab-tools">
      <input class="inp sm" id="apprSearchBox" placeholder="Tìm theo tên nhân viên…" value="${esc(apprFilter.q)}"
             oninput="apprFilter.q=this.value;clearTimeout(window._abT);window._abT=setTimeout(renderApprList,200)">
      <select class="inp sm" onchange="apprSetFilter('type',this.value)">
        <option value="__all">${t('Mọi loại đơn')}</option>
        ${Object.keys(REQ_LABEL).map(k=>`<option value="${k}"${apprFilter.type===k?' selected':''}>${esc(REQ_LABEL[k])}</option>`).join('')}
      </select>
      ${(apprFilter.status!=='pending'||apprFilter.print!=='__all'||apprFilter.hr!=='__all'||apprFilter.type!=='__all'||apprFilter.pg!=='__all'||apprFilter.q||apprFilter.flag||apprFilter.ym!==curYm)
        ?`<button class="btn sec sm" onclick="apprResetFilter()">↺ ${t('Bỏ lọc')}</button>`:''}
      <span class="sp"></span>
      <button class="btn sec sm admin-only${apprAdvOpen?' on-adv':''}" onclick="apprAdvOpen=!apprAdvOpen;renderAppr()">⚙ ${t('Công cụ dữ liệu')}</button>
      <button class="btn sm pc-only" style="position:relative" onclick="openPrintBulk()">🖨️ In đơn<span class="bdg" id="printBdgAppr" style="display:none;position:static;margin-left:6px">0</span></button>
    </div>
    <div class="ab-adv" style="${apprAdvOpen?'':'display:none'}">
      <p class="muted sm2">${t('Sao lưu & dọn đơn cũ — luôn xuất Excel trước khi xoá.')}</p>
      <div class="ab-tools">
        <button class="btn sec sm admin-only" onclick="exportRequests(Object.values(S.requests).filter(apprMatch),'LPGT_SaoLuuDon_'+todayIso()+'.xlsx')" title="${t('Chỉ xuất Excel, không xoá')}">⬇️ ${t('Xuất Excel đơn đang lọc')}</button>
        <button class="btn warn sm admin-only" onclick="apprPurgeFiltered()" title="${t('Xuất Excel sao lưu rồi xoá')}">🗑️ ${t('Xuất Excel & xoá (đang lọc)')}</button>
        <button class="btn warn sm admin-only" onclick="apprPurgeYear()" title="${t('Xuất Excel sao lưu rồi xoá')}">🗑️ ${t('Xoá theo năm…')}</button>
      </div>
    </div>`;

  renderApprList();
  refreshPrintBadge();
  if(typeof applyRoleUI==='function')applyRoleUI();
}
/* Chỉ vẽ lại DANH SÁCH đơn (không đụng thanh lọc) — để gõ tìm tên không mất
   con trỏ và không nhảy focus sau mỗi ký tự. Cũng cập nhật số đếm ở các chip. */
function renderApprList(){
  const box=$('apprList');if(!box)return;
  const all=Object.values(S.requests).sort((a,b)=>b.createdAt-a.createdAt);
  const list=all.filter(apprMatch);
  const show=list.slice(0,150);
  /* PC = bảng, điện thoại = thẻ. Chỉ dựng MỘT dạng để không sinh checkbox
     trùng mã đơn (apprPicked/apprPickCount đọc theo .rqChk). */
  box.innerHTML=list.length
    ? (apprIsMobile()
        ? `<div class="ar-list">${show.map(apprRow).join('')}</div>`
        : apprTableHtml(show))
      +(list.length>150?`<p class="muted sm2" style="margin-top:8px">${t('Đang hiện 150 đơn mới nhất trong')} ${list.length} ${t('đơn khớp bộ lọc.')}</p>`:'')
    : `<div class="card"><p class="muted">${t('Không có đơn nào khớp bộ lọc.')}</p></div>`;
  apprPickCount();
}
/* Đổi chiều màn hình (xoay điện thoại / kéo cửa sổ) qua mốc 767px thì dựng
   lại đúng một lần — tránh kẹt ở dạng không hợp với bề ngang hiện tại. */
(function watchApprLayout(){
  let wasMob=null;
  const check=()=>{
    const m=(typeof apprIsMobile==='function')&&apprIsMobile();
    if(wasMob===null){wasMob=m;return;}
    if(m!==wasMob){wasMob=m;
      if($('apprList')&&$('apprList').innerHTML)renderApprList();}
  };
  try{window.addEventListener('resize',()=>{clearTimeout(window._alT);window._alT=setTimeout(check,180);});}catch(e){}
})();

/* ---- SAO LƯU EXCEL rồi mới XOÁ ----
   Trước khi xoá đơn (theo kỳ / nhiều kỳ / năm) BẮT BUỘC xuất file Excel sao lưu.
   Giữ dung lượng Firebase gói Spark thấp mà vẫn còn hồ sơ tra cứu offline. */
function reqExcelRow(r){
  const e=empById(r.empId);
  const nmOf=id=>{const x=empById(id);return (x&&x.name)||id;};
  const wGs=reqWithGroups(r);
  const w=wGs.length?{name:(wGs.length===1?nmOf(wGs[0].id)
          :wGs.map(g=>nmOf(g.id)+' ('+reqGroupDays(g)+')').join('; '))}:null;
  const days=(r.type==='multi')
    ? fmtVNfull(r.from)+'→'+fmtVNfull(r.to)
    /* ★ v6.9 — đánh dấu ngày đã trừ nghỉ trưa ngay trong ô "Ngày (mã)", để
       người đối chiếu với hệ thống HR không phải hỏi vì sao lệch 1 giờ. */
    : reqDays(r).map(d=>fmtVN(d.iso)+(d.code?'('+d.code+')':'')+(d.noLunch?'[-1h trưa]':'')).join('; ');
  const hrs=(typeof reqHours==='function')?rnd1(reqHours(r)):'';
  return [schedMonthOf(r.from),(e&&e.name)||r.empId,r.empId,(e&&e.team)||'',
    REQ_LABEL[r.type]||r.type,days,w?w.name:'',hrs,
    (reqStatusLabel(r)||'').replace(/<[^>]*>/g,''),r.decidedBy||'',
    r.createdAt?fmtDateTime(r.createdAt):'',r.decidedAt?fmtDateTime(r.decidedAt):'',
    r.printedAt?fmtDateTime(r.printedAt):'',
    r.hrAt?fmtDateTime(r.hrAt):'',r.hrAt?((empById(r.hrBy)||{}).name||r.hrBy||''):'',
    r.reason||'',r.note||''];
}
function exportRequests(list,fname){
  if(typeof XLSX==='undefined'){toast(t('Thiếu thư viện Excel'));return false;}
  const head=['Kỳ công','Họ tên','Mã NV','Nhóm','Loại đơn','Ngày (mã)','Đổi ca với','Giờ',
              'Trạng thái','Người duyệt','Gửi lúc','Duyệt lúc','In lúc',
              'Nhập HR lúc','Người nhập HR','Lý do','Ghi chú'];
  const aoa=[['LPGT CAVERN — SAO LƯU ĐƠN',new Date().toLocaleString('vi-VN')],[],head];
  list.slice().sort((a,b)=>(a.from<b.from?-1:1)).forEach(r=>aoa.push(reqExcelRow(r)));
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:9},{wch:20},{wch:11},{wch:7},{wch:14},{wch:34},{wch:16},{wch:7},{wch:12},{wch:12},
               {wch:18},{wch:18},{wch:18},{wch:18},{wch:16},{wch:20},{wch:20}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Don');
  XLSX.writeFile(wb,fname||('LPGT_SaoLuuDon_'+todayIso()+'.xlsx'));
  return true;
}
function exportThenPurgeReqs(list,label){
  if(!canPurgeReqs()){toast(t('Chỉ Quản trị, Thư ký và Quản lý người Hàn được xoá đơn'));return;}
  list=(list||[]).filter(Boolean);
  if(!list.length){toast(t('Không có đơn nào trong phạm vi này.'));return;}
  const pend=list.filter(r=>r.status==='pending').length;
  if(!confirm(t('Sẽ XUẤT EXCEL sao lưu')+' '+list.length+' '+t('đơn')+' ('+label+') '+t('rồi XOÁ hẳn.')
     +(pend?'\n⚠️ '+t('Trong đó có')+' '+pend+' '+t('đơn đang chờ duyệt.'):'')
     +'\n'+t('Đơn đã duyệt sẽ được hoàn tác khỏi lịch thực tế. Không tra lại được.')))return;
  const okX=exportRequests(list,'LPGT_SaoLuuDon_'+String(label).replace(/[^\w-]/g,'')+'_'+todayIso()+'.xlsx');
  if(!okX&&!confirm(t('Không xuất được Excel. Vẫn tiếp tục xoá?')))return;
  let rev=0;list.forEach(r=>{rev+=purgeReq(r.id);});
  apprAfterDelete(list.length,rev);
}
/* Xoá theo đúng bộ lọc đang xem (kỳ / nhiều kỳ / khoảng ngày) — xuất Excel trước */
function apprPurgeFiltered(){
  const list=Object.values(S.requests).filter(apprMatch);
  const label=apprFilter.ym==='__all'?'MoiKy'
    :apprFilter.ym==='__range'?((apprFilter.from||'')+'-'+(apprFilter.to||''))
    :apprFilter.ym;
  exportThenPurgeReqs(list,label);
}
/* Xoá theo NĂM DƯƠNG — nhập năm, xuất Excel trước */
function apprPurgeYear(){
  if(!canPurgeReqs()){toast(t('Chỉ Quản trị, Thư ký và Quản lý người Hàn được xoá đơn'));return;}
  const y=prompt(t('Xoá đơn theo NĂM (xuất Excel trước) — nhập năm, VD 2025:'),String(new Date().getFullYear()-1));
  if(!y)return;
  const r=yearRange(+y);
  const list=Object.values(S.requests).filter(rq=>reqInRange(rq,r.from,r.to));
  exportThenPurgeReqs(list,'Nam'+y);
}

/* ---- Chọn nhiều đơn để duyệt / từ chối / xoá hàng loạt (màn Duyệt) ---- */
function apprPicked(){return [...document.querySelectorAll('.rqChk:checked')].map(c=>c.value).filter(id=>S.requests[id]);}
function apprPickAll(on){document.querySelectorAll('.rqChk').forEach(c=>{c.checked=!!on;});apprPickCount();}
function apprPickCount(){
  const n=apprPicked().length, box=$('apprBulk');
  if(!box)return;
  if(!n){box.className='appr-bulk';box.innerHTML='';return;}
  box.className='appr-bulk on';
  const act=apprCanAct();
  box.innerHTML=`<b>${n} ${t('đơn đã chọn')}</b>
    ${act?`<button class="btn ok sm" onclick="decidePickedReqs(true)">✓ ${t('Duyệt')}</button>
    <button class="btn warn sm" onclick="decidePickedReqs(false)">✕ ${t('Từ chối')}</button>`:''}
    <button class="btn sec sm pc-only" onclick="printPickedReqs()">🖨️ ${t('In')}</button>
    <button class="btn sec sm" onclick="markPickedHr(true)">✅ ${t('Đã nhập HR')}</button>
    <button class="btn sec sm" onclick="markPickedHr(false)">↩️ ${t('Bỏ dấu HR')}</button>
    ${canPurgeReqs()?`<button class="btn warn sm" onclick="cancelPickedReqs()">🗑️ ${t('Xoá đơn')}</button>`:''}
    <span class="sp"></span>
    <button class="btn sec sm" onclick="apprPickAll(true)">${t('Chọn hết')}</button>
    <button class="btn sec sm" onclick="apprPickAll(false)">${t('Bỏ chọn')}</button>`;
  if(typeof applyRoleUI==='function')applyRoleUI();
}
function apprAfterChange(msg,cb){
  save(cb);renderAppr();
  if(typeof renderCal==='function'&&curView==='cal')renderCal();
  if(typeof renderMe==='function')renderMe(true);
  refreshBadge();
  if(typeof refreshPrintBadge==='function')refreshPrintBadge();
  if(msg)toast(msg);
}
/* ============================================================
   ★ v6.7 — XOÁ ĐƠN PHẢI CÓ MÁY CHỦ XÁC NHẬN
   ------------------------------------------------------------
   Firebase là nguồn duy nhất, nên "đã xoá" chỉ đúng khi FIREBASE đã xoá.
   Trước đây app xoá trong bộ nhớ, gọi save() rồi toast "Đã xoá" ngay lập
   tức — không hề chờ máy chủ. Lệnh ghi trượt (khoá bia mộ sai định dạng,
   rớt mạng, sai luật) thì màn hình vẫn báo xong, còn máy chủ giữ nguyên
   đơn; mở lại là đơn "hồi sinh". Đó là toàn bộ câu chuyện của lỗi này.
   apprAfterDelete chỉ báo Đã xoá khi Firebase gật đầu; trượt thì nói thẳng
   là CHƯA xoá và app tự thử lại nền (xem fbRetry ở js/02-storage.js).
   ============================================================ */
function apprAfterDelete(nDel,revN){
  apprAfterChange('',ok=>{
    if(ok){
      toast(t('Đã xoá')+' '+nDel+' '+t('đơn')+' — '+t('máy chủ đã xác nhận')
            +(revN?' · '+t('hoàn tác')+' '+revN+' '+t('ô lịch'):''));
    }else{
      /* KHÔNG gọi fbReconcile ở đây. Reconcile lấy máy chủ làm chuẩn nên sẽ
         DẸP luôn lệnh xoá đang chờ gửi lại, thành ra vừa không xoá được vừa
         mất cơ hội thử lại. Cứ để fbRetry gửi lại; đèn đồng bộ trên thanh
         tiêu đề đang đứng ở "Chưa gửi được — đang thử lại" nên người dùng
         thấy rõ, và nếu đóng tab thì mở lại là thấy đơn còn nguyên (đúng sự
         thật) chứ không mất dữ liệu. */
      alert('⚠️ '+t('CHƯA xoá được trên máy chủ — app đang tự gửi lại. Đừng tắt tab, và kiểm tra lại sau vài giây.'));
    }
  });
}
/* Duyệt / từ chối hàng loạt */
function decidePickedReqs(ok){
  const all=apprPicked().map(id=>S.requests[id]).filter(Boolean);
  // Duyệt: bỏ qua đơn đã chốt hẳn (approved & không phải tạm duyệt). Từ chối: mọi đơn chưa bị từ chối.
  const ids=all.filter(r=>ok
      ?(r.status!=='rejected'&&!(r.status==='approved'&&!reqIsProvisional(r)))
      :(r.status!=='rejected')).map(r=>r.id);
  if(!ids.length){toast(t('Không có đơn phù hợp trong danh sách đã chọn'));return;}
  if(!confirm((ok?t('Duyệt'):t('Từ chối'))+' '+ids.length+' '+t('đơn đã chọn?')))return;
  let reason='';
  if(!ok)reason=prompt(t('Lý do từ chối (tuỳ chọn):'))||'';
  ids.forEach(id=>decide(id,ok,true,reason));
  apprAfterChange((ok?t('Đã xử lý duyệt'):t('Đã từ chối'))+' '+ids.length+' '+t('đơn'));
}
/* Câu xác nhận trước khi xoá */
function cancelWarnText(list){
  const approved=list.filter(r=>r.status==='approved').length;
  const printed =list.filter(r=>r.printedAt).length;
  let m=t('Xoá hẳn')+' '+list.length+' '+t('đơn đã chọn?');
  if(approved)m+='\n• '+approved+' '+t('đơn đã duyệt — lịch thực tế sẽ trả về ca chuẩn.');
  if(printed) m+='\n• ⚠️ '+printed+' '+t('đơn đã in nộp nhân sự — nhớ báo lại phòng nhân sự.');
  m+='\n'+t('Đơn xoá rồi không tra lại được.');
  return m;
}
function cancelOneReq(rid){
  const r=S.requests[rid];if(!r)return;
  if(!canCancelReq(r,meId())){toast(t('Bạn không có quyền xoá đơn'));return;}
  if(!confirm(cancelWarnText([r])))return;
  const x=cancelReq(rid,true);
  apprAfterDelete(1,x?x.reverted:0);
}
function purgeOneReq(rid){cancelOneReq(rid);}
function cancelPickedReqs(){
  if(!canPurgeReqs()){toast(t('Chỉ Quản trị, Thư ký và Quản lý người Hàn được xoá đơn'));return;}
  const ids=apprPicked();
  if(!ids.length){toast(t('Chưa chọn đơn nào'));return;}
  const list=ids.map(id=>S.requests[id]).filter(Boolean);
  if(!confirm(cancelWarnText(list)))return;
  let rev=0;list.forEach(r=>{const x=cancelReq(r.id);if(x)rev+=x.reverted;});
  apprAfterDelete(list.length,rev);
}
function purgePickedReqs(){cancelPickedReqs();}
/* In ngay các đơn đang chọn */
function printPickedReqs(){
  const ids=apprPicked();
  if(!ids.length){toast(t('Chưa chọn đơn nào'));return;}
  const all=ids.map(id=>S.requests[id]).filter(Boolean);
  /* Người không có quyền duyệt chỉ in được đơn của mình và của người cùng
     nhóm — lọc ở đây thay vì chặn cả nút, để họ vẫn in được phần hợp lệ. */
  const list=all.filter(r=>canPrintReq(r,meId()));
  if(!list.length){toast(t('Bạn chỉ in được đơn của mình và của người cùng nhóm'));return;}
  if(list.length<all.length)
    toast(t('Đã bỏ qua')+' '+(all.length-list.length)+' '+t('đơn ngoài nhóm của bạn'));
  printRequests(list,'a5');
}
function* dateRange(f,t){let d=new Date(f+'T00:00:00');const e=new Date(t+'T00:00:00');let g=0;while(d<=e&&g++<62){yield isoOf(d);d.setDate(d.getDate()+1);}}
/* Ghi kết quả duyệt vào LỊCH THỰC TẾ (S.over). prov=true → ô lịch đánh dấu
   "tạm duyệt" (chờ cấp cuối chốt). Chỉ gọi MỘT lần khi đơn lần đầu đạt cấp
   Trung; khi chốt cấp cuối thì gọi markReqScheduleFinal() để bỏ cờ tạm. */
function writeReqToSchedule(r,prov){
  const id=r.id;
  const stamp=()=>({reqId:id,by:'approve',at:Date.now(),prov:!!prov});
  if(r.type==='swap'){
    for(const d of reqDays(r)){
      const iso=d.iso;
      /* ★ v6.5 — mỗi ngày có thể đổi với MỘT người khác nhau */
      const wid=reqDayWith(r,iso).id||r.withId||'';
      if(!wid)continue;
      const a=eff(r.empId,iso).code,b=eff(wid,iso).code;
      S.over[r.empId]=S.over[r.empId]||{};S.over[wid]=S.over[wid]||{};
      S.over[r.empId][iso]=Object.assign({code:b||''},stamp());
      S.over[wid][iso]=Object.assign({code:a||''},stamp());
    }
  }else if(r.type==='wt'||r.type==='late'||r.type==='multi'){
    // Đơn giấy tờ thuần — KHÔNG ghi đè lịch ca
  }else if(r.type==='ot'){
    const byDay={};
    reqDays(r).forEach(d=>{
      if(!d.code)return;
      const h=d.hours||otNetHours(d.iso,d.timeIn,d.isoEnd,d.timeOut,d.noLunch)||getHours(d.code);
      const g=byDay[d.iso]||(byDay[d.iso]={hours:0,code:d.code,best:0});
      g.hours+=h;if(h>g.best){g.best=h;g.code=d.code;}
    });
    S.over[r.empId]=S.over[r.empId]||{};
    for(const iso in byDay)
      S.over[r.empId][iso]=Object.assign({code:byDay[iso].code,hours:Math.round(byDay[iso].hours*10)/10},stamp());
  }else{
    for(const d of reqDays(r)){
      if(!d.code)continue;
      S.over[r.empId]=S.over[r.empId]||{};
      S.over[r.empId][d.iso]=Object.assign({code:d.code},stamp());
    }
  }
}
/* Bỏ cờ tạm ở mọi ô lịch do đơn này sinh ra (đã được cấp cuối chốt) */
function markReqScheduleFinal(id){
  for(const empId in S.over){const m=S.over[empId]||{};
    for(const iso in m)if(m[iso]&&m[iso].reqId===id)m[iso].prov=false;}
}
/* Các bên liên quan tới một đơn — để gửi thông báo */
function apprPartyIds(r){
  const s=new Set();
  if(r.empId)s.add(r.empId);
  if(r.byId)s.add(r.byId);
  reqWithIds(r).forEach(id=>s.add(id));
  /* Người được nhờ OT cover CŨNG là một bên liên quan: họ đã sắp xếp để ở lại
     gánh ca, nên đơn bị huỷ / từ chối / huỷ duyệt thì phải được báo. Trước đây
     họ bị bỏ sót, chỉ thấy lời nhờ biến mất mà không hiểu vì sao. */
  reqCoverIds(r).forEach(id=>s.add(id));
  return [...s];
}
/* ============================================================
   BÁO CHO NGƯỜI DUYỆT — "có đơn đang chờ bạn"
   Trước đây app KHÔNG báo gì cho người duyệt; họ chỉ biết khi tự mở tab
   Duyệt đơn. Nay mỗi lần đơn CHUYỂN SANG một cấp mới thì cấp đó được báo:
     tạo đơn        → cấp đầu tiên trong chuỗi + Hoàng Trung
     FE duyệt xong  → Hoàng Trung
     Trung duyệt xong → Quản lý người Hàn (hoặc người đang được uỷ quyền)
   Chỉ NGƯỜI ĐẦU TIÊN trong danh sách được đẩy sang Zalo (nz=0); những
   người còn lại chỉ hiện trong app (nz=1). Lý do: hiện mọi tin Zalo đổ vào
   MỘT chat nhóm, gửi cho 4 người là 4 tin y hệt nhau. Khi nào làm xong
   liên kết 1-1 (ZALO-BOT.md mục 3.3) thì bỏ cờ nz là mỗi người nhận riêng.
   ============================================================ */
function apprLevelRecipients(r,lvl){
  const out=new Set();
  if(!r||!lvl)return [];
  if(lvl==='fe'){
    const emp=empById(r.empId);
    const fe=(emp&&emp.team&&typeof teamFieldEngId==='function')?teamFieldEngId(emp.team):null;
    if(fe&&fe!==r.empId)out.add(fe);
  }else if(lvl==='trung'){
    if(typeof ROOT_ADMIN!=='undefined'&&ROOT_ADMIN&&empById(ROOT_ADMIN))out.add(ROOT_ADMIN);
    (S.employees||[]).forEach(e=>{
      if(!e||e.active===false)return;
      const p=(typeof permOf==='function')?permOf(e.id):'staff';
      if(p==='admin'||p==='appr')out.add(e.id);
    });
  }else if(lvl==='kmgr'){
    (S.employees||[]).forEach(e=>{
      if(e&&e.active!==false&&typeof permOf==='function'&&permOf(e.id)==='kmgr')out.add(e.id);
    });
    const d=(typeof kmgrDelegate==='function')?kmgrDelegate():null;
    if(d&&d.to)out.add(d.to);
  }
  return [...out];
}
/* Câu chữ trong app (tiếng Việt). Chữ nghĩa tin Zalo dựng riêng bằng tiếng
   Anh ở js/21-notify.js — không dùng lại dòng này. */
function apprNeedText(r,lvl){
  const e=empById(r.empId);
  const label=REQ_LABEL[r.type]||r.type;
  const who=(e&&e.name)||r.empId;
  /* ★ v7.9 — lời mời gửi CẤP CUỐI khi đơn đã được Section Chief duyệt:
     không phải "đang chờ duyệt" (việc đã chạy rồi), mà là mời ghi nhận. */
  if(lvl===LVL_FINAL&&r.status==='approved')
    return '🧾 Đơn '+label+' của '+who+' — mời '+lvlLabel(lvl)+' ghi nhận · '+fmtVN(r.from);
  return '📥 Đơn '+label+' của '+who+' đang chờ '+lvlLabel(lvl)+' duyệt · '+fmtVN(r.from);
}
function notifyApprovers(r,byId){
  if(typeof newNotif!=='function'||!r)return 0;
  if(r.status==='rejected')return 0;
  const lvl=(typeof reqNextLevel==='function')?reqNextLevel(r):null;
  if(!lvl)return 0;                                  // đã đủ mọi cấp
  const to=new Set(apprLevelRecipients(r,lvl));
  /* Hoàng Trung luôn nắm được đơn ngay từ lúc phát sinh, kể cả khi cấp đang
     chờ là Field Engineer (yêu cầu trong ZALO-PHUONG-AN.xlsx ô K9). */
  if(lvl==='fe'&&typeof ROOT_ADMIN!=='undefined'&&empById(ROOT_ADMIN))to.add(ROOT_ADMIN);
  let n=0;
  /* Trước đây chỉ người ĐẦU TIÊN trong danh sách được bắn Zalo (nz:1 cho
     những người sau) — mẹo chống trùng thủ công, nhưng mong manh: nếu đúng
     thông báo dẫn đầu ấy bị gỡ (đơn huỷ, đổi cấp duyệt) thì cả nhóm mất tin.
     Nay hộp gửi ở js/21-notify.js tự gộp mọi tin trùng nội dung thành MỘT
     và liệt kê đủ người nhận, nên cứ báo đầy đủ cho từng người. */
  /* ★ v8.1 — MỌI VIỆC CỦA CẤP CUỐI ĐỀU GOM VỀ BẢN TIN 08:00.
     Quản lý người Hàn bận, không đọc từng tin nhắn; cái họ cần là MỘT bản
     review tổng mỗi sáng. Nên mọi tin gửi cấp cuối — dù đơn đang chờ họ
     duyệt hay đã được Section Chief duyệt — đều mang zk 'finalNote' và đi
     kênh 'digest'. Không còn tin "APPROVAL REQUIRED — Final" bắn lẻ.
     Các cấp khác (FE, Section Chief) giữ nguyên 'apprNeed' bắn ngay: họ
     phải xử lý trong ngày, chậm một buổi là lịch trực hỏng. */
  const zk=(lvl===LVL_FINAL)?'finalNote':'apprNeed';
  [...to].forEach(pid=>{
    if(!pid||pid===byId)return;                      // người vừa bấm khỏi tự báo mình
    newNotif({kind:'info',zk:zk,to:pid,from:byId||'',reqId:r.id,lvl:lvl,
              text:apprNeedText(r,lvl)});
    n++;
  });
  return n;
}

function notifyReqParties(r,kind,byId,lvl,extra){
  if(typeof newNotif!=='function')return;
  const label={leave:'nghỉ phép',swap:'đổi ca',ot:'tăng ca',change:'đổi mã ca',
               wt:'bổ sung công',late:'đi trễ/về sớm',multi:'làm liên tục'}[r.type]||r.type;
  const head={
    approved:'✅ Đơn '+label+' đã được DUYỆT chính thức',
    /* ★ v7.9 — Section Chief duyệt = ĐÃ DUYỆT, hết việc. Phần Quản lý người
       Hàn ghi nhận nói ở vế sau, bằng giọng trân trọng chứ không phải một
       điều kiện còn treo. Trước đây câu này mở đầu bằng "🕒 TẠM DUYỆT (chờ
       Quản lý người Hàn chốt)" khiến người nhận tưởng đơn chưa xong. */
    provapproved:'✅ Đơn '+label+' đã được DUYỆT · '+lvlLabel('trung')
                +' · Quản lý người Hàn sẽ ghi nhận sau',
    /* Cấp cuối ghi nhận một đơn vốn đã duyệt — tin nhẹ, chỉ trong app */
    final:'🧾 Quản lý người Hàn đã ghi nhận đơn '+label,
    fe:'☑️ Đơn '+label+' đã được Field Engineer duyệt (chờ cấp trên)',
    rejected:'❌ Đơn '+label+' bị TỪ CHỐI',
    revoked:'↩️ Đơn '+label+' đã bị HUỶ DUYỆT',
    cancelled:'🗑️ Đơn '+label+' đã bị HUỶ'
  }[kind]||('Cập nhật đơn '+label);
  const txt=head+' · '+fmtVN(r.from)+(extra?(' · '+extra):'');
  /* zk = khoá cho ma trận Zalo (js/21-notify.js). 'provapproved' đi CHUNG
     đường với 'approved': với người nhận thì đây LÀ tin duyệt xong, và nhờ
     vậy nó cũng được gom vào bản tin 08:00 như mọi kết quả duyệt khác.
     Khi cấp cuối ghi nhận sau đó ('final') thì KHÔNG bắn Zalo nữa — cùng
     một đơn không báo "đã duyệt" hai lần. */
  const zk=(kind==='provapproved')?'approved':kind;
  apprPartyIds(r).forEach(pid=>{
    if(pid===byId)return;
    newNotif({kind:'info',to:pid,from:byId||'',reqId:r.id,text:txt,zk:zk});
  });
}

/* ============================================================
   DUYỆT NHIỀU CẤP
   Xem chuỗi cấp ở js/01-core.js (reqChain / apprLevelOf / LVL_*).
   - Cấp cao duyệt → cấp dưới tự "duyệt theo" (cascade).
   - Đạt cấp Trung (Hoàng Trung) → TẠM ghi lịch (provisional).
   - Đạt cấp cuối (Quản lý người Hàn) → CHỐT lịch chính thức.
   - Từ chối ở bất kỳ cấp nào → cả đơn bị từ chối, gỡ ô lịch tạm nếu có.
   Đơn CŨ không có chuỗi vẫn chạy: reqChain suy ra động, apprLevelOf mặc
   định coi admin/appr là cấp Trung nên hành xử như trước.
   ============================================================ */
function decide(id,ok,bulk,reasonArg){
  const r=S.requests[id];if(!r)return;
  if(r.status==='rejected'){if(!bulk)toast(t('Đơn đã bị từ chối'));return;}
  const me=meId();
  const lvl=apprLevelOf(me,r);
  if(!lvl){if(!bulk)toast(t('Bạn không có quyền duyệt đơn này'));return;}
  const chain=reqChain(r);
  r.appr=r.appr||{};

  if(!ok){
    const reason=bulk?(reasonArg||''):(prompt(t('Lý do từ chối (tuỳ chọn):'))||'');
    if(r.status==='approved')revertReqSchedule(id);        // gỡ ô lịch tạm/đã ghi
    r.status='rejected';r.reason=reason;r.decidedAt=Date.now();r.decidedBy=me||'manager';
    r.provisional=false;r.appr[lvl]={by:me,at:Date.now(),reject:true};
    /* Đơn bị TỪ CHỐI thì mọi việc chờ xác nhận của nó cũng hết nghĩa: người
       được nhờ OT cover / người được rủ đổi ca không còn gì để bấm. Trước đây
       chỉ HUỶ đơn mới dọn, còn TỪ CHỐI thì lời nhờ nằm treo mãi. */
    if(typeof notifDropForReq==='function')notifDropForReq(id);
    notifyReqParties(r,'rejected',me,lvl,reason);
    if(!bulk){save();renderAppr();if(typeof renderReal==='function')renderReal();
      if(typeof renderMe==='function')renderMe(true);if(typeof refreshBadge==='function')refreshBadge();
      toast(t('Đã từ chối'));}
    return;
  }

  /* ★ v7.9 — CHỤP TRẠNG THÁI TRƯỚC KHI ĐỘNG VÀO r.appr.
     "Đơn này trước lúc bấm đã được Section Chief duyệt chưa?" phải hỏi TRƯỚC
     khi ghi chữ ký mới, vì reqIsProvisional() đọc chính r.appr — hỏi sau thì
     chữ ký vừa ghi làm câu trả lời luôn ra 'không', và cấp cuối ghi nhận lại
     bắn tin "ĐÃ DUYỆT" lần thứ hai cho cả nhà. */
  const wasApproved=r.status==='approved';
  const wasProv=wasApproved&&reqIsProvisional(r);

  // DUYỆT ở cấp lvl — cascade các cấp thấp hơn thành "duyệt theo"
  const ord=LVL_ORD[lvl];
  chain.forEach(k=>{if(LVL_ORD[k]<ord&&(!r.appr[k]||r.appr[k].reject))r.appr[k]={by:me,at:Date.now(),cascade:true};});
  r.appr[lvl]={by:me,at:Date.now()};

  const hasFinal=!!r.appr[LVL_FINAL]&&!r.appr[LVL_FINAL].reject;
  const hasProv =!!r.appr[LVL_PROV]&&!r.appr[LVL_PROV].reject;

  let kind='fe';
  if(hasFinal||hasProv){
    if(!wasApproved)writeReqToSchedule(r,!hasFinal);
    else if(hasFinal)markReqScheduleFinal(id);
    r.status='approved';r.decidedAt=Date.now();r.decidedBy=me||'manager';
    r.provisional=!hasFinal;
    kind=hasFinal?(wasProv?'final':'approved'):'provapproved';
  }else{
    r.status='pending';r.provisional=false;kind='fe';
  }
  notifyReqParties(r,kind,me,lvl);
  /* Đơn chưa đủ cấp → báo cho cấp kế tiếp là tới lượt họ. Đây cũng chính là
     tin Zalo báo "Hoàng Trung đã duyệt, chờ Quản lý người Hàn chốt" — gộp
     chung một tin thay vì bắn thêm tin trạng thái trung gian (quy tắc R1). */
  notifyApprovers(r,me);
  if(bulk)return;
  save();renderAppr();
  if(typeof renderReal==='function')renderReal();
  if(typeof renderMe==='function')renderMe(true);
  if(typeof refreshBadge==='function')refreshBadge();
  toast(hasFinal?(wasProv?t('Đã ghi nhận'):t('Đã duyệt & chốt lịch thực tế'))
       :hasProv?t('Đã duyệt — lịch thực tế đã ghi')
               :t('Đã duyệt cấp Field Engineer — chờ cấp trên'));
}
/* Huỷ DUYỆT một đơn đã duyệt (đưa về chờ duyệt), gỡ ô lịch, báo các bên.
   Cho phép: admin / kmgr / người làm đơn. Khác với Huỷ đơn (xoá hẳn). */
function revokeApproval(id){
  const r=S.requests[id];if(!r)return;
  const me=meId();
  const canRevoke=adm||(apprLevelOf(me,r))||r.empId===me||r.byId===me;
  if(!canRevoke){toast(t('Bạn không huỷ duyệt được đơn này'));return;}
  if(r.status!=='approved'){toast(t('Đơn chưa ở trạng thái đã duyệt'));return;}
  if(r.printedAt&&!adm){toast(t('Đơn đã in nộp nhân sự — nhờ quản lý xử lý'));return;}
  if(!confirm(t('Huỷ duyệt đơn này? Lịch thực tế sẽ trả về ca chuẩn, đơn quay lại trạng thái chờ duyệt.')))return;
  const rev=revertReqSchedule(id);
  r.status='pending';r.provisional=false;r.appr={};
  r.decidedAt=0;r.decidedBy='';
  notifyReqParties(r,'revoked',me);
  save();renderAppr();
  if(typeof renderReal==='function')renderReal();
  if(typeof renderMe==='function')renderMe(true);
  if(typeof refreshBadge==='function')refreshBadge();
  toast(t('Đã huỷ duyệt')+(rev?' · '+t('hoàn tác')+' '+rev+' '+t('ô lịch'):''));
}
