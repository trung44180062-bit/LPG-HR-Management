/* ============================================================
   HARNESS v7.9 — SECTION CHIEF DUYỆT LÀ XONG VIỆC
   ------------------------------------------------------------
   Chạy:  node _test/approve-v79-harness.js
   ------------------------------------------------------------
   BỐI CẢNH (người dùng nêu 2026-08-12)

   Quản lý người Hàn gần như không mở app, nên mọi đơn dừng ở nhãn
   "TẠM DUYỆT (chờ Quản lý người Hàn chốt)". Nhân viên đọc thành "đơn tôi
   chưa xong" → hỏi lại, lo lắng, trong khi lịch thực tế đã ghi và họ đã đi
   làm theo. Yêu cầu: Hoàng Trung duyệt là CHÍNH THỨC và xong việc; cấp cuối
   vẫn ghi nhận được, vẫn có thông báo, nhưng nói theo hướng trân trọng chứ
   không phải "còn treo", và KHÔNG lặp lại trong bản tin 08:00.

   A. Nhãn trạng thái
      A1 đơn qua Section Chief → nhãn 'ĐÃ DUYỆT', không còn 'TẠM DUYỆT'
      A2 dấu phụ "chờ ghi nhận" CHỈ người duyệt thấy
      A3 nhân viên thường không thấy dấu phụ đó

   B. Thông báo khi Section Chief duyệt
      B1 các bên nhận đúng MỘT tin, mở đầu bằng ✅ và chữ DUYỆT
      B2 tin đó mang zk 'approved' (đi chung đường kết quả duyệt)
      B3 không còn tin nào mang zk 'provapproved'
      B4 cấp cuối nhận tin zk 'finalNote', chữ "ghi nhận" chứ không "chờ duyệt"

   C. Khi cấp cuối ghi nhận sau đó
      C1 sinh tin kind 'final' (chỉ trong app)
      C2 KHÔNG bắn thêm tin 'approved' lần hai cho các bên
      C3 đơn hết provisional → dấu phụ biến mất

   D. Kênh Zalo & bản tin 08:00 (js/21-notify.js)
      D1 finalNote → kênh 'digest'; final → không gửi Zalo
      D2 finalNote gom bất kể loại đơn (kể cả nghỉ phép)
      D3 sổ chờ tự loại finalNote khi cấp cuối đã ghi nhận
      D4 tiêu đề & lời kết của finalNote nói "đã duyệt, đang áp dụng"
      D5 tin 'approved' của đơn chờ ghi nhận có câu trấn an cuối

   E. Đơn cần duyệt nằm ngoài bộ lọc đang xem
      E1 đơn ở kỳ khác vẫn tính vào việc-của-tôi nhưng KHÔNG lọt danh sách
      E2 apprShowOutside() mở đủ rộng để thấy chúng (kể cả đơn chờ ghi nhận)
   ============================================================ */
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m+(x!==undefined?'   ['+x+']':''));}
                   else{fail++;console.log('  ✗ '+m+(x!==undefined?'   ['+x+']':''));}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

/* ------------------------------------------------------------
   Sandbox A–C & E: nạp CODE THẬT với DOM giả (kiểu perm-v77-appr-harness)
   ------------------------------------------------------------ */
const elStub=()=>({value:'',innerHTML:'',style:{},textContent:'',onchange:null,options:[],
  classList:{add(){},remove(){},toggle(){},contains(){return false}},dataset:{},
  querySelectorAll:()=>[],querySelector:()=>null,appendChild(){},scrollIntoView(){},
  addEventListener(){},selectedIndex:0,checked:false});

