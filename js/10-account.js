/* ============================================================
   TAI KHOAN — SHA-256, dang nhap NV, tab 'Cua toi'
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== SHA-256 (thuần JS, cho hash mật khẩu) =================== */
function sha256(ascii){
  function rightRotate(v,a){return(v>>>a)|(v<<(32-a));}
  var mathPow=Math.pow,maxWord=mathPow(2,32),result='';
  var words=[],asciiBitLength=ascii.length*8;
  var hash=sha256.h=sha256.h||[],k=sha256.k=sha256.k||[],primeCounter=k.length;
  var isComposite={};
  for(var candidate=2;primeCounter<64;candidate++){
    if(!isComposite[candidate]){
      for(var i=0;i<313;i+=candidate)isComposite[i]=candidate;
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80';
  while(ascii.length%64-56)ascii+='\x00';
  for(i=0;i<ascii.length;i++){
    var j=ascii.charCodeAt(i);
    if(j>>8)return'';
    words[i>>2]|=j<<((3-i)%4)*8;
  }
  words[words.length]=(asciiBitLength/maxWord)|0;
  words[words.length]=asciiBitLength;
  for(j=0;j<words.length;){
    var w=words.slice(j,j+=16),oldHash=hash;
    hash=hash.slice(0,8);
    for(i=0;i<64;i++){
      var w15=w[i-15],w2=w[i-2];
      var a=hash[0],e=hash[4];
      var temp1=hash[7]+(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))+w[i-7]+(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)))|0);
      var temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0].concat(hash);
      hash[4]=(hash[4]+temp1)|0;
    }
    for(i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0;
  }
  for(i=0;i<8;i++){
    for(j=3;j+1;j--){
      var b=(hash[i]>>(j*8))&255;
      result+=((b<16)?0:'')+b.toString(16);
    }
  }
  return result;
}
function hashPw(id,pw){return sha256(unescape(encodeURIComponent(id+'|'+pw)));}

/* =================== ĐĂNG NHẬP NHÂN VIÊN (Của tôi) =================== */
const SESS=LS+'_sess';
function meId(){
  try{const s=JSON.parse(localStorage.getItem(SESS)||'null');
    if(s&&s.id&&empById(s.id)&&S.accounts&&S.accounts[s.id]&&S.accounts[s.id].hash)return s.id;
  }catch(e){}
  return null;
}
function doLogin(){
  const id=$('loginId').value.trim(),pw=$('loginPw').value;
  if(!id||!pw){toast('Nhập mã NV và mật khẩu');return;}
  const e=empById(id),acc=S.accounts&&S.accounts[id];
  if(!e){toast('Không tìm thấy mã NV này');return;}
  if(!acc||!acc.hash){toast('Mã NV chưa được cấp tài khoản — liên hệ quản lý');return;}
  if(hashPw(id,pw)!==acc.hash){toast('Sai mật khẩu');return;}
  localStorage.setItem(SESS,JSON.stringify({id,at:Date.now()}));
  localStorage.setItem(LS+'_me',id);
  $('loginPw').value='';
  toast('Xin chào '+(e.name||id)+' 👋');
  renderMe();
}
function doLogout(){localStorage.removeItem(SESS);renderMe();toast('Đã đăng xuất');}
function changeMyPass(){
  const id=meId();if(!id)return;
  const cur=$('mePwCur').value,n1=$('mePwNew').value;
  const acc=S.accounts[id];
  if(!acc||hashPw(id,cur)!==acc.hash){toast('Mật khẩu hiện tại không đúng');return;}
  if(n1.trim().length<4){toast('Mật khẩu mới tối thiểu 4 ký tự');return;}
  acc.hash=hashPw(id,n1.trim());acc.at=Date.now();acc.by='self';
  save();$('mePwCur').value='';$('mePwNew').value='';toast('Đã đổi mật khẩu ✔');
}

/* ===== Thống kê cá nhân / chung ===== */
function calcStats(id,days){
  const cnt={};let hWork=0,hOT=0,hLeave=0;
  days.forEach(iso=>{
    const c=eff(id,iso).code;if(!c)return;
    cnt[c]=(cnt[c]||0)+1;
    const cat=codeInfo(c).cat,h=getHours(c);
    if(cat==='work'||cat==='swap')hWork+=h;
    else if(cat==='ot')hOT+=h;
    else if(cat==='leave')hLeave+=h;
  });
  return{cnt,hWork,hOT,hLeave};
}
function otShifts(s){return Object.entries(s.cnt).filter(([c])=>codeInfo(c).cat==='ot').reduce((a,[,n])=>a+n,0);}
const rnd1=v=>Math.round(v*10)/10;

