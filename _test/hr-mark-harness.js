/* Kiểm tra dấu "đã nhập hệ thống HR" + bộ lọc HR ở màn Duyệt */
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/08-requests.js','utf8');
const S={requests:{},employees:[{id:'u1',name:'Hoàng Trung'},{id:'u2',name:'Phan Quỳnh Vân'}]};
let saved=0,rendered=0,toasts=[];
const ctx={S,console,Date,Object,String,Number,Array,JSON,Math,Set,
  t:s=>s,t2:s=>s,esc:s=>String(s==null?'':s),noAccent:s=>String(s||'').toLowerCase(),
  meId:()=>'u2',empById:id=>S.employees.find(e=>e.id===id)||null,
  save:()=>saved++,renderAppr:()=>rendered++,renderApprList:()=>{},toast:m=>toasts.push(m),
  confirm:()=>true,fmtDateTime:x=>'['+x+']',fmtVN:s=>s,fmtVNfull:s=>s,rnd1:n=>n,schedMonthOf:()=>'2026-08',reqHours:()=>0,reqStatusLabel:r=>r.status,lvlLabel:x=>x,reqNextLevel:()=>null,curSchedMonth:()=>'2026-08',
  reqIsProvisional:r=>!!r.prov,apprLevelOf:()=>null,myFE:false,mgr:true,
  reqDays:r=>r.days||[],periodFor:()=>({from:'2026-07-21',to:'2026-08-20'}),
  document:{querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem:()=>{}},
  LS:'lp',window:{},asFlagMatch:()=>true,REQ_LABEL:{leave:'Nghỉ phép',ot:'Tăng ca'},REQ_ICON:{leave:'🌴'}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'08'});
ctx.renderAppr=()=>rendered++;ctx.renderApprList=()=>{};ctx.apprPickCount=()=>{};

const mk=(id,st,hr,prov)=>S.requests[id]={id,empId:'u1',type:'leave',status:st,createdAt:1,
  from:'2026-08-05',to:'2026-08-05',days:[{iso:'2026-08-05',code:'AL8'}],
  hrAt:hr?111:0,hrBy:hr?'u2':'',prov:!!prov};
mk('r1','approved',false);mk('r2','approved',true);mk('r3','pending',false);
mk('r4','approved',false,true);   // tạm duyệt, chưa chốt

const T=[];const ok=(n,c,x)=>T.push([c,n,x||'']);
ok('đơn chưa đánh dấu → reqHrDone=false',ctx.reqHrDone(S.requests.r1)===false);
ok('đơn đã đánh dấu → reqHrDone=true', ctx.reqHrDone(S.requests.r2)===true);

ctx.toggleReqHr('r1');
ok('bấm 1 lần → ghi hrAt + hrBy',!!S.requests.r1.hrAt&&S.requests.r1.hrBy==='u2',
   JSON.stringify({at:S.requests.r1.hrAt,by:S.requests.r1.hrBy}));
ok('có gọi save() và vẽ lại',saved===1&&rendered===1);
ctx.toggleReqHr('r1');
ok('bấm lần 2 → xoá hẳn 2 khoá (đỡ tốn Firebase)',
   !('hrAt' in S.requests.r1)&&!('hrBy' in S.requests.r1),JSON.stringify(S.requests.r1.hrAt));

/* Bộ lọc */
const f=vm.runInContext('apprFilter',ctx);
const cnt=v=>{f.hr=v;return Object.values(S.requests).filter(ctx.apprMatch).length;};
f.status='__all';f.print='__all';f.type='__all';f.q='';f.ym='__all';f.flag='';
ok('lọc __all → 4 đơn',cnt('__all')===4,cnt('__all'));
ok('lọc yes  → 1 đơn (r2)',cnt('yes')===1,cnt('yes'));
ok('lọc no   → 3 đơn',cnt('no')===3,cnt('no'));
ok('lọc todo → 1 đơn (chỉ r1: duyệt chốt & chưa nhập; loại r3 chờ duyệt, r4 tạm duyệt)',
   cnt('todo')===1,cnt('todo'));
f.hr='__all';

/* Đánh dấu hàng loạt */
ctx.apprPicked=()=>['r1','r3'];
ctx.markPickedHr(true);
ok('đánh dấu hàng loạt',ctx.reqHrDone(S.requests.r1)&&ctx.reqHrDone(S.requests.r3));
ctx.markPickedHr(false);
ok('bỏ dấu hàng loạt',!ctx.reqHrDone(S.requests.r1)&&!ctx.reqHrDone(S.requests.r3));

/* Chip HTML */
const c1=ctx.reqHrChip(S.requests.r2,true),c0=ctx.reqHrChip(S.requests.r1,false);
ok('chip đã nhập là <button> + class yes',/^<button/.test(c1.trim())&&/hrs yes/.test(c1));
ok('chip chưa nhập (dạng xem) là <span> + class no',/^<span/.test(c0)&&/hrs no/.test(c0));
ok('chip có stopPropagation (bấm không bung dòng)',/stopPropagation/.test(c1));

/* Xuất Excel: số cột đầu đề = số ô dữ liệu */
const head=(src.match(/const head=\[([\s\S]*?)\];/)||['',''])[1];
const nHead=(head.match(/'/g)||[]).length/2;
const nRow=ctx.reqExcelRow(S.requests.r2).length;
const nW=(src.match(/ws\['!cols'\]=\[([\s\S]*?)\];/)||['',''])[1].match(/wch/g).length;
ok('Excel: đầu đề = ô dữ liệu = bề rộng cột',nHead===nRow&&nRow===nW,
   'head='+nHead+' row='+nRow+' cols='+nW);

let bad=0;T.forEach(([c,n,x])=>{if(!c)bad++;console.log((c?'  ✅ ':'  ❌ ')+n+(x!==''&&x!==undefined?'   ['+x+']':''));});
console.log(bad?'\n❌ '+bad+'/'+T.length+' không đạt':'\n✅ '+T.length+'/'+T.length+' đạt');
process.exit(bad?1:0);
