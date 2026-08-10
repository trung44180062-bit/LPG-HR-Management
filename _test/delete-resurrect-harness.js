/* ============================================================
   HARNESS — XOÁ ĐƠN KHÔNG ĐƯỢC HỒI SINH   ★ v6.7
   ------------------------------------------------------------
   Chạy:  node _test/delete-resurrect-harness.js
   ------------------------------------------------------------
   Harness này dựng một Firebase GIẢ nhưng NGHIÊM NGẶT ĐÚNG CHỖ CẦN NGHIÊM:
   nó kiểm tên khoá y như Realtime Database thật và NÉM LỖI ĐỒNG BỘ (throw,
   không phải promise reject) khi gặp `/ . # $ [ ]` trong tên khoá. Chính
   cái throw đó là thứ đã âm thầm nuốt mất mọi lệnh xoá đơn ở v6.2→v6.6:
   `.catch` không bắt được throw, nên app tưởng đã ghi xong.

   Bài kiểm:
     1. Firebase thật từ chối khoá bia mộ dạng phẳng "requests/<id>"  → phải
        chứng minh được lỗi cũ có thật.
     2. Máy A xoá đơn → máy chủ KHÔNG còn đơn (đây là bài mà bản cũ trượt).
     3. Mở app lại (máy chủ là nguồn duy nhất) → đơn KHÔNG hiện lại.
     4. Máy B đang mở → nhận child_removed → đơn biến khỏi máy B.
     5. Máy B lạc hậu đẩy ngược đơn cũ lên → bia mộ chặn, đơn chết hẳn.
     6. Ghi trượt (máy chủ từ chối) → app KHÔNG báo thành công, mốc đồng bộ
        được hoàn tác, và lần gửi lại phải gửi ĐÚNG phần còn thiếu.
     7. Sổ bia mộ dạng cũ trên máy chủ được chuyển sang dạng lồng.
     8. Quyền xoá: chỉ admin / sec / kmgr.
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');

const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok =(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const head=m=>console.log('\n── '+m);

/* ---------- Firebase giả: kiểm khoá y như thật ---------- */
const BAD=/[.#$/\[\]]/;
function assertKeys(val,where){
  if(!val||typeof val!=='object')return;
  for(const k of Object.keys(val)){
    if(BAD.test(k)||!k.length)
      throw new Error('Firebase.update failed: '+where+' contains an invalid key ('+k+')');
    assertKeys(val[k],where+'/'+k);
  }
}
function makeServer(seed){
  return {data:JSON.parse(JSON.stringify(seed||{})),writes:0,rejectNext:false};
}
/* Một "máy" = một bản sao app dùng chung một server giả */
function makeClient(server,name){
  const listeners={};                       // branch → {put,del}
  const ref=makePathRef(server,'',listeners);
  return {name,server,ref,listeners};
}
function deepGet(o,p){return p.split('/').filter(Boolean).reduce((a,k)=>(a==null?a:a[k]),o);}
function deepSet(o,p,v){
  const ks=p.split('/').filter(Boolean),last=ks.pop();
  let cur=o;
  ks.forEach(k=>{if(cur[k]==null||typeof cur[k]!=='object')cur[k]={};cur=cur[k];});
  if(v===null)delete cur[last];else cur[last]=v;
}
function makePathRef(server,base,listeners){
  const self={
    _path:base,
    child(p){return makePathRef(server,base?base+'/'+p:p,listeners);},
    once(){return Promise.resolve({val:()=>{
      const v=base?deepGet(server.data,base):server.data;
      return v===undefined?null:JSON.parse(JSON.stringify(v));
    }});},
    on(ev,cb){ (listeners[base]=listeners[base]||{})[ev]=cb; },
    off(){},
    remove(){return self.update({__self:null});},
    update(patch){
      /* ★ ĐÚNG NHƯ SDK THẬT: kiểm dữ liệu và NÉM NGAY, trước khi có promise */
      for(const k of Object.keys(patch)){
        for(const seg of String(k).split('/'))
          if(!seg.length||BAD.test(seg))
            throw new Error('Firebase.update failed: invalid path segment ('+seg+')');
        assertKeys(patch[k],k);
      }
      if(server.rejectNext){server.rejectNext=false;return Promise.reject(new Error('PERMISSION_DENIED'));}
      server.writes++;
      Object.keys(patch).forEach(k=>deepSet(server.data,(base?base+'/':'')+k,patch[k]));
      return Promise.resolve();
    }
  };
  return self;
}

/* ---------- nạp phần đồng bộ của 02-storage.js vào sandbox ---------- */
function loadStorage(server,seedState){
  const src=fs.readFileSync(path.join(ROOT,'js','02-storage.js'),'utf8');
  /* Chỉ lấy phần thuần logic: từ đầu file tới trước phần KẾT NỐI (DOM/SDK) */
  const cut=src.indexOf('/* =================== KẾT NỐI ===================');
  const body=src.slice(0,cut>0?cut:src.length);
  const sandbox={
    console,setTimeout,clearTimeout,Date,JSON,Object,Array,String,Number,RegExp,Math,
    S:Object.assign({rev:0},JSON.parse(JSON.stringify(seedState||{}))),
    applyingRemote:false,
    fbRef:null,
    t:s=>s, toast:()=>{}, refreshBadge:()=>{},
    setSync:()=>{}, renderAll:()=>{},
    decorateEmpNames:()=>{},
    DEPT_DEFAULT_FALLBACK:'', APPROVER1_FALLBACK:'', APPROVER2_FALLBACK:'',
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    LS:'lpgt'
  };
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(body,sandbox);
  return sandbox;
}
/* Mô phỏng bước "mở app": đọc trọn gói rồi bật cờ sẵn sàng (fbBootLoad rút gọn) */
function boot(ctx,server,clientRef){
  ctx.fbRef=clientRef;
  const srv=JSON.parse(JSON.stringify(server.data));
  ctx.applyingRemote=true;
  ['employees','settings','meta','del'].forEach(k=>{if(srv[k]!=null)ctx.S[k]=srv[k];});
  ['base','over','requests','accounts','printLog','notifs','events'].forEach(k=>{ctx.S[k]=srv[k]||{};});
  ctx.S.rev=+srv.rev||0;
  ctx.normalizeState();
  const delRaw=JSON.stringify(srv.del===undefined?{}:srv.del);
  ctx.applyTombstones();
  ctx.applyingRemote=false;
  ctx._setLast();
  const delFixed=(delRaw!==JSON.stringify(ctx.S.del===undefined?{}:ctx.S.del));
  ctx._ready(true);
  return {delFixed,delRaw};
}

/* Sandbox không lộ biến let ra ngoài → chèn hai hàm cầu nối nhỏ */
function withBridge(ctx){
  vm.runInContext(
    'function _setLast(){_fbLast=fbSnapshot();}\n'+
    'function _markLastDel(js){_fbLast.v.del=js;}\n'+
    'function _ready(v){_fbReady=v;}\n'+
    'function _dirty(){return _fbDirty;}\n',ctx);
  return ctx;
}

const REQ={id:'r_abc',empId:'vc44230075',type:'al',from:'2026-08-11',to:'2026-08-12',status:'pending'};

/* ============================================================ */
head('1. Chứng minh lỗi cũ: Firebase từ chối khoá bia mộ dạng phẳng');
{
  const server=makeServer({requests:{}});
  const c=makeClient(server);
  let threw=false;
  try{ c.ref.update({'requests/r_abc':null, del:{'requests/r_abc':1}, rev:1}); }
  catch(e){ threw=true; }
  ok(threw,'update() NÉM LỖI ĐỒNG BỘ với del={"requests/<id>":…} — đúng lỗi cũ');
  ok(server.writes===0,'…và máy chủ KHÔNG ghi gì cả (kể cả vế xoá đơn)');

  let ok2=true;
  try{ c.ref.update({'requests/r_abc':null, 'del/requests/r_abc':1, rev:1}); }catch(e){ok2=false;}
  ok(ok2,'dạng mới del/<nhánh>/<id> được chấp nhận');
  ok(server.data.requests.r_abc===undefined,'đơn đã bị xoá trên máy chủ');
  ok(server.data.del.requests.r_abc===1,'bia mộ nằm đúng chỗ del/requests/<id>');
}

head('2–3. Máy A xoá đơn → máy chủ sạch → mở lại không thấy đơn');
let serverAfterDelete=null;
{
  const server=makeServer({requests:{r_abc:REQ},rev:1});
  const c=makeClient(server);
  const A=withBridge(loadStorage(server,{}));
  boot(A,server,c.ref);
  ok(A.S.requests.r_abc!==undefined,'máy A mở app thấy đơn');

  delete A.S.requests.r_abc;
  let told=null;
  A.save(v=>{told=v;});
  return_after(()=>{
    ok(told===true,'save() báo THÀNH CÔNG chỉ sau khi máy chủ nhận');
    ok(server.data.requests.r_abc===undefined,'★ máy chủ đã thực sự xoá đơn');
    ok(server.data.del&&server.data.del.requests&&server.data.del.requests.r_abc,'bia mộ đã lên máy chủ');
    serverAfterDelete=server;

    /* mở app lần sau */
    const c2=makeClient(server);
    const A2=withBridge(loadStorage(server,{}));
    boot(A2,server,c2.ref);
    ok(A2.S.requests.r_abc===undefined,'★ mở app lại KHÔNG thấy đơn đã xoá (hết hồi sinh)');
    step4();
  });
}

/* các bước sau chạy nối tiếp vì save() là bất đồng bộ */
function return_after(fn){setTimeout(fn,0);}

function step4(){
  head('4–5. Máy B lạc hậu không đẩy được đơn cũ lên lại');
  const server=serverAfterDelete;
  const cB=makeClient(server);
  /* B vẫn còn đơn trong bộ nhớ (mở từ trước lúc xoá) */
  const B=withBridge(loadStorage(server,{requests:{r_abc:REQ}}));
  B.fbRef=cB.ref;
  /* B nhận sổ bia mộ từ máy chủ rồi mới đẩy */
  B.S.del=JSON.parse(JSON.stringify(server.data.del));
  B._ready(true);B._setLast();
  const n=B.applyTombstones();
  ok(n===1,'applyTombstones gỡ đúng 1 bản ghi đã có bia mộ khỏi máy B');
  ok(B.S.requests.r_abc===undefined,'★ đơn biến mất khỏi máy B');

  B.S.requests.r_abc=JSON.parse(JSON.stringify(REQ));   // B cố tình đẩy ngược
  B.save();
  setTimeout(()=>{
    ok(server.data.requests.r_abc===undefined,'★ máy chủ vẫn sạch — bia mộ chặn được đẩy ngược');
    step6();
  },0);
}

function step6(){
  head('6. Ghi trượt thì KHÔNG được báo thành công, và phải gửi lại đủ');
  const server=makeServer({requests:{r_abc:REQ,r_xyz:{id:'r_xyz'}},rev:1});
  const c=makeClient(server);
  const A=withBridge(loadStorage(server,{}));
  boot(A,server,c.ref);

  delete A.S.requests.r_abc;
  server.rejectNext=true;
  let told=null;
  A.save(v=>{told=v;});
  setTimeout(()=>{
    ok(told===false,'★ máy chủ từ chối → save() báo THẤT BẠI (không nói dối)');
    ok(server.data.requests.r_abc!==undefined,'máy chủ giữ nguyên đơn — đúng sự thật');
    ok(A._dirty()===true,'cờ _fbDirty bật để tự gửi lại');
    /* gửi lại: mốc đã được hoàn tác nên delta vẫn còn nguyên lệnh xoá */
    let told2=null;
    A.save(v=>{told2=v;});
    setTimeout(()=>{
      ok(told2===true,'lần gửi lại thành công');
      ok(server.data.requests.r_abc===undefined,'★ lệnh xoá không bị mất — máy chủ đã xoá');
      ok(server.data.requests.r_xyz!==undefined,'đơn khác không bị đụng tới');
      step7();
    },0);
  },0);
}

function step7(){
  head('7. Sổ bia mộ dạng cũ trên máy chủ được chuyển sang dạng lồng');
  const server=makeServer({requests:{},del:{'requests/r_old':1700000000000},rev:1});
  const c=makeClient(server);
  const A=withBridge(loadStorage(server,{}));
  const b=boot(A,server,c.ref);
  ok(b.delFixed===true,'phát hiện sổ máy chủ còn ở dạng cũ');
  ok(A.S.del.requests&&A.S.del.requests.r_old===1700000000000,'đã chuyển sang del.requests.r_old');
  ok(A.S.del['requests/r_old']===undefined,'khoá phẳng cũ đã bỏ');
  A._markLastDel(b.delRaw);
  A.save();
  setTimeout(()=>{
    ok(server.data.del.requests&&server.data.del.requests.r_old,'★ máy chủ nay giữ sổ dạng lồng');
    ok(server.data.del['requests/r_old']===undefined,'khoá phẳng cũ đã bị dọn khỏi máy chủ');
    step8();
  },0);
}

function step8(){
  head('8. Quyền xoá đơn');
  const src=fs.readFileSync(path.join(ROOT,'js','08-requests.js'),'utf8');
  const m=src.match(/const PURGE_PERMS=\[([^\]]*)\]/);
  ok(!!m,'có khai báo PURGE_PERMS');
  const list=m?m[1].replace(/['\s]/g,'').split(','):[];
  ok(list.includes('admin')&&list.includes('kmgr')&&list.includes('sec'),
     'gồm đúng admin (quản trị), kmgr (quản lý người Hàn), sec (thư ký)');
  ok(!list.includes('appr')&&!list.includes('staff'),
     '★ KHÔNG gồm Section Chief (appr) và nhân viên thường');
  ok(/function cancelPickedReqs\(\)\{\s*if\(!canPurgeReqs\(\)\)/.test(src.replace(/\n/g,'')),
     'xoá hàng loạt đã khoá theo canPurgeReqs()');
  ok(src.includes('function exportThenPurgeReqs(list,label){\n  if(!canPurgeReqs())'),
     'xoá theo kỳ / theo năm cũng khoá theo canPurgeReqs()');
  ok(src.includes('if(canPurgeReqs())return true;'),
     'canCancelReq dùng canPurgeReqs, không còn dùng mgr');
  ok(src.includes('apprAfterDelete'),'mọi đường xoá đi qua apprAfterDelete (chờ máy chủ xác nhận)');

  console.log('\n════════════════════════════════════');
  console.log(fail?('✗ TRƯỢT '+fail+' / ĐẠT '+pass):('✓ ĐẠT HẾT '+pass+' bài'));
  console.log('════════════════════════════════════');
  process.exit(fail?1:0);
}
