/* ============================================================
   LỊCH NHẬP TÀU NHIỀU PHƯƠNG ÁN   ★ v8.9
   LPGT Cavern — Quan ly Cong Ca
   ------------------------------------------------------------
   VIỆC THẬT

   Lúc lên kế hoạch nhập tàu, ngày cập gần như không bao giờ chắc. Hãng
   báo "khoảng 12–14", thời tiết và lịch cầu cảng đẩy tới đẩy lui. Nhưng
   tổ vận hành thì phải chuẩn bị TRƯỚC: ai trực, ai nghỉ bù, đặt cơm,
   huy động thêm người. Nên quản lý cần khai 2–3 PHƯƠNG ÁN cập, cho cả
   tổ nắm trước, rồi khi có lịch chốt thì xoá các phương án không đúng.

   CÁCH LÀM — KHÔNG ĐẺ THÊM MỘT LOẠI DỮ LIỆU MỚI

   Mỗi phương án chính là MỘT SỰ KIỆN trên lịch (S.events, js/20-events.js),
   chỉ mang thêm ba trường:

       ev.plan   — mã chuyến tàu, các phương án cùng chuyến dùng chung
       ev.optNo  — số thứ tự phương án (1, 2, 3…)
       ev.prov   — 1 = CHƯA CHỐT; bỏ cờ này nghĩa là đã chốt

   Nhờ vậy phương án tự động có sẵn mọi thứ của sự kiện: vẽ lên bảng lịch
   máy tính, lịch tuần điện thoại, lịch trang chính nhân viên, dải sự kiện
   trong sheet ngày, thông báo trong app, tin Zalo, cơ chế THU HỒI thông
   báo khi xoá. Không một dòng nào phải viết lại.

   Ngày chỉ có phương án chưa chốt được vẽ NHẠT + VIỀN ĐỨT (lớp .evprov,
   xem css/app.css) và tên phương án ghi rõ "PA 1/3 · chưa chốt" — nhìn
   là biết ngay chưa phải ngày cập thật.

   CHỐT PHƯƠNG ÁN

   Bấm "Chốt" ở một phương án thì:
     · phương án đó bỏ cờ prov → thành sự kiện đậm bình thường,
     · các phương án còn lại của cùng chuyến bị XOÁ HẲN, thông báo đã gửi
       của chúng được THU HỒI (kể cả tin còn nằm trong hàng đợi Zalo),
     · cả tổ nhận một thông báo mới: ngày cập đã chốt.

   Chốt nhầm thì vẫn khai lại phương án được — dữ liệu đã xoá là các
   phương án SAI, không phải lịch làm việc của ai.
   ============================================================ */

const VS_CAT='vlgc';          // loại sự kiện dùng cho chuyến tàu

/* ---------- Đọc dữ liệu ---------- */
/* Gom sự kiện theo mã chuyến. Trả mảng {plan,vessel,note,scope,teams,notify,
   opts:[ev…],fixed:bool} — sắp theo ngày sớm nhất. */
function vsPlans(){
  const g={};
  Object.values(S.events||{}).forEach(ev=>{
    if(!ev||!ev.plan)return;
    const k=ev.plan;
    if(!g[k])g[k]={plan:k,vessel:ev.vessel||ev.title||'',note:ev.planNote||'',
                   scope:ev.scope||'all',teams:(ev.teams||[]).slice(),
                   notify:ev.notify!==false,opts:[]};
    g[k].opts.push(ev);
  });
  return Object.values(g).map(p=>{
    p.opts.sort((a,b)=>(+a.optNo||0)-(+b.optNo||0)||String(a.from||'').localeCompare(String(b.from||'')));
    p.fixed=p.opts.some(x=>!x.prov);
    p.first=p.opts.map(x=>x.from||'').filter(Boolean).sort()[0]||'';
    return p;
  }).sort((a,b)=>String(a.first).localeCompare(String(b.first)));
}
function vsPlanById(id){return vsPlans().find(p=>p.plan===id)||null;}
/* Sự kiện này có phải một phương án tàu không (dùng để chặn màn Sự kiện
   thường sửa nhầm — sửa ở đó sẽ làm lệch nhóm phương án). */
