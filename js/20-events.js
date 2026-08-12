/* ============================================================
   SỰ KIỆN TRÊN LỊCH  (S.events)
   LPGT Cavern — Quan ly Cong Ca
   ------------------------------------------------------------
   Nhà máy có những ngày đặc biệt cả tổ cần biết trước: nhập tàu,
   bảo dưỡng lớn, kiểm định, đoàn kiểm tra… Trước đây quản lý phải
   nhắn tay từng nhóm. Nay đánh dấu thẳng trên lịch:

     · Chọn MỘT hoặc NHIỀU ngày (VD 07 → 09 là đợt nhập tàu).
     · Những ngày đó đổi màu trên MỌI bảng lịch (ma trận máy tính,
       lịch tuần điện thoại, lịch trang chính của nhân viên).
     · Gửi thông báo cho: tất cả mọi người / chỉ nhóm CÓ LÀM VIỆC
       trong những ngày đó / một số nhóm tự chọn.

   Sửa hoặc xoá sự kiện thì thông báo cũ được THU HỒI (xoá hẳn khỏi
   S.notifs) rồi gửi lại bản mới — giống cơ chế thu hồi của đổi lịch,
   để không ai còn ôm một thông báo đã lỗi thời.

   Chỉ dùng MỘT màu cho mọi sự kiện (theo yêu cầu): cần phân biệt với
   ngày thường là đủ, không phân loại sự kiện.

   Lưu ở nhánh Firebase riêng `events` (dạng bảng, đồng bộ delta như
   requests/notifs) — xem FB_MAP_BRANCHES ở js/02-storage.js.
   ============================================================ */

/* ============================================================
   ★ v7.8 — PHÂN LOẠI SỰ KIỆN
   ------------------------------------------------------------
   Một năm nhà máy có hàng trăm ngày đặc biệt. Khi tất cả chỉ mang một
   nhãn "Sự kiện", bảng tổng hợp cuối kỳ là một danh sách phẳng không
   trả lời được câu hỏi thường gặp nhất: "kỳ này bao nhiêu chuyến VLGC?
   bao nhiêu đợt bảo dưỡng?".

   Nên mỗi sự kiện mang thêm `ev.cat`:
     · Loại DỰNG SẴN — khoá ngắn trong EV_CATS dưới đây.
     · Loại TỰ THÊM  — chính là chuỗi người dùng gõ vào (VD 'Thay van an
       toàn'). Không có bảng danh mục riêng, không thêm nhánh Firebase:
       loại tự thêm SỐNG NHỜ chính các sự kiện đang dùng nó, evCatAll()
       quét ra. Loại không còn sự kiện nào dùng thì tự biến mất — đúng
       thứ người dùng mong đợi, và không đẻ rác phải đi dọn.

   Không tô màu riêng cho từng loại (theo yêu cầu): lịch vẫn MỘT màu sự
   kiện, phân loại chỉ để lọc và tổng hợp. Icon thì có, vì nó nằm trong
   chính chuỗi tiêu đề nên không tốn thêm gì.
   ============================================================ */
const EV_CATS=[
  {v:'vlgc',  ic:'🚢', l:'VLGC unloading'},
  {v:'itrain',ic:'🎓', l:'Internal training'},
  {v:'etrain',ic:'🏫', l:'External training'},
  {v:'maint', ic:'🛠', l:'Maintenance'},
  {v:'audit', ic:'📋', l:'Audit'},
  {v:'insp',  ic:'🔎', l:'Inspection'},
  {v:'drill', ic:'🚨', l:'Emergency drill'},
  {v:'visit', ic:'👔', l:'Visitor / khách tham quan'},
  {v:'other', ic:'📌', l:'Khác'}
];
function evCatInfo(v){
  const k=String(v||'').trim();
  const f=EV_CATS.find(x=>x.v===k);
  if(f)return f;
  if(!k)return EV_CATS[EV_CATS.length-1];             // chưa phân loại → Khác
  return {v:k,ic:'📌',l:k,custom:true};               // loại tự thêm
}
function evCatLabel(v){const c=evCatInfo(v);return c.ic+' '+t(c.l);}
/* Danh sách loại để hiện chip: dựng sẵn + mọi loại tự thêm đang được dùng */
function evCatAll(){
  const out=EV_CATS.slice();
  Object.values(S.events||{}).forEach(ev=>{
    const k=String((ev&&ev.cat)||'').trim();
    if(k&&!out.some(x=>x.v===k))out.push(evCatInfo(k));
  });
  return out;
}

