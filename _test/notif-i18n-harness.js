/* ============================================================
   HARNESS — CHỮ THÔNG BÁO THEO NGÔN NGỮ ĐANG XEM   ★ v7.6
   ------------------------------------------------------------
   Chạy:  node _test/notif-i18n-harness.js
   ------------------------------------------------------------
   Lỗi người dùng báo: Quản lý người Hàn bật giao diện EN nhưng chuông
   vẫn toàn tiếng Việt.

   Nguyên nhân: n.text dựng LÚC TẠO bằng ngôn ngữ NGƯỜI TẠO rồi cất xuống
   Firebase — một chuỗi đã đông cứng, nút EN/VI không chạm tới được.

     A. tf() — dịch câu có chỗ trống, giữ nguyên phần {…}
     B. Tin về ĐƠN đổi theo ngôn ngữ đang xem
     C. Tin sự kiện / đào tạo cũng vậy
     D. Tin phản hồi hai chiều (nhóm C)
     E. Bản dự phòng: bản ghi gốc đã xoá → vẫn ra chữ, không để trống
     F. Không nơi nào còn vẽ thẳng n.text
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m+(x!==undefined?'   ['+x+']':''));}
                   else{fail++;console.log('  ✗ '+m+(x!==undefined?'   ['+x+']':''));}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

function build(){
  const sb={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,
    setTimeout(){},clearTimeout,setInterval:()=>0,clearInterval:()=>0,isNaN,parseInt,parseFloat};
  sb.globalThis=sb;sb.window=sb;
  sb.document={addEventListener(){},querySelectorAll(){return [];},getElementById(){return null;}};
  sb.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  vm.createContext(sb);
  vm.runInContext(`
    function toast(){} function confirm(){return true;}
    var rnd1=v=>Math.round(v*10)/10;
    function zaloEnqueue(){} function notifDrop(){return 0;}
    function shortName(n){var s=String(n||'').trim();
      if(/^mr\\.?\\s+/i.test(s))return s;
      var w=s.split(/\\s+/).filter(Boolean);return w.slice(-2).join(' ')||s;}
    function save(cb){if(cb)cb(true);}
    function renderCal(){}function renderMe(){}function renderAppr(){}function renderAll(){}
    function fillMonthSelects(){}function refreshBadge(){}function mondayOf(i){return i;}
    function permOf(id){var e=(S.employees||[]).find(x=>x.id===id);return (e&&e.perm)||'staff';}
    function teamList(){return ['A'];}
    var ROOT_ADMIN='sc';
    function reqNextLevel(r){return r.next||'kmgr';}
    function newNotif(){} function notifyApprovers(){} function cancelReq(){}
    function defaultNoPrint(){return true;}
  `,sb);
  vm.runInContext(rd('01-core.js'),sb);
  /* i18n THẬT — đây chính là thứ đang kiểm, không được thay bằng hàm giả.
     Nạp SAU 01-core.js vì nó dùng hằng LS của core (đúng thứ tự trong
     index.html: 01-core → 14-i18n). */
  vm.runInContext(rd('14-i18n.js'),sb);
  vm.runInContext(`
    function addDaysIso(iso,n){var d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoOf(d);}
    function baseShiftOf(c){return c==='D'?'D':(c==='N'?'N':(c==='O'?'O':null));}
  `,sb);
  vm.runInContext(rd('04-schedule.js'),sb);
  vm.runInContext(rd('20-events.js'),sb);
  vm.runInContext(rd('22-training.js'),sb);
  vm.runInContext(`function toast(){}`,sb);
  /* Khối chữ thông báo lấy NGUYÊN VĂN từ js/13-portal.js (cắt theo mốc chú
     thích, không theo số dòng) + REQ_LABEL mà nó dùng. */
  const src=rd('13-portal.js');
  const i=src.indexOf('/* Câu cho tin liên quan tới ĐƠN');
  const j=src.indexOf('/* Toàn bộ thông báo gửi tới id');
  if(i<0||j<0)throw new Error('không tìm thấy khối notifText trong js/13-portal.js');
  const rl=src.slice(src.indexOf('const REQ_LABEL='),src.indexOf('const REQ_ICON ='));
  vm.runInContext(rl+'\n'+src.slice(i,j),sb);
  vm.runInContext(`
    S.employees=[
      {id:'e1',name:'Vũ Ngọc Quốc',team:'A',perm:'staff',active:true,shiftType:'shift'},
      {id:'sc',name:'Nguyễn Hoàng Trung',team:'Office',perm:'admin',active:true,shiftType:'none'},
      {id:'km',name:'Mr. Kim Ji Min',team:'Office',perm:'kmgr',active:true,shiftType:'none'}
    ];
    S.base={e1:{'2026-08-07':'D'}};S.over={};S.notifs={};S.del={};
    S.requests={r1:{id:'r1',type:'ot',empId:'e1',status:'pending',from:'2026-08-07',to:'2026-08-07',
                    days:[{iso:'2026-08-07',code:'OTD',hours:4}]}};
    S.events={ev1:{id:'ev1',title:'VLGC unloading C3/C4 23k MT',from:'2026-08-07',to:'2026-08-08',
                   note:'Có thể không chạy boosting',scope:'all',notify:true}};
    S.trainings={tr1:{id:'tr1',title:'AI using training',days:['2026-08-18'],emps:['e1'],
                      mode:'shift',timeIn:'08:00',timeOut:'17:00',noLunch:true,status:'active',by:'sc'}};
    S.settings={hours:{},customCodes:[]};S.meta={};S.rev=1;
    secr=true;mgr=true;adm=true;noSelf=true;
    globalThis.__me='km';
  `,sb);
  vm.runInContext(`function meId(){return globalThis.__me;}`,sb);
  sb.setLang=L=>vm.runInContext(`LANG='${L}';`,sb);
  return sb;
}
const call=(sb,fn,args)=>{sb.__args=args||[];
  return vm.runInContext(`(function(){return ${fn}.apply(null,__args);})()`,sb);};
