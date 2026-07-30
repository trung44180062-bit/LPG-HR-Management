/* ============================================================
   BAO CAO — gop "Nhan luc" + "Thong ke" + "Bieu do" vao 1 tab
   LPGT Cavern — Quan ly Cong Ca v4

   Phan quyen xem:
     · Quan tri / Quan ly nguoi Han / Duyet don  → xem TOAN BO nhan su
     · Nhan vien thuong                          → chi xem so lieu CUA MINH
   Bieu do ve bang SVG thuan, khong dung thu vien ngoai → chay offline,
   in ra giay van dep.
   ============================================================ */

/* Ai được xem số liệu của cả tổ */
function repSeeAll(){return !!secr;}

/* =================== TRẠNG THÁI MÀN HÌNH =================== */
let repMode='';                 // 'mp' | 'stats' | 'chart'
let repYm='';                   // kỳ công đang xem (thống kê / biểu đồ)
let repGroup='__all';
let repFrom='', repTo='';       // khoảng ngày của bảng nhân lực
let repOnlyLow=false;

function repModes(){return repSeeAll()?['mp','stats','chart','otlog']:['stats','chart','otlog'];}
const REP_LABEL={mp:'👥 Nhân lực',stats:'📊 Thống kê',chart:'📈 Biểu đồ',otlog:'🗂 Nhật ký tăng ca'};
const REP_LABEL_ME={stats:'📊 Số liệu của tôi',chart:'📈 Biểu đồ của tôi',otlog:'🗂 Nhật ký tăng ca'};

function repDefaults(){
  const ms=repModes();
  if(!ms.includes(repMode))repMode=ms[0];
  if(!repYm)repYm=curSchedMonth();
  if(!repFrom)repFrom=todayIso();
  if(!repTo){const d=new Date();d.setDate(d.getDate()+6);repTo=isoOf(d);}
}
function repSetMode(m){repMode=m;renderReport();}
function repSet(k,v){
  if(k==='ym')repYm=v; else if(k==='group')repGroup=v;
  else if(k==='from')repFrom=v; else if(k==='to')repTo=v;
  else if(k==='low')repOnlyLow=!!v;
  renderReport();
}
function repShiftYm(d){
  const ms=monthsAvailable();
  let i=ms.indexOf(repYm);
  if(i<0){const[y,m]=repYm.split('-').map(Number);const a=new Date(y,m-1+d,1);repYm=a.getFullYear()+'-'+pad(a.getMonth()+1);}
  else if(i+d>=0&&i+d<ms.length)repYm=ms[i+d];
  renderReport();
}

/* =================== KHUNG =================== */
function renderReport(){
  const bar=$('repBar'),body=$('repBody');
  if(!bar||!body)return;
  repDefaults();
  const ms=repModes(),lbl=repSeeAll()?REP_LABEL:REP_LABEL_ME;
  bar.innerHTML=`
    <div class="seg rep-seg">${ms.map(m=>
      `<button class="${repMode===m?'on':''}" onclick="repSetMode('${m}')">${lbl[m]||REP_LABEL[m]}</button>`).join('')}</div>
    ${repCtlHtml()}`;
  if(repMode==='mp')        body.innerHTML=repManpower();
  else if(repMode==='stats')body.innerHTML=repSeeAll()?repStatsAll():repStatsMe();
  else if(repMode==='otlog')body.innerHTML=repOtLog();
  else                      body.innerHTML=repCharts();
}

/* Thanh điều khiển đổi theo chế độ đang xem */
function repCtlHtml(){
  const grpSel=()=>{
    const teams=teamList();
    return `<select class="inp sm" onchange="repSet('group',this.value)">
      <option value="__all">Tất cả nhóm</option>
      ${teams.map(t=>`<option value="${esc(t)}"${repGroup===t?' selected':''}>Nhóm ${esc(t||'(chưa phân nhóm)')}</option>`).join('')}
    </select>`;
  };
  const ymSel=()=>{
    const ms=monthsAvailable();
    if(!ms.includes(repYm))ms.push(repYm),ms.sort();
    return `<button class="btn sec sm" onclick="repShiftYm(-1)">◀</button>
      <select class="inp sm" style="font-weight:700" onchange="repSet('ym',this.value)">
        ${ms.map(m=>`<option value="${m}"${m===repYm?' selected':''}>${periodFor(m).label}</option>`).join('')}
      </select>
      <button class="btn sec sm" onclick="repShiftYm(1)">▶</button>`;
  };
  if(repMode==='mp'){
    return `<div class="rep-ctl">
      <label class="fl2">Từ</label><input type="date" class="inp sm" value="${repFrom}" onchange="repSet('from',this.value)">
      <label class="fl2">Đến</label><input type="date" class="inp sm" value="${repTo}" onchange="repSet('to',this.value)">
      <label class="cal-chk"><input type="checkbox" ${repOnlyLow?'checked':''} onchange="repSet('low',this.checked)"> Chỉ ngày thiếu người</label>
      <span class="sp"></span>
      <span class="muted sm2">Định mức: D ≥ <b>${S.settings.minD}</b> · N ≥ <b>${S.settings.minN}</b></span>
    </div>`;
  }
  if(repMode==='otlog'){
    // Nhật ký tăng ca có bộ lọc riêng ngay trong thân bảng
    return '';
  }
  if(repMode==='stats'&&repSeeAll()){
    return `<div class="rep-ctl">${ymSel()}${grpSel()}
      <span class="sp"></span>
      <button class="btn sm" onclick="openMailReport()">✉️ Gửi email báo cáo</button>
      <button class="btn ok sm" onclick="exportStats()">📤 Xuất Excel</button></div>`;
  }
  // Biểu đồ dùng bộ chọn phạm vi riêng bên trong (tháng/quý/năm) nên không cần thanh kỳ ở đây
  if(repMode==='chart')return '';
  return `<div class="rep-ctl">${ymSel()}</div>`;
}

