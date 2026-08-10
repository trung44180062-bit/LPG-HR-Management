/* ============================================================
   HARNESS — BẢN TIN ZALO 08:00 + LỌC NHÓM VỊ TRÍ   ★ v6.8
   ------------------------------------------------------------
   Chạy:  node _test/digest-pg-harness.js
   ------------------------------------------------------------
   A. Bản tin gom 08:00 (js/21-notify.js)
      A1 đơn ot/multi/late/wt → vào SỔ CHỜ, không vào hàng đợi Zalo ngay
      A2 đơn nghỉ phép / đổi ca → vẫn bắn ngay, không bị chạm tới
      A3 trước 08:00 không bắn; từ 08:00 mới bắn
      A4 gom theo THỂ LOẠI — mỗi thể loại đúng MỘT tin
      A5 hai máy cùng mở lúc 08:00 → chỉ MỘT máy bắn (transaction)
      A6 trong ngày không bắn lần hai
      A7 đơn huỷ trước 08:00 → tin bốc hơi khỏi sổ chờ, không tốn tin nào
      A8 sổ chờ toàn mục lỗi thời → KHÔNG gửi tin rỗng
      A9 cả ngày không ai mở app → hôm sau vẫn gom, tiêu đề ghi rõ khoảng ngày

   C. Trừ giờ nghỉ trưa (js/01-core.js · js/13-portal.js)   ★ v6.9
      C1 08:00–20:00 tích trưa → 11h (đúng ví dụ nghiệp vụ)
      C2 khung giờ KHÔNG phủ 12:00–13:00 → không trừ dù có cờ
      C3 dòng đơn cũ (không có noLunch) → số giờ y như trước
      C4 ô tích chỉ hiện khi phủ trưa; sửa giờ ra ngoài trưa thì cờ tự rơi
      C5 giờ đã trừ chảy tới bản in · Excel · suất cơm · nhật ký OT
      C6 tin Zalo ghi rõ "−1h lunch"

   D. Kết quả duyệt đơn OT   ★ v6.9
      D1 'approved' của đơn ot/multi/late/wt → gom về 08:00
      D2 'rejected' vẫn bắn NGAY (đi làm thừa thì tai hại)
      D3 'approved' của đơn nghỉ phép / đổi ca vẫn bắn NGAY

   B. Lọc nhóm vị trí (js/08-requests.js · js/15-report.js)
      B1 pgOfReq đọc đúng nhóm của người đứng đơn
      B2 lọc Operator chỉ giữ đơn của operator
      B3 Bỏ lọc KHÔNG xoá lựa chọn nhóm vị trí
      B4 ba màn dùng chung một lựa chọn
   ============================================================ */
'use strict';
/* digestFlush ghi hàng đợi bằng promise → phải nhường một nhịp microtask
   trước khi soi kết quả. tick() làm đúng việc đó. */
const tick=()=>new Promise(r=>setTimeout(r,0));
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

/* ---------- Firebase giả: đủ để chạy transaction + set ---------- */
function makeServer(seed){return {data:JSON.parse(JSON.stringify(seed||{})),sets:[]};}
function deepGet(o,p){return p.split('/').filter(Boolean).reduce((a,k)=>(a==null?a:a[k]),o);}
function deepSet(o,p,v){
  const ks=p.split('/').filter(Boolean),last=ks.pop();let cur=o;
  ks.forEach(k=>{if(cur[k]==null||typeof cur[k]!=='object')cur[k]={};cur=cur[k];});
  if(v===null)delete cur[last];else cur[last]=v;
}
function makeRef(server,base){
  const self={
    child(p){return makeRef(server,base?base+'/'+p:p);},
    set(v){ server.sets.push({path:base,val:v}); deepSet(server.data,base,v); return Promise.resolve(); },
    remove(){ deepSet(server.data,base,null); return Promise.resolve(); },
    /* Transaction đồng bộ, đúng ngữ nghĩa Firebase: trả undefined = huỷ */
    transaction(fn,cb){
      const cur=deepGet(server.data,base);
      const next=fn(cur===undefined?null:cur);
      if(next===undefined){ cb&&cb(null,false,null); return Promise.resolve({committed:false}); }
      deepSet(server.data,base,next);
      cb&&cb(null,true,{val:()=>next});
      return Promise.resolve({committed:true});
    }
  };
  return self;
}

