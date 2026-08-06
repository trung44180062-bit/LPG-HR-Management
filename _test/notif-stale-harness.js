/* ============================================================
   HARNESS — THU HỒI THÔNG BÁO ĐÃ LỖI THỜI
   Kiểm đúng cái người dùng báo hỏng: lời nhắc "xác nhận đổi lịch" và lời
   nhờ "OT cover" vẫn nằm lại sau khi người tạo ra chúng đã xoá việc.
   Chạy: node _test/notif-stale-harness.js
   ============================================================ */
const fs=require('fs'),vm=require('vm'),path=require('path');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const CAT=c=>({O:'work',D:'work',N:'work',R:'rest',SD:'swap',SN:'swap',SO:'swap',
  AL8:'leave',AL4:'leave',NP:'leave',OTD:'ot',OTN:'ot'})[c]||'other';

const S={rev:1,employees:[],base:{},over:{},requests:{},notifs:{},events:{},
  settings:{minD:3,minN:3,maxOffTeam:1}};
let saved=0,zaloOut=[];
const ctx={S,console,Date,Math,Object,String,Number,Array,JSON,Set,
  t:s=>s,t2:s=>s,esc:s=>String(s==null?'':s),
  fmtVN:s=>s,fmtVNfull:s=>s,dowOf:()=>'T2',fmtDateTime:x=>'['+x+']',
  codeInfo:c=>({cat:CAT(c),col:'#eee'}),baseShiftOf:c=>({SD:'D',SN:'N',SO:'O'})[c]||c,
  comboOf:()=>null,uid:(()=>{let i=0;return()=>'n'+(++i);})(),
  empById:id=>S.employees.find(e=>e.id===id)||null,
  eff:(id,iso)=>{const o=(S.over[id]||{})[iso];return o?{code:o.code,o}:{code:(S.base[id]||{})[iso]||'',o:null};},
  save:()=>saved++,toast:()=>{},meId:()=>'mgr',
  renderMyPanel:()=>{},renderMe:()=>{},renderCal:()=>{},refreshBadge:()=>{},
  /* Giả lập hàng đợi Zalo: ghi lại mọi lượt rút để khẳng định có thu hồi thật */
  zaloEnqueue:n=>{zaloOut.push(n.id);},
  zaloWithdraw:id=>{const i=zaloOut.indexOf(id);if(i>=0)zaloOut.splice(i,1);},
  unseenDecisions:()=>[]};
ctx.window=ctx;vm.createContext(ctx);

/* Chỉ nạp phần THÔNG BÁO của 13-portal.js (từ newNotif tới hết notifTake) —
   nạp cả file sẽ kéo theo hàng trăm hàm giao diện không liên quan. */
const p13=R('js/13-portal.js');
const seg=p13.slice(p13.indexOf('function newNotif(o){'),
                    p13.indexOf('/* B XÁC NHẬN / TỪ CHỐI đơn đổi ca của A */'));
vm.runInContext(seg,ctx,{filename:'13-portal(notif)'});

const T=[];const ok=(n,c,x)=>T.push([!!c,n,x===undefined?'':String(x)]);
const mkEmp=(id,name,team)=>S.employees.push({id,name,team,active:true});
mkEmp('mgr','Quản lý','A');mkEmp('e1','Nhân viên 1','A');mkEmp('e2','Nhân viên 2','A');
S.base.e1={'2026-08-10':'D','2026-08-11':'D'};
S.base.e2={'2026-08-10':'D'};

const reset=()=>{S.notifs={};S.requests={};S.over={};zaloOut=[];saved=0;};

/* ---------- 1. Đổi lịch: ô lịch bị xoá về ca chuẩn ---------- */
reset();
S.over.e1={'2026-08-10':{code:'N',by:'mgr',at:1}};
const n1=ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-10',oldCode:'D',newCode:'N'});
ok('đổi lịch: ban đầu là việc chờ hợp lệ',ctx.pendingConfirms('e1').length===1);
ok('đổi lịch: đã xếp hàng sang Zalo',zaloOut.includes(n1));
delete S.over.e1['2026-08-10'];                 // quản lý xoá ô → về ca chuẩn D
ok('đổi lịch: xoá ô rồi thì KHÔNG còn hiện ra',ctx.pendingConfirms('e1').length===0,
   ctx.notifStaleReason(S.notifs[n1]));
