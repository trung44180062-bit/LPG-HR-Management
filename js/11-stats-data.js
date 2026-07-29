/* ============================================================
   THONG KE (quan ly) + KHAI BAO GIO + EXPORT XLSX + CAI DAT
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== TAB THỐNG KÊ (quản lý) =================== */
function stShift(d){
  const sel=$('stMonth');const i=sel.selectedIndex+d;
  if(i>=0&&i<sel.options.length){sel.selectedIndex=i;renderStats();}
}
function statRows(ym,grp){
  const days=daysOfPeriod(ym);
  let emps=activeEmps();
  if(grp&&grp!=='__all')emps=emps.filter(e=>(e.team||'')===grp);
  return emps.map(e=>({e,s:calcStats(e.id,days)}));
}
function renderStats(){
  fillGroupFilter('stGroup');
  if(!$('stMonth').options.length)fillMonthSelects();
  const ym=$('stMonth').value||curSchedMonth();
  const rows=statRows(ym,$('stGroup').value);
  const sum=f=>rnd1(rows.reduce((a,r)=>a+f(r.s),0));
  $('stSummary').innerHTML=`
    <div class="stat-box"><div class="v">${sum(s=>s.hWork)}</div><div class="k">TỔNG GIỜ CÔNG</div></div>
    <div class="stat-box"><div class="v">${sum(s=>s.hOT)}</div><div class="k">TỔNG GIỜ TĂNG CA</div></div>
    <div class="stat-box"><div class="v">${sum(s=>s.hLeave)}</div><div class="k">TỔNG GIỜ PHÉP</div></div>
    <div class="stat-box"><div class="v">${rows.length}</div><div class="k">NHÂN SỰ</div></div>`;
  const cD=s=>(s.cnt.D||0)+(s.cnt.SD||0),cN=s=>(s.cnt.N||0)+(s.cnt.SN||0),cO=s=>(s.cnt.O||0)+(s.cnt.SO||0);
  let h='<table><thead><tr><th class="l">Nhóm</th><th class="l">Họ tên</th><th>D</th><th>N</th><th>O</th><th>R</th><th>AL8</th><th>AL4</th><th>NP</th><th>OFF</th><th>Ca OT</th><th class="hl">Giờ công</th><th class="hl">Giờ OT</th><th class="hl">Giờ phép</th></tr></thead><tbody>';
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
    <td class="hl">${sum(s=>s.hWork)}</td><td class="hl">${sum(s=>s.hOT)}</td><td class="hl">${sum(s=>s.hLeave)}</td></tr></tfoot></table>`;
  $('stTable').innerHTML=rows.length?h:'<p class="muted" style="padding:16px">Chưa có nhân sự / lịch trong kỳ này.</p>';
}
function exportStats(){
  const ym=$('stMonth').value;if(!ym){toast('Chưa có kỳ nào');return;}
  const p=periodFor(ym);
  const rows=statRows(ym,$('stGroup').value);
  const cD=s=>(s.cnt.D||0)+(s.cnt.SD||0),cN=s=>(s.cnt.N||0)+(s.cnt.SN||0),cO=s=>(s.cnt.O||0)+(s.cnt.SO||0);
  const aoa=[['LPGT CAVERN — THỐNG KÊ CÔNG CA',p.label],[],
    ['Nhóm','Mã NV','Họ tên','Vị trí','Ca D','Ca N','Ca O','R','AL8','AL4','NP','OFF','Ca OT','Giờ công','Giờ OT','Giờ phép']];
  rows.forEach(({e,s})=>{
    aoa.push([e.team||'',e.id,e.name||'',e.pos||'',cD(s),cN(s),cO(s),s.cnt.R||0,s.cnt.AL8||0,s.cnt.AL4||0,s.cnt.NP||0,s.cnt.OFF||0,otShifts(s),rnd1(s.hWork),rnd1(s.hOT),rnd1(s.hLeave)]);
  });
  aoa.push([]);
  aoa.push(['TỔNG','','','',
    rows.reduce((a,r)=>a+cD(r.s),0),rows.reduce((a,r)=>a+cN(r.s),0),rows.reduce((a,r)=>a+cO(r.s),0),
    rows.reduce((a,r)=>a+(r.s.cnt.R||0),0),rows.reduce((a,r)=>a+(r.s.cnt.AL8||0),0),rows.reduce((a,r)=>a+(r.s.cnt.AL4||0),0),
    rows.reduce((a,r)=>a+(r.s.cnt.NP||0),0),rows.reduce((a,r)=>a+(r.s.cnt.OFF||0),0),rows.reduce((a,r)=>a+otShifts(r.s),0),
    rnd1(rows.reduce((a,r)=>a+r.s.hWork,0)),rnd1(rows.reduce((a,r)=>a+r.s.hOT,0)),rnd1(rows.reduce((a,r)=>a+r.s.hLeave,0))]);
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:7},{wch:11},{wch:22},{wch:16}].concat(Array(12).fill({wch:8}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'ThongKe');
  XLSX.writeFile(wb,`LPGT_ThongKe_${ym}.xlsx`);
}

/* =================== KHAI BÁO GIỜ + TÀI KHOẢN (tab Dữ liệu) =================== */
function renderHoursTbl(){
  const tb=$('hoursTbl');if(!tb)return;
  const catName={work:'Ca làm việc',rest:'Nghỉ ca',leave:'Nghỉ phép',ot:'Tăng ca',swap:'Đổi ca',other:'Khác'};
  let h='<thead><tr><th>Mã</th><th>Diễn giải</th><th>Loại</th><th>Giờ/ngày</th><th></th></tr></thead><tbody>';
  allCodes().forEach(c=>{
    const cust=(S.settings.customCodes||[]).some(x=>x.c===c.c);
    h+=`<tr><td>${chip(c.c)}</td><td>${esc(c.l)}</td><td><span class="grp-tag">${catName[c.cat]||c.cat}</span></td>
      <td><input type="number" class="inp sm" style="width:72px" step="0.5" min="0" value="${getHours(c.c)}" onchange="setHour('${c.c}',this.value)"></td>
      <td>${cust?`<button class="btn warn sm" onclick="delCustomCode('${c.c}')">✕</button>`:''}</td></tr>`;
  });
  tb.innerHTML=h+'</tbody>';
}
function setHour(c,v){
  S.settings.hours=S.settings.hours||{};
  S.settings.hours[c]=+v||0;
  save();toast('Đã lưu: '+c+' = '+(+v||0)+'h/ngày');
}
function addCustomCode(){
  const c=(prompt(t('Mã ca mới (viết tắt, VD: XT, H8):'))||'').trim().toUpperCase();
  if(!c)return;
  if(allCodes().some(x=>x.c===c)){toast('Mã "'+c+'" đã tồn tại');return;}
  const l=(prompt(t('Diễn giải (VD: Tăng ca xuất tàu):'))||c).trim();
  let cat=(prompt(t('Loại — nhập 1 trong: work (ca làm việc) / ot (tăng ca) / leave (nghỉ phép) / rest (nghỉ ca):'),'ot')||'ot').trim().toLowerCase();
  if(!['work','ot','leave','rest','swap'].includes(cat))cat='other';
  const hrs=+(prompt(t('Số giờ / ngày:'),'12')||0)||0;
  const col={work:'var(--cD)',ot:'var(--cOT)',leave:'var(--cAL)',rest:'var(--cR)',swap:'var(--cSW)'}[cat]||'#64748B';
  S.settings.customCodes=S.settings.customCodes||[];
  S.settings.customCodes.push({c,l,col,cat});
  S.settings.hours=S.settings.hours||{};S.settings.hours[c]=hrs;
  save();renderHoursTbl();toast('Đã thêm mã '+c+' ('+hrs+'h)');
}
function delCustomCode(c){
  if(!confirm(t('Xóa mã "')+c+t('"? (các ô lịch đang dùng mã này vẫn giữ nguyên chữ)')))return;
  S.settings.customCodes=(S.settings.customCodes||[]).filter(x=>x.c!==c);
  save();renderHoursTbl();
}
function renderAccTbl(){
  const tb=$('accTbl');if(!tb)return;
  let h='<thead><tr><th>Mã NV</th><th>Họ tên</th><th>Nhóm</th><th>Trạng thái</th><th></th></tr></thead><tbody>';
  activeEmps().forEach(e=>{
    const acc=S.accounts&&S.accounts[e.id];
    const has=acc&&acc.hash;
    h+=`<tr><td style="font-family:var(--mono)">${esc(e.id)}</td><td>${esc(e.name||'—')}</td><td>${esc(e.team||'')}</td>
      <td>${has?'<span class="st approved">Đã cấp</span>':'<span class="st pending">Chưa cấp</span>'}</td>
      <td class="emp-act">${adm
        ?`<button class="btn sec sm" onclick="setPass('${e.id}')">${has?'🔁 Reset MK':'🔑 Cấp MK'}</button>${has?`<button class="btn warn sm" onclick="delPass('${e.id}')">✕ Thu hồi</button>`:''}`
        :'<span class="muted">Cần quyền quản trị</span>'}</td></tr>`;
  });
  tb.innerHTML=h+'</tbody>';
}
function setPass(id){
  if(!adm){toast('Cần quyền quản trị');return;}
  const e=empById(id);
  const pw=prompt(t('Mật khẩu cho')+' '+(e&&e.name?e.name:id)+' '+t('(tối thiểu 4 ký tự):'));
  if(pw===null)return;
  if(pw.trim().length<4){toast('Tối thiểu 4 ký tự');return;}
  S.accounts=S.accounts||{};
  S.accounts[id]={hash:hashPw(id,pw.trim()),by:'manager',at:Date.now()};
  save();renderAccTbl();toast('Đã cấp mật khẩu cho '+id+' ✔');
}
function delPass(id){
  if(!adm)return;
  if(!confirm(t('Thu hồi tài khoản đăng nhập của')+' '+id+'?'))return;
  delete S.accounts[id];
  save();renderAccTbl();toast('Đã thu hồi tài khoản '+id);
}

/* =================== EXPORT XLSX =================== */
function exportXlsx(){
  const ym=$('expMonth').value;if(!ym){toast('Chưa có kỳ nào');return;}
  const what=$('expWhat').value;
  const p=periodFor(ym);
  const days=daysOfPeriod(ym);
  const aoa=[];
  aoa.push(['LPGT CAVERN — WORKING SCHEDULE','','','','',what==='eff'?'CA THỰC TẾ':'BẢNG CHUẨN',p.label]);
  aoa.push([]);
  const h1=['No.','Nhóm','Vai trò','Mã NV','Full Name','Position'];
  days.forEach(iso=>h1.push(+iso.slice(8)));
  aoa.push(h1);
  const h2=['','','','','',''];days.forEach(iso=>h2.push(dowOf(iso)));
  aoa.push(h2);
  activeEmps().forEach((e,i)=>{
    const role=e.role==='eng'?'Kỹ sư':e.role==='oper'?'Operator':'';
    const row=[i+1,e.team||'',role,e.id,e.name,e.pos||''];
    days.forEach(iso=>{const c=what==='eff'?eff(e.id,iso).code:(S.base[e.id]&&S.base[e.id][iso]||'');row.push(c);});
    aoa.push(row);
  });
  aoa.push([]);
  const tD=['','','','','Σ Ca ngày (D)',''];const tN=['','','','','Σ Ca đêm (N)',''];const tO=['','','','','Σ Văn phòng (O)',''];
  days.forEach(iso=>{
    let cD=0,cN=0,cO=0;
    activeEmps().forEach(e=>{const c=what==='eff'?eff(e.id,iso).code:(S.base[e.id]&&S.base[e.id][iso]||'');
      if(c==='D'||c==='SD'||c==='OTD')cD++;else if(c==='N'||c==='SN'||c==='OTN')cN++;else if(c==='O'||c==='SO')cO++;});
    tD.push(cD);tN.push(cN);tO.push(cO);
  });
  aoa.push(tD,tN,tO);
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:4},{wch:8},{wch:9},{wch:12},{wch:22},{wch:14}].concat(days.map(()=>({wch:4.5})));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'T'+(+ym.slice(5)));
  XLSX.writeFile(wb,`LPGT_ShiftSchedule_${ym}_${what==='eff'?'thucte':'chuan'}.xlsx`);
}

/* =================== DỮ LIỆU / SETTINGS =================== */
function renderData(){
  fillMonthSelects();
  $('setMinD').value=S.settings.minD;$('setMinN').value=S.settings.minN;
  $('setMinD').onchange=()=>{S.settings.minD=+$('setMinD').value||0;save();};
  $('setMinN').onchange=()=>{S.settings.minN=+$('setMinN').value||0;save();};
  $('setDeptDefault').value=S.settings.deptDefault||DEPT_DEFAULT_FALLBACK;
  $('setApprover1').value=S.settings.approver1||'';
  $('setApprover2').value=S.settings.approver2||'';
  const cfg=localStorage.getItem(LS+'_fb');if(cfg&&!$('fbCfg').value)$('fbCfg').value=cfg;
  renderHoursTbl();renderAccTbl();
}