function vsIsOpt(ev){return !!(ev&&ev.plan);}
/* Nhãn phương án: "PA 2/3 · chưa chốt" */
function vsOptLabel(p,ev){
  const n=p?p.opts.length:1;
  const s=t('PA')+' '+(ev.optNo||1)+(n>1?('/'+n):'');
  return s+(ev.prov?(' · '+t('chưa chốt')):(' · '+t('ĐÃ CHỐT')));
}
/* Tên sự kiện ghi xuống S.events — người xem lịch chỉ thấy chuỗi này nên nó
   phải tự nói đủ: tên tàu + phương án mấy + đã chốt chưa. */
function vsTitleOf(vessel,optNo,nOpt,prov,optName){
  const nm=String(optName||'').trim();
  const pa=t('PA')+' '+optNo+(nOpt>1?('/'+nOpt):'');
  return String(vessel||t('Nhập tàu')).trim()+' · '+pa
       +(nm?(' — '+nm):'')
       +(prov?(' ('+t('chưa chốt')+')'):'');
}

/* ---------- Ghi ---------- */
/* Ghi (tạo hoặc cập nhật) một phương án thành sự kiện.
   `o` = {plan,vessel,planNote,scope,teams,notify,optNo,nOpt,optName,from,to,note,prov,id} */
function vsWriteOpt(o){
  S.events=S.events||{};
  const id=o.id||uid();
  const old=S.events[id];
  S.events[id]={
    id,
    title:vsTitleOf(o.vessel,o.optNo,o.nOpt,o.prov,o.optName),
    note:String(o.note||'').trim(),
    cat:VS_CAT,
    from:o.from,to:o.to||o.from,days:null,
    scope:o.scope||'all',teams:(o.scope==='teams')?(o.teams||[]).slice():[],
    notify:o.notify!==false,
    /* --- phần riêng của lịch tàu --- */
    plan:o.plan,optNo:o.optNo,optName:String(o.optName||'').trim(),
    vessel:String(o.vessel||'').trim(),planNote:String(o.planNote||'').trim(),
    prov:o.prov?1:0,
    by:(old&&old.by)||meId()||'admin',at:(old&&old.at)||Date.now(),
    editBy:meId()||'admin',editAt:Date.now()
  };
  return id;
}
/* Thông báo cho CẢ CHUYẾN. Gửi từng phương án một, nhưng hộp gửi Zalo gộp
   chúng lại thành ĐÚNG MỘT tin (cùng người nhận, cùng nhóm 'event') — xem
   zaloOutMergeSame ở js/21-notify.js. */
function vsSendNotifs(p){
  if(!p)return 0;
  let n=0;
  p.opts.forEach(ev=>{
    if(typeof evRevokeNotifs==='function')evRevokeNotifs(ev.id);
  });
  p.opts.forEach(ev=>{
    if(ev.notify===false)return;
    const ids=(typeof evRecipients==='function')?evRecipients(ev):[];
    const aud=(typeof evAudienceLabel==='function')?evAudienceLabel(ev):'All staff';
    const dl=(typeof evDateLabel==='function')?evDateLabel(ev):(ev.from||'');
    const txt='🚢 '+(ev.prov?t('Phương án nhập tàu'):t('Lịch nhập tàu đã chốt'))+': '
             +(ev.vessel||'')+' — '+vsOptLabel(p,ev)+' · '+dl
             +(ev.note?(' · '+ev.note):'');
    ids.forEach(to=>{
      newNotif({kind:'event',to,from:meId()||'admin',evId:ev.id,
        iso:(typeof evDays==='function'?evDays(ev)[0]:ev.from)||'',
        aud:aud,status:'sent',
        /* Cờ để tin Zalo dùng đúng tiêu đề + đúng câu chữ, xem js/21-notify.js */
        vs:{plan:p.plan,vessel:ev.vessel||'',opt:ev.optNo||1,n:p.opts.length,
            fixed:ev.prov?0:1,dates:dl},
        text:txt});
      n++;
    });
  });
  return n;
}