/* =================== 1. NHÂN LỰC THEO NGÀY =================== */
function repDayList(){
  const out=[];
  if(!repFrom||!repTo||repTo<repFrom)return out;
  let d=new Date(repFrom+'T00:00:00');const end=new Date(repTo+'T00:00:00');
  let g=0;
  while(d<=end&&g++<93){out.push(isoOf(d));d.setDate(d.getDate()+1);}
  return out;
}
function repManpower(){
  const days=repDayList();
  if(!days.length)return '<div class="card"><p class="muted">Chọn khoảng ngày hợp lệ.</p></div>';
  const pill=(n,lbl,col,low)=>`<span class="mpp${low?' low':''}${n?'':' zero'}" style="background:${col}">${n}<small>${lbl}</small></span>`;
  let rows='',nLow=0,shown=0;
  days.forEach(iso=>{
    const B=mpBuckets(iso);
    const lowD=B.D.length<S.settings.minD, lowN=B.N.length<S.settings.minN, low=lowD||lowN;
    if(low)nLow++;
    if(repOnlyLow&&!low)return;
    shown++;
    const dw=new Date(iso+'T00:00:00').getDay();
    const line=(code,arr,tip)=>`<div class="mp-line">${chip(code)}<span class="who"${tip?` title="${esc(tip)}"`:''}>${
      arr.length?arr.map(e=>esc(e.name||e.id)).join(', '):'—'}</span></div>`;
    rows+=`<div class="mp2-row${iso===todayIso()?' today':''}${low?' low':''}">
      <div class="mp2-main" onclick="this.parentElement.classList.toggle('open')">
        <div class="dt"><div class="d1">${fmtVN(iso)}</div>
          <div class="d2 ${dw===0?'dowSun':dw===6?'dowSat':''}">${dowOf(iso)}${iso===todayIso()?' · '+t2('Hôm nay'):''}</div></div>
        <div class="pillrow">
          ${pill(B.D.length,t2('NGÀY'),'var(--cD)',lowD)}
          ${pill(B.N.length,t2('ĐÊM'),'var(--cN)',lowN)}
          ${pill(B.O.length,t2('VP'),'var(--cO)',false)}
          ${pill(B.R.length,t2('NGHỈ CA'),'var(--cR)',false)}
          ${pill(B.leave.length,t2('PHÉP'),'var(--cAL)',false)}
          ${pill(B.ot.length,t2('TĂNG CA'),'var(--cOT)',false)}
        </div>
        ${low?'<span class="st rejected">⚠</span>':''}
        <span class="chev">▼</span>
      </div>
      <div class="mp2-det">
        ${line('D',B.D)}${line('N',B.N)}${line('O',B.O)}
        ${line('R',B.R,'Có thể huy động tăng ca')}
        ${B.leave.length?`<div class="mp-line">${chip('AL8')}<span class="who">${B.leave.map(x=>esc(x.e.name||x.e.id)+' ('+x.c+')').join(', ')}</span></div>`:''}
        ${B.ot.length?`<div class="mp-line">${chip('OTD')}<span class="who">${B.ot.map(x=>esc(x.e.name||x.e.id)+' ('+x.c+')').join(', ')}</span></div>`:''}
      </div>
    </div>`;
  });
  const head=`<div class="card rep-head">
    <b>${days.length} ngày</b>
    <span class="st ${nLow?'rejected':'approved'}">${nLow?('⚠ '+nLow+' ngày thiếu nhân lực'):'✓ Đủ nhân lực toàn khoảng'}</span>
    <span class="muted sm2">Chạm vào từng ngày để xem danh sách tên</span></div>`;
  return shown?head+`<div class="mp2">${rows}</div>`
              :head+'<div class="card"><p class="muted">Không có ngày nào khớp bộ lọc.</p></div>';
}

/* =================== 2. THỐNG KÊ =================== */
function repStatsAll(){
  const rows=statRows(repYm,repGroup);
  if(!rows.length)return '<div class="card"><p class="muted">Chưa có nhân sự / lịch trong kỳ này.</p></div>';
  const sum=f=>rnd1(rows.reduce((a,r)=>a+f(r.s),0));
  const cD=s=>(s.cnt.D||0)+(s.cnt.SD||0),cN=s=>(s.cnt.N||0)+(s.cnt.SN||0),cO=s=>(s.cnt.O||0)+(s.cnt.SO||0);
  let h=`<div class="me-stats rep-sum">
    <div class="stat-box"><div class="v">${sum(s=>s.hWork)}</div><div class="k">TỔNG GIỜ CÔNG</div></div>
    <div class="stat-box"><div class="v">${sum(s=>s.hOT)}</div><div class="k">TỔNG GIỜ TĂNG CA</div></div>
    <div class="stat-box"><div class="v">${sum(s=>s.hLeave)}</div><div class="k">TỔNG GIỜ PHÉP</div></div>
    <div class="stat-box"><div class="v">${rows.length}</div><div class="k">NHÂN SỰ</div></div>
  </div>`;
  h+='<div class="card stbl"><table><thead><tr><th class="l">Nhóm</th><th class="l">Họ tên</th><th>D</th><th>N</th><th>O</th><th>R</th><th>AL8</th><th>AL4</th><th>NP</th><th>OFF</th><th>Ca OT</th><th class="hl">Giờ công</th><th class="hl">Giờ OT</th><th class="hl">Giờ phép</th></tr></thead><tbody>';
  rows.forEach(({e,s})=>{
    h+=`<tr><td class="l">${esc(e.team||'—')}</td>
      <td class="l"><b>${esc(e.name||e.id)}</b> <span class="muted" style="font-size:10px">${esc(e.pos||'')}</span></td>
      <td>${cD(s)}</td><td>${cN(s)}</td><td>${cO(s)}</td><td>${s.cnt.R||0}</td>
      <td>${s.cnt.AL8||0}</td><td>${s.cnt.AL4||0}</td><td>${s.cnt.NP||0}</td><td>${s.cnt.OFF||0}</td>
      <td>${otShifts(s)}</td>
      <td class="hl">${rnd1(s.hWork)}</td><td class="hl">${rnd1(s.hOT)}</td><td class="hl">${rnd1(s.hLeave)}</td></tr>`;
  });
  h+='</tbody><tfoot><tr><td class="l" colspan="2">TỔNG CỘNG</td>';
  h+=`<td>${rows.reduce((a,r)=>a+cD(r.s),0)}</td><td>${rows.reduce((a,r)=>a+cN(r.s),0)}</td><td>${rows.reduce((a,r)=>a+cO(r.s),0)}</td>`;
  ['R','AL8','AL4','NP','OFF'].forEach(c=>{h+=`<td>${rows.reduce((a,r)=>a+(r.s.cnt[c]||0),0)}</td>`;});
  h+=`<td>${rows.reduce((a,r)=>a+otShifts(r.s),0)}</td>
    <td class="hl">${sum(s=>s.hWork)}</td><td class="hl">${sum(s=>s.hOT)}</td><td class="hl">${sum(s=>s.hLeave)}</td></tr></tfoot></table></div>`;
  h+=`<p class="muted sm2" style="margin-top:8px">Tính theo lịch thực tế (chuẩn + điều chỉnh + đơn đã duyệt). Số giờ mỗi mã ca khai ở tab Dữ liệu.</p>`;
  return h;
}
/* Nhân viên thường: chỉ số liệu của chính mình */
function repStatsMe(){
  const id=meId();if(!id)return '<div class="card"><p class="muted">Đăng nhập để xem.</p></div>';
  const e=empById(id)||{};
  const days=daysOfPeriod(repYm), s=calcStats(id,days);
  const ot=otSummary(id,repYm);
  const cD=(s.cnt.D||0)+(s.cnt.SD||0),cN=(s.cnt.N||0)+(s.cnt.SN||0),cO=(s.cnt.O||0)+(s.cnt.SO||0);
  const left=alLeft(id);
  return `<div class="me-stats rep-sum">
      <div class="stat-box"><div class="v">${rnd1(s.hWork)}</div><div class="k">GIỜ CÔNG</div></div>
      <div class="stat-box"><div class="v">${rnd1(s.hOT)}</div><div class="k">GIỜ TĂNG CA</div></div>
      <div class="stat-box"><div class="v">${rnd1(s.hLeave)}</div><div class="k">GIỜ PHÉP</div></div>
      <div class="stat-box"><div class="v">${rnd1(left)}</div><div class="k">PHÉP NĂM CÒN LẠI</div></div>
    </div>
    <div class="card"><h3 class="rep-h3">${esc(e.name||id)} · ${esc(periodFor(repYm).label)}</h3>
      <div class="stbl"><table><thead><tr><th>Ca ngày D</th><th>Ca đêm N</th><th>Văn phòng O</th><th>Nghỉ ca R</th>
        <th>AL8</th><th>AL4</th><th>NP</th><th>OFF</th><th>Ca OT</th></tr></thead>
        <tbody><tr><td>${cD}</td><td>${cN}</td><td>${cO}</td><td>${s.cnt.R||0}</td>
        <td>${s.cnt.AL8||0}</td><td>${s.cnt.AL4||0}</td><td>${s.cnt.NP||0}</td><td>${s.cnt.OFF||0}</td>
        <td>${otShifts(s)}</td></tr></tbody></table></div>
      ${ot.pending?`<p class="muted sm2" style="margin-top:8px">Còn ${rnd1(ot.pending)}h tăng ca đang chờ duyệt.</p>`:''}
    </div>
    <p class="muted sm2">Bạn chỉ xem được số liệu của mình. Số liệu cả tổ do quản lý xem.</p>`;
}

