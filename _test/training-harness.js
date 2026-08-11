/* ============================================================
   HARNESS — LỊCH ĐÀO TẠO + MÃ BT + TỰ CHUYỂN KỲ CA
   ------------------------------------------------------------
   Chạy:  node _test/training-harness.js
   ------------------------------------------------------------
   A. Phân quyền (js/22-training.js)
      A1 quản trị / SC / thư ký / QL người Hàn xếp được cho người khác
      A2 nhân viên thường CHỈ xếp được cho chính mình
      A3 nhân viên tự khai → status 'pending' (luôn cần duyệt)
      A4 quản lý xếp → 'active' ngay
      A5 nhân viên KHÔNG sửa/xoá được bản đã duyệt

   B. Sinh đơn tăng ca (mode 'ot')
      B1 mỗi người MỘT đơn, trong đơn mỗi ngày MỘT dòng
      B2 đơn mang trId, note ghi tên buổi, status 'pending'
      B3 số giờ tính đúng (kể cả trừ trưa)
      B4 mode 'shift' KHÔNG sinh đơn nào
      B5 bản 'pending' chưa duyệt thì CHƯA sinh đơn; duyệt xong mới sinh
      B6 bấm Lưu hai lần không đẻ đơn trùng

   C. Sửa & xoá
      C1 sửa buổi → đơn OT chưa duyệt bị gỡ và tạo lại theo giờ mới
      C2 đơn ĐÃ DUYỆT không bị đụng, báo lại số đơn giữ nguyên
      C3 xoá buổi → thu hồi thông báo + gỡ đơn chưa duyệt
      C4 KHÔNG tự tombSet khi xoá (để fbDiff còn gửi được đường dẫn del)

   D. Thông báo
      D1 bản 'active' → báo cho từng người đi học
      D2 bản 'pending' → báo cho NGƯỜI DUYỆT, không báo người khai
      D3 sửa buổi → thu hồi tin cũ rồi gửi lại (không đẻ hai bộ)
      D4 nhãn nhóm giống nhau ở mọi tin → Zalo gộp thành 1 tin

   E. Mã màu ô lịch
      E1 ô có đào tạo → lớp .trday
      E2 bản chờ duyệt → thêm .trpend
      E3 ô của người KHÁC trong cùng ngày không bị tô

   F. Mã BT (js/01-core.js)
      F1 BT có trong danh sách mã, cat 'leave', 8 giờ
      F2 lọt vào form đơn nghỉ phép (cat 'leave')
      F3 có bản dịch tiếng Anh cho tin Zalo

   G. Tự chuyển kỳ ca (js/04-schedule.js)
      G1 cùng kỳ → KHÔNG can thiệp (người dùng lật kỳ cũ vẫn yên)
      G2 qua ngày 21 → nhảy sang kỳ mới, xoá biến nhớ kỳ của các màn
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m+(x!==undefined?'   ['+x+']':''));}
                   else{fail++;console.log('  ✗ '+m+(x!==undefined?'   ['+x+']':''));}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

const EMPS=[
  {id:'e1',name:'NGUYEN VAN A',pos:'operator',  team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e2',name:'TRAN VAN B',  pos:'field_eng', team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e3',name:'LE VAN C',    pos:'boardman',  team:'B',perm:'staff',active:true,shiftType:'shift'},
  {id:'sc',name:'HOANG TRUNG', pos:'field_eng', team:'A',perm:'appr', active:true,shiftType:'shift'},
  {id:'ad',name:'QUAN TRI',    pos:'office',    team:'',  perm:'admin',active:true,shiftType:'none'}
];

/* ------------------------------------------------------------
   Sandbox: nạp THẬT js/01-core.js · js/04-schedule.js · js/22-training.js
   (không cắt lát file — cắt lát là cái bẫy đã dính ở v6.2).
   Mọi thứ ba file đó gọi sang file khác thì bơm stub vào trước.
   ------------------------------------------------------------ */
