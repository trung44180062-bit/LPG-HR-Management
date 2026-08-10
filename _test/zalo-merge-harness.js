/* ============================================================
   HARNESS — HỘP GỬI ZALO GỘP TIN  (v6.3)
   Kiểm đúng hai cái người dùng báo hỏng:
     · tạo sự kiện → bot bắn một loạt tin giống hệt nhau
     · đổi lịch nhiều người rồi bấm gửi một lần → tin không gộp
   và cái lỗi âm thầm tìm ra khi mổ: thu hồi tin CHƯA TỪNG CHẠY vì luật
   Firebase đặt zaloQueue .read=false nên once('value') luôn bị từ chối.

   Chạy: node _test/zalo-merge-harness.js
   ============================================================ */
const fs=require('fs'),vm=require('vm'),path=require('path');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

/* ---------- hàng đợi Firebase giả ---------- */
const DB={zaloQueue:{}};
let denyRead=true;                 // đúng như luật thật: cấm đọc
const mkRef=segs=>({
  child(k){return mkRef(segs.concat([k]));},
  set(v){
    let o=DB;for(let i=0;i<segs.length-1;i++){o=o[segs[i]]=o[segs[i]]||{};}
    o[segs[segs.length-1]]=JSON.parse(JSON.stringify(v));
    return Promise.resolve();
  },
  remove(){
    let o=DB;for(let i=0;i<segs.length-1;i++){o=o[segs[i]];if(!o)return Promise.resolve();}
    delete o[segs[segs.length-1]];return Promise.resolve();
  },
  once(){
    return denyRead?Promise.reject(new Error('permission_denied'))
                   :Promise.resolve({val:()=>null});
  }
});
const rows=()=>Object.keys(DB.zaloQueue).map(k=>DB.zaloQueue[k]);
const nRows=()=>Object.keys(DB.zaloQueue).length;

/* ---------- bối cảnh app giả ---------- */
const CAT=c=>({O:'work',D:'work',N:'work',R:'rest',AL8:'leave',OTD:'ot'})[c]||'other';
const S={rev:1,employees:[],base:{},over:{},requests:{},notifs:{},events:{},
         settings:{}};
let saved=0;
const ctx={S,console,Date,Math,Object,String,Number,Array,JSON,Set,Promise,
  setTimeout:()=>0,clearTimeout:()=>{},     // hẹn giờ do phép thử tự bấm
  t:s=>s,t2:s=>s,esc:s=>String(s==null?'':s),
  fmtVN:s=>s,fmtVNfull:s=>s,dowOf:()=>'T2',fmtDateTime:x=>'['+x+']',
  codeInfo:c=>({cat:CAT(c),col:'#eee'}),
  uid:(()=>{let i=0;return()=>'n'+(++i);})(),
  empById:id=>S.employees.find(e=>e.id===id)||null,
  eff:(id,iso)=>{const o=(S.over[id]||{})[iso];
                 return o?{code:o.code,o}:{code:(S.base[id]||{})[iso]||'',o:null};},
  save:()=>saved++,toast:()=>{},meId:()=>'mgr',
  renderMyPanel:()=>{},renderMe:()=>{},renderCal:()=>{},refreshBadge:()=>{},
  unseenDecisions:()=>[],
  firebase:{},fbRef:mkRef([]),
  ROOT_ADMIN:'mgr'};
ctx.window=ctx;
ctx.window.addEventListener=()=>{};
ctx.document={addEventListener:()=>{},visibilityState:'visible'};
vm.createContext(ctx);

/* 21-notify TRƯỚC (định nghĩa zaloEnqueue), rồi lát thông báo của 13-portal */
vm.runInContext(R('js/21-notify.js'),ctx,{filename:'21-notify'});
const p13=R('js/13-portal.js');
vm.runInContext(p13.slice(p13.indexOf('function newNotif(o){'),
                p13.indexOf('/* B XÁC NHẬN / TỪ CHỐI đơn đổi ca của A */')),
                ctx,{filename:'13-portal(notif)'});

const T=[];const ok=(n,c,x)=>T.push([!!c,n,x===undefined?'':String(x)]);
const mkEmp=(id,name,team)=>S.employees.push({id,name,team,active:true});
mkEmp('mgr','Quản lý','A');
for(let i=1;i<=23;i++)mkEmp('e'+i,'Nhân viên '+(i<10?'0'+i:i),i%2?'A':'B');
S.employees.forEach(e=>{S.base[e.id]={'2026-08-10':'D','2026-08-11':'D'};});

