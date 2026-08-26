/* Kiểm tra DỰNG HTML của hai màn mới (v8.9) bằng DOM giả — sandbox không cài
   được jsdom/chromium nên chỉ cần chắc: gọi ra HTML, không ném lỗi, và có
   đúng những mảnh giao diện quan trọng.

   Chạy: node _test/render-v89.js   (từ thư mục LPGT-CongCa-Web) */
const fs=require('fs'),vm=require('vm');
let pass=0,fail=0;
const boxes={};
const mkEl=id=>({id,innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},
                 querySelectorAll:()=>[],appendChild(){},value:'',options:[],dataset:{}});
const ctx={console,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  Date,Math,JSON,Set,Map,Object,Array,String,Number,Boolean,RegExp,Error,
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  matchMedia:()=>({matches:false}),
  confirm:()=>true,prompt:()=>'D D N N R R',alert:()=>{},process};
ctx.document={
  getElementById:id=>(boxes[id]=boxes[id]||mkEl(id)),
  querySelector:()=>null,querySelectorAll:()=>[],
  createElement:()=>mkEl(''),addEventListener:()=>{},
  body:{classList:{add(){},remove(){},toggle(){}}}
};
ctx.window=ctx;ctx.globalThis=ctx;ctx.APP_CFG={};
vm.createContext(ctx);
const src=f=>fs.readFileSync(f,'utf8');
const stub=`
  var t=s=>s, t2=s=>s, LANG='vi';
  var toast=()=>{};
  function addDaysIso(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoOf(d);}
  function newNotif(o){const id=uid();S.notifs[id]=Object.assign({id,status:'pending',createdAt:Date.now()},o);return id;}
  function notifDrop(fn){let n=0;for(const k in S.notifs){if(fn(S.notifs[k])){delete S.notifs[k];n++;}}return n;}
  var _me='trung', meId=()=>_me;
  var save=()=>{S.rev=(S.rev||0)+1;};
  var hrGuard=()=>true, canEditSched=()=>true;
  var renderAll=()=>{}, renderCal=()=>{}, renderMe=()=>{}, renderSetup=()=>{},
      renderBoth=()=>{}, fillMonthSelects=()=>{}, refreshBadge=()=>{},
      uiSnap=()=>null, uiRestore=()=>{};
  var posLabel=()=>'Operator';
  function posCode(e){return (e&&e.pos)||'operator';}
  var zaloOn=()=>false, zaloEnqueue=()=>{};
`;
const tests=`
S.employees=[
 {id:'k1',name:'Kỹ sư A1',team:'A',role:'eng',pos:'field_eng',shiftType:'type1',a1:'2026-09-01',active:true},
 {id:'k2',name:'Kỹ sư B1',team:'B',role:'eng',pos:'boardman',shiftType:'type1',a1:'2026-09-03',active:true},
 {id:'o1',name:'Oper A2', team:'A',role:'oper',pos:'operator',shiftType:'type1',a1:'2026-09-01',active:true},
 {id:'trung',name:'Hoàng Trung',team:'Office',role:'other',shiftType:'none',active:true}
];
S.base={};S.over={};S.notifs={};S.events={};S.reorgs={};S.requests={};
S.settings=S.settings||{};S.settings.hours={};S.settings.customCodes=[];S.rev=1;
S.employees.forEach(e=>{const g=genForEmp(e,daysOfPeriod('2026-09'));S.base[e.id]=Object.assign({},g);});

const ok=(n,c,x)=>{if(c){pass++;console.log('  ✓',n);}else{fail++;console.log('  ✗',n,x!==undefined?JSON.stringify(x).slice(0,200):'');}};

console.log('\\n[A] THANH CƠ CẤU TỔ (trong thẻ Tạo lịch)');
renderStructBar();
var h=$('structBar').innerHTML;
ok('thanh cơ cấu dựng được',h.length>200,h.length);
ok('nói rõ cơ cấu đang chạy',h.indexOf('Cơ cấu tổ đang chạy')>=0);
ok('có nút 2 nhóm DCS \/ Field',h.indexOf("preset:'2team'")>=0);
ok('có nút 4 nhóm',h.indexOf("preset:'4team'")>=0);
ok('có nút Biến động nhân sự mở từ Bước 1',h.indexOf("openReorgMgr\('form',\{step:1\}\)")>=0);
ok('có nút lịch sử',h.indexOf("openReorgMgr\('list'\)")>=0);

console.log('\\n[B] TRÌNH 3 BƯỚC');
roNewDraft();renderReorgMgr();
h=$('roBody').innerHTML;
ok('mở ra là Bước 1',h.indexOf('rost on')>=0&&h.indexOf('Chuyện gì xảy ra')>=0);
ok('Bước 1 có đủ 4 loại việc',(h.split('class="rok').length-1)===4);
ok('có ô người nghỉ việc ngay ở Bước 1',h.indexOf('Có người nghỉ việc')>=0);
ok('nút Tiếp có mặt',h.indexOf('roGoStep\(2\)')>=0);

roToggleKind('leave');
roGoStep(2);h=$('roBody').innerHTML;
ok('Bước 2 hỏi ngày áp dụng',h.indexOf('Áp dụng từ ngày')>=0);
ok('Bước 2 có nút nhanh đầu kỳ sau / hôm nay',h.indexOf('đầu kỳ sau')>=0&&h.indexOf('hôm nay')>=0);

roEff='2026-09-05';roTo='2026-09-20';
roGoStep(3);h=$('roBody').innerHTML;
ok('Bước 3 hiện khối Người nghỉ việc',h.indexOf('Người nghỉ việc')>=0);
ok('Bước 3 hiện khối Cơ cấu nhóm',h.indexOf('Cơ cấu nhóm')>=0);
ok('KHÔNG hiện khối chưa tích (người mới vào)',h.indexOf('roToggleJoiner')<0);
ok('mỗi người có nút bấm chọn nghỉ việc',h.indexOf("roToggleLeaver\('k1'\)")>=0);
ok('có 3 nút cơ cấu dựng sẵn',(h.split('class="rop').length-1)>=3,(h.split('class="rop').length-1));

roToggleLeaver('k2');h=$('roBody').innerHTML;
ok('chọn xong hiện ô ngày làm việc cuối',h.indexOf("roSetLastDay\('k2'")>=0);
ok('chip tóm tắt đếm người nghỉ việc',h.indexOf('rosum lv')>=0);

ok('có bảng nhóm đích',h.indexOf('ro-ttbl')>=0||h.indexOf('ro-teams empty')>=0);
ok('cột Nhóm mới là DROPDOWN, không phải ô gõ tay',h.indexOf('roAssignTeam(')>=0);
ok('có nhắc thêm người nghỉ việc khi chưa tích',h.indexOf('ro-tip')<0);

roApplyPreset('2team');h=$('roBody').innerHTML;
ok('bấm cơ cấu 2 nhóm là chia sẵn người',h.indexOf('tr class="chg"')>=0);
ok('bảng nhóm đích hiện ra sau khi bấm preset',h.indexOf('ro-ttbl')>=0);
ok('mỗi nhóm có mẫu ca RIÊNG (DCS 8 ngày, Field 6 ngày)',
   roTeamByName('DCS').shiftType==='type1'&&roTeamByName('Field').shiftType==='type2');
ok('bảng nhóm đích đếm số người',h.indexOf('class="ct"')>=0);
ok('có nút thêm nhóm',h.indexOf('roAddTeam()')>=0);
ok('có ô xếp người đã tích vào nhóm',h.indexOf('roBulkTo(')>=0);
ok('chip tóm tắt đếm người đổi nhóm',h.indexOf('rosum mv')>=0);
ok('hết cảnh báo khi đã hợp lệ',h.indexOf('pv-alert warn')<0,roValidate());

/* đổi mẫu ca của MỘT nhóm → cả nhóm ăn theo, nhóm kia không đụng */
const iF=roTeams.findIndex(x=>x.name==='Field');
roSetTeam(iF,'shiftType','custom');
roSetTeam(iF,'pattern','D D N N R R');
ok('đổi mẫu ca ở bảng nhóm là cả nhóm ăn theo',
   roTeamMembers('Field').every(e=>roMoves[e.id].pattern==='D D N N R R'));
ok('nhóm kia KHÔNG bị đụng',
   roTeamMembers('DCS').every(e=>roMoves[e.id].shiftType==='type1'));

roShowPv=true;renderReorgMgr();h=$('roBody').innerHTML;
ok('bảng xem trước dựng được',h.indexOf('ro-pvtbl')>=0);
ok('xem trước có vạch chuyển ở ngày áp dụng',h.indexOf('cut"')>=0);

roToggleKind('join');roToggleKind('pause');renderReorgMgr();
h=$('roBody').innerHTML;
ok('tích thêm là hiện khối Người mới vào',h.indexOf('roToggleJoiner')>=0);
ok('tích thêm là hiện khối Nghỉ dài hạn',h.indexOf('roTogglePause')>=0);
roTogglePause('o1');h=$('roBody').innerHTML;
ok('nghỉ dài hạn có ô chọn mã nghỉ',h.indexOf("roSetPause\('o1','code'")>=0);

roView='list';renderReorgMgr();
ok('tab lịch sử dựng được',$('roBody').innerHTML.indexOf('ro-it')>=0||$('roBody').innerHTML.indexOf('Chưa có đợt')>=0);

console.log('\\n[B] MÀN LỊCH TÀU');
vsNewDraft();vsView='form';renderVesselMgr();
h=$('vsBody').innerHTML;
ok('form dựng được',h.length>500,h.length);
ok('mặc định có 2 phương án',(h.match(/vsRmOpt\\(/g)||[]).length===2);
ok('có nút thêm phương án',h.indexOf('vsAddOpt\\(\\)')>=0);
vsAddOpt();renderVesselMgr();
ok('thêm được phương án thứ 3',vsOpts.length===3);

vsVessel='VLGC GAS SUN';vsNotify=false;
vsSave();
ok('lưu tạo ra 3 sự kiện',Object.keys(S.events).length===3,Object.keys(S.events));
vsView='list';renderVesselMgr();
h=$('vsBody').innerHTML;
ok('danh sách chuyến dựng được',h.indexOf('vs-pl')>=0);
ok('mỗi phương án có nút Chốt',(h.match(/vsFix\\(/g)||[]).length===3);
ok('nhãn PA hiện đủ',(h.match(/class="pa"/g)||[]).length>=3);

const plan=vsPlans()[0];
vsFix(plan.plan,plan.opts[1].id);
renderVesselMgr();
h=$('vsBody').innerHTML;
ok('chốt xong chỉ còn 1 phương án',Object.keys(S.events).length===1,Object.keys(S.events));
ok('hiện trạng thái đã chốt',h.indexOf('đã chốt')>=0);
ok('không còn nút Chốt',h.indexOf('vsFix\\(')<0);

console.log('\\n────────────────────────');
console.log(pass+' đạt · '+fail+' hỏng');
if(fail)process.exitCode=1;
`;
const all=[src('js/01-core.js'),stub,src('js/04-schedule.js'),src('js/20-events.js'),
  src('js/05-roster.js'),src('js/24-reorg.js'),src('js/25-vessel.js'),
  'let pass=0,fail=0;',tests].join('\n;\n');
vm.runInContext(all,ctx,{filename:'render-v89'});