function build(opt){
  opt=opt||{};
  const sandbox={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>0,isNaN,parseInt,parseFloat};
  sandbox.globalThis=sandbox;
  sandbox.window=sandbox;
  sandbox.document={addEventListener:()=>{},querySelectorAll:()=>[],getElementById:()=>null,hidden:false};
  sandbox.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  vm.createContext(sandbox);

  /* Stub phải có TRƯỚC khi nạp core (core gọi isEN trong fmt…) */
  vm.runInContext(`
    var __toasts=[], __saves=0, __zq=[], __notifApprCalls=[];
    var LANG='vi';                 /* isEN() của core đọc biến này */
    function t(s){return s;}
    function t2(s){return s;}
    /* $ / pad / esc / uid … do chính js/01-core.js khai — KHÔNG stub, khai
       trùng là ReferenceError vì core dùng const. */
    function toast(m){__toasts.push(String(m));}
    function confirm(){return true;}
    function alert(){}
    var rnd1=v=>Math.round(v*10)/10;
    /* zaloEnqueue thật nằm ở js/21-notify.js; ở đây chỉ ghi lại để đếm và
       soi nhãn nhóm (aud) — phần dựng tin đã có zalo-format-harness lo. */
    function zaloEnqueue(n){__zq.push(n);}
    function newNotif(o){
      var id='n'+(Object.keys(S.notifs).length+1)+'_'+Math.random().toString(36).slice(2,6);
      S.notifs[id]=Object.assign({id:id,status:'pending',createdAt:Date.now()},o);
      zaloEnqueue(S.notifs[id]);
      return id;
    }
    function notifDrop(pred){
      var n=0;
      for(var k in S.notifs){var x=S.notifs[k];if(!x)continue;
        var hit=false; try{hit=!!pred(x);}catch(e){hit=false;}
        if(hit){delete S.notifs[k];n++;}}
      return n;
    }
    function notifyApprovers(r,by){__notifApprCalls.push({req:r.id,by:by});}
    function cancelReq(rid){delete S.requests[rid];return{reverted:0};}
    function defaultNoPrint(type){return type!=='wt'&&type!=='swap';}
    function teamList(){
      var s=[];(S.employees||[]).forEach(function(e){var x=e.team||'';if(s.indexOf(x)<0)s.push(x);});
      return s.sort();
    }
    function shortName(n){var w=String(n||'').trim().split(/\\s+/);return w.slice(-2).join(' ')||String(n||'');}
    function permOf(id){var e=(S.employees||[]).find(function(x){return x.id===id;});return (e&&e.perm)||'staff';}
    function save(cb){__saves++;S.rev=Date.now()+__saves;if(cb)cb(true);}
    function renderCal(){}
    function renderMe(){}
    function renderAppr(){}
    function renderAll(){}
    function fillMonthSelects(){}
    function refreshBadge(){}
    function mondayOf(iso){var d=new Date(iso+'T00:00:00');var k=(d.getDay()+6)%7;d.setDate(d.getDate()-k);
      return d.toISOString().slice(0,10);}
  `,sandbox);

  vm.runInContext(rd('01-core.js'),sandbox);
  /* addDaysIso ở js/13-portal.js — nạp riêng vì file đó kéo theo cả DOM.
     Bản gốc y nguyên, chỉ đổi chỗ khai. */
  vm.runInContext(`
    function addDaysIso(iso,n){var d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoOf(d);}
  `,sandbox);

  vm.runInContext(rd('04-schedule.js'),sandbox);
  /* baseShiftOf ở js/08-requests.js — chép NGUYÊN VĂN (file gốc kéo theo cả
     màn Duyệt). trAutoModeFor() dựa hẳn vào hàm này: thiếu nó thì mọi ngày
     đều ra 'ot' và bài kiểm sẽ xanh/đỏ vì lý do sai. */
  vm.runInContext(`
    function baseShiftOf(code){
      var cb=(typeof comboOf==='function')&&comboOf(code);
      if(cb)code=cb.work;
      if(code==='D'||code==='SD'||code==='OTD')return 'D';
      if(code==='N'||code==='SN'||code==='OTN')return 'N';
      if(code==='O'||code==='SO'||code==='OTO')return 'O';
      return null;
    }
  `,sandbox);
  vm.runInContext(rd('22-training.js'),sandbox);
  /* js/01-core.js khai lại toast() (bản thật, cần DOM) và đè lên stub phía
     trên — dựng lại SAU khi nạp xong, không thì perJumpTo() nổ ở $('toast'). */
  vm.runInContext(`function toast(m){__toasts.push(String(m));}`,sandbox);

  /* Nạp dữ liệu + đặt cờ quyền. `let S` của core là biến lexical, không
     phải thuộc tính sandbox → phải bắc cầu qua globalThis để Node đọc. */
  vm.runInContext(`
    S.employees=${JSON.stringify(EMPS)};
    S.base={};S.over={};S.requests={};S.notifs={};S.trainings={};S.del={};
    S.meta={schedFrom:'',schedTo:''};S.rev=1;
    /* Lịch chuẩn tối thiểu để eff()/schedEmps() có cái mà đọc */
    ['e1','e2','e3','sc'].forEach(function(id){
      S.base[id]={};
      ['2026-08-24','2026-08-25','2026-08-26','2026-08-27'].forEach(function(iso){S.base[id][iso]='O';});
    });
    globalThis.__ctx={
      get S(){return S;},
      get toasts(){return __toasts;},
      get zq(){return __zq;},
      get apprCalls(){return __notifApprCalls;},
      setMe:function(id,isSecr){ globalThis.__me=id; secr=!!isSecr; mgr=!!isSecr; adm=!!isSecr; noSelf=false; },
      call:function(fn,a,b){return globalThis[fn](a,b);}
    };
    function meId(){return globalThis.__me||'';}
  `,sandbox);
  sandbox.__ctx.setMe(opt.me||'ad',opt.secr!==false);
  return sandbox;
}
/* Gọi một hàm trong sandbox với tham số bất kỳ (đi qua JSON cho gọn) */
function call(sb,fn,args){
  sb.__args=args||[];
  return vm.runInContext(`(function(){return ${fn}.apply(null,__args);})()`,sb);
}

const D=['2026-08-24','2026-08-25'];
function baseTr(over){
  /* ★ v7.2 — giờ học là BẮT BUỘC cho mọi ngày, kể cả buổi học trong ca:
     số giờ đó là nguồn của cột "Giờ đào tạo" ở báo cáo. */
  return Object.assign({
    title:'An toan hoa chat', place:'Phong hop 2', note:'',
    days:D.slice(), emps:['e1','e2'],
    mode:'shift', timeIn:'08:00', timeOut:'17:00', noLunch:true, notify:true
  },over||{});
}

/* ============================================================ */
head('A. Phân quyền');
{
  const sb=build({me:'ad',secr:true});
  const r=call(sb,'trSave',[baseTr()]);
  ok(r.ok,'A1 quản trị xếp được cho người khác');
  ok(r.status==='active','A4 quản lý xếp → có hiệu lực ngay',r.status);

  const sb2=build({me:'sc',secr:true});
  ok(call(sb2,'trSave',[baseTr()]).ok,'A1 SC (quyền Duyệt đơn) cũng xếp được');

  const sb3=build({me:'e1',secr:false});
  const bad=call(sb3,'trSave',[baseTr({emps:['e1','e2']})]);
  ok(!bad.ok,'A2 nhân viên thường KHÔNG xếp được cho người khác',bad.err);
  const mine=call(sb3,'trSave',[baseTr({emps:['e1']})]);
  ok(mine.ok,'A2 …nhưng xếp được cho chính mình');
  ok(mine.status==='pending','A3 nhân viên tự khai → CHỜ DUYỆT',mine.status);
}
{
  const sb=build({me:'e1',secr:false});
  const r=call(sb,'trSave',[baseTr({emps:['e1']})]);
  /* quản lý duyệt */
  const sbId=r.id;
  vm.runInContext(`globalThis.__me='ad';secr=true;mgr=true;adm=true;`,sb);
  const ap=call(sb,'trApprove',[sbId]);
  ok(ap.ok,'A5 quản lý duyệt được bản nhân viên tự khai');
  vm.runInContext(`globalThis.__me='e1';secr=false;mgr=false;adm=false;`,sb);
  const ed=call(sb,'trSave',[baseTr({id:sbId,emps:['e1'],title:'Doi ten'})]);
  ok(!ed.ok,'A5 nhân viên KHÔNG sửa được bản đã duyệt',ed.err);
  const de=call(sb,'trDelete',[sbId]);
  ok(!de.ok,'A5 …và cũng không xoá được',de.err);
}

