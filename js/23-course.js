/* ============================================================
   KHOÁ ĐÀO TẠO  (S.courses)   ★ v7.8
   LPGT Cavern — Quan ly Cong Ca
   ------------------------------------------------------------
   VẤN ĐỀ

   Một lần đào tạo ở nhà máy hầu như không bao giờ gọn trong một buổi.
   Lớp an toàn hoá chất 24 người phải chia bốn buổi vì ca trực không cho
   phép rút hết người cùng lúc; ngày mai anh A bận nhập tàu nên phải
   chuyển sang buổi 3, chỗ trống nhường cho anh C.

   Bản v7.x trước coi MỖI LẦN XẾP LÀ MỘT BUỔI RỜI. Bốn buổi của cùng một
   khoá là bốn bản ghi không liên quan gì nhau, nên:
     · muốn biết "khoá này ai đã học rồi, ai chưa" phải tự dò bằng mắt;
     · chuyển anh A từ buổi 2 sang buổi 3 = mở hai bản ghi, sửa hai lần,
       và không có gì bảo đảm không bỏ sót hay xếp anh ta vào cả hai;
     · báo cáo cuối kỳ không cộng được giờ theo khoá.

   ------------------------------------------------------------
   CÁCH LÀM

   · KHOÁ (`S.courses[id]`) giữ phần KHÔNG đổi giữa các buổi: tên khoá,
     hình thức (nội bộ / bên ngoài), đơn vị đào tạo, địa điểm, ghi chú,
     và DANH SÁCH HỌC VIÊN của cả khoá.

   · BUỔI vẫn là `S.trainings[id]` như cũ, chỉ mang thêm `courseId`. Mọi
     thứ đã chạy tốt của buổi — soi trong ca / tăng ca theo từng cặp
     (người, ngày), sinh đơn OT, thông báo, tô lịch — GIỮ NGUYÊN. Khoá
     không phải một cơ chế song song, nó chỉ là cái kẹp hồ sơ.

   · PHÂN BỔ NGƯỜI = một BẢNG TÍCH học viên × buổi. Ô tích nghĩa là người
     đó học buổi đó. Chuyển người giữa hai buổi chỉ là bỏ tích ô này,
     tích ô kia — đúng động tác người ta làm trên giấy.

   · SỬA NHÁP RỒI MỚI LƯU. Mỗi lần đổi danh sách người của một buổi là
     một lần gỡ & tạo lại đơn tăng ca, thu hồi & gửi lại thông báo, và
     một lượt ghi Firebase. Kéo người qua lại mười lần mà lần nào cũng
     bắn tin thì cả tổ nhận mười thông báo mâu thuẫn nhau. Nên bảng tích
     chỉ sửa BẢN NHÁP trong bộ nhớ; bấm "Lưu phân bổ" mới ghi thật, và
     chỉ ghi những buổi THỰC SỰ đổi (so danh sách trước/sau).

   · XOÁ KHOÁ KHÔNG XOÁ BUỔI. Buổi đã diễn ra là dữ liệu công — nó gắn
     với đơn tăng ca đã duyệt, với giờ đào tạo trong báo cáo. Xoá khoá
     chỉ gỡ cái kẹp: các buổi trở lại thành buổi lẻ, còn nguyên.

   Lưu ở nhánh Firebase riêng `courses` (đồng bộ delta như trainings /
   events) — xem FB_MAP_BRANCHES ở js/02-storage.js.
   ============================================================ */

/* Hình thức khoá — dùng chung cách gọi với phân loại sự kiện (js/20-events.js)
   để hai nơi nói cùng một thứ tiếng: internal / external training. */
const CO_KINDS=[
  {v:'internal',ic:'🎓',l:'Internal training'},
  {v:'external',ic:'🏫',l:'External training'},
  {v:'other',   ic:'📚',l:'Khác'}
];
function coKindInfo(v){return CO_KINDS.find(x=>x.v===v)||CO_KINDS[0];}
function coKindLabel(v){const k=coKindInfo(v);return k.ic+' '+t(k.l);}

/* ---------- Quyền ---------- */
/* Khoá là việc của người xếp lịch cho cả tổ — đúng bằng quyền của buổi. */
function coCanManage(){return (typeof trCanManage==='function')&&trCanManage();}

/* ---------- Đọc dữ liệu ---------- */
function coAll(){
  return Object.values(S.courses||{}).filter(Boolean)
    .sort((a,b)=>(b.at||0)-(a.at||0));
}
function coById(id){return (S.courses||{})[id]||null;}
/* Các buổi của một khoá, xếp theo ngày học đầu tiên */
function coSessions(cid){
  if(!cid)return [];
  return Object.values(S.trainings||{}).filter(tr=>tr&&tr.courseId===cid)
    .sort((a,b)=>String(trDays(a)[0]||'').localeCompare(String(trDays(b)[0]||'')));
}
/* Học viên của khoá = danh sách khai ở khoá HỢP với mọi người đang có tên
   trong các buổi. Vì sao phải hợp: người xếp có thể thêm thẳng một người
   vào một buổi mà quên khai ở khoá — bảng phân bổ vẫn phải thấy họ, nếu
   không thì họ vô hình và không ai chuyển họ đi đâu được. */
