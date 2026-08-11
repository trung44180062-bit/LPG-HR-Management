/* ============================================================
   HARNESS — PHÂN QUYỀN v7.7 — thư ký làm việc nhân lực
   ------------------------------------------------------------
   Chạy:  node _test/perm-v77-harness.js
   ------------------------------------------------------------
   A. Cờ quyền của 4 vai: staff / sec / appr / admin (+ kmgr)
   B. Thư ký thêm nhóm · thêm người · sửa · xoá · điền lịch cả kỳ · xoá lịch
   C. Nhân viên thường vẫn bị chặn, mỗi lần đều có lời nhắc
   D. Mật khẩu & phân quyền vẫn CHỈ quản trị
   E. Bảng Tài khoản: thư ký chỉ đọc
   F. Màn đầu tiên của thư ký = của quản lý người Hàn
   ------------------------------------------------------------
   Nạp CODE THẬT trong vm với DOM giả. Phần kiểm tra nằm ở file
   perm-v77-harness.tests.js và chạy BÊN TRONG context, vì js/01-core.js
   khai state bằng `let` (phạm vi lexical, không phải thuộc tính global).
   ============================================================ */
'use strict';
/* Harness kiểm phân quyền v7.6 — nạp code thật, chạy kiểm tra BÊN TRONG context
   vì 01-core.js khai báo state bằng `let` (nằm ở phạm vi lexical, không phải
   thuộc tính của global) nên phải gọi qua vm.runInContext. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const DIR=require('path').join(__dirname,'..');
const els={};
const elStub=()=>({value:'',innerHTML:'',style:{},textContent:'',onchange:null,options:[],
  classList:{add(){},remove(){},toggle(){},contains(){return false}},dataset:{},
  querySelectorAll:()=>[],querySelector:()=>null,appendChild(){},scrollIntoView(){}});
const ctx={console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Set,Map,Error,
  isNaN,parseInt,parseFloat,setTimeout,clearTimeout,setInterval,clearInterval,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  document:{querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},
            getElementById:id=>(els[id]=els[id]||elStub()),
            body:{classList:{add(){},remove(){},toggle(){}}},
            documentElement:{setAttribute(){},lang:'vi'},
            createElement:()=>elStub(),head:{appendChild(){}}},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
  navigator:{},crypto:{},location:{reload(){}},alert(){},confirm:()=>true,prompt:()=>null,
  __T:[],__OUT:[]};
ctx.globalThis=ctx;
vm.createContext(ctx);
const load=f=>{try{vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),ctx,{filename:f});}
  catch(e){ctx.__OUT.push('  ! nạp '+f+' lỗi: '+e.message);}};
['js/config.js','js/01-core.js','js/14-i18n.js','js/04-schedule.js','js/05-roster.js',
 'js/10-account.js','js/11-stats-data.js'].forEach(load);
vm.runInContext(`
  toast=function(m){__T.push(String(m));};
  save=function(){}; renderSetup=function(){}; renderBoth=function(){};
  renderAll=function(){}; renderCal=function(){}; applyRoleUI=function(){};
  refreshBadge=function(){}; fillMonthSelects=function(){}; renderMe=function(){};
  renderGate=function(){}; posSelectHtml=function(){return '';};
  i18nApply=function(){}; icApply=function(){};
  ensureAccount=function(){}; usingDefaultPw=function(){return true;};
  _me=null; meId=function(){return _me;};
`,ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'perm-v77-harness.tests.js'),'utf8'),ctx,{filename:'tests.js'});
console.log(ctx.__OUT.join('\n'));
process.exit(ctx.__FAIL?1:0);
