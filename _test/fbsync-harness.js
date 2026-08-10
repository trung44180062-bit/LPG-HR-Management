/* ============================================================
   HARNESS ĐỒNG BỘ v6.6 — FIREBASE LÀ NGUỒN DUY NHẤT, KHÔNG CACHE
   Chạy:  node _test/fbsync-harness.js   (từ thư mục LPGT-CongCa-Web)
   ------------------------------------------------------------
   Máy không giữ bản sao dữ liệu nào. Điều phải chứng minh:
     · mở app = tải trọn gói từ máy chủ, không đọc gì từ localStorage
     · xoá ở máy này thì máy kia mất theo, và mở lại KHÔNG hiện lại
     · chưa tải xong thì TUYỆT ĐỐI không được ghi (chống xoá sạch máy chủ)
     · ghi trượt thì giữ lại và thử lại, không mất thầm lặng
   ============================================================ */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const STORAGE=fs.readFileSync(path.join(ROOT,'js/02-storage.js'),'utf8');

/* ---------------- MÁY CHỦ GIẢ ---------------- */
function makeServer(){
  const data={}; const subs=[];
  const clone=v=>(v===undefined||v===null)?v:JSON.parse(JSON.stringify(v));
  let reject=null;
  function emit(branch,type,key,val){
    subs.filter(s=>s.branch===branch&&s.type===type)
        .forEach(s=>{ if(s.dev&&s.dev.offline)return; s.fn(key,clone(val)); });
  }
  return {
    data, setReject(f){reject=f;},
    sub(b,t,fn,dev){subs.push({branch:b,type:t,fn,dev});},
    unsubAll(dev){for(let i=subs.length-1;i>=0;i--)if(subs[i].dev===dev)subs.splice(i,1);},
    snapshot(){return clone(data);},
    update(patch){
      if(reject&&reject(patch))return {ok:false};
      Object.keys(patch).forEach(k=>{
        const v=patch[k], p=k.split('/');
        if(p.length===1){
          if(v===null||v===undefined)delete data[k]; else data[k]=clone(v);
          emit(k,'value',k,data[k]);
        }else{
          const [br,id]=p; data[br]=data[br]||{};
          const had=data[br][id]!==undefined;
          if(v===null||v===undefined){delete data[br][id]; if(had)emit(br,'child_removed',id,null);}
          else{data[br][id]=clone(v); emit(br,had?'child_changed':'child_added',id,data[br][id]);}
        }
      });
      return {ok:true};
    },
    removeChild(br,id){if(data[br]&&data[br][id]!==undefined){delete data[br][id];emit(br,'child_removed',id,null);}},
    seed(o){Object.keys(o).forEach(k=>{data[k]=clone(o[k]);});}
  };
}

