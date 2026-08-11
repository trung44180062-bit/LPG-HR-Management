/* ============================================================
   HARNESS — BẢNG TIN của thư ký / QL người Hàn   ★ v7.4
   ------------------------------------------------------------
   Chạy:  node _test/noself-home-harness.js
   ------------------------------------------------------------
   A. Định tuyến: nhóm noSelf nay CŨNG vào Trang chính, không bị đá sang Lịch
   B. Lịch điều hành chỉ liệt kê ngày CÓ CHUYỆN (sự kiện · đào tạo · thiếu quân số)
   C. Đếm ngược "hôm nay / ngày mai / còn N ngày"
   D. Dải nhắc nhìn xa hơn kỳ hiện tại, và xếp ngày gần nhất lên trước
   E. Bảng tin dựng được, không lọt "undefined", có lối vào tab Duyệt
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m+(x!==undefined?'   ['+x+']':''));}
                   else{fail++;console.log('  ✗ '+m+(x!==undefined?'   ['+x+']':''));}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

/* ---------- Sandbox: nạp THẬT core + schedule + events + training,
     còn phần Trang chính thì lấy đúng các hàm cần kiểm ra khỏi 13-portal.js.
     13-portal.js nguyên bản kéo theo cả DOM sheet nên không nạp trọn được. ---------- */
