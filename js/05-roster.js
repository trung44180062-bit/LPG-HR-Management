/* ============================================================
   NHOM & DANH SACH NHAN SU (tab Nhom)
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== SETUP / ROSTER =================== */
function teamList(){
  const seen=[];activeEmps().forEach(e=>{const t=e.team||'';if(!seen.includes(t))seen.push(t);});
  return seen.sort((a,b)=>{if(a==='')return 1;if(b==='')return -1;return a.localeCompare(b,'vi',{numeric:true});});
}
function renderSetup(){
  /* Thanh Cơ cấu tổ — js/24-reorg.js. Dựng trước bảng nhân sự để nó luôn
     có mặt kể cả khi danh sách còn trống (lúc đó vẫn cần biết cơ cấu). */
  if(typeof renderStructBar==='function')renderStructBar();
  if(!$('setFrom').value||!$('setTo').value){
    const p=periodFor(S.meta.schedFrom?schedMonthOf(S.meta.schedFrom):curSchedMonth());
    $('setFrom').value=S.meta.schedFrom||p.from;$('setTo').value=S.meta.schedTo||p.to;
  }
  fillPeriodSel();
  const teams=teamList();
  if(!activeEmps().length){
    $('setupBody').innerHTML='<div class="card"><p class="muted">Chưa có nhân sự. Bấm <b>＋ Thêm nhóm</b> để tạo nhóm gồm 2 kỹ sư + 2 operator, rồi sửa tên / mã số.</p></div>';
    return;
  }
  let h='';
  teams.forEach(tm=>{
    const mem=activeEmps().filter(e=>(e.team||'')===tm);
    const eng=mem.filter(e=>e.role==='eng').length,oper=mem.filter(e=>e.role==='oper').length;
    h+=`<div class="card"><h3>👥 Nhóm ${esc(tm||'(chưa phân nhóm)')}
      <span class="muted" style="font-weight:600">${eng} kỹ sư · ${oper} oper</span>
      <span style="flex:1"></span>
      <button class="btn sec sm" onclick="addMember('${esc(tm)}')">＋ Người</button>
      ${tm?`<button class="btn sec sm" onclick="renameGroup('${esc(tm)}')">✎ Tên nhóm</button>
        <button class="btn warn sm" onclick="delGroup('${esc(tm)}')">✕ Nhóm</button>`:''}</h3>
      <div style="overflow:auto"><table class="tbl setup"><thead><tr>
        <th>Vai trò</th><th>Vị trí</th><th>Mã NV</th><th>Họ tên</th><th>Kiểu ca</th><th>Ngày vào làm</th><th>Mốc 1</th><th>Mốc 2</th><th></th>
      </tr></thead><tbody>`;
    mem.forEach(e=>h+=memberRow(e));
    h+=`</tbody></table></div></div>`;
  });
  $('setupBody').innerHTML=h;
}
function memberRow(e){
  const isAdmin=e.empType==='admin'||e.shiftType==='admin';
  const dis=isAdmin?'disabled':'';
  const sel=(v,cur)=>v===cur?' selected':'';
  return `<tr>
   <td><select class="inp sm" onchange="updEmp('${e.id}','role',this.value,true)">
     <option value="eng"${sel('eng',e.role)}>Kỹ sư</option>
     <option value="oper"${sel('oper',e.role)}>Operator</option>
     <option value="other"${sel('other',e.role)}>Khác</option></select></td>
   <td>${posSelectHtml(e,'min-width:150px')}</td>
   <td><input class="inp sm" value="${esc(e.id)}" style="width:100px;font-family:var(--mono)" onchange="changeId('${e.id}',this.value)"></td>
   <td><input class="inp sm" value="${esc(rawName(e))}" style="min-width:140px" placeholder="Họ tên" onchange="updEmp('${e.id}','name',this.value)"></td>
   <td><select class="inp sm" onchange="updType('${e.id}',this.value)">
     <option value="type1"${sel('type1',e.shiftType)}>Ca 8 ngày (OODDNNRR)</option>
     <option value="type2"${sel('type2',e.shiftType)}>Ca 6 ngày (DDNNRR)</option>
     <option value="custom"${sel('custom',e.shiftType)}>Mẫu ca tự khai…</option>
     <option value="admin"${sel('admin',e.shiftType)}>Hành chính T2–T6</option>
     <option value="office6"${sel('office6',e.shiftType)}>Hành chính T2–T7 (học việc)</option>
     <option value="none"${sel('none',e.shiftType)}>Không xếp lịch</option></select>
     ${e.shiftType==='custom'?`<input class="inp sm pat${shiftPatternOk(e.pattern)?'':' bad'}" style="margin-top:4px;font-family:var(--mono)"
        value="${esc(e.pattern||'')}" placeholder="VD: D D N N R R"
        title="Chuỗi mã ca lặp lại kể từ Mốc 1. Viết liền OODDNNRR hoặc cách nhau bằng dấu cách / phẩy."
        onchange="updPattern('${e.id}',this.value)">`:''}</td>
   <td><input type="date" class="inp sm" value="${e.joinAt||''}" title="Nhân viên vào giữa kỳ: chỉ điền lịch từ ngày này trở đi" onchange="updEmp('${e.id}','joinAt',this.value)"></td>
   <td><input type="date" class="inp sm" value="${e.a1||''}" ${dis} title="Ngày đầu của cặp Office / ca đầu" onchange="updEmp('${e.id}','a1',this.value)"></td>
   <td><input type="date" class="inp sm" value="${e.a2||''}" ${dis} title="Cặp kế tiếp (để đo chu kỳ)" onchange="updEmp('${e.id}','a2',this.value)"></td>
   <td><button class="btn warn sm" onclick="delEmp('${e.id}')">✕</button></td>
  </tr>`;
}
/* ★ v7.7 — mọi hàm SỬA nhân sự dưới đây đi qua hrGuard(): quản trị, quản lý
   người Hàn và THƯ KÝ đều làm được. Mật khẩu / phân quyền vẫn chốt bằng adm
   ở js/11-stats-data.js. */