/* Phạm vi gửi thông báo */
const EV_SCOPE=[
  {v:'all',     l:'Tất cả mọi người',            hint:'Ai cũng nhận thông báo'},
  {v:'working', l:'Chỉ nhóm có làm việc ngày đó', hint:'Người có ca làm (kể cả tăng ca) trong những ngày của sự kiện'},
  {v:'teams',   l:'Chọn nhóm cụ thể',            hint:'Tự tích nhóm nào nhận thông báo'}
];
function evScopeInfo(v){return EV_SCOPE.find(x=>x.v===v)||EV_SCOPE[0];}

/* ---------- Đọc dữ liệu ---------- */
function evAll(){
  return Object.values(S.events||{})
    .filter(Boolean)
    .sort((a,b)=>String(a.from||'').localeCompare(String(b.from||'')));
}
/* Danh sách ngày của một sự kiện. Lưu cả `from`/`to` (khoảng liên tục,
   cách khai thông thường) lẫn `days` (các ngày rời rạc do bấm chọn tay). */
function evDays(ev){
  if(!ev)return [];
  if(Array.isArray(ev.days)&&ev.days.length)return ev.days.slice().sort();
  if(!ev.from)return [];
  const out=[];let d=ev.from;const end=ev.to||ev.from;
  for(let i=0;i<400&&d<=end;i++){out.push(d);d=addDaysIso(d,1);}
  return out;
}
function evHasDay(ev,iso){return evDays(ev).includes(iso);}
/* Chỉ mục ngày → sự kiện. Lịch hỏi "ngày này có sự kiện không" cho từng ô
   nên phải nhanh; nhớ theo S.rev, dữ liệu đổi là tự dựng lại. */
let _evIdx=null,_evIdxRev=-1;
function evResetCache(){_evIdx=null;_evIdxRev=-1;}
function evIndex(){
  if(_evIdx&&_evIdxRev===S.rev)return _evIdx;
  const idx={};
  evAll().forEach(ev=>{evDays(ev).forEach(iso=>{(idx[iso]=idx[iso]||[]).push(ev);});});
  _evIdx=idx;_evIdxRev=S.rev;
  return idx;
}
function eventsOfDay(iso){return evIndex()[iso]||[];}
/* Nhãn gộp cho ô lịch (nhiều sự kiện cùng ngày thì nối bằng " · ").
   Kèm icon loại — nhìn tooltip là biết ngày đó tàu về hay đi kiểm định. */
function evTitleOfDay(iso){
  return eventsOfDay(iso).map(e=>evCatInfo(e.cat).ic+' '+(e.title||t('Sự kiện'))).join(' · ');
}
/* Thuộc tính gắn vào một ô / một tiêu đề ngày trên lịch */
function evAttrOfDay(iso){
  const list=eventsOfDay(iso);
  if(!list.length)return '';
  return ` data-ev="1" title="${esc(evTitleOfDay(iso))}"`;
}

/* ---------- Ai nhận thông báo ---------- */
/* Mã ca coi là CÓ LÀM VIỆC hôm đó (nghỉ ca R và nghỉ phép thì không) */
function evIsWorkingCode(c){
  if(!c)return false;
  const k=codeInfo(c).cat;
  return k==='work'||k==='swap'||k==='ot'||k==='combo';
}
/* NHÃN NHÓM NGƯỜI NHẬN cho tin Zalo — tin sự kiện là tin gửi CHUNG nên phải
   ghi nhãn nhóm, không phải tên một cá nhân. Chữ tiếng Anh vì tin Zalo tiếng
   Anh (xem ZALO-BOT.md 2b.1). js/21-notify.js đọc nhãn này qua n.aud. */