function coEmps(cid){
  const c=coById(cid);
  const out=[],seen={};
  const add=id=>{const k=String(id);if(!k||seen[k]||!empById(k))return;seen[k]=1;out.push(k);};
  ((c&&Array.isArray(c.emps))?c.emps:[]).forEach(add);
  coSessions(cid).forEach(tr=>trEmps(tr).forEach(add));
  return out;
}
/* Tổng giờ học của một người trong cả khoá (cộng qua các buổi họ có mặt) */
function coHoursOfEmp(cid,empId){
  let h=0;
  coSessions(cid).forEach(tr=>{
    if(trEmps(tr).includes(String(empId)))h+=trHoursOfEmp(tr,empId);
  });
  return (typeof rnd1==='function')?rnd1(h):h;
}
function coDaysAll(cid){
  const seen={},out=[];
  coSessions(cid).forEach(tr=>trDays(tr).forEach(iso=>{if(!seen[iso]){seen[iso]=1;out.push(iso);}}));
  return out.sort();
}
function coDateLabel(cid){
  const d=coDaysAll(cid);
  if(!d.length)return t('chưa xếp buổi nào');
  return d.length===1?fmtVN(d[0]):(fmtVN(d[0])+' → '+fmtVN(d[d.length-1]));
}

/* ============================================================
   ★ v8.0 — ĐIỂM DANH THEO KHOÁ
   ------------------------------------------------------------
   Ở mức BUỔI, "đã tham gia" là rõ ràng (trAttended ở js/22-training.js).
   Ở mức KHOÁ thì phải chọn một định nghĩa, và định nghĩa duy nhất dùng
   được cho hồ sơ đào tạo là: **đã dự ĐỦ mọi buổi mình được xếp**. Học 1
   trong 3 buổi mà ghi "đã tham gia khoá" thì tờ hồ sơ nói dối.
   Người chưa được xếp buổi nào cũng nằm ở cột CHƯA — họ đúng là chưa học.
   ============================================================ */
function coAttendSplit(cid){
  const ss=coSessions(cid).filter(tr=>trIsActive(tr));
  const done=[],todo=[];
  coEmps(cid).forEach(id=>{
    const mine=ss.filter(tr=>trEmps(tr).includes(String(id)));
    const okAll=mine.length>0&&mine.every(tr=>trAttended(tr,id));
    (okAll?done:todo).push(id);
  });
  return {done,todo};
}

/* ---------- Ghi ---------- */
function coSave(o){
  if(!coCanManage())return {ok:false,err:t('Bạn không có quyền quản lý khoá đào tạo')};
  const title=String((o&&o.title)||'').trim();
  if(!title)return {ok:false,err:t('Chưa đặt tên khoá đào tạo')};
  const me=(typeof meId==='function'&&meId())||'admin';
  const id=(o&&o.id)||uid();
  const old=(S.courses||{})[id];
  S.courses=S.courses||{};
  S.courses[id]={
    id,title,
    kind:coKindInfo(o&&o.kind).v,
    org  :String((o&&o.org  )||'').trim(),     // đơn vị đào tạo (bên ngoài)
    place:String((o&&o.place)||'').trim(),
    note :String((o&&o.note )||'').trim(),
    emps :((o&&Array.isArray(o.emps))?o.emps:[]).map(String).filter(x=>empById(x)),
    by:(old&&old.by)||me, at:(old&&old.at)||Date.now(),
    editBy:me, editAt:Date.now()
  };
  save();
  return {ok:true,id};
}
/* Xoá khoá — CHỈ gỡ cái kẹp, buổi ở lại (xem khối đầu file).
   Không tự tombSet: fbDiff() thấy khoá biến mất là tự dựng bia mộ và nhét
   đường dẫn del vào gói ghi — gọi trước sẽ làm mất đường del đó (bẫy v6.7,
   xem js/02-storage.js). */
function coDelete(id){
  const c=coById(id);
  if(!c)return {ok:false,err:t('Không tìm thấy khoá đào tạo')};
  if(!coCanManage())return {ok:false,err:t('Bạn không có quyền quản lý khoá đào tạo')};
  const ss=coSessions(id);
  ss.forEach(tr=>{tr.courseId='';});
  delete S.courses[id];
  if(typeof trResetCache==='function')trResetCache();
  save();
  return {ok:true,freed:ss.length};
}