/* ============================================================ */
head('B. Sinh đơn tăng ca');
{
  const sb=build({me:'ad',secr:true});
  const r=call(sb,'trSave',[baseTr({mode:'ot',timeIn:'17:00',timeOut:'20:00',noLunch:false})]);
  ok(r.ok,'B lưu được buổi đào tạo tăng ca');
  const reqs=Object.values(sb.__ctx.S.requests);
  ok(reqs.length===2,'B1 2 người → 2 đơn',reqs.length);
  ok(reqs.every(x=>x.days.length===2),'B1 mỗi đơn 2 dòng (2 ngày)');
  ok(reqs.every(x=>x.trId===r.id),'B2 đơn mang trId nối về buổi đào tạo');
  ok(reqs.every(x=>x.status==='pending'&&x.type==='ot'),'B2 đơn OT ở trạng thái chờ duyệt');
  ok(reqs.every(x=>/An toan hoa chat/.test(x.note)),'B2 note ghi tên buổi',reqs[0].note);
  ok(reqs.every(x=>x.days.every(d=>d.hours===3)),'B3 17:00–20:00 → 3 giờ/ngày',reqs[0].days[0].hours);
  ok(sb.__ctx.apprCalls.length===2,'B2 mỗi đơn gọi notifyApprovers đúng 1 lần');

  /* B3b — trừ giờ nghỉ trưa */
  const sb2=build({me:'ad',secr:true});
  call(sb2,'trSave',[baseTr({mode:'ot',timeIn:'08:00',timeOut:'20:00',noLunch:true})]);
  const h=Object.values(sb2.__ctx.S.requests)[0].days[0].hours;
  ok(h===11,'B3 08:00–20:00 trừ trưa → 11 giờ',h);

  /* B4 — trong ca thì không sinh đơn */
  const sb3=build({me:'ad',secr:true});
  call(sb3,'trSave',[baseTr({mode:'shift'})]);
  ok(Object.keys(sb3.__ctx.S.requests).length===0,'B4 đào tạo trong ca → KHÔNG sinh đơn nào');

  /* B5 — bản chờ duyệt chưa sinh đơn */
  const sb4=build({me:'e1',secr:false});
  const p=call(sb4,'trSave',[baseTr({emps:['e1'],mode:'ot',preset:'OT3',timeIn:'17:00',timeOut:'20:00'})]);
  ok(Object.keys(sb4.__ctx.S.requests).length===0,'B5 bản CHỜ DUYỆT chưa sinh đơn nào');
  vm.runInContext(`globalThis.__me='ad';secr=true;mgr=true;adm=true;`,sb4);
  const ap=call(sb4,'trApprove',[p.id]);
  ok(ap.nReq===1&&Object.keys(sb4.__ctx.S.requests).length===1,'B5 duyệt xong mới sinh đơn',ap.nReq);

  /* B6 — lưu lại lần nữa không đẻ đơn trùng */
  const before=Object.keys(sb.__ctx.S.requests).length;
  call(sb,'trMakeReqs',[sb.__ctx.S.trainings[r.id]]);
  ok(Object.keys(sb.__ctx.S.requests).length===before,'B6 gọi lại trMakeReqs không đẻ đơn trùng');
}

/* ============================================================ */
head('C. Sửa & xoá');
{
  const sb=build({me:'ad',secr:true});
  const r=call(sb,'trSave',[baseTr({mode:'ot',timeIn:'17:00',timeOut:'20:00',noLunch:false})]);
  const ids0=Object.keys(sb.__ctx.S.requests);
  const r2=call(sb,'trSave',[baseTr({id:r.id,mode:'ot',timeIn:'18:00',timeOut:'20:00',noLunch:false})]);
  const reqs=Object.values(sb.__ctx.S.requests);
  ok(reqs.length===2,'C1 sửa xong vẫn đúng 2 đơn (không cộng dồn)',reqs.length);
  ok(reqs.every(x=>ids0.indexOf(x.id)<0),'C1 …là đơn MỚI, đơn cũ đã bị gỡ');
  ok(reqs.every(x=>x.days[0].hours===2),'C1 giờ tính lại theo khung giờ mới',reqs[0].days[0].hours);
  ok(r2.keptReq===0,'C1 không có đơn nào phải giữ lại');

  /* C2 — một đơn đã duyệt thì không đụng */
  const keep=reqs[0].id;
  sb.__ctx.S.requests[keep].status='approved';
  const r3=call(sb,'trSave',[baseTr({id:r.id,mode:'ot',timeIn:'17:00',timeOut:'20:00',noLunch:false})]);
  ok(!!sb.__ctx.S.requests[keep],'C2 đơn ĐÃ DUYỆT vẫn còn nguyên');
  ok(r3.keptReq===1,'C2 báo lại đúng 1 đơn được giữ',r3.keptReq);

  /* C3/C4 — xoá */
  const sb2=build({me:'ad',secr:true});
  const x=call(sb2,'trSave',[baseTr({mode:'ot',timeIn:'17:00',timeOut:'20:00',noLunch:false})]);
  const del=call(sb2,'trDelete',[x.id]);
  ok(del.ok&&del.nReq===2,'C3 xoá buổi → gỡ 2 đơn chưa duyệt',del.nReq);
  ok(Object.keys(sb2.__ctx.S.trainings).length===0,'C3 bản ghi đã biến mất');
  ok(Object.values(sb2.__ctx.S.notifs).filter(n=>n.kind==='training').length===0,
     'C3 thông báo đào tạo đã thu hồi hết');
  ok(!(sb2.__ctx.S.del&&sb2.__ctx.S.del.trainings),
     'C4 ★ KHÔNG tự dựng bia mộ — để fbDiff() còn gửi được del/trainings/<id>');
}

/* ============================================================ */
head('D. Thông báo');
{
  const sb=build({me:'ad',secr:true});
  const r=call(sb,'trSave',[baseTr()]);
  const ns=Object.values(sb.__ctx.S.notifs).filter(n=>n.kind==='training');
  ok(ns.length===2,'D1 2 người đi học → 2 thông báo',ns.length);
  ok(ns.every(n=>['e1','e2'].indexOf(n.to)>=0),'D1 gửi đúng người đi học');
  ok(ns.every(n=>n.aud==='Training attendees'),'D4 nhãn nhóm giống nhau ở mọi tin → Zalo gộp 1 tin');
  ok(ns.every(n=>n.trId===r.id),'D thông báo mang trId để còn thu hồi');

  /* D3 — sửa thì thu hồi rồi gửi lại, không đẻ hai bộ */
  call(sb,'trSave',[baseTr({id:r.id,title:'An toan dien'})]);
  const ns2=Object.values(sb.__ctx.S.notifs).filter(n=>n.kind==='training');
  ok(ns2.length===2,'D3 sửa buổi → vẫn đúng 2 tin, không thành 4',ns2.length);
  ok(ns2.every(n=>/An toan dien/.test(n.text||'')),'D3 nội dung là bản MỚI');

  /* D2 — bản chờ duyệt gọi người duyệt */
  const sb2=build({me:'e1',secr:false});
  call(sb2,'trSave',[baseTr({emps:['e1']})]);
  const to=Object.values(sb2.__ctx.S.notifs).filter(n=>n.kind==='training').map(n=>n.to).sort();
  ok(to.join(',')==='ad,sc','D2 bản chờ duyệt → báo cho SC và quản trị',to.join(','));
  ok(to.indexOf('e1')<0,'D2 …không tự gửi cho chính người khai');
}