function build(){
  const els={};
  const ctx={console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Set,Map,Error,
    isNaN,parseInt,parseFloat,setTimeout,clearTimeout,setInterval,clearInterval,
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    document:{querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},
      getElementById:id=>(els[id]=els[id]||elStub()),
      body:{classList:{add(){},remove(){},toggle(){}}},
      documentElement:{setAttribute(){},lang:'vi'},createElement:()=>elStub(),head:{appendChild(){}}},
    window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},scrollTo(){}},
    navigator:{},crypto:{},location:{reload(){}},alert(){},confirm:()=>true,prompt:()=>'',
    __T:[],__N:[]};
  ctx.globalThis=ctx;ctx.window=ctx.window||ctx;ctx.scrollTo=()=>{};
  vm.createContext(ctx);
  ['config.js','01-core.js','14-i18n.js','04-schedule.js','05-roster.js','06-calendar.js',
   '07-manpower.js','08-requests.js','10-account.js','11-stats-data.js','18-advice.js']
    .forEach(f=>{try{vm.runInContext(rd(f),ctx,{filename:f});}
                 catch(e){console.log('  ! nạp '+f+': '+e.message);}});
  vm.runInContext(`
    toast=function(m){__T.push(String(m));};
    save=function(){}; renderSetup=function(){}; renderBoth=function(){};
    renderAll=function(){}; applyRoleUI=function(){}; refreshBadge=function(){};
    fillMonthSelects=function(){}; renderMe=function(){}; renderGate=function(){};
    renderReal=function(){}; renderAppr=function(){}; renderApprTabs=function(){};
    posSelectHtml=function(){return '';}; ensureAccount=function(){};
    usingDefaultPw=function(){return true;}; i18nApply=function(){}; icApply=function(){};
    /* Gom mọi thông báo để soi nội dung & zk — đây chính là thứ đang xét */
    newNotif=function(o){var id='n'+(__N.length+1);o=Object.assign({id:id},o);
      __N.push(o);S.notifs[id]=o;return id;};
    notifDrop=function(){return 0;}; sweepStaleNotifs=function(){};
    notifDropForReq=function(){return 0;};
    renderMyPanel=function(){}; refreshPrintBadge=function(){}; refreshMealBadge=function(){};
    refreshTrainBadge=function(){}; refreshBellBadge=function(){};
    trCellCls=function(){return '';}; trCellTitle=function(){return '';};
    zaloQueue=function(){}; digestPush=function(){}; zaloEnqueue=function(){};
    _me=null; meId=function(){return _me;};
    /* REQ_LABEL / REQ_ICON khai ở js/13-portal.js — file đó kéo theo cả DOM
       nên chép nguyên bảng nhãn vào đây, y như các harness khác vẫn làm. */
    var REQ_LABEL={leave:'Nghỉ phép',swap:'Đổi ca',ot:'Tăng ca',change:'Đổi mã ca',
                   wt:'Bổ sung công',late:'Đi trễ / Về sớm',multi:'Làm liên tục nhiều ngày'};
    var REQ_ICON={leave:'🏖',swap:'🔄',ot:'⚡',change:'✏️',wt:'🪪',late:'⏰',multi:'🔁'};

    S.employees=[
      {id:'e1',name:'NGUYEN VAN A',pos:'operator', team:'A',perm:'staff',active:true,shiftType:'shift'},
      {id:'fe1',name:'TRAN VAN FE',pos:'field_eng',team:'A',perm:'appr', active:true,shiftType:'shift'},
      {id:'trung',name:'HOANG TRUNG',pos:'office', team:'', perm:'admin',active:true,shiftType:'none'},
      {id:'kr',name:'KIM',           pos:'office', team:'', perm:'kmgr', active:true,shiftType:'none'}
    ];
    S.base={};S.over={};S.requests={};S.notifs={};S.del={};
    S.meta={schedFrom:'2026-07-21',schedTo:'2026-09-20'};S.rev=1;
    ['e1'].forEach(function(id){S.base[id]={};
      ['2026-08-10','2026-08-11','2026-09-01'].forEach(function(iso){S.base[id][iso]='O';});});
  `,ctx);
  return ctx;
}
const G=(ctx,expr)=>vm.runInContext(expr,ctx);
/* ROOT_ADMIN quyết định ai là cấp 'trung' — lấy đúng giá trị app đang dùng */
function setMe(ctx,id,role){
  G(ctx,`_me=${JSON.stringify(id)};
         mgr=${role!=='staff'};adm=${role==='admin'||role==='kmgr'};
         hrm=${role==='admin'||role==='kmgr'};secr=${role!=='staff'};
         myFE=${role==='fe'};noSelf=false;`);
}
function newReq(ctx,id,iso,type){
  G(ctx,`S.requests[${JSON.stringify(id)}]={id:${JSON.stringify(id)},type:${JSON.stringify(type||'ot')},
    empId:'e1',byId:'e1',status:'pending',createdAt:Date.now(),
    from:${JSON.stringify(iso)},to:${JSON.stringify(iso)},
    days:[{iso:${JSON.stringify(iso)},code:'OTO',timeIn:'08:00',timeOut:'17:00',hours:8}],
    code:'OTO',appr:{}};`);
}