/* ============================================================
   PHÂN BỔ NGƯỜI VÀO BUỔI — bảng tích, sửa nháp rồi mới lưu
   ============================================================ */
let coEditId='';        // khoá đang khai ở form ('' = tạo mới)
let coTitle='', coKind='internal', coOrg='', coPlace='', coNote='';
let coPick={};          // {empId:true} học viên của khoá đang khai
let coOpenId='';        // khoá đang mở bảng phân bổ
let coMx=null;          // bản nháp phân bổ: {trId:{empId:true}} — null = chưa mở
let coQ='';             // ô tìm người ở form khoá
let coTeamF='__all';

function coResetForm(){
  coEditId='';coTitle='';coKind='internal';coOrg='';coPlace='';coNote='';coPick={};
}
function coNew(){coResetForm();renderTrainMgr();}
function coEdit(id){
  const c=coById(id);if(!c){toast(t('Không tìm thấy khoá đào tạo'));return;}
  coEditId=id;coTitle=c.title||'';coKind=c.kind||'internal';
  coOrg=c.org||'';coPlace=c.place||'';coNote=c.note||'';
  coPick={};coEmps(id).forEach(x=>{coPick[x]=true;});
  renderTrainMgr();
}
function coSetKind(v){coKind=v;renderTrainMgr();}
function coTogglePerson(id){if(coPick[id])delete coPick[id];else coPick[id]=true;coRenderPeople();}
function coPickTeam(tm){
  const mem=schedEmps().filter(e=>(e.team||'')===tm);
  const allOn=mem.every(e=>coPick[e.id]);
  mem.forEach(e=>{if(allOn)delete coPick[e.id];else coPick[e.id]=true;});
  coRenderPeople();
}
function coClearPeople(){coPick={};coRenderPeople();}
function coSetQ(v){coQ=v||'';coRenderPeople();}
function coSetTeamF(v){coTeamF=v||'__all';renderTrainMgr();}

function coSubmit(){
  const r=coSave({id:coEditId,title:coTitle,kind:coKind,org:coOrg,place:coPlace,note:coNote,
                  emps:Object.keys(coPick)});
  if(!r.ok){toast(r.err);return;}
  coEditId=r.id;
  renderTrainMgr();
  toast(t('Đã lưu khoá đào tạo'));
}
function coDoDelete(id){
  const c=coById(id);if(!c)return;
  const n=coSessions(id).length;
  if(!confirm(t('Xoá khoá')+' "'+(c.title||'')+'"? '
    +(n?(n+' '+t('buổi của khoá sẽ trở thành buổi lẻ (không bị xoá).')):t('Khoá này chưa có buổi nào.'))))return;
  const r=coDelete(id);
  if(!r.ok){toast(r.err);return;}
  if(coEditId===id)coResetForm();
  if(coOpenId===id){coOpenId='';coMx=null;}
  renderTrainMgr();
  toast(t('Đã xoá khoá đào tạo')+(r.freed?' · '+r.freed+' '+t('buổi trở thành buổi lẻ'):''));
}

/* ---- bảng tích ---- */
function coOpenMatrix(cid){
  coOpenId=(coOpenId===cid)?'':cid;      // bấm lại = đóng
  coMx=null;
  if(coOpenId)coLoadMatrix(coOpenId);
  renderTrainMgr();
}
/* Nạp bản nháp từ dữ liệu thật */
function coLoadMatrix(cid){
  coMx={};
  coSessions(cid).forEach(tr=>{
    const m={};trEmps(tr).forEach(id=>{m[id]=true;});
    coMx[tr.id]=m;
  });
}
function coMxHas(trId,empId){return !!(coMx&&coMx[trId]&&coMx[trId][empId]);}
function coMxToggle(trId,empId){
  if(!coMx)return;
  coMx[trId]=coMx[trId]||{};
  if(coMx[trId][empId])delete coMx[trId][empId];else coMx[trId][empId]=true;
  renderTrainMgr();
}
/* Chuyển một người sang buổi khác: bỏ mọi buổi hiện có trong khoá rồi tích
   đúng buổi đích. Đây là động tác hay dùng nhất nên có nút riêng, thay vì
   bắt người dùng nhớ bỏ tích chỗ cũ (quên là người đó học hai buổi). */
function coMxMove(empId,toTrId){
  if(!coMx)return;
  Object.keys(coMx).forEach(k=>{delete coMx[k][empId];});
  if(toTrId){coMx[toTrId]=coMx[toTrId]||{};coMx[toTrId][empId]=true;}
  renderTrainMgr();
}
/* Những buổi có danh sách người KHÁC bản đã lưu */
function coMxChanged(cid){
  if(!coMx)return [];
  return coSessions(cid).filter(tr=>{
    const now=trEmps(tr).slice().sort().join(',');
    const nxt=Object.keys(coMx[tr.id]||{}).sort().join(',');
    return now!==nxt;
  });
}
function coMxReset(){if(coOpenId)coLoadMatrix(coOpenId);renderTrainMgr();}
/* Ghi bản nháp xuống dữ liệu thật. Đi qua trSave() để mỗi buổi đổi người
   được xử lý ĐÚNG như khi sửa tay: gỡ & tạo lại đơn OT chưa duyệt, thu hồi
   & gửi lại thông báo. Không có đường tắt nào ở đây — đường tắt là chỗ hai
   lối ghi bắt đầu lệch nhau. */