/* ============================================================ */
head('E. Mã màu ô lịch');
{
  const sb=build({me:'ad',secr:true});
  call(sb,'trSave',[baseTr({emps:['e1']})]);
  ok(/ trday/.test(call(sb,'trCellCls',['e1','2026-08-24'])),'E1 ô người đi học có lớp .trday');
  ok(!/trpend/.test(call(sb,'trCellCls',['e1','2026-08-24'])),'E1 bản đã duyệt KHÔNG có .trpend');
  ok(call(sb,'trCellCls',['e2','2026-08-24'])==='','E3 ô người khác cùng ngày KHÔNG bị tô');
  ok(call(sb,'trCellCls',['e1','2026-08-30'])==='','E3 ngày ngoài buổi cũng không bị tô');

  const sb2=build({me:'e1',secr:false});
  call(sb2,'trSave',[baseTr({emps:['e1']})]);
  ok(/trpend/.test(call(sb2,'trCellCls',['e1','2026-08-24'])),'E2 bản chờ duyệt có thêm .trpend');
}

/* ============================================================ */
head('F. Mã BT (Business trip)');
{
  const sb=build({me:'ad',secr:true});
  const codes=call(sb,'allCodes',[]);
  const bt=codes.find(c=>c.c==='BT');
  ok(!!bt,'F1 BT có trong danh sách mã ca');
  ok(bt&&bt.cat==='leave','F1 BT thuộc nhóm nghỉ phép (đếm quân số trừ ra)',bt&&bt.cat);
  ok(call(sb,'getHours',['BT'])===8,'F1 BT ăn 8 giờ công',call(sb,'getHours',['BT']));
  ok(codes.filter(c=>c.cat==='leave').some(c=>c.c==='BT'),
     'F2 lọt vào form đơn nghỉ phép (dsCodesFor lọc theo cat)');
  const zsrc=rd('21-notify.js');
  ok(/BT:'Business trip'/.test(zsrc),'F3 có bản dịch tiếng Anh cho tin Zalo');
  ok(/BT: Đi công tác \(Business trip\)/.test(rd('09-print.js')),'F3 có trong chú giải biểu mẫu in');
}

/* ============================================================ */
head('G. Tự chuyển kỳ ca');
{
  const sb=build({me:'ad',secr:true});
  /* Mốc cắt kỳ: ngày 20 còn thuộc kỳ tháng này, ngày 21 đã sang kỳ sau.
     Kiểm thẳng schedMonthOf() — todayIso() là const nên không giả lập được,
     mà cũng không cần: perCheckRollover() chỉ so hai giá trị của nó. */
  ok(vm.runInContext(`schedMonthOf('2026-08-20')`,sb)==='2026-08','G 20/08 còn thuộc kỳ T8');
  ok(vm.runInContext(`schedMonthOf('2026-08-21')`,sb)==='2026-09','G 21/08 đã sang kỳ T9');

  /* G1 — vẫn trong cùng kỳ: người dùng đang lật xem kỳ T5 để tra cứu, app
     KHÔNG được giật lại. */
  vm.runInContext(`
    repYm='2026-05'; asYm='2026-05'; myStatYm='2026-05'; evYm='2026-05'; trYm='2026-05';
    _perWatch=curSchedMonth();
  `,sb);
  ok(vm.runInContext('perCheckRollover()',sb)===false,'G1 cùng kỳ → KHÔNG can thiệp');
  ok(vm.runInContext('repYm',sb)==='2026-05','G1 …kỳ người dùng đang lật xem vẫn nguyên');

  /* G2 — giả lập app mở từ kỳ trước rồi qua mốc 21: mốc app đang nhớ khác
     với kỳ hiện tại. */
  vm.runInContext(`_perWatch='2026-05';`,sb);
  ok(vm.runInContext('perCheckRollover()',sb)===true,'G2 qua kỳ mới → nhảy kỳ');
  ok(vm.runInContext('repYm',sb)===''&&vm.runInContext('asYm',sb)===''
     &&vm.runInContext('trYm',sb)==='','G2 …xoá biến nhớ kỳ của các màn');
  ok(vm.runInContext('_perWatch',sb)===vm.runInContext('curSchedMonth()',sb),
     'G2 mốc theo dõi cập nhật sang kỳ hiện tại',vm.runInContext('_perWatch',sb));
  ok(sb.__ctx.toasts.some(m=>/kỳ mới/.test(m)),'G2 có báo cho người dùng biết',
     sb.__ctx.toasts.slice(-1)[0]);
  ok(vm.runInContext('perCheckRollover()',sb)===false,'G2 gọi lại không nhảy lần hai');
}

/* ============================================================ */
head('H. Dựng giao diện — không nổ, không lọt biến rỗng');
{
  const sb=build({me:'ad',secr:true});
  const r=call(sb,'trSave',[baseTr({mode:'ot',timeIn:'17:00',timeOut:'20:00',noLunch:false})]);
  /* renderTrainMgr() ghi vào $('trBody') = null → thoát sớm. Nên gọi thẳng
     các hàm DỰNG CHUỖI để thật sự chạy qua mọi nhánh template. */
  const list=call(sb,'trListHtml',[]);
  ok(/An toan hoa chat/.test(list),'H danh sách buổi có tên buổi');
  ok(!/undefined/.test(list),'H …không lọt chuỗi "undefined"');
  ok(/tr-it/.test(list),'H dùng đúng lớp CSS .tr-it');

  const ppl=call(sb,'trPeopleHtml',[]);
  ok(/tr-people/.test(ppl)&&!/undefined/.test(ppl),'H danh sách người dựng được');

  vm.runInContext(`trSel={'2026-08-24':1};`,sb);
  const mini=call(sb,'trMiniCal',[]);
  ok(/ev-mini/.test(mini)&&!/undefined/.test(mini),'H lịch nhỏ chọn ngày dựng được');

  const ban=call(sb,'trBannerHtml',[['2026-08-24'],'e1']);
  ok(/tr-b/.test(ban)&&/An toan hoa chat/.test(ban),'H dải nhắc dựng được cho đúng người');
  ok(call(sb,'trBannerHtml',[['2026-08-24'],'e3'])==='','H …và rỗng với người không đi học');

  ok(/🎓/.test(call(sb,'trCellTitle',['e1','2026-08-24'])),'H tooltip ô lịch có nội dung');
  ok(call(sb,'trPendingCount',[])===0,'H không có buổi nào chờ duyệt');

  const sb2=build({me:'e1',secr:false});
  call(sb2,'trSave',[baseTr({emps:['e1']})]);
  vm.runInContext(`globalThis.__me='ad';secr=true;mgr=true;adm=true;`,sb2);
  ok(call(sb2,'trPendingCount',[])===1,'H đếm đúng 1 buổi chờ duyệt');
  ok(/CH.\u1eda DUY.\u1ec6T|CHỜ DUYỆT/.test(call(sb2,'trListHtml',[])),'H danh sách gắn nhãn CHỜ DUYỆT');
}