/* ============================================================ */
head('A. Nhãn trạng thái');
{
  const c=build();
  const RA=G(c,'typeof ROOT_ADMIN!=="undefined"?ROOT_ADMIN:""');
  /* Cho Hoàng Trung của bộ dữ liệu giả trùng với ROOT_ADMIN thật của app,
     nếu không thì apprLevelOf() coi anh ta là cấp khác và cả bài thử lệch. */
  if(RA)G(c,`S.employees.find(e=>e.id==='trung').id=${JSON.stringify(RA)};`);
  const TRUNG=RA||'trung';
  newReq(c,'r1','2026-08-10');
  setMe(c,TRUNG,'admin');
  G(c,`decide('r1',true);`);
  const r=G(c,'S.requests.r1');
  ok(r.status==='approved','A0 Section Chief duyệt → đơn ở trạng thái đã duyệt',r.status);
  ok(G(c,'reqIsProvisional(S.requests.r1)')===true,'A0 …và vẫn chờ cấp cuối ghi nhận (cơ chế giữ nguyên)');
  ok(G(c,'reqStatusLabel(S.requests.r1)')==='ĐÃ DUYỆT','A1 nhãn là ĐÃ DUYỆT',
     G(c,'reqStatusLabel(S.requests.r1)'));
  ok(!/TẠM DUYỆT/.test(G(c,'reqStatusLabel(S.requests.r1)')),'A1 không còn chữ TẠM DUYỆT');
  ok(/ghi nhận/.test(G(c,'reqEndorseNote(S.requests.r1)')),'A2 người duyệt thấy dấu phụ "chờ ghi nhận"',
     G(c,'reqEndorseNote(S.requests.r1)'));
  setMe(c,'e1','staff');
  ok(G(c,'reqEndorseNote(S.requests.r1)')==='','A3 nhân viên thường KHÔNG thấy dấu phụ đó');
  ok(G(c,'reqStatusLabel(S.requests.r1)')==='ĐÃ DUYỆT','A3 …và vẫn chỉ thấy "ĐÃ DUYỆT"');
}

head('B. Thông báo khi Section Chief duyệt');
let ctxB=null,TRUNGB='';
{
  const c=build();ctxB=c;
  const RA=G(c,'typeof ROOT_ADMIN!=="undefined"?ROOT_ADMIN:""');
  if(RA)G(c,`S.employees.find(e=>e.id==='trung').id=${JSON.stringify(RA)};`);
  const TRUNG=RA||'trung';TRUNGB=TRUNG;
  newReq(c,'r1','2026-08-10');
  setMe(c,TRUNG,'admin');
  G(c,`__N.length=0;decide('r1',true);`);
  const N=G(c,'JSON.parse(JSON.stringify(__N))');
  const toEmp=N.filter(x=>x.to==='e1');
  ok(toEmp.length===1,'B1 người làm đơn nhận đúng MỘT tin',toEmp.length);
  ok(/^✅/.test(toEmp[0].text)&&/DUYỆT/.test(toEmp[0].text),'B1 tin mở đầu ✅ và nói ĐÃ DUYỆT',
     toEmp[0].text.slice(0,70));
  ok(!/TẠM DUYỆT/.test(toEmp[0].text),'B1 …không còn chữ TẠM DUYỆT');
  ok(/ghi nhận sau/.test(toEmp[0].text),'B1 …vẫn nói phần ghi nhận của Quản lý người Hàn');
  ok(toEmp[0].zk==='approved','B2 tin mang zk "approved"',toEmp[0].zk);
  ok(!N.some(x=>x.zk==='provapproved'),'B3 không còn tin nào mang zk provapproved');
  const toKr=N.filter(x=>x.to==='kr');
  ok(toKr.length===1&&toKr[0].zk==='finalNote','B4 cấp cuối nhận tin zk "finalNote"',
     toKr.length?toKr[0].zk:'—');
  ok(/ghi nhận/.test(toKr[0].text)&&!/đang chờ .* duyệt/.test(toKr[0].text),
     'B4 …lời mời GHI NHẬN, không phải giục duyệt',toKr[0].text.slice(0,80));
}