/* ---------------- MỘT MÁY (một trình duyệt) ---------------- */
function makeDevice(name, server){
  const dev={name, offline:false, renders:0, writeFails:0};
  const store={};                    // localStorage riêng của máy này
  const ctx={
    console:{warn(){},log(){},info(){},error(){}}, setTimeout, clearTimeout,
    Date, Math, JSON, Object, Array, String, Number, Boolean, Set,
    localStorage:{getItem:k=>store[k]===undefined?null:store[k],
                  setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];}},
    APP_CFG:{dbPath:'t',firebase:{}}, LS:'lpgt_test',
    DEPT_DEFAULT_FALLBACK:'BP', APPROVER1_FALLBACK:'', APPROVER2_FALLBACK:'',
    S:{}, fb:null, fbRef:null, applyingRemote:false,
    decorateEmpNames(){}, refreshBadge(){}, mealResetCache(){}, evResetCache(){},
    renderAll(){dev.renders++;}, setSync(){}, $:()=>null, toast(){}, t:s=>s,
    confirm:()=>true, location:{reload(){}}
  };
  ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
  vm.runInContext(STORAGE,ctx,{filename:'02-storage.js'});
  ctx.setSync=function(){};

  function childRef(branch){
    return {
      on(type,fn){
        if(type==='value'){
          server.sub(branch,'value',(k,v)=>fn({val:()=>v,key:k}),dev);
          if(!dev.offline){const v=server.snapshot()[branch];fn({val:()=>v===undefined?null:v,key:branch});}
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
  const REF={
    child:b=>childRef(b),
    once(){
      if(dev.offline)return Promise.reject(new Error('offline'));
      return Promise.resolve({val:()=>server.snapshot()});
    },
    update(patch){
      if(dev.offline){dev.writeFails++;return Promise.reject(new Error('offline'));}
      const r=server.update(JSON.parse(JSON.stringify(patch)));
      if(!r.ok){dev.writeFails++;return Promise.reject(new Error('PERMISSION_DENIED'));}
      return Promise.resolve();
    },
    off(){server.unsubAll(dev);}
  };
  ctx.fbRef=REF;
  ctx.firebase={database:()=>({ref:p=>p==='.info/connected'?{on(){}}:REF}),apps:[{}],auth:null};

  dev.ctx=ctx;
  dev.S=()=>ctx.S;
  dev.ready=()=>ctx.fbReady();
  dev.store=store;
  /* Mở app: y hệt js/12-main.js — load() dựng khung rỗng rồi initFb tải về */
  dev.open=()=>{server.unsubAll(dev);ctx.S={};ctx.load();ctx.fbAttach();};
  dev.save=()=>ctx.save();
  return dev;
}

const R=[]; const ok=(n,c,e)=>R.push([!!c,n,e||'']);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const BOOT=200;      // once() là promise → một nhịp là xong

const SEED={rev:1, employees:[{id:'e1',name:'A',team:'A',active:true}],
  settings:{minD:3,minN:3}, meta:{}};

async function main(){

/* ============================================================
   KB1 — MỞ APP = TẢI TỪ MÁY CHỦ, KHÔNG ĐỌC CACHE
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  sv.update({'requests/r1':{id:'r1',empId:'e1',type:'ot',status:'pending'}});
  const A=makeDevice('pc',sv);
  A.open(); await wait(BOOT);
  ok('KB1 tải được dữ liệu từ máy chủ', !!A.S().requests.r1);
  ok('KB1 tải xong mới bật cờ sẵn sàng', A.ready()===true);
  ok('KB1 KHÔNG ghi dữ liệu xuống localStorage',
     A.store['lpgt_test']===undefined, JSON.stringify(Object.keys(A.store)));
}

/* ============================================================
   KB2 — XOÁ Ở MÁY NÀY, MÁY KIA MẤT THEO NGAY
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  const A=makeDevice('phone',sv), B=makeDevice('pc',sv);
  A.open(); B.open(); await wait(BOOT);
  A.S().requests={r1:{id:'r1',empId:'e1',type:'ot',status:'pending'}};
  A.save(); await wait(60);
  ok('KB2 tạo đơn → máy kia thấy', !!B.S().requests.r1);

  delete A.S().requests.r1; A.save(); await wait(60);
  ok('KB2 xoá → máy kia mất theo', !B.S().requests.r1,
     JSON.stringify(Object.keys(B.S().requests)));
  ok('KB2 máy chủ sạch', !(sv.data.requests&&sv.data.requests.r1));
}

/* ============================================================
   KB3 ★ — MÁY TẮT LÚC XOÁ, MỞ LẠI KHÔNG ĐƯỢC HIỆN LẠI
   (chính là lỗi người dùng gặp: xoá mãi vẫn hiện)
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  const A=makeDevice('phone',sv), B=makeDevice('pc',sv);
  A.open(); B.open(); await wait(BOOT);
  A.S().requests={r1:{id:'r1',empId:'e1',type:'ot',status:'pending'}};
  A.save(); await wait(60);
  ok('KB3 chuẩn bị: PC đang thấy đơn', !!B.S().requests.r1);

  B.offline=true;                                   // tắt PC
  delete A.S().requests.r1; A.save(); await wait(60);
  B.offline=false; B.open(); await wait(BOOT);      // mở PC lên

  ok('KB3 ★ PC mở lên KHÔNG còn đơn đã xoá', !B.S().requests.r1,
     JSON.stringify(Object.keys(B.S().requests)));
  ok('KB3 ★ PC không đẩy đơn ngược lên máy chủ',
     !(sv.data.requests&&sv.data.requests.r1),
     JSON.stringify(Object.keys(sv.data.requests||{})));
}

/* ============================================================
   KB4 ★★ — CHƯA TẢI XONG THÌ KHÔNG ĐƯỢC GHI
   Đây là rủi ro LỚN NHẤT của chế độ không cache: S còn rỗng mà ghi
   là xoá sạch cơ sở dữ liệu.
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  sv.update({'requests/r1':{id:'r1',empId:'e1',type:'ot',status:'pending'},
             'requests/r2':{id:'r2',empId:'e1',type:'leave',status:'pending'}});
  const A=makeDevice('pc',sv);
  A.offline=true; A.open(); await wait(BOOT);       // tải trượt
  ok('KB4 tải trượt → chưa sẵn sàng', A.ready()===false);
  ok('KB4 S còn rỗng', Object.keys(A.S().requests||{}).length===0);

  A.save();                                          // lệnh ghi lúc này
  await wait(60);
  ok('KB4 ★★ máy chủ KHÔNG bị xoá sạch',
     !!(sv.data.requests&&sv.data.requests.r1&&sv.data.requests.r2),
     'server.requests='+JSON.stringify(Object.keys(sv.data.requests||{})));
  ok('KB4 nhân sự trên máy chủ còn nguyên', !!sv.data.employees);
}

/* ============================================================
   KB5 — TẢI TRƯỢT RỒI CÓ MẠNG LẠI → TỰ TẢI LẠI ĐƯỢC
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  sv.update({'requests/r1':{id:'r1',empId:'e1',type:'ot',status:'pending'}});
  const A=makeDevice('pc',sv);
  A.offline=true; A.open(); await wait(BOOT);
  ok('KB5 lúc mất mạng: chưa sẵn sàng', A.ready()===false);
  A.offline=false;
  await wait(3500);                                  // hẹn giờ thử lại 3 giây
  ok('KB5 có mạng lại → tự tải được', A.ready()===true&&!!A.S().requests.r1,
     'ready='+A.ready());
}

/* ============================================================
   KB6 — GHI TRƯỢT KHÔNG ĐƯỢC MẤT THẦM LẶNG
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  const A=makeDevice('phone',sv);
  A.open(); await wait(BOOT);
  A.S().requests={r1:{id:'r1',empId:'e1',type:'ot',status:'pending'}};
  A.save(); await wait(60);
  ok('KB6 chuẩn bị: máy chủ có đơn', !!(sv.data.requests&&sv.data.requests.r1));

  sv.setReject(()=>true);
  delete A.S().requests.r1; A.save(); await wait(60);
  ok('KB6 ghi bị từ chối', A.writeFails>0);
  ok('KB6 máy chủ vẫn còn đơn (đúng)', !!(sv.data.requests&&sv.data.requests.r1));

  sv.setReject(null);
  A.S().notifs={n1:{id:'n1'}}; A.save(); await wait(80);
  ok('KB6 ★ ghi lại được thì lệnh XOÁ vẫn tới nơi',
     !(sv.data.requests&&sv.data.requests.r1),
     JSON.stringify(Object.keys(sv.data.requests||{})));
}

/* ============================================================
   KB7 — ĐỒNG BỘ LẠI: máy chủ nói sao thì đúng vậy
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  const A=makeDevice('pc',sv);
  A.open(); await wait(BOOT);
  /* Giả lập máy này lỡ giữ một bản ghi mà máy chủ không có */
  A.S().requests={ghost:{id:'ghost',empId:'e1',type:'ot'}};
  let n=-9; A.ctx.fbReconcile(x=>{n=x;});
  await wait(80);
  ok('KB7 đối chiếu gỡ sạch bản ghi máy chủ không có',
     !A.S().requests.ghost, JSON.stringify(Object.keys(A.S().requests)));
  ok('KB7 và KHÔNG đẩy nó lên máy chủ',
     !(sv.data.requests&&sv.data.requests.ghost));
}

/* ============================================================
   KB8 — XOÁ Ô LỊCH (nhánh over) cũng phải dứt điểm
   ============================================================ */
{
  const sv=makeServer(); sv.seed(SEED);
  const A=makeDevice('phone',sv), B=makeDevice('pc',sv);
  A.open(); B.open(); await wait(BOOT);
  A.S().over={e1:{'2026-08-19':{code:'N'}}};
  A.save(); await wait(60);
  B.offline=true;
  delete A.S().over.e1; A.save(); await wait(60);
  B.offline=false; B.open(); await wait(BOOT);
  ok('KB8 ô lịch đã xoá không sống lại', !B.S().over.e1,
     JSON.stringify(Object.keys(B.S().over)));
}

let bad=0;
R.forEach(([p,n,e])=>{if(!p)bad++;console.log((p?'  ok  ':'  HỎNG')+'  '+n+(e&&!p?'\n         → '+e:''));});
console.log('\n'+R.length+' phép thử · '+(R.length-bad)+' đạt · '+bad+' hỏng');
process.exit(bad?1:0);
}
main();