function coMxApply(){
  if(!coOpenId||!coMx)return;
  const changed=coMxChanged(coOpenId);
  if(!changed.length){toast(t('Không có thay đổi nào để lưu'));return;}
  const empty=changed.filter(tr=>!Object.keys(coMx[tr.id]||{}).length);
  if(empty.length&&!confirm(empty.length+' '+t('buổi sẽ không còn học viên nào. Vẫn lưu?')))return;
  let okN=0,errs=[];
  changed.forEach(tr=>{
    const emps=Object.keys(coMx[tr.id]||{});
    if(!emps.length){
      /* Buổi trống thì không lưu được (trValidate đòi có người). Xoá hẳn buổi
         là quyết định lớn, không làm ngầm — báo để người dùng tự xoá. */
      errs.push((tr.title||t('Buổi'))+': '+t('không còn học viên — hãy xoá buổi này nếu không dùng nữa'));
      return;
    }
    const o=Object.assign({},tr,{emps});
    const r=trSave(o);
    if(r.ok)okN++;else errs.push((tr.title||t('Buổi'))+': '+r.err);
  });
  coLoadMatrix(coOpenId);
  renderTrainMgr();
  if(typeof renderCal==='function')renderCal();
  if(typeof renderMe==='function'&&!noSelf)renderMe(true);
  if(typeof renderAppr==='function')renderAppr();
  let msg=t('Đã cập nhật')+' '+okN+' '+t('buổi');
  if(errs.length)msg+=' · ⚠ '+errs.join(' · ');
  toast(msg);
}

/* ============================================================
   GIAO DIỆN — màn "Khoá đào tạo" nằm trong hộp thoại Đào tạo
   ============================================================ */
function coPeopleHtml(){
  const q=(typeof noAccent==='function')?noAccent(coQ||''):String(coQ||'').toLowerCase();
  let list=schedEmps();
  if(coTeamF!=='__all')list=list.filter(e=>(e.team||'')===coTeamF);
  if(q)list=list.filter(e=>{
    const s=(typeof noAccent==='function')?noAccent((e.name||'')+' '+e.id):((e.name||'')+' '+e.id).toLowerCase();
    return s.includes(q);
  });
  if(!list.length)return `<p class="muted sm2">${t('Không tìm thấy ai.')}</p>`;
  return `<div class="tr-people">${list.map(e=>`
    <label class="trp${coPick[e.id]?' on':''}">
      <input type="checkbox" ${coPick[e.id]?'checked':''} onchange="coTogglePerson('${e.id}')">
      <span class="nm">${esc(shortName(e.name||e.id))}</span>
      <span class="tm">${esc(e.team||'—')}</span>
    </label>`).join('')}</div>`;
}
function coRenderPeople(){
  const box=$('coPeopleBox');
  if(!box){renderTrainMgr();return;}
  box.innerHTML=coPeopleHtml();
}

