/* ============================================================
   HARNESS ĐỒNG BỘ FIREBASE — hai máy, một máy chủ giả
   Chạy:  node _test/fbsync-harness.js   (từ thư mục LPGT-CongCa-Web)
   ------------------------------------------------------------
   Mô phỏng ĐÚNG những gì Realtime Database làm:
     · update(patch) với khoá nhiều mức "a/b" và giá trị null = xoá
     · listener child_added / child_changed / child_removed cho nhánh bảng
     · listener value cho nhánh nhỏ
     · máy offline không nhận sự kiện, online lại thì nhận NGUYÊN HIỆN TRẠNG
       (Firebase không phát lại lịch sử — đây chính là chỗ sinh lỗi hồi sinh)
   Mỗi "máy" chạy js/02-storage.js trong một vm context riêng, có
   localStorage riêng — giống hai trình duyệt thật.
   ============================================================ */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const STORAGE=fs.readFileSync(path.join(ROOT,'js/02-storage.js'),'utf8');

/* ---------------- MÁY CHỦ GIẢ ---------------- */
function makeServer(){
  const data={};                 // cây dữ liệu
  const subs=[];                 // {branch, type, fn, dev}
  const clone=v=>v===undefined||v===null?v:JSON.parse(JSON.stringify(v));

  function emit(branch,type,key,val,exceptDev){
    subs.filter(s=>s.branch===branch&&s.type===type)
        .forEach(s=>{ if(s.dev&&s.dev.offline)return; s.fn(key,clone(val)); });
  }
  return {
    data,
    sub(branch,type,fn,dev){subs.push({branch,type,fn,dev});},
    unsubAll(dev){for(let i=subs.length-1;i>=0;i--)if(subs[i].dev===dev)subs.splice(i,1);},
    /* Trả về hiện trạng — dùng khi một máy vừa gắn listener (Firebase bắn
       child_added cho MỌI con đang có, và value cho nhánh nhỏ) */
    snapshot(){return clone(data);},
    update(patch){
      Object.keys(patch).forEach(k=>{
        const v=patch[k];
        const p=k.split('/');
        if(p.length===1){
          if(v===null||v===undefined)delete data[k]; else data[k]=clone(v);
          emit(k,'value',k,data[k]);
        }else{
          const [br,id]=p;
          data[br]=data[br]||{};
          const had=data[br][id]!==undefined;
          if(v===null||v===undefined){
            delete data[br][id];
            if(had)emit(br,'child_removed',id,null);
          }else{
            data[br][id]=clone(v);
            emit(br,had?'child_changed':'child_added',id,data[br][id]);
          }
        }
      });
    },
    removeChild(br,id){
      if(data[br]&&data[br][id]!==undefined){delete data[br][id];emit(br,'child_removed',id,null);}
    }
  };
}