function evAudienceLabel(ev){
  if(!ev) return 'All staff';
  if(ev.scope==='teams'){
    const tms=(ev.teams||[]).map(x=>String(x).trim()).filter(Boolean);
    if(!tms.length) return 'Selected teams';
    return tms.map(t=>'Team '+t).join(' · ');
  }
  if(ev.scope==='working') return 'On-duty staff (event days)';
  return 'All staff';
}
function evRecipients(ev){
  const days=evDays(ev);
  if(ev.scope==='teams'){
    const want=(ev.teams||[]).map(String);
    return activeEmps().filter(e=>want.includes(String(e.team||''))).map(e=>e.id);
  }
  if(ev.scope==='working'){
    return schedEmps().filter(e=>days.some(iso=>evIsWorkingCode(eff(e.id,iso).code))).map(e=>e.id);
  }
  return activeEmps().map(e=>e.id);            // 'all'
}
/* Các NHÓM có người làm việc trong những ngày của sự kiện — hiện lên cho
   quản trị thấy trước khi bấm lưu, khỏi phải đoán "chọn nhóm làm việc" là ai */
function evWorkingTeams(ev){
  const days=evDays(ev),out=[];
  schedEmps().forEach(e=>{
    const tm=String(e.team||'');
    if(out.includes(tm))return;
    if(days.some(iso=>evIsWorkingCode(eff(e.id,iso).code)))out.push(tm);
  });
  return out.sort();
}

/* ---------- Thông báo: gửi & thu hồi ---------- */
/* Xoá hẳn mọi thông báo gắn với sự kiện này (thu hồi). Trả về số đã xoá. */
function evRevokeNotifs(evId){
  if(!S.notifs)return 0;
  /* Qua notifDrop để rút luôn tin còn nằm trong hàng đợi Zalo — sự kiện bị
     xoá mà tin vẫn bắn đi thì cả tổ nhận nhầm. Xem js/13-portal.js. */
  if(typeof notifDrop==='function')
    return notifDrop(x=>x.kind==='event'&&x.evId===evId);
  let n=0;
  for(const k in S.notifs){
    const x=S.notifs[k];
    if(x&&x.kind==='event'&&x.evId===evId){delete S.notifs[k];n++;}
  }
  return n;
}
function evDateLabel(ev){
  const d=evDays(ev);
  if(!d.length)return '';
  if(d.length===1)return fmtVN(d[0]);
  /* Liên tục thì ghi "07/08 → 09/08", rời rạc thì liệt kê */
  const cont=d.every((x,i)=>i===0||x===addDaysIso(d[i-1],1));
  return cont?(fmtVN(d[0])+' → '+fmtVN(d[d.length-1]))
             :d.map(fmtVN).join(', ');
}
/* Gửi thông báo cho đúng nhóm người nhận. Luôn thu hồi bản cũ trước để
   không có chuyện một sự kiện đẻ ra hai thông báo lệch nhau. */
function evSendNotifs(ev){
  evRevokeNotifs(ev.id);
  if(!ev.notify)return 0;
  const by=meId()||'admin';
  const ids=evRecipients(ev);
  /* Nhãn loại đứng TRƯỚC tên sự kiện: đọc tin Zalo là biết ngay việc gì —
     tên loại dựng sẵn vốn đã là tiếng Anh nên không phải dịch thêm. */
  const cat=evCatInfo(ev.cat);
  const txt=cat.ic+' '+cat.l+': '+(ev.title||t2('Sự kiện'))
           +' — '+evDateLabel(ev)+(ev.note?' · '+ev.note:'');
  /* Nhãn nhóm người nhận — giống nhau cho mọi người nên các tin gộp vân tay
     thành ĐÚNG 1 tin, và tin đó ghi "👥 All staff / Team A · B" thay vì tên
     một cá nhân. */
  const aud=evAudienceLabel(ev);
  /* status 'sent' (không phải 'pending') để pruneOldNotifs() dọn được sau ~2 kỳ —
     sự kiện là tin một chiều, không có gì chờ nhân viên bấm xác nhận. */
  ids.forEach(id=>{
    newNotif({kind:'event',to:id,from:by,evId:ev.id,iso:evDays(ev)[0]||'',aud:aud,
      status:'sent',text:t2('Sự kiện trên lịch')+': '+txt});
  });
  return ids.length;
}

/* ============================================================
   MÀN QUẢN LÝ SỰ KIỆN (quản trị)
   Một lịch nhỏ cả kỳ để bấm chọn ngày (chạm = chọn / bỏ chọn, kéo
   không cần thiết vì kỳ chỉ 30 ô), bên dưới là tên + phạm vi gửi.
   ============================================================ */
