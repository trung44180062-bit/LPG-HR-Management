/* ============================================================
   HARNESS v7.8 — KHOÁ ĐÀO TẠO · LOẠI SỰ KIỆN · MẶC ĐỊNH IN · HR
   ------------------------------------------------------------
   Chạy:  node _test/course-v78-harness.js
   ------------------------------------------------------------
   A. Mặc định in theo loại đơn (js/08-requests.js)
      A1 'multi' và 'swap' vào hàng CHỜ IN
      A2 mọi loại còn lại (kể cả 'wt' cũ) mặc định KHÔNG cần in

   B. HR chỉ hai trạng thái (js/08-requests.js)
      B1 danh sách chip đúng 3 mục: mọi đơn / chưa lên HR / đã lên HR
      B2 mã lọc 'todo' cũ được quy về 'no', không rơi thành "không lọc"

   C. Loại sự kiện (js/20-events.js)
      C1 loại dựng sẵn có đủ VLGC / internal / external / maintenance / audit
      C2 lưu sự kiện thì ghi ev.cat; thiếu cat thì đọc ra "Khác"
      C3 loại TỰ THÊM sống nhờ chính sự kiện dùng nó (evCatAll thấy nó)
      C4 loại tự thêm biến mất khi không còn sự kiện nào dùng
      C5 bảng lọc theo loại và theo kỳ
      C6 tin thông báo mang nhãn loại

   D. Khoá đào tạo (js/23-course.js)
      D1 coSave đòi tên khoá
      D2 buổi gắn courseId → coSessions thấy, xếp theo ngày
      D3 coEmps = người khai ở khoá HỢP người có trong các buổi
      D4 courseId trỏ vào khoá không tồn tại thì bị xoá khi lưu buổi
      D5 xoá khoá KHÔNG xoá buổi — buổi trở thành buổi lẻ
      D6 trFullTitle = "tên khoá · tên buổi"; buổi lẻ giữ nguyên tên
      D7 ghi chú đơn tăng ca mang tên khoá

   E. Bảng tích phân bổ người (js/23-course.js)
      E1 tích/bỏ tích chỉ sửa BẢN NHÁP, dữ liệu thật không đổi
      E2 coMxChanged đếm đúng số buổi có thay đổi
      E3 coMxMove: chuyển người sang một buổi = bỏ mọi buổi khác
      E4 coMxApply ghi thật qua trSave → danh sách người của buổi đổi
      E5 …và đơn tăng ca của buổi được tạo lại theo danh sách mới
      E6 buổi bị bỏ hết người thì KHÔNG lưu (báo lỗi, giữ nguyên bản cũ)
      E7 coMxReset trả bản nháp về đúng dữ liệu đã lưu

   F. Số liệu tổng hợp (js/23-course.js)
      F1 coHoursOfEmp cộng giờ qua các buổi người đó có mặt
      F2 coDaysAll / coDateLabel gom ngày của cả khoá
      F3 trInPeriod lọc buổi theo kỳ
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
  {id:'e1',name:'NGUYEN VAN A',pos:'operator', team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e2',name:'TRAN VAN B',  pos:'field_eng',team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e3',name:'LE VAN C',    pos:'boardman', team:'B',perm:'staff',active:true,shiftType:'shift'},
  {id:'ad',name:'QUAN TRI',    pos:'office',   team:'', perm:'admin',active:true,shiftType:'none'}
];

/* ------------------------------------------------------------
   Sandbox — nạp THẬT js/01-core.js · 04-schedule.js · 20-events.js ·
   22-training.js · 23-course.js. Không cắt lát file (bẫy v6.2).
   ------------------------------------------------------------ */
