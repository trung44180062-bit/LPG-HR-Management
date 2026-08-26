/* Harness kiểm tra logic bản v8.9:
     · mẫu ca tự khai (parseShiftPattern / genForEmp shiftType='custom')
     · tái cơ cấu nhóm (js/24-reorg.js): lịch trộn trước/sau mốc, hoàn tác
     · lịch tàu nhiều phương án (js/25-vessel.js): chốt PA, thu hồi PA sai
     · tin Zalo cho hai tính năng trên (js/21-notify.js)

   Chạy: node _test/harness-v89.js   (từ thư mục LPGT-CongCa-Web)

   Cách làm giống harness-v58.js: nối các file JS thuần logic rồi chạy CHUNG
   một scope vm — `let S` ở 01-core.js là khai báo lexical, không gắn vào
   globalThis nên không với tới được từ ngoài. */
const fs=require('fs'),vm=require('vm');
const ctx={console,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  Date,Math,JSON,Set,Map,Object,Array,String,Number,Boolean,RegExp,Error,
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,
            createElement:()=>({}),addEventListener:()=>{},body:{classList:{add(){},remove(){},toggle(){}}}},
  matchMedia:()=>({matches:false}),
  confirm:()=>true,prompt:()=>'',alert:()=>{},process};
ctx.window=ctx;ctx.globalThis=ctx;ctx.APP_CFG={};
vm.createContext(ctx);
const src=f=>fs.readFileSync(f,'utf8');

const stub=`
  var t=s=>s, t2=s=>s, LANG='vi';
  var toast=()=>{};
  var _toasts=[];
  toast=m=>{_toasts.push(String(m));};
  function addDaysIso(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoOf(d);}
  function newNotif(o){const id=uid();S.notifs[id]=Object.assign({id,status:'pending',createdAt:Date.now()},o);
    if(typeof zaloEnqueue==='function')zaloEnqueue(S.notifs[id]);return id;}
  function notifDrop(fn){let n=0;for(const k in S.notifs){if(fn(S.notifs[k])){delete S.notifs[k];n++;}}return n;}
  var _me='trung', meId=()=>_me;
  var save=()=>{S.rev=(S.rev||0)+1;};
  var hrGuard=()=>true, canEditSched=()=>true;
  var renderAll=()=>{}, renderCal=()=>{}, renderMe=()=>{}, renderSetup=()=>{},
      renderBoth=()=>{}, fillMonthSelects=()=>{}, refreshBadge=()=>{},
      renderVesselMgr=()=>{}, renderReorgMgr=()=>{},
      uiSnap=()=>null, uiRestore=()=>{},
      posLabel=()=>'';
  /* posCode phải đọc THẬT e.pos — cơ cấu 2 nhóm chia người theo vị trí, stub
     trả cứng 'operator' thì test không kiểm được đúng phép chia. */
  function posCode(e){return (e&&e.pos)||'operator';}
  var zaloOn=()=>false;   /* không bắn tin thật; test gọi thẳng zaloLines() */
`;

/* 21-notify.js có vài lệnh chạy ở mức file (khởi tạo hộp gửi) nhưng không
   chạm DOM — nạp cả file để dùng đúng bản zaloLines/zaloTitle thật. */
const all=[
  src('js/01-core.js'),stub,
  src('js/04-schedule.js'),
  src('js/20-events.js'),
  src('js/24-reorg.js'),
  src('js/25-vessel.js'),
  src('js/21-notify.js'),
  src('_test/harness-v89.tests.js')
].join('\n;\n');
vm.runInContext(all,ctx,{filename:'harness-v89'});