function updEmp(id,f,v,rerender){
  if(!hrGuard())return;
  const e=empById(id);if(!e)return;
  e[f]=(f==='name'||f==='pos'||f==='team')?v.trim():v;
  save();
  if(rerender){renderSetup();renderBoth();}
  if(typeof renderAccTbl==='function')renderAccTbl();
}
function updType(id,v){if(!hrGuard())return;const e=empById(id);if(!e)return;e.shiftType=v;e.empType=(v==='admin')?'admin':'shift';save();renderSetup();}
/* Mẫu ca tự khai — xem khối ★ v8.9 ở js/04-schedule.js.
   Lưu nguyên chuỗi người dùng gõ (không chuẩn hoá) để họ nhìn lại đúng thứ
   mình viết; phần đọc hiểu do parseShiftPattern() lo. Khai sai thì cảnh báo
   ngay chứ không đợi tới lúc điền lịch mới phát hiện cả nhóm trống ca. */
function updPattern(id,v){
  if(!hrGuard())return;
  const e=empById(id);if(!e)return;
  e.pattern=String(v||'').trim();
  save();renderSetup();
  if(!e.pattern)toast(t('Chưa khai mẫu ca — người này sẽ không được điền lịch'));
  else if(!shiftPatternOk(e.pattern))toast(t('Mẫu ca có mã lạ')+': '+esc(e.pattern));
  else toast(t('Mẫu ca')+': '+shiftPatternLabel(e.pattern)+' ('+parseShiftPattern(e.pattern).length+' '+t('ngày')+')');
}
function changeId(oldId,val){
  if(!hrGuard())return;
  const e=empById(oldId);if(!e)return;
  const nid=(val||'').trim();
  if(!nid){toast('Mã không được trống');renderSetup();return;}
  if(nid===oldId)return;
  if(S.employees.some(x=>x.id===nid)){toast('Mã đã tồn tại');renderSetup();return;}
  if(S.base[oldId]){S.base[nid]=S.base[oldId];delete S.base[oldId];}
  if(S.over[oldId]){S.over[nid]=S.over[oldId];delete S.over[oldId];}
  // Đơn đã gửi vẫn phải trỏ đúng người sau khi đổi mã
  Object.values(S.requests||{}).forEach(r=>{
    if(r.empId===oldId)r.empId=nid;
    if(r.withId===oldId)r.withId=nid;
    if(r.guarantorId===oldId)r.guarantorId=nid;
  });
  // Tài khoản: hash gắn với mã NV nên phải cấp lại, mật khẩu = mã NV mới
  if(S.accounts&&S.accounts[oldId])delete S.accounts[oldId];
  e.id=nid;
  ensureAccount(nid,true);
  save();renderSetup();renderBoth();
  toast(isRealEmpId(nid)?('Đã đổi mã NV — đăng nhập '+loginKey(nid)+', mật khẩu = '+loginKey(nid)):'Đã đổi mã NV');
}
function addMember(team){
  if(!hrGuard())return;
  S.employees.push({id:newVc(),name:'',pos:'',role:'oper',team:team||'',empType:'shift',shiftType:'type1',a1:'',a2:'',order:S.employees.length+1,active:true});
  save();renderSetup();
}
function addGroup(){
  if(!hrGuard())return;
  const name=prompt(t('Tên nhóm (VD: A, B, C, D):'));if(!name)return;
  const tm=name.trim();
  const tpl=[['eng','Field Engineer'],['eng','DCS Boardman'],['oper','Operator'],['oper','Operator']];
  tpl.forEach(([role,pos])=>{
    S.employees.push({id:newVc(),name:'',pos,role,team:tm,empType:'shift',shiftType:'type1',a1:'',a2:'',order:S.employees.length+1,active:true});
  });
  save();renderSetup();toast('Đã tạo nhóm '+tm);
}
function renameGroup(team){
  if(!hrGuard())return;
  const nn=prompt(t('Đổi tên nhóm:'),team);if(nn===null)return;
  const nt=nn.trim();S.employees.forEach(e=>{if((e.team||'')===team)e.team=nt;});
  save();renderSetup();renderBoth();
}
function delGroup(team){
  if(!hrGuard())return;
  if(!confirm(t('Xóa nhóm "')+team+t('" và toàn bộ người trong nhóm?')))return;
  S.employees.filter(e=>(e.team||'')===team).forEach(e=>{delete S.base[e.id];delete S.over[e.id];});
  S.employees=S.employees.filter(e=>(e.team||'')!==team);
  save();renderSetup();renderBoth();toast('Đã xóa nhóm');
}
function delEmp(id){
  if(!hrGuard())return;
  const e=empById(id);if(!e)return;
  if(!confirm(t('Xóa "')+(e.name||id)+t('" khỏi danh sách?')))return;
  S.employees=S.employees.filter(x=>x.id!==id);delete S.base[id];delete S.over[id];
  if(S.accounts)delete S.accounts[id];      // xoá luôn tài khoản đăng nhập
  save();renderSetup();renderBoth();
}
