/* ============================================================
   TRANG CHINH NHAN VIEN (tab "Trang chinh" — id v-me)
   Lich tuan / thang ca nhan + bam vao ngay de dang ky.
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */

/* =================== THAM SỐ =================== */
/* Quỹ phép năm mặc định (ngày/năm). Có thể đặt riêng từng người: e.alQuota */
const AL_QUOTA_DEFAULT=12;
/* Số ngày làm liên tục vượt ngưỡng thì cảnh báo */
const STREAK_WARN=7;

/* =================== TRẠNG THÁI MÀN HÌNH =================== */
let pvMode='month';          // 'week' | 'month'
let pvAnchor=null;           // ngày mốc đang xem (iso)
let pvSheetDate=null;        // ngày đang mở trong sheet
let pvSheetForm=null;        // loại đơn đang mở trong sheet

/* =================== TIỆN ÍCH =================== */
const SEEN=()=>LS+'_seen';
function lastSeen(id){try{return +(localStorage.getItem(SEEN()+'_'+id)||0);}catch(e){return 0;}}
function markSeen(id){try{localStorage.setItem(SEEN()+'_'+id,String(Date.now()));}catch(e){}}

function addDaysIso(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoOf(d);}
function mondayOf(iso){const d=new Date(iso+'T00:00:00');const wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return isoOf(d);}
function pvAnchorIso(){return pvAnchor||todayIso();}
function togglePw(id,btn){
  const el=$(id);if(!el)return;
  const show=el.type==='password';
  el.type=show?'text':'password';
  if(btn)btn.textContent=show?'🙈':'👁';
}

/* Ẩn/hiện các nút theo quyền của người đang đăng nhập */
function applyRoleUI(){
  applyPerm();
  document.querySelectorAll('.mgr-only').forEach(el=>{el.style.display=mgr?'':'none';});
  document.querySelectorAll('.admin-only').forEach(el=>{el.style.display=adm?'':'none';});
}

/* Tên rút gọn 2 chữ cuối: "Nguyễn Hoàng Trung" → "Hoàng Trung" */
function shortName(n){
  const w=String(n||'').trim().split(/\s+/).filter(Boolean);
  return w.slice(-2).join(' ')||String(n||'');
}

/* ---- Đơn liên quan tới 1 ngày của 1 người ---- */
function reqsOfDay(id,iso){
  return Object.values(S.requests||{}).filter(r=>
    (r.empId===id||r.withId===id) && r.from<=iso && iso<=(r.to||r.from));
}
function myReqs(id){
  return Object.values(S.requests||{})
    .filter(r=>r.empId===id||r.withId===id)
    .sort((a,b)=>b.createdAt-a.createdAt);
}
/* Đơn đã có quyết định mà nhân viên chưa xem */
function unseenDecisions(id){
  const t=lastSeen(id);
  return myReqs(id).filter(r=>r.decidedAt&&r.decidedAt>t);
}
/* Trùng đơn: đã có đơn pending/approved cùng loại phủ lên khoảng ngày này chưa */
function conflictReqs(id,from,to,type){
  return Object.values(S.requests||{}).filter(r=>
    r.empId===id && r.status!=='rejected' &&
    r.from<=to && from<=(r.to||r.from) &&
    (!type||r.type===type));
}

/* ---- Nhân sự đi làm trong ngày, gom theo nhóm ca (O / D / N / …) ---- */
const WORKING=c=>{const k=codeInfo(c).cat;return k==='work'||k==='swap'||k==='ot';};
const CREW_ORDER=['O','D','N','OTD','OTN','X'];
function crewOfDay(iso){
  const g={};
  activeEmps().forEach(e=>{
    const c=eff(e.id,iso).code;
    if(!c||!WORKING(c))return;
    const b=baseShiftOf(c)||c;
    (g[b]=g[b]||[]).push(e);
  });
  return Object.keys(g)
    .sort((a,b)=>{
      const ia=CREW_ORDER.indexOf(a),ib=CREW_ORDER.indexOf(b);
      return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);
    })
    .map(b=>[b,g[b].sort((x,y)=>String(x.team||'').localeCompare(String(y.team||''),'vi',{numeric:true}))]);
}
/* ---- Người đang nghỉ (R) ngày đó → ưu tiên gợi ý đổi ca ---- */
function swapCandidates(id,iso){
  const me=empById(id);
  const list=activeEmps().filter(e=>e.id!==id);
  const score=e=>{
    const c=eff(e.id,iso).code;
    let s=0;
    if(codeInfo(c).cat==='rest')s-=100;                 // đang nghỉ → gợi ý đầu tiên
    if(me&&e.team===me.team)s-=10;                      // cùng nhóm
    if(me&&e.role===me.role)s-=5;                       // cùng vai trò
    return s;
  };
  return list.sort((a,b)=>score(a)-score(b));
}

