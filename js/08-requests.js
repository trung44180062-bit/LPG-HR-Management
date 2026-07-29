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
        : {iso:d.iso,code:d.code||r.code||'',timeIn:d.timeIn||r.timeIn||'',timeOut:d.timeOut||r.timeOut||''});
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
      <span>Giờ vào: ${esc(r.timeIn||'')}</span><span>Giờ ra: ${esc(r.timeOut||'')}</span></div></div>`;
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
  if(w.cD<S.settings.minD)parts.push(`ca D còn ${w.cD}/${S.settings.minD}`);
  if(w.cN<S.settings.minN)parts.push(`ca N còn ${w.cN}/${S.settings.minN}`);
  return `<div class="hint" style="background:#FEF2F2;color:#991B1B;margin-top:6px">⚠️ Nếu duyệt: ngày ${fmtVN(w.iso)} ${parts.join(', ')}${warnings.length>1?` (+${warnings.length-1} ngày khác)`:''}</div>`;
}
function reqCard(r,withActs){
  const{e,body}=reqDesc(r);
  return `<div class="req">
    <div class="top"><span class="who">${esc(e?e.name:r.empId)}</span>
      <span class="st ${r.status}">${{pending:'CHỜ DUYỆT',approved:'ĐÃ DUYỆT',rejected:'TỪ CHỐI'}[r.status]}</span>
      <span class="src ${r.source}">${{zalo:'Zalo',app:'📱 App NV'}[r.source]||'Web'}</span>
      ${r.printedAt?'<span class="src" style="background:#E7EFF6;color:var(--brand)">🖨️ đã in</span>':''}</div>
    <div class="body">${body}</div>
    ${withActs?apprWarnLine(r):''}
    <div class="meta"><span>Gửi: ${new Date(r.createdAt).toLocaleString('vi-VN')}</span>
      ${r.decidedAt?`<span>Duyệt: ${new Date(r.decidedAt).toLocaleString('vi-VN')}</span>`:''}
      ${r.reason?`<span>Lý do: ${esc(r.reason)}</span>`:''}</div>
    <div class="acts">
      ${withActs?`<button class="btn ok sm" onclick="decide('${r.id}',true)">✓ Duyệt</button>
      <button class="btn warn sm" onclick="decide('${r.id}',false)">✕ Từ chối</button>`:''}
      ${r.status!=='rejected'?`<button class="btn sec sm" onclick="printOne('${r.id}')">🖨️ In</button>`:''}
    </div>
  </div>`;
}
/* =================== DUYỆT =================== */
function renderAppr(){
  $('apprLock').style.display=mgr?'none':'';
  $('apprBody').style.display=mgr?'':'none';
  if(!mgr)return;
  const all=Object.values(S.requests).sort((a,b)=>b.createdAt-a.createdAt);
  const pend=all.filter(r=>r.status==='pending');
  $('pendCount').textContent=pend.length;
  $('pendList').innerHTML=pend.map(r=>reqCard(r,true)).join('')||'<p class="muted">Không có yêu cầu chờ duyệt. 👍</p>';
  $('histList').innerHTML=all.filter(r=>r.status!=='pending').slice(0,30).map(r=>reqCard(r,false)).join('')||'<p class="muted">Trống.</p>';
}
function* dateRange(f,t){let d=new Date(f+'T00:00:00');const e=new Date(t+'T00:00:00');let g=0;while(d<=e&&g++<62){yield isoOf(d);d.setDate(d.getDate()+1);}}
function decide(id,ok){
  const r=S.requests[id];if(!r||r.status!=='pending')return;
  if(!ok){
    const reason=prompt('Lý do từ chối (tuỳ chọn):')||'';
    r.status='rejected';r.reason=reason;r.decidedAt=Date.now();r.decidedBy='manager';
    save();renderAppr();toast('Đã từ chối');return;
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
  }else{
    for(const d of reqDays(r)){
      if(!d.code)continue;
      S.over[r.empId]=S.over[r.empId]||{};
      S.over[r.empId][d.iso]={code:d.code,reqId:id,by:'approve',at:Date.now()};
    }
  }
  r.status='approved';r.decidedAt=Date.now();r.decidedBy='manager';
  save();renderAppr();renderReal();toast('Đã duyệt & cập nhật lịch thực tế');
}