/* =================== 3. BIỂU ĐỒ (đã gộp làm MỘT) ===================
   Trước đây tab Biểu đồ có 2 khối tách rời: khối biểu đồ cố định của cả kỳ
   và khối "Tổng hợp cá nhân / nhóm". Nay gộp thành MỘT bảng duy nhất:
   chọn phạm vi (tháng/quý/năm) + nhóm/cá nhân, rồi TÍCH CHỌN các biểu đồ
   muốn xem (nhiều loại cùng lúc). Nhân viên thường chỉ xem của mình. */
function repCharts(){return repPersonal();}

/* ============================================================
   TỔNG HỢP CÁ NHÂN / NHÓM — bảng biểu đồ hợp nhất
   ============================================================ */
let repPMode='month';           // 'month' | 'quarter' | 'year'
let repPSel='';                 // 'YYYY-MM' | 'YYYY-Qn' | 'YYYY'
let repPTeams=[];               // các nhóm đã tích
let repPIds=[];                 // các cá nhân đã tích
let repPQuery='';               // ô tìm tên
/* Các biểu đồ được tích để hiển thị (chọn nhiều) */
const REPP_VIEWS=[
  ['hours','📊 Giờ công theo người'],
  ['mix','🍩 Cơ cấu ca'],
  ['otTeam','⚡ Tăng ca theo nhóm'],
  ['trend','📈 Diễn biến theo kỳ']
];
let repPViews={hours:true,mix:true,otTeam:true,trend:true};
function repPToggleView(k){repPViews[k]=!repPViews[k];renderReport();}

function repPSetMode(m){repPMode=m;repPSel='';renderReport();}
function repPSetSel(v){repPSel=v;renderReport();}
function repPToggleTeam(tm){
  const i=repPTeams.indexOf(tm);
  if(i<0)repPTeams.push(tm);else repPTeams.splice(i,1);
  renderReport();
}
function repPToggleId(id){
  const i=repPIds.indexOf(id);
  if(i<0)repPIds.push(id);else repPIds.splice(i,1);
  renderReport();
}
function repPClear(){repPTeams=[];repPIds=[];repPQuery='';renderReport();}
/* Gõ tìm tên: chỉ vẽ lại danh sách kết quả, không vẽ cả trang (giữ con trỏ gõ) */
function repPFilter(v){
  repPQuery=v||'';
  const box=$('repPList');if(box)box.innerHTML=repPListHtml();
}
function repPListHtml(){
  const q=noAccent(repPQuery);
  if(!q)return '';
  const list=schedEmps().filter(e=>noAccent(e.name||'').includes(q)||noAccent(e.id).includes(q)).slice(0,20);
  if(!list.length)return '<p class="muted sm2" style="padding:4px 2px">Không tìm thấy ai khớp.</p>';
  return list.map(e=>`<button type="button" class="fchip${repPIds.includes(e.id)?' on':''}" onclick="repPToggleId('${e.id}')">
    ${esc(shortName(e.name)||e.id)}<i>${esc(teamShort(e.team||'')||'—')}</i></button>`).join('');
}

/* Các lựa chọn kỳ theo chế độ */
function repPOptions(){
  const ms=monthsAvailable();
  if(repPMode==='month')return ms.map(m=>({v:m,label:periodFor(m).label}));
  if(repPMode==='quarter'){
    const set=[];
    ms.forEach(m=>{const[y,mo]=m.split('-').map(Number);const q=Math.ceil(mo/3);const v=y+'-Q'+q;
      if(!set.some(x=>x.v===v))set.push({v,label:'Quý '+q+'/'+y});});
    return set;
  }
  const ys=[...new Set(ms.map(m=>m.slice(0,4)))];
  return ys.map(y=>({v:y,label:'Năm '+y}));
}
/* Danh sách kỳ công (ym) nằm trong lựa chọn hiện tại */
function repPMonths(){
  const ms=monthsAvailable();
  if(repPMode==='month')return repPSel?[repPSel]:[];
  if(repPMode==='quarter'){
    if(!repPSel)return [];
    const[y,q]=repPSel.split('-Q');
    return ms.filter(m=>{const[yy,mo]=m.split('-').map(Number);return String(yy)===y&&Math.ceil(mo/3)===+q;});
  }
  return repPSel?ms.filter(m=>m.slice(0,4)===repPSel):[];
}
function repPEmps(){
  if(!repSeeAll()){const e=empById(meId());return e?[e]:[];}
  let out=[];
  if(repPTeams.length)out=schedEmps().filter(e=>repPTeams.includes(e.team||''));
  repPIds.forEach(id=>{if(!out.some(e=>e.id===id)){const e=empById(id);if(e)out.push(e);}});
  if(!out.length)out=schedEmps();
  return out;
}