/* ===== Tab Của tôi ===== */
function meMiniWeek(id){
  const t=new Date(todayIso()+'T00:00:00');
  const wd=(t.getDay()+6)%7;const mon=new Date(t);mon.setDate(t.getDate()-wd);
  let h='<div class="mini-week">';
  for(let i=0;i<7;i++){
    const d=new Date(mon);d.setDate(mon.getDate()+i);
    const iso=isoOf(d),r=eff(id,iso);
    h+=`<div class="d${iso===todayIso()?' today':''}"><div class="dn">${DOW[d.getDay()]}</div>${r.code?chip(r.code):'<span class="muted" style="font-size:9px">—</span>'}</div>`;
  }
  return h+'</div>';
}
let meYm=null;
function meShift(d){
  const ms=monthsAvailable();let i=ms.indexOf(meYm)+d;
  if(i<0||i>=ms.length){toast('Không còn kỳ nào');return;}
  meYm=ms[i];renderMe(true);
}
function meCalHtml(id,ym){
  const days=daysOfPeriod(ym);
  const first=new Date(days[0]+'T00:00:00');
  const lead=(first.getDay()+6)%7; // tuần bắt đầu T2
  let h='<div class="me-cal">';
  ['T2','T3','T4','T5','T6','T7','CN'].forEach((d,i)=>h+=`<div class="h${i===6?' sun':i===5?' sat':''}">${d}</div>`);
  for(let k=0;k<lead;k++)h+='<div class="d out"></div>';
  const t=todayIso();
  days.forEach(iso=>{
    const r=eff(id,iso),dw=new Date(iso+'T00:00:00').getDay();
    const dn=+iso.slice(8),lbl=(dn===1||iso===days[0])?dn+'/'+(+iso.slice(5,7)):dn;
    h+=`<div class="d${iso===t?' today':''}" title="${fmtVNfull(iso)} ${dowOf(iso)}${r.code?' — '+codeInfo(r.code).l:''}">
      <span class="dn${dw===0?' sun':dw===6?' sat':''}">${lbl}</span>
      ${r.code?chip(r.code):'<span class="muted" style="font-size:9px">—</span>'}
      ${r.ovr?'<span style="font-size:7px;color:var(--accent)">●</span>':''}</div>`;
  });
  return h+'</div>';
}
function renderMe(force){
  const id=meId();
  $('meLogin').style.display=id?'none':'';
  $('meBody').style.display=id?'':'none';
  if(!id)return;
  // tránh xoá form khi người dùng đang nhập (đồng bộ realtime)
  if(!force&&$('meBody').contains(document.activeElement)&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  const e=empById(id);
  const ms=monthsAvailable();
  if(!meYm||!ms.includes(meYm))meYm=ms.includes(curSchedMonth())?curSchedMonth():ms[ms.length-1];
  const p=periodFor(meYm);
  const st=calcStats(id,daysOfPeriod(meYm));
  const myList=Object.values(S.requests).filter(r=>r.empId===id||r.withId===id).sort((a,b)=>b.createdAt-a.createdAt).slice(0,10);
  const initials=(e.name||id).trim().split(/\s+/).map(w=>w[0]).slice(-2).join('').toUpperCase();
  const todayR=eff(id,todayIso());
  const tmrIso=(()=>{const d=new Date();d.setDate(d.getDate()+1);return isoOf(d);})();
  const tmrR=eff(id,tmrIso);
  const pendCnt=Object.values(S.requests).filter(r=>r.status==='pending').length;
  const top3=myList.slice(0,3);
  $('meBody').innerHTML=`
   <div class="me-head">
     <div class="av">${esc(initials)}</div>
     <div style="flex:1;min-width:0"><div class="nm">${esc(e.name||id)}</div>
       <div class="ps">${esc(e.pos||'')}${e.team?' · Nhóm '+esc(e.team):''} · MSNV ${esc(e.id)}</div></div>
     <button class="pill sync" onclick="doLogout()">Thoát ↪</button>
   </div>
   <div class="today-card">
     <div class="l1">Hôm nay ${fmtVN(todayIso())} · ${todayR.code?('Ca '+chip(todayR.code)+' '+esc(codeInfo(todayR.code).l)):'Chưa xếp ca'}</div>
     <div class="l2">Ngày mai ${fmtVN(tmrIso)} · ${tmrR.code?chip(tmrR.code)+' '+esc(codeInfo(tmrR.code).l):'—'}</div>
   </div>
   <div class="qa-grid">
     <button class="qa-btn" onclick="go('reg',{type:'leave'})"><span class="ic">🏖</span>Đăng ký nghỉ</button>
     <button class="qa-btn" onclick="go('reg',{type:'swap'})"><span class="ic">🔄</span>Đổi ca</button>
     <button class="qa-btn" onclick="go('cal',{mode:'real',view:'day',date:todayIso()})"><span class="ic">👥</span>Nhân lực hôm nay</button>
     <button class="qa-btn" onclick="go('cal',{view:'week'})"><span class="ic">📅</span>Lịch tuần này</button>
     ${(mgr&&pendCnt)?`<button class="qa-btn full" onclick="go('appr')">✅ Duyệt đơn (${pendCnt})</button>`:''}
   </div>
   <div class="card" style="padding:10px 12px">
     <h3 style="margin-bottom:8px">🗓️ Tuần của tôi</h3>
     ${meMiniWeek(id)}
   </div>
   ${top3.length?`<div class="card"><h3>📋 Đơn gần nhất</h3>${top3.map(r=>reqCard(r,false)).join('')}</div>`:''}
   <div class="card">
     <h3>📅 Lịch của tôi <span style="flex:1"></span>
       <button class="btn sec sm" onclick="meShift(-1)">◀</button>
       <span class="muted" style="font-weight:700;font-size:11.5px">${p.label}</span>
       <button class="btn sec sm" onclick="meShift(1)">▶</button></h3>
     ${meCalHtml(id,meYm)}
     <p class="muted" style="margin-top:8px">● cam = ca đã điều chỉnh so với lịch chuẩn.</p>
   </div>
   <div class="card"><h3>📈 Kỳ này của tôi <span class="muted" style="font-weight:600">${p.label}</span></h3>
     <div class="me-stats">
       <div class="stat-box"><div class="v">${rnd1(st.hWork)}</div><div class="k">GIỜ CÔNG</div></div>
       <div class="stat-box"><div class="v">${rnd1(st.hOT)}</div><div class="k">GIỜ TĂNG CA</div></div>
       <div class="stat-box"><div class="v">${rnd1(st.hLeave)}</div><div class="k">GIỜ PHÉP</div></div>
       <div class="stat-box"><div class="v">${(st.cnt.D||0)+(st.cnt.SD||0)}/${(st.cnt.N||0)+(st.cnt.SN||0)}/${(st.cnt.O||0)+(st.cnt.SO||0)}</div><div class="k">CA D / N / O</div></div>
     </div>
   </div>
   <div class="card">
     <h3>📝 Gửi yêu cầu</h3>
     <div class="fg"><label class="fl">Loại yêu cầu</label>
       <select class="inp" id="meType" onchange="meFormUI()">
         <option value="leave">🏖️ Đăng ký nghỉ</option>
         <option value="swap">🔄 Đổi ca với đồng nghiệp</option>
         <option value="ot">⚡ Đăng ký tăng ca</option>
         <option value="change">✏️ Xin đổi mã ca của mình</option>
         <option value="wt">🪪 Bổ sung công (quên/mất thẻ)</option>
         <option value="late">⏰ Đi trễ / Về sớm</option>
         <option value="multi">🔁 Làm liên tục nhiều ngày</option>
       </select></div>
     <div class="grid2">
       <div class="fg"><label class="fl">Từ ngày</label><input type="date" class="inp" id="meFrom"></div>
       <div class="fg"><label class="fl">Đến ngày (bỏ trống nếu 1 ngày)</label><input type="date" class="inp" id="meTo"></div>
     </div>
     <div class="fg" id="meCodeBox"><label class="fl">Mã áp dụng</label><select class="inp" id="meCode"></select></div>
     <div class="fg" id="meSwapBox" style="display:none"><label class="fl">Đổi ca với</label><select class="inp" id="meSwapWith"></select></div>
     <div class="fg" id="meWtBox" style="display:none">
       <label class="fl">Lý do</label>
       <select class="inp" id="meWtReason" onchange="meWtReasonUI()">
         <option value="forgot_card">Quên thẻ / Left the card at home</option>
         <option value="forgot_scan">Quên quẹt thẻ / Forgot to scan the card</option>
         <option value="lost_card">Mất thẻ / Lost the card</option>
         <option value="damaged_card">Thẻ hỏng / The card was damaged</option>
         <option value="other">Lý do khác / Others</option>
       </select>
       <input class="inp" id="meWtOther" style="margin-top:6px;display:none" placeholder="Ghi rõ lý do khác...">
       <div class="grid2" style="margin-top:8px">
         <div class="fg"><label class="fl">Giờ vào</label><input type="time" class="inp" id="meWtIn"></div>
         <div class="fg"><label class="fl">Giờ ra</label><input type="time" class="inp" id="meWtOut"></div>
       </div>
       <label class="fl">Người bảo lãnh (xác nhận — không bắt buộc)</label><select class="inp" id="meWtGuarantor"><option value="">— Không có —</option></select>
     </div>
     <div class="fg" id="meLateBox" style="display:none">
       <label class="fl">Loại đơn</label>
       <select class="inp" id="meLateType">
         <option value="come_late">Đi trễ / Come late</option>
         <option value="leave_early">Về sớm / Leave early</option>
       </select>
       <div class="grid2" style="margin-top:8px">
         <div class="fg"><label class="fl">Từ giờ</label><input type="time" class="inp" id="meLateFrom"></div>
         <div class="fg"><label class="fl">Đến giờ</label><input type="time" class="inp" id="meLateTo"></div>
       </div>
     </div>
     <div class="fg" id="meMultiBox" style="display:none">
       <p class="muted" style="margin-bottom:6px">Ngày đầu/cuối lấy theo Từ ngày – Đến ngày ở trên.</p>
       <div class="grid2">
         <div class="fg"><label class="fl">Giờ vào (ngày đầu)</label><input type="time" class="inp" id="meMultiIn"></div>
         <div class="fg"><label class="fl">Giờ ra (ngày cuối)</label><input type="time" class="inp" id="meMultiOut"></div>
       </div>
     </div>
     <div class="fg"><label class="fl">Lý do / ghi chú</label><textarea class="inp" id="meNote" rows="2" placeholder="VD: việc gia đình, khám bệnh..."></textarea></div>
     <button class="btn" style="width:100%" onclick="submitMyReq()">Gửi yêu cầu · ghi nhận: ${esc(e.name||id)}</button>
   </div>
   <div class="card"><h3>📋 Yêu cầu của tôi</h3>${myList.map(r=>reqCard(r,false)).join('')||'<p class="muted">Chưa có yêu cầu nào.</p>'}</div>
   <div class="card"><h3>🔑 Đổi mật khẩu</h3>
     <div class="grid2">
       <div class="fg"><label class="fl">Mật khẩu hiện tại</label><input type="password" class="inp" id="mePwCur"></div>
       <div class="fg"><label class="fl">Mật khẩu mới</label><input type="password" class="inp" id="mePwNew"></div>
     </div>
     <button class="btn sec" onclick="changeMyPass()">Đổi mật khẩu</button>
   </div>`;
  meFormUI();
}
function meFormUI(){
  const id=meId();if(!id||!$('meType'))return;
  const t=$('meType').value;
  $('meSwapBox').style.display=t==='swap'?'':'none';
  $('meCodeBox').style.display=(t==='swap'||t==='wt'||t==='late'||t==='multi')?'none':'';
  $('meWtBox').style.display=t==='wt'?'':'none';
  $('meLateBox').style.display=t==='late'?'':'none';
  $('meMultiBox').style.display=t==='multi'?'':'none';
  if(t==='wt'){fillGuarantorSel('meWtGuarantor',id);meWtReasonUI();}
  let codes;
  if(t==='leave')codes=allCodes().filter(c=>c.cat==='leave');
  else if(t==='ot')codes=allCodes().filter(c=>c.cat==='ot');
  else codes=allCodes().filter(c=>c.cat==='work'||c.cat==='rest'||c.cat==='swap');
  $('meCode').innerHTML=codes.map(c=>`<option value="${c.c}">${c.c} — ${c.l}</option>`).join('');
  $('meSwapWith').innerHTML=activeEmps().filter(e=>e.id!==id).map(e=>`<option value="${e.id}">${esc(e.name||e.id)} — ${esc(e.pos||'')}</option>`).join('');
}
function meWtReasonUI(){$('meWtOther').style.display=$('meWtReason').value==='other'?'':'none';}
function submitMyReq(){
  const empId=meId();
  if(!empId){toast('Phiên đăng nhập đã hết — đăng nhập lại');renderMe(true);return;}
  const type=$('meType').value,from=$('meFrom').value;
  let to=$('meTo').value||from;
  if(!from){toast('Chọn ngày');return;}
  if(to<from){toast('Ngày kết thúc < ngày bắt đầu');return;}
  const r={id:uid(),empId,type,from,to,code:type==='swap'?'':$('meCode').value,
    withId:type==='swap'?$('meSwapWith').value:'',
    note:$('meNote').value.trim(),status:'pending',source:'app',createdAt:Date.now()};
  if(type==='swap'&&(!r.withId||r.withId===empId)){toast('Chọn người đổi ca hợp lệ');return;}
  Object.assign(r,readExtraFields(empId,type,'me',from));
  r.before={};if(type==='swap')r.beforeW={};
  for(const iso of dateRange(from,to)){r.before[iso]=eff(empId,iso).code||'';if(type==='swap')r.beforeW[iso]=eff(r.withId,iso).code||'';}
  S.requests[r.id]=r;
  save();toastWithPrint('Đã gửi yêu cầu — chờ duyệt ✔',r.id);renderMe(true);
}