const reset=()=>{S.notifs={};S.requests={};S.over={};saved=0;
                 for(const k in DB.zaloQueue)delete DB.zaloQueue[k];
                 ctx.zaloFlush();                 // dọn hộp gửi còn sót
                 for(const k in DB.zaloQueue)delete DB.zaloQueue[k];};

/* ============================================================
   1. SỰ KIỆN — 23 người, phải ra ĐÚNG MỘT tin
   ============================================================ */
reset();
const evIds=[];
for(let i=1;i<=23;i++)
  evIds.push(ctx.newNotif({kind:'event',to:'e'+i,from:'mgr',evId:'ev1',
    iso:'2026-08-10',status:'sent',text:'Nhập tàu LPG — 10/08'}));
ok('sự kiện: chưa đẩy thì chưa ghi hàng nào',nRows()===0);
ok('sự kiện: 23 gói còn nằm trong hộp gửi',ctx.zaloOutPending()===23,ctx.zaloOutPending());
ctx.zaloFlush();
ok('sự kiện: 23 người → ĐÚNG 1 hàng đợi',nRows()===1,'ra '+nRows()+' hàng');
ok('sự kiện: hàng đó đại diện đủ 23 thông báo',(rows()[0].notifIds||[]).length===23);
ok('sự kiện: gắn cờ tin chung (không ghi tên một người)',rows()[0].bcast===1);
ok('sự kiện: giữ nguyên nội dung gốc',
   (rows()[0].lines||[]).join('\n').includes('Nhập tàu LPG'));
ok('sự kiện: mọi thông báo đều được đánh dấu thuộc hàng nào',
   evIds.every(id=>S.notifs[id].zq===rows()[0].notifId));

/* 1b. Sửa sự kiện = thu hồi hết rồi gửi lại → vẫn 1 hàng, không sót hàng cũ */
const key1=rows()[0].notifId;
ctx.notifDrop(x=>x.kind==='event'&&x.evId==='ev1');
ok('sự kiện: xoá hết thông báo thì hàng đợi cũng biến mất',nRows()===0,'còn '+nRows());
for(let i=1;i<=23;i++)
  ctx.newNotif({kind:'event',to:'e'+i,from:'mgr',evId:'ev1',iso:'2026-08-11',
    status:'sent',text:'Nhập tàu LPG — 11/08 (đã dời)'});
ctx.zaloFlush();
ok('sự kiện: gửi lại bản sửa → vẫn đúng 1 hàng',nRows()===1,'ra '+nRows()+' hàng');
ok('sự kiện: hàng mới khác hàng cũ',rows()[0].notifId!==key1);

/* 1c. Tạo rồi xoá NGAY khi tin còn trong hộp → không tốn gì cả */
reset();
for(let i=1;i<=23;i++)
  ctx.newNotif({kind:'event',to:'e'+i,from:'mgr',evId:'ev2',iso:'2026-08-10',
    status:'sent',text:'Sự kiện gõ nhầm'});
ctx.notifDrop(x=>x.evId==='ev2');
ok('sự kiện: xoá trước khi đẩy → hộp gửi rỗng',ctx.zaloOutPending()===0,ctx.zaloOutPending());
ctx.zaloFlush();
ok('sự kiện: xoá trước khi đẩy → không ghi hàng nào',nRows()===0);

/* ============================================================
   2. ĐỔI LỊCH NHIỀU NGƯỜI — tự cuộn thành một tin
   ============================================================ */
reset();
for(let i=1;i<=5;i++){
  S.over['e'+i]={'2026-08-10':{code:'N',by:'mgr',at:1}};
  ctx.newNotif({kind:'schedChange',to:'e'+i,from:'mgr',iso:'2026-08-10',
                oldCode:'D',newCode:'N'});
}
ctx.zaloFlush();
ok('đổi lịch: 5 người → ĐÚNG 1 hàng đợi',nRows()===1,'ra '+nRows()+' hàng');
ok('đổi lịch: tiêu đề nói rõ số người',
   /5 people/.test(rows()[0].title||''),rows()[0].title);