function build(opt){
  opt=opt||{};
  const sb={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,
    setTimeout:(f)=>{},clearTimeout,setInterval:()=>0,clearInterval:()=>0,isNaN,parseInt,parseFloat};
  sb.globalThis=sb;sb.window=sb;
  sb.document={addEventListener(){},querySelectorAll(){return [];},getElementById(){return null;},hidden:false};
  sb.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  vm.createContext(sb);
  vm.runInContext(`
    var LANG='vi';
    function t(s){return s;} function t2(s){return s;}
    function toast(){} function confirm(){return true;}
    var rnd1=v=>Math.round(v*10)/10;
    function zaloEnqueue(){} function newNotif(){} function notifDrop(){return 0;}
    function notifyApprovers(){} function cancelReq(){} function defaultNoPrint(){return true;}
    function teamList(){return ['A','B'];}
    /* shortName / avatarInitials thật nằm ở js/13-portal.js — chép nguyên văn,
       vì đúng cách hiển thị tên QL người Hàn là thứ khối này phải in ra. */
    function shortName(n){
      var s=String(n||'').trim();
      if(/^mr\\.?\\s+/i.test(s))return s;
      var w=s.split(/\\s+/).filter(Boolean);
      return w.slice(-2).join(' ')||s;
    }
    function avatarInitials(name,fallback){
      var s=String(name||fallback||'').trim();
      if(!s)return '';
      var kr=/^mr\\.?\\s+/i.test(s);
      var w=(kr?s.replace(/^\\s*mr\\.?\\s+/i,''):s).split(/\\s+/).filter(Boolean);
      if(w.length<2)return String(w[0]||s).slice(0,2).toUpperCase();
      var pick=kr?w.slice(0,2):w.slice(-2);
      return pick.map(function(x){return x[0];}).join('').toUpperCase();
    }
    function permOf(id){var e=(S.employees||[]).find(x=>x.id===id);return (e&&e.perm)||'staff';}
    function save(cb){S.rev=Date.now();if(cb)cb(true);}
    function renderCal(){}function renderMe(){}function renderAppr(){}function renderAll(){}
    function fillMonthSelects(){}function refreshBadge(){}function mondayOf(i){return i;}
    function notifUnseenCount(){return 3;}
    function pendingConfirms(){return [];}
    function openDaySheet(){} function openMyPanel(){} function go(){} function doLogout(){}
    function openEventMgr(){} function openTrainMgr(){}
    var PERM_LABEL={staff:'Nhân viên',sec:'Thư ký',appr:'Duyệt đơn',admin:'Quản trị',kmgr:'Quản lý người Hàn (EN)'};
  `,sb);
  vm.runInContext(rd('01-core.js'),sb);
  vm.runInContext(`
    function addDaysIso(iso,n){var d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoOf(d);}
    function baseShiftOf(c){var b=(typeof comboOf==='function')&&comboOf(c);if(b)c=b.work;
      if(c==='D'||c==='SD'||c==='OTD')return 'D'; if(c==='N'||c==='SN'||c==='OTN')return 'N';
      if(c==='O'||c==='SO'||c==='OTO')return 'O'; return null;}
    function mpBuckets(iso,pool){
      var B={D:[],N:[],O:[],R:[],leave:[],ot:[]};
      schedEmps().forEach(function(e){
        if(pool&&poolOf(e)!==pool)return;
        var c=eff(e.id,iso).code;if(!c)return;
        if(c==='D')B.D.push(e);else if(c==='N')B.N.push(e);
        else if(c==='O')B.O.push(e);else if(c==='R')B.R.push(e);
      });
      return B;
    }
    function reqNeedsMyAction(r){return r&&r.status==='pending';}
  `,sb);
  vm.runInContext(rd('04-schedule.js'),sb);
  vm.runInContext(rd('20-events.js'),sb);
  vm.runInContext(rd('22-training.js'),sb);
  vm.runInContext(`function toast(){}`,sb);

  /* Lấy đúng khối Bảng tin ra khỏi js/13-portal.js — nguyên văn, không sửa.
     Cắt theo hai mốc chú thích, KHÔNG theo số dòng (số dòng đổi là bài kiểm
     lặng lẽ kiểm nhầm đoạn khác — bẫy đã dính ở v6.2). */
  const src=rd('13-portal.js');
  const i=src.indexOf('/* Khoảng ngày dùng cho DẢI NHẮC');
  const j=src.indexOf('/* =================== LỊCH TUẦN / THÁNG ===================');
  if(i<0||j<0)throw new Error('không tìm thấy khối Bảng tin trong js/13-portal.js');
  vm.runInContext(src.slice(i,j),sb);

  vm.runInContext(`
    S.employees=[
      {id:'e1',name:'NGUYEN VAN A',team:'A',perm:'staff',active:true,shiftType:'shift'},
      {id:'e2',name:'TRAN VAN B', team:'A',perm:'staff',active:true,shiftType:'shift'},
      {id:'e3',name:'LE VAN C',   team:'B',perm:'staff',active:true,shiftType:'shift'},
      {id:'e4',name:'PHAM VAN D', team:'B',perm:'staff',active:true,shiftType:'shift'},
      {id:'sec',name:'PHAN QUYNH VAN',team:'Office',perm:'sec',active:true,shiftType:'none'},
      {id:'km', name:'Mr. KIM JONG SU',team:'Office',perm:'kmgr',active:true,shiftType:'none'}
    ];
    S.base={};S.over={};S.requests={};S.notifs={};S.trainings={};S.events={};S.del={};
    S.settings={minD:2,minN:2,minO:1,hours:{},customCodes:[]};
    S.meta={};S.rev=1;
    secr=true;mgr=true;adm=true;noSelf=true;
    globalThis.__me='sec';
  `,sb);
  vm.runInContext(`function meId(){return globalThis.__me;}`,sb);
  sb.__S=vm.runInContext('S',sb);
  sb.__run=code=>vm.runInContext(code,sb);
  return sb;
}
const call=(sb,fn,args)=>{sb.__args=args||[];
  return vm.runInContext(`(function(){return ${fn}.apply(null,__args);})()`,sb);};