head('C. Khi cấp cuối ghi nhận sau đó');
{
  const c=ctxB;
  setMe(c,'kr','kmgr');
  G(c,`__N.length=0;decide('r1',true);`);
  const N=G(c,'JSON.parse(JSON.stringify(__N))');
  const toEmp=N.filter(x=>x.to==='e1');
  ok(toEmp.length===1&&/ghi nhận/.test(toEmp[0].text),'C1 sinh tin "đã ghi nhận"',
     toEmp.length?toEmp[0].text.slice(0,60):'—');
  ok(toEmp[0].zk==='final','C2 zk="final" → kênh Zalo null, không bắn lần hai',toEmp[0].zk);
  ok(!N.some(x=>x.zk==='approved'),'C2 …và KHÔNG có tin "approved" thứ hai');
  ok(G(c,'reqIsProvisional(S.requests.r1)')===false,'C3 đơn hết trạng thái chờ ghi nhận');
  setMe(c,TRUNGB,'admin');
  ok(G(c,'reqEndorseNote(S.requests.r1)')==='','C3 dấu phụ biến mất');
}

head('D. Kênh Zalo & bản tin 08:00');
{
  /* Nạp riêng js/21-notify.js với S giả — cùng cách digest-onlynew-harness làm */
  const S={rev:1,requests:{},notifs:{},digest:{},meta:{},settings:{},
    employees:[{id:'e1',name:'NGUYEN VAN A',pos:'operator'},
               {id:'kr',name:'KIM',pos:'office'}]};
  const sb={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,
    setInterval:()=>0,setTimeout,clearTimeout,S,fbRef:null,firebase:{},
    pad:n=>String(n).padStart(2,'0'),
    t:s=>s,toast:()=>{},save:()=>{},confirm:()=>true,fbReady:()=>false,
    empById:id=>(S.employees||[]).find(e=>e.id===id)||null,
    noAccent:s=>String(s||'').toLowerCase(),
    /* reqIsProvisional thật nằm ở js/01-core.js; ở đây chỉ cần đúng ĐỊNH NGHĨA
       "đã duyệt nhưng cấp cuối chưa ký" để soi nhánh chữ nghĩa. */
    reqIsProvisional:r=>!!(r&&r.status==='approved'&&r.provisional),
    document:{addEventListener:()=>{}},window:{addEventListener:()=>{}}};
  sb.globalThis=sb;
  vm.createContext(sb);
  vm.runInContext(rd('21-notify.js'),sb);
  /* const/let trong file là biến LEXICAL, không phải thuộc tính sandbox —
     phải đọc qua runInContext. Chính cái bẫy đã ghi ở harness training. */
  const D=expr=>vm.runInContext(expr,sb);
  sb.ZALO_INFO_CHANNEL=D('ZALO_INFO_CHANNEL');
  sb.DIGEST_ZK        =D('DIGEST_ZK');
  sb.ZALO_ACTION      =D('ZALO_ACTION');
  sb.digestApplies    =D('digestApplies');
  sb.digestStale      =D('digestStale');
  sb.zaloTitle        =D('zaloTitle');
  sb.zaloLines        =D('zaloLines');
  sb.digestBuild      =D('digestBuild');
  sb.dgReviewLines    =D('dgReviewLines');

  ok(sb.ZALO_INFO_CHANNEL.finalNote==='digest','D1 finalNote đi kênh bản tin 08:00',
     sb.ZALO_INFO_CHANNEL.finalNote);
  ok(sb.ZALO_INFO_CHANNEL.final===null,'D1 tin "đã ghi nhận" KHÔNG bắn Zalo');
  ok(sb.DIGEST_ZK.indexOf('finalNote')>=0,'D1 finalNote nằm trong danh sách gom');

  S.requests.rl={id:'rl',type:'leave',empId:'e1',status:'approved',provisional:true,
                 from:'2026-08-10',to:'2026-08-10',days:[{iso:'2026-08-10',code:'AL8'}],
                 decidedBy:'e1',appr:{}};
  const nFinal={id:'nf',kind:'info',zk:'finalNote',to:'kr',from:'',reqId:'rl',lvl:'kmgr'};
  ok(sb.digestApplies(nFinal,'finalNote')===true,
     'D2 gom kể cả đơn NGHỈ PHÉP (ngoài DIGEST_REQ_TYPES) — tin này không gấp');
  const nAppr={id:'na',kind:'info',zk:'apprNeed',to:'kr',from:'',reqId:'rl',lvl:'kmgr'};
  ok(sb.digestApplies(nAppr,'apprNeed')===false,
     'D2 …trong khi apprNeed của đơn nghỉ phép vẫn đi ngay như cũ');

  S.notifs.nf=nFinal;
  S.digest.nf={to:'kr',zk:'finalNote',lines:[],title:'',reqId:'rl',at:Date.now()};
  ok(sb.digestStale('nf',S.digest.nf)==='','D3 còn chờ cấp cuối ký → giữ trong sổ',
     sb.digestStale('nf',S.digest.nf));
  /* ★ v8.1 — đơn CHƯA được Section Chief duyệt vẫn phải nằm trong bản tin
     sáng: cấp cuối cần thấy toàn cảnh. Lấy "chưa approved" làm cớ để loại
     chính là lỗi sẽ nuốt sạch bản tin. */
  S.requests.rl.status='pending';S.requests.rl.provisional=false;
  ok(sb.digestStale('nf',S.digest.nf)==='','D3 đơn còn chờ Section Chief VẪN ở lại sổ',
     sb.digestStale('nf',S.digest.nf));
  S.requests.rl.status='rejected';
  ok(sb.digestStale('nf',S.digest.nf)==='rejected','D3 đơn bị từ chối thì rơi');
  S.requests.rl.status='approved';S.requests.rl.provisional=false;
  S.requests.rl.appr={kmgr:{by:'kr',at:Date.now()}};
  ok(sb.digestStale('nf',S.digest.nf)==='endorsed','D3 cấp cuối đã ký → tự rơi khỏi sổ',
     sb.digestStale('nf',S.digest.nf));

  S.requests.rl.status='approved';S.requests.rl.provisional=true;S.requests.rl.appr={};
  ok(sb.zaloTitle(nFinal,'finalNote')==='🧾 FOR REVIEW','D4 tiêu đề không dùng chữ "required"',
     sb.zaloTitle(nFinal,'finalNote'));
  const lf=sb.zaloLines(nFinal,'finalNote').join(' | ');
  ok(!/already applied/.test(lf),'D4 ★ bỏ hẳn dòng "already applied to the schedule"',lf.slice(0,80));
  ok(sb.ZALO_ACTION.finalNote===undefined,
     'D4 ★ bỏ hẳn dòng "Already approved and in effect — endorse…"',String(sb.ZALO_ACTION.finalNote));

  const nOk={id:'no',kind:'info',zk:'approved',to:'e1',from:'',reqId:'rl'};
  const lo=sb.zaloLines(nOk,'approved').join(' | ');
  ok(/Approved by/.test(lo),'D5 tin duyệt ghi rõ ai duyệt',lo.slice(0,90));
  ok(/Final endorsement by the Korean manager will follow/.test(lo),
     'D5 …kèm câu trấn an, không nói đơn còn treo');
  S.requests.rl.provisional=false;
  const lo2=sb.zaloLines(nOk,'approved').join(' | ');
  ok(/Final:/.test(lo2)&&!/will follow/.test(lo2),'D5 đơn đã chốt hẳn thì không thêm câu đó');

  /* ---- D6: bản tin 08:00 của cấp cuối là một BẢNG REVIEW ---- */
  S.employees.push({id:'e2',name:'TRAN VAN B',pos:'operator'});
  S.requests.r1={id:'r1',type:'ot',empId:'e1',status:'approved',provisional:true,
    from:'2026-08-11',to:'2026-08-11',code:'OTO',appr:{trung:{by:'tr',at:1}},
    days:[{iso:'2026-08-11',code:'OTO',timeIn:'08:00',timeOut:'17:00',hours:8}]};
  S.requests.r2={id:'r2',type:'ot',empId:'e2',status:'pending',
    from:'2026-08-12',to:'2026-08-12',code:'OTN',appr:{},
    days:[{iso:'2026-08-12',code:'OTN',timeIn:'20:00',timeOut:'08:00',hours:12}]};
  S.requests.r3={id:'r3',type:'leave',empId:'e2',status:'approved',provisional:true,
    from:'2026-08-13',to:'2026-08-13',code:'AL8',appr:{trung:{by:'tr',at:1}},
    days:[{iso:'2026-08-13',code:'AL8'}]};
  const rows=['r1','r2','r3'].map(id=>({notifId:'n_'+id,to:'kr',toName:'KIM',zk:'finalNote',
    group:'finalNote',reqId:id,lines:['dòng cũ '+id],at:Date.now()}));
  const pack=sb.digestBuild(rows,'12/08')[0];
  const body=pack.lines.join('\n');
  ok(/^SUMMARY/.test(body),'D6 mở đầu bằng khối TỔNG QUAN');
  /* Nhãn loại được đệm cho thẳng cột nên đừng bám vào số khoảng trắng */
  ok(/OVERTIME\s+2\s+20h total/.test(body),'D6 …gộp đúng 2 đơn OT và 20 giờ',
     (body.match(/OVERTIME.*/)||[''])[0]);
  ok(/LEAVE\s+1/.test(body),'D6 …và 1 đơn nghỉ phép');
  ok(/2 approved by Section Chief · 1 still waiting/.test(body),
     'D6 nói rõ bao nhiêu đơn đã duyệt / còn chờ',
     (body.match(/.*Section Chief.*/)||[''])[0].trim());
  ok(/OVERTIME \(2\)/.test(body)&&/LEAVE \(1\)/.test(body),'D6 mỗi loại đơn một khối riêng');
  ok(/⏳/.test(body),'D6 đơn còn chờ Section Chief có dấu ⏳');
  ok(!/dòng cũ/.test(body),'D6 KHÔNG còn nối các dòng rời như trước');
  ok(/request\(s\)/.test(pack.title)&&/KOREAN MANAGER/.test(pack.title),
     'D6 tiêu đề nói rõ là bản review của Quản lý người Hàn',pack.title);
  /* Mục cũ chưa có reqId thì vẫn phải gửi được, không nuốt mất */
  const old=sb.digestBuild([{notifId:'nx',to:'kr',zk:'finalNote',group:'finalNote',
    lines:['dòng cũ không có reqId'],at:Date.now()}],'12/08')[0];
  ok(/dòng cũ không có reqId/.test(old.lines.join('\n')),
     'D6 mục cũ (chưa có reqId) rơi về cách nối dòng, không mất tin');
}