/* Bảng tích học viên × buổi của MỘT khoá */
function coMatrixHtml(cid){
  const ss=coSessions(cid);
  if(!ss.length)return `<p class="muted sm2">${t('Khoá này chưa có buổi nào — bấm “Thêm buổi vào khoá” để xếp buổi đầu tiên.')}</p>`;
  if(!coMx)coLoadMatrix(cid);
  const emps=coEmps(cid);
  if(!emps.length)return `<p class="muted sm2">${t('Khoá này chưa có học viên nào — sửa khoá và chọn người.')}</p>`;
  const changed=coMxChanged(cid);
  /* ============================================================
     ★ v7.9 — ĐÂY MỚI LÀ LÝ DO DANH SÁCH HỌC VIÊN CỦA KHOÁ TỒN TẠI
     ------------------------------------------------------------
     Nếu chỉ tích người ở từng buổi thì không ai trả lời được câu hỏi thật
     sự quan trọng: "khoá này còn AI CHƯA HỌC?". Danh sách của khoá là bản
     điểm danh gốc; đối chiếu với bảng tích ra ngay người chưa được xếp
     buổi nào. Không có nó, sót một người là sót im lặng — tới cuối khoá
     mới lộ, lúc đó lớp đã đóng.
     ============================================================ */
  const missing=emps.filter(id=>!ss.some(tr=>coMxHas(tr.id,id)));

  const head=ss.map((tr,i)=>{
    const n=Object.keys(coMx[tr.id]||{}).length;
    return `<th class="ss" title="${esc((tr.title||'')+' · '+trDateLabel(tr))}">
      <b>${t('Buổi')} ${i+1}</b><i>${esc(trDateLabel(tr))}</i>
      <i>${esc(trTimeLabel(tr)||'')}</i>
      <i class="cnt${n?'':' zero'}">${n} ${t('người')}</i></th>`;
  }).join('');

  const rows=emps.map(id=>{
    const e=empById(id)||{};
    const inN=ss.filter(tr=>coMxHas(tr.id,id)).length;
    return `<tr class="${inN?'':'none'}">
      <td class="nm"><b>${esc(shortName(e.name||id))}</b><i>${esc(e.team||'—')}</i></td>
      ${ss.map(tr=>`<td class="ck">
        <input type="checkbox" ${coMxHas(tr.id,id)?'checked':''}
               onchange="coMxToggle('${tr.id}','${id}')"></td>`).join('')}
      <td class="mv">
        <select class="inp sm" onchange="coMxMove('${id}',this.value);this.selectedIndex=0">
          <option value="">${t('chuyển →')}</option>
          ${ss.map((tr,i)=>`<option value="${tr.id}">${t('chỉ buổi')} ${i+1}</option>`).join('')}
          <option value="">${t('(bỏ khỏi mọi buổi)')}</option>
        </select></td>
      <td class="ct">${inN}</td></tr>`;
  }).join('');

  return `
  ${missing.length
    ? `<div class="pv-alert warn sm">⚠ <b>${missing.length}</b>/${emps.length} ${
        t('học viên của khoá chưa được xếp buổi nào')}:
        ${missing.slice(0,10).map(id=>esc(shortName((empById(id)||{}).name||id))).join(', ')}${
        missing.length>10?' …':''}</div>`
    : `<div class="pv-alert sm">✓ ${t('Cả')} <b>${emps.length}</b> ${
        t('học viên đều đã có buổi.')}</div>`}
  <div class="co-mxwrap"><table class="co-mx">
    <thead><tr><th class="nm">${t('Học viên')}</th>${head}<th></th><th class="ct">${t('Số buổi')}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
    <button class="btn ok" onclick="coMxApply()" ${changed.length?'':'disabled'}>
      💾 ${t('Lưu phân bổ')}${changed.length?' ('+changed.length+' '+t('buổi')+')':''}</button>
    <button class="btn sec" onclick="coMxReset()">${t('Bỏ thay đổi')}</button>
    <button class="btn sec" onclick="trNewForCourse('${cid}')">➕ ${t('Thêm buổi vào khoá')}</button>
  </div>
  ${changed.length?`<div class="pv-alert info sm">${t('Đang sửa nháp')} — <b>${changed.length}</b> ${
    t('buổi có thay đổi. Bấm “Lưu phân bổ” mới ghi thật; lúc đó đơn tăng ca và thông báo của những buổi này mới được tạo lại.')}</div>`
   :`<div class="pv-alert sm">✓ ${t('Bảng đang khớp với dữ liệu đã lưu.')}</div>`}`;
}