/* ============================================================ */
head('A. Định tuyến');
{
  const sb=build();
  ok(call(sb,'homeView',[])==='me','A1 ★ noSelf nay vào thẳng Trang chính (trước là bị đá sang Lịch)',
     call(sb,'homeView',[]));
  vm.runInContext(`noSelf=false;`,sb);
  ok(call(sb,'homeView',[])==='me','A1 nhân viên thường vẫn như cũ');
  const nav=rd('03-nav.js');
  ok(!/v==='me'&&noSelf/.test(nav)&&!/if\(v==='me'&&noSelf\)/.test(nav),
     'A2 go() không còn chặn noSelf vào tab me');
  ok(!/if\(noSelf&&curView==='me'/.test(rd('13-portal.js')),
     'A3 applyRoleUI không còn đá họ ra khỏi Trang chính');
  ok(/home-tab/.test(fs.readFileSync(path.join(ROOT,'index.html'),'utf8')),
     'A4 tab Trang chính không còn class self-only (nay là home-tab)');
  ok(/noSelf\?t\('Bảng tin'\):t\('Trang chính'\)/.test(rd('13-portal.js')),
     'A5 tab đổi tên thành "Bảng tin" cho nhóm noSelf');
}

/* ============================================================ */
head('B. Lịch điều hành — chỉ ngày CÓ CHUYỆN');
{
  const sb=build();
  const T=call(sb,'todayIso',[]);
  const d=n=>call(sb,'addDaysIso',[T,n]);
  /* Đủ quân số cả hai ca (minD=2, minN=2) → không ngày nào bị cảnh báo.
     Thiếu bước này thì ca N rỗng và MỌI ngày đều đỏ, bài kiểm B1/B2 hỏng vì
     lý do không liên quan tới thứ đang kiểm. */
  vm.runInContext(`
    var SH={e1:'D',e2:'D',e3:'N',e4:'N'};
    ['e1','e2','e3','e4'].forEach(function(id){
      S.base[id]={};
      for(var i=0;i<25;i++){S.base[id][addDaysIso(todayIso(),i)]=SH[id];}
    });
    S.events={};S.trainings={};S.rev++;evResetCache();trResetCache();
  `,sb);
  ok(call(sb,'nsAgenda',[]).length===0,'B1 không có gì thì lịch điều hành RỖNG (không liệt kê 21 ngày trống)');

  vm.runInContext(`
    S.events={ev1:{id:'ev1',title:'Nhap tau LPG',from:'${d(3)}',to:'${d(3)}',scope:'all',notify:false}};
    S.trainings={tr1:{id:'tr1',title:'An toan',days:['${d(5)}'],emps:['e1','e2'],
      mode:'shift',timeIn:'08:00',timeOut:'12:00',status:'active',by:'sec'}};
    S.rev++;evResetCache();trResetCache();
  `,sb);
  const ag=call(sb,'nsAgenda',[]);
  ok(ag.length===2,'B2 đúng 2 ngày có chuyện',ag.length);
  ok(ag[0].iso===d(3)&&ag[0].evs.length===1,'B2 ngày sự kiện đứng trước');
  ok(ag[1].iso===d(5)&&ag[1].trs.length===1,'B2 ngày đào tạo đứng sau');

  /* Thiếu quân số */
  vm.runInContext(`S.base.e2['${d(7)}']='R';S.rev++;`,sb);
  const ag2=call(sb,'nsAgenda',[]);
  const low=ag2.find(x=>x.iso===d(7));
  ok(!!low&&!!low.low,'B3 ★ ngày thiếu quân số cũng được nhắc',low&&JSON.stringify(low.low));
  ok(low&&low.low.nD===1&&low.low.mD===2&&low.low.nN===2,
     'B3 …kèm con số thật / định mức, ca đủ người thì không kêu oan',
     low&&('D '+low.low.nD+'/'+low.low.mD+' · N '+low.low.nN+'/'+low.low.mN));

  /* Buổi đào tạo CHỜ DUYỆT chưa phải là lịch đã chốt → không nhắc */
  vm.runInContext(`S.trainings.tr1.status='pending';S.rev++;trResetCache();`,sb);
  ok(!call(sb,'nsAgenda',[]).some(x=>x.trs.length),'B4 buổi đào tạo chờ duyệt KHÔNG lên lịch điều hành');
}

/* ============================================================ */
head('C. Đếm ngược');
{
  const sb=build();
  const T=call(sb,'todayIso',[]);
  ok(call(sb,'nsWhen',[T])==='hôm nay','C1 hôm nay',call(sb,'nsWhen',[T]));
  ok(call(sb,'nsWhen',[call(sb,'addDaysIso',[T,1])])==='ngày mai','C1 ngày mai');
  ok(call(sb,'nsWhen',[call(sb,'addDaysIso',[T,4])])==='còn 4 ngày','C1 còn N ngày',
     call(sb,'nsWhen',[call(sb,'addDaysIso',[T,4])]));
}

/* ============================================================ */
head('D. Dải nhắc — nhìn xa và xếp đúng thứ tự');
{
  const sb=build();
  const days=call(sb,'pvAheadDays',[]);
  ok(days.length===30,'D1 ★ dải nhắc nhìn 30 ngày tới, không bó trong kỳ hiện tại',days.length);
  ok(days[0]===call(sb,'todayIso',[]),'D1 bắt đầu từ hôm nay');

  const T=call(sb,'todayIso',[]), d=n=>call(sb,'addDaysIso',[T,n]);
  vm.runInContext(`
    ['e1'].forEach(function(id){S.base[id]={};for(var i=0;i<30;i++)S.base[id][addDaysIso(todayIso(),i)]='O';});
    S.trainings={
      far :{id:'far', title:'Buoi xa', days:['${d(20)}'],emps:['e1'],mode:'shift',
            timeIn:'08:00',timeOut:'12:00',status:'active',by:'sec'},
      near:{id:'near',title:'Buoi gan',days:['${d(2)}'], emps:['e1'],mode:'shift',
            timeIn:'08:00',timeOut:'12:00',status:'active',by:'sec'}
    };
    S.rev++;trResetCache();
  `,sb);
  const h=call(sb,'trBannerHtml',[days,'e1']);
  ok(h.indexOf('Buoi gan')<h.indexOf('Buoi xa'),'D2 ★ buổi gần nhất xếp lên trước');
  ok(/còn 2 ngày/.test(h),'D2 có chip đếm ngược',/còn \d+ ngày/.exec(h));
  ok(/08:00–12:00/.test(h),'D3 dải nhắc ghi rõ giờ học');
}

/* ============================================================ */
head('E. Dựng Bảng tin');
{
  const sb=build();
  const T=call(sb,'todayIso',[]), d=n=>call(sb,'addDaysIso',[T,n]);
  vm.runInContext(`
    var SH={e1:'D',e2:'D',e3:'N',e4:'N'};
    ['e1','e2','e3','e4'].forEach(function(id){S.base[id]={};
      for(var i=0;i<25;i++)S.base[id][addDaysIso(todayIso(),i)]=SH[id];});
    S.events={ev1:{id:'ev1',title:'Nhap tau LPG',from:'${d(3)}',to:'${d(3)}',scope:'all',notify:false}};
    S.requests={r1:{id:'r1',type:'ot',empId:'e1',status:'pending'},
                r2:{id:'r2',type:'leave',empId:'e2',status:'pending'}};
    S.rev++;evResetCache();trResetCache();
  `,sb);
  const html=call(sb,'noSelfHomeHtml',['sec']);
  ok(html.length>500,'E1 Bảng tin dựng được',html.length+' ký tự');
  ok(!/undefined/.test(html),'E1 ★ không lọt chuỗi "undefined"');
  ok(/PHAN QUYNH VAN|QUYNH VAN/.test(html),'E2 có tên người đăng nhập');
  ok(/Thư ký/.test(html),'E2 …và chức danh thay cho "Nhóm A"');
  ok(/2 đơn đang chờ bạn duyệt/.test(html),'E3 ★ nêu rõ số đơn chờ chính họ duyệt');
  ok(/go\('appr'\)/.test(html),'E3 …bấm vào là sang tab Duyệt');
  ok(/Nhap tau LPG/.test(html),'E4 sự kiện sắp tới hiện trên bảng tin');
  ok(/ns-ag/.test(html),'E5 có khối lịch điều hành');
  ok(/pv-stats/.test(html)&&/Quân số hôm nay/.test(html),'E6 có dãy ô số liệu điều hành');

  /* QL người Hàn: cùng bảng tin, khác chức danh */
  vm.runInContext(`globalThis.__me='km';`,sb);
  const h2=call(sb,'noSelfHomeHtml',['km']);
  ok(/Quản lý người Hàn/.test(h2),'E7 QL người Hàn thấy đúng chức danh của mình');
  ok(!/undefined/.test(h2),'E7 …và cũng không lọt "undefined"');
  ok(/Mr\. KIM JONG SU/.test(h2),
     'E8 ★ tên người Hàn hiện ĐẦY ĐỦ, không rút thành "Mr. JONG SU"',
     (/>([^<]*KIM[^<]*)</.exec(h2)||[])[1]);
  ok(/class="av">KJ</.test(h2),'E8 avatar lấy 2 chữ ĐẦU (họ Hàn đứng trước)',
     (/class="av">([^<]*)</.exec(h2)||[])[1]);
  const h3=call(sb,'noSelfHomeHtml',['sec']);
  ok(/class="av">QV</.test(h3),'E8 tên Việt vẫn lấy 2 chữ cuối như cũ',
     (/class="av">([^<]*)</.exec(h3)||[])[1]);
}

console.log('\n════════════════════════════════════');
console.log((fail?'✗ HỎNG '+fail+' / ':'✓ ĐẠT HẾT ')+(pass+fail)+' bài');
console.log('════════════════════════════════════');
process.exit(fail?1:0);