function build(){
  const sb={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>0,isNaN,parseInt,parseFloat};
  sb.globalThis=sb;sb.window=sb;
  sb.document={addEventListener:()=>{},querySelectorAll:()=>[],getElementById:()=>null,hidden:false};
  sb.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  vm.createContext(sb);

  vm.runInContext(`
    var __toasts=[], __saves=0, __zq=[], __confirm=true, __prompt='';
    var LANG='vi';
    function t(s){return s;}
    function t2(s){return s;}
    function toast(m){__toasts.push(String(m));}
    function confirm(){return __confirm;}
    function prompt(){return __prompt;}
    function alert(){}
    var rnd1=v=>Math.round(v*10)/10;
    function zaloEnqueue(n){__zq.push(n);}
    function newNotif(o){
      var id='n'+(Object.keys(S.notifs).length+1)+'_'+Math.random().toString(36).slice(2,6);
      S.notifs[id]=Object.assign({id:id,status:'pending',createdAt:Date.now()},o);
      zaloEnqueue(S.notifs[id]);return id;
    }
    function notifDrop(pred){
      var n=0;for(var k in S.notifs){var x=S.notifs[k];if(!x)continue;
        var hit=false;try{hit=!!pred(x);}catch(e){hit=false;}
        if(hit){delete S.notifs[k];n++;}}
      return n;
    }
    function notifyApprovers(){}
    function cancelReq(rid){delete S.requests[rid];return{reverted:0};}
    function defaultNoPrint(type){return type!=='multi'&&type!=='swap';}
    function teamList(){var s=[];(S.employees||[]).forEach(function(e){
      var x=e.team||'';if(s.indexOf(x)<0)s.push(x);});return s.sort();}
    function shortName(n){var w=String(n||'').trim().split(/\\s+/);return w.slice(-2).join(' ')||String(n||'');}
    function permOf(id){var e=(S.employees||[]).find(function(x){return x.id===id;});return (e&&e.perm)||'staff';}
    function save(cb){__saves++;S.rev=Date.now()+__saves;if(cb)cb(true);}
    function renderCal(){}function renderMe(){}function renderAppr(){}
    function renderEventMgr(){}function renderTrainMgr(){}function coRenderPeople(){}
    function fillMonthSelects(){}function refreshBadge(){}
    function mondayOf(iso){var d=new Date(iso+'T00:00:00');var k=(d.getDay()+6)%7;
      d.setDate(d.getDate()-k);return d.toISOString().slice(0,10);}
  `,sb);

  vm.runInContext(rd('01-core.js'),sb);
  vm.runInContext(`function addDaysIso(iso,n){var d=new Date(iso+'T00:00:00');
    d.setDate(d.getDate()+n);return isoOf(d);}`,sb);
  vm.runInContext(rd('04-schedule.js'),sb);
  vm.runInContext(`
    function baseShiftOf(code){
      var cb=(typeof comboOf==='function')&&comboOf(code);
      if(cb)code=cb.work;
      if(code==='D'||code==='SD'||code==='OTD')return 'D';
      if(code==='N'||code==='SN'||code==='OTN')return 'N';
      if(code==='O'||code==='SO'||code==='OTO')return 'O';
      return null;
    }
  `,sb);
  vm.runInContext(rd('20-events.js'),sb);
  vm.runInContext(rd('22-training.js'),sb);
  vm.runInContext(rd('23-course.js'),sb);
  /* core khai lại toast() (bản thật cần DOM) — dựng lại stub sau khi nạp */
  vm.runInContext(`function toast(m){__toasts.push(String(m));}`,sb);

  vm.runInContext(`
    S.employees=${JSON.stringify(EMPS)};
    S.base={};S.over={};S.requests={};S.notifs={};S.trainings={};S.courses={};S.del={};
    S.meta={schedFrom:'2026-07-21',schedTo:'2026-09-20'};S.rev=1;
    ['e1','e2','e3'].forEach(function(id){
      S.base[id]={};
      ['2026-08-24','2026-08-25','2026-08-26','2026-08-27'].forEach(function(iso){S.base[id][iso]='O';});
    });
    globalThis.__ctx={
      get S(){return S;}, get toasts(){return __toasts;},
      setMe:function(id){globalThis.__me=id;secr=true;mgr=true;adm=true;hrm=true;noSelf=false;}
    };
    function meId(){return globalThis.__me||'';}
  `,sb);
  sb.__ctx.setMe('ad');
  return sb;
}
function call(sb,fn,args){
  sb.__args=args||[];
  return vm.runInContext(`(function(){return ${fn}.apply(null,__args);})()`,sb);
}
const G=(sb,expr)=>vm.runInContext(expr,sb);