function repPersonal(){
  const opts=repPOptions();
  if(!repPSel||!opts.some(o=>o.v===repPSel))repPSel=opts.length?opts[opts.length-1].v:'';
  const months=repPMonths();
  const emps=repPEmps();
  const seeAll=repSeeAll();
  const selLbl=(opts.find(o=>o.v===repPSel)||{}).label||'';

  /* --- thanh điều khiển --- */
  let h=`<div class="card repp"><h3 class="rep-h3">📌 Tổng hợp ${seeAll?'cá nhân / nhóm':'của tôi'} theo tháng · quý · năm</h3>
  <div class="rep-ctl" style="margin-bottom:10px">
    <div class="seg">
      <button class="${repPMode==='month'?'on':''}" onclick="repPSetMode('month')">Tháng</button>
      <button class="${repPMode==='quarter'?'on':''}" onclick="repPSetMode('quarter')">Quý</button>
      <button class="${repPMode==='year'?'on':''}" onclick="repPSetMode('year')">Năm</button>
    </div>
    <select class="inp sm" style="font-weight:700" onchange="repPSetSel(this.value)">
      ${opts.map(o=>`<option value="${o.v}"${o.v===repPSel?' selected':''}>${esc(o.label)}</option>`).join('')}
    </select>
  </div>`;
  if(seeAll){
    const teams=teamList();
    h+=`<div class="repp-pick">
      <div class="repp-row"><span class="lbl">Nhóm:</span>
        ${teams.map(tm=>`<button type="button" class="fchip${repPTeams.includes(tm)?' on':''}" onclick="repPToggleTeam('${esc(tm)}')">Nhóm ${esc(tm||'(chưa phân)')}</button>`).join('')||'<span class="muted sm2">Chưa có nhóm.</span>'}
      </div>
      <div class="repp-row"><span class="lbl">Cá nhân:</span>
        <input class="inp sm" style="min-width:170px" placeholder="Gõ tên để tìm… (không dấu cũng được)"
          value="${esc(repPQuery)}" oninput="repPFilter(this.value)">
        ${(repPTeams.length||repPIds.length)?`<button type="button" class="btn sec sm" onclick="repPClear()">✕ Bỏ chọn hết</button>`:''}
      </div>
      <div class="repp-row wrap" id="repPList">${repPListHtml()}</div>
      ${repPIds.length?`<div class="repp-row wrap"><span class="lbl">Đã chọn:</span>
        ${repPIds.map(id=>{const e=empById(id)||{};return `<button type="button" class="fchip on" onclick="repPToggleId('${id}')">${esc(shortName(e.name)||id)} ✕</button>`;}).join('')}
      </div>`:''}
      <p class="muted sm2">Không tích gì = xem cả tổ. Tích nhóm và / hoặc từng người để gộp số liệu đúng phạm vi cần xem.</p>
    </div>`;
  }

  /* --- Chọn biểu đồ muốn xem (tích nhiều loại cùng lúc) --- */
  h+=`<div class="repp-row wrap" style="margin-bottom:4px"><span class="lbl">Biểu đồ:</span>
    ${REPP_VIEWS.map(([k,l])=>`<button type="button" class="fchip${repPViews[k]?' on':''}" onclick="repPToggleView('${k}')">${repPViews[k]?'✓ ':''}${esc(l)}</button>`).join('')}
  </div></div>`;   // đóng .card repp phần điều khiển

  if(!months.length){return h+`<div class="card">${chEmpty('Chưa có dữ liệu lịch cho lựa chọn này.')}</div>`;}

  /* --- số liệu gộp --- */
  const allDays=[].concat(...months.map(m=>daysOfPeriod(m)));
  const ids=emps.map(e=>e.id);
  let hW=0,hO=0,hL=0;
  const perRows=emps.map(e=>{const s=calcStats(e.id,allDays);hW+=s.hWork;hO+=s.hOT;hL+=s.hLeave;return{e,s};});
  h+=`<div class="card"><div class="me-stats rep-sum" style="margin-bottom:0">
    <div class="stat-box"><div class="v">${rnd1(hW)}</div><div class="k">GIỜ CÔNG · ${esc(selLbl)}</div></div>
    <div class="stat-box"><div class="v">${rnd1(hO)}</div><div class="k">GIỜ TĂNG CA</div></div>
    <div class="stat-box"><div class="v">${rnd1(hL)}</div><div class="k">GIỜ PHÉP</div></div>
    <div class="stat-box"><div class="v">${emps.length}</div><div class="k">NHÂN SỰ</div></div>
  </div></div>`;

  const anyView=REPP_VIEWS.some(([k])=>repPViews[k]);
  if(!anyView)return h+`<div class="card">${chEmpty('Chưa chọn biểu đồ nào — tích ít nhất một loại ở trên.')}</div>`;

  /* --- Giờ công theo người (hoặc bảng chi tiết khi chỉ 1 người) --- */
  if(repPViews.hours){
    if(emps.length>1){
      h+=`<div class="card"><h3 class="rep-h3">Giờ công theo người · ${esc(selLbl)}</h3>${chartHoursByEmp(emps,allDays)}</div>`;
    }else if(emps.length===1){
      const s=perRows[0].s;
      const cD=(s.cnt.D||0)+(s.cnt.SD||0),cN=(s.cnt.N||0)+(s.cnt.SN||0),cO=(s.cnt.O||0)+(s.cnt.SO||0);
      h+=`<div class="card"><h3 class="rep-h3">Chi tiết ${esc(shortName(perRows[0].e.name)||perRows[0].e.id)} · ${esc(selLbl)}</h3>
        <div class="stbl"><table><thead>
        <tr><th>Ca ngày D</th><th>Ca đêm N</th><th>Văn phòng O</th><th>Nghỉ ca R</th><th>Nghỉ phép</th><th>Ca OT</th></tr></thead>
        <tbody><tr><td>${cD}</td><td>${cN}</td><td>${cO}</td><td>${s.cnt.R||0}</td>
        <td>${Object.entries(s.cnt).filter(([c])=>codeInfo(c).cat==='leave').reduce((a,[,n])=>a+n,0)}</td>
        <td>${otShifts(s)}</td></tr></tbody></table></div></div>`;
    }
  }

  /* --- Cơ cấu ca + Tăng ca theo nhóm: xếp cạnh nhau nếu cùng bật --- */
  const mixCard=repPViews.mix?`<div class="card"><h3 class="rep-h3">Cơ cấu ca · ${esc(selLbl)}</h3>${chartMix(ids,allDays)}</div>`:'';
  const otCard=repPViews.otTeam?`<div class="card"><h3 class="rep-h3">Giờ tăng ca theo nhóm · ${esc(selLbl)}</h3>${chartOtByTeam(emps,allDays)}</div>`:'';
  if(mixCard&&otCard)h+=`<div class="grid2 rep-grid2">${mixCard}${otCard}</div>`;
  else h+=mixCard+otCard;

  /* --- Diễn biến theo kỳ --- */
  if(repPViews.trend){
    let mm=months;
    // Ở chế độ "tháng" chỉ có 1 kỳ → cho xem xu hướng 6 kỳ gần nhất cho có ý nghĩa
    if(mm.length<2)mm=monthsAvailable().slice(-6);
    if(mm.length>1){
      const w=[],o=[],l=[];
      mm.forEach(m=>{
        const ds=daysOfPeriod(m);let a=0,b=0,c=0;
        ids.forEach(id=>{const s=calcStats(id,ds);a+=s.hWork;b+=s.hOT;c+=s.hLeave;});
        w.push(rnd1(a));o.push(rnd1(b));l.push(rnd1(c));
      });
      h+=`<div class="card"><h3 class="rep-h3">Diễn biến theo kỳ công</h3>`+chartStacked(
        mm.map(m=>{const p=periodFor(m);return 'T'+p.m+'/'+String(p.y).slice(2);}),
        [{name:'Giờ công',color:'#0B3B5C',data:w},
         {name:'Giờ tăng ca',color:'#D9534F',data:o},
         {name:'Giờ phép',color:'#C77DBB',data:l}],{h:190})+`</div>`;
    }
  }
  return h;
}