function coBodyHtml(){
  if(!coCanManage())return `<p class="muted sm2">${t('Bạn không có quyền quản lý khoá đào tạo.')}</p>`;
  const teams=(typeof teamList==='function')?teamList():[];
  const picked=Object.keys(coPick);
  const list=coAll();

  return `
  <p class="muted sm2">${t('Một khoá đào tạo thường chia làm nhiều buổi vì không thể rút hết người khỏi ca cùng lúc. Khai khoá một lần, thêm từng buổi vào khoá, rồi chuyển người qua lại giữa các buổi ngay trên bảng tích bên dưới.')}</p>

  <div class="fg"><label class="fl">${t('Tên khoá đào tạo')}</label>
    <input class="inp" data-k="coTitle" value="${esc(coTitle)}" placeholder="${t('VD: Huấn luyện an toàn hoá chất 2026')}"
           oninput="coTitle=this.value"></div>

  <div class="fg"><label class="fl">${t('Hình thức')}</label>
    <div class="ev-cats">
      ${CO_KINDS.map(k=>`<button type="button" class="evcat${coKind===k.v?' on':''}"
        onclick="coSetKind('${k.v}')">${k.ic} ${esc(t(k.l))}</button>`).join('')}
    </div></div>

  <div class="row" style="gap:8px">
    <div class="fg" style="flex:1"><label class="fl">${t('Đơn vị đào tạo (không bắt buộc)')}</label>
      <input class="inp" data-k="coOrg" value="${esc(coOrg)}" placeholder="${t('VD: Trung tâm Kiểm định 3')}"
             oninput="coOrg=this.value"></div>
    <div class="fg" style="flex:1"><label class="fl">${t('Địa điểm (không bắt buộc)')}</label>
      <input class="inp" data-k="coPlace" value="${esc(coPlace)}" placeholder="${t('VD: Phòng họp tầng 2')}"
             oninput="coPlace=this.value"></div>
  </div>

  <div class="fg"><label class="fl">${t('Học viên của khoá')} ${picked.length?`<b>(${picked.length})</b>`:''}</label>
    <div class="tr-filter">
      <select class="inp sm" onchange="coSetTeamF(this.value)">
        <option value="__all">${t('Tất cả nhóm')}</option>
        ${teams.map(tm=>`<option value="${esc(tm)}" ${coTeamF===tm?'selected':''}>${
          esc(tm?t('Nhóm')+' '+tm:t('(chưa phân nhóm)'))}</option>`).join('')}
      </select>
      <input class="inp sm" data-k="coQ" value="${esc(coQ)}" placeholder="${t('Tìm tên hoặc mã NV')}" oninput="coSetQ(this.value)">
      ${coTeamF!=='__all'?`<button class="btn sec sm" onclick="coPickTeam('${esc(coTeamF)}')">${t('Chọn cả nhóm')}</button>`:''}
      <button class="btn sec sm" onclick="coClearPeople()">${t('Bỏ chọn hết')}</button>
    </div>
    <div id="coPeopleBox">${coPeopleHtml()}</div>
    <p class="muted sm2">${t('Danh sách này là BẢN ĐIỂM DANH GỐC của khoá — dùng để biết còn ai chưa học. Bảng phân bổ sẽ báo ngay nếu có người trong danh sách chưa được xếp buổi nào, và người chọn ở đây được tích sẵn khi bạn thêm buổi mới.')}</p>
  </div>

  <div class="fg"><label class="fl">${t('Ghi chú (không bắt buộc)')}</label>
    <input class="inp" data-k="coNote" value="${esc(coNote)}" placeholder="${t('VD: Cuối khoá có kiểm tra, mang theo thẻ')}"
           oninput="coNote=this.value"></div>

  <div class="row" style="gap:8px;margin-top:8px">
    <button class="btn ok" style="flex:1" onclick="coSubmit()">${coEditId?'💾 '+t('Lưu khoá'):'➕ '+t('Tạo khoá đào tạo')}</button>
    ${coEditId?`<button class="btn sec" onclick="coNew()">${t('Khoá mới')}</button>`:''}
  </div>

  <h4 style="margin:14px 0 6px">${t('Khoá đã khai')}</h4>
  ${list.length?list.map(c=>{
    const ss=coSessions(c.id);
    const emps=coEmps(c.id);
    const open=coOpenId===c.id;
    const k=coKindInfo(c.kind);
    return `<div class="co-card${open?' on':''}${coEditId===c.id?' edit':''}">
      <div class="co-head">
        <span class="tx"><b>${k.ic} ${esc(c.title||t('Khoá đào tạo'))}</b>
          <i>${esc(t(k.l))}${c.org?' · '+esc(c.org):''} · ${ss.length} ${t('buổi')} · ${
            emps.length} ${t('học viên')} · ${esc(coDateLabel(c.id))}</i>
          ${c.note?`<i class="nt">${esc(c.note)}</i>`:''}</span>
        <span class="ac">
          <button class="btn sec sm" onclick="coOpenMatrix('${c.id}')">${open?'▲ '+t('Đóng'):'👥 '+t('Phân bổ người')}</button>
          <button class="btn sec sm ico" onclick="coEdit('${c.id}')" title="${t('Sửa')}">✏️</button>
          <button class="btn warn sm ico" onclick="coDoDelete('${c.id}')" title="${t('Xoá')}">✕</button>
        </span>
      </div>
      ${open?`<div class="co-body">${coMatrixHtml(c.id)}</div>`:''}
    </div>`;
  }).join(''):`<p class="muted sm2">${t('Chưa có khoá đào tạo nào.')}</p>`}`;
}

/* ============================================================
   BẢNG TỔNG HỢP ĐÀO TẠO   ★ v7.8
   ------------------------------------------------------------
   Hai câu hỏi hay bị hỏi nhất, mỗi câu một bảng:
     · THEO KHOÁ / BUỔI — khoá này mấy buổi, mỗi buổi ai đi, bao nhiêu giờ,
       phát sinh mấy đơn tăng ca.
     · THEO NGƯỜI       — kỳ này ai học bao nhiêu giờ, mấy buổi.
   Mọi con số đều tính bằng CHÍNH các hàm của js/22-training.js, không có
   công thức bản sao ở đây.
   ============================================================ */
let trTblYm='__all';     // lọc kỳ
let trTblBy='course';    // 'course' | 'emp'