ok('đổi lịch: là tin chung, không ghi tên một người',rows()[0].bcast===1);
ok('đổi lịch: thân tin liệt kê đủ 5 người',
   (rows()[0].lines||[]).filter(l=>/→/.test(l)).length===5,
   JSON.stringify(rows()[0].lines));
ok('đổi lịch: vẫn là tin 🔴 bắn ngay',rows()[0].pri==='now');
ok('đổi lịch: trong app vẫn là 5 việc chờ xác nhận riêng',
   Object.values(S.notifs).filter(n=>n.kind==='schedChange').length===5);

/* 2b. Một người một ngày thì để tin riêng — rõ hơn tin gộp */
reset();
S.over.e1={'2026-08-10':{code:'N'}};
ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-10',
              oldCode:'D',newCode:'N'});
ctx.zaloFlush();
ok('đổi lịch: một mình một ngày thì giữ tin cá nhân',
   nRows()===1&&rows()[0].bcast===0&&/SHIFT CHANGED/.test(rows()[0].title),
   rows()[0].title);

/* 2b2. Một người NHIỀU ngày → gộp, nhưng vẫn là tin riêng của người đó */
reset();
S.over.e1={'2026-08-10':{code:'N'},'2026-08-11':{code:'O'}};
ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-10',oldCode:'D',newCode:'N'});
ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-11',oldCode:'D',newCode:'O'});
ctx.zaloFlush();
ok('đổi lịch: một người hai ngày → 1 tin, KHÔNG ghi "1 PEOPLE"',
   nRows()===1&&rows()[0].bcast===0&&!/PEOPLE/.test(rows()[0].title),rows()[0].title);
ok('đổi lịch: tin đó vẫn gửi đúng tên người nhận',rows()[0].to==='e1');

/* 2c. Sửa đi sửa lại cùng một ô → chỉ một tin, mang mã CUỐI CÙNG */
reset();
S.over.e1={'2026-08-10':{code:'N'}};
const nA=ctx.newNotif({kind:'schedChange',to:'e1',from:'mgr',iso:'2026-08-10',
                       oldCode:'D',newCode:'N'});
S.notifs[nA].newCode='O';
ctx.zaloEnqueue(S.notifs[nA]);          // đúng nhánh emitSchedChange cập nhật
ctx.zaloFlush();
ok('đổi lịch: sửa lại cùng ô → vẫn 1 hàng',nRows()===1,'ra '+nRows());
ok('đổi lịch: hàng mang mã mới nhất',
   (rows()[0].lines||[]).join('\n').includes('O'),rows()[0].lines.join(' | '));

/* 2d. Nút 🔕 Giữ → 🔔 Gửi: tin gộp sẵn, các tin lẻ nz:1 không được đẻ thêm */
reset();
for(let i=1;i<=4;i++)
  ctx.newNotif({kind:'schedChange',to:'e'+i,from:'mgr',iso:'2026-08-10',
                oldCode:'D',newCode:'N',nz:1});
ctx.newNotif({kind:'info',zk:'schedBulk',to:'mgr',from:'mgr',
  hold:[1,2,3,4].map(i=>({to:'e'+i,iso:'2026-08-10',was:'D',now:'N'})),
  text:'📅 Đã cập nhật lịch thực tế của 4 người'});
ctx.zaloFlush();
ok('giữ-rồi-gửi: vẫn đúng 1 tin Zalo',nRows()===1,'ra '+nRows()+' hàng');
ok('giữ-rồi-gửi: liệt kê đủ 4 người',
   (rows()[0].lines||[]).filter(l=>/→/.test(l)).length===4,
   JSON.stringify(rows()[0].lines));

/* ============================================================
   3. NHIỀU NGƯỜI DUYỆT CÙNG MỘT ĐƠN — một tin, liệt kê đủ tên
   ============================================================ */
reset();
S.requests.r1={id:'r1',empId:'e1',type:'leave',status:'pending',from:'2026-08-10',
  days:[{iso:'2026-08-10',code:'AL8'}],createdAt:1};
['e2','e3','e4','mgr'].forEach(pid=>
  ctx.newNotif({kind:'info',zk:'apprNeed',to:pid,from:'e1',reqId:'r1',lvl:'trung',
                text:'📥 Đơn nghỉ phép đang chờ duyệt'}));