/* ---- Chuỗi ngày đã làm liên tục tính đến hôm nay ---- */
function workStreak(id){
  let n=0;
  for(let i=0;i<40;i++){
    const c=eff(id,addDaysIso(todayIso(),-i)).code;
    const cat=codeInfo(c).cat;
    if(c&&(cat==='work'||cat==='swap'||cat==='ot'))n++;else break;
  }
  return n;
}

/* =================== PHÉP NĂM & TĂNG CA =================== */
/* Đếm ngày phép năm đã dùng trong năm dương lịch (mã AL8 = 1 ngày, AL4 = 0.5) */
function alUsed(id,year){
  let used=0;
  const scan=iso=>{
    if(iso.slice(0,4)!==String(year))return;
    const c=eff(id,iso).code;if(!c)return;
    if(c==='AL8')used+=1; else if(c==='AL4')used+=0.5;
    else if(codeInfo(c).cat==='leave'&&/^AL/.test(c))used+=1;
  };
  const seen=new Set();
  [S.base[id],S.over[id]].forEach(o=>{for(const iso in (o||{}))if(!seen.has(iso)){seen.add(iso);scan(iso);}});
  return used;
}
function alQuota(id){const e=empById(id);return (e&&+e.alQuota)||+(S.settings.alQuota)||AL_QUOTA_DEFAULT;}

/* Giờ tăng ca: đã duyệt (đã vào lịch) vs đang chờ duyệt (còn trong đơn) */
function otSummary(id,ym){
  const days=daysOfPeriod(ym);
  let approved=0,pending=0;
  days.forEach(iso=>{
    const c=eff(id,iso).code;
    if(c&&codeInfo(c).cat==='ot')approved+=getHours(c);
  });
  Object.values(S.requests||{}).forEach(r=>{
    if(r.empId!==id||r.type!=='ot'||r.status!=='pending')return;
    for(const iso of dateRange(r.from,r.to||r.from)){
      if(days.includes(iso))pending+=getHours(r.code||'OTD');
    }
  });
  return{approved,pending};
}

