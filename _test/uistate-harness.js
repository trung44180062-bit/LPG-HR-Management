/* ============================================================
   HARNESS — GIỮ CHỖ ĐANG ĐỨNG KHI VẼ LẠI HỘP THOẠI   ★ v7.3
   ------------------------------------------------------------
   Chạy:  node _test/uistate-harness.js
   ------------------------------------------------------------
   Lỗi người dùng báo: mỗi lần bấm một ô tích, hoặc gõ vào ô tìm kiếm,
   màn hình nhảy vọt lên đầu và ô đang gõ mất con trỏ.

   Nguyên nhân: renderTrainMgr() ghi đè TOÀN BỘ innerHTML → trình duyệt
   vứt scrollTop và focus. Bài kiểm dưới đây dựng một DOM giả đủ dùng
   (scrollTop, focus, selectionRange, querySelector theo data-k) rồi soi:

     A. uiSnap/uiRestore giữ được chỗ cuộn của hộp thoại và của danh sách con
     B. giữ được ô đang focus + vị trí con trỏ trong ô đó
     C. renderTrainMgr() thật sự gọi cặp hàm đó
     D. mọi ô có thể nhận focus đều đã gắn data-k
     E. gõ tìm kiếm CHỈ vẽ lại danh sách người, không dựng lại cả hộp thoại
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m+(x!==undefined?'   ['+x+']':''));}
                   else{fail++;console.log('  ✗ '+m+(x!==undefined?'   ['+x+']':''));}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8');

/* ---------- DOM giả: đúng những gì uiSnap/uiRestore đụng tới ---------- */
function makeEl(tag,attrs){
  const el={tag,dataset:{},scrollTop:0,children:[],value:'',
    selectionStart:null,selectionEnd:null,_focused:false};
  Object.assign(el,attrs||{});
  el.contains=n=>{
    if(n===el)return true;
    return el.children.some(c=>c.contains?c.contains(n):c===n);
  };
  el.querySelector=sel=>{
    const hit=n=>{
      if(sel.startsWith('[data-k='))
        return n.dataset&&n.dataset.k===sel.slice(9,-2);
      return n.cls===sel;
    };
    const walk=n=>{
      if(hit(n))return n;
      for(const c of (n.children||[])){const r=walk(c);if(r)return r;}
      return null;
    };
    for(const c of el.children){const r=walk(c);if(r)return r;}
    return null;
  };
  el.focus=()=>{DOC.activeElement=el;el._focused=true;};
  el.setSelectionRange=(a,b)=>{el.selectionStart=a;el.selectionEnd=b;};
  return el;
}
const DOC={activeElement:null,_byId:{},
  getElementById(id){return DOC._byId[id]||null;},
  addEventListener(){},querySelectorAll(){return [];}};

function build(){
  const sb={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>0,isNaN,parseInt,parseFloat};
  sb.globalThis=sb;sb.window=sb;sb.document=DOC;
  sb.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  vm.createContext(sb);
  /* Chỉ cần $ và hai hàm cần kiểm — nạp js/03-nav.js trọn vẹn thì kéo theo
     cả go()/refreshBadge() vốn cần đủ thứ khác. Ở đây khai $ rồi nạp ĐÚNG
     khối uiSnap/uiRestore lấy nguyên văn từ file thật. */
  vm.runInContext(`function $(id){return document.getElementById(id);}`,sb);
  const src=rd('03-nav.js');
  const i=src.indexOf('function uiSnap(');
  const j=src.indexOf('/* bottom sheet');
  if(i<0||j<0)throw new Error('không tìm thấy khối uiSnap trong js/03-nav.js');
  vm.runInContext(src.slice(i,j),sb);
  return sb;
}

/* ============================================================ */
head('A. Giữ chỗ cuộn');
{
  const sb=build();
  const list=makeEl('div',{cls:'.tr-people'});
  const days=makeEl('div',{cls:'.tr-days'});
  const box=makeEl('div');box.children=[list,days];
  DOC._byId.trBody=box;
  box.scrollTop=640; list.scrollTop=120; days.scrollTop=44;

  const snap=sb.uiSnap('trBody',['.tr-people','.tr-days']);
  /* "vẽ lại": mọi phần tử là mới toanh, scrollTop về 0 — đúng như trình duyệt làm */
  const list2=makeEl('div',{cls:'.tr-people'});
  const days2=makeEl('div',{cls:'.tr-days'});
  box.children=[list2,days2];box.scrollTop=0;
  sb.uiRestore(snap);

  ok(box.scrollTop===640,'A1 ★ hộp thoại giữ nguyên chỗ cuộn (lỗi cũ: nhảy về 0)',box.scrollTop);
  ok(list2.scrollTop===120,'A2 danh sách người giữ nguyên chỗ cuộn',list2.scrollTop);
  ok(days2.scrollTop===44,'A3 bảng từng ngày giữ nguyên chỗ cuộn',days2.scrollTop);
}