ctx.zaloFlush();
ok('cần duyệt: 4 người duyệt → 1 tin',nRows()===1,'ra '+nRows()+' hàng');
ok('cần duyệt: có dòng liệt kê người phải xử lý',
   (rows()[0].lines||[]).some(l=>/^For: /.test(l)),
   (rows()[0].lines||[]).slice(-1)[0]);
ok('cần duyệt: chuyển thành tin chung',rows()[0].bcast===1);

/* 3b. Thu hồi từng phần: một người duyệt xong không được làm mất tin cả nhóm */
reset();
S.requests.r2={id:'r2',empId:'e1',type:'leave',status:'pending',from:'2026-08-10',
  days:[{iso:'2026-08-10',code:'AL8'}],createdAt:1};
const ap=['e2','e3','e4'].map(pid=>
  ctx.newNotif({kind:'info',zk:'apprNeed',to:pid,from:'e1',reqId:'r2',lvl:'trung',
                text:'📥 Đơn nghỉ phép đang chờ duyệt'}));
ctx.zaloFlush();
ok('thu hồi: ban đầu có 1 hàng',nRows()===1);
ctx.notifDrop(x=>x.id===ap[0]);
ok('thu hồi: gỡ 1 trong 3 → hàng VẪN còn (2 người kia chưa xử lý)',nRows()===1);
ctx.notifDrop(x=>x.id===ap[1]);
ok('thu hồi: gỡ 2 trong 3 → hàng vẫn còn',nRows()===1);
ctx.notifDrop(x=>x.id===ap[2]);
ok('thu hồi: gỡ nốt người cuối → hàng biến mất',nRows()===0,'còn '+nRows());

/* 3c. Thu hồi phải chạy được dù luật Firebase CẤM ĐỌC zaloQueue */
ok('thu hồi: không phụ thuộc quyền đọc hàng đợi',denyRead===true);

/* ============================================================
   4. NHỮNG ĐƯỜNG KHÔNG ĐƯỢC ĐỔI HÀNH VI
   ============================================================ */
reset();
ctx.newNotif({kind:'coverConfirm',to:'e2',from:'e1',reqId:'rZ',iso:'2026-08-10',nz:1});
ctx.zaloFlush();
ok('cờ nz:1 vẫn chỉ hiện trong app, không tốn tin',nRows()===0);

reset();
ctx.newNotif({kind:'info',to:'e2',from:'e1',zk:'swapOk',text:'ok'});
ctx.zaloFlush();
ok('kênh ⚪ (swapOk) vẫn không tốn tin',nRows()===0);

reset();
ctx.newNotif({kind:'event',to:'e1',from:'mgr',evId:'a',status:'sent',text:'Sự kiện A'});
ctx.newNotif({kind:'event',to:'e1',from:'mgr',evId:'b',status:'sent',text:'Sự kiện B'});
ctx.zaloFlush();
ok('hai nội dung KHÁC nhau thì không được gộp nhầm làm một',
   nRows()===1&&(rows()[0].lines||[]).join('\n').includes('Sự kiện A')
   &&(rows()[0].lines||[]).join('\n').includes('Sự kiện B'),
   'cùng người + cùng nhóm tin → 1 tin hai mục, không mất nội dung nào');

reset();
S.settings.zaloOff=true;
for(let i=1;i<=5;i++)
  ctx.newNotif({kind:'event',to:'e'+i,from:'mgr',evId:'c',status:'sent',text:'x'});
ctx.zaloFlush();
ok('tắt Zalo thì không ghi gì hết',nRows()===0&&ctx.zaloOutPending()===0);
S.settings.zaloOff=false;

reset();
ctx.newNotif({kind:'event',to:'khong-co-nguoi-nay',from:'mgr',evId:'d',
              status:'sent',text:'x'});
ctx.zaloFlush();
ok('người nhận không tra được thì im lặng, không bắn mù',nRows()===0);

/* ---------- kết ---------- */
let bad=0;
T.forEach(([p,n,x])=>{if(!p)bad++;console.log((p?'  ok  ':'HỎNG ')+n+(x?('   ['+x+']'):''));});
console.log('\n'+T.length+' phép thử · '+(T.length-bad)+' đạt · '+bad+' hỏng');
process.exit(bad?1:0);