/* =================== RENDER TRANG CHÍNH =================== */
function renderMe(force){
  const id=meId();
  applyRoleUI();
  const login=$('meLogin'),body=$('meBody');
  if(!login||!body)return;
  login.style.display=id?'none':'';
  body.style.display=id?'':'none';
  if(!id)return;
  // đang gõ trong sheet thì không vẽ lại (tránh mất chữ khi Firebase đẩy dữ liệu về)
  if(!force&&document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;

  const e=empById(id);
  const ym=schedMonthOf(pvAnchorIso());     // kỳ công chứa ngày đang xem
  const per=periodFor(ym);
  const st=calcStats(id,daysOfPeriod(ym));
  const ot=otSummary(id,ym);
  const initials=(e.name||id).trim().split(/\s+/).map(w=>w[0]).slice(-2).join('').toUpperCase();
  const streak=workStreak(id);
  const news=unseenDecisions(id);
  const pendingMine=myReqs(id).filter(r=>r.status==='pending').length;
  const usedAL=alUsed(id,new Date().getFullYear()), quotaAL=alQuota(id);

  body.innerHTML=`
  <div class="pv-top">
    <div class="av">${esc(initials)}</div>
    <div class="who">
      <div class="nm">${esc(shortName(e.name)||id)}</div>
      <div class="ps">${e.team?'Nhóm '+esc(e.team)+' · ':''}${esc(e.id)}</div>
    </div>
    <button class="pv-icon" onclick="openMyPanel('acc')" title="Tài khoản">🔑</button>
    <button class="pv-icon" onclick="doLogout()" title="Đăng xuất">↪</button>
  </div>

  ${news.length?`<div class="pv-alert info">
     🔔 ${news.length} đơn vừa có kết quả:
     ${news.slice(0,3).map(r=>`<b>${r.status==='approved'?'✅ duyệt':'❌ từ chối'}</b> ${esc(REQ_LABEL[r.type]||r.type)} ${fmtVN(r.from)}`).join(' · ')}
     <button class="btn sm" onclick="openMyPanel('req')">Xem</button></div>`:''}

  <div class="card pv-cal-card">
    <div class="pv-cal-head">
      <button class="nav" onclick="pvShift(-1)">◀</button>
      <div class="pv-range" id="pvRange"></div>
      <button class="nav" onclick="pvShift(1)">▶</button>
      <div class="seg">
        <button class="${pvMode==='week'?'on':''}" onclick="pvSetMode('week')">Tuần</button>
        <button class="${pvMode==='month'?'on':''}" onclick="pvSetMode('month')">Tháng</button>
      </div>
      <button class="btn sec sm" onclick="pvToday()">Hôm nay</button>
    </div>
    <div id="pvCal"></div>
    <div class="pv-foot">
      <span class="tipdot"><i class="d-ovr"></i> ca điều chỉnh</span>
      <span class="tipdot"><i class="d-pend"></i> đơn chờ</span>
      <span class="tipdot"><i class="d-ok"></i> đơn duyệt</span>
      <span style="flex:1"></span>
      <button class="btn sec sm" onclick="openLegendSheet()">Chú giải</button>
    </div>
  </div>

  ${streak>=STREAK_WARN?`<div class="pv-alert warn">⚠️ Bạn đã làm <b>${streak} ngày liên tục</b>. Cân nhắc xin nghỉ bù.</div>`:''}

  <div class="pv-stats">
    <button class="sbox" onclick="go('stats')"><div class="v">${rnd1(st.hWork)}<i>h</i></div><div class="k">Giờ công · ${esc(per.label.replace('Kỳ ','').split(' ·')[0])}</div></button>
    <button class="sbox ot" onclick="openMyPanel('ot')"><div class="v">${rnd1(ot.approved)}<i>h</i></div>
      <div class="k">Tăng ca đã duyệt${ot.pending?` <span class="pd">+${rnd1(ot.pending)}h chờ</span>`:''}</div></button>
    <button class="sbox al" onclick="openMyPanel('al')"><div class="v">${rnd1(quotaAL-usedAL)}<i>ngày</i></div><div class="k">Phép năm còn lại</div></button>
    <button class="sbox rq" onclick="openMyPanel('req')"><div class="v">${pendingMine}</div><div class="k">Đơn đang chờ duyệt</div></button>
  </div>`;

  renderPvCal();
}

/* =================== LỊCH TUẦN / THÁNG =================== */
function pvSetMode(m){pvMode=m;renderMe(true);}
function pvShift(d){
  pvAnchor=addDaysIso(pvAnchorIso(),pvMode==='week'?7*d:0);
  if(pvMode==='month'){
    const a=new Date(pvAnchorIso()+'T00:00:00');
    a.setDate(1);a.setMonth(a.getMonth()+d);
    pvAnchor=isoOf(a);
  }
  renderMe(true);
}
function pvToday(){pvAnchor=todayIso();renderMe(true);}

function pvDays(){
  const a=pvAnchorIso();
  if(pvMode==='week'){
    const mon=mondayOf(a);
    return{days:Array.from({length:7},(_,i)=>addDaysIso(mon,i)),lead:0,
      label:'Tuần '+fmtVN(mon)+' – '+fmtVN(addDaysIso(mon,6))};
  }
  const d=new Date(a+'T00:00:00');
  const y=d.getFullYear(),m=d.getMonth();
  const n=new Date(y,m+1,0).getDate();
  const first=new Date(y,m,1);
  return{days:Array.from({length:n},(_,i)=>isoOf(new Date(y,m,i+1))),
    lead:(first.getDay()+6)%7,
    label:'Tháng '+pad(m+1)+'/'+y};
}

/* Dấu hiệu đơn trên ô ngày */
function pvDayFlags(id,iso){
  const rs=reqsOfDay(id,iso);
  return{pend:rs.some(r=>r.status==='pending'),ok:rs.some(r=>r.status==='approved'),n:rs.length};
}

function renderPvCal(){
  const id=meId();if(!id)return;
  const box=$('pvCal');if(!box)return;
  const{days,lead,label}=pvDays();
  const rg=$('pvRange');if(rg)rg.textContent=label;
  const t=todayIso();
  let h=`<div class="pv-cal ${pvMode}">`;
  ['T2','T3','T4','T5','T6','T7','CN'].forEach((d,i)=>h+=`<div class="hd${i>4?' we':''}">${d}</div>`);
  for(let k=0;k<lead;k++)h+='<div class="pd"></div>';
  days.forEach(iso=>{
    const r=eff(id,iso), f=pvDayFlags(id,iso);
    const dw=new Date(iso+'T00:00:00').getDay();
    const info=r.code?codeInfo(r.code):null;
    h+=`<button class="pv-d${iso===t?' today':''}${r.code?'':' empty'}${dw===0||dw===6?' we':''}"
        onclick="openDaySheet('${iso}')" title="${fmtVNfull(iso)} ${dowOf(iso)}${info?' — '+esc(info.l):''}">
      <span class="dn">${+iso.slice(8)}</span>
      ${pvMode==='week'?`<span class="dw">${dowOf(iso)}</span>`:''}
      <span class="cbox">${r.code?`<span class="cc" style="background:${info.col}">${r.code}</span>`:'<span class="dash">—</span>'}</span>
      ${pvMode==='week'&&info?`<span class="clbl">${esc(info.l)}</span>`:''}
      <span class="flags">
        ${r.ovr?'<i class="d-ovr"></i>':''}
        ${f.pend?'<i class="d-pend"></i>':''}
        ${f.ok?'<i class="d-ok"></i>':''}
      </span>
    </button>`;
  });
  box.innerHTML=h+'</div>';
}

/* ============================================================
   SHEET THAO TÁC THEO NGÀY
   Bấm 1 ngày trên lịch → xem chi tiết ngày đó + gửi đơn ngay.
   ============================================================ */
const REQ_LABEL={leave:'Nghỉ phép',swap:'Đổi ca',ot:'Tăng ca',change:'Đổi mã ca',
                 wt:'Bổ sung công',late:'Đi trễ / Về sớm',multi:'Làm liên tục nhiều ngày'};
const REQ_ICON ={leave:'🏖',swap:'🔄',ot:'⚡',change:'✏️',wt:'🪪',late:'⏰',multi:'🔁'};

function openDaySheet(iso,form){
  if(!meId()){toast('Phiên đăng nhập đã hết');renderGate();return;}
  pvSheetDate=iso;pvSheetForm=form||null;
  renderDaySheet();
  $('daySheetMask').classList.add('on');
}
function closeDaySheet(){$('daySheetMask').classList.remove('on');pvSheetForm=null;}
function dsForm(t){pvSheetForm=(pvSheetForm===t)?null:t;renderDaySheet();}

function renderDaySheet(){
  const id=meId(),iso=pvSheetDate;
  const box=$('daySheetBody');if(!box||!id||!iso)return;
  const r=eff(id,iso), std=(S.base[id]||{})[iso]||'';
  const info=r.code?codeInfo(r.code):null;
  const rs=reqsOfDay(id,iso);
  const crew=crewOfDay(iso);

  box.innerHTML=`
   <div class="ds-head">
     <div>
       <div class="ds-date">${dowOf(iso)}, ${fmtVNfull(iso)}${iso===todayIso()?' <span class="tag">hôm nay</span>':''}</div>
       <div class="ds-shift">${info?`${chip(r.code,1)} <b>${esc(info.l)}</b>`:'<span class="muted">Chưa xếp ca</span>'}</div>
       ${r.ovr&&std&&std!==r.code?`<div class="ds-note">Lịch chuẩn là ${chip(std)} — đã điều chỉnh</div>`:''}
     </div>
     <button class="ds-x" onclick="closeDaySheet()">✕</button>
   </div>

   ${rs.length?`<div class="ds-block">
     <h4>📋 Đơn của ngày này</h4>
     ${rs.map(x=>`<div class="ds-req ${x.status}">
        <span class="ic">${REQ_ICON[x.type]||'📄'}</span>
        <span class="tx"><b>${esc(REQ_LABEL[x.type]||x.type)}</b>${x.code?' · '+esc(x.code):''}
          ${x.from!==x.to?`<i>(${fmtVN(x.from)}–${fmtVN(x.to)})</i>`:''}
          ${x.reason?`<i>Lý do từ chối: ${esc(x.reason)}</i>`:''}</span>
        <span class="st ${x.status}">${{pending:'CHỜ',approved:'DUYỆT',rejected:'TỪ CHỐI'}[x.status]}</span>
        ${x.status==='pending'&&x.empId===id?`<button class="btn warn sm" onclick="cancelMyReq('${x.id}')">Huỷ</button>`:''}
      </div>`).join('')}
   </div>`:''}

   ${crew.length?`<div class="ds-block">
     <h4>👥 Nhân sự trực ngày ${fmtVN(iso)}</h4>
     ${crew.map(([b,list])=>`<div class="crew-g">
        <div class="crew-h">${chip(b)}<span>${esc(codeInfo(b).l)}</span><i>${list.length} người</i></div>
        <div class="crew-n">${list.map(m=>`<span class="mate${m.id===id?' me':''}">${esc(shortName(m.name)||m.id)}</span>`).join('')}</div>
      </div>`).join('')}
   </div>`:''}

   <div class="ds-block">
     <h4>✍️ Gửi đơn cho ngày ${fmtVN(iso)}</h4>
     <div class="ds-acts">
       ${Object.keys(REQ_LABEL).map(t=>`<button class="da${pvSheetForm===t?' on':''}" onclick="dsForm('${t}')">
          <span class="ic">${REQ_ICON[t]}</span>${esc(REQ_LABEL[t])}</button>`).join('')}
     </div>
     <div id="dsForm">${pvSheetForm?dsFormHtml(id,iso,pvSheetForm):''}</div>
   </div>`;
  if(pvSheetForm)dsFormUI();
}

/* ---- HTML của form theo loại đơn ---- */
function dsFormHtml(id,iso,t){
  const cur=eff(id,iso).code;
  const codes=t==='leave'?allCodes().filter(c=>c.cat==='leave')
            :t==='ot'   ?allCodes().filter(c=>c.cat==='ot')
            :allCodes().filter(c=>c.cat==='work'||c.cat==='rest'||c.cat==='swap');
  const multi=(t==='multi'||t==='leave'||t==='ot'||t==='change'||t==='swap');
  return `
  <div class="ds-form">
    <div class="grid2">
      <div class="fg"><label class="fl">Từ ngày</label><input type="date" class="inp" id="dsFrom" value="${iso}" onchange="dsFormUI()"></div>
      <div class="fg"><label class="fl">Đến ngày${multi?'':' (không đổi)'}</label>
        <input type="date" class="inp" id="dsTo" value="${iso}" ${multi?'':'readonly'} onchange="dsFormUI()"></div>
    </div>

    ${(t==='leave'||t==='ot'||t==='change')?`
    <div class="fg"><label class="fl">Mã áp dụng</label>
      <select class="inp" id="dsCode">${codes.map(c=>`<option value="${c.c}">${c.c} — ${esc(c.l)}</option>`).join('')}</select></div>`:''}

    ${t==='swap'?`
    <div class="fg"><label class="fl">Đổi ca với ${cur?`(ca của bạn: ${cur})`:''}</label>
      <select class="inp" id="dsSwapWith"></select>
      <p class="muted" style="margin-top:4px">Người đang <b>nghỉ (R)</b> ngày này được xếp lên đầu danh sách.</p></div>`:''}

    ${t==='wt'?`
    <div class="fg"><label class="fl">Lý do</label>
      <select class="inp" id="dsWtReason" onchange="dsWtReasonUI()">
        <option value="forgot_card">Quên thẻ / Left the card at home</option>
        <option value="forgot_scan">Quên quẹt thẻ / Forgot to scan the card</option>
        <option value="lost_card">Mất thẻ / Lost the card</option>
        <option value="damaged_card">Thẻ hỏng / The card was damaged</option>
        <option value="other">Lý do khác / Others</option>
      </select>
      <input class="inp" id="dsWtOther" style="margin-top:6px;display:none" placeholder="Ghi rõ lý do khác...">
    </div>
    <div class="grid2">
      <div class="fg"><label class="fl">Giờ vào</label><input type="time" class="inp" id="dsWtIn"></div>
      <div class="fg"><label class="fl">Giờ ra</label><input type="time" class="inp" id="dsWtOut"></div>
    </div>
    <div class="fg"><label class="fl">Người bảo lãnh (không bắt buộc)</label>
      <select class="inp" id="dsWtGuarantor"><option value="">— Không có —</option></select></div>`:''}

    ${t==='late'?`
    <div class="fg"><label class="fl">Loại đơn</label>
      <select class="inp" id="dsLateType">
        <option value="come_late">Đi trễ / Come late</option>
        <option value="leave_early">Về sớm / Leave early</option>
      </select></div>
    <div class="grid2">
      <div class="fg"><label class="fl">Từ giờ</label><input type="time" class="inp" id="dsLateFrom"></div>
      <div class="fg"><label class="fl">Đến giờ</label><input type="time" class="inp" id="dsLateTo"></div>
    </div>`:''}

    ${t==='multi'?`
    <div class="grid2">
      <div class="fg"><label class="fl">Giờ vào (ngày đầu)</label><input type="time" class="inp" id="dsMultiIn" value="08:00"></div>
      <div class="fg"><label class="fl">Giờ ra (ngày cuối)</label><input type="time" class="inp" id="dsMultiOut" value="17:00"></div>
    </div>`:''}

    <div class="fg"><label class="fl">Lý do / ghi chú</label>
      <textarea class="inp" id="dsNote" rows="2" placeholder="VD: việc gia đình, khám bệnh..."></textarea></div>

    <div id="dsWarn"></div>
    <button class="btn ds-submit" onclick="dsSubmit('${t}')">Gửi đơn ${esc(REQ_LABEL[t])}</button>
  </div>`;
}

function dsWtReasonUI(){const o=$('dsWtOther'),r=$('dsWtReason');if(o&&r)o.style.display=r.value==='other'?'':'none';}

/* ---- Cập nhật động trong form: gợi ý người đổi ca, giờ mặc định, cảnh báo trùng ---- */
function dsFormUI(){
  const id=meId(),t=pvSheetForm;if(!id||!t)return;
  const from=$('dsFrom')?$('dsFrom').value:pvSheetDate;
  const to=$('dsTo')?($('dsTo').value||from):from;

  if($('dsSwapWith')){
    $('dsSwapWith').innerHTML=swapCandidates(id,from).map(e=>{
      const c=eff(e.id,from).code, rest=codeInfo(c).cat==='rest';
      return `<option value="${e.id}">${rest?'🟢 ':''}${esc(shortName(e.name)||e.id)}${e.team?' · Nhóm '+esc(e.team):''} · ${from?(c||'chưa xếp'):''}</option>`;
    }).join('');
  }
  if($('dsWtIn')&&!$('dsWtIn').value){
    const b=baseShiftOf(eff(id,from).code);
    const hrs=b?SHIFT_HOURS[b]:['08:00','17:00'];
    $('dsWtIn').value=hrs[0];$('dsWtOut').value=hrs[1];
  }
  if($('dsWtReason'))dsWtReasonUI();

  // cảnh báo trùng đơn
  const w=$('dsWarn');if(!w)return;
  const cf=conflictReqs(id,from,to).filter(r=>r.type===t||r.status==='approved');
  const many=(()=>{let n=0;for(const _ of dateRange(from,to))n++;return n;})();
  let h='';
  if(cf.length)h+=`<div class="pv-alert warn sm">⚠️ Đã có ${cf.length} đơn khác phủ lên khoảng ngày này
     (${cf.slice(0,3).map(r=>esc(REQ_LABEL[r.type]||r.type)+' '+fmtVN(r.from)).join(', ')}). Gửi tiếp có thể bị trùng.</div>`;
  if(many>1)h+=`<div class="pv-alert info sm">Đơn áp dụng cho <b>${many} ngày</b> (${fmtVN(from)} → ${fmtVN(to)}).</div>`;
  w.innerHTML=h;
}

/* ---- Gửi đơn ---- */
function dsSubmit(t){
  const empId=meId();
  if(!empId){toast('Phiên đăng nhập đã hết — đăng nhập lại');renderGate();return;}
  const from=$('dsFrom').value;
  const to=($('dsTo')&&$('dsTo').value)||from;
  if(!from){toast('Chọn ngày');return;}
  if(to<from){toast('Ngày kết thúc nhỏ hơn ngày bắt đầu');return;}

  const r={id:uid(),empId,type:t,from,to,
    code:(t==='leave'||t==='ot'||t==='change')&&$('dsCode')?$('dsCode').value:'',
    withId:t==='swap'&&$('dsSwapWith')?$('dsSwapWith').value:'',
    note:$('dsNote')?$('dsNote').value.trim():'',
    status:'pending',source:'app',createdAt:Date.now()};
  if(t==='swap'&&(!r.withId||r.withId===empId)){toast('Chọn người đổi ca hợp lệ');return;}

  // đọc các ô phụ (prefix ds → dùng chung readExtraFields)
  Object.assign(r,readExtraFields(empId,t,'ds',from));

  r.before={};if(t==='swap')r.beforeW={};
  for(const iso of dateRange(from,to)){
    r.before[iso]=eff(empId,iso).code||'';
    if(t==='swap')r.beforeW[iso]=eff(r.withId,iso).code||'';
  }
  S.requests[r.id]=r;
  save();
  pvSheetForm=null;
  closeDaySheet();
  renderMe(true);
  toastWithPrint('Đã gửi đơn '+(REQ_LABEL[t]||t)+' — chờ duyệt ✔',r.id);
}

function cancelMyReq(rid){
  const id=meId(),r=S.requests[rid];
  if(!r||r.empId!==id||r.status!=='pending')return;
  if(!confirm('Huỷ đơn này?'))return;
  delete S.requests[rid];
  save();renderDaySheet();renderMe(true);toast('Đã huỷ đơn');
}

/* ============================================================
   BẢNG PHỤ: Tăng ca của tôi · Đơn của tôi · Phép năm · Tài khoản
   ============================================================ */
let myPanelTab='ot';
function openMyPanel(tab){
  if(!meId()){toast('Đăng nhập để xem');renderGate();return;}
  myPanelTab=tab||'ot';
  renderMyPanel();
  $('myPanelMask').classList.add('on');
  if(myPanelTab==='req'){markSeen(meId());renderMe(true);}
}
function closeMyPanel(){$('myPanelMask').classList.remove('on');}
function myPanelGo(t){myPanelTab=t;renderMyPanel();if(t==='req'){markSeen(meId());renderMe(true);}}

function renderMyPanel(){
  const id=meId();const box=$('myPanelBody');if(!id||!box)return;
  const tabs=[['ot','⚡ Tăng ca'],['req','📋 Đơn của tôi'],['al','🏖 Phép năm'],['acc','🔑 Tài khoản']];
  let h=`<div class="mp-tabs">${tabs.map(([k,l])=>
    `<button class="${myPanelTab===k?'on':''}" onclick="myPanelGo('${k}')">${l}</button>`).join('')}
    <button class="ds-x" onclick="closeMyPanel()">✕</button></div>`;

  if(myPanelTab==='ot')      h+=myPanelOt(id);
  else if(myPanelTab==='req')h+=myPanelReq(id);
  else if(myPanelTab==='al') h+=myPanelAl(id);
  else                       h+=myPanelAcc(id);
  box.innerHTML=h;
}

/* ---- Tăng ca: đã duyệt / chờ duyệt / tổng giờ theo kỳ ---- */
function myPanelOt(id){
  const ms=monthsAvailable();
  const ym=schedMonthOf(pvAnchorIso());
  const per=periodFor(ym), days=daysOfPeriod(ym);

  const done=[];
  days.forEach(iso=>{
    const c=eff(id,iso).code;
    if(c&&codeInfo(c).cat==='ot')done.push({iso,code:c,h:getHours(c)});
  });
  const wait=Object.values(S.requests||{}).filter(r=>r.empId===id&&r.type==='ot'&&r.status==='pending');
  const rej =Object.values(S.requests||{}).filter(r=>r.empId===id&&r.type==='ot'&&r.status==='rejected').slice(0,5);
  const hDone=done.reduce((a,x)=>a+x.h,0);
  let hWait=0;wait.forEach(r=>{for(const iso of dateRange(r.from,r.to||r.from))hWait+=getHours(r.code||'OTD');});

  // tổng cả năm
  let hYear=0;const yr=String(new Date().getFullYear());
  ms.forEach(m=>daysOfPeriod(m).forEach(iso=>{
    if(iso.slice(0,4)!==yr)return;
    const c=eff(id,iso).code;
    if(c&&codeInfo(c).cat==='ot')hYear+=getHours(c);
  }));

  return `
  <h3 style="margin:4px 0 10px">⚡ Tăng ca — ${esc(per.label)}</h3>
  <div class="pv-stats in-panel">
    <div class="sbox"><div class="v">${rnd1(hDone)}<i>h</i></div><div class="k">Đã duyệt (kỳ này)</div></div>
    <div class="sbox ot"><div class="v">${rnd1(hWait)}<i>h</i></div><div class="k">Chờ duyệt</div></div>
    <div class="sbox al"><div class="v">${done.length}</div><div class="k">Ca tăng ca</div></div>
    <div class="sbox rq"><div class="v">${rnd1(hYear)}<i>h</i></div><div class="k">Cả năm ${yr}</div></div>
  </div>

  <div class="ds-block"><h4>✅ Đã duyệt & vào lịch (${done.length})</h4>
    ${done.length?`<div class="ot-list">${done.map(x=>`<div class="ot-row">
        <span class="d">${dowOf(x.iso)} ${fmtVNfull(x.iso)}</span>
        ${chip(x.code)}<span class="h">${rnd1(x.h)}h</span></div>`).join('')}</div>`
      :'<p class="muted">Kỳ này chưa có ca tăng ca nào được duyệt.</p>'}
  </div>

  <div class="ds-block"><h4>⏳ Đang chờ duyệt (${wait.length})</h4>
    ${wait.length?wait.map(r=>`<div class="ds-req pending">
        <span class="ic">⚡</span>
        <span class="tx"><b>${esc(r.code||'OT')}</b> ${fmtVN(r.from)}${r.from!==r.to?' – '+fmtVN(r.to):''}
          ${r.note?`<i>${esc(r.note)}</i>`:''}</span>
        <span class="st pending">CHỜ</span>
        <button class="btn warn sm" onclick="cancelMyReq('${r.id}');renderMyPanel()">Huỷ</button>
      </div>`).join(''):'<p class="muted">Không có đơn tăng ca nào đang chờ.</p>'}
  </div>

  ${rej.length?`<div class="ds-block"><h4>❌ Bị từ chối gần đây</h4>
    ${rej.map(r=>`<div class="ds-req rejected"><span class="ic">⚡</span>
      <span class="tx"><b>${esc(r.code||'OT')}</b> ${fmtVN(r.from)}${r.reason?`<i>${esc(r.reason)}</i>`:''}</span>
      <span class="st rejected">TỪ CHỐI</span></div>`).join('')}</div>`:''}

  <button class="btn" style="width:100%" onclick="closeMyPanel();openDaySheet(todayIso(),'ot')">＋ Đăng ký tăng ca mới</button>`;
}

/* ---- Đơn của tôi ---- */
function myPanelReq(id){
  const all=myReqs(id);
  const grp={pending:[],approved:[],rejected:[]};
  all.forEach(r=>grp[r.status]&&grp[r.status].push(r));
  const row=r=>`<div class="ds-req ${r.status}">
      <span class="ic">${REQ_ICON[r.type]||'📄'}</span>
      <span class="tx"><b>${esc(REQ_LABEL[r.type]||r.type)}</b>${r.code?' · '+esc(r.code):''}
        <i>${fmtVNfull(r.from)}${r.from!==r.to?' → '+fmtVNfull(r.to):''}${r.withId?' · với '+esc((empById(r.withId)||{}).name||r.withId):''}</i>
        ${r.note?`<i>${esc(r.note)}</i>`:''}${r.reason?`<i>Lý do: ${esc(r.reason)}</i>`:''}</span>
      <span class="st ${r.status}">${{pending:'CHỜ',approved:'DUYỆT',rejected:'TỪ CHỐI'}[r.status]}</span>
      ${r.status==='pending'&&r.empId===id?`<button class="btn warn sm" onclick="cancelMyReq('${r.id}');renderMyPanel()">Huỷ</button>`:''}
      ${r.status==='approved'?`<button class="btn sec sm" onclick="printOne('${r.id}')">🖨️</button>`:''}
    </div>`;
  return `
  <h3 style="margin:4px 0 10px">📋 Đơn của tôi (${all.length})</h3>
  <div class="ds-block"><h4>⏳ Đang chờ duyệt (${grp.pending.length})</h4>
    ${grp.pending.length?grp.pending.map(row).join(''):'<p class="muted">Không có đơn nào đang chờ.</p>'}</div>
  <div class="ds-block"><h4>✅ Đã duyệt (${grp.approved.length})</h4>
    ${grp.approved.length?grp.approved.slice(0,15).map(row).join(''):'<p class="muted">Chưa có.</p>'}</div>
  ${grp.rejected.length?`<div class="ds-block"><h4>❌ Bị từ chối (${grp.rejected.length})</h4>
    ${grp.rejected.slice(0,10).map(row).join('')}</div>`:''}`;
}

/* ---- Phép năm ---- */
function myPanelAl(id){
  const yr=new Date().getFullYear();
  const used=alUsed(id,yr), quota=alQuota(id), left=quota-used;
  const pct=Math.max(0,Math.min(100,Math.round(used/quota*100)));
  // liệt kê ngày phép đã dùng
  const list=[];
  const seen=new Set();
  [S.base[id],S.over[id]].forEach(o=>{for(const iso in (o||{})){
    if(seen.has(iso)||iso.slice(0,4)!==String(yr))continue;seen.add(iso);
    const c=eff(id,iso).code;
    if(c&&codeInfo(c).cat==='leave')list.push({iso,code:c});
  }});
  list.sort((a,b)=>a.iso<b.iso?-1:1);
  const wait=Object.values(S.requests||{}).filter(r=>r.empId===id&&r.type==='leave'&&r.status==='pending');
  return `
  <h3 style="margin:4px 0 10px">🏖 Phép năm ${yr}</h3>
  <div class="al-bar"><div class="fill" style="width:${pct}%"></div>
    <span>${rnd1(used)} / ${quota} ngày đã dùng</span></div>
  <div class="pv-stats in-panel">
    <div class="sbox al"><div class="v">${rnd1(left)}<i>ngày</i></div><div class="k">Còn lại</div></div>
    <div class="sbox"><div class="v">${rnd1(used)}<i>ngày</i></div><div class="k">Đã dùng</div></div>
    <div class="sbox ot"><div class="v">${wait.length}</div><div class="k">Đơn nghỉ chờ duyệt</div></div>
  </div>
  <div class="ds-block"><h4>Các ngày nghỉ trong năm (${list.length})</h4>
    ${list.length?`<div class="ot-list">${list.map(x=>`<div class="ot-row">
      <span class="d">${dowOf(x.iso)} ${fmtVNfull(x.iso)}</span>${chip(x.code)}
      <span class="h">${esc(codeInfo(x.code).l)}</span></div>`).join('')}</div>`
      :'<p class="muted">Chưa dùng ngày nghỉ nào trong năm.</p>'}
  </div>
  <p class="muted">Quỹ phép mặc định ${quota} ngày/năm — quản lý chỉnh trong tab Dữ liệu nếu công ty áp mức khác.</p>
  <button class="btn" style="width:100%" onclick="closeMyPanel();openDaySheet(todayIso(),'leave')">＋ Đăng ký nghỉ phép</button>`;
}

/* ---- Tài khoản ---- */
function myPanelAcc(id){
  const e=empById(id),acc=S.accounts[id]||{};
  return `
  <h3 style="margin:4px 0 10px">🔑 Tài khoản của tôi</h3>
  <div class="acc-info">
    <div><span>Họ tên</span><b>${esc(e.name||'—')}</b></div>
    <div><span>Tên đăng nhập</span><b style="font-family:var(--mono)">${esc(loginKey(id))}</b></div>
    ${loginKey(id)!==id?`<div><span>Mã NV trên hồ sơ</span><b style="font-family:var(--mono)">${esc(id)}</b></div>`:''}
    <div><span>Vị trí</span><b>${esc(e.pos||'—')}</b></div>
    <div><span>Nhóm</span><b>${esc(e.team||'—')}</b></div>
    <div><span>Mật khẩu</span><b>${usingDefaultPw(id)?'<span class="st pending">Đang dùng mặc định (= '+esc(loginKey(id))+')</span>':'<span class="st approved">Đã đổi</span>'}</b></div>
    ${acc.at?`<div><span>Cập nhật lần cuối</span><b>${new Date(acc.at).toLocaleString('vi-VN')}</b></div>`:''}
  </div>
  ${usingDefaultPw(id)?`<div class="pv-alert warn sm">Mật khẩu của bạn đang bằng mã NV — ai biết mã cũng đăng nhập được. Nên đổi ngay.</div>`:''}
  <div class="ds-block"><h4>Đổi mật khẩu</h4>
    <div class="fg"><label class="fl">Mật khẩu hiện tại</label>
      <div class="pw-wrap"><input type="password" class="inp" id="mePwCur">
      <button type="button" class="pw-eye" onclick="togglePw('mePwCur',this)">👁</button></div></div>
    <div class="grid2">
      <div class="fg"><label class="fl">Mật khẩu mới (≥ 4 ký tự)</label><input type="password" class="inp" id="mePwNew"></div>
      <div class="fg"><label class="fl">Nhập lại mật khẩu mới</label><input type="password" class="inp" id="mePwNew2"
        onkeydown="if(event.key==='Enter')changeMyPass()"></div>
    </div>
    <button class="btn" style="width:100%" onclick="changeMyPass()">Đổi mật khẩu</button>
  </div>
  <button class="btn sec" style="width:100%" onclick="closeMyPanel();doLogout()">↪ Đăng xuất khỏi thiết bị này</button>`;
}
