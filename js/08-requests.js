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
function baseShiftOf(code){
  if(code==='D'||code==='SD'||code==='OTD')return 'D';
  if(code==='N'||code==='SN'||code==='OTN')return 'N';
  if(code==='O'||code==='SO')return 'O';
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
   HUỶ / XOÁ ĐƠN
   Đơn đã duyệt đã ghi vào lịch thực tế (S.over[...] mang reqId).
   Huỷ đơn thì gỡ đúng những ô lịch do đơn đó sinh ra → lịch trả về
   ca chuẩn; đơn đổi ca gỡ cho CẢ HAI người.
   Huỷ đơn = XOÁ HẲN, không giữ bản ghi 'đã huỷ' — mỗi đơn nằm lại là
   thêm dữ liệu phải đồng bộ, mà gói Firebase Spark tính băng thông.
   ============================================================ */
const REQ_ST_LABEL={pending:'CHỜ DUYỆT',approved:'ĐÃ DUYỆT',rejected:'TỪ CHỐI'};
const REQ_DEAD=st=>st==='rejected';

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
  if(mgr)return true;                        // duyệt đơn / quản trị: huỷ được mọi đơn
  if(r.empId!==who&&r.byId!==who)return false;
  if(r.printedAt)return false;               // đã in nộp nhân sự → nhờ quản lý huỷ
  return r.status==='pending'||r.status==='approved';
}
/* HUỶ ĐƠN = XOÁ HẲN.
   Không giữ lại bản ghi "đã huỷ": mỗi đơn nằm lại là thêm dữ liệu phải đồng bộ
   qua Firebase, mà gói Spark tính băng thông — đơn đã huỷ thì không ai tra nữa.
   Nếu đơn đã duyệt thì gỡ luôn các ô lịch do nó tạo ra (đổi ca gỡ cho cả 2 người). */