/* ---------------- MỘT MÁY ---------------- */
function makeDevice(name, server, seed){
  const dev={name, offline:false, renders:0};
  const store={};
  const ctx={
    console:{warn(){},log(){},info(){},error(){}} , setTimeout, clearTimeout, Date, Math, JSON,
    Object, Array, String, Number, Boolean, Set,
    localStorage:{
      getItem:k=>store[k]===undefined?null:store[k],
      setItem:(k,v)=>{store[k]=String(v);},
      removeItem:k=>{delete store[k];}
    },
    APP_CFG:{dbPath:'t', firebase:{}},
    LS:'lpgt_test',
    DEPT_DEFAULT_FALLBACK:'BP', APPROVER1_FALLBACK:'', APPROVER2_FALLBACK:'',
    S:JSON.parse(JSON.stringify(seed)),
    fb:null, fbRef:null, applyingRemote:false,
    decorateEmpNames(){}, refreshBadge(){},
    mealResetCache(){}, evResetCache(){},
    renderAll(){dev.renders++;},
    setSync(){}, $:()=>null, toast(){}, t:s=>s, confirm:()=>true,
    location:{reload(){}}
  };
  ctx.window=ctx; ctx.globalThis=ctx;
  vm.createContext(ctx);

  /* setSync trong 02-storage.js đụng DOM → ghi đè sau khi nạp */
  vm.runInContext(STORAGE,ctx,{filename:'02-storage.js'});
  ctx.setSync=function(){};

  /* --- fbRef giả, khớp API mà 02-storage.js dùng --- */
  function childRef(branch){
    return {
      on(type,fn,err){
        if(type==='value'){
          server.sub(branch,'value',(k,v)=>fn({val:()=>v,key:k}),dev);
          if(!dev.offline)fn({val:()=>server.snapshot()[branch]===undefined?null:server.snapshot()[branch],key:branch});
        }else{
          server.sub(branch,type,(k,v)=>fn({key:k,val:()=>v}),dev);
          if(type==='child_added'&&!dev.offline){
            const cur=server.snapshot()[branch]||{};
            Object.keys(cur).forEach(id=>fn({key:id,val:()=>cur[id]}));
          }
        }
      },
      child(id){return {remove(){server.removeChild(branch,id);return Promise.resolve();}};}
    };
  }
  const FAKE_REF={
    child:branch=>childRef(branch),
    update(patch){
      if(dev.offline)return Promise.resolve();
      server.update(JSON.parse(JSON.stringify(patch)));
      return Promise.resolve();
    },
    off(){server.unsubAll(dev);}
  };
  ctx.fbRef=FAKE_REF;
  ctx.firebase={database:()=>({ref:()=>FAKE_REF}), apps:[{}], auth:null};

  dev.ctx=ctx;
  dev.S=()=>ctx.S;
  dev.save=()=>{ctx.S.rev=Date.now();store['lpgt_test']=JSON.stringify(ctx.S);ctx.fbPush();};
  dev.attach=()=>ctx.fbAttach();
  /* Mở lại app: đọc localStorage, gắn lại listener như lần đầu */
  dev.reopen=()=>{
    server.unsubAll(dev);
    const raw=store['lpgt_test'];
    ctx.S=raw?JSON.parse(raw):ctx.S;
    ctx.normalizeState();
    ctx.fbAttach();
  };
  dev.persist=()=>{store['lpgt_test']=JSON.stringify(ctx.S);};
  return dev;
}

/* ---------------- KHUNG KIỂM THỬ ---------------- */
const R=[];
const ok=(name,cond,extra)=>R.push([!!cond,name,extra||'']);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SETTLE=1200;      // fbSettle chờ 900ms

const SEED={
  rev:1, employees:[{id:'e1',name:'A',team:'A',active:true}],
  base:{}, over:{}, requests:{}, accounts:{}, printLog:{}, notifs:{}, events:{},
  del:{}, settings:{minD:3,minN:3}, meta:{}
};

async function main(){

/* ============================================================
   KB1 — HAI MÁY CÙNG MỞ: xoá trên máy A, máy B phải mất theo
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED), B=makeDevice('pc',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); B.attach(); await wait(SETTLE);
  A.save(); await wait(50);
  ok('KB1 tạo đơn → máy B nhận được', !!B.S().requests.r1);

  delete A.S().requests.r1; A.save(); await wait(50);
  ok('KB1 xoá đơn → máy B mất theo (real-time)', !B.S().requests.r1,
     'B.requests='+JSON.stringify(Object.keys(B.S().requests)));
  ok('KB1 máy chủ sạch', !(sv.data.requests&&sv.data.requests.r1));
  ok('KB1 có bia mộ trên máy chủ', !!(sv.data.del&&sv.data.del['requests/r1']));
}

/* ============================================================
   KB2 — MÁY B ĐANG TẮT lúc xoá, mở lên sau  ← chính là lỗi báo cáo
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED), B=makeDevice('pc',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); B.attach(); await wait(SETTLE);
  A.save(); await wait(50);
  B.persist();                       // PC đã lưu đơn vào localStorage
  ok('KB2 chuẩn bị: PC có đơn trong localStorage', !!B.S().requests.r1);

  B.offline=true;                    // TẮT PC
  delete A.S().requests.r1; A.save(); await wait(50);

  B.offline=false; B.reopen();       // MỞ PC LÊN
  await wait(SETTLE+300);
  ok('KB2 ★ PC mở lên KHÔNG còn thấy đơn đã xoá', !B.S().requests.r1,
     'B.requests='+JSON.stringify(Object.keys(B.S().requests))
     +' del='+JSON.stringify(Object.keys(B.S().del||{})));
  ok('KB2 PC không đẩy đơn ngược lên máy chủ',
     !(sv.data.requests&&sv.data.requests.r1),
     'server.requests='+JSON.stringify(Object.keys(sv.data.requests||{})));
  ok('KB2 PC có vẽ lại màn hình sau khi gỡ', B.renders>0, 'renders='+B.renders);
}

/* ============================================================
   KB3 — PC có rev MỚI HƠN máy chủ (sửa gì đó lúc offline)
          → nhánh else fbPush() của fbBootSync
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED), B=makeDevice('pc',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); B.attach(); await wait(SETTLE);
  A.save(); await wait(50);
  B.persist();
  B.offline=true;
  delete A.S().requests.r1; A.save(); await wait(50);

  /* PC lúc offline tạo một đơn khác → rev của PC lớn hơn rev máy chủ */
  B.S().requests.r9={id:'r9',empId:'e1',type:'ot',status:'pending'};
  B.S().rev=Date.now()+60000;
  B.persist();

  B.offline=false; B.reopen();
  await wait(SETTLE+300);
  ok('KB3 ★ PC rev mới hơn: đơn đã xoá vẫn phải biến mất', !B.S().requests.r1,
     'B.requests='+JSON.stringify(Object.keys(B.S().requests)));
  ok('KB3 đơn PC tạo lúc offline được giữ và đẩy lên',
     !!B.S().requests.r9 && !!(sv.data.requests&&sv.data.requests.r9));
  ok('KB3 đơn đã xoá không sống lại trên máy chủ',
     !(sv.data.requests&&sv.data.requests.r1),
     'server='+JSON.stringify(Object.keys(sv.data.requests||{})));
}