let evYm='';               // kỳ đang xem trong màn sự kiện
let evSel={};              // {iso:true} các ngày đang chọn
let evEditId='';           // đang sửa sự kiện nào ('' = tạo mới)
let evTitle='', evNote='', evScope='all', evTeams=[], evNotify=true;
let evCat='vlgc';          // loại sự kiện đang khai — xem EV_CATS
/* ★ v7.8 — hai chế độ xem trong CÙNG một hộp thoại:
     'form'  — khai / sửa sự kiện (như cũ)
     'table' — bảng tổng hợp, lọc theo loại và theo kỳ
   Dùng chung hộp thoại thay vì mở modal thứ hai: người dùng bấm từ bảng
   sang sửa rồi quay lại bảng liên tục, hai lớp mask chồng nhau là rối. */
let evView='form';
let evTblCat='__all';      // lọc loại ở bảng
let evTblYm='__all';       // lọc kỳ ở bảng ('__all' = mọi kỳ)

function evPeriod(){return evYm||curSchedMonth();}
function evShiftYm(d){evYm=schedYmShift(evPeriod(),d);renderEventMgr();}

/* `view`='table' để mở thẳng bảng tổng hợp (nút riêng trên thanh công cụ) */
function openEventMgr(iso,view){
  if(!hrGuard())return;
  evEditId='';evSel={};evTitle='';evNote='';evScope='all';evTeams=[];evNotify=true;evCat='vlgc';
  evView=(view==='table')?'table':'form';
  if(iso){evSel[iso]=true;evYm=schedMonthOf(iso);}
  else if(!evYm)evYm=curSchedMonth();
  const m=$('evMask');if(!m)return;
  m.classList.add('on');
  renderEventMgr();
}
function closeEventMgr(){const m=$('evMask');if(m)m.classList.remove('on');}

function evToggleDay(iso){
  if(evSel[iso])delete evSel[iso];else evSel[iso]=true;
  renderEventMgr();
}
/* Chọn cả một dải: bấm ngày đầu rồi bấm ngày cuối kèm nút "Chọn dải" */
function evSelRange(){
  const d=Object.keys(evSel).sort();
  if(d.length<2){toast(t('Chọn ít nhất 2 ngày rồi bấm Chọn dải'));return;}
  let x=d[0];const end=d[d.length-1];
  for(let i=0;i<400&&x<=end;i++){evSel[x]=true;x=addDaysIso(x,1);}
  renderEventMgr();
}
function evClearSel(){evSel={};renderEventMgr();}
function evSetScope(v){evScope=v;renderEventMgr();}
function evToggleTeam(tm){
  const i=evTeams.indexOf(tm);
  if(i<0)evTeams.push(tm);else evTeams.splice(i,1);
  renderEventMgr();
}
function evSetNotify(on){evNotify=!!on;renderEventMgr();}
function evSetCat(v){evCat=String(v||'other');renderEventMgr();}
/* Thêm một loại tự đặt. Loại chỉ tồn tại khi có sự kiện dùng nó (xem khối
   ★ v7.8 ở đầu file) nên ở đây chỉ cần gán vào evCat, không lưu ở đâu cả. */
function evAddCat(){
  const s=prompt(t('Tên loại sự kiện mới (VD: Thay van an toàn)'),'');
  const k=String(s||'').trim();
  if(!k)return;
  if(k.length>40){toast(t('Tên loại quá dài'));return;}
  evCat=k;renderEventMgr();
}
/* ---- chuyển giữa form và bảng ---- */
function evSetView(v){
  evView=(v==='table')?'table':'form';
  renderEventMgr();
}
function evTblSet(k,v){
  if(k==='cat')evTblCat=v;else evTblYm=v;
  renderEventMgr();
}

/* Mở một sự kiện có sẵn để sửa */
function evEdit(id){
  const ev=(S.events||{})[id];if(!ev){toast(t('Không tìm thấy sự kiện'));return;}
  evEditId=id;
  evView='form';                       // bấm Sửa từ bảng thì phải thấy form
  evSel={};evDays(ev).forEach(iso=>{evSel[iso]=true;});
  evTitle=ev.title||'';evNote=ev.note||'';
  evCat=ev.cat||'other';
  evScope=ev.scope||'all';evTeams=(ev.teams||[]).slice();
  evNotify=ev.notify!==false;
  const first=evDays(ev)[0];if(first)evYm=schedMonthOf(first);
  renderEventMgr();
}
function evNewFrom(){evEditId='';evTitle='';evNote='';renderEventMgr();}