function cancelReq(rid){
  const r=S.requests[rid];if(!r)return null;
  const reverted=(r.status==='approved')?revertReqSchedule(rid):0;
  delete S.requests[rid];
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
  const beB=iso=>(r.beforeW&&r.beforeW[iso]!==undefined)?r.beforeW[iso]:eff(r.withId,iso).code;
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
    const a=empById(r.empId),b=empById(r.withId);
    rows=days.map(d=>{
      const ca=beA(d.iso), cb=beB(d.iso);
      return `<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
        <span><b>${esc(a?a.name:'')}</b>: ${codeChip(ca)} → ${codeChip(cb)}</span>
        <span><b>${esc(b?b.name:'')}</b>: ${codeChip(cb)} → ${codeChip(ca)}</span></div>`;
    }).join('');
  }else if(r.type==='ot'){
    rows=days.map(d=>{
      const hrs=d.hours||otHours(d.iso,d.timeIn,d.isoEnd,d.timeOut)||getHours(d.code||'OTD');
      const end=(d.isoEnd&&d.isoEnd!==d.iso)?(' '+fmtVN(d.isoEnd)):'';
      return `<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
        ${codeChip(d.code)}<span>${esc(d.timeIn||'')} → ${esc(d.timeOut||'')}${end}</span>
        <span><b>${rnd1(hrs)}h</b></span></div>`;
    }).join('');
  }else{
    rows=days.map(d=>{
      const cur=beA(d.iso);
      return `<div class="dt"><span class="dtd">${fmtVN(d.iso)} ${dowOf(d.iso)}</span>
        <span>${codeChip(cur)} → ${codeChip(d.code)}</span></div>`;
    }).join('');
  }
  return `<div class="reqdt">${rows}</div>`;
}
function reqDesc(r){
  const e=empById(r.empId),w=r.withId?empById(r.withId):null;
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
function apprWarnLine(r){
  if(r.status!=='pending')return '';
  const catOf=c=>c==='D'||c==='SD'||c==='OTD'?'D':(c==='N'||c==='SN'||c==='OTN'?'N':null);
  const warnings=[];
  for(const d of reqDays(r)){
    const iso=d.iso;
    const B=mpBuckets(iso);let cD=B.D.length,cN=B.N.length;
    const applyDelta=(fromCode,toCode)=>{const fc=catOf(fromCode),tc=catOf(toCode);if(fc==='D')cD--;if(fc==='N')cN--;if(tc==='D')cD++;if(tc==='N')cN++;};
    const curA=eff(r.empId,iso).code;
    if(r.type==='swap'&&r.withId){const curB=eff(r.withId,iso).code;applyDelta(curA,curB);applyDelta(curB,curA);}
    else applyDelta(curA,d.code);
    if(cD<S.settings.minD||cN<S.settings.minN)warnings.push({iso,cD,cN});
  }
  if(!warnings.length)return '';
  const w=warnings[0],parts=[];
  if(w.cD<S.settings.minD)parts.push(`${t('ca D còn')} ${w.cD}/${S.settings.minD}`);
  if(w.cN<S.settings.minN)parts.push(`${t('ca N còn')} ${w.cN}/${S.settings.minN}`);
  return `<div class="hint" style="background:#FEF2F2;color:#991B1B;margin-top:6px">${t('⚠️ Nếu duyệt: ngày')} ${fmtVN(w.iso)} ${parts.join(', ')}${warnings.length>1?` (+${warnings.length-1} ${t('ngày khác)')}`:''}</div>`;
}
/* ============================================================
   MÀN DUYỆT — danh sách gọn, lọc nhanh, bấm để mở chi tiết
   Trước đây mỗi đơn là một thẻ to kèm 5 nút → rối và khó kiểm soát.
   Nay: 1 đơn = 1 dòng (ai · loại · ngày · trạng thái) + 2 nút chính;
   bấm vào dòng mới bung chi tiết từng ngày và các nút phụ.
   ============================================================ */
let apprFilter={status:'pending',print:'__all',type:'__all',q:'',ym:'__all',from:'',to:''};
let apprOpen={};                       // id đơn đang bung chi tiết

function apprSetFilter(k,v){
  apprFilter[k]=v;
  if(k==='ym'&&v!=='__all'&&v!=='__range'){apprFilter.from='';apprFilter.to='';}
  if(k==='from'||k==='to')apprFilter.ym='__range';
  renderAppr();
}
function apprToggleRow(id){apprOpen[id]=!apprOpen[id];renderAppr();}
function apprResetFilter(){
  apprFilter={status:'__all',print:'__all',type:'__all',q:'',ym:'__all',from:'',to:''};
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
/* Đơn khớp bộ lọc hiện tại */
function apprMatch(r){
  if(apprFilter.status!=='__all'&&r.status!==apprFilter.status)return false;
  if(apprFilter.print==='yes'&&!r.printedAt)return false;
  if(apprFilter.print==='no'&&r.printedAt)return false;
  if(apprFilter.type!=='__all'&&r.type!==apprFilter.type)return false;
  const rg=apprRange();
  if(rg&&!reqInRange(r,rg[0],rg[1]))return false;
  const q=noAccent(apprFilter.q||'');
  if(q){
    const e=empById(r.empId),w=r.withId?empById(r.withId):null;
    const hay=noAccent([e&&e.name,r.empId,w&&w.name,r.note].filter(Boolean).join(' '));
    if(!hay.includes(q))return false;
  }
  return true;
}
/* Một dòng đơn */
function apprRow(r){
  const e=empById(r.empId), w=r.withId?empById(r.withId):null;
  const open=!!apprOpen[r.id];
  const days=r.type==='multi'?0:reqDays(r).length;
  const when=r.type==='multi'
    ? fmtVN(r.from)+' → '+fmtVN(r.to)
    : (days<=1?fmtVNfull(r.from):`${fmtVN(r.from)} → ${fmtVN(r.to)} · ${days} ${t('ngày')}`);
  const sub=[when];
  if(w)sub.push(t('với')+' '+shortName(w.name||r.withId));
  if(r.byId&&r.byId!==r.empId)sub.push(t('khai hộ'));
  return `<div class="ar ${r.status}${open?' open':''}${r.printedAt?' printed':''}">
    <div class="ar-h">
      <label class="ar-ck"><input type="checkbox" class="rqChk" value="${r.id}" onchange="apprPickCount()"></label>
      <span class="ar-ic">${REQ_ICON[r.type]||'📄'}</span>
      <button type="button" class="ar-txt" onclick="apprToggleRow('${r.id}')">
        <span class="l1"><b>${esc(e?e.name:r.empId)}</b>
          <i class="typ">${esc(REQ_LABEL[r.type]||r.type)}</i>
          <span class="st ${r.status}">${REQ_ST_LABEL[r.status]||r.status}</span>
          <span class="prt ${r.printedAt?'yes':'no'}">${r.printedAt?'🖨️ '+t('đã in'):'○ '+t('chưa in')}</span></span>
        <span class="l2">${esc(sub.join(' · '))}</span>
      </button>
      <span class="ar-act">
        ${r.status==='pending'?`<button class="btn ok sm" onclick="decide('${r.id}',true)" title="Duyệt">✓</button>
        <button class="btn warn sm" onclick="decide('${r.id}',false)" title="Từ chối">✕</button>`:''}
        <button type="button" class="ar-more" onclick="apprToggleRow('${r.id}')" title="Chi tiết">▾</button>
      </span>
    </div>
    <div class="ar-d">
      ${reqDetail(r)}
      ${r.status==='pending'?apprWarnLine(r):''}
      ${r.note?`<div class="muted sm2">Ghi chú: “${esc(r.note)}”</div>`:''}
      <div class="ar-meta">
        <span>Gửi: ${fmtDateTime(r.createdAt)}</span>
        ${r.decidedAt?`<span>Duyệt: ${fmtDateTime(r.decidedAt)}</span>`:''}
        ${r.printedAt?`<span>In: ${fmtDateTime(r.printedAt)}${r.printCount>1?' ×'+r.printCount:''}</span>`:''}
        ${r.reason?`<span>Lý do: ${esc(r.reason)}</span>`:''}
        <span class="src ${r.source}">${{zalo:'Zalo',app:'📱 App NV'}[r.source]||'Web'}</span>
      </div>
      <div class="ar-more-act">
        <button class="btn sec sm pc-only" onclick="printOne('${r.id}')">🖨️ In</button>
        <button class="btn warn sm" onclick="cancelOneReq('${r.id}')">🚫 Huỷ đơn</button>
      </div>
    </div>
  </div>`;
}
function reqCard(r,withActs,pick){return apprRow(r);}

/* =================== DUYỆT =================== */
function renderAppr(){
  const lock=$('apprLock'),body=$('apprBody');
  if(!lock||!body)return;
  lock.style.display=mgr?'none':'';
  body.style.display=mgr?'':'none';
  if(!mgr)return;
  const all=Object.values(S.requests).sort((a,b)=>b.createdAt-a.createdAt);
  /* Đếm theo từng chip: giữ nguyên các bộ lọc khác để con số phản ánh đúng */
  const countWith=(k,v)=>{
    const save=apprFilter[k];apprFilter[k]=v;
    const n=all.filter(apprMatch).length;apprFilter[k]=save;return n;
  };
  const stChips=[['pending','⏳ Chờ duyệt'],['approved','✅ Đã duyệt'],['rejected','❌ Từ chối'],['__all','Tất cả']];
  const prChips=[['__all','Mọi đơn'],['no','○ Chưa in'],['yes','🖨️ Đã in']];
  const ms=monthsAvailable();

  $('apprBar').innerHTML=`
    <div class="ab-chips">${stChips.map(([k,l])=>
      `<button class="abc${apprFilter.status===k?' on':''}" onclick="apprSetFilter('status','${k}')">${l}<i>${countWith('status',k)}</i></button>`).join('')}
    </div>
    <div class="ab-chips">${prChips.map(([k,l])=>
      `<button class="abc sm${apprFilter.print===k?' on':''}" onclick="apprSetFilter('print','${k}')">${l}<i>${countWith('print',k)}</i></button>`).join('')}
    </div>
    <div class="ab-tools">
      <input class="inp sm" id="apprSearchBox" placeholder="Tìm theo tên nhân viên…" value="${esc(apprFilter.q)}"
             oninput="apprFilter.q=this.value;clearTimeout(window._abT);window._abT=setTimeout(renderApprList,200)">
      <select class="inp sm" onchange="apprSetFilter('type',this.value)">
        <option value="__all">Mọi loại đơn</option>
        ${Object.keys(REQ_LABEL).map(k=>`<option value="${k}"${apprFilter.type===k?' selected':''}>${esc(REQ_LABEL[k])}</option>`).join('')}
      </select>
      <select class="inp sm" onchange="apprSetFilter('ym',this.value)">
        <option value="__all"${apprFilter.ym==='__all'?' selected':''}>Mọi kỳ công</option>
        ${ms.map(m=>`<option value="${m}"${apprFilter.ym===m?' selected':''}>${periodFor(m).label}</option>`).join('')}
        <option value="__range"${apprFilter.ym==='__range'?' selected':''}>Khoảng ngày tự chọn…</option>
      </select>
      ${apprFilter.ym==='__range'?`
        <label class="fl2">Từ</label><input type="date" class="inp sm" value="${apprFilter.from}" onchange="apprSetFilter('from',this.value)">
        <label class="fl2">Đến</label><input type="date" class="inp sm" value="${apprFilter.to}" onchange="apprSetFilter('to',this.value)">`:''}
      <button class="btn sec sm" onclick="apprResetFilter()">↺ Bỏ lọc</button>
      <span class="sp"></span>
      <button class="btn sm pc-only" style="position:relative" onclick="openPrintBulk()">🖨️ In đơn<span class="bdg" id="printBdgAppr" style="display:none;position:static;margin-left:6px">0</span></button>
      <button class="btn warn sm admin-only" onclick="apprPurgeFiltered()">🗑️ Dọn dữ liệu đang lọc</button>
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
  box.innerHTML=list.length
    ? `<div class="ar-list">${list.slice(0,150).map(apprRow).join('')}</div>`
      +(list.length>150?`<p class="muted sm2" style="margin-top:8px">Đang hiện 150 đơn mới nhất trong ${list.length} đơn khớp bộ lọc.</p>`:'')
    : `<div class="card"><p class="muted">Không có đơn nào khớp bộ lọc.</p></div>`;
  apprPickCount();
}

/* Dọn toàn bộ đơn đang khớp bộ lọc — dùng để xoá bớt dữ liệu cũ theo kỳ / khoảng ngày,
   giữ dung lượng Firebase gói Spark ở mức thấp. */
function apprPurgeFiltered(){
  if(!adm){toast(t('Cần quyền quản trị'));return;}
  const list=Object.values(S.requests).filter(apprMatch);
  if(!list.length){toast(t('Không có đơn nào khớp bộ lọc.'));return;}
  const rg=apprRange();
  const pend=list.filter(r=>r.status==='pending').length;
  let m=t('Xoá hẳn')+' '+list.length+' '+t('đơn đang lọc?')
       +(rg?`\n${t('Khoảng ngày')}: ${fmtVNfull(rg[0])} → ${fmtVNfull(rg[1])}`:'')
       +(pend?`\n⚠️ ${t('Trong đó có')} ${pend} ${t('đơn đang chờ duyệt.')}`:'')
       +'\n'+t('Đơn đã duyệt sẽ được hoàn tác khỏi lịch thực tế. Không tra lại được.');
  if(!confirm(m))return;
  let rev=0;list.forEach(r=>{rev+=purgeReq(r.id);});
  apprAfterChange(t('Đã xoá')+' '+list.length+' '+t('đơn')+(rev?' · '+t('hoàn tác')+' '+rev+' '+t('ô lịch'):''));
}

/* ---- Chọn nhiều đơn để duyệt / từ chối / xoá hàng loạt (màn Duyệt) ---- */
function apprPicked(){return [...document.querySelectorAll('.rqChk:checked')].map(c=>c.value).filter(id=>S.requests[id]);}
function apprPickAll(on){document.querySelectorAll('.rqChk').forEach(c=>{c.checked=!!on;});apprPickCount();}
function apprPickCount(){
  const n=apprPicked().length, box=$('apprBulk');
  if(!box)return;
  if(!n){box.className='appr-bulk';box.innerHTML='';return;}
  box.className='appr-bulk on';
  box.innerHTML=`<b>${n} ${t('đơn đã chọn')}</b>
    <button class="btn ok sm" onclick="decidePickedReqs(true)">✓ ${t('Duyệt')}</button>
    <button class="btn warn sm" onclick="decidePickedReqs(false)">✕ ${t('Từ chối')}</button>
    <button class="btn sec sm pc-only" onclick="printPickedReqs()">🖨️ ${t('In')}</button>
    <button class="btn warn sm" onclick="cancelPickedReqs()">🗑️ ${t('Xoá đơn')}</button>
    <span class="sp"></span>
    <button class="btn sec sm" onclick="apprPickAll(true)">${t('Chọn hết')}</button>
    <button class="btn sec sm" onclick="apprPickAll(false)">${t('Bỏ chọn')}</button>`;
  if(typeof applyRoleUI==='function')applyRoleUI();
}
function apprAfterChange(msg){
  save();renderAppr();
  if(typeof renderCal==='function'&&curView==='cal')renderCal();
  if(typeof renderMe==='function')renderMe(true);
  refreshBadge();
  if(typeof refreshPrintBadge==='function')refreshPrintBadge();
  toast(msg);
}
/* Duyệt / từ chối hàng loạt */
function decidePickedReqs(ok){
  const ids=apprPicked().filter(id=>S.requests[id]&&S.requests[id].status==='pending');
  if(!ids.length){toast(t('Không có đơn nào đang chờ duyệt trong danh sách đã chọn'));return;}
  if(!confirm((ok?t('Duyệt'):t('Từ chối'))+' '+ids.length+' '+t('đơn đã chọn?')))return;
  let reason='';
  if(!ok)reason=prompt(t('Lý do từ chối (tuỳ chọn):'))||'';
  ids.forEach(id=>{
    const r=S.requests[id];if(!r||r.status!=='pending')return;
    if(ok)decide(id,true,true);
    else{r.status='rejected';r.reason=reason;r.decidedAt=Date.now();r.decidedBy=meId()||'manager';}
  });
  apprAfterChange((ok?t('Đã duyệt'):t('Đã từ chối'))+' '+ids.length+' '+t('đơn'));
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
  if(!confirm(cancelWarnText([r])))return;
  const x=cancelReq(rid);
  apprAfterChange(t('Đã xoá đơn')+(x&&x.reverted?' · '+t('hoàn tác')+' '+x.reverted+' '+t('ô lịch'):''));
}
function purgeOneReq(rid){cancelOneReq(rid);}
function cancelPickedReqs(){
  const ids=apprPicked();
  if(!ids.length){toast(t('Chưa chọn đơn nào'));return;}
  const list=ids.map(id=>S.requests[id]).filter(Boolean);
  if(!confirm(cancelWarnText(list)))return;
  let rev=0;list.forEach(r=>{const x=cancelReq(r.id);if(x)rev+=x.reverted;});
  apprAfterChange(t('Đã xoá')+' '+list.length+' '+t('đơn')+(rev?' · '+t('hoàn tác')+' '+rev+' '+t('ô lịch'):''));
}
function purgePickedReqs(){cancelPickedReqs();}
/* In ngay các đơn đang chọn */
function printPickedReqs(){
  const ids=apprPicked();
  if(!ids.length){toast(t('Chưa chọn đơn nào'));return;}
  printRequests(ids.map(id=>S.requests[id]).filter(Boolean),'a5');
}
function* dateRange(f,t){let d=new Date(f+'T00:00:00');const e=new Date(t+'T00:00:00');let g=0;while(d<=e&&g++<62){yield isoOf(d);d.setDate(d.getDate()+1);}}
function decide(id,ok,bulk){
  const r=S.requests[id];if(!r||r.status!=='pending')return;
  if(!ok){
    const reason=prompt(t('Lý do từ chối (tuỳ chọn):'))||'';
    r.status='rejected';r.reason=reason;r.decidedAt=Date.now();r.decidedBy=meId()||'manager';
    if(!bulk){save();renderAppr();toast(t('Đã từ chối'));}
    return;
  }
  if(r.type==='swap'){
    for(const d of reqDays(r)){
      const iso=d.iso;
      const a=eff(r.empId,iso).code,b=eff(r.withId,iso).code;
      S.over[r.empId]=S.over[r.empId]||{};S.over[r.withId]=S.over[r.withId]||{};
      S.over[r.empId][iso]={code:b||'',reqId:id,by:'approve',at:Date.now()};
      S.over[r.withId][iso]={code:a||'',reqId:id,by:'approve',at:Date.now()};
    }
  }else if(r.type==='wt'||r.type==='late'||r.type==='multi'){
    // Đơn giấy tờ thuần — KHÔNG ghi đè lịch ca (không tạo override)
  }else if(r.type==='ot'){
    /* Một ngày có thể tăng ca nhiều lần → CỘNG giờ của các lần trong cùng ngày,
       mã ca lấy theo lần dài nhất để ô lịch hiện cho dễ nhìn. */
    const byDay={};
    reqDays(r).forEach(d=>{
      if(!d.code)return;
      const h=d.hours||otHours(d.iso,d.timeIn,d.isoEnd,d.timeOut)||getHours(d.code);
      const g=byDay[d.iso]||(byDay[d.iso]={hours:0,code:d.code,best:0});
      g.hours+=h;
      if(h>g.best){g.best=h;g.code=d.code;}
    });
    S.over[r.empId]=S.over[r.empId]||{};
    for(const iso in byDay){
      S.over[r.empId][iso]={code:byDay[iso].code,hours:Math.round(byDay[iso].hours*10)/10,
                            reqId:id,by:'approve',at:Date.now()};
    }
  }else{
    for(const d of reqDays(r)){
      if(!d.code)continue;
      S.over[r.empId]=S.over[r.empId]||{};
      S.over[r.empId][d.iso]={code:d.code,reqId:id,by:'approve',at:Date.now()};
    }
  }
  r.status='approved';r.decidedAt=Date.now();r.decidedBy=meId()||'manager';
  if(bulk)return;
  save();renderAppr();renderReal();renderMe(true);refreshBadge();
  toast(t('Đã duyệt & cập nhật lịch thực tế'));
}
