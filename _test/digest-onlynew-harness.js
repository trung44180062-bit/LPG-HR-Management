/* ============================================================
   HARNESS — BẢN TIN 08:00 CHỈ GOM TIN CHƯA GỬI LẦN NÀO
   ------------------------------------------------------------
   Chạy:  node _test/digest-onlynew-harness.js
   ------------------------------------------------------------
   CÂU HỎI CẦN TRẢ LỜI (người dùng nêu 2026-08-11)

   "Sổ chờ này là những tin CHƯA GỬI THÔNG BÁO LẦN NÀO thì mới gom gửi, tức
    là các đơn MỚI PHÁT SINH — chứ không phải gom hết đơn trong màn Phê duyệt
    rồi gửi lại, đúng không?"

   N1 kho 200 đơn OT cũ (đã duyệt, đã in) mà không có tin mới → sổ chờ = 0
   N2 chỉ tin MỚI vào sổ: 3 tin mới trên kho 200 đơn cũ → sổ chờ = 3
   N3 bắn xong → sổ chờ rỗng, kho đơn cũ không sinh thêm mục nào
   N4 tin sinh SAU khi bắn → chờ đợt sau, đợt sau CHỈ có tin đó
   N5 gọi bắn lại ngay → không gửi lại gì
   N6 đổi trạng thái đơn cũ mà không sinh tin → sổ chờ vẫn rỗng
   N7 huỷ tin trước giờ bắn → gỡ khỏi sổ, không tốn tin nào
   N8 số "Đang chờ" ở màn Dữ liệu = số mục CHƯA GỬI, không phải số đơn chờ duyệt
   N9 ★ đơn bị huỷ theo đường THẬT (cancelReq) → sáng mai không nhắc nữa
   N10 ★ đơn đã duyệt xong trước 08:00 → lời nhắc "cần duyệt" tự rơi
   ============================================================ */
'use strict';
const tick=()=>new Promise(r=>setTimeout(r,0));
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

/* ---------- Firebase giả ---------- */
function makeServer(seed){return {data:JSON.parse(JSON.stringify(seed||{})),sets:[]};}
function deepGet(o,p){return p.split('/').filter(Boolean).reduce((a,k)=>(a==null?a:a[k]),o);}
function deepSet(o,p,v){
  const ks=p.split('/').filter(Boolean),last=ks.pop();let cur=o;
  ks.forEach(k=>{if(cur[k]==null||typeof cur[k]!=='object')cur[k]={};cur=cur[k];});
  if(v===null)delete cur[last];else cur[last]=v;
}
function makeRef(server,base){
  return {
    child(p){return makeRef(server,base?base+'/'+p:p);},
    set(v){server.sets.push({path:base,val:v});deepSet(server.data,base,v);return Promise.resolve();},
    remove(){deepSet(server.data,base,null);return Promise.resolve();},
    transaction(fn,cb){
      const cur=deepGet(server.data,base);
      const next=fn(cur===undefined?null:cur);
      if(next===undefined){cb&&cb(null,false,null);return Promise.resolve({committed:false});}
      deepSet(server.data,base,next);cb&&cb(null,true,{val:()=>next});
      return Promise.resolve({committed:true});
    }
  };
}
function loadNotify(server,S,nowHour,nowDay){
  const sandbox={
    console,JSON,Object,Array,String,Number,Math,RegExp,setInterval:()=>0,setTimeout,clearTimeout,
    S,fbRef:makeRef(server,''),firebase:{},
    pad:n=>String(n).padStart(2,'0'),
    t:s=>s,toast:()=>{},save:()=>{},confirm:()=>true,fbReady:()=>true,
    empById:id=>(S.employees||[]).find(e=>e.id===id)||null,
    noAccent:s=>String(s||'').toLowerCase(),
    document:{addEventListener:()=>{}},window:{addEventListener:()=>{}},
    Date:class extends Date{
      constructor(...a){if(a.length)super(...a);
        else super(nowDay+'T'+String(nowHour).padStart(2,'0')+':30:00');}
      static now(){return new Date().getTime();}
    }
  };
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(rd('21-notify.js'),sandbox);
  return sandbox;
}
/* Kho dữ liệu GIỐNG THẬT: 200 đơn OT CŨ đã duyệt xong và đã in, y như một
   màn Phê duyệt đầy đơn của mấy kỳ trước. */