function evSave(){
  if(!hrGuard())return;
  const days=Object.keys(evSel).sort();
  if(!days.length){toast(t('Chưa chọn ngày nào'));return;}
  const title=String(evTitle||'').trim();
  if(!title){toast(t('Chưa đặt tên sự kiện'));return;}
  if(evScope==='teams'&&!evTeams.length){toast(t('Chưa chọn nhóm nhận thông báo'));return;}
  const cont=days.every((x,i)=>i===0||x===addDaysIso(days[i-1],1));
  const id=evEditId||uid();
  const old=(S.events||{})[id];
  S.events=S.events||{};
  S.events[id]={
    id,title,note:String(evNote||'').trim(),
    cat:String(evCat||'other').trim()||'other',
    from:days[0],to:days[days.length-1],
    days:cont?null:days,           // liên tục thì chỉ cần from/to cho gọn dữ liệu
    scope:evScope,teams:evScope==='teams'?evTeams.slice():[],
    notify:!!evNotify,
    by:old&&old.by||meId()||'admin',at:old&&old.at||Date.now(),
    editBy:meId()||'admin',editAt:Date.now()
  };
  evResetCache();
  const n=evSendNotifs(S.events[id]);
  save();
  evEditId=id;
  renderEventMgr();
  if(typeof renderCal==='function')renderCal();
  if(typeof renderMe==='function'&&!noSelf)renderMe(true);
  toast(evNotify?(t('Đã lưu sự kiện và gửi thông báo tới')+' '+n+' '+t('người'))
                :t('Đã lưu sự kiện (không gửi thông báo)'));
}

function evDelete(id){
  if(!hrGuard())return;
  const ev=(S.events||{})[id];if(!ev)return;
  if(!confirm(t('Xoá sự kiện')+' "'+(ev.title||'')+'"? '+t('Thông báo đã gửi cũng được thu hồi.')))return;
  const n=evRevokeNotifs(id);
  delete S.events[id];
  evResetCache();
  if(evEditId===id){evEditId='';evSel={};evTitle='';evNote='';}
  save();renderEventMgr();
  if(typeof renderCal==='function')renderCal();
  if(typeof renderMe==='function'&&!noSelf)renderMe(true);
  toast(t('Đã xoá sự kiện và thu hồi')+' '+n+' '+t('thông báo'));
}