/* ============================================================
   BỘ VẼ BIỂU ĐỒ BẰNG SVG THUẦN
   Không dùng thư viện ngoài → mở offline vẫn chạy, in ra vẫn nét.
   ============================================================ */
const CH={pad:{l:34,r:8,t:10,b:26},font:10};
function chEsc(s){return esc(s);}
function chLegend(items){
  return `<div class="ch-legend">${items.map(i=>
    `<span><i style="background:${i.color}"></i>${chEsc(t(i.name))}</span>`).join('')}</div>`;
}
function chEmpty(msg){return `<p class="muted sm2" style="padding:10px 2px">${chEsc(msg||'Chưa có số liệu.')}</p>`;}

/* Cột chồng theo ngày + đường định mức */
function chartStacked(labels,series,opt){
  opt=opt||{};
  const n=labels.length;if(!n)return chEmpty();
  const W=Math.max(560,n*22+CH.pad.l+CH.pad.r), H=opt.h||210;
  const iw=W-CH.pad.l-CH.pad.r, ih=H-CH.pad.t-CH.pad.b;
  let max=0;
  for(let i=0;i<n;i++){let s=0;series.forEach(se=>s+=(se.data[i]||0));if(s>max)max=s;}
  (opt.ref||[]).forEach(r=>{if(r.v>max)max=r.v;});
  max=Math.max(1,Math.ceil(max*1.15));
  const bw=Math.max(6,Math.min(22,iw/n*0.68));
  const x=i=>CH.pad.l+iw*(i+0.5)/n;
  const y=v=>CH.pad.t+ih-(v/max)*ih;
  let g='';
  // lưới ngang
  const step=Math.max(1,Math.ceil(max/4));
  for(let v=0;v<=max;v+=step){
    g+=`<line x1="${CH.pad.l}" y1="${y(v)}" x2="${W-CH.pad.r}" y2="${y(v)}" stroke="#E8EDF3"/>`
      +`<text x="${CH.pad.l-5}" y="${y(v)+3}" text-anchor="end" font-size="${CH.font-1}" fill="#94A3B8">${v}</text>`;
  }
  // cột chồng
  for(let i=0;i<n;i++){
    let acc=0;
    series.forEach(se=>{
      const v=se.data[i]||0;if(!v)return;
      const y1=y(acc+v),y2=y(acc);
      g+=`<rect x="${(x(i)-bw/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5,y2-y1).toFixed(1)}" fill="${se.color}"><title>${chEsc(labels[i]+' · '+t(se.name)+': '+v)}</title></rect>`;
      acc+=v;
    });
  }
  // đường định mức
  (opt.ref||[]).forEach(r=>{
    g+=`<line x1="${CH.pad.l}" y1="${y(r.v)}" x2="${W-CH.pad.r}" y2="${y(r.v)}" stroke="${r.color}" stroke-width="1.2" stroke-dasharray="5 3"/>`
      +`<text x="${W-CH.pad.r-2}" y="${y(r.v)-3}" text-anchor="end" font-size="${CH.font-1}" fill="${r.color}" font-weight="700">${chEsc(r.label)}</text>`;
  });
  // nhãn trục X (thưa bớt nếu nhiều ngày)
  const every=n>24?3:(n>14?2:1);
  for(let i=0;i<n;i++){
    if(i%every)continue;
    g+=`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="${CH.font-1}" fill="#64748B">${chEsc(labels[i])}</text>`;
  }
  return `<div class="ch-scroll"><svg viewBox="0 0 ${W} ${H}" style="width:${W>640?W+'px':'100%'};max-width:none;height:${H}px" role="img">${g}</svg></div>`
    +chLegend(series.concat((opt.ref||[]).map(r=>({name:r.label,color:r.color}))));
}

/* Thanh ngang NỐI TIẾP: mỗi người một thanh duy nhất, các loại giờ xếp liền
   nhau trong cùng thanh — gọn hơn nhiều so với tách mỗi loại một thanh. */
