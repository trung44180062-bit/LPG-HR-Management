/* ============================================================
   KY CONG (21->20) + BO SINH LICH CA
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== SCHEDULE PERIOD (21 → 20) =================== */
// A "schedule month" YM = 'YYYY-MM' (kỳ tháng N) = Hyosung period: 21/(N-1) → 20/N.
// Ví dụ: kỳ Tháng 7 = 21/06 → 20/07.
function periodFor(ym){
  const[y,m]=ym.split('-').map(Number);
  const pm=m===1?12:m-1, py=m===1?y-1:y;
  const from=`${py}-${pad(pm)}-21`;
  const to=`${y}-${pad(m)}-20`;
  return {from,to,y,m,pm,py,label:`Kỳ T${m}/${y} · 21/${pad(pm)} → 20/${pad(m)}`};
}
// Which schedule month (kỳ) does an ISO date belong to?  Ngày ≥21 thuộc kỳ tháng SAU.
function schedMonthOf(iso){
  const[y,m,d]=iso.split('-').map(Number);
  if(d>=21){const nm=m===12?1:m+1, ny=m===12?y+1:y;return `${ny}-${pad(nm)}`;}
  return `${y}-${pad(m)}`;
}
function curSchedMonth(){return schedMonthOf(todayIso());}
function daysOfPeriod(ym){const p=periodFor(ym);const a=[];let d=new Date(p.from+'T00:00:00'),end=new Date(p.to+'T00:00:00');while(d<=end){a.push(isoOf(d));d.setDate(d.getDate()+1);}return a;}