function trTblSet(k,v){
  if(k==='ym')trTblYm=v;else trTblBy=v;
  renderTrainMgr();
}
function trInPeriod(tr,ym){
  if(!ym||ym==='__all')return true;
  const p=periodFor(ym);
  return trDays(tr).some(iso=>iso>=p.from&&iso<=p.to);
}
function trTableHtml(){
  const ms=(typeof monthsAvailable==='function')?monthsAvailable():[];
  const all=trAll().filter(tr=>trInPeriod(tr,trTblYm));
  const bar=`
  <div class="ev-tblbar">
    <select class="inp sm" onchange="trTblSet('ym',this.value)">
      <option value="__all"${trTblYm==='__all'?' selected':''}>${t('Tất cả các kỳ')}</option>
      ${ms.map(m=>`<option value="${m}"${trTblYm===m?' selected':''}>${esc(periodFor(m).slim)}</option>`).join('')}
    </select>
    <div class="ab-chips" style="margin:0">
      <button class="abc sm${trTblBy==='course'?' on':''}" onclick="trTblSet('by','course')">📚 ${t('Theo khoá / buổi')}</button>
      <button class="abc sm${trTblBy==='emp'?' on':''}" onclick="trTblSet('by','emp')">👤 ${t('Theo người')}</button>
    </div>
  </div>`;

  if(!all.length)return bar+`<p class="muted sm2" style="margin-top:10px">${t('Kỳ này chưa có buổi đào tạo nào.')}</p>`;

  if(trTblBy==='emp'){
    /* Theo người: mỗi người một dòng, cộng giờ qua mọi buổi họ có mặt */
    const rows={};
    all.forEach(tr=>trEmps(tr).forEach(id=>{
      const r=rows[id]=rows[id]||{id,n:0,h:0,ot:0,att:0,past:0};
      r.n++;r.h+=trHoursOfEmp(tr,id);
      /* ★ v8.0 — mẫu số là số buổi ĐÃ DIỄN RA: "1/3 đã xác nhận" trong khi
         hai buổi kia còn ở tương lai là một lời trách oan. */
      if(trHappened(tr)){r.past++;if(trAttended(tr,id))r.att++;}
      trOtPairs(tr).forEach(p=>{if(String(p.empId)===String(id))r.ot+=trOtHoursOfDay(tr,p.iso);});
    }));
    const list=Object.values(rows).sort((a,b)=>b.h-a.h);
    const sum=list.reduce((s,r)=>({h:s.h+r.h,ot:s.ot+r.ot}),{h:0,ot:0});
    return bar+`
    <div class="ev-tblwrap"><table class="ev-tbl">
      <thead><tr><th>${t('Học viên')}</th><th>${t('Nhóm')}</th><th class="ct">${t('Số buổi')}</th>
        <th class="ct">${t('Giờ đào tạo')}</th><th class="ct">${t('Trong đó tăng ca')}</th>
        <th class="ct">${t('Đã xác nhận tham gia')}</th></tr></thead>
      <tbody>${list.map(r=>{
        const e=empById(r.id)||{};
        const attCls=r.past&&r.att<r.past?'no':(r.past?'yes':'');
        return `<tr><td><b>${esc(shortName(e.name||r.id))}</b></td><td>${esc(e.team||'—')}</td>
          <td class="ct">${r.n}</td><td class="ct"><b>${rnd1(r.h)}</b></td>
          <td class="ct">${r.ot?rnd1(r.ot):'—'}</td>
          <td class="ct att ${attCls}">${r.past?(r.att+'/'+r.past):'<i class="muted">—</i>'}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td colspan="3">${t('Tổng')}</td><td class="ct"><b>${rnd1(sum.h)}</b></td>
        <td class="ct"><b>${rnd1(sum.ot)}</b></td>
        <td class="ct"><b>${list.reduce((a,r)=>a+r.att,0)}/${list.reduce((a,r)=>a+r.past,0)}</b></td></tr></tfoot>
    </table></div>`;
  }

  /* Theo khoá / buổi: buổi thuộc khoá gom dưới dòng khoá, buổi lẻ xếp cuối */
  const byCourse={},loose=[];
  all.forEach(tr=>{
    const cid=tr.courseId&&coById(tr.courseId)?tr.courseId:'';
    if(cid)(byCourse[cid]=byCourse[cid]||[]).push(tr);else loose.push(tr);
  });
  /* ★ v8.0 — hai cột điểm danh. Liệt kê TÊN chứ không chỉ đếm: người đọc
     bảng này đang đi tìm "còn ai chưa học" để gọi đi học, con số không gọi
     được ai. Quản lý bấm thẳng vào tên để tích hộ (điểm danh giấy). */
  const nmOf=id=>esc(shortName((empById(id)||{}).name||id));
  const attCell=(ids,cls,trId)=>{
    if(!ids.length)return `<td class="att ${cls}"><i class="muted">—</i></td>`;
    return `<td class="att ${cls}">${ids.map(id=>trId&&trCanManage()
      ? `<button class="attp" onclick="trToggleAttend('${trId}','${id}')"
           title="${t('Bấm để đổi trạng thái tham gia')}">${nmOf(id)}</button>`
      : `<span class="attp">${nmOf(id)}</span>`).join(' ')}
      <i class="n">${ids.length}</i></td>`;
  };

  const sessRow=(tr,i)=>{
    const emps=trEmps(tr);
    const hEach=emps.length?trHoursOfEmp(tr,emps[0]):0;
    const otH=trOtTotalHours(tr);
    const nReq=trReqsOf(tr.id).length;
    const at=trAttendSplit(tr);
    return `<tr class="ss${trIsActive(tr)?'':' pend'}">
      <td class="ind">${i!=null?(t('Buổi')+' '+(i+1)):'—'} · <b>${esc(tr.title||t('Đào tạo'))}</b>${
        trIsActive(tr)?'':' <span class="st pending">'+t('CHỜ DUYỆT')+'</span>'}</td>
      <td class="nw">${esc(trDateLabel(tr))}</td>
      <td class="nw">${esc(trTimeLabel(tr)||'—')}</td>
      <td class="ct">${emps.length}</td>
      <td class="ct">${rnd1(hEach)}</td>
      <td class="ct">${otH?rnd1(otH):'—'}</td>
      <td class="ct">${nReq||'—'}</td>
      ${trHappened(tr)?attCell(at.done,'yes',tr.id):`<td class="att"><i class="muted">${t('chưa diễn ra')}</i></td>`}
      ${trHappened(tr)?attCell(at.todo,'no',tr.id):'<td class="att"></td>'}
      <td class="nw"><button class="btn sec sm ico" onclick="trEdit('${tr.id}')" title="${t('Sửa')}">✏️</button></td>
    </tr>`;
  };

  const body=Object.keys(byCourse).map(cid=>{
    const c=coById(cid),ss=byCourse[cid].slice()
      .sort((a,b)=>String(trDays(a)[0]||'').localeCompare(String(trDays(b)[0]||'')));
    const emps=coEmps(cid);
    const totH=emps.reduce((s,id)=>s+coHoursOfEmp(cid,id),0);
    const k=coKindInfo(c.kind);
    return `<tr class="co"><td colspan="3"><b>${k.ic} ${esc(c.title||'')}</b>
        <i>${esc(t(k.l))}${c.org?' · '+esc(c.org):''}</i></td>
      <td class="ct"><b>${emps.length}</b></td><td class="ct">—</td>
      <td class="ct">—</td><td class="ct">—</td>
      ${attCell(coAttendSplit(cid).done,'yes','')}
      ${attCell(coAttendSplit(cid).todo,'no','')}
      <td class="nw"><button class="btn sec sm" onclick="coOpenMatrixFromTable('${cid}')">👥</button></td></tr>`
      +ss.map((tr,i)=>sessRow(tr,i)).join('')
      +`<tr class="cosum"><td colspan="4">${t('Cộng khoá')}</td><td class="ct">—</td>
        <td class="ct">${rnd1(ss.reduce((s,tr)=>s+trOtTotalHours(tr),0))}</td>
        <td class="ct">${ss.reduce((s,tr)=>s+trReqsOf(tr.id).length,0)||'—'}</td>
        <td class="ct">${coAttendSplit(cid).done.length}</td>
        <td class="ct">${coAttendSplit(cid).todo.length}</td>
        <td class="ct" title="${t('tổng giờ học của cả lớp')}">${rnd1(totH)}h</td></tr>`;
  }).join('')
  +(loose.length?`<tr class="co"><td colspan="10"><b>📌 ${t('Buổi lẻ (không thuộc khoá nào)')}</b></td></tr>`
    +loose.map(tr=>sessRow(tr,null)).join(''):'');

  return bar+`
  <div class="ev-tblwrap"><table class="ev-tbl tr-tbl">
    <thead><tr><th>${t('Khoá / Buổi')}</th><th>${t('Ngày')}</th><th>${t('Giờ học')}</th>
      <th class="ct">${t('Người')}</th><th class="ct">${t('Giờ/người')}</th>
      <th class="ct">${t('Giờ tăng ca')}</th><th class="ct">${t('Đơn OT')}</th>
      <th class="att yes">✅ ${t('Đã tham gia')}</th><th class="att no">○ ${t('Chưa tham gia')}</th>
      <th></th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}
/* Bấm 👥 ở bảng → nhảy sang màn Khoá và mở sẵn bảng phân bổ của khoá đó */
function coOpenMatrixFromTable(cid){
  coOpenId=cid;coLoadMatrix(cid);
  trView='course';
  renderTrainMgr();
}
