/* ============================================================
   v8.2 — NGÀY ĐÀO TẠO TÍNH LÀ NGÀY KHÁC LỊCH CHUẨN
   Chạy: node _test/diff-train-harness.js   (từ thư mục LPGT-CongCa-Web)
   ------------------------------------------------------------
   Buổi đào tạo không phải một mã ca nên nó KHÔNG ghi vào S.over. Trước
   v8.2, bộ lọc "Chỉ ô khác chuẩn" chỉ nhìn S.over nên người đi học trong
   ca bị bỏ sót hoàn toàn. Bài thử này chốt bốn việc:

     1. cellIsDiff nhận cả hai nguồn: ghi đè và đào tạo.
     2. Bảng lịch máy tính: ô chỉ có đào tạo được viền .diff nhưng KHÔNG
        được mang lớp .ovr (chấm tròn "có ghi đè" phải giữ đúng nghĩa).
     3. Lọc "Chỉ ô khác chuẩn" giữ lại người/ngày chỉ có đào tạo.
     4. Thẻ tuần trên điện thoại: tuần chỉ có đào tạo không bị ẩn đi.

   Dùng js/22-training.js THẬT (không stub trOfCell) để nếu sau này đổi
   tên hàm hay đổi cách đánh chỉ mục thì bài thử gãy ngay tại đây.
   ============================================================ */
const fs=require('fs'),vm=require('vm');

/* ---------- DOM giả (rút gọn từ _test/render-v58.js) ---------- */
const els={};
function mkEl(id){
  const cl=new Set();
  return {id,innerHTML:'',textContent:'',value:'',checked:false,
    options:{length:1},dataset:{},style:{},
    classList:{add:c=>cl.add(c),remove:c=>cl.delete(c),
      toggle:(c,on)=>{on?cl.add(c):cl.delete(c);},contains:c=>cl.has(c)},
    scrollIntoView(){},appendChild(){},setAttribute(){},focus(){}};
}
const doc={
  body:mkEl('body'),
  getElementById:id=>els[id]||(els[id]=mkEl(id)),
  querySelectorAll:()=>[],querySelector:()=>null,
  createElement:()=>mkEl('tmp'),addEventListener(){},
  documentElement:{setAttribute(){}}
};
const ctx={console,setTimeout:(f)=>0,clearTimeout(){},Date,Math,JSON,process,
  document:doc,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  matchMedia:()=>({matches:true}),confirm:()=>true,prompt:()=>'',alert(){}};
ctx.window=ctx;ctx.globalThis=ctx;ctx.APP_CFG={};
vm.createContext(ctx);

const src=f=>fs.readFileSync(f,'utf8');
const stub=`
  var t=s=>s, t2=s=>s, LANG='vi', toast=()=>{}, save=()=>{S.rev=Date.now();};
  var _me='e1', meId=()=>_me;
  function addDaysIso(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoOf(d);}
  function mondayOf(iso){const d=new Date(iso+'T00:00:00');const wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return isoOf(d);}
  function shortName(n){const p=String(n||'').trim().split(/\\s+/);return p.slice(-2).join(' ');}
  function newNotif(o){const id=uid();S.notifs[id]=Object.assign({id,status:'pending',createdAt:Date.now()},o);return id;}
  function openDaySheet(){} function openCell(){} function fillMonthSelects(){}
  function repMpPanel(){return '';} function refreshMealBadge(){}
  function reqsOfDay(){return[];} function crewOfDay(){return[];}
  function crewGroupInfo(){return{code:'',label:'',col:'#000'};}
  function eventsOfDay(){return[];} function evTitleOfDay(){return '';}
  function evBannerHtml(){return '';} function trBannerHtml(){return '';}
  function revokeSchedChange(){} function notifDrop(){} function sweepStaleNotifs(){}
`;
/* 22-training.js gọi tới một số hàm của đơn / thông báo khi LƯU buổi; ở đây
   chỉ đọc chỉ mục (trOfCell) nên nạp file là đủ, không cần các file kia. */
vm.runInContext([src('js/01-core.js'),stub,src('js/04-schedule.js'),src('js/05-roster.js'),
  src('js/06-calendar.js'),src('js/22-training.js')].join('\n;\n'),ctx,{filename:'diff-train'});

/* ---------- dữ liệu giả ----------
   e1: có GHI ĐÈ ngày 05  → khác chuẩn kiểu cũ
   e2: có ĐÀO TẠO ngày 12 (trong ca, không ghi đè) → khác chuẩn kiểu mới
   e3: đào tạo CHỜ DUYỆT ngày 13
   e4: không có gì → phải bị lọc bỏ                                      */
vm.runInContext(`
S.employees=[
 {id:'e1',name:'Nguyễn Văn A',team:'A',pos:'operator',shiftType:'type1',active:true},
 {id:'e2',name:'Trần Văn B', team:'A',pos:'field_eng',shiftType:'type1',active:true},
 {id:'e3',name:'Lê Văn C',   team:'B',pos:'operator',shiftType:'type1',active:true},
 {id:'e4',name:'Phạm Thị D', team:'B',pos:'operator',shiftType:'type1',active:true}];
S.base={};
const D0='2026-08-01';
for(let i=0;i<20;i++){const iso=addDaysIso(D0,i);
  ['e1','e2','e3','e4'].forEach(k=>{S.base[k]=S.base[k]||{};S.base[k][iso]='O';});}
S.over={e1:{'2026-08-05':{code:'R',by:'admin',at:Date.now()}}};
S.notifs={};S.events={};S.requests={};
S.trainings={
  tr1:{id:'tr1',title:'An toan PCCC',days:['2026-08-12'],emps:['e2'],
       mode:'shift',status:'active',from:'08:00',to:'11:00'},
  tr2:{id:'tr2',title:'Van hanh bom',days:['2026-08-13'],emps:['e3'],
       mode:'shift',status:'pending',from:'08:00',to:'11:00'}
};
S.meta={schedFrom:'2026-07-21',schedTo:'2026-08-20'};
S.rev=2;trResetCache();
mgr=true;adm=true;hrm=true;noSelf=false;calMode='real';
`,ctx);