/* ---------- Chốt / xoá ---------- */
function vsFix(planId,evId){
  if(!hrGuard())return;
  const p=vsPlanById(planId);if(!p)return;
  const keep=p.opts.find(x=>x.id===evId);
  if(!keep){toast(t('Không tìm thấy phương án'));return;}
  const drop=p.opts.filter(x=>x.id!==evId);
  if(!confirm(t('Chốt')+' '+vsOptLabel(p,keep)+' ('+evDateLabel(keep)+')?\n'
    +(drop.length?(drop.length+' '+t('phương án còn lại sẽ bị xoá và thu hồi thông báo đã gửi.')):t('Không còn phương án nào khác.'))))return;
  /* Xoá phương án sai TRƯỚC, rồi mới chốt — để lúc gửi thông báo mới thì
     vsPlans() đã thấy đúng "chỉ còn 1 phương án", không ghi "PA 1/3". */
  drop.forEach(x=>{
    if(typeof evRevokeNotifs==='function')evRevokeNotifs(x.id);
    delete S.events[x.id];
  });
  if(typeof evResetCache==='function')evResetCache();
  const ev=S.events[evId];
  ev.prov=0;ev.optNo=1;
  ev.title=vsTitleOf(ev.vessel,1,1,0,ev.optName);
  ev.editBy=meId()||'admin';ev.editAt=Date.now();
  if(typeof evResetCache==='function')evResetCache();
  const p2=vsPlanById(planId);
  const n=vsSendNotifs(p2);
  save();
  vsRefreshAll();
  toast(t('Đã chốt lịch tàu')+' — '+t('đã xoá')+' '+drop.length+' '+t('phương án')
        +(n?(' · '+t('báo cho')+' '+n+' '+t('người')):''));
}
function vsDelOpt(planId,evId){
  if(!hrGuard())return;
  const p=vsPlanById(planId);if(!p)return;
  const ev=S.events[evId];if(!ev)return;
  if(!confirm(t('Xoá')+' '+vsOptLabel(p,ev)+'? '+t('Thông báo đã gửi cũng được thu hồi.')))return;
  if(typeof evRevokeNotifs==='function')evRevokeNotifs(evId);
  delete S.events[evId];
  if(typeof evResetCache==='function')evResetCache();
  /* Đánh số lại cho liền mạch: xoá PA2 thì PA3 phải thành PA2, không thì
     nhân viên đọc "PA 1/2 và PA 3/2" là hết hiểu. */
  vsRenumber(planId);
  save();vsRefreshAll();
  toast(t('Đã xoá phương án'));
}
function vsRenumber(planId){
  const p=vsPlanById(planId);if(!p)return;
  const n=p.opts.length;
  p.opts.forEach((ev,i)=>{
    ev.optNo=i+1;
    ev.title=vsTitleOf(ev.vessel,i+1,n,ev.prov,ev.optName);
  });
  if(typeof evResetCache==='function')evResetCache();
}
function vsDelPlan(planId){
  if(!hrGuard())return;
  const p=vsPlanById(planId);if(!p)return;
  if(!confirm(t('Xoá cả chuyến')+' "'+(p.vessel||'')+'" ('+p.opts.length+' '+t('phương án')+')? '
    +t('Thông báo đã gửi cũng được thu hồi.')))return;
  p.opts.forEach(ev=>{
    if(typeof evRevokeNotifs==='function')evRevokeNotifs(ev.id);
    delete S.events[ev.id];
  });
  if(typeof evResetCache==='function')evResetCache();
  if(vsEditPlan===planId)vsNewDraft();
  save();vsRefreshAll();
  toast(t('Đã xoá chuyến tàu'));
}
function vsRefreshAll(){
  if(typeof renderVesselMgr==='function')renderVesselMgr();
  if(typeof renderCal==='function')renderCal();
  if(typeof renderMe==='function'&&typeof noSelf!=='undefined'&&!noSelf)renderMe(true);
  if(typeof refreshBadge==='function')refreshBadge();
  if(typeof refreshVesselBadge==='function')refreshVesselBadge();
}

/* ============================================================
   MÀN QUẢN LÝ LỊCH TÀU
   ============================================================ */
let vsView='list';          // 'list' | 'form'
let vsEditPlan='';
let vsVessel='', vsNote='', vsScope='all', vsTeams=[], vsNotify=true;
let vsOpts=[];              // [{id,optName,from,to,note,prov}]

