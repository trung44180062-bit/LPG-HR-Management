/* ============================================================
   HARNESS — PHÂN QUYỀN v7.7 — lịch thực tế · màn Duyệt · in đơn
   ------------------------------------------------------------
   Chạy:  node _test/perm-v77-appr-harness.js
   ------------------------------------------------------------
   A. Sửa ô lịch thực tế: thư ký được, nhân viên không
   B. Thanh sub-tab màn Duyệt: thư ký giống quản trị
   C. Thư ký KHÔNG duyệt đơn (kể cả gọi thẳng decide())
   D. In đơn của nhóm khác
   ------------------------------------------------------------
   Nạp CODE THẬT trong vm với DOM giả. Phần kiểm tra nằm ở file
   perm-v77-appr.tests.js và chạy BÊN TRONG context, vì js/01-core.js
   khai state bằng `let` (phạm vi lexical, không phải thuộc tính global).
   ============================================================ */
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const DIR=require('path').join(__dirname,'..');
const els={};
const elStub=()=>({value:'',innerHTML:'',style:{},textContent:'',onchange:null,options:[],
  classList:{add(){},remove(){},toggle(){},contains(){return false}},dataset:{},
  querySelectorAll:()=>[],querySelector:()=>null,appendChild(){},scrollIntoView(){},
  addEventListener(){},selectedIndex:0,checked:false});
const ctx={console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Set,Map,Error,
  isNaN,parseInt,parseFloat,setTimeout,clearTimeout,setInterval,clearInterval,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  document:{querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},
    getElementById:id=>(els[id]=els[id]||elStub()),
    body:{classList:{add(){},remove(){},toggle(){}}},
    documentElement:{setAttribute(){},lang:'vi'},createElement:()=>elStub(),head:{appendChild(){}}},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},scrollTo(){}},
  navigator:{},crypto:{},location:{reload(){}},alert(){},confirm:()=>true,prompt:()=>null,
  __T:[],__OUT:[]};
ctx.globalThis=ctx;ctx.scrollTo=()=>{};
vm.createContext(ctx);
const load=f=>{try{vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),ctx,{filename:f});}
  catch(e){ctx.__OUT.push('  ! nạp '+f+': '+e.message);}};
['js/config.js','js/01-core.js','js/14-i18n.js','js/04-schedule.js','js/05-roster.js',
 'js/06-calendar.js','js/07-manpower.js','js/08-requests.js','js/10-account.js',
 'js/11-stats-data.js','js/18-advice.js'].forEach(load);
vm.runInContext(`
  toast=function(m){__T.push(String(m));};
  save=function(){}; renderSetup=function(){}; renderBoth=function(){};
  renderAll=function(){}; applyRoleUI=function(){}; refreshBadge=function(){};
  fillMonthSelects=function(){}; renderMe=function(){}; renderGate=function(){};
  posSelectHtml=function(){return '';}; ensureAccount=function(){};
  usingDefaultPw=function(){return true;}; i18nApply=function(){}; icApply=function(){};
  newNotif=function(){}; notifDrop=function(){}; sweepStaleNotifs=function(){};
  renderMyPanel=function(){}; refreshPrintBadge=function(){}; refreshMealBadge=function(){};
  refreshTrainBadge=function(){}; refreshBellBadge=function(){};
  trCellCls=function(){return '';}; trCellTitle=function(){return '';};
  zaloQueue=function(){}; digestPush=function(){};
  _me=null; meId=function(){return _me;};
`,ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'perm-v77-appr.tests.js'),'utf8'),ctx,{filename:'tests3.js'});
console.log(ctx.__OUT.join('\n'));
process.exit(ctx.__FAIL?1:0);