/* =================== MONTH LIST =================== */
function monthsAvailable(){
  const set=new Set();
  const scan=obj=>{for(const e in obj)for(const iso in obj[e])set.add(schedMonthOf(iso));};
  scan(S.base);scan(S.over);
  if(S.meta.schedFrom)set.add(schedMonthOf(S.meta.schedFrom));
  set.add(curSchedMonth());
  return [...set].sort();
}
function fillMonthSelects(){
  const ms=monthsAvailable();
  const opt=m=>`<option value="${m}">${periodFor(m).label}</option>`;
  const nowM=curSchedMonth();
  const setSel=id=>{const el=$(id);if(!el)return;const cur=el.value;el.innerHTML=ms.map(opt).join('');el.value=ms.includes(cur)?cur:(ms.includes(nowM)?nowM:ms[ms.length-1]||nowM);};
  setSel('calMonth');setSel('expMonth');setSel('stMonth');
  fillPeriodSel();
}
function fillPeriodSel(){
  const sel=$('setPeriod');if(!sel)return;
  const ms=new Set(monthsAvailable());
  // offer a window around the current schedule month too
  const base=$('setFrom').value?schedMonthOf($('setFrom').value):curSchedMonth();
  const[by,bm]=base.split('-').map(Number);
  for(let k=-3;k<=6;k++){const dt=new Date(by,bm-1+k,1);ms.add(dt.getFullYear()+'-'+pad(dt.getMonth()+1));}
  const list=[...ms].sort();
  const cur=sel.value||base;
  sel.innerHTML=list.map(m=>`<option value="${m}">${periodFor(m).label}</option>`).join('');
  sel.value=list.includes(cur)?cur:base;
}
function shiftCalMonth(d){
  const sel=$('calMonth');const i=sel.selectedIndex+d;
  if(i>=0&&i<sel.options.length){sel.selectedIndex=i;renderCal();}
}
function daysInMonth(ym){const[y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate();}

/* =================== SHIFT GENERATOR =================== */
// Build a slot pattern of length `period` from phases in order, blocks as even as possible.
function buildSlots(period,phases){
  const n=phases.length,base=Math.floor(period/n),rem=period%n,slots=[];
  phases.forEach((p,i)=>{const cnt=base+(i<rem?1:0);for(let k=0;k<cnt;k++)slots.push(p);});
  return slots;
}
// Generate {iso:code} for one employee across the given day list.
function genForEmp(e,days){
  const out={};
  if(e.empType==='admin'||e.shiftType==='admin'){
    days.forEach(iso=>{const dw=new Date(iso+'T00:00:00').getDay();out[iso]=(dw===0||dw===6)?'R':'O';});
    return out;
  }
  const type1=e.shiftType!=='type2'; // default type1
  const phases=type1?['O','D','N','R']:['D','N','R'];
  const def=type1?8:6;
  let period=def;
  if(e.a1&&e.a2){const p=dayNum(e.a2)-dayNum(e.a1);if(p>=phases.length)period=p;}
  const slots=buildSlots(period,phases);
  const anchor=e.a1||days[0];const a0=dayNum(anchor);
  days.forEach(iso=>{
    const di=dayNum(iso)-a0;
    const idx=((di%period)+period)%period;
    out[iso]=slots[idx];
  });
  return out;
}
function schedDays(){
  const f=$('setFrom').value,t=$('setTo').value;
  if(!f||!t||t<f)return null;
  const days=[];let d=new Date(f+'T00:00:00'),end=new Date(t+'T00:00:00'),g=0;
  while(d<=end&&g++<500){days.push(isoOf(d));d.setDate(d.getDate()+1);}
  return {f,t,days};
}
// If range is empty, auto-derive the 21→20 period that contains the earliest Mốc 1.
function autoRangeFromAnchor(){
  const withA1=activeEmps().filter(e=>e.a1&&e.empType!=='admin'&&e.shiftType!=='admin').map(e=>e.a1).sort();
  if(!withA1.length)return false;
  const ym=schedMonthOf(withA1[0]);const p=periodFor(ym);
  $('setFrom').value=p.from;$('setTo').value=p.to;fillPeriodSel();
  return ym;
}
function fillSchedule(){
  if(!$('setFrom').value||!$('setTo').value){
    const ym=autoRangeFromAnchor();
    if(!ym){toast('Chọn Kỳ lịch hoặc điền Mốc 1 trước');return;}
    toast('Đã tự nhận '+periodFor(ym).label);
  }
  const sd=schedDays();if(!sd){toast('Khoảng ngày không hợp lệ');return;}
  let cnt=0,skipped=0;
  activeEmps().forEach(e=>{
    const isAdmin=e.empType==='admin'||e.shiftType==='admin';
    if(!isAdmin&&!e.a1){skipped++;return;} // cần Mốc 1 để biết pha
    const gen=genForEmp(e,sd.days);
    S.base[e.id]=S.base[e.id]||{};
    for(const iso in gen){S.base[e.id][iso]=gen[iso];cnt++;}
  });
  S.meta={schedFrom:sd.f,schedTo:sd.t};
  save();fillMonthSelects();renderSetup();renderBoth();
  toast('Đã điền '+cnt+' ô ca'+(skipped?` (${skipped} người thiếu Mốc 1)`:''));
}
// Set range from the "Kỳ lịch" dropdown
function applyPeriodSel(){
  const ym=$('setPeriod').value;if(!ym)return;const p=periodFor(ym);
  $('setFrom').value=p.from;$('setTo').value=p.to;
}
// Keep the dropdown in sync if user edits "Từ ngày" manually
function syncPeriodSel(){const f=$('setFrom').value;if(!f)return;$('setPeriod').value=schedMonthOf(f);fillPeriodSel();$('setPeriod').value=schedMonthOf(f);}
// Detect the period from the earliest Mốc 1 and set the range
function periodFromAnchor(){
  const ym=autoRangeFromAnchor();
  if(!ym){toast('Chưa có Mốc 1 nào để nhận diện kỳ');return;}
  toast('Kỳ theo mốc: '+periodFor(ym).label);
}
function newSchedule(){
  const m=prompt('Tạo lịch cho kỳ tháng (nhập YYYY-MM, ví dụ 2026-07 = kỳ Tháng 7 = 21/06→20/07):',curSchedMonth());
  if(!m||!/^\d{4}-\d{2}$/.test(m)){if(m!==null)toast('Định dạng YYYY-MM');return;}
  const p=periodFor(m);
  $('setFrom').value=p.from;$('setTo').value=p.to;fillPeriodSel();$('setPeriod').value=m;
  toast('Đã đặt '+p.label+'. Kiểm tra Mốc rồi bấm “Điền lịch”.');
  renderSetup();
}
// Tạo lịch tháng kế tiếp từ khai báo hiện hữu (lịch chuẩn nối tiếp liên tục).
function nextMonthSchedule(){
  const cur=$('setFrom').value?schedMonthOf($('setFrom').value):(S.meta.schedFrom?schedMonthOf(S.meta.schedFrom):curSchedMonth());
  const[y,m]=cur.split('-').map(Number);
  const nm=m===12?1:m+1, ny=m===12?y+1:y;
  const nym=ny+'-'+pad(nm);
  const p=periodFor(nym);
  if(!confirm('Tạo lịch chuẩn cho '+p.label+' — nối tiếp từ khai báo nhóm hiện tại?'))return;
  $('setFrom').value=p.from;$('setTo').value=p.to;fillPeriodSel();$('setPeriod').value=nym;
  fillSchedule();
}
function clearSchedRange(){
  const sd=schedDays();if(!sd){toast('Chọn khoảng ngày');return;}
  if(!confirm('Xóa lịch từ '+fmtVNfull(sd.f)+' đến '+fmtVNfull(sd.t)+'?'))return;
  for(const id in S.base)for(const iso in S.base[id])if(iso>=sd.f&&iso<=sd.t)delete S.base[id][iso];
  for(const id in S.over)for(const iso in S.over[id])if(iso>=sd.f&&iso<=sd.t)delete S.over[id][iso];
  save();renderSetup();renderBoth();toast('Đã xóa lịch trong khoảng');
}
function clearSchedAll(){
  if(!confirm('Xóa TOÀN BỘ lịch ca? (giữ danh sách nhân sự)'))return;
  S.base={};S.over={};save();renderSetup();renderBoth();toast('Đã xóa toàn bộ lịch');
}