head('B. Giữ ô đang gõ và con trỏ');
{
  const sb=build();
  const q=makeEl('input');q.dataset.k='q';q.value='nguyen';
  q.selectionStart=3;q.selectionEnd=3;
  const box=makeEl('div');box.children=[q];
  DOC._byId.trBody=box;DOC.activeElement=q;

  const snap=sb.uiSnap('trBody',[]);
  const q2=makeEl('input');q2.dataset.k='q';q2.value='nguyen';
  box.children=[q2];DOC.activeElement=null;
  sb.uiRestore(snap);

  ok(DOC.activeElement===q2,'B1 ★ focus quay lại đúng ô tìm kiếm (lỗi cũ: mất sau mỗi phím)');
  ok(q2.selectionStart===3&&q2.selectionEnd===3,'B2 ★ con trỏ về đúng vị trí giữa chữ',
     q2.selectionStart);
}
{
  /* Ô type=time / select không có selectionStart — đọc là ném lỗi, phải nuốt */
  const sb=build();
  const tm=makeEl('input');tm.dataset.k='tIn';
  Object.defineProperty(tm,'selectionStart',{get(){throw new Error('InvalidStateError');}});
  const box=makeEl('div');box.children=[tm];
  DOC._byId.trBody=box;DOC.activeElement=tm;
  let snap=null,threw=false;
  try{snap=sb.uiSnap('trBody',[]);}catch(e){threw=true;}
  ok(!threw,'B3 ô giờ (type=time) không làm nổ uiSnap');
  const tm2=makeEl('input');tm2.dataset.k='tIn';box.children=[tm2];DOC.activeElement=null;
  sb.uiRestore(snap);
  ok(DOC.activeElement===tm2,'B3 …và vẫn trả focus về đúng ô giờ');
}
{
  /* Ô đã biến mất sau khi vẽ lại (VD lọc bỏ người đó) → không được nổ */
  const sb=build();
  const q=makeEl('input');q.dataset.k='p-e9';
  const box=makeEl('div');box.children=[q];
  DOC._byId.trBody=box;DOC.activeElement=q;
  const snap=sb.uiSnap('trBody',[]);
  box.children=[];DOC.activeElement=null;
  let threw=false;try{sb.uiRestore(snap);}catch(e){threw=true;}
  ok(!threw,'B4 ô biến mất sau khi vẽ lại → bỏ qua trong im lặng, không nổ');
}
{
  /* Không có ô nào đang focus → không tự dựng focus ở đâu cả */
  const sb=build();
  const box=makeEl('div');DOC._byId.trBody=box;DOC.activeElement=null;
  const snap=sb.uiSnap('trBody',[]);
  sb.uiRestore(snap);
  ok(DOC.activeElement===null,'B5 không ai đang gõ thì đừng tự cướp focus');
}

/* ============================================================ */
head('C · D · E. Đã nối vào màn Đào tạo và màn Sự kiện');
{
  const tr=rd('22-training.js'), ev=rd('20-events.js'), nav=rd('03-nav.js');
  ok(/uiSnap\('trBody',TR_SCROLLERS\)/.test(tr),'C1 renderTrainMgr chụp trạng thái trước khi vẽ');
  ok(/uiRestore\(snap\);\s*\n\}/.test(tr),'C1 …và đặt lại sau khi vẽ xong');
  ok(/typeof uiSnap==='function'/.test(tr)&&/typeof uiRestore==='function'/.test(tr),
     'C1 gọi chéo file có bọc typeof — thiếu js/03-nav.js cũng không nổ');
  ok(/TR_SCROLLERS=\['\.tr-people','\.tr-days'\]/.test(tr),'C2 khai đúng hai danh sách cuộn bên trong');
  ok(/uiSnap\('evBody'/.test(ev)&&/uiRestore\(snap\);/.test(ev),
     'C3 màn Sự kiện cũng đã chữa (cùng một lỗi)');
  ok(/function uiSnap/.test(nav)&&/function uiRestore/.test(nav),
     'C4 helper nằm ở js/03-nav.js — dùng chung, không nhân bản');

  /* D — mọi ô nhận focus được phải có data-k, không thì restore không tìm ra */
  const inputs=tr.match(/<(?:input|select)\b[^>]*>/g)||[];
  const miss=inputs.filter(x=>!/data-k=/.test(x));
  ok(miss.length===0,'D1 ★ mọi ô input/select ở màn Đào tạo đều có data-k',
     miss.length?miss.map(x=>x.slice(0,58)).join(' | '):'0 ô thiếu');

  /* E — ô tìm kiếm không được kéo theo cả hộp thoại */
  ok(/function trSetQ\(v\)\{trQ=v\|\|'';trRenderPeople\(\);\}/.test(tr),
     'E1 ★ gõ tìm kiếm chỉ vẽ lại danh sách người');
  ok(/function trRenderPeople\(\)/.test(tr)&&/trPeopleBox/.test(tr),
     'E2 có hộp riêng cho danh sách người để cập nhật cục bộ');
  ok(/const old=box\.querySelector\('\.tr-people'\)[\s\S]{0,220}scrollTop=top/.test(tr),
     'E3 lọc xong vẫn giữ chỗ cuộn trong danh sách');
}

console.log('\n════════════════════════════════════');
console.log((fail?'✗ HỎNG '+fail+' / ':'✓ ĐẠT HẾT ')+(pass+fail)+' bài');
console.log('════════════════════════════════════');
process.exit(fail?1:0);