function chartStackedH(rows,series,opt){
  opt=opt||{};
  const n=rows.length;if(!n)return chEmpty();
  const barH=opt.barH||18, rowH=barH+11;
  const lw=opt.labelW||150, valW=58, W=940;
  let max=0;rows.forEach(r=>{let s=0;series.forEach(x=>s+=(x.get(r)||0));if(s>max)max=s;});
  max=Math.max(1,max);
  const iw=W-lw-valW-10, H=n*rowH+12;
  let g='';
  // vạch lưới dọc
  const pw=Math.pow(10,Math.floor(Math.log10(max)));
  const step=pw*(max/pw>5?2:1);
  for(let v=step;v<=max;v+=step){
    const x=lw+(v/max)*iw;
    g+=`<line x1="${x.toFixed(1)}" y1="2" x2="${x.toFixed(1)}" y2="${H-8}" stroke="#EDF1F5"/>`
      +`<text x="${x.toFixed(1)}" y="${H-1}" text-anchor="middle" font-size="9.5" fill="#B6C2CE">${v}</text>`;
  }
  rows.forEach((r,i)=>{
    const y0=i*rowH+5;
    if(i%2===0)g+=`<rect x="0" y="${y0-4}" width="${W}" height="${rowH}" fill="#FAFCFE"/>`;
    g+=`<text x="${lw-8}" y="${y0+barH/2+4}" text-anchor="end" font-size="12" font-weight="600" fill="#0F172A">${chEsc(opt.label(r))}</text>`;
    let acc=0,tot=0;
    series.forEach(sr=>{
      const v=sr.get(r)||0;if(v<=0)return;
      const x=lw+(acc/max)*iw, w=Math.max(1.5,(v/max)*iw);
      g+=`<rect x="${x.toFixed(1)}" y="${y0}" width="${w.toFixed(1)}" height="${barH}" fill="${sr.color}"><title>${
        chEsc(opt.label(r)+' · '+t(sr.name)+': '+rnd1(v))}</title></rect>`;
      // ghi số ngay trong đoạn nếu đủ rộng
      if(w>26)g+=`<text x="${(x+w/2).toFixed(1)}" y="${y0+barH/2+4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">${rnd1(v)}</text>`;
      acc+=v;tot+=v;
    });
    g+=`<text x="${(lw+(acc/max)*iw+6).toFixed(1)}" y="${y0+barH/2+4}" font-size="11.5" font-weight="800" fill="#0F172A">${rnd1(tot)}</text>`;
  });
  return `<div class="ch-scroll"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:620px;height:${H}px" preserveAspectRatio="xMinYMin meet" role="img">${g}</svg></div>`
    +chLegend(series.concat([{name:'Tổng',color:'#0F172A'}]));
}
/* Thanh ngang đơn giản (một chỉ số) — dùng cho biểu đồ tăng ca theo nhóm */
function chartGroupedH(rows,series,opt){
  if(series.length===1){
    opt=Object.assign({},opt,{barH:opt&&opt.barH||16});
    return chartStackedH(rows,series,opt);
  }
  return chartStackedH(rows,series,opt);
}

/* Vành khuyên cơ cấu ca */
function chartDonut(slices){
  const tot=slices.reduce((a,s)=>a+s.value,0);
  if(!tot)return chEmpty();
  const S=170,cx=S/2,cy=S/2,R=72,r=44;
  let a0=-Math.PI/2,g='';
  slices.forEach(s=>{
    if(!s.value)return;
    const a1=a0+2*Math.PI*s.value/tot;
    const big=(a1-a0)>Math.PI?1:0;
    const p=(rad,a)=>[(cx+rad*Math.cos(a)).toFixed(2),(cy+rad*Math.sin(a)).toFixed(2)];
    const[x1,y1]=p(R,a0),[x2,y2]=p(R,a1),[x3,y3]=p(r,a1),[x4,y4]=p(r,a0);
    g+=`<path d="M${x1} ${y1}A${R} ${R} 0 ${big} 1 ${x2} ${y2}L${x3} ${y3}A${r} ${r} 0 ${big} 0 ${x4} ${y4}Z" fill="${s.color}"><title>${chEsc(t(s.label)+': '+s.value+' ('+Math.round(s.value/tot*100)+'%)')}</title></path>`;
    a0=a1;
  });
  g+=`<text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="19" font-weight="700" fill="#0F172A">${tot}</text>`
    +`<text x="${cx}" y="${cy+13}" text-anchor="middle" font-size="9" fill="#94A3B8">ca</text>`;
  return `<svg viewBox="0 0 ${S} ${S}" style="width:170px;height:170px;display:block;margin:0 auto" role="img">${g}</svg>`
    +chLegend(slices.map(s=>({name:t(s.label)+' ('+s.value+')',color:s.color})));
}

/* ---- Các biểu đồ cụ thể ---- */
/* Giờ công theo người — dạng bảng + thanh: cột số tách riêng nên dễ so sánh,
   thanh chỉ gồm giờ LÀM (công + tăng ca); giờ phép để riêng một cột,
   không cộng lẫn vào thanh gây hiểu nhầm như bản cũ. */
