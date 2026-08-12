/* ============================================================
   HARNESS v8.0 — ĐỦ 2 KỸ SƯ MỖI KHUNG 12 GIỜ · ĐIỂM DANH ĐÀO TẠO
   ------------------------------------------------------------
   Chạy:  node _test/manpower-v80-harness.js
   ------------------------------------------------------------
   YÊU CẦU (người dùng nêu 2026-08-12)

   "Nhân lực đi học tức là không tham gia sản xuất được, nó cũng phải tính
    vào thiếu người. Cảnh báo nếu trong hai khoảng 08:00–20:00 và
    20:00–08:00 không có đủ 2 kỹ sư — đây là yêu cầu tối thiểu để vận hành.
    Thêm chức năng người lao động xác nhận đã tham gia khoá đào tạo, bảng
    khoá thêm hai cột đã tham gia / chưa tham gia."

   A. Quy đổi mã ca thành khoảng có mặt
      A1 D/OTD phủ trọn khung ngày · N/OTN phủ trọn khung đêm
      A2 O (08–17) chỉ phủ MỘT PHẦN khung ngày → không tính vào định mức
      A3 ca kép O+N phủ một phần khung ngày và TRỌN khung đêm
      A4 R / nghỉ phép không phủ khung nào

   B. Đếm kỹ sư theo khung
      B1 2 kỹ sư ca D → khung ngày đủ
      B2 chỉ operator → khung ngày thiếu dù đông người
      B3 kỹ sư ca O không cứu được khung ngày (nằm ở nhóm "một phần")
      B4 ngưỡng lấy từ S.settings.minEng, mặc định 2

   C. Người đi đào tạo bị trừ
      C1 kỹ sư đi học trong giờ → rơi khỏi khung ngày, ngày thành thiếu
      C2 …và được gọi tên trong danh sách "đang đi đào tạo"
      C3 buổi học ngoài khung (đêm) không ảnh hưởng khung ngày
      C4 buổi CHỜ DUYỆT chưa trừ ai — chưa chắc diễn ra
      C5 buổi qua đêm trừ cả khung đêm

   D. mpLowOfDay & câu giải thích
      D1 đủ đầu người ca D/N nhưng thiếu kỹ sư → vẫn là ngày thiếu
      D2 mpEngWhy nói rõ khung nào thiếu và có mấy người đi học

   E. Xác nhận đã tham gia (js/22-training.js)
      E1 chưa tới ngày học thì KHÔNG xác nhận được
      E2 buổi đã diễn ra: chính người đó xác nhận được
      E3 người khác không xác nhận hộ được, quản lý thì được
      E4 bấm lại = bỏ xác nhận; hết dấu thì xoá luôn khoá `done`
      E5 SỬA buổi không làm mất dấu điểm danh
      E6 …nhưng người bị bỏ khỏi buổi thì mất dấu theo
      E7 trAttendSplit chia đúng hai danh sách

   F. Hai cột trong bảng khoá (js/23-course.js)
      F1 coAttendSplit: chỉ "đã tham gia" khi dự ĐỦ mọi buổi được xếp
      F2 người chưa được xếp buổi nào nằm ở cột CHƯA
      F3 bảng tổng hợp dựng đủ hai cột và liệt kê tên
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m+(x!==undefined?'   ['+x+']':''));}
                   else{fail++;console.log('  ✗ '+m+(x!==undefined?'   ['+x+']':''));}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

/* e1,e2 = kỹ sư (field_eng / boardman) · e3,e4 = operator · ad = quản trị */
const EMPS=[
  {id:'e1',name:'NGUYEN VAN A',pos:'field_eng',team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e2',name:'TRAN VAN B',  pos:'boardman', team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e3',name:'LE VAN C',    pos:'operator', team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e4',name:'PHAM VAN D',  pos:'operator', team:'A',perm:'staff',active:true,shiftType:'shift'},
  {id:'e5',name:'VO VAN E',    pos:'field_eng',team:'B',perm:'staff',active:true,shiftType:'shift'},
  {id:'ad',name:'QUAN TRI',    pos:'office',   team:'', perm:'admin',active:true,shiftType:'none'}
];
const ISO='2026-08-24', PAST='2026-08-01';

function build(){
  const sb={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>0,isNaN,parseInt,parseFloat};
  sb.globalThis=sb;sb.window=sb;
  sb.document={addEventListener:()=>{},querySelectorAll:()=>[],getElementById:()=>null,hidden:false};
  sb.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  vm.createContext(sb);
  vm.runInContext(`
    var __toasts=[],__saves=0,LANG='vi';
    function t(s){return s;} function t2(s){return s;}
    function toast(m){__toasts.push(String(m));}
    function confirm(){return true;} function prompt(){return '';} function alert(){}
    var rnd1=v=>Math.round(v*10)/10;
    function zaloEnqueue(){} function notifyApprovers(){}
    function newNotif(o){var id='n'+(Object.keys(S.notifs).length+1);
      S.notifs[id]=Object.assign({id:id},o);return id;}
    function notifDrop(){return 0;}
    function cancelReq(rid){delete S.requests[rid];return{reverted:0};}
    function defaultNoPrint(type){return type!=='multi'&&type!=='swap';}
    function teamList(){var s=[];(S.employees||[]).forEach(function(e){
      var x=e.team||'';if(s.indexOf(x)<0)s.push(x);});return s.sort();}
    function shortName(n){var w=String(n||'').trim().split(/\\s+/);return w.slice(-2).join(' ')||String(n||'');}
    function permOf(id){var e=(S.employees||[]).find(function(x){return x.id===id;});return (e&&e.perm)||'staff';}
    function save(cb){__saves++;S.rev=Date.now()+__saves;if(cb)cb(true);}
    function renderCal(){}function renderMe(){}function renderAppr(){}
    function renderEventMgr(){}function renderTrainMgr(){}function coRenderPeople(){}
    function renderDaySheet(){}function fillMonthSelects(){}function refreshBadge(){}
    function mondayOf(iso){var d=new Date(iso+'T00:00:00');var k=(d.getDay()+6)%7;
      d.setDate(d.getDate()-k);return d.toISOString().slice(0,10);}
    function poolChip(){return '';}
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
  vm.runInContext(rd('07-manpower.js'),sb);
  vm.runInContext(rd('22-training.js'),sb);
  vm.runInContext(rd('23-course.js'),sb);
  vm.runInContext(`function toast(m){__toasts.push(String(m));}`,sb);
  vm.runInContext(`
    S.employees=${JSON.stringify(EMPS)};
    S.base={};S.over={};S.requests={};S.notifs={};S.trainings={};S.courses={};S.del={};
    S.meta={schedFrom:'2026-07-21',schedTo:'2026-09-20'};S.rev=1;
    S.settings=S.settings||{};S.settings.minD=3;S.settings.minN=3;S.settings.minEng=2;
    globalThis.__ctx={get S(){return S;},get toasts(){return __toasts;},
      setMe:function(id,boss){globalThis.__me=id;secr=!!boss;mgr=!!boss;adm=!!boss;hrm=!!boss;noSelf=false;}};
    function meId(){return globalThis.__me||'';}
  `,sb);
  sb.__ctx.setMe('ad',true);
  return sb;
}
const G=(sb,expr)=>vm.runInContext(expr,sb);
function call(sb,fn,args){sb.__args=args||[];
  return vm.runInContext(`(function(){return ${fn}.apply(null,__args);})()`,sb);}
/* Đặt mã ca cho từng người trong một ngày */
function setDay(sb,iso,map){
  sb.__m=map;sb.__iso=iso;
  G(sb,`Object.keys(__m).forEach(function(id){S.base[id]=S.base[id]||{};S.base[id][__iso]=__m[id];});`);
}
function trainOf(over){
  return Object.assign({title:'Lop an toan',place:'',note:'',
    days:[ISO],emps:['e1'],mode:'shift',
    timeIn:'08:00',timeOut:'12:00',noLunch:false,notify:false},over||{});
}

/* ============================================================ */
head('A. Quy đổi mã ca thành khoảng có mặt');
{
  const sb=build();
  const day=G(sb,'MP_WIN[0]'), night=G(sb,'MP_WIN[1]');
  sb.__d=day;sb.__n=night;
  const full=(code,w)=>{sb.__c=code;sb.__w=w;return G(sb,'mpSpanFull(mpCodeSpans(__c),__w)');};
  const hit =(code,w)=>{sb.__c=code;sb.__w=w;return G(sb,'mpSpanHit(mpCodeSpans(__c),__w)');};
  ok(full('D',day)&&full('OTD',day),'A1 D / OTD phủ trọn khung ngày');
  ok(full('N',night)&&full('OTN',night),'A1 N / OTN phủ trọn khung đêm');
  ok(hit('O',day)&&!full('O',day),'A2 ca O chỉ phủ MỘT PHẦN khung ngày (08–17)');
  ok(hit('O+N',day)&&!full('O+N',day)&&full('O+N',night),'A3 ca kép O+N: ngày một phần, đêm trọn');
  ok(!hit('R',day)&&!hit('R',night),'A4 nghỉ ca không phủ khung nào');
  ok(!hit('AL8',day),'A4 nghỉ phép cũng vậy');
}

head('B. Đếm kỹ sư theo khung');
{
  const sb=build();
  setDay(sb,ISO,{e1:'D',e2:'D',e3:'D',e4:'D',e5:'N'});
  sb.__iso=ISO;
  let d=G(sb,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.day.n===2&&!d.win.day.low,'B1 hai kỹ sư ca D → khung ngày đủ',d.win.day.n);
  ok(d.win.night.n===1&&d.win.night.low,'B2 khung đêm chỉ 1 kỹ sư → thiếu',d.win.night.n);

  setDay(sb,ISO,{e1:'R',e2:'R',e3:'D',e4:'D',e5:'D'});
  d=G(sb,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.day.n===1,'B2 đông operator vẫn không thay được kỹ sư',d.win.day.n);

  setDay(sb,ISO,{e1:'O',e2:'O',e3:'D',e4:'D',e5:'N'});
  d=G(sb,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.day.n===0&&d.win.day.part.length===2,
     'B3 kỹ sư ca hành chính nằm ở nhóm "một phần", không tính vào định mức',
     d.win.day.n+' + part '+d.win.day.part.length);

  G(sb,'S.settings.minEng=1;');
  d=G(sb,'mpEngDay(__iso,POOL_PROD)');
  ok(d.need===1,'B4 ngưỡng đọc từ S.settings.minEng',d.need);
  G(sb,'delete S.settings.minEng;');
  ok(G(sb,'minEngOfWindow()')===2,'B4 không khai thì mặc định 2');
}

head('C. Người đi đào tạo bị trừ khỏi nhân lực');
{
  const sb=build();
  setDay(sb,ISO,{e1:'D',e2:'D',e3:'D',e4:'D',e5:'N'});
  sb.__iso=ISO;
  ok(G(sb,'mpEngDay(__iso,POOL_PROD).win.day.n')===2,'C0 trước khi xếp học: đủ 2 kỹ sư');

  const r=call(sb,'trSave',[trainOf({emps:['e1'],timeIn:'08:00',timeOut:'12:00'})]);
  ok(r.ok,'C1 xếp e1 đi học 08–12');
  let d=G(sb,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.day.n===1&&d.win.day.low,'C1 khung ngày rơi còn 1 kỹ sư → THIẾU',d.win.day.n);
  ok(d.win.day.train.length===1&&d.win.day.train[0].id==='e1',
     'C2 gọi đúng tên người đang đi đào tạo',(d.win.day.train[0]||{}).id);

  /* Buổi học ban đêm không đụng tới khung ngày */
  const sb2=build();
  setDay(sb2,ISO,{e1:'D',e2:'D',e3:'D',e4:'D',e5:'N'});
  sb2.__iso=ISO;
  call(sb2,'trSave',[trainOf({emps:['e1'],timeIn:'21:00',timeOut:'23:00'})]);
  d=G(sb2,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.day.n===2&&!d.win.day.low,'C3 buổi học 21–23h không ảnh hưởng khung ngày',d.win.day.n);
  /* e1 trực ca D nên vốn không có mặt ở khung đêm — buổi học buổi tối của
     anh ta KHÔNG làm khung đêm xấu đi, và cũng không được đếm là "đang đi
     đào tạo" của khung đó. Chỉ trừ người LẼ RA CÓ MẶT. */
  ok(d.win.night.train.length===0&&d.win.night.n===1,
     'C3 …và cũng không bị đếm nhầm vào khung đêm (e1 vốn không trực đêm)',
     d.win.night.n+' + train '+d.win.night.train.length);

  /* Bản nhân viên tự khai, chưa duyệt */
  const sb3=build();
  sb3.__ctx.setMe('e1',false);
  setDay(sb3,ISO,{e1:'D',e2:'D',e3:'D',e4:'D',e5:'N'});
  sb3.__iso=ISO;
  const r3=call(sb3,'trSave',[trainOf({emps:['e1'],timeIn:'08:00',timeOut:'12:00'})]);
  ok(r3.ok&&r3.status==='pending','C4 nhân viên tự khai → chờ duyệt',r3.status);
  d=G(sb3,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.day.n===2&&!d.win.day.low,'C4 buổi chưa duyệt CHƯA trừ ai — chưa chắc diễn ra',d.win.day.n);
  sb3.__ctx.setMe('ad',true);
  G(sb3,`trApprove(${JSON.stringify(r3.id)});`);
  d=G(sb3,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.day.n===1,'C4 duyệt xong mới trừ',d.win.day.n);

  /* Buổi qua đêm */
  const sb4=build();
  setDay(sb4,ISO,{e1:'D',e2:'D',e3:'D',e4:'D',e5:'N'});
  sb4.__iso=ISO;
  call(sb4,'trSave',[trainOf({emps:['e5'],timeIn:'22:00',timeOut:'02:00',overnight:true})]);
  d=G(sb4,'mpEngDay(__iso,POOL_PROD)');
  ok(d.win.night.n===0&&d.win.night.train.length===1,'C5 buổi qua đêm trừ khỏi khung đêm',d.win.night.n);
}

head('D. mpLowOfDay & câu giải thích');
{
  const sb=build();
  /* Đủ đầu người ca D (3 người ≥ minD=3) nhưng CHỈ MỘT kỹ sư (e1);
     e2 và e5 đều là kỹ sư nhưng đang nghỉ ca. */
  setDay(sb,ISO,{e1:'D',e2:'R',e3:'D',e4:'D',e5:'R'});
  G(sb,'S.settings.minD=3;S.settings.minN=0;');
  sb.__iso=ISO;
  const L=G(sb,'mpLowOfDay(__iso)');
  ok(!L.lowD,'D1 đầu người ca D vẫn đủ',L.B.D.length+'/3');
  ok(L.lowEng&&L.low,'D1 …nhưng thiếu kỹ sư nên NGÀY VẪN LÀ THIẾU NGƯỜI');
  const why=G(sb,'mpEngWhy(__iso,POOL_PROD)');
  ok(/Khung ngày/.test(why)&&/2/.test(why),'D2 câu giải thích nói rõ khung nào thiếu',why);
  call(sb,'trSave',[trainOf({emps:['e1'],timeIn:'08:00',timeOut:'12:00'})]);
  const why2=G(sb,'mpEngWhy(__iso,POOL_PROD)');
  ok(/đi đào tạo/.test(why2),'D2 …và nói có người đang đi đào tạo',why2);
}

head('E. Xác nhận đã tham gia');
{
  const sb=build();
  setDay(sb,ISO,{e1:'D',e2:'D'});
  setDay(sb,PAST,{e1:'D',e2:'D'});
  const future=call(sb,'trSave',[trainOf({days:[ISO],emps:['e1','e2']})]).id;
  const past  =call(sb,'trSave',[trainOf({days:[PAST],emps:['e1','e2']})]).id;
  sb.__f=future;sb.__p=past;

  ok(G(sb,'trHappened(trById(__f))')===false,'E1 buổi ngày 24/08 chưa diễn ra');
  ok(call(sb,'trSetAttend',[future,'e1',true]).ok===false,'E1 …nên chưa xác nhận được');

  sb.__ctx.setMe('e1',false);
  const r=call(sb,'trSetAttend',[past,'e1',true]);
  ok(r.ok&&G(sb,'trAttended(trById(__p),"e1")')===true,'E2 chính người đó xác nhận được');
  const bad=call(sb,'trSetAttend',[past,'e2',true]);
  ok(!bad.ok,'E3 không xác nhận hộ người khác được',bad.err);
  sb.__ctx.setMe('ad',true);
  ok(call(sb,'trSetAttend',[past,'e2',true]).ok,'E3 quản lý điểm danh hộ được');

  const sp=G(sb,'trAttendSplit(trById(__p))');
  ok(sp.done.length===2&&sp.todo.length===0,'E7 chia đúng hai danh sách',
     sp.done.join(',')+' | '+sp.todo.join(','));

  call(sb,'trSetAttend',[past,'e1',false]);
  call(sb,'trSetAttend',[past,'e2',false]);
  ok(G(sb,'trById(__p).done')===undefined,'E4 hết dấu thì xoá luôn khoá done');

  /* Sửa buổi không được làm mất điểm danh */
  call(sb,'trSetAttend',[past,'e1',true]);
  call(sb,'trSetAttend',[past,'e2',true]);
  const cur=G(sb,'JSON.parse(JSON.stringify(trById(__p)))');
  const r2=call(sb,'trSave',[Object.assign({},cur,{timeIn:'08:00',timeOut:'16:00'})]);
  ok(r2.ok&&G(sb,'trAttended(trById(__p),"e1")')===true,'E5 sửa giờ học KHÔNG mất dấu điểm danh');
  const cur2=G(sb,'JSON.parse(JSON.stringify(trById(__p)))');
  call(sb,'trSave',[Object.assign({},cur2,{emps:['e1']})]);
  ok(G(sb,'trAttended(trById(__p),"e1")')===true&&G(sb,'trAttended(trById(__p),"e2")')===false,
     'E6 người bị bỏ khỏi buổi thì mất dấu theo');
}

head('F. Hai cột đã / chưa tham gia');
{
  const sb=build();
  setDay(sb,PAST,{e1:'D',e2:'D',e3:'D'});
  const cid=call(sb,'coSave',[{title:'Khoa AT',emps:['e1','e2','e3']}]).id;
  const s1=call(sb,'trSave',[trainOf({courseId:cid,title:'B1',days:[PAST],emps:['e1','e2']})]).id;
  const s2=call(sb,'trSave',[trainOf({courseId:cid,title:'B2',days:[PAST],emps:['e1']})]).id;
  sb.__cid=cid;
  call(sb,'trSetAttend',[s1,'e1',true]);
  call(sb,'trSetAttend',[s1,'e2',true]);
  /* e1 còn thiếu buổi B2 → chưa xong khoá */
  let sp=G(sb,'coAttendSplit(__cid)');
  ok(sp.done.join(',')==='e2','F1 chỉ ai dự ĐỦ buổi được xếp mới vào cột đã tham gia',sp.done.join(','));
  ok(sp.todo.indexOf('e1')>=0,'F1 e1 còn thiếu buổi B2 → vẫn ở cột chưa');
  ok(sp.todo.indexOf('e3')>=0,'F2 người chưa được xếp buổi nào cũng ở cột chưa');
  call(sb,'trSetAttend',[s2,'e1',true]);
  sp=G(sb,'coAttendSplit(__cid)');
  ok(sp.done.sort().join(',')==='e1,e2','F1 dự đủ thì chuyển sang cột đã',sp.done.join(','));

  const html=G(sb,'trTblYm="__all",trTblBy="course",trTableHtml()');
  ok(/Đã tham gia/.test(html)&&/Chưa tham gia/.test(html),'F3 bảng có đủ hai cột');
  ok(/attp/.test(html)&&/VAN A/.test(html),'F3 …và liệt kê tên người');
  const html2=G(sb,'trTblBy="emp",trTableHtml()');
  ok(/Đã xác nhận tham gia/.test(html2),'F3 bảng theo người cũng có cột xác nhận');
}

console.log('\n════════════════════════════════════');
console.log(fail?('✗ HỎNG '+fail+'/'+(pass+fail)+' bài'):('✓ ĐẠT HẾT '+pass+' bài'));
console.log('════════════════════════════════════');
process.exit(fail?1:0);
