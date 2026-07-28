/* ============================================================
   DANG KY + DUYET don
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== ĐĂNG KÝ =================== */
function renderReg(){
  const opts=activeEmps().map(e=>`<option value="${e.id}">${esc(e.name||e.id)} — ${esc(e.pos||'')}</option>`).join('');
  const w=$('regWho').value;$('regWho').innerHTML=opts;if(w)$('regWho').value=w;
  const sw=$('regSwapWith').value;$('regSwapWith').innerHTML=opts;if(sw)$('regSwapWith').value=sw;
  const me=localStorage.getItem(LS+'_me');if(me&&empById(me))$('regWho').value=me;
  regTypeUI();renderMyReqs();
}
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
// Đọc các field riêng của 3 loại đơn mới (wt/late/multi); prefix = 'reg' (tab Đăng ký) hoặc 'me' (Của tôi)
function readExtraFields(empId,type,prefix,from){
  const g=k=>{const el=$(prefix+k);return el?el.value:'';};
  if(type==='wt'){
    const reasonCode=g('WtReason')||'forgot_card';
    let timeIn=g('WtIn'),timeOut=g('WtOut');
    if(!timeIn||!timeOut){
      const b=baseShiftOf(eff(empId,from).code);
      const hrs=b?SHIFT_HOURS[b]:['08:00','17:00'];
      timeIn=timeIn||hrs[0];timeOut=timeOut||hrs[1];
    }
    return{reasonCode,reasonOther:reasonCode==='other'?g('WtOther').trim():'',guarantorId:g('WtGuarantor')||'',timeIn,timeOut};
  }
  if(type==='late')return{subType:g('LateType')||'come_late',timeFrom:g('LateFrom')||'',timeTo:g('LateTo')||''};
  if(type==='multi')return{timeIn:g('MultiIn')||'08:00',timeOut:g('MultiOut')||'17:00'};
  return{};
}
function fillGuarantorSel(selId,excludeId){
  const el=$(selId);if(!el)return;
  el.innerHTML='<option value="">— Không có —</option>'+activeEmps().filter(e=>e.id!==excludeId).map(e=>`<option value="${e.id}">${esc(e.name||e.id)}</option>`).join('');
}
function regTypeUI(){
  const t=$('regType').value;
  $('regSwapBox').style.display=t==='swap'?'':'none';
  $('regCodeBox').style.display=(t==='swap'||t==='wt'||t==='late'||t==='multi')?'none':'';
  $('regWtBox').style.display=t==='wt'?'':'none';
  $('regLateBox').style.display=t==='late'?'':'none';
  $('regMultiBox').style.display=t==='multi'?'':'none';
  if(t==='wt'){fillGuarantorSel('regWtGuarantor',$('regWho').value);regWtReasonUI();}
  let codes;
  if(t==='leave')codes=allCodes().filter(c=>c.cat==='leave');
  else if(t==='ot')codes=allCodes().filter(c=>c.cat==='ot');
  else codes=allCodes().filter(c=>c.cat==='work'||c.cat==='rest'||c.cat==='swap');
  $('regCode').innerHTML=codes.map(c=>`<option value="${c.c}">${c.c} — ${c.l}</option>`).join('');
}
function regWtReasonUI(){$('regWtOther').style.display=$('regWtReason').value==='other'?'':'none';}
function submitReq(){
  const empId=$('regWho').value,type=$('regType').value,from=$('regFrom').value;
  let to=$('regTo').value||from;
  if(!empId){toast('Chọn tên bạn');return;}
  if(!from){toast('Chọn ngày');return;}
  if(to<from){toast('Ngày kết thúc < ngày bắt đầu');return;}
  const r={id:uid(),empId,type,from,to,code:type==='swap'?'':$('regCode').value,
    withId:type==='swap'?$('regSwapWith').value:'',
    note:$('regNote').value.trim(),status:'pending',source:'web',createdAt:Date.now()};
  if(type==='swap'&&(!r.withId||r.withId===empId)){toast('Chọn người đổi ca hợp lệ');return;}
  Object.assign(r,readExtraFields(empId,type,'reg',from));
  // Chụp lại ca hiện tại (trước khi đổi) để hiển thị chi tiết ổn định về sau
  r.before={};if(type==='swap')r.beforeW={};
  for(const iso of dateRange(from,to)){r.before[iso]=eff(empId,iso).code||'';if(type==='swap')r.beforeW[iso]=eff(r.withId,iso).code||'';}
  S.requests[r.id]=r;
  localStorage.setItem(LS+'_me',empId);
  save();$('regNote').value='';$('regFrom').value='';$('regTo').value='';
  toastWithPrint('Đã gửi yêu cầu — chờ duyệt',r.id);renderMyReqs();
}
function codeChip(c){return c?chip(c):'<span class="muted" style="font-weight:700">—</span>';}
// Chi tiết theo từng ngày: hiện ca hiện tại → ca sau khi duyệt để người duyệt thấy rõ.
function wtReasonLabel(r){
  const def=WT_REASONS.find(x=>x.v===r.reasonCode);
  if(!def)return '';
  return def.v==='other'?('Khác: '+(r.reasonOther||'')):(def.vn+' / '+def.en);
}
function reqDetail(r){
  if(r.type==='wt'){
    const g=r.guarantorId?empById(r.guarantorId):null;
    return `<div class="reqdt"><div class="dt"><span class="dtd">${fmtVN(r.from)}</span>
      <span>${esc(r.timeIn||'')} → ${esc(r.timeOut||'')}</span>
      <span>Lý do: <b>${esc(wtReasonLabel(r))}</b></span>
      ${g?`<span>Người bảo lãnh: <b>${esc(g.name)}</b></span>`:''}</div></div>`;
  }
  if(r.type==='late'){
    const tn=r.subType==='leave_early'?'Về sớm':'Đi trễ';
    return `<div class="reqdt"><div class="dt"><span class="dtd">${fmtVN(r.from)}</span>
      <span><b>${tn}</b></span><span>${esc(r.timeFrom||'')} → ${esc(r.timeTo||'')}</span></div></div>`;
  }
  if(r.type==='multi'){
    return `<div class="reqdt"><div class="dt"><span class="dtd">${fmtVN(r.from)} → ${fmtVN(r.to)}</span>
      <span>Giờ vào: ${esc(r.timeIn||'')}</span><span>Giờ ra: ${esc(r.timeOut||'')}</span></div></div>`;
  }
  const days=[...dateRange(r.from,r.to)];
  if(!days.length)return '';
  let rows='';
  const beA=iso=>(r.before&&r.before[iso]!==undefined)?r.before[iso]:eff(r.empId,iso).code;
  const beB=iso=>(r.beforeW&&r.beforeW[iso]!==undefined)?r.beforeW[iso]:eff(r.withId,iso).code;
  if(r.type==='swap'){
    const a=empById(r.empId),b=empById(r.withId);
    rows=days.map(iso=>{
      const ca=beA(iso), cb=beB(iso);
      return `<div class="dt"><span class="dtd">${fmtVN(iso)} ${dowOf(iso)}</span>
        <span><b>${esc(a?a.name:'')}</b>: ${codeChip(ca)} → ${codeChip(cb)}</span>
        <span><b>${esc(b?b.name:'')}</b>: ${codeChip(cb)} → ${codeChip(ca)}</span></div>`;
    }).join('');
  }else{
    rows=days.map(iso=>{
      const cur=beA(iso);
      return `<div class="dt"><span class="dtd">${fmtVN(iso)} ${dowOf(iso)}</span>
        <span>${codeChip(cur)} → ${codeChip(r.code)}</span></div>`;
    }).join('');
  }
  return `<div class="reqdt">${rows}</div>`;
}
function reqDesc(r){
  const e=empById(r.empId),w=r.withId?empById(r.withId):null;
  const range=r.from===r.to?fmtVNfull(r.from):fmtVNfull(r.from)+' → '+fmtVNfull(r.to);
  const tn={leave:'Đăng ký nghỉ',swap:'Đổi ca',ot:'Tăng ca',change:'Đổi mã ca',wt:'Bổ sung công',late:'Đi trễ/Về sớm',multi:'Làm liên tục nhiều ngày'}[r.type]||r.type;
  let body=`<b>${tn}</b> · ${range}`;
  if(r.type!=='swap'&&r.type!=='wt'&&r.type!=='late'&&r.type!=='multi'&&r.code)body+=` · áp mã ${chip(r.code)}`;
  if(w)body+=` · với <b>${esc(w.name)}</b>`;
  body+=reqDetail(r);
  if(r.note)body+=`<div class="muted" style="margin-top:5px">Ghi chú: “${esc(r.note)}”</div>`;
  return {e,body};
}
function apprWarnLine(r){
  if(r.status!=='pending')return '';
  const catOf=c=>c==='D'||c==='SD'||c==='OTD'?'D':(c==='N'||c==='SN'||c==='OTN'?'N':null);
  const warnings=[];
  for(const iso of dateRange(r.from,r.to)){
    const B=mpBuckets(iso);let cD=B.D.length,cN=B.N.length;
    const applyDelta=(fromCode,toCode)=>{const fc=catOf(fromCode),tc=catOf(toCode);if(fc==='D')cD--;if(fc==='N')cN--;if(tc==='D')cD++;if(tc==='N')cN++;};
    const curA=eff(r.empId,iso).code;
    if(r.type==='swap'&&r.withId){const curB=eff(r.withId,iso).code;applyDelta(curA,curB);applyDelta(curB,curA);}
    else applyDelta(curA,r.code);
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
function renderMyReqs(){
  const me=$('regWho').value;
  const list=Object.values(S.requests).filter(r=>r.empId===me||r.withId===me).sort((a,b)=>b.createdAt-a.createdAt).slice(0,15);
  $('myReqs').innerHTML=list.map(r=>reqCard(r,false)).join('')||'<p class="muted">Chưa có yêu cầu nào.</p>';
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
    for(const iso of dateRange(r.from,r.to)){
      const a=eff(r.empId,iso).code,b=eff(r.withId,iso).code;
      S.over[r.empId]=S.over[r.empId]||{};S.over[r.withId]=S.over[r.withId]||{};
      S.over[r.empId][iso]={code:b||'',reqId:id,by:'approve',at:Date.now()};
      S.over[r.withId][iso]={code:a||'',reqId:id,by:'approve',at:Date.now()};
    }
  }else if(r.type==='wt'||r.type==='late'||r.type==='multi'){
    // Đơn giấy tờ thuần — KHÔNG ghi đè lịch ca (không tạo override)
  }else{
    for(const iso of dateRange(r.from,r.to)){
      S.over[r.empId]=S.over[r.empId]||{};
      S.over[r.empId][iso]={code:r.code,reqId:id,by:'approve',at:Date.now()};
    }
  }
  r.status='approved';r.decidedAt=Date.now();r.decidedBy='manager';
  save();renderAppr();renderReal();toast('Đã duyệt & cập nhật lịch thực tế');
}