/* ============================================================ */
head('I. ★ v7.1 — Trong ca hay tăng ca, theo TỪNG NGƯỜI TỪNG NGÀY');
{
  /* Dựng đúng ví dụ nghiệp vụ: 18 là R (nghỉ ca) → học là tăng ca;
     19 là O (hành chính) → học trong giờ làm. */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`
    S.base.e1={'2026-08-18':'R','2026-08-19':'O'};
    S.base.e2={'2026-08-18':'R','2026-08-19':'O'};
    S.base.e3={'2026-08-18':'N','2026-08-19':'N'};
  `,sb);
  const D2=['2026-08-18','2026-08-19'];
  const auto={title:'An toan',days:D2,emps:['e1','e2'],mode:'auto',
              timeIn:'08:00',timeOut:'17:00',notify:true};

  ok(call(sb,'trModeFor',[auto,'e1','2026-08-18'])==='ot',
     'I1 ★ 18 là R → tăng ca');
  ok(call(sb,'trModeFor',[auto,'e1','2026-08-19'])==='shift',
     'I1 ★ 19 là O, giờ học 08–17 nằm trọn trong ca → trong ca');

  /* Giờ học TRÀN RA ngoài ca O (08–17) thì dù đang trực vẫn là tăng ca */
  const late=Object.assign({},auto,{timeIn:'17:00',timeOut:'20:00'});
  ok(call(sb,'trModeFor',[late,'e1','2026-08-19'])==='ot',
     'I2 ★ đang trực ca O mà học 17–20 → tràn ra ngoài ca → tăng ca');

  /* Ca đêm: học lúc 22:00–23:00 là đang giữa ca N → trong ca */
  const night=Object.assign({},auto,{emps:['e3'],timeIn:'22:00',timeOut:'23:00'});
  ok(call(sb,'trModeFor',[night,'e3','2026-08-18'])==='shift',
     'I3 ca đêm N, học 22:00–23:00 → vẫn trong ca');
  const night2=Object.assign({},night,{timeIn:'13:00',timeOut:'15:00'});
  ok(call(sb,'trModeFor',[night2,'e3','2026-08-18'])==='ot',
     'I3 ca đêm N, học 13:00–15:00 (đang ngủ) → tăng ca');

  /* CÙNG MỘT NGÀY, hai người khác ca → hai kết luận khác nhau */
  vm.runInContext(`S.base.e2['2026-08-18']='O';`,sb);
  const mix=Object.assign({},auto,{emps:['e1','e2']});
  ok(call(sb,'trModeFor',[mix,'e1','2026-08-18'])==='ot'
   &&call(sb,'trModeFor',[mix,'e2','2026-08-18'])==='shift',
     'I4 ★ cùng ngày, e1 đang R → tăng ca, e2 đang O → trong ca');
  ok(call(sb,'trDayMode',[mix,'2026-08-18'])==='mix','I4 ngày đó được gắn nhãn "mix"');
}
{
  /* Đơn OT chỉ gồm những ngày TĂNG CA CỦA CHÍNH NGƯỜI ĐÓ */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`
    S.base.e1={'2026-08-18':'R','2026-08-19':'O'};
    S.base.e2={'2026-08-18':'O','2026-08-19':'O'};
  `,sb);
  const r=call(sb,'trSave',[{title:'An toan',days:['2026-08-18','2026-08-19'],
    emps:['e1','e2'],mode:'auto',timeIn:'08:00',timeOut:'17:00',notify:true}]);
  ok(r.ok,'I5 lưu được buổi chế độ tự động');
  const reqs=Object.values(sb.__ctx.S.requests);
  ok(reqs.length===1,'I5 ★ chỉ e1 có đơn — e2 hai ngày đều trong ca nên KHÔNG đẻ đơn rỗng',reqs.length);
  ok(reqs[0].empId==='e1','I5 đơn đúng của e1',reqs[0].empId);
  ok(reqs[0].days.length===1&&reqs[0].days[0].iso==='2026-08-18',
     'I5 ★ đơn CHỈ có ngày 18, không kèm ngày 19 (hôm đó anh ta đang trực)',
     JSON.stringify(reqs[0].days.map(d=>d.iso)));
  ok(reqs[0].days[0].hours===9,'I5 08:00–17:00 không trừ trưa → 9 giờ đồng hồ',reqs[0].days[0].hours);
  ok(reqs[0].days[0].code==='OTO','I5 mã đơn là OTO',reqs[0].days[0].code);
}
{
  /* Ép tay theo NGÀY thắng suy đoán của app */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'O','2026-08-19':'O'};`,sb);
  const base={title:'An toan',days:['2026-08-18','2026-08-19'],emps:['e1'],
              mode:'auto',timeIn:'08:00',timeOut:'17:00',notify:true};
  ok(call(sb,'trOtPairs',[base]).length===0,'I6 tự động: cả 2 ngày đều trong ca → 0 cặp tăng ca');

  const forced=Object.assign({},base,{dayMode:{'2026-08-18':'ot'}});
  const p=call(sb,'trOtPairs',[forced]);
  ok(p.length===1&&p[0].iso==='2026-08-18','I6 ★ ép tay ngày 18 → đúng 1 cặp tăng ca',JSON.stringify(p));
  ok(call(sb,'trModeFor',[forced,'e1','2026-08-19'])==='shift','I6 ngày không ép vẫn theo tự động');

  /* Ép cả buổi vẫn thắng tự động, và ép NGÀY thắng ép cả buổi */
  const all=Object.assign({},base,{mode:'ot',dayMode:{'2026-08-19':'shift'}});
  ok(call(sb,'trModeFor',[all,'e1','2026-08-18'])==='ot','I7 ép cả buổi = tăng ca');
  ok(call(sb,'trModeFor',[all,'e1','2026-08-19'])==='shift','I7 ★ ép theo NGÀY thắng ép cả buổi');
}
{
  /* Ép tay của ngày ĐÃ BỎ CHỌN không được sống lại */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'O','2026-08-19':'O'};`,sb);
  const r=call(sb,'trSave',[{title:'An toan',days:['2026-08-18'],emps:['e1'],
    mode:'auto',dayMode:{'2026-08-18':'ot','2026-08-19':'ot'},
    timeIn:'08:00',timeOut:'17:00',notify:true}]);
  const saved=sb.__ctx.S.trainings[r.id];
  ok(Object.keys(saved.dayMode).join(',')==='2026-08-18',
     'I8 ★ ép tay của ngày không còn được chọn bị loại khi lưu',Object.keys(saved.dayMode).join(','));
}
{
  /* ★ v7.2 — GIỜ HỌC LUÔN BẮT BUỘC, kể cả buổi hoàn toàn trong ca. Bản v7.1
     chỉ đòi giờ khi có phần tăng ca; nay số giờ còn phải vào cột báo cáo nên
     ngày nào cũng phải có. */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'O'};`,sb);
  const bad=call(sb,'trSave',[{title:'An toan',days:['2026-08-18'],emps:['e1'],
    mode:'shift',notify:true}]);
  ok(!bad.ok,'I9 ★ buổi trong ca mà thiếu giờ cũng bị chặn',bad.err);

  const r=call(sb,'trSave',[{title:'An toan',days:['2026-08-18'],emps:['e1'],
    mode:'shift',timeIn:'08:00',timeOut:'12:00',notify:true}]);
  ok(r.ok,'I9 khai giờ rồi thì lưu được',r.err);
  ok(Object.keys(sb.__ctx.S.requests).length===0,'I9 …và trong ca thì không đơn nào');

  /* Khung giờ ra 0 giờ phải chặn */
  const z=call(sb,'trSave',[{title:'An toan',days:['2026-08-19'],emps:['e1'],
    mode:'shift',timeIn:'12:00',timeOut:'13:00',noLunch:true,notify:true}]);
  ok(!z.ok,'I9 khai 12:00–13:00 rồi tích trừ trưa → 0 giờ → chặn',z.err);
}

/* ============================================================ */
head('J. Mã OTO — tăng ca ca hành chính');
{
  const sb=build({me:'ad',secr:true});
  const codes=call(sb,'allCodes',[]);
  const oto=codes.find(c=>c.c==='OTO');
  ok(!!oto&&oto.cat==='ot','J1 OTO có trong danh sách, thuộc nhóm tăng ca');
  ok(call(sb,'getHours',['OTO'])===8,'J1 OTO = 8 giờ (khác OTD 12 giờ)',call(sb,'getHours',['OTO']));
  const pv=call(sb,'otPreset',['OTO']);
  ok(pv&&pv.from==='08:00'&&pv.to==='17:00','J2 mẫu giờ OTO = 08:00–17:00',
     pv&&(pv.from+'–'+pv.to));
  ok(codes.filter(c=>c.cat==='ot').some(c=>c.c==='OTO'),
     'J3 lọt vào form đơn tăng ca (dsCodesFor lọc theo cat)');
  ok(/OTO:'OT 08:00–17:00'/.test(rd('21-notify.js')),'J4 có bản dịch tiếng Anh cho Zalo');
  ok(/code==='OTO'/.test(rd('08-requests.js')),'J4 baseShiftOf quy OTO về ca O');
  ok(/OTO:'#CFEFDF'/.test(rd('06-calendar.js')),'J4 có màu trong bảng lịch');

  /* Mã OTO được suy ra từ KHUNG GIỜ, không phải chọn tay: 08–17h nằm gọn
     trong giờ hành chính → OTO. */
  const sb2=build({me:'ad',secr:true});
  ok(call(sb2,'trOtCodeFor',['08:00','17:00',false])==='OTO','J5 08–17h → OTO');
  ok(call(sb2,'trOtCodeFor',['08:00','12:00',false])==='OTO','J5 nửa buổi sáng cũng nằm trong giờ HC → OTO');
  ok(call(sb2,'trOtCodeFor',['17:00','20:00',false])==='OT3','J5 17–20h → OT3');
  ok(call(sb2,'trOtCodeFor',['08:00','20:00',false])==='OTD','J5 08–20h → OTD');
  ok(call(sb2,'trOtCodeFor',['20:00','08:00',true])==='OTN','J5 qua đêm → OTN');
}

/* ============================================================ */
head('K. Giao diện mới — bảng từng ngày & thẻ người');
{
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`
    S.base.e1={'2026-08-18':'R','2026-08-19':'O'};
    S.base.e2={'2026-08-18':'O','2026-08-19':'O'};
    trSel={'2026-08-18':1,'2026-08-19':1};
    trPick={e1:1,e2:1};
    trMode='auto'; trSetPreset('full',true);
  `,sb);
  const dh=call(sb,'trDaysHtml',[]);
  ok(/tr-days/.test(dh)&&!/undefined/.test(dh),'K1 bảng từng ngày dựng được');
  ok(/18\/08/.test(dh)&&/19\/08/.test(dh),'K1 có đủ hai ngày');
  ok(/trSetDayMode\('2026-08-18'/.test(dh),'K1 có nút ép tay cho từng ngày');

  const ph=call(sb,'trPeopleHtml',[]);
  ok(/tr-people/.test(ph)&&!/undefined/.test(ph),'K2 thẻ người dựng được');
  ok(/NGUYEN VAN A/.test(ph),'K2 ★ hiện TÊN ĐẦY ĐỦ, không rút gọn / cắt cụt');
  ok(/class="dy ot"/.test(ph)&&/class="dy shift"/.test(ph),
     'K2 ★ mỗi ngày trên thẻ được tô theo kết luận (ot / shift)');

  const draft=call(sb,'trDraft',[]);
  ok(call(sb,'trOtPairs',[draft]).length===1,'K3 bản nháp và bản lưu dùng chung một phép tính');
  ok(call(sb,'trOtTotalHours',[draft])===8,'K3 tổng giờ xem trước = 8h (cả ngày 08–17 trừ trưa)',
     call(sb,'trOtTotalHours',[draft]));
}

/* ============================================================ */
head('L. ★ v7.2 — Giờ học khai riêng từng ngày');
{
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'O','2026-08-19':'O','2026-08-20':'O'};`,sb);
  /* Khoá 3 ngày: ngày 1 cả ngày, ngày 2 buổi sáng, ngày 3 hai tiếng */
  const tr={title:'Khoa 3 ngay',days:['2026-08-18','2026-08-19','2026-08-20'],emps:['e1'],
    mode:'shift',timeIn:'08:00',timeOut:'17:00',noLunch:true,
    dayTime:{'2026-08-19':{from:'08:00',to:'12:00'},
             '2026-08-20':{from:'14:00',to:'16:00'}},notify:true};
  ok(call(sb,'trHoursOfDay',[tr,'2026-08-18'])===8,'L1 ngày không khai riêng → theo giờ chung 08–17 trừ trưa = 8h',
     call(sb,'trHoursOfDay',[tr,'2026-08-18']));
  ok(call(sb,'trHoursOfDay',[tr,'2026-08-19'])===4,'L1 ★ ngày 2 khai riêng buổi sáng → 4h',
     call(sb,'trHoursOfDay',[tr,'2026-08-19']));
  ok(call(sb,'trHoursOfDay',[tr,'2026-08-20'])===2,'L1 ★ ngày 3 chỉ hai tiếng → 2h',
     call(sb,'trHoursOfDay',[tr,'2026-08-20']));
  ok(call(sb,'trHoursOfEmp',[tr,'e1'])===14,'L1 tổng cả khoá = 8+4+2 = 14h',call(sb,'trHoursOfEmp',[tr,'e1']));
  ok(call(sb,'trHasOwnTime',[tr,'2026-08-19'])===true
   &&call(sb,'trHasOwnTime',[tr,'2026-08-18'])===false,'L1 phân biệt được ngày nào khai riêng');
  ok(/08:00–12:00 · 4h/.test(call(sb,'trTimeLabelOf',[tr,'2026-08-19'])),
     'L1 nhãn ngày ghi cả khung giờ lẫn số giờ',call(sb,'trTimeLabelOf',[tr,'2026-08-19']));
}
{
  /* Giờ riêng đổi luôn KẾT LUẬN trong ca / tăng ca của ngày đó */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'O','2026-08-19':'O'};`,sb);
  const tr={title:'X',days:['2026-08-18','2026-08-19'],emps:['e1'],mode:'auto',
    timeIn:'08:00',timeOut:'12:00',
    dayTime:{'2026-08-19':{from:'18:00',to:'20:00'}},notify:true};
  ok(call(sb,'trModeFor',[tr,'e1','2026-08-18'])==='shift','L2 ngày 1 học 08–12 trong ca O → trong ca');
  ok(call(sb,'trModeFor',[tr,'e1','2026-08-19'])==='ot',
     'L2 ★ ngày 2 khai riêng 18–20 → ra ngoài ca O → tăng ca');
}
{
  /* Đơn tăng ca lấy giờ CỦA CHÍNH NGÀY ĐÓ, mã OT suy từ khung giờ đó */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'R','2026-08-19':'R'};`,sb);
  const r=call(sb,'trSave',[{title:'Khoa',days:['2026-08-18','2026-08-19'],emps:['e1'],
    mode:'auto',timeIn:'08:00',timeOut:'17:00',noLunch:true,
    dayTime:{'2026-08-19':{from:'13:00',to:'17:00'}},notify:true}]);
  ok(r.ok,'L3 lưu được buổi có giờ riêng',r.err);
  const d=Object.values(sb.__ctx.S.requests)[0].days;
  ok(d.length===2,'L3 đơn có 2 dòng',d.length);
  ok(d[0].hours===8&&d[1].hours===4,'L3 ★ mỗi dòng đúng giờ của ngày đó: 8h và 4h',
     d.map(x=>x.hours).join('/'));
  ok(d[0].timeIn==='08:00'&&d[1].timeIn==='13:00','L3 giờ vào từng dòng khác nhau',
     d.map(x=>x.timeIn).join('/'));
  ok(d[0].code==='OTO'&&d[1].code==='OTO','L3 mã OT suy từ khung giờ (đều trong giờ HC → OTO)',
     d.map(x=>x.code).join('/'));
}
{
  /* Mẫu giờ học nhanh */
  const sb=build({me:'ad',secr:true});
  const P=vm.runInContext('TRAIN_PRESETS.map(p=>p.v).join(",")',sb);
  ok(P==='full,am,pm,','L4 có đủ 4 mẫu: cả ngày · sáng · chiều · tự điền',P);
  ok(call(sb,'trPresetOf',['am']).from==='08:00'&&call(sb,'trPresetOf',['am']).to==='12:00',
     'L4 mẫu buổi sáng = 08:00–12:00');
  ok(call(sb,'trPresetOf',['pm']).from==='13:00'&&call(sb,'trPresetOf',['pm']).to==='17:00',
     'L4 mẫu buổi chiều = 13:00–17:00');
  ok(call(sb,'trPresetOf',['full']).noLunch===1,'L4 mẫu cả ngày tự trừ 1 giờ trưa');
  ok(call(sb,'trPresetMatch',['13:00','17:00'])==='pm','L4 nhận ra mẫu đang dùng từ khung giờ');
  /* Đặt giờ riêng rồi bỏ về giờ chung */
  vm.runInContext(`trSel={'2026-08-18':1};trTimeIn='08:00';trTimeOut='17:00';trDayT={};
    trSetDayPreset('2026-08-18','am');`,sb);
  ok(vm.runInContext(`trDayT['2026-08-18'].from`,sb)==='08:00'
   &&vm.runInContext(`trDayT['2026-08-18'].to`,sb)==='12:00','L4 bấm mẫu ở dòng ngày → ghi giờ riêng');
  vm.runInContext(`trSetDayPreset('2026-08-18','');`,sb);
  ok(vm.runInContext(`trDayT['2026-08-18']===undefined`,sb),'L4 chọn "Theo giờ chung" → xoá giờ riêng');
  /* Bỏ ngày thì giờ riêng của nó cũng đi theo */
  vm.runInContext(`trSetDayPreset('2026-08-18','pm');trToggleDay('2026-08-18');`,sb);
  ok(vm.runInContext(`trDayT['2026-08-18']===undefined`,sb),'L4 ★ bỏ chọn ngày → giờ riêng của nó biến mất');
}
{
  /* Giờ riêng của ngày đã bỏ chọn không được lưu xuống */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'O'};`,sb);
  const r=call(sb,'trSave',[{title:'X',days:['2026-08-18'],emps:['e1'],mode:'shift',
    timeIn:'08:00',timeOut:'17:00',
    dayTime:{'2026-08-18':{from:'08:00',to:'12:00'},'2026-08-19':{from:'08:00',to:'10:00'}},
    notify:true}]);
  ok(Object.keys(sb.__ctx.S.trainings[r.id].dayTime).join(',')==='2026-08-18',
     'L5 ★ giờ riêng của ngày không còn được chọn bị loại khi lưu',
     Object.keys(sb.__ctx.S.trainings[r.id].dayTime).join(','));
}

{
  /* Cờ trừ trưa phải RƠI khi khung giờ không còn phủ trưa — cùng luật v6.9 của
     đơn tăng ca. Nếu không, người xếp thấy ô đang tích mà số giờ không trừ. */
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`S.base.e1={'2026-08-18':'O'};
    trSel={'2026-08-18':1};trPick={e1:1};trSetPreset('full',true);trDayT={};`,sb);
  ok(vm.runInContext('trNoLunch',sb)===true,'L6 mẫu cả ngày → cờ trừ trưa bật');
  vm.runInContext(`trSetDayPreset('2026-08-18','full');`,sb);
  ok(vm.runInContext(`trDayT['2026-08-18'].noLunch`,sb)===true,'L6 ngày khai riêng cả ngày → giữ cờ');
  vm.runInContext(`trSetDayTime('2026-08-18','to','12:00');`,sb);
  ok(vm.runInContext(`trDayT['2026-08-18'].noLunch`,sb)===false,
     'L6 ★ sửa giờ ra còn 12:00 (hết phủ trưa) → cờ trừ trưa tự rơi');
  ok(call(sb,'trHoursOfDay',[call(sb,'trDraft',[]),'2026-08-18'])===4,
     'L6 …nên ra đúng 4h, không phải 3h',call(sb,'trHoursOfDay',[call(sb,'trDraft',[]),'2026-08-18']));
  /* Lưu xuống cũng phải sạch cờ vô nghĩa */
  const r=call(sb,'trSave',[{title:'X',days:['2026-08-18'],emps:['e1'],mode:'shift',
    timeIn:'08:00',timeOut:'17:00',
    dayTime:{'2026-08-18':{from:'13:00',to:'17:00',noLunch:true}},notify:true}]);
  ok(sb.__ctx.S.trainings[r.id].dayTime['2026-08-18'].noLunch===false,
     'L6 ★ lưu xuống cũng loại cờ trừ trưa vô nghĩa (13–17h không phủ trưa)');
}

/* ============================================================ */
head('M. Cột "Giờ đào tạo" ở báo cáo');
{
  const sb=build({me:'ad',secr:true});
  vm.runInContext(`
    S.base.e1={'2026-08-18':'O','2026-08-19':'R'};
    S.base.e2={'2026-08-18':'O','2026-08-19':'O'};
    /* calcStats ở js/10-account.js — chép nguyên văn phần cần kiểm */
    function effHours(id,iso){return getHours(eff(id,iso).code);}
    function calcStats(id,days){
      var cnt={},hWork=0,hOT=0,hLeave=0,hTrain=0;
      days.forEach(function(iso){
        if(typeof trHoursFor==='function')hTrain+=trHoursFor(id,iso);
        var c=eff(id,iso).code;if(!c)return;
        cnt[c]=(cnt[c]||0)+1;
        var cat=codeInfo(c).cat,h=effHours(id,iso);
        if(cat==='work'||cat==='swap')hWork+=h;
        else if(cat==='ot')hOT+=h;
        else if(cat==='leave')hLeave+=h;
      });
      return{cnt:cnt,hWork:hWork,hOT:hOT,hLeave:hLeave,hTrain:Math.round(hTrain*10)/10};
    }
  `,sb);
  /* e1: ngày 18 học trong ca 4h, ngày 19 đang R nên học là tăng ca 8h */
  call(sb,'trSave',[{title:'Khoa',days:['2026-08-18','2026-08-19'],emps:['e1'],mode:'auto',
    timeIn:'08:00',timeOut:'17:00',noLunch:true,
    dayTime:{'2026-08-18':{from:'08:00',to:'12:00'}},notify:true}]);
  const days=['2026-08-18','2026-08-19'];
  const s1=vm.runInContext(`calcStats('e1',${JSON.stringify(days)})`,sb);
  const s2=vm.runInContext(`calcStats('e2',${JSON.stringify(days)})`,sb);
  ok(s1.hTrain===12,'M1 ★ giờ đào tạo của e1 = 4 (ngày 18) + 8 (ngày 19) = 12h',s1.hTrain);
  ok(s2.hTrain===0,'M1 người không đi học → 0 giờ đào tạo',s2.hTrain);
  ok(s1.hWork===8,'M2 ★ giờ CÔNG không bị cộng thêm giờ đào tạo (chỉ ca O ngày 18 = 8h)',s1.hWork);
  ok(s1.hOT===0,'M2 ★ giờ OT cũng KHÔNG bị cộng — đơn tăng ca đi luồng riêng',s1.hOT);

  /* Bản chờ duyệt chưa tính vào báo cáo */
  const sb2=build({me:'e1',secr:false});
  vm.runInContext(`S.base.e1={'2026-08-18':'O'};`,sb2);
  call(sb2,'trSave',[{title:'X',days:['2026-08-18'],emps:['e1'],mode:'shift',
    timeIn:'08:00',timeOut:'12:00',notify:true}]);
  ok(call(sb2,'trHoursFor',['e1','2026-08-18'])===0,
     'M3 ★ buổi chờ duyệt chưa tính vào giờ đào tạo');
  vm.runInContext(`globalThis.__me='ad';secr=true;mgr=true;adm=true;`,sb2);
  call(sb2,'trApprove',[Object.keys(sb2.__ctx.S.trainings)[0]]);
  ok(call(sb2,'trHoursFor',['e1','2026-08-18'])===4,'M3 duyệt xong mới tính',
     call(sb2,'trHoursFor',['e1','2026-08-18']));

  /* Cột đã có mặt trong bảng và Excel */
  ok(/l:'Giờ đào tạo'/.test(rd('15-report.js')),'M4 cột trong bảng công tổng hợp');
  ok(/'Giờ đào tạo'\]\]/.test(rd('11-stats-data.js')),'M4 cột trong file Excel xuất ra');
  ok(/hTrain\+=trHoursFor/.test(rd('10-account.js')),'M4 calcStats có tính hTrain');
}

console.log('\n════════════════════════════════════');
console.log((fail?'✗ HỎNG '+fail+' / ':'✓ ĐẠT HẾT ')+(pass+fail)+' bài');
console.log('════════════════════════════════════');
process.exit(fail?1:0);