/* Buổi mẫu: 2 ngày, học trong ca (mọi người đang ca O) */
function baseTr(over){
  return Object.assign({
    title:'Buoi 1', place:'Phong hop 2', note:'',
    days:['2026-08-24','2026-08-25'], emps:['e1','e2'],
    mode:'shift', timeIn:'08:00', timeOut:'17:00', noLunch:true, notify:false
  },over||{});
}

/* ============================================================ */
head('A. Mặc định in theo loại đơn');
{
  const src=rd('08-requests.js');
  const m=src.match(/const REQ_MUST_PRINT=\[([^\]]*)\];/);
  const list=m?m[1].replace(/['"\s]/g,'').split(','):[];
  ok(list.includes('multi'),'A1 đơn làm nhiều ngày (multi) mặc định PHẢI in',list.join('|'));
  ok(list.includes('swap'),'A1 đơn đổi ca (swap) mặc định PHẢI in');
  ok(list.length===2,'A2 chỉ đúng hai loại đó',list.length);
  ok(!list.includes('wt'),'A2 đơn bổ sung công (wt) không còn bắt buộc in');
  ['leave','ot','change','late','wt'].forEach(k=>
    ok(!list.includes(k),'A2 '+k+' mặc định không cần in'));
}

head('B. HR chỉ hai trạng thái');
{
  const src=rd('08-requests.js');
  const chips=(src.match(/const hrChips=\[.*?\];/s)||[''])[0];
  ok(/'__all'/.test(chips)&&/'no'/.test(chips)&&/'yes'/.test(chips),'B1 còn 3 chip: mọi đơn / chưa / đã');
  ok(!/'todo'/.test(chips),'B1 chip "Cần nhập HR" đã bỏ');
  ok(/Ch(ư|u)a l(ê|e)n h(ệ|e) th(ố|o)ng HR/.test(chips),'B1 nhãn nói rõ "chưa lên hệ thống HR"');
  ok(/apprFilter\.hr==='todo'\)apprFilter\.hr='no'/.test(src.replace(/\s/g,'')
      .replace(/if\(/g,'if(')) || /todo'\)apprFilter\.hr='no'/.test(src.replace(/\s/g,'')),
    'B2 mã lọc todo cũ được quy về "no"');
}

head('C. Loại sự kiện');
{
  const sb=build();
  const cats=G(sb,'EV_CATS.map(c=>c.v).join(",")');
  ['vlgc','itrain','etrain','maint','audit'].forEach(k=>
    ok(cats.split(',').includes(k),'C1 có loại dựng sẵn '+k,cats));

  G(sb,`evSel={'2026-08-24':true,'2026-08-25':true};evTitle='Tau VLGC 08';
        evCat='vlgc';evScope='all';evNotify=true;evSave();`);
  const ev1=G(sb,'Object.values(S.events)[0]');
  ok(ev1&&ev1.cat==='vlgc','C2 lưu ev.cat',ev1&&ev1.cat);
  ok(G(sb,`evCatInfo('').l`)==='Khác','C2 thiếu cat thì đọc ra "Khác"');
  ok(G(sb,`evCatInfo('vlgc').ic`)==='🚢','C2 icon theo loại');

  /* loại tự thêm */
  G(sb,`evEditId='';evSel={'2026-08-27':true};evTitle='Thay van';
        evCat='Thay van an toan';evScope='all';evNotify=false;evSave();`);
  ok(G(sb,`evCatAll().some(c=>c.v==='Thay van an toan')`),'C3 loại tự thêm hiện trong danh sách');
  ok(G(sb,`evCatInfo('Thay van an toan').custom===true`),'C3 …và được đánh dấu là loại tự thêm');
  const idCustom=G(sb,`Object.values(S.events).find(e=>e.cat==='Thay van an toan').id`);
  G(sb,`evDelete(${JSON.stringify(idCustom)})`);
  ok(!G(sb,`evCatAll().some(c=>c.v==='Thay van an toan')`),
     'C4 xoá sự kiện cuối dùng loại đó → loại tự biến mất');

  /* bảng: lọc theo loại & theo kỳ */
  G(sb,`evEditId='';evSel={'2026-08-26':true};evTitle='Bao duong bom';
        evCat='maint';evScope='all';evNotify=false;evSave();`);
  G(sb,`evTblCat='__all';evTblYm='__all';`);
  ok(G(sb,'evTableRows().length')===2,'C5 bảng thấy cả 2 sự kiện',G(sb,'evTableRows().length'));
  G(sb,`evTblSet('cat','maint')`);
  ok(G(sb,'evTableRows().length')===1,'C5 lọc theo loại');
  ok(G(sb,'evTableRows()[0].title')==='Bao duong bom','C5 …đúng sự kiện');
  /* Kỳ công chạy 21 tháng trước → 20 tháng này, nên 24/08 và 26/08 thuộc
     KỲ 2026-09, không phải 2026-08. Đây đúng là chỗ hay nhầm khi đọc bảng. */
  G(sb,`evTblSet('cat','__all');evTblSet('ym','2026-08')`);
  ok(G(sb,'evTableRows().length')===0,'C5 lọc theo kỳ (kỳ 8 = 21/07→20/08, không có sự kiện nào)');
  G(sb,`evTblSet('ym','2026-09')`);
  ok(G(sb,'evTableRows().length')===2,'C5 kỳ 9 (21/08→20/09) thấy đủ 2 sự kiện');

  const txt=G(sb,`Object.values(S.notifs).filter(x=>x.kind==='event').map(x=>x.text).join('|')`);
  ok(/VLGC unloading/.test(txt),'C6 tin thông báo mang nhãn loại',txt.slice(0,60));
}

head('D. Khoá đào tạo');
{
  const sb=build();
  ok(!call(sb,'coSave',[{title:'  '}]).ok,'D1 coSave đòi tên khoá');
  const c=call(sb,'coSave',[{title:'An toan hoa chat 2026',kind:'external',
                             org:'TT Kiem dinh 3',emps:['e1','e2','e3']}]);
  ok(c.ok,'D1 khai khoá được');
  const cid=c.id;

  const r1=call(sb,'trSave',[baseTr({courseId:cid,title:'Buoi 1',days:['2026-08-24'],emps:['e1','e2']})]);
  const r2=call(sb,'trSave',[baseTr({courseId:cid,title:'Buoi 2',days:['2026-08-26'],emps:['e3']})]);
  ok(r1.ok&&r2.ok,'D2 xếp 2 buổi cho khoá');
  sb.__cid=cid;
  ok(G(sb,'coSessions(__cid).length')===2,'D2 coSessions thấy đủ 2 buổi');
  ok(G(sb,'coSessions(__cid)[0].title')==='Buoi 1','D2 xếp theo ngày học đầu tiên');
  ok(G(sb,'coEmps(__cid).join(",")')==='e1,e2,e3','D3 học viên khoá = khai + có trong buổi',
     G(sb,'coEmps(__cid).join(",")'));

  const rBad=call(sb,'trSave',[baseTr({courseId:'khong-co-that',title:'Buoi le'})]);
  ok(rBad.ok&&!G(sb,`S.trainings[${JSON.stringify(rBad.id)}].courseId`),
     'D4 courseId trỏ vào khoá không có thật bị bỏ');

  ok(G(sb,`trFullTitle(S.trainings[${JSON.stringify(r1.id)}])`)==='An toan hoa chat 2026 · Buoi 1',
     'D6 trFullTitle ghép tên khoá và tên buổi');
  ok(G(sb,`trFullTitle(S.trainings[${JSON.stringify(rBad.id)}])`)==='Buoi le',
     'D6 buổi lẻ giữ nguyên tên');

  /* D7 — ghi chú đơn OT mang tên khoá (buổi ngoài ca để chắc chắn có đơn) */
  const rOt=call(sb,'trSave',[baseTr({courseId:cid,title:'Buoi 3',days:['2026-08-30'],
                                      emps:['e1'],mode:'ot'})]);
  sb.__rot=rOt.id;
  const note=G(sb,'Object.values(S.requests).filter(r=>r.trId===__rot).map(r=>r.note).join("|")');
  ok(/An toan hoa chat 2026 · Buoi 3/.test(note),'D7 ghi chú đơn tăng ca mang tên khoá',note);

  /* D5 — xoá khoá chỉ gỡ kẹp */
  const nTr=G(sb,'Object.keys(S.trainings).length');
  const del=call(sb,'coDelete',[cid]);
  ok(del.ok&&del.freed===3,'D5 xoá khoá gỡ 3 buổi',del.freed);
  ok(G(sb,'Object.keys(S.trainings).length')===nTr,'D5 số buổi KHÔNG đổi',nTr);
  ok(G(sb,`S.trainings[${JSON.stringify(r1.id)}].courseId`)==='','D5 buổi trở thành buổi lẻ');
  ok(!G(sb,'S.courses['+JSON.stringify(cid)+']'),'D5 khoá đã biến mất');
}

head('E. Bảng tích phân bổ người');
{
  const sb=build();
  const cid=call(sb,'coSave',[{title:'Khoa X',emps:['e1','e2','e3']}]).id;
  const a=call(sb,'trSave',[baseTr({courseId:cid,title:'B1',days:['2026-08-24'],emps:['e1','e2']})]).id;
  const b=call(sb,'trSave',[baseTr({courseId:cid,title:'B2',days:['2026-08-26'],emps:['e3']})]).id;
  sb.__cid=cid;sb.__a=a;sb.__b=b;

  G(sb,'coOpenMatrix(__cid)');
  ok(G(sb,'coMxHas(__a,"e1")')===true,'E1 nháp nạp đúng từ dữ liệu thật');
  G(sb,'coMxToggle(__a,"e1")');
  ok(G(sb,'coMxHas(__a,"e1")')===false,'E1 bỏ tích trên nháp');
  ok(G(sb,'trEmps(S.trainings[__a]).includes("e1")')===true,'E1 dữ liệu thật CHƯA đổi');
  ok(G(sb,'coMxChanged(__cid).length')===1,'E2 đếm đúng 1 buổi có thay đổi');

  G(sb,'coMxReset()');
  ok(G(sb,'coMxHas(__a,"e1")')===true&&G(sb,'coMxChanged(__cid).length')===0,
     'E7 coMxReset trả nháp về đúng bản đã lưu');

  /* E3 — chuyển e1 sang buổi B2 */
  G(sb,'coMxMove("e1",__b)');
  ok(G(sb,'coMxHas(__a,"e1")')===false&&G(sb,'coMxHas(__b,"e1")')===true,
     'E3 chuyển người = bỏ mọi buổi khác, chỉ giữ buổi đích');
  ok(G(sb,'coMxChanged(__cid).length')===2,'E2 hai buổi cùng đổi');

  G(sb,'coMxApply()');
  ok(G(sb,'trEmps(S.trainings[__a]).join(",")')==='e2','E4 buổi B1 còn e2',
     G(sb,'trEmps(S.trainings[__a]).join(",")'));
  ok(G(sb,'trEmps(S.trainings[__b]).sort().join(",")')==='e1,e3','E4 buổi B2 có e1 và e3',
     G(sb,'trEmps(S.trainings[__b]).sort().join(",")'));
  ok(G(sb,'coMxChanged(__cid).length')===0,'E4 lưu xong thì nháp khớp dữ liệu thật');

  /* E5 — đơn tăng ca tạo lại theo danh sách mới (buổi ngoài ca) */
  const sb2=build();
  const cid2=call(sb2,'coSave',[{title:'Khoa OT',emps:['e1','e2']}]).id;
  const t1=call(sb2,'trSave',[baseTr({courseId:cid2,title:'BO',days:['2026-08-30'],
                                      emps:['e1'],mode:'ot'})]).id;
  sb2.__cid=cid2;sb2.__t1=t1;
  ok(G(sb2,'Object.values(S.requests).filter(r=>r.trId===__t1).map(r=>r.empId).join(",")')==='e1',
     'E5 ban đầu chỉ e1 có đơn tăng ca');
  G(sb2,'coOpenMatrix(__cid);coMxToggle(__t1,"e1");coMxToggle(__t1,"e2");coMxApply();');
  ok(G(sb2,'Object.values(S.requests).filter(r=>r.trId===__t1).map(r=>r.empId).join(",")')==='e2',
     'E5 đổi người → đơn tăng ca cũ gỡ, đơn mới cho e2',
     G(sb2,'Object.values(S.requests).filter(r=>r.trId===__t1).map(r=>r.empId).join(",")'));

  /* E6 — bỏ hết người khỏi một buổi thì không lưu được */
  G(sb2,'coMxToggle(__t1,"e2");coMxApply();');
  ok(G(sb2,'trEmps(S.trainings[__t1]).join(",")')==='e2',
     'E6 buổi trống không được lưu — danh sách cũ giữ nguyên',
     G(sb2,'trEmps(S.trainings[__t1]).join(",")'));
  ok(/không còn học viên/.test(sb2.__ctx.toasts.join('|')),'E6 …và có nhắc người dùng');
}

head('F. Số liệu tổng hợp');
{
  const sb=build();
  const cid=call(sb,'coSave',[{title:'Khoa H',emps:['e1']}]).id;
  call(sb,'trSave',[baseTr({courseId:cid,title:'H1',days:['2026-08-24'],emps:['e1'],
                            timeIn:'08:00',timeOut:'12:00',noLunch:false})]);
  call(sb,'trSave',[baseTr({courseId:cid,title:'H2',days:['2026-08-26'],emps:['e1'],
                            timeIn:'13:00',timeOut:'17:00',noLunch:false})]);
  sb.__cid=cid;
  ok(G(sb,'coHoursOfEmp(__cid,"e1")')===8,'F1 cộng giờ qua các buổi (4h + 4h)',
     G(sb,'coHoursOfEmp(__cid,"e1")'));
  ok(G(sb,'coHoursOfEmp(__cid,"e2")')===0,'F1 người không đi học → 0 giờ');
  ok(G(sb,'coDaysAll(__cid).join(",")')==='2026-08-24,2026-08-26','F2 gom ngày của cả khoá');
  ok(/24\/08/.test(G(sb,'coDateLabel(__cid)')),'F2 nhãn ngày của khoá',G(sb,'coDateLabel(__cid)'));
  ok(G(sb,'coDateLabel("khong-co")')==='chưa xếp buổi nào','F2 khoá chưa có buổi');
  /* 24/08 thuộc KỲ 2026-09 (kỳ chạy 21/08 → 20/09) — xem periodFor() */
  ok(G(sb,'trInPeriod(coSessions(__cid)[0],"2026-09")')===true,'F3 buổi 24/08 nằm trong kỳ 9');
  ok(G(sb,'trInPeriod(coSessions(__cid)[0],"2026-08")')===false,'F3 …không thuộc kỳ 8');
  ok(G(sb,'trInPeriod(coSessions(__cid)[0],"__all")')===true,'F3 "tất cả các kỳ" luôn khớp');
}

head('G. Dựng HTML (bảng & màn khoá)');
{
  const sb=build();
  const cid=call(sb,'coSave',[{title:'Khoa G',kind:'external',org:'TT3',emps:['e1','e2']}]).id;
  call(sb,'trSave',[baseTr({courseId:cid,title:'G1',days:['2026-08-24'],emps:['e1']})]);
  call(sb,'trSave',[baseTr({courseId:cid,title:'G2',days:['2026-08-26'],emps:['e2']})]);
  call(sb,'trSave',[baseTr({title:'Buoi le',days:['2026-08-27'],emps:['e3']})]);
  G(sb,`evSel={'2026-08-24':true};evTitle='Tau VLGC';evCat='vlgc';evScope='all';
        evNotify=false;evSave();`);
  sb.__cid=cid;

  const ev=G(sb,'evTableHtml()');
  ok(/ev-tbl/.test(ev)&&/Tau VLGC/.test(ev),'G1 bảng sự kiện dựng được');
  ok(/VLGC unloading/.test(ev),'G1 …có cột loại');

  G(sb,'coOpenMatrix(__cid)');
  const co=G(sb,'coBodyHtml()');
  ok(/co-mx/.test(co),'G2 màn khoá dựng được bảng tích');
  ok(/Khoa G/.test(co)&&/TT3/.test(co),'G2 …hiện tên khoá và đơn vị đào tạo');
  ok((co.match(/coMxToggle/g)||[]).length===4,'G2 bảng tích 2 người × 2 buổi = 4 ô',
     (co.match(/coMxToggle/g)||[]).length);

  const tb=G(sb,'trTableHtml()');
  ok(/tr-tbl/.test(tb)&&/Khoa G/.test(tb),'G3 bảng tổng hợp theo khoá');
  ok(/Buoi le/.test(tb),'G3 …buổi lẻ vẫn có mặt');
  G(sb,`trTblSet('by','emp')`);
  const tb2=G(sb,'trTableHtml()');
  ok(/Gi(ờ|o) đào tạo|Giờ đào tạo/.test(tb2),'G3 đổi sang bảng theo người');
}

head('H. Điểm danh khoá — ai chưa được xếp buổi nào  ★ v7.9');
{
  /* Câu hỏi người dùng nêu: "phân trước người vào khoá có vô nghĩa không,
     vì sang bên kia vẫn phải phân người học theo ngày?" — KHÔNG, vì danh
     sách khoá là bản điểm danh gốc: nó là thứ duy nhất phát hiện được
     người bị BỎ SÓT (không có tên ở buổi nào cả). */
  const sb=build();
  const cid=call(sb,'coSave',[{title:'Khoa H2',emps:['e1','e2','e3']}]).id;
  call(sb,'trSave',[baseTr({courseId:cid,title:'S1',days:['2026-08-24'],emps:['e1']})]);
  sb.__cid=cid;
  G(sb,'coOpenMatrix(__cid)');
  /* Soi CHÍNH bảng phân bổ, không soi cả màn: đoạn chữ hướng dẫn dưới danh
     sách học viên cũng chứa cụm "chưa được xếp buổi nào" nên tìm trong cả
     màn sẽ luôn khớp — một phép thử luôn xanh là phép thử vô dụng. */
  const html=G(sb,'coMatrixHtml(__cid)');
  ok(/pv-alert warn/.test(html)&&/<b>2<\/b>\/3/.test(html),
     'H1 báo đúng 2/3 học viên chưa có buổi nào');
  /* shortName() rút còn 2 chữ cuối (đúng như app hiển thị) */
  ok(/VAN B/.test(html)&&/VAN C/.test(html),'H1 …và gọi tên họ ra');
  /* Xếp nốt hai người còn lại vào buổi đó */
  G(sb,'coSessions(__cid).forEach(function(tr){coMxToggle(tr.id,"e2");coMxToggle(tr.id,"e3");});');
  const html2=G(sb,'coMatrixHtml(__cid)');
  ok(/đều đã có buổi/.test(html2),'H2 xếp đủ người → chuyển sang dòng xác nhận');
  ok(!/pv-alert warn/.test(html2),'H2 …và bỏ hẳn cảnh báo');
  /* Người thêm thẳng vào buổi mà chưa khai ở khoá vẫn phải thấy trong bảng */
  const cid2=call(sb,'coSave',[{title:'Khoa H3',emps:['e1']}]).id;
  call(sb,'trSave',[baseTr({courseId:cid2,title:'S1',days:['2026-08-26'],emps:['e1','e2']})]);
  sb.__cid2=cid2;
  ok(G(sb,'coEmps(__cid2).join(",")')==='e1,e2',
     'H3 người thêm thẳng ở buổi vẫn có mặt trong danh sách khoá',G(sb,'coEmps(__cid2).join(",")'));
}

console.log('\n════════════════════════════════════');
console.log(fail?('✗ HỎNG '+fail+'/'+(pass+fail)+' bài'):('✓ ĐẠT HẾT '+pass+' bài'));
console.log('════════════════════════════════════');
process.exit(fail?1:0);