/* ============================================================
   KB4 — MÁY C CHƯA TỪNG BIẾT ĐƠN (localStorage rỗng) — không được hồi sinh
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); await wait(SETTLE); A.save(); await wait(50);
  delete A.S().requests.r1; A.save(); await wait(50);

  const C=makeDevice('may-moi',sv,SEED);
  C.attach(); await wait(SETTLE+300);
  ok('KB4 máy mới không thấy đơn đã xoá', !C.S().requests.r1);
  ok('KB4 máy mới nhận được sổ bia mộ', !!(C.S().del&&C.S().del['requests/r1']));
}

/* ============================================================
   KB5 — XOÁ Ô LỊCH (nhánh over) cũng phải đồng bộ như đơn
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED), B=makeDevice('pc',sv,SEED);
  A.S().over.e1={'2026-08-19':{code:'N'}};
  A.attach(); B.attach(); await wait(SETTLE);
  A.save(); await wait(50);
  B.persist(); B.offline=true;
  delete A.S().over.e1; A.save(); await wait(50);
  B.offline=false; B.reopen(); await wait(SETTLE+300);
  ok('KB5 ★ ô lịch đã xoá không sống lại trên PC', !B.S().over.e1,
     'B.over='+JSON.stringify(Object.keys(B.S().over)));
}

/* ============================================================
   KB6 — MÁY LẠC đẩy lại đơn đã xoá → các máy khác phải dọn
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED), B=makeDevice('pc',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); B.attach(); await wait(SETTLE);
  A.save(); await wait(50);
  delete A.S().requests.r1; A.save(); await wait(80);

  /* một máy cũ (chưa có bia mộ) đẩy thẳng đơn lên */
  sv.update({'requests/r1':{id:'r1',empId:'e1',type:'ot',status:'pending'}});
  await wait(200);
  ok('KB6 ★ đơn lạc bị gỡ khỏi máy chủ',
     !(sv.data.requests&&sv.data.requests.r1),
     'server='+JSON.stringify(Object.keys(sv.data.requests||{})));
  ok('KB6 đơn lạc không hiện trên máy nào',
     !A.S().requests.r1 && !B.S().requests.r1);
}

/* ---------------- KẾT QUẢ ---------------- */
let bad=0;
R.forEach(([p,n,e])=>{if(!p)bad++;console.log((p?'  ok  ':'  FAIL')+'  '+n+(e&&!p?'\n         → '+e:''));});
console.log('\n'+(R.length-bad)+'/'+R.length+' đạt'+(bad?('  ·  '+bad+' LỖI'):'  ·  tất cả đạt'));
process.exit(bad?1:0);
}
main();