/* ---------- nạp js/21-notify.js vào sandbox ---------- */
function loadNotify(server,S,nowHour,nowDay){
  const src=rd('21-notify.js');
  const sandbox={
    console,JSON,Object,Array,String,Number,Math,RegExp,setInterval:()=>0,setTimeout,clearTimeout,
    S,fbRef:makeRef(server,''),firebase:{},
    pad:n=>String(n).padStart(2,'0'),
    t:s=>s, toast:()=>{}, save:()=>{}, confirm:()=>true,
    fbReady:()=>true,
    empById:id=>(S.employees||[]).find(e=>e.id===id)||null,
    noAccent:s=>String(s||'').toLowerCase(),
    document:{addEventListener:()=>{}},
    window:{addEventListener:()=>{}},
    Date:class extends Date{
      constructor(...a){ if(a.length)super(...a); else super(nowDay+'T'+String(nowHour).padStart(2,'0')+':30:00'); }
      static now(){return new Date().getTime();}
    }
  };
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox);
  return sandbox;
}

const EMPS=[
  {id:'e1',name:'NGUYEN VAN A',pos:'operator'},
  {id:'e2',name:'TRAN VAN B',pos:'field_eng'},
  {id:'e3',name:'LE VAN C',pos:'boardman'},
  {id:'ap',name:'HOANG TRUNG',pos:'field_eng'}
];
function freshS(){
  return {
    rev:1, employees:JSON.parse(JSON.stringify(EMPS)),
    requests:{
      r_ot :{id:'r_ot' ,type:'ot'   ,empId:'e1',status:'pending'},
      r_ot2:{id:'r_ot2',type:'ot'   ,empId:'e2',status:'pending'},
      r_mul:{id:'r_mul',type:'multi',empId:'e1',status:'pending'},
      r_lat:{id:'r_lat',type:'late' ,empId:'e3',status:'pending'},
      r_wt :{id:'r_wt' ,type:'wt'   ,empId:'e1',status:'pending'},
      r_al :{id:'r_al' ,type:'leave',empId:'e1',status:'pending'},
      r_sw :{id:'r_sw' ,type:'swap' ,empId:'e2',status:'pending'}
    },
    notifs:{}, digest:{}, meta:{}, settings:{}
  };
}
/* Tạo một thông báo "có đơn chờ duyệt" rồi đẩy qua zaloEnqueue */
function fire(ctx,S,id,reqId,zk){
  const n={id:id,kind:'info',zk:zk||'apprNeed',to:'ap',from:'e1',reqId:reqId,lvl:'fe'};
  S.notifs[id]=n;
  ctx.zaloEnqueue(n);
  return n;
}