const VN=/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
/* TÊN NGƯỜI là dữ liệu, cố ý KHÔNG dịch — phải bóc ra trước khi soi chữ Việt,
   không thì bài kiểm báo đỏ ở đúng chỗ sản phẩm đang làm đúng. */
const NAMES=['Vũ Ngọc Quốc','Nguyễn Hoàng Trung','Mr. Kim Ji Min','Ngọc Quốc','Hoàng Trung'];
function noNames(s){let x=String(s||'');NAMES.forEach(n=>{x=x.split(n).join('');});return x;}

/* ============================================================ */
head('A. tf() — dịch câu có chỗ trống');
{
  const sb=build();
  sb.setLang('vi');
  ok(call(sb,'tf',['Đơn {type} bị TỪ CHỐI',{type:'Tăng ca'}])==='Đơn Tăng ca bị TỪ CHỐI',
     'A1 tiếng Việt điền đúng chỗ trống',call(sb,'tf',['Đơn {type} bị TỪ CHỐI',{type:'Tăng ca'}]));
  sb.setLang('en');
  ok(call(sb,'tf',['Đơn {type} bị TỪ CHỐI',{type:'Overtime'}])==='Overtime request REJECTED',
     'A1 ★ tiếng Anh xếp lại trật tự từ',call(sb,'tf',['Đơn {type} bị TỪ CHỐI',{type:'Overtime'}]));
  ok(call(sb,'tf',['Đơn {type} bị TỪ CHỐI',{}]).indexOf('{type}')<0,
     'A2 thiếu biến thì chỗ trống bị xoá, không lòi "{type}" ra màn hình');
  ok(call(sb,'tf',['chuỗi không có trong từ điển',{a:1}])==='chuỗi không có trong từ điển',
     'A3 khoá lạ trả về chính nó, không vỡ');
}

/* ============================================================ */
head('B. Tin về ĐƠN');
{
  const sb=build();
  const n={kind:'info',zk:'apprNeed',to:'km',from:'e1',reqId:'r1',lvl:'kmgr',
           text:'📥 Đơn Tăng ca của Vũ Ngọc Quốc đang chờ Quản lý người Hàn duyệt · 07/08'};
  sb.setLang('vi');
  const vi=call(sb,'notifText',[n]);
  ok(/Đơn Tăng ca của Vũ Ngọc Quốc/.test(vi),'B1 tiếng Việt giữ nguyên như cũ',vi);
  sb.setLang('en');
  const en=call(sb,'notifText',[n]);
  ok(!VN.test(noNames(en)),'B2 ★ tiếng Anh KHÔNG còn chữ Việt (trừ tên người)',en);
  ok(/Overtime request from/.test(en),'B2 dịch đúng loại đơn và câu',en);
  ok(/Vũ Ngọc Quốc/.test(en),'B3 TÊN NGƯỜI giữ nguyên — tên là dữ liệu, không dịch');
  ok(/Korean manager/.test(en),'B3 ★ CHỨC DANH cấp duyệt dịch sang EN (lvlLabel qua t())',en);
  ok(/\(Mr\. Kim Ji Min\)/.test(en),'B3 …còn TÊN trong ngoặc giữ nguyên');

  ['approved','rejected','revoked','cancelled','provapproved','fe'].forEach(zk=>{
    const x=call(sb,'notifText',[{kind:'info',zk,to:'km',reqId:'r1'}]);
    ok(x&&!VN.test(noNames(x)),'B4 zk="'+zk+'" ra tiếng Anh sạch',x);
  });
  /* Lý do từ chối là chữ người dùng gõ → giữ nguyên */
  vm.runInContext(`S.requests.r1.reason='Vượt định mức tăng ca tháng';`,sb);
  const rj=call(sb,'notifText',[{kind:'info',zk:'rejected',to:'km',reqId:'r1'}]);
  ok(/Vượt định mức tăng ca tháng/.test(rj),'B5 lý do NGƯỜI DÙNG GÕ giữ nguyên, không dịch bậy',rj);
}