function chartHoursByEmp(emps,days){
  if(!emps.length)return chEmpty();
  const rows=emps.map(e=>({e,s:calcStats(e.id,days)}))
                 .map(r=>Object.assign(r,{tot:r.s.hWork+r.s.hOT}))
                 .sort((a,b)=>b.tot-a.tot||b.s.hWork-a.s.hWork);
  const max=Math.max(1,...rows.map(r=>r.tot));
  const seg=(v,col)=>v>0?`<i style="width:${(v/max*100).toFixed(2)}%;background:${col}"></i>`:'';
  let h=`<div class="hb-tbl">
    <div class="hb-row hd">
      <span class="nm"></span><span class="bar"></span>
      <span class="num">Công</span><span class="num">OT</span><span class="num">Phép</span><span class="num tot">Σ Làm</span>
    </div>`;
  rows.forEach(r=>{
    h+=`<div class="hb-row">
      <span class="nm" title="${chEsc((r.e.name||r.e.id)+(r.e.team?' · Nhóm '+r.e.team:''))}">${chEsc(shortName(r.e.name||r.e.id))}</span>
      <span class="bar" title="${chEsc('Công '+rnd1(r.s.hWork)+'h · OT '+rnd1(r.s.hOT)+'h')}">${seg(r.s.hWork,'#0B3B5C')}${seg(r.s.hOT,'#D9534F')}</span>
      <span class="num">${rnd1(r.s.hWork)}</span>
      <span class="num ot">${r.s.hOT?rnd1(r.s.hOT):'·'}</span>
      <span class="num al">${r.s.hLeave?rnd1(r.s.hLeave):'·'}</span>
      <span class="num tot">${rnd1(r.tot)}</span>
    </div>`;
  });
  h+='</div>'+chLegend([{name:'Giờ công',color:'#0B3B5C'},{name:'Giờ tăng ca',color:'#D9534F'}])
    +`<p class="muted sm2" style="margin-top:4px">Thanh = giờ làm thực (công + tăng ca), xếp từ cao xuống thấp. Giờ phép ghi ở cột riêng, không cộng vào thanh.</p>`;
  return h;
}
function chartMix(ids,days){
  const cnt={};
  ids.forEach(id=>days.forEach(iso=>{
    const c=eff(id,iso).code;if(!c)return;
    const k=(codeInfo(c).cat==='leave')?'AL':(baseShiftOf(c)||c);
    cnt[k]=(cnt[k]||0)+1;
  }));
  const def=[['D','Ca ngày','#4C6BC0'],['N','Ca đêm','#3E8E5A'],['O','Văn phòng','#7C6BD6'],
             ['R','Nghỉ ca','#CBD5E1'],['AL','Nghỉ phép','#C77DBB']];
  const slices=def.filter(([k])=>cnt[k]).map(([k,l,c])=>({label:l,value:cnt[k],color:c}));
  Object.keys(cnt).forEach(k=>{if(!def.some(d=>d[0]===k))slices.push({label:k,value:cnt[k],color:'#94A3B8'});});
  return chartDonut(slices);
}
function chartOtByTeam(emps,days){
  const by={};
  emps.forEach(e=>{
    const k=e.team||'(chưa phân nhóm)';
    by[k]=(by[k]||0)+calcStats(e.id,days).hOT;
  });
  const rows=Object.keys(by).sort().map(k=>({k,v:by[k]}));
  if(!rows.some(r=>r.v))return chEmpty('Kỳ này chưa có giờ tăng ca nào.');
  return chartStackedH(rows,[{name:'Giờ tăng ca',color:'#D9534F',get:r=>r.v}],
    {label:r=>'Nhóm '+teamShort(r.k),labelW:120,barH:16});
}
/* Xu hướng giờ công của một người qua 6 kỳ gần nhất */
function chartTrend(id){
  const ms=monthsAvailable().slice(-6);
  if(!ms.length)return chEmpty();
  const w=[],o=[],l=[];
  ms.forEach(m=>{const s=calcStats(id,daysOfPeriod(m));w.push(rnd1(s.hWork));o.push(rnd1(s.hOT));l.push(rnd1(s.hLeave));});
  return chartStacked(ms.map(m=>{const p=periodFor(m);return 'T'+p.m+'/'+String(p.y).slice(2);}),[
    {name:'Giờ công',color:'#0B3B5C',data:w},
    {name:'Giờ tăng ca',color:'#D9534F',data:o},
    {name:'Giờ phép',color:'#C77DBB',data:l}
  ],{h:200});
}

/* ============================================================
   NHẬT KÝ TĂNG CA — dữ liệu lịch sử nhập từ file Excel quản lý jan-up
   (window.OTLOG_DATA). Lọc theo kỳ công + tìm tên, có tổng giờ.
   Nhân viên thường chỉ xem dòng của chính mình.
   ============================================================ */