function freshS(nOld){
  const S={rev:1,
    employees:[{id:'e1',name:'NGUYEN VAN A',pos:'operator'},
               {id:'e2',name:'TRAN VAN B',pos:'field_eng'},
               {id:'ap',name:'HOANG TRUNG',pos:'field_eng'}],
    requests:{},notifs:{},digest:{},meta:{},settings:{}};
  for(let i=0;i<(nOld||0);i++){
    S.requests['old'+i]={id:'old'+i,type:'ot',empId:'e1',status:'approved',
      decidedAt:1,printedAt:1,createdAt:1};
  }
  return S;
}
/* Sinh MỘT thông báo mới — đúng đường mà newNotif() ở 13-portal.js đi qua */
function fire(ctx,S,id,reqId,zk){
  const n={id:id,kind:'info',zk:zk||'apprNeed',to:'ap',from:'e1',reqId:reqId,lvl:'fe'};
  S.notifs[id]=n;ctx.zaloEnqueue(n);return n;
}
const qRows=server=>Object.values(server.data.zaloQueue||{});

async function main(){
head('N1. Kho 200 đơn OT cũ, KHÔNG tin mới → sổ chờ rỗng');
{
  const S=freshS(200),server=makeServer({});
  const c=loadNotify(server,S,9,'2026-08-11');
  ok(Object.keys(S.requests).length===200,'kho có 200 đơn OT đã duyệt & đã in');
  ok(c.digestPending()===0,'★ sổ chờ = 0 — KHÔNG quét màn Phê duyệt');
  let done=null;c.digestFlush(false,v=>done=v);await tick();
  ok(qRows(server).length===0,'★ không gửi tin nào (không có gì mới để báo)');
}

head('N2. Chỉ tin MỚI PHÁT SINH mới vào sổ chờ');
{
  const S=freshS(200),server=makeServer({});
  const c=loadNotify(server,S,9,'2026-08-11');
  fire(c,S,'n1','r_new1');S.requests.r_new1={id:'r_new1',type:'ot',empId:'e1',status:'pending'};
  /* Lưu ý thứ tự: digestApplies() đọc S.requests lúc tin sinh ra, nên đơn
     phải có TRƯỚC khi bắn tin. Dựng lại cho đúng đời thật: */
  const S2=freshS(200),sv2=makeServer({}),c2=loadNotify(sv2,S2,9,'2026-08-11');
  ['a','b','c'].forEach((k,i)=>{
    S2.requests['r_'+k]={id:'r_'+k,type:'ot',empId:'e1',status:'pending'};
    fire(c2,S2,'n_'+k,'r_'+k);
  });
  ok(Object.keys(S2.requests).length===203,'kho: 200 đơn cũ + 3 đơn mới');
  ok(c2.digestPending()===3,'★ sổ chờ = 3, KHÔNG phải 203  [n='+c2.digestPending()+']');
}

head('N3. Bắn xong → sổ chờ rỗng, đơn cũ không sinh thêm mục');
let S3=null,sv3=null,c3=null;
{
  S3=freshS(200);sv3=makeServer({});c3=loadNotify(sv3,S3,8,'2026-08-11');
  ['a','b','c'].forEach(k=>{
    S3.requests['r_'+k]={id:'r_'+k,type:'ot',empId:'e1',status:'pending'};
    fire(c3,S3,'n_'+k,'r_'+k);
  });
  let done=null;c3.digestFlush(false,v=>done=v);await tick();
  const rows=qRows(sv3);
  ok(done===true,'bắn thành công');
  ok(rows.length===1&&rows[0].n===3,'★ đúng 1 tin gom 3 mục mới  [n='+(rows[0]&&rows[0].n)+']');
  ok(c3.digestPending()===0,'sổ chờ đã dọn sạch');
  ok(Object.keys(S3.requests).length===203,'kho đơn không bị đụng tới');
}

head('N4–N5. Tin sinh SAU khi bắn → chờ đợt sau, không gửi lại tin cũ');
{
  /* Cùng ngày, sau khi đã bắn: có đơn OT mới lúc 15h */
  S3.requests.r_d={id:'r_d',type:'ot',empId:'e2',status:'pending'};
  fire(c3,S3,'n_d','r_d');
  ok(c3.digestPending()===1,'★ chỉ 1 mục chờ — 3 mục đã gửi không quay lại');
  const before=qRows(sv3).length;
  let again=null;c3.digestFlush(false,v=>again=v);await tick();
  ok(again===false&&qRows(sv3).length===before,'N5 gọi bắn lại trong ngày → không gửi gì');

  /* Sáng hôm sau */
  const c4=loadNotify(sv3,S3,8,'2026-08-12');
  let d2=null;c4.digestFlush(false,v=>d2=v);await tick();
  const rows=qRows(sv3);
  ok(d2===true&&rows.length===2,'hôm sau bắn đợt mới  [tổng tin='+rows.length+']');
  const last=rows[rows.length-1];
  ok(last.n===1,'★ đợt mới CHỈ có 1 mục mới, không gửi lại 3 mục hôm qua  [n='+last.n+']');
  ok(c4.digestPending()===0,'sổ chờ lại rỗng');
}

head('N6. Đổi trạng thái đơn cũ mà không sinh tin → sổ vẫn rỗng');
{
  const S=freshS(50),server=makeServer({});
  const c=loadNotify(server,S,9,'2026-08-11');
  Object.keys(S.requests).forEach(id=>{S.requests[id].status='pending';});   // "mở lại" 50 đơn cũ
  ok(c.digestPending()===0,'★ sổ chờ vẫn 0 — sổ chỉ nhận tin lúc newNotif() sinh ra');
}

head('N7. Huỷ đơn trước giờ bắn → gỡ khỏi sổ, không tốn tin');
{
  const S=freshS(10),server=makeServer({});
  const c=loadNotify(server,S,7,'2026-08-11');
  S.requests.r_x={id:'r_x',type:'ot',empId:'e1',status:'pending'};
  fire(c,S,'n_x','r_x');
  ok(c.digestPending()===1,'đơn mới đã vào sổ chờ');
  c.zaloWithdraw('n_x');
  ok(c.digestPending()===0,'★ huỷ lúc 07:30 → bốc hơi khỏi sổ, sáng mai không nhắc');
  ok(qRows(server).length===0,'không tin Zalo nào bị tốn');
}

head('N9. Đơn bị HUỶ theo đường thật (cancelReq) → không nhắc sáng mai');
{
  const S=freshS(10),server=makeServer({});
  const c=loadNotify(server,S,7,'2026-08-11');
  S.requests.r_c={id:'r_c',type:'ot',empId:'e1',status:'pending'};
  fire(c,S,'n_c','r_c');
  ok(c.digestPending()===1,'15h: đơn OT mới vào sổ chờ');
  /* Mô phỏng ĐÚNG những gì cancelReq() làm ở js/08-requests.js:
     xoá đơn + notifDropForReq() (chỉ dọn tin CHỜ XÁC NHẬN, KHÔNG dọn tin
     info 'apprNeed' — cố ý giữ làm lịch sử trong app). */
  delete S.requests.r_c;
  ok(S.notifs.n_c!==undefined,'tin apprNeed vẫn còn trong app (đúng thiết kế: lịch sử)');
  ok(c.digestPending()===0,'★ nhưng sổ chờ KHÔNG còn tính nó nữa');
  const c2=loadNotify(server,S,8,'2026-08-12');
  let d=null;c2.digestFlush(false,v=>d=v);await tick();
  ok(qRows(server).length===0,'★ sáng mai KHÔNG bắn tin nào về đơn đã huỷ');
  ok(S.digest.n_c===undefined,'…và mục lỗi thời đã bị dọn khỏi sổ');
}

head('N10. Đơn ĐÃ DUYỆT xong trước 08:00 → không nhắc "cần duyệt" nữa');
{
  const S=freshS(5),server=makeServer({});
  const c=loadNotify(server,S,7,'2026-08-11');
  S.requests.r_p={id:'r_p',type:'ot',empId:'e1',status:'pending'};
  fire(c,S,'n_p','r_p');                       // apprNeed
  ok(c.digestPending()===1,'chiều: nhắc "có đơn chờ duyệt"');
  S.requests.r_p.status='approved';             // quản lý duyệt lúc 20h
  fire(c,S,'n_pa','r_p','approved');            // tin kết quả duyệt
  const rows=c.digestLive();
  ok(rows.length===1&&rows[0].notifId==='n_pa',
     '★ chỉ còn tin KẾT QUẢ DUYỆT; lời nhắc "cần duyệt" tự rơi  [n='+rows.length+']');
}

head('N8. Con số "Đang chờ" ở màn Dữ liệu nghĩa là gì');
{
  const S=freshS(200),server=makeServer({});
  const c=loadNotify(server,S,9,'2026-08-11');
  Object.keys(S.requests).forEach(id=>{S.requests[id].status='pending';});
  ['a','b'].forEach(k=>{
    S.requests['r_'+k]={id:'r_'+k,type:'ot',empId:'e1',status:'pending'};
    fire(c,S,'n_'+k,'r_'+k);
  });
  const nPendingReq=Object.values(S.requests).filter(r=>r.status==='pending').length;
  ok(nPendingReq===202,'có 202 đơn đang chờ duyệt');
  ok(c.digestPending()===2,'★ nhưng "Đang chờ" chỉ ghi 2 = số TIN chưa gửi lần nào');
}

console.log('\n'+'─'.repeat(52));
console.log(pass+' đạt · '+fail+' hỏng');
process.exit(fail?1:0);
}
main();