async function main(){
/* ============================================================ */
head('A1–A2. Đơn nào vào sổ chờ, đơn nào vẫn bắn ngay');
{
  const S=freshS(), server=makeServer({});
  const c=loadNotify(server,S,9,'2026-08-10');
  fire(c,S,'n_ot','r_ot'); fire(c,S,'n_mul','r_mul');
  fire(c,S,'n_lat','r_lat'); fire(c,S,'n_wt','r_wt');
  ok(Object.keys(S.digest).length===4,'ot · multi · late · wt → cả 4 vào sổ chờ');
  ok(c.zaloOutPending()===0,'…và KHÔNG cái nào vào hộp gửi ngay');

  fire(c,S,'n_al','r_al'); fire(c,S,'n_sw','r_sw');
  ok(Object.keys(S.digest).length===4,'nghỉ phép & đổi ca KHÔNG bị gom');
  ok(c.zaloOutPending()===2,'…mà đi hộp gửi để bắn ngay như cũ');
}

head('D. Kết quả duyệt đơn OT');
{
  const S=freshS(), server=makeServer({});
  const c=loadNotify(server,S,9,'2026-08-10');
  fire(c,S,'d_ok' ,'r_ot' ,'approved');
  fire(c,S,'d_ok2','r_lat','approved');
  ok(Object.keys(S.digest).length===2,'D1 ★ "đã duyệt" của đơn OT / đi trễ → gom về 08:00');
  ok(c.zaloOutPending()===0,'…không tốn tin Zalo ngay');

  fire(c,S,'d_no','r_ot','rejected');
  ok(S.digest['d_no']===undefined,'D2 ★ "bị từ chối" KHÔNG gom');
  ok(c.zaloOutPending()===1,'…mà bắn ngay để người ta khỏi đi làm thừa');

  fire(c,S,'d_al','r_al','approved');
  ok(S.digest['d_al']===undefined&&c.zaloOutPending()===2,
     'D3 ★ "đã duyệt" đơn nghỉ phép vẫn bắn ngay — đổi lịch đi làm thật');
}

head('A3. Trước 08:00 không bắn, từ 08:00 mới bắn');
{
  const S=freshS(), server=makeServer({});
  const early=loadNotify(server,S,7,'2026-08-10');
  fire(early,S,'n_ot','r_ot');
  ok(early.digestDue()===false,'07:30 → chưa tới giờ');
  let sent=null; early.digestFlush(false,v=>sent=v);
  ok(sent===false&&!server.data.zaloQueue,'…không ghi hàng đợi Zalo');

  const late=loadNotify(server,S,8,'2026-08-10');
  ok(late.digestDue()===true,'08:30 → tới giờ');
}

head('A4. Gom theo THỂ LOẠI — mỗi thể loại một tin');
let dayServer=null,dayS=null;
{
  const S=freshS(), server=makeServer({});
  const c=loadNotify(server,S,8,'2026-08-10');
  fire(c,S,'n_ot' ,'r_ot');       // apprNeed
  fire(c,S,'n_ot2','r_ot2');      // apprNeed
  fire(c,S,'n_mul','r_mul');      // apprNeed
  fire(c,S,'n_wt' ,'r_wt' ,'cancelled');   // thể loại khác (reqResult)
  ok(c.digestPending()===4,'sổ chờ có 4 mục');

  let done=null; c.digestFlush(false,v=>done=v); await tick();
  const q=server.data.zaloQueue||{};
  const rows=Object.values(q);
  ok(done===true,'bắn thành công');
  ok(rows.length===2,'★ 4 mục → đúng 2 tin (2 thể loại), không phải 4 tin  [n='+rows.length+']');
  const appr=rows.find(r=>r.group==='apprNeed');
  ok(!!appr&&appr.n===3,'tin "cần duyệt" gộp đủ 3 mục');
  ok(!!appr&&/DAILY DIGEST/.test(appr.title),'tiêu đề ghi rõ là bản tin gom');
  ok(!!appr&&appr.digest===1,'hàng đợi có cờ digest để tra cứu về sau');
  ok(c.digestPending()===0,'sổ chờ đã được dọn');
  dayServer=server; dayS=S;
}

head('A5–A6. Chống hai máy cùng bắn, và không bắn lần hai trong ngày');
{
  const S=freshS(), server=makeServer({});
  const A=loadNotify(server,S,8,'2026-08-10');
  fire(A,S,'n_ot','r_ot'); fire(A,S,'n_ot2','r_ot2');

  /* máy B dùng CHUNG server và CHUNG S (đã đồng bộ) */
  const B=loadNotify(server,S,8,'2026-08-10');
  let a=null,b=null;
  A.digestFlush(false,v=>a=v);
  B.digestFlush(false,v=>b=v);
  await tick();
  ok(a===true&&b===false,'★ chỉ MỘT máy giành được quyền bắn');
  ok(Object.keys(server.data.zaloQueue||{}).length===1,'…nên chỉ có 1 tin trên hàng đợi');
  ok(server.data.meta.digestDay==='2026-08-10','mốc ngày đã ghi lên máy chủ');

  /* thêm đơn mới trong ngày → KHÔNG bắn tiếp */
  fire(A,S,'n_ot3','r_mul');
  let again=null; A.digestFlush(false,v=>again=v); await tick();
  ok(again===false,'★ trong ngày không bắn lần hai');
  ok(A.digestPending()===1,'mục mới nằm chờ tới sáng mai');
}

head('A7. Đơn huỷ trước 08:00 → tin bốc hơi, không tốn gì');
{
  const S=freshS(), server=makeServer({});
  const c=loadNotify(server,S,7,'2026-08-10');
  fire(c,S,'n_ot','r_ot');
  ok(c.digestPending()===1,'đang chờ 1 mục');
  c.zaloWithdraw('n_ot');
  ok(S.digest['n_ot']===undefined,'★ gỡ khỏi sổ chờ');
  ok(!server.data.zaloQueue,'…và chưa hề ghi gì lên hàng đợi Zalo');
}

head('A8. Sổ chờ toàn mục lỗi thời → KHÔNG gửi tin rỗng');
{
  const S=freshS(), server=makeServer({});
  const c=loadNotify(server,S,8,'2026-08-10');
  fire(c,S,'n_ot','r_ot');
  delete S.notifs['n_ot'];                 // thông báo bị gỡ ở máy khác
  let done=null; c.digestFlush(false,v=>done=v); await tick();
  ok(done===true,'vẫn coi là xử lý xong');
  ok(!server.data.zaloQueue,'★ KHÔNG gửi tin rỗng (quy tắc R5)');
  ok(c.digestPending()===0,'sổ chờ được dọn sạch');
  ok(S.meta.digestDay==='2026-08-10','vẫn đóng mốc ngày, không lặp lại vô ích');
}

head('A9. Cả ngày không ai mở app → hôm sau vẫn gom, có ghi khoảng ngày');
{
  const S=freshS(), server=makeServer({});
  const d1=loadNotify(server,S,9,'2026-08-10');
  fire(d1,S,'n_ot','r_ot');
  S.digest['n_ot'].at=new Date('2026-08-10T09:00:00').getTime();
  const d2=loadNotify(server,S,9,'2026-08-12');
  fire(d2,S,'n_ot2','r_ot2');
  S.digest['n_ot2'].at=new Date('2026-08-12T07:00:00').getTime();
  let done=null; d2.digestFlush(false,v=>done=v); await tick();
  const row=Object.values(server.data.zaloQueue||{})[0];
  ok(done===true&&!!row,'★ hai ngày dồn lại vẫn bắn được');
  ok(row.n===2,'gộp đủ 2 mục của hai ngày');
  ok(/10\/08→12\/08/.test(row.title),'tiêu đề ghi rõ khoảng ngày đã gom  ['+row.title+']');
}

/* ============================================================ */
head('C. Trừ giờ nghỉ trưa');
{
  /* nạp riêng phần tính giờ của js/01-core.js */
  const core=rd('01-core.js');
  const from=core.indexOf('function otHours('), to=core.indexOf('let S={');
  const sb={console,Date,Math,Number,String,Object};
  sb.globalThis=sb; vm.createContext(sb);
  vm.runInContext(core.slice(from,to),sb);

  ok(sb.otHours('2026-08-12','08:00','','20:00')===12,'C1 08:00–20:00 thô = 12h');
  ok(sb.otNetHours('2026-08-12','08:00','','20:00',1)===11,
     'C1 ★ tích "Không làm trưa" → 11h (đúng ví dụ nghiệp vụ)');
  ok(sb.otNetHours('2026-08-12','08:00','','20:00',0)===12,'C1 không tích → vẫn 12h');

  ok(sb.otSpansLunch('2026-08-12','17:00','','20:00')===false,'C2 17:00–20:00 không phủ giờ trưa');
  ok(sb.otNetHours('2026-08-12','17:00','','20:00',1)===3,
     'C2 ★ không phủ trưa thì KHÔNG trừ, dù cờ có bật');
  ok(sb.otSpansLunch('2026-08-12','08:00','','12:00')===false,'C2 kết thúc đúng 12:00 = chưa chạm trưa');
  ok(sb.otSpansLunch('2026-08-12','13:00','','17:00')===false,'C2 bắt đầu đúng 13:00 = đã qua trưa');
  ok(sb.otSpansLunch('2026-08-12','11:30','','12:30')===true,'C2 11:30–12:30 có phủ');

  ok(sb.otNetHours('2026-08-12','08:00','','20:00',undefined)===12,
     'C3 ★ dòng đơn CŨ (không có noLunch) → số giờ y như trước, không đổi');
  ok(sb.otDayHours({iso:'2026-08-12',timeIn:'08:00',timeOut:'20:00',hours:11,noLunch:1})===11,
     'C3 đã có d.hours thì lấy thẳng, không tính lại');

  ok(sb.otNetHours('2026-08-12','12:00','','13:00',1)===0,'C1 khai đúng đoạn trưa rồi tích → 0h');
  /* const trong vm không lộ ra sandbox → kiểm thẳng trên mã nguồn */
  ok(/const LUNCH_BREAK_H = 1;/.test(core),'C1 giờ nghỉ trưa cố định 1h');

  const port=rd('13-portal.js');
  ok(/otNetHours\(r\.iso,r\.timeIn,r\.isoEnd,r\.timeOut,r\.noLunch\)/.test(port),
     'C4 số giờ trên form đã trừ trưa');
  ok(/otSpansLunch\(row\.iso,row\.timeIn,row\.isoEnd,row\.timeOut\)\?`/.test(port),
     'C4 ★ ô tích CHỈ hiện khi khung giờ phủ 12:00–13:00');
  ok(/row\.noLunch&&\['iso','isoEnd','timeIn','timeOut'\]\.includes\(k\)/.test(port),
     'C4 ★ sửa giờ ra ngoài trưa thì cờ tự rơi');
  ok(/if\(r\.noLunch&&!otSpansLunch\(r\.iso,r\.timeIn,r\.isoEnd,r\.timeOut\)\)r\.noLunch=0;/.test(port),
     'C4 đổi mẫu OT cũng rà lại cờ');
  ok(/d\.hours=otNetHours\(d\.iso,d\.timeIn,d\.isoEnd,d\.timeOut,d\.noLunch\)/.test(port),
     'C5 ★ d.hours lưu xuống Firebase LÀ SỐ ĐÃ TRỪ');
  ok(/ra 0 giờ/.test(port),'C4 dòng ra 0h bị chặn lúc gửi');

  /* C5 — không còn chỗ nào tính giờ OT mà bỏ qua cờ nghỉ trưa */
  const files=['08-requests.js','09-print.js','15-report.js','17-appr-sum.js','19-meal.js'];
  let leak=[];
  files.forEach(f=>{ if(/otHours\(/.test(rd(f).replace(/otNetHours\(/g,''))) leak.push(f); });
  ok(leak.length===0,'C5 ★ bản in · Excel · Báo cáo · Tổng quan · suất cơm đều dùng otNetHours  '
     +(leak.length?('['+leak.join(', ')+']'):''));
  ok(/noLunch\?'\[-1h trưa\]':''/.test(rd('08-requests.js')),'C5 Excel đánh dấu ngày đã trừ trưa');
  ok(/minus 1h lunch/.test(rd('09-print.js')),'C5 tờ đơn in ghi rõ đã trừ nghỉ trưa');
  ok(/−1h lunch/.test(rd('21-notify.js')),'C6 ★ tin Zalo ghi rõ "−1h lunch"');
}

/* ============================================================ */
head('B. Lọc nhóm vị trí');
{
  const core=rd('01-core.js'), req=rd('08-requests.js'), rep=rd('15-report.js');

  ok(/function pgChips\(\)/.test(req),'B1 có pgChips() ở màn Duyệt');
  ok(/function pgOfReq/.test(req)&&/posGroupOfId/.test(req),
     'B1 pgOfReq lấy nhóm qua posGroupOfId (dùng chung cách phân nhóm của Nhân lực)');
  ok(/if\(!pgMatch\(r,apprFilter\.pg\)\)return false;/.test(req),
     'B2 apprMatch đã áp bộ lọc — nên danh sách, Excel và in đều theo');
  ok(/pg:apprFilter\.pg\|\|'__all'/.test(req),
     'B3 Bỏ lọc GIỮ nguyên nhóm vị trí đang làm dở');
  ok(/otlogPg/.test(rep)&&/repPg/.test(rep),'B4 Nhật ký tăng ca và Báo cáo đều có');
  ok(/typeof otlogPg!=='undefined'\)otlogPg=pg/.test(req.replace(/\s+/g,' '))
     ||/otlogPg=pg/.test(req),'B4 pgRemember đồng bộ lựa chọn sang các màn khác');
  ok(/POSG_OPER='oper'/.test(core),'nhóm vị trí vẫn lấy từ js/01-core.js, không đẻ khái niệm mới');

  /* chạy thật pgMatch trong sandbox nhỏ */
  const sb={console,Object,Array,String,POSG_ENG:'eng',POSG_OPER:'oper',POSG_OTHER:'other',
    S:{employees:EMPS},
    empById:id=>EMPS.find(e=>e.id===id)||null,
    posGroupOfId:id=>{const e=EMPS.find(x=>x.id===id);if(!e)return 'other';
      return e.pos==='operator'?'oper':(e.pos==='field_eng'||e.pos==='boardman')?'eng':'other';},
    localStorage:{getItem:()=>null,setItem:()=>{}}};
  sb.globalThis=sb; vm.createContext(sb);
  const cut=req.slice(req.indexOf('function pgChips()'),req.indexOf("apprFilter.pg=pgRecall()"));
  vm.runInContext('let apprFilter={pg:"__all"};'+cut.replace(/apprFilter\.pg=pg;/,''),sb);
  const R={ot:{empId:'e1'},fe:{empId:'e2'},bm:{empId:'e3'}};
  ok(sb.pgOfReq(R.ot)==='oper','B1 đơn của operator → oper');
  ok(sb.pgOfReq(R.fe)==='eng'&&sb.pgOfReq(R.bm)==='eng','B1 Field Engineer & Boardman đều là kỹ sư');
  ok(sb.pgMatch(R.ot,'oper')&&!sb.pgMatch(R.fe,'oper'),'B2 lọc Operator giữ đúng đơn operator');
  ok(sb.pgMatch(R.ot,'__all')&&sb.pgMatch(R.fe,'__all'),'B2 "Mọi vị trí" không loại ai');
}

console.log('\n════════════════════════════════════');
console.log(fail?('✗ TRƯỢT '+fail+' / ĐẠT '+pass):('✓ ĐẠT HẾT '+pass+' bài'));
console.log('════════════════════════════════════');
process.exit(fail?1:0);
}
main();