let otlogPeriod='__all';        // '__all' | 'YYYY-MM' (kỳ công)
let otlogQuery='';
function otlogSet(k,v){if(k==='period')otlogPeriod=v;renderReport();}
function otlogFilterName(v){
  otlogQuery=v||'';
  const box=$('otlogBox');if(box)box.innerHTML=otlogTableHtml();
}
/* Chuẩn hoá tên để so khớp (bỏ dấu, viết thường) */
function otNorm(s){return noAccent(String(s||'')).replace(/\s+/g,' ').trim();}
/* Các kỳ công có trong dữ liệu OT log */
function otlogPeriods(){
  const set=new Set();
  (window.OTLOG_DATA||[]).forEach(r=>set.add(schedMonthOf(r.d)));
  return [...set].sort();
}
function otlogRows(){
  let rows=(window.OTLOG_DATA||[]).slice();
  if(!repSeeAll()){
    const me=empById(meId());
    const key=me?otNorm(me.name):'';
    rows=rows.filter(r=>key&&otNorm(r.n)===key);
  }
  if(otlogPeriod!=='__all')rows=rows.filter(r=>schedMonthOf(r.d)===otlogPeriod);
  const q=otNorm(otlogQuery);
  if(q)rows=rows.filter(r=>otNorm(r.n).includes(q)||otNorm(r.r).includes(q));
  rows.sort((a,b)=>a.d<b.d?1:a.d>b.d?-1:0);   // mới nhất trước
  return rows;
}
function otlogTableHtml(){
  const rows=otlogRows();
  if(!rows.length)return `<div class="card"><p class="muted">Không có dòng tăng ca nào khớp.</p></div>`;
  const totH=rows.reduce((a,r)=>a+(+r.h||0),0);
  const byName={};rows.forEach(r=>{byName[r.n]=(byName[r.n]||0)+(+r.h||0);});
  const nNames=Object.keys(byName).length;
  const top=Object.entries(byName).sort((a,b)=>b[1]-a[1]).slice(0,3)
    .map(([n,h])=>`${esc(shortName(n))} ${rnd1(h)}h`).join(' · ');
  let h=`<div class="card rep-head">
    <b>${rows.length} lượt tăng ca</b>
    <span class="st approved">Σ ${rnd1(totH)} giờ</span>
    <span class="muted sm2">${nNames} người${top?' · nhiều nhất: '+top:''}</span></div>
  <div class="card stbl otlog-tbl"><table><thead><tr>
    <th class="l">Ngày</th><th class="l">Họ tên</th><th>Bắt đầu</th><th>Kết thúc</th><th>Giờ</th><th class="l">Lý do</th><th>Trạng thái</th>
  </tr></thead><tbody>`;
  rows.slice(0,400).forEach(r=>{
    h+=`<tr>
      <td class="l">${esc(fmtVN(r.d))}</td>
      <td class="l"><b>${esc(shortName(r.n)||r.n)}</b></td>
      <td>${esc(r.s||'')}</td><td>${esc(r.e||'')}</td>
      <td class="hl">${rnd1(+r.h||0)}</td>
      <td class="l" style="font-size:11px">${esc(r.r||'')}</td>
      <td>${r.st==='done'?'<span class="st approved">완료 / Duyệt</span>':esc(r.st||'')}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>`;
  if(rows.length>400)h+=`<p class="muted sm2" style="margin-top:6px">Đang hiện 400 dòng mới nhất trong ${rows.length} dòng khớp.</p>`;
  return h;
}
function repOtLog(){
  if(!window.OTLOG_DATA||!window.OTLOG_DATA.length)
    return '<div class="card"><p class="muted">Chưa có dữ liệu nhật ký tăng ca.</p></div>';
  const ps=otlogPeriods();
  if(otlogPeriod!=='__all'&&!ps.includes(otlogPeriod))otlogPeriod='__all';
  return `<div class="card repp">
    <h3 class="rep-h3">🗂 Nhật ký tăng ca ${repSeeAll()?'(toàn bộ)':'của tôi'} — nhập từ file Excel quản lý</h3>
    <div class="rep-ctl" style="margin-bottom:8px">
      <label class="fl2">Kỳ công</label>
      <select class="inp sm" style="font-weight:700" onchange="otlogSet('period',this.value)">
        <option value="__all"${otlogPeriod==='__all'?' selected':''}>Tất cả kỳ</option>
        ${ps.map(m=>`<option value="${m}"${m===otlogPeriod?' selected':''}>${periodFor(m).label}</option>`).join('')}
      </select>
      ${repSeeAll()?`<input class="inp sm" style="min-width:180px" placeholder="Tìm tên / lý do…"
        value="${esc(otlogQuery)}" oninput="otlogFilterName(this.value)">`:''}
    </div>
    <p class="muted sm2">Dữ liệu lịch sử tháng 12/2025 → 07/2026 lấy từ bảng <b>LPG Terminal_Cavern 근무관리 일지</b>. Chỉ để tra cứu, không ảnh hưởng lịch hiện hành.</p>
  </div>
  <div id="otlogBox">${otlogTableHtml()}</div>`;
}

/* ============================================================
   GỬI EMAIL BÁO CÁO QUA OUTLOOK (mailto)
   App chạy trong trình duyệt nên không thể tự đăng nhập gửi hộ; thay vào đó
   dựng sẵn một email (người nhận + tiêu đề + nội dung tóm tắt) rồi mở ứng dụng
   thư mặc định trên máy — thường là Outlook — để người dùng bấm Gửi.
   Địa chỉ nhận lưu trong phần mềm: S.settings.reportEmailTo / ...Cc.
   ============================================================ */
function buildReportSummary(ym){
  const p=periodFor(ym);
  const reqs=Object.values(S.requests||{}).filter(r=>reqInRange
    ?reqInRange(r,p.from,p.to):true);
  const cnt={pending:0,approved:0,rejected:0};
  const byType={};
  reqs.forEach(r=>{
    if(cnt[r.status]!==undefined)cnt[r.status]++;
    byType[r.type]=(byType[r.type]||0)+1;
  });
  const rows=statRows(ym,'__all');
  const sum=f=>rnd1(rows.reduce((a,r)=>a+f(r.s),0));
  const L=[];
  L.push('BÁO CÁO CÔNG CA — '+p.label);
  L.push('LPGT Cavern · xuất '+fmtDateTime(Date.now()));
  L.push('');
  L.push('ĐƠN TỪ TRONG KỲ');
  L.push('  • Chờ duyệt: '+cnt.pending);
  L.push('  • Đã duyệt: '+cnt.approved);
  L.push('  • Từ chối: '+cnt.rejected);
  const typeLine=Object.entries(byType).map(([k,n])=>(REQ_LABEL[k]||k)+': '+n).join(' · ');
  if(typeLine)L.push('  • Theo loại: '+typeLine);
  L.push('');
  L.push('TỔNG HỢP GIỜ (cả tổ, '+rows.length+' người)');
  L.push('  • Giờ công: '+sum(s=>s.hWork));
  L.push('  • Giờ tăng ca: '+sum(s=>s.hOT));
  L.push('  • Giờ phép: '+sum(s=>s.hLeave));
  L.push('');
  L.push('— Email tạo tự động từ phần mềm Quản lý Công Ca. Bảng chi tiết vui lòng xem file Excel đính kèm (Xuất Excel trong tab Thống kê).');
  return{subject:'[LPGT Cavern] Báo cáo công ca '+p.label,body:L.join('\n')};
}
function openMailReport(){
  const ym=repYm||curSchedMonth();
  const to=(S.settings.reportEmailTo||'').trim();
  const cc=(S.settings.reportEmailCc||'').trim();
  const{subject,body}=buildReportSummary(ym);
  // Modal xem trước + chỉnh người nhận trước khi mở Outlook
  const box=$('mailMask'), b=$('mailBody');
  if(!box||!b){ // chưa có modal → gửi thẳng
    sendReportEmail(to,cc,subject,body);return;
  }
  b.innerHTML=`
    <h3>✉️ Gửi email báo cáo</h3>
    <p class="muted sm2" style="margin-bottom:8px">Bấm Gửi sẽ mở ứng dụng thư mặc định trên máy (Outlook) với nội dung đã soạn sẵn — bạn kiểm tra rồi bấm gửi trong Outlook. Địa chỉ nhận được lưu lại cho lần sau.</p>
    <div class="fg"><label class="fl">Người nhận (To) — cách nhau bằng dấu ;</label>
      <input class="inp" id="mailTo" value="${esc(to)}" placeholder="ten@congty.com; sep@congty.com"></div>
    <div class="fg"><label class="fl">CC (không bắt buộc)</label>
      <input class="inp" id="mailCc" value="${esc(cc)}" placeholder="quanly@congty.com"></div>
    <div class="fg"><label class="fl">Tiêu đề</label>
      <input class="inp" id="mailSubject" value="${esc(subject)}"></div>
    <div class="fg"><label class="fl">Nội dung</label>
      <textarea class="inp" id="mailBodyTxt" rows="10" style="font-family:var(--mono);font-size:12px">${esc(body)}</textarea></div>
    <div class="row" style="margin-top:12px">
      <button class="btn" style="flex:1" onclick="sendReportEmailFromModal()">✉️ Mở Outlook &amp; gửi</button>
      <button class="btn sec" style="flex:1" onclick="closeMailReport()">Đóng</button>
    </div>`;
  box.classList.add('on');
}
function closeMailReport(){const m=$('mailMask');if(m)m.classList.remove('on');}
function sendReportEmailFromModal(){
  const to=($('mailTo').value||'').trim(), cc=($('mailCc').value||'').trim();
  const subject=($('mailSubject').value||'').trim(), body=$('mailBodyTxt').value||'';
  // lưu lại địa chỉ cho lần sau
  S.settings.reportEmailTo=to;S.settings.reportEmailCc=cc;save();
  sendReportEmail(to,cc,subject,body);
  closeMailReport();
}
function sendReportEmail(to,cc,subject,body){
  if(!to){toast(t('Nhập ít nhất một địa chỉ người nhận'));return;}
  const q=[];
  if(cc)q.push('cc='+encodeURIComponent(cc));
  q.push('subject='+encodeURIComponent(subject));
  q.push('body='+encodeURIComponent(body));
  const href='mailto:'+encodeURIComponent(to).replace(/%3B/gi,';')+'?'+q.join('&');
  window.location.href=href;
  toast(t('Đang mở ứng dụng thư trên máy…'));
}
