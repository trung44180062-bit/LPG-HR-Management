/* ============================================================
   HARNESS — KHỞI ĐỘNG APP   ★ v7.6.1
   ------------------------------------------------------------
   Chạy:  node _test/boot-harness.js
   ------------------------------------------------------------
   VÌ SAO CÓ BÀI KIỂM NÀY

   v7.6 làm app ĐƠ TRẮNG ngay ở cổng đăng nhập: không gõ được mã NV, không
   bấm được gì. Nguyên nhân là một VÒNG GỌI KÍN mới sinh ra:

       setLang → renderMe → applyRoleUI → applyPerm
               → applyLangForUser → setLang → …

   Không harness nào bắt được, vì tất cả đều kiểm TỪNG HÀM RIÊNG LẺ với
   sandbox tự dựng — không cái nào nạp cả app theo đúng thứ tự index.html
   rồi chạy thử một lượt khởi động. Bài kiểm này lấp đúng lỗ đó.

     A. Nạp toàn bộ js theo ĐÚNG thứ tự index.html — không file nào nổ
     B. Chạy trình tự khởi động của js/12-main.js — không treo, không lặp vô hạn
     C. setLang() gọi lồng nhau vẫn dừng (chốt chống tái nhập)
     D. Đổi ngôn ngữ thật sự có vẽ lại, gọi lại cùng ngôn ngữ thì không
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m+(x!==undefined?'   ['+x+']':''));}
                   else{fail++;console.log('  ✗ '+m+(x!==undefined?'   ['+x+']':''));}};
const head=m=>console.log('\n── '+m);

/* Thứ tự nạp lấy THẲNG từ index.html — không chép tay, để thêm file mới là
   bài kiểm tự biết. */
function scriptOrder(){
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  return [...html.matchAll(/<script src="js\/([^"?]+)/g)].map(m=>m[1]);
}

/* ---------- DOM giả: đủ để cả app chạy qua một lượt khởi động ---------- */
function makeDom(){
  const mk=(tag,id)=>{
    const el={tagName:(tag||'div').toUpperCase(),id:id||'',dataset:{},style:{},children:[],
      innerHTML:'',textContent:'',value:'',title:'',hidden:false,scrollTop:0,options:[],
      selectedIndex:-1,checked:false,disabled:false};
    el.classList={_s:new Set(),add(...c){c.forEach(x=>el.classList._s.add(x));},
      remove(...c){c.forEach(x=>el.classList._s.delete(x));},
      toggle(c,on){on?el.classList._s.add(c):el.classList._s.delete(c);},
      contains:c=>el.classList._s.has(c)};
    el.appendChild=n=>{el.children.push(n);return n;};
    el.querySelector=()=>null; el.querySelectorAll=()=>[];
    el.addEventListener=()=>{}; el.removeEventListener=()=>{};
    el.focus=()=>{}; el.setSelectionRange=()=>{};
    el.contains=()=>false; el.closest=()=>null; el.remove=()=>{};
    el.getAttribute=()=>null; el.setAttribute=()=>{};
    el.insertAdjacentHTML=()=>{};
    return el;
  };
  const store={};
  const doc={
    body:mk('body'), documentElement:mk('html'), activeElement:null,
    getElementById(id){return store[id]||(store[id]=mk('div',id));},
    querySelector(){return null;}, querySelectorAll(){return [];},
    createElement(t){return mk(t);}, createTextNode(){return mk('text');},
    addEventListener(){}, removeEventListener(){},
    createTreeWalker(){return{nextNode:()=>null};}
  };
  doc.documentElement.setAttribute=()=>{};
  return doc;
}

function bootSandbox(){
  const sb={console:{log(){},warn(){},error(){},info(){}},
    JSON,Object,Array,String,Number,Math,RegExp,Set,Map,Date,Promise,
    isNaN,parseInt,parseFloat,encodeURIComponent,decodeURIComponent,
    setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>0,
    requestAnimationFrame:()=>0, alert(){}, confirm:()=>true, prompt:()=>null};
  sb.globalThis=sb; sb.window=sb; sb.self=sb;
  sb.document=makeDom();
  sb.location={reload(){sb.__reloaded=true;},href:'',hash:''};
  sb.navigator={userAgent:'node',language:'vi'};
  sb.localStorage={_d:{},getItem(k){return this._d[k]===undefined?null:this._d[k];},
    setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
  sb.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  sb.MutationObserver=function(){return{observe(){},disconnect(){}};};
  sb.NodeFilter={SHOW_TEXT:4,SHOW_ELEMENT:1,FILTER_ACCEPT:1,FILTER_REJECT:2,FILTER_SKIP:3};
  sb.Node={TEXT_NODE:3,ELEMENT_NODE:1};
  sb.XLSX={utils:{}}; sb.firebase=undefined;   // không có Firebase → app chạy chế độ chờ
  sb.APP_CFG={firebase:null};
  vm.createContext(sb);
  return sb;
}

/* ============================================================ */
head('A. Nạp toàn bộ js theo đúng thứ tự index.html');
let SB=null, files=scriptOrder();
{
  ok(files.length>=20,'A0 đọc được thứ tự nạp từ index.html',files.length+' file');
  ok(files[files.length-1]==='12-main.js','A0 12-main.js nạp CUỐI CÙNG',files[files.length-1]);
  SB=bootSandbox();
  let broke=null;
  for(const f of files){
    if(f==='12-main.js')continue;                 // boot chạy riêng ở mục B
    if(f==='config.js'&&!fs.existsSync(path.join(ROOT,'js',f)))continue;
    try{ vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f),'utf8'),SB,{filename:f}); }
    catch(e){ broke=f+' → '+e.message; break; }
  }
  ok(!broke,'A1 ★ mọi file nạp trót lọt, không file nào nổ',broke||'ok');
}