ok('đổi lịch: bộ quét gỡ hẳn khỏi dữ liệu',ctx.sweepStaleNotifs(false)===1&&!S.notifs[n1]);
ok('đổi lịch: rút luôn tin trong hàng đợi Zalo',!zaloOut.includes(n1),zaloOut.join(','));

/* ---------- 2. Đổi lịch: ô bị đơn khác ghi đè mã khác ---------- */
reset();
S.over.e1={'2026-08-10':{code:'N'}};
const n2=ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-10',oldCode:'D',newCode:'N'});
S.over.e1['2026-08-10']={code:'AL8',reqId:'rX'};  // đơn nghỉ phép duyệt xong ghi đè
ok('đổi lịch: ô bị ghi đè mã khác → lỗi thời',ctx.notifIsStale(S.notifs[n2]));

/* ---------- 3. Đổi lịch: ĐÃ xác nhận thì KHÔNG bị xoá ---------- */
reset();
S.over.e1={'2026-08-10':{code:'N'}};
const n3=ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-10',oldCode:'D',newCode:'N'});
S.notifs[n3].status='confirmed';
delete S.over.e1['2026-08-10'];
ok('đổi lịch: bản ĐÃ xác nhận vẫn giữ để tra lại',ctx.sweepStaleNotifs(false)===0&&!!S.notifs[n3]);

/* ---------- 4. OT cover: đơn bị XOÁ ---------- */
reset();
S.requests.r1={id:'r1',empId:'e1',type:'leave',status:'pending',coverId:'e2',coverSt:'pending',
  from:'2026-08-10',days:[{iso:'2026-08-10',code:'AL8'}]};
const n4=ctx.newNotif({kind:'coverConfirm',to:'e2',from:'e1',reqId:'r1',iso:'2026-08-10'});
ok('cover: ban đầu hợp lệ',ctx.pendingConfirms('e2').length===1);
delete S.requests.r1;
ok('cover: đơn bị xoá → không hiện ra',ctx.pendingConfirms('e2').length===0,
   ctx.notifStaleReason(S.notifs[n4]));
ok('cover: bộ quét gỡ hẳn + rút Zalo',ctx.sweepStaleNotifs(false)===1&&!zaloOut.includes(n4));

/* ---------- 5. OT cover: đơn bị TỪ CHỐI (không phải xoá) ---------- */
reset();
S.requests.r2={id:'r2',empId:'e1',type:'leave',status:'pending',coverId:'e2',coverSt:'pending',
  from:'2026-08-10',days:[{iso:'2026-08-10',code:'AL8'}]};
const n5=ctx.newNotif({kind:'coverConfirm',to:'e2',from:'e1',reqId:'r2',iso:'2026-08-10'});
S.requests.r2.status='rejected';
ok('cover: đơn bị từ chối → lỗi thời',ctx.notifIsStale(S.notifs[n5]),ctx.notifStaleReason(S.notifs[n5]));

/* ---------- 6. OT cover: đổi sang người khác ---------- */
reset();
S.requests.r3={id:'r3',empId:'e1',type:'leave',status:'pending',coverId:'e2',coverSt:'pending',
  from:'2026-08-10',days:[{iso:'2026-08-10',code:'AL8'}]};
const n6=ctx.newNotif({kind:'coverConfirm',to:'e2',from:'e1',reqId:'r3',iso:'2026-08-10'});
S.requests.r3.coverId='mgr';                    // đổi người cover
ok('cover: đổi người → lời nhờ cũ lỗi thời',ctx.notifIsStale(S.notifs[n6]),
   ctx.notifStaleReason(S.notifs[n6]));