let pass=0,fail=0;
function check(name,fn,must){
  try{
    const out=fn();
    if(must&&must.some(m=>!String(out||'').includes(m))){
      fail++;console.log('  ✗',name,'→ thiếu:',must.filter(m=>!String(out||'').includes(m)).join(' | '));
    }else{pass++;console.log('  ✓',name);}
  }catch(e){fail++;console.log('  ✗',name,'→ LỖI:',e.message);}
}
const G=expr=>vm.runInContext(expr,ctx);

console.log('\n[A] cellIsDiff — hợp của ghi đè và đào tạo');
check('ô có ghi đè vẫn là khác chuẩn',()=>G('cellIsDiff("e1","2026-08-05")')?'ok':'',['ok']);
check('ô có đào tạo (không ghi đè) là khác chuẩn',()=>G('cellIsDiff("e2","2026-08-12")')?'ok':'',['ok']);
check('đào tạo chờ duyệt cũng tính',()=>G('cellIsDiff("e3","2026-08-13")')?'ok':'',['ok']);
check('ô thường thì không',()=>G('cellIsDiff("e4","2026-08-12")')?'':'ok',['ok']);
check('ngày khác của người đi học thì không',()=>G('cellIsDiff("e2","2026-08-11")')?'':'ok',['ok']);

/* Lấy đúng thẻ <td> của một người / một ngày trong bảng để soi lớp CSS.
   Bảng dựng theo hàng người, cột ngày → đếm cột thứ mấy kể từ 5 ô thông tin. */
function cellOf(html,empId,iso){
  const rows=html.split('<tr');
  const days=G('daysOfPeriod("2026-08")');
  const i=days.indexOf(iso);if(i<0)return '';
  const row=rows.find(r=>r.includes('>'+empId+'</td>'));if(!row)return '';
  const tds=row.split('<td').slice(1);
  return tds[5+i]||'';
}

console.log('\n[B] Bảng lịch máy tính');
const mtx=()=>{
  doc.getElementById('calMonth').value='2026-08';
  doc.getElementById('calRange').value='month';
  doc.getElementById('calGroupFilter').value='__all';
  G('renderMatrix(REAL);');
  return doc.getElementById('mtxBox').innerHTML;
};
check('dựng được bảng',()=>{doc.getElementById('realDiffOnly').checked=false;return mtx();},
  ['<table class="mtx"']);
check('ô đào tạo mang lớp .diff',()=>cellOf(mtx(),'e2','2026-08-12'),['diff','trday']);
check('ô đào tạo KHÔNG mang lớp .ovr',()=>/\bovr\b/.test(cellOf(mtx(),'e2','2026-08-12'))?'':'ok',['ok']);
check('ô ghi đè vẫn có cả .ovr lẫn .diff',()=>cellOf(mtx(),'e1','2026-08-05'),['ovr','diff']);
check('ô thường không có .diff',()=>/\bdiff\b/.test(cellOf(mtx(),'e4','2026-08-12'))?'':'ok',['ok']);

console.log('\n[C] Lọc "Chỉ ô khác chuẩn"');
const filtered=()=>{doc.getElementById('realDiffOnly').checked=true;return mtx();};
check('giữ lại người chỉ có đào tạo',()=>filtered(),['Trần Văn B']);
check('giữ lại người đào tạo chờ duyệt',()=>filtered(),['Lê Văn C']);
check('bỏ người không có gì',()=>filtered().includes('Phạm Thị D')?'':'ok',['ok']);
check('giữ đúng ngày có lớp học',()=>filtered(),['>12<']);
check('bỏ ngày không ai đổi gì',()=>filtered().includes('>18<')?'':'ok',['ok']);

console.log('\n[D] Thẻ tuần (điện thoại)');
check('tuần chỉ có đào tạo không bị ẩn',()=>{
  /* Chỉ để lại buổi đào tạo, bỏ ghi đè: tuần 10–16/08 khi đó chỉ còn lớp học */
  G('S.over={};');
  doc.getElementById('calMonth').value='2026-08';
  doc.getElementById('calRange').value='month';
  doc.getElementById('calGroupFilter').value='__all';
  doc.getElementById('realDiffOnly').checked=true;
  G('calMode="real";renderCalWeekCards();');
  const h=els.calWeekBox.innerHTML;
  G('S.over={e1:{"2026-08-05":{code:"R",by:"admin",at:Date.now()}}};');
  return h;},['Trần Văn B','wk-cell-diff']);
check('ô đào tạo có dấu 🎓 trên thẻ tuần',()=>els.calWeekBox.innerHTML,['trdot']);

console.log('\n'+(fail?'❌ ':'✅ ')+pass+' đạt / '+fail+' hỏng');
process.exit(fail?1:0);