/* ============================================================ */
head('B. Chạy trình tự khởi động (js/12-main.js)');
{
  /* Vòng lặp vô hạn thì Node treo luôn, không báo lỗi — nên phải ĐẾM số lần
     vào setLang. Vượt ngưỡng là ném lỗi, biến "treo im lặng" thành "đỏ rõ ràng". */
  vm.runInContext(`
    globalThis.__nLang=0;
    const __setLang=setLang;
    setLang=function(l,r){
      if(++globalThis.__nLang>50)throw new Error('setLang lặp vô hạn — vòng gọi kín đã quay lại');
      return __setLang(l,r);
    };
  `,SB);
  let err=null;
  try{ vm.runInContext(fs.readFileSync(path.join(ROOT,'js','12-main.js'),'utf8'),SB,{filename:'12-main.js'}); }
  catch(e){ err=e.message; }
  ok(!err,'B1 ★ khởi động chạy hết, KHÔNG treo (lỗi cũ: đơ ở cổng đăng nhập)',err||'ok');
  /* applyPerm() được gọi ở vài chỗ trong lượt khởi động, mỗi lần kéo theo một
     applyLangForUser() → setLang(). Vài lần là BÌNH THƯỜNG và vô hại: từ lần
     thứ hai `changed` là false nên không vẽ lại. Điều phải canh là con số
     KHÔNG chạy mất kiểm soát. */
  ok(vm.runInContext('__nLang',SB)<=20,'B2 ★ setLang chạy có giới hạn, không lặp vô hạn',
     vm.runInContext('__nLang',SB)+' lần');
}

/* ============================================================ */
head('C. Chốt chống tái nhập setLang');
{
  const i=fs.readFileSync(path.join(ROOT,'js','14-i18n.js'),'utf8');
  ok(/let _langBusy=false/.test(i),'C1 có cờ chống tái nhập');
  ok(/if\(!changed\|\|_langBusy\)return;/.test(i),'C2 ★ không đổi ngôn ngữ thì KHÔNG vẽ lại');
  ok(/finally\{_langBusy=false;\}/.test(i),'C3 cờ luôn được thả, kể cả khi vẽ lỗi');
}

/* ============================================================ */
head('D. Đổi ngôn ngữ vẫn vẽ lại đúng lúc');
{
  vm.runInContext(`
    globalThis.__nRender=0;
    curView='me';
    renderMe=function(){globalThis.__nRender++;};
    LANG='vi';
  `,SB);
  vm.runInContext(`setLang('en',false);`,SB);
  ok(vm.runInContext('__nRender',SB)===1,'D1 ★ đổi vi→en CÓ vẽ lại đúng 1 lần',
     vm.runInContext('__nRender',SB));
  vm.runInContext(`setLang('en',false);`,SB);
  ok(vm.runInContext('__nRender',SB)===1,'D2 ★ gọi lại CÙNG ngôn ngữ thì KHÔNG vẽ nữa',
     vm.runInContext('__nRender',SB));
  /* renderMe ném lỗi cũng không được làm setLang vỡ */
  vm.runInContext(`LANG='vi';renderMe=function(){throw new Error('vỡ');};`,SB);
  let threw=false;
  try{ vm.runInContext(`setLang('en',false);`,SB); }catch(e){ threw=true; }
  ok(!threw,'D3 vẽ lại lỗi thì nuốt, không kéo cả app xuống');
  ok(vm.runInContext('_langBusy',SB)===false,'D3 …và cờ vẫn được thả');
}

console.log('\n════════════════════════════════════');
console.log((fail?'✗ HỎNG '+fail+' / ':'✓ ĐẠT HẾT ')+(pass+fail)+' bài');
console.log('════════════════════════════════════');
process.exit(fail?1:0);