/* ---------- Giao diện ---------- */
function evMiniCal(){
  const ym=evPeriod(),days=daysOfPeriod(ym);
  if(!days.length)return `<p class="muted">${t('Kỳ này chưa có lịch.')}</p>`;
  const lead=(new Date(days[0]+'T00:00:00').getDay()+6)%7;
  const tIso=todayIso();
  let h='<div class="ev-mini">';
  for(let i=0;i<7;i++)h+=`<div class="hd${i>4?' we':''}">${dowShort(i)}</div>`;
  for(let k=0;k<lead;k++)h+='<div class="pd"></div>';
  days.forEach(iso=>{
    const other=eventsOfDay(iso).filter(x=>x.id!==evEditId);
    h+=`<button type="button" class="d${evSel[iso]?' on':''}${iso===tIso?' today':''}${other.length?' has':''}"
        onclick="evToggleDay('${iso}')" title="${other.length?esc(other.map(x=>x.title).join(' · ')):fmtVNfull(iso)}">
        <b>${+iso.slice(8)}</b><i>${dowOf(iso)}</i></button>`;
  });
  return h+'</div>';
}
function renderEventMgr(){
  const box=$('evBody');if(!box)return;
  /* Bấm một ngày trên lịch nhỏ cũng dựng lại cả hộp thoại → nhảy về đầu.
     Cùng lỗi và cùng cách chữa với màn Đào tạo (uiSnap ở js/03-nav.js). */
  const snap=(typeof uiSnap==='function')?uiSnap('evBody',['.ev-list']):null;
  const per=periodFor(evPeriod());
  const days=Object.keys(evSel).sort();
  const teams=teamList();
  const preview={id:evEditId||'__new',days,from:days[0],to:days[days.length-1],
                 scope:evScope,teams:evTeams};
  const nRecv=days.length?evRecipients(preview).length:0;
  const wTeams=days.length?evWorkingTeams(preview):[];
  const head=`
  <h3>📌 ${t('Sự kiện trên lịch')}</h3>
  <div class="ev-tabs">
    <button class="evtab${evView==='form'?' on':''}" onclick="evSetView('form')">✏️ ${t('Khai sự kiện')}</button>
    <button class="evtab${evView==='table'?' on':''}" onclick="evSetView('table')">📋 ${t('Bảng sự kiện')}</button>
  </div>`;

  /* Bảng tổng hợp — xem js/20-events.js khối ★ v7.8 */
  if(evView==='table'){
    box.innerHTML=head+evTableHtml()+`
    <div class="row" style="gap:8px;margin-top:10px">
      <button class="btn sec" style="flex:1" onclick="evSetView('form')">➕ ${t('Khai sự kiện mới')}</button>
      <button class="btn sec" onclick="closeEventMgr()">${t('Đóng')}</button>
    </div>`;
    if(typeof uiRestore==='function')uiRestore(snap);
    return;
  }

  box.innerHTML=head+`
  <p class="muted sm2">${t('Đánh dấu những ngày đặc biệt (nhập tàu, bảo dưỡng, kiểm định…) để cả tổ nhìn lịch là thấy, kèm thông báo tới đúng người.')}</p>

  <div class="ev-per">
    <button class="btn sec sm" onclick="evShiftYm(-1)">◀</button>
    <b>${esc(per.label)}</b>
    <button class="btn sec sm" onclick="evShiftYm(1)">▶</button>
    <span style="flex:1"></span>
    <span class="muted sm2">${t('Chạm vào ngày để chọn / bỏ chọn')}</span>
  </div>
  ${evMiniCal()}
  <div class="ev-selbar">
    <span class="ev-cnt">${days.length?('<b>'+days.length+'</b> '+t('ngày')+': '+esc(evDateLabel(preview))):('<i class="muted">'+t('chưa chọn ngày nào')+'</i>')}</span>
    <button class="btn sec sm" onclick="evSelRange()">${t('Chọn cả dải')}</button>
    <button class="btn sec sm" onclick="evClearSel()">${t('Bỏ chọn hết')}</button>
  </div>

  <div class="fg"><label class="fl">${t('Loại sự kiện')}</label>
    <div class="ev-cats">
      ${evCatAll().map(c=>`<button type="button" class="evcat${evCat===c.v?' on':''}"
        onclick="evSetCat('${esc(c.v).replace(/'/g,"\\'")}')">${c.ic} ${esc(t(c.l))}</button>`).join('')}
      <button type="button" class="evcat add" onclick="evAddCat()">➕ ${t('Loại khác…')}</button>
    </div>
  </div>

  <div class="fg"><label class="fl">${t('Tên sự kiện')}</label>
    <input class="inp" id="evTitleIn" data-k="evTitle" value="${esc(evTitle)}" placeholder="${t('VD: Nhập tàu LPG')}"
           oninput="evTitle=this.value">
  </div>
  <div class="fg"><label class="fl">${t('Ghi chú (không bắt buộc)')}</label>
    <input class="inp" data-k="evNote" value="${esc(evNote)}" placeholder="${t('VD: Tàu cập cầu 06:00, huy động thêm người trực')}"
           oninput="evNote=this.value">
  </div>

  <div class="fg"><label class="fl">${t('Gửi thông báo cho')}</label>
    <div class="ev-scope">
      ${EV_SCOPE.map(s=>`<button type="button" class="sc${evScope===s.v?' on':''}" onclick="evSetScope('${s.v}')">
        <b>${t(s.l)}</b><i>${t(s.hint)}</i></button>`).join('')}
    </div>
  </div>
  ${evScope==='teams'?`<div class="ev-teams">
    ${teams.map(tm=>`<label class="cal-chk"><input type="checkbox" ${evTeams.includes(tm)?'checked':''}
      onchange="evToggleTeam('${esc(tm)}')"> ${esc(tm?t('Nhóm')+' '+tm:t('(chưa phân nhóm)'))}</label>`).join('')}
  </div>`:''}
  ${evScope==='working'&&days.length?`<p class="muted sm2">${t('Nhóm có người làm việc trong các ngày này')}:
    <b>${wTeams.map(x=>esc(x||t('(chưa phân nhóm)'))).join(', ')||t('—')}</b></p>`:''}

  <label class="cal-chk" style="margin:8px 0"><input type="checkbox" ${evNotify?'checked':''}
    onchange="evSetNotify(this.checked)"> ${t('Gửi thông báo ngay khi lưu')}</label>
  ${evNotify&&days.length?`<div class="pv-alert info sm">${t('Sẽ gửi tới')} <b>${nRecv}</b> ${t('người')}.
    ${evEditId?t('Thông báo cũ của sự kiện này sẽ được thu hồi và thay bằng bản mới.'):''}</div>`:''}

  <div class="row" style="gap:8px;margin-top:10px">
    <button class="btn ok" style="flex:1" onclick="evSave()">${evEditId?'💾 '+t('Lưu thay đổi'):'➕ '+t('Tạo sự kiện')}</button>
    ${evEditId?`<button class="btn sec" onclick="evNewFrom()">${t('Tạo sự kiện mới')}</button>`:''}
    <button class="btn sec" onclick="closeEventMgr()">${t('Đóng')}</button>
  </div>

  <h4 style="margin:14px 0 6px">${t('Sự kiện đã ghi nhận')}</h4>
  <div class="ev-list">${evListHtml()}</div>`;
  if(typeof uiRestore==='function')uiRestore(snap);
}
function evListHtml(){
  const list=evAll();
  if(!list.length)return `<p class="muted sm2">${t('Chưa có sự kiện nào.')}</p>`;
  const tIso=todayIso();
  return list.map(ev=>{
    const d=evDays(ev), past=d.length&&d[d.length-1]<tIso;
    const live=d.includes(tIso);
    return `<div class="ev-it${past?' past':''}${live?' live':''}${ev.id===evEditId?' on':''}">
      <span class="tx"><b>${evCatInfo(ev.cat).ic} ${esc(ev.title||t('Sự kiện'))}
        <span class="evtag">${esc(t(evCatInfo(ev.cat).l))}</span></b>
        <i>${esc(evDateLabel(ev))} · ${t(evScopeInfo(ev.scope).l)}${
          ev.scope==='teams'&&(ev.teams||[]).length?' ('+esc(ev.teams.join(', '))+')':''}${
          ev.notify===false?' · '+t('không gửi thông báo'):''}</i>
        ${ev.note?`<i class="nt">${esc(ev.note)}</i>`:''}</span>
      <span class="ac">
        <button class="btn sec sm ico" onclick="evEdit('${ev.id}')" title="${t('Sửa')}">✏️</button>
        <button class="btn warn sm ico" onclick="evDelete('${ev.id}')" title="${t('Xoá')}">✕</button>
      </span></div>`;
  }).join('');
}

/* ============================================================
   BẢNG TỔNG HỢP SỰ KIỆN   ★ v7.8
   ------------------------------------------------------------
   Danh sách thẻ ở dưới form trả lời tốt câu "sắp tới có gì", nhưng
   không trả lời được "cả năm bao nhiêu chuyến VLGC", "đợt bảo dưỡng
   nào rơi vào ca đêm". Bảng thì có: một dòng một sự kiện, lọc theo
   LOẠI và theo KỲ, kèm hàng đếm ở đầu bảng.
   Bảng dùng chung dữ liệu và chung hàm với lịch — không có bản sao
   nào của "sự kiện là gì" ở đây.
   ============================================================ */
/* Sự kiện có chạm vào kỳ nào không (một sự kiện có thể vắt qua 2 kỳ) */
function evInPeriod(ev,ym){
  if(!ym||ym==='__all')return true;
  const p=periodFor(ym);
  return evDays(ev).some(iso=>iso>=p.from&&iso<=p.to);
}
function evTableRows(){
  return evAll().filter(ev=>
    (evTblCat==='__all'||String(ev.cat||'other')===evTblCat)&&evInPeriod(ev,evTblYm));
}
function evTableHtml(){
  const rows=evTableRows();
  const tIso=todayIso();
  const cats=evCatAll();
  const ms=(typeof monthsAvailable==='function')?monthsAvailable():[];
  /* Đếm theo loại để hiện ngay trên chip — người xem biết bấm vào đâu có gì */
  const cnt=k=>evAll().filter(ev=>(k==='__all'||String(ev.cat||'other')===k)&&evInPeriod(ev,evTblYm)).length;
  const nDays=rows.reduce((s,ev)=>s+evDays(ev).length,0);

  const filt=`
  <div class="ev-tblbar">
    <select class="inp sm" onchange="evTblSet('ym',this.value)">
      <option value="__all"${evTblYm==='__all'?' selected':''}>${t('Tất cả các kỳ')}</option>
      ${ms.map(m=>`<option value="${m}"${evTblYm===m?' selected':''}>${esc(periodFor(m).slim)}</option>`).join('')}
    </select>
    <span class="muted sm2"><b>${rows.length}</b> ${t('sự kiện')} · <b>${nDays}</b> ${t('ngày')}</span>
  </div>
  <div class="ab-chips">
    <button class="abc sm${evTblCat==='__all'?' on':''}" onclick="evTblSet('cat','__all')">${t('Mọi loại')}<i>${cnt('__all')}</i></button>
    ${cats.map(c=>`<button class="abc sm${evTblCat===c.v?' on':''}"
      onclick="evTblSet('cat','${esc(c.v).replace(/'/g,"\\'")}')">${c.ic} ${esc(t(c.l))}<i>${cnt(c.v)}</i></button>`).join('')}
  </div>`;

  if(!rows.length)return filt+`<p class="muted sm2" style="margin-top:10px">${t('Không có sự kiện nào khớp bộ lọc.')}</p>`;

  return filt+`
  <div class="ev-tblwrap"><table class="ev-tbl">
    <thead><tr>
      <th>${t('Ngày')}</th><th>${t('Loại')}</th><th>${t('Tên sự kiện')}</th>
      <th>${t('Số ngày')}</th><th>${t('Gửi cho')}</th><th>${t('Tình trạng')}</th><th></th>
    </tr></thead>
    <tbody>${rows.map(ev=>{
      const d=evDays(ev);
      const past=d.length&&d[d.length-1]<tIso, live=d.includes(tIso);
      const st=live?`<span class="evst live">${t('đang diễn ra')}</span>`
              :past?`<span class="evst past">${t('đã qua')}</span>`
                   :`<span class="evst next">${t('sắp tới')}</span>`;
      const c=evCatInfo(ev.cat);
      return `<tr class="${past?'past':''}${live?' live':''}">
        <td class="nw">${esc(evDateLabel(ev))}</td>
        <td class="nw">${c.ic} ${esc(t(c.l))}</td>
        <td><b>${esc(ev.title||t('Sự kiện'))}</b>${ev.note?`<i class="nt">${esc(ev.note)}</i>`:''}</td>
        <td class="ct">${d.length}</td>
        <td>${t(evScopeInfo(ev.scope).l)}${
          ev.scope==='teams'&&(ev.teams||[]).length?' ('+esc(ev.teams.join(', '))+')':''}${
          ev.notify===false?`<i class="nt">${t('không gửi thông báo')}</i>`:''}</td>
        <td class="nw">${st}</td>
        <td class="nw">
          <button class="btn sec sm ico" onclick="evEdit('${ev.id}')" title="${t('Sửa')}">✏️</button>
          <button class="btn warn sm ico" onclick="evDelete('${ev.id}')" title="${t('Xoá')}">✕</button>
        </td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* Dải sự kiện hiện trên trang chính nhân viên & trong sheet ngày */
function evBannerHtml(isoList){
  const seen={},out=[];
  (isoList||[]).forEach(iso=>eventsOfDay(iso).forEach(ev=>{
    if(seen[ev.id])return;seen[ev.id]=1;out.push(ev);
  }));
  if(!out.length)return '';
  out.sort((a,b)=>String(evDays(a)[0]||'').localeCompare(String(evDays(b)[0]||'')));
  return `<div class="ev-banner">${out.map(ev=>`<div class="ev-b">
    <span class="ic">${evCatInfo(ev.cat).ic}</span>
    <span class="tx"><b>${esc(ev.title||t('Sự kiện'))} <span class="evtag">${esc(t(evCatInfo(ev.cat).l))}</span></b>
      <i>${esc(evDateLabel(ev))}${ev.note?' · '+esc(ev.note):''}</i></span>
    ${(typeof nsWhen==='function')?`<span class="when">${esc(nsWhen(evDays(ev).find(x=>x>=todayIso())||evDays(ev)[0]))}</span>`:''}
  </div>`).join('')}</div>`;
}