head('E. Đơn cần duyệt nằm ngoài bộ lọc đang xem');
{
  const c=build();
  const RA=G(c,'typeof ROOT_ADMIN!=="undefined"?ROOT_ADMIN:""');
  if(RA)G(c,`S.employees.find(e=>e.id==='trung').id=${JSON.stringify(RA)};`);
  setMe(c,RA||'trung','admin');
  newReq(c,'rA','2026-08-10');            // kỳ 2026-08 (21/07 → 20/08)
  newReq(c,'rB','2026-09-01');            // kỳ 2026-09 — buổi đào tạo hay rơi vào đây
  G(c,`apprFilter.ym='2026-08';apprFilter.status='pending';apprFilter.q='';
       apprFilter.type='__all';apprFilter.print='__all';apprFilter.hr='__all';
       apprFilter.pg='__all';apprFilter.flag='';apprFilter.from='';apprFilter.to='';`);
  const mine=G(c,'Object.values(S.requests).filter(reqNeedsMyAction).length');
  const shown=G(c,'Object.values(S.requests).filter(apprMatch).length');
  ok(mine===2,'E1 cả hai đơn đều cần tay người đang đăng nhập',mine);
  ok(shown===1,'E1 …nhưng kỳ đang xem chỉ thấy MỘT — đúng gốc của "huy hiệu 13, danh sách 11"',shown);
  const outside=G(c,'Object.values(S.requests).filter(r=>reqNeedsMyAction(r)&&!apprMatch(r)).length');
  ok(outside===1,'E1 đếm được đúng 1 đơn nằm ngoài bộ lọc',outside);

  G(c,'apprShowOutside();');
  ok(G(c,'apprFilter.ym')==='__all','E2 mở ra tất cả các kỳ',G(c,'apprFilter.ym'));
  ok(G(c,'apprFilter.status')==='__all',
     'E2 trạng thái "__all" — nếu để "pending" sẽ giấu mất đơn chờ ghi nhận',G(c,'apprFilter.status'));
  ok(G(c,'Object.values(S.requests).filter(apprMatch).length')===2,'E2 lúc này thấy đủ cả hai đơn');
  /* Đơn đã duyệt chờ ghi nhận cũng phải lọt vào tầm nhìn này */
  G(c,`decide('rA',true);`);
  ok(G(c,'Object.values(S.requests).filter(apprMatch).length')===2,
     'E2 …kể cả sau khi một đơn chuyển sang "đã duyệt, chờ ghi nhận"');
}

console.log('\n════════════════════════════════════');
console.log(fail?('✗ HỎNG '+fail+'/'+(pass+fail)+' bài'):('✓ ĐẠT HẾT '+pass+' bài'));
console.log('════════════════════════════════════');
process.exit(fail?1:0);
