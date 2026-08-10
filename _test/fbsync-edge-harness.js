/* ============================================================
   HARNESS ĐỒNG BỘ — CÁC TÌNH HUỐNG BIÊN
   Chạy:  node _test/fbsync-edge-harness.js
   ------------------------------------------------------------
   Bản fbsync-harness.js chạy đường thẳng (mạng tốt, ghi luôn thành công)
   và đạt hết. File này mô phỏng những gì THẬT SỰ xảy ra ngoài đời:
     KB7  ghi lên máy chủ BỊ TỪ CHỐI (rules / mất mạng) → thay đổi có mất không
     KB8  mất mạng lúc xoá, có mạng lại (không tải lại trang)
     KB9  máy chủ CHƯA CÓ nhánh 'del' (dự án cũ) + rev máy này mới hơn
     KB10 hai máy xoá/sửa xen kẽ
   ============================================================ */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const STORAGE=fs.readFileSync(path.join(ROOT,'js/02-storage.js'),'utf8');

function makeServer(){
  const data={}; const subs=[];
  const clone=v=>v===undefined||v===null?v:JSON.parse(JSON.stringify(v));
  let reject=null;                 // hàm quyết định patch nào bị từ chối
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
    removeChild(br,id){if(data[br]&&data[br][id]!==undefined){delete data[br][id];emit(br,'child_removed',id,null);}}
  };
}

function makeDevice(name, server, seed){
  const dev={name, offline:false, renders:0, writeFails:0};
  const store={};
  const ctx={
    console:{warn(){},log(){},info(){},error(){}}, setTimeout, clearTimeout, Date, Math, JSON,
    Object, Array, String, Number, Boolean, Set,
    localStorage:{getItem:k=>store[k]===undefined?null:store[k],
                  setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];}},
    APP_CFG:{dbPath:'t',firebase:{}}, LS:'lpgt_test',
    DEPT_DEFAULT_FALLBACK:'BP', APPROVER1_FALLBACK:'', APPROVER2_FALLBACK:'',
    S:JSON.parse(JSON.stringify(seed)),
    fb:null, fbRef:null, applyingRemote:false,
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
          if(!dev.offline){const s=server.snapshot()[branch];fn({val:()=>s===undefined?null:s,key:branch});}
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
    update(patch){
      if(dev.offline){dev.writeFails++;return Promise.reject(new Error('offline'));}
      const r=server.update(JSON.parse(JSON.stringify(patch)));
      if(!r.ok){dev.writeFails++;return Promise.reject(new Error('PERMISSION_DENIED'));}
      return Promise.resolve();
    },
    off(){server.unsubAll(dev);}
  };
  ctx.fbRef=REF;
  ctx.firebase={database:()=>({ref:()=>REF}),apps:[{}],auth:null};

  dev.ctx=ctx;
  dev.S=()=>ctx.S;
  dev.save=()=>{ctx.S.rev=Date.now();store['lpgt_test']=JSON.stringify(ctx.S);ctx.fbPush();};
  dev.attach=()=>ctx.fbAttach();
  dev.persist=()=>{store['lpgt_test']=JSON.stringify(ctx.S);};
  dev.reopen=()=>{server.unsubAll(dev);const raw=store['lpgt_test'];
                  ctx.S=raw?JSON.parse(raw):ctx.S;ctx.normalizeState();ctx.fbAttach();};
  return dev;
}

const R=[]; const ok=(n,c,e)=>R.push([!!c,n,e||'']);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SETTLE=1200;
const SEED={rev:1,employees:[{id:'e1',name:'A',team:'A',active:true}],
  base:{},over:{},requests:{},accounts:{},printLog:{},notifs:{},events:{},
  del:{},settings:{minD:3,minN:3},meta:{}};