/* ---------- 7. Đổi ca: đơn bị xoá / đổi người ---------- */
reset();
S.requests.r4={id:'r4',empId:'e1',type:'swap',status:'pending',withId:'e2',from:'2026-08-10',days:[]};
const n7=ctx.newNotif({kind:'swapConfirm',to:'e2',from:'e1',reqId:'r4',iso:'2026-08-10'});
ok('đổi ca: ban đầu hợp lệ',!ctx.notifIsStale(S.notifs[n7]));
S.requests.r4.withId='mgr';
ok('đổi ca: đổi người → lỗi thời',ctx.notifIsStale(S.notifs[n7]));

/* ---------- 8. Người nhận nghỉ việc ---------- */
reset();
S.requests.r5={id:'r5',empId:'e1',type:'leave',status:'pending',coverId:'e2',from:'2026-08-10',days:[]};
const n8=ctx.newNotif({kind:'coverConfirm',to:'e2',from:'e1',reqId:'r5'});
S.employees.find(e=>e.id==='e2').active=false;
ok('người nhận bị vô hiệu hoá → lỗi thời',ctx.notifIsStale(S.notifs[n8]));
S.employees.find(e=>e.id==='e2').active=true;

/* ---------- 9. Bấm vào việc đã lỗi thời thì bị chặn ---------- */
reset();
S.requests.r6={id:'r6',empId:'e1',type:'leave',status:'pending',coverId:'mgr',coverSt:'pending',
  from:'2026-08-10',days:[]};
const n9=ctx.newNotif({kind:'coverConfirm',to:'mgr',from:'e1',reqId:'r6'});
ok('notifTake: việc còn hiệu lực thì trả về',ctx.notifTake(n9)===S.notifs[n9]);
delete S.requests.r6;
ok('notifTake: việc đã lỗi thời trả null + gỡ luôn',ctx.notifTake(n9)===null&&!S.notifs[n9]);

/* ---------- 10. Tin một chiều KHÔNG bị quét nhầm ---------- */
reset();
const nA=ctx.newNotif({kind:'info',to:'e1',from:'mgr',reqId:'khong-ton-tai',text:'Đơn đã bị huỷ'});
ok('tin info gắn đơn đã xoá vẫn giữ (là lịch sử)',!ctx.notifIsStale(S.notifs[nA])&&
   ctx.sweepStaleNotifs(false)===0);
ok('tin info vẫn hiện trong danh sách',ctx.myNotifs('e1').length===1);

/* ---------- 11. pruneOldNotifs dọn được tin info cũ ---------- */
reset();
const nB=ctx.newNotif({kind:'info',to:'e1',from:'mgr',text:'cũ'});
S.notifs[nB].createdAt=Date.now()-100*86400000;
S.over.e1={'2026-08-10':{code:'N'}};
const nC=ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-10',oldCode:'D',newCode:'N'});
S.notifs[nC].createdAt=Date.now()-100*86400000;
const pr=ctx.pruneOldNotifs();
ok('dọn cũ: tin info quá 62 ngày bị xoá (lỗi cũ: giữ mãi vì status pending)',
   pr===1&&!S.notifs[nB],'đã dọn '+pr);
ok('dọn cũ: việc chờ xác nhận CÒN HIỆU LỰC thì giữ dù cũ',!!S.notifs[nC]);

/* ---------- 12. Tiết chế: không ghi liên tục ---------- */
reset();
S.requests.r7={id:'r7',empId:'e1',type:'swap',status:'pending',withId:'khong-ai',from:'2026-08-10',days:[]};
ctx.newNotif({kind:'swapConfirm',to:'e2',from:'e1',reqId:'r7'});
const s1=ctx.sweepStaleNotifsThrottled();
const s2=ctx.sweepStaleNotifsThrottled();
ok('quét có tiết chế: lần 2 trong 30s không chạy lại',s1===1&&s2===0);

let bad=0;T.forEach(([c,n,x])=>{if(!c)bad++;console.log((c?'  ✅ ':'  ❌ ')+n+(x?'   ['+x+']':''));});
console.log(bad?'\n❌ '+bad+'/'+T.length+' kịch bản KHÔNG đạt':'\n✅ '+T.length+'/'+T.length+' kịch bản đạt');
process.exit(bad?1:0);