/* ============================================================ */
head('C. Tin sự kiện & đào tạo');
{
  const sb=build();
  const nev={kind:'event',to:'km',evId:'ev1',iso:'2026-08-07',
             text:'Sự kiện trên lịch: VLGC unloading — 07/08 → 08/08'};
  sb.setLang('vi');
  ok(/Sự kiện trên lịch/.test(call(sb,'notifText',[nev])),'C1 tiếng Việt như cũ');
  sb.setLang('en');
  const en=call(sb,'notifText',[nev]);
  ok(/Calendar event/.test(en),'C1 ★ tiếng Anh: "Calendar event"',en);
  ok(/VLGC unloading C3\/C4 23k MT/.test(en),'C1 tên sự kiện giữ nguyên (là dữ liệu)');
  ok(/Có thể không chạy boosting/.test(en),'C1 ghi chú người dùng gõ cũng giữ nguyên');

  const ntr={kind:'training',to:'e1',trId:'tr1',trSt:'active',text:'🎓 Bạn có lịch đào tạo: …'};
  const entr=call(sb,'notifText',[ntr]);
  ok(/You have training scheduled/.test(entr),'C2 ★ tin đào tạo ra tiếng Anh',entr);
  ok(/AI using training/.test(entr),'C2 tên buổi học giữ nguyên');
  ok(/08:00–17:00/.test(entr),'C2 vẫn ghi rõ giờ học');
  const npd=call(sb,'notifText',[{kind:'training',to:'sc',trId:'tr1',trSt:'pending'}]);
  ok(/awaiting approval|Training awaiting/i.test(npd),'C3 bản chờ duyệt dùng câu khác',npd);
}

/* ============================================================ */
head('D. Phản hồi hai chiều');
{
  const sb=build();
  sb.setLang('en');
  const t1=call(sb,'notifText',[{kind:'info',zk:'swapNo',to:'e1',from:'sc',iso:'2026-08-07'}]);
  ok(/DECLINED the shift swap/.test(t1)&&/07\/08/.test(t1),'D1 từ chối đổi ca',t1);
  const t2=call(sb,'notifText',[{kind:'info',zk:'coverNo',to:'e1',from:'sc',iso:'2026-08-07'}]);
  ok(/DECLINED the OT cover/.test(t2),'D2 từ chối OT cover',t2);
  const t3=call(sb,'notifText',[{kind:'info',zk:'schedRevoke',to:'e1',from:'sc',
                                 iso:'2026-08-07',std:'D'}]);
  ok(/withdrew the schedule change/.test(t3)&&/\bD\b/.test(t3),'D3 thu hồi đổi lịch, có mã ca chuẩn',t3);
  ok(!VN.test(noNames(t1+t2+t3)),'D4 ★ cả ba câu không lọt chữ Việt');
}

/* ============================================================ */
head('E. Bản dự phòng');
{
  const sb=build();
  sb.setLang('en');
  const old={kind:'info',zk:'apprNeed',to:'km',reqId:'da-xoa',
             text:'📥 Đơn Tăng ca của ai đó đang chờ duyệt'};
  ok(call(sb,'notifText',[old])===old.text,
     'E1 ★ đơn đã bị xoá → rơi về câu đã lưu, KHÔNG để dòng trống',call(sb,'notifText',[old]));
  ok(call(sb,'notifText',[{kind:'info',to:'km'}])==='','E2 tin rỗng ra chuỗi rỗng, không vỡ');
  ok(call(sb,'notifText',[null])==='','E3 null cũng không vỡ');
  const weird={kind:'event',to:'km',evId:'khong-co',text:'câu cũ'};
  ok(call(sb,'notifText',[weird])==='câu cũ','E4 sự kiện đã xoá cũng rơi về câu cũ');
}

/* ============================================================ */
head('F. Đã nối vào giao diện');
{
  const p=rd('13-portal.js');
  ok(!/esc\(n\.text\|\|''\)/.test(p),'F1 ★ không còn chỗ nào vẽ thẳng n.text');
  ok((p.match(/esc\(notifText\(n\)\)/g)||[]).length===3,
     'F1 cả ba khối chuông (sự kiện · đào tạo · thông báo) đều qua notifText',
     (p.match(/esc\(notifText\(n\)\)/g)||[]).length);
  ok(/function tf\(key,vars\)/.test(rd('14-i18n.js')),'F2 tf() nằm ở js/14-i18n.js');
  const i=rd('14-i18n.js');
  ok(/renderMyPanel\(\)/.test(i)&&/renderTrainMgr\(\)/.test(i),
     'F3 ★ đổi ngôn ngữ có VẼ LẠI chuông & các hộp thoại đang mở');
  ok(/lvlLabel==='function'\)\?t\('Quản lý người Hàn'\)|t\('Quản lý người Hàn'\)/.test(rd('01-core.js')),
     'F4 lvlLabel dịch được chức danh cấp duyệt');
}

console.log('\n════════════════════════════════════');
console.log((fail?'✗ HỎNG '+fail+' / ':'✓ ĐẠT HẾT ')+(pass+fail)+' bài');
console.log('════════════════════════════════════');
process.exit(fail?1:0);