function vsNewDraft(){
  vsEditPlan='';vsVessel='';vsNote='';vsScope='all';vsTeams=[];vsNotify=true;
  const d=addDaysIso(todayIso(),3);
  vsOpts=[{id:'',optName:'',from:d,to:d,note:'',prov:1},
          {id:'',optName:'',from:addDaysIso(d,1),to:addDaysIso(d,1),note:'',prov:1}];
}
function openVesselMgr(view){
  if(!hrGuard())return;
  vsNewDraft();
  vsView=(view==='form')?'form':'list';
  const m=$('vsMask');if(!m)return;
  m.classList.add('on');
  renderVesselMgr();
}
function closeVesselMgr(){const m=$('vsMask');if(m)m.classList.remove('on');}
function vsSetView(v){vsView=(v==='form')?'form':'list';renderVesselMgr();}

function vsAddOpt(){
  if(vsOpts.length>=6){toast(t('Tối đa 6 phương án'));return;}
  const last=vsOpts[vsOpts.length-1];
  const d=last?addDaysIso(last.from,1):addDaysIso(todayIso(),3);
  vsOpts.push({id:'',optName:'',from:d,to:d,note:'',prov:1});
  renderVesselMgr();
}
function vsRmOpt(i){
  if(vsOpts.length<=1){toast(t('Phải có ít nhất 1 phương án'));return;}
  vsOpts.splice(i,1);renderVesselMgr();
}
function vsSetOpt(i,k,v){
  const o=vsOpts[i];if(!o)return;
  o[k]=v;
  /* Ngày cập là một dải ngắn — chọn ngày đầu thì kéo ngày cuối theo cho
     khỏi phải bấm hai lần, trừ khi người dùng đã tự đặt ngày cuối xa hơn. */
  if(k==='from'&&(!o.to||o.to<v))o.to=v;
  renderVesselMgr();
}
function vsSetScope(v){vsScope=v;renderVesselMgr();}
function vsToggleTeam(tm){
  const i=vsTeams.indexOf(tm);
  if(i<0)vsTeams.push(tm);else vsTeams.splice(i,1);
  renderVesselMgr();
}
function vsEdit(planId){
  const p=vsPlanById(planId);if(!p)return;
  vsEditPlan=planId;vsView='form';
  vsVessel=p.vessel||'';vsNote=p.note||'';
  vsScope=p.scope||'all';vsTeams=(p.teams||[]).slice();vsNotify=p.notify!==false;
  vsOpts=p.opts.map(ev=>({id:ev.id,optName:ev.optName||'',from:ev.from||'',
                          to:ev.to||ev.from||'',note:ev.note||'',prov:ev.prov?1:0}));
  renderVesselMgr();
}
function vsSave(){
  if(!hrGuard())return;
  const vessel=String(vsVessel||'').trim();
  if(!vessel){toast(t('Chưa đặt tên tàu / tên chuyến'));return;}
  const opts=vsOpts.filter(o=>o.from);
  if(!opts.length){toast(t('Chưa khai ngày cập của phương án nào'));return;}
  if(vsScope==='teams'&&!vsTeams.length){toast(t('Chưa chọn nhóm nhận thông báo'));return;}
  for(const o of opts)if(o.to&&o.to<o.from){toast(t('Ngày kết thúc phải sau ngày cập'));return;}

  const plan=vsEditPlan||uid();
  const nOpt=opts.length;
  /* Phương án bị gỡ khỏi form thì xoá khỏi S.events + thu hồi thông báo */
  const keepIds=opts.map(o=>o.id).filter(Boolean);
  const cur=vsPlanById(plan);
  if(cur)cur.opts.forEach(ev=>{
    if(!keepIds.includes(ev.id)){
      if(typeof evRevokeNotifs==='function')evRevokeNotifs(ev.id);
      delete S.events[ev.id];
    }
  });
  /* Chuyến ĐÃ CHỐT thì phương án còn lại giữ nguyên trạng thái đã chốt —
     sửa ghi chú một chuyến đã chốt không được làm nó "chưa chốt" trở lại. */
  opts.forEach((o,i)=>{
    o.id=vsWriteOpt({id:o.id,plan,vessel,planNote:vsNote,
      scope:vsScope,teams:vsTeams,notify:vsNotify,
      optNo:i+1,nOpt,optName:o.optName,
      from:o.from,to:o.to||o.from,note:o.note,
      prov:(nOpt>1?1:(o.prov?1:0))});
  });
  if(typeof evResetCache==='function')evResetCache();
  vsEditPlan=plan;
  const p=vsPlanById(plan);
  const n=vsNotify?vsSendNotifs(p):0;
  save();
  vsView='list';
  vsRefreshAll();
  toast(vsNotify?(t('Đã lưu lịch tàu và gửi thông báo tới')+' '+n+' '+t('lượt người'))
                :t('Đã lưu lịch tàu (không gửi thông báo)'));
}