async function main(){

/* ============================================================
   KB7 — GHI BỊ TỪ CHỐI (rules chặn / quota / mạng chập)
   Firebase update() là NGUYÊN KHỐI: một khoá trong gói sai luật là
   CẢ GÓI bị từ chối, kể cả khoá xoá đơn nằm chung gói.
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); await wait(SETTLE); A.save(); await wait(50);
  ok('KB7 chuẩn bị: máy chủ có đơn', !!(sv.data.requests&&sv.data.requests.r1));

  sv.setReject(()=>true);                    // từ đây mọi lệnh ghi đều trượt
  delete A.S().requests.r1; A.save(); await wait(50);
  ok('KB7 lệnh ghi đã bị từ chối', A.writeFails>0, 'writeFails='+A.writeFails);
  ok('KB7 máy chủ VẪN còn đơn (đúng, vì ghi trượt)', !!(sv.data.requests&&sv.data.requests.r1));

  sv.setReject(null);                        // mạng/luật trở lại bình thường
  A.S().notifs.n1={id:'n1'}; A.save();       // thao tác kế tiếp bất kỳ
  await wait(80);
  ok('KB7 ★ sau khi ghi lại được, việc XOÁ có được gửi lên không?',
     !(sv.data.requests&&sv.data.requests.r1),
     'server.requests='+JSON.stringify(Object.keys(sv.data.requests||{}))
     +'  ← nếu còn r1 nghĩa là thay đổi bị MẤT VĨNH VIỄN');
}

/* ============================================================
   KB8 — MẤT MẠNG lúc xoá, có mạng lại (không tải lại trang)
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED), B=makeDevice('pc',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); B.attach(); await wait(SETTLE); A.save(); await wait(50);

  A.offline=true;                            // rớt mạng
  delete A.S().requests.r1; A.save(); await wait(50);
  A.offline=false;
  A.S().notifs.n2={id:'n2'}; A.save(); await wait(80);   // có mạng, thao tác tiếp
  ok('KB8 ★ xoá lúc mất mạng có lên máy chủ khi có mạng lại không?',
     !(sv.data.requests&&sv.data.requests.r1),
     'server='+JSON.stringify(Object.keys(sv.data.requests||{})));
  ok('KB8 máy PC không còn thấy đơn', !B.S().requests.r1,
     'B='+JSON.stringify(Object.keys(B.S().requests)));
}

/* ============================================================
   KB9 — MÁY CHỦ CHƯA CÓ NHÁNH 'del' + rev máy này mới hơn
   (dự án tạo từ bản cũ, hoặc bia mộ đã bị dọn hết)
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); await wait(SETTLE); A.save(); await wait(50);

  /* Xoá đơn THẲNG TRÊN MÁY CHỦ, không qua app → không có bia mộ */
  sv.removeChild('requests','r1');
  delete sv.data.del;
  sv.data.rev=1000;
  await wait(50);

  const B=makeDevice('pc',sv,SEED);
  B.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  B.S().rev=Date.now()+60000;                // PC "mới hơn" máy chủ
  B.persist();
  B.attach(); await wait(SETTLE+300);
  ok('KB9 ★ không có bia mộ + PC rev mới hơn → đơn có sống lại không?',
     !B.S().requests.r1 && !(sv.data.requests&&sv.data.requests.r1),
     'B='+JSON.stringify(Object.keys(B.S().requests))
     +' server='+JSON.stringify(Object.keys(sv.data.requests||{})));
}

/* ============================================================
   KB10 — GẮN LISTENER HAI LẦN (initFb chạy lại do đổi config)
   ============================================================ */
{
  const sv=makeServer();
  const A=makeDevice('phone',sv,SEED);
  A.S().requests.r1={id:'r1',empId:'e1',type:'ot',status:'pending'};
  A.attach(); await wait(SETTLE); A.save(); await wait(50);
  A.attach();                                 // gắn lần hai, KHÔNG off() trước
  await wait(SETTLE+200);
  delete A.S().requests.r1; A.save(); await wait(100);
  ok('KB10 gắn listener 2 lần: xoá vẫn tới máy chủ',
     !(sv.data.requests&&sv.data.requests.r1),
     'server='+JSON.stringify(Object.keys(sv.data.requests||{})));
}

let bad=0;
R.forEach(([p,n,e])=>{if(!p)bad++;console.log((p?'  ok  ':'  FAIL')+'  '+n+(e&&!p?'\n         → '+e:''));});
console.log('\n'+(R.length-bad)+'/'+R.length+' đạt'+(bad?('  ·  '+bad+' LỖI'):'  ·  tất cả đạt'));
process.exit(bad?1:0);
}
main();