/* ---------- Giao diện ---------- */
function renderVesselMgr(){
  const box=$('vsBody');if(!box)return;
  const snap=(typeof uiSnap==='function')?uiSnap('vsBody',['.vs-list']):null;
  const head=`
  <h3>🚢 ${t('Lịch nhập tàu')}</h3>
  <div class="ev-tabs">
    <button class="evtab${vsView==='list'?' on':''}" onclick="vsSetView('list')">📋 ${t('Các chuyến')}<i class="cnt">${vsPlans().length}</i></button>
    <button class="evtab${vsView==='form'?' on':''}" onclick="vsSetView('form')">✏️ ${vsEditPlan?t('Sửa chuyến'):t('Khai chuyến mới')}</button>
  </div>`;
  box.innerHTML=head+(vsView==='form'?vsFormHtml():vsListHtml())+`
  <div class="row" style="gap:8px;margin-top:10px">
    ${vsView==='list'?`<button class="btn sec" style="flex:1" onclick="vsNewDraft();vsSetView('form')">➕ ${t('Khai chuyến mới')}</button>`:''}
    <button class="btn sec" onclick="closeVesselMgr()">${t('Đóng')}</button>
  </div>`;
  if(typeof uiRestore==='function')uiRestore(snap);
}
function vsFormHtml(){
  const teams=teamList();
  const nOpt=vsOpts.length;
  return `
  <p class="muted sm2">${t('Chưa chắc ngày cập thì khai 2–3 phương án. Mọi phương án đều hiện trên lịch dưới dạng viền đứt kèm nhãn PA1 / PA2 để cả tổ chuẩn bị trước; khi có lịch chốt, bấm “Chốt” ở phương án đúng — các phương án còn lại tự xoá và thông báo cũ được thu hồi.')}</p>

  <div class="fg"><label class="fl">${t('Tên tàu / tên chuyến')}</label>
    <input class="inp" value="${esc(vsVessel)}" placeholder="${t('VD: VLGC GAS SUN — chuyến 09/2026')}"
      oninput="vsVessel=this.value"></div>
  <div class="fg"><label class="fl">${t('Ghi chú chung (không bắt buộc)')}</label>
    <input class="inp" value="${esc(vsNote)}" placeholder="${t('VD: dự kiến 30.000 tấn, huy động thêm 2 người mỗi ca')}"
      oninput="vsNote=this.value"></div>

  <h4 class="ro-h">📅 ${t('Các phương án cập')} <span class="ro-badge">${nOpt}</span></h4>
  <div class="vs-opts">
    ${vsOpts.map((o,i)=>`<div class="vs-op${o.prov?'':' fixed'}">
      <span class="pa">${t('PA')} ${i+1}${o.prov?'':' · '+t('ĐÃ CHỐT')}</span>
      <label class="fl2">${t('Từ ngày')}<input type="date" class="inp sm" value="${esc(o.from||'')}"
        onchange="vsSetOpt(${i},'from',this.value)"></label>
      <label class="fl2">${t('Đến ngày')}<input type="date" class="inp sm" value="${esc(o.to||'')}"
        onchange="vsSetOpt(${i},'to',this.value)"></label>
      <input class="inp sm nm" value="${esc(o.optName||'')}" placeholder="${t('Tên gọi PA (không bắt buộc)')}"
        oninput="vsOpts[${i}].optName=this.value">
      <input class="inp sm nt" value="${esc(o.note||'')}" placeholder="${t('Ghi chú riêng, VD cập cầu 06:00')}"
        oninput="vsOpts[${i}].note=this.value">
      <button class="btn warn sm ico" onclick="vsRmOpt(${i})" title="${t('Bỏ phương án này')}">✕</button>
    </div>`).join('')}
  </div>
  <button class="btn sec sm" onclick="vsAddOpt()">➕ ${t('Thêm phương án')}</button>

  <div class="fg" style="margin-top:12px"><label class="fl">${t('Gửi thông báo cho')}</label>
    <div class="ev-scope">
      ${(typeof EV_SCOPE!=='undefined'?EV_SCOPE:[]).map(s=>`<button type="button" class="sc${vsScope===s.v?' on':''}"
        onclick="vsSetScope('${s.v}')"><b>${t(s.l)}</b><i>${t(s.hint)}</i></button>`).join('')}
    </div>
  </div>
  ${vsScope==='teams'?`<div class="ev-teams">
    ${teams.map(tm=>`<label class="cal-chk"><input type="checkbox" ${vsTeams.includes(tm)?'checked':''}
      onchange="vsToggleTeam('${esc(tm)}')"> ${esc(tm?t('Nhóm')+' '+tm:t('(chưa phân nhóm)'))}</label>`).join('')}
  </div>`:''}
  <label class="cal-chk" style="margin:8px 0"><input type="checkbox" ${vsNotify?'checked':''}
    onchange="vsNotify=this.checked;renderVesselMgr()"> ${t('Gửi thông báo ngay khi lưu')}</label>
  ${vsNotify?`<div class="pv-alert info sm">${t('Mọi phương án gộp vào ĐÚNG MỘT tin Zalo, ghi rõ đây là lịch dự kiến chưa chốt.')}</div>`:''}

  <div class="row" style="gap:8px;margin-top:10px">
    <button class="btn ok" style="flex:1" onclick="vsSave()">${vsEditPlan?'💾 '+t('Lưu thay đổi'):'➕ '+t('Tạo lịch tàu')}</button>
    ${vsEditPlan?`<button class="btn sec" onclick="vsNewDraft();renderVesselMgr()">${t('Khai chuyến khác')}</button>`:''}
  </div>`;
}
function vsListHtml(){
  const list=vsPlans();
  if(!list.length)return `<p class="muted sm2">${t('Chưa có chuyến tàu nào. Bấm “Khai chuyến mới” để tạo các phương án cập.')}</p>`;
  const tIso=todayIso();
  return `<div class="vs-list">${list.map(p=>{
    const past=p.opts.every(ev=>(ev.to||ev.from||'')<tIso);
    return `<div class="vs-pl${p.fixed?' fixed':''}${past?' past':''}">
      <div class="hd"><b>🚢 ${esc(p.vessel||t('Nhập tàu'))}</b>
        <span class="evtag ${p.fixed?'ok':''}">${p.fixed?t('đã chốt lịch'):(p.opts.length+' '+t('phương án'))}</span>
        <span style="flex:1"></span>
        <button class="btn sec sm ico" onclick="vsEdit('${p.plan}')" title="${t('Sửa')}">✏️</button>
        <button class="btn warn sm ico" onclick="vsDelPlan('${p.plan}')" title="${t('Xoá cả chuyến')}">✕</button></div>
      ${p.note?`<i class="nt">${esc(p.note)}</i>`:''}
      <div class="ops">${p.opts.map(ev=>`<div class="op${ev.prov?'':' fixed'}">
        <span class="pa">${t('PA')} ${ev.optNo||1}</span>
        <span class="dt">${esc((typeof evDateLabel==='function')?evDateLabel(ev):(ev.from||''))}</span>
        <span class="tx">${esc(ev.optName||'')}${ev.note?` <i>${esc(ev.note)}</i>`:''}</span>
        <span class="ac">
          ${ev.prov?`<button class="btn ok sm" onclick="vsFix('${p.plan}','${ev.id}')"
             title="${t('Chốt phương án này, xoá các phương án còn lại')}">✅ ${t('Chốt')}</button>`
            :`<span class="st approved">${t('đã chốt')}</span>`}
          <button class="btn warn sm ico" onclick="vsDelOpt('${p.plan}','${ev.id}')" title="${t('Xoá phương án')}">✕</button>
        </span></div>`).join('')}</div>
    </div>`;
  }).join('')}</div>`;
}

/* Số chuyến CHƯA CHỐT — hiện thành badge trên nút, để không ai quên chốt lại
   sau khi hãng tàu báo giờ cập chính thức. */
function vsPendingCount(){
  return vsPlans().filter(p=>!p.fixed&&p.opts.length>1).length;
}
function refreshVesselBadge(){
  const b=$('vesselBdg');if(!b)return;
  const n=vsPendingCount();
  b.textContent=n;b.style.display=n?'':'none';
}
