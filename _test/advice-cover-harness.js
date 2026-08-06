/* Harness kiểm tra js/18-advice.js bằng dữ liệu giả — chạy bằng Node,
   stub đúng những hàm 01-core/07-manpower/08-requests mà nó gọi. */
const fs=require('fs'),vm=require('vm');
const HOURS={O:8,D:12,N:12,R:0,AL8:8,AL4:4,NP:0,COM:0,OTD:12,OTN:12};
const CAT=c=>({O:'work',D:'work',N:'work',R:'rest',SD:'swap',SN:'swap',SO:'swap',
  AL8:'leave',AL4:'leave',NP:'leave',COM:'leave',OTD:'ot',OTN:'ot',OTL:'ot'})[c]||'other';

const S={rev:1,employees:[],over:{},base:{},requests:{},settings:{minD:3,minN:3,minO:1,maxOffTeam:1,otLimit:40}};
const ctx={S,console,Date,Math,Object,String,Number,Array,JSON,Set,
  POOL_PROD:'prod',POOL_OFF:'office',POOL_LABEL:{prod:'Sản xuất',office:'Văn phòng'},
  t:s=>s,t2:s=>s,esc:s=>String(s==null?'':s),
  fmtVN:s=>s,dowOf:()=>'T2',rnd1:n=>Math.round(n*10)/10,
  chip:c=>'['+c+']',poolChip:p=>'{'+p+'}',
  shortName:n=>String(n||'').split(' ').slice(-2).join(' '),teamShort:x=>x,
  codeInfo:c=>({cat:CAT(c),col:'#eee'}),
  getHours:c=>HOURS[c]||0,
  baseShiftOf:c=>({SD:'D',SN:'N',SO:'O',D:'D',N:'N',O:'O',R:'R'})[c]||'',
  comboOf:()=>null,
  empById:id=>S.employees.find(e=>e.id===id)||null,
  poolOf:e=>(String(e.team||'').toLowerCase().startsWith('office')?'office':'prod'),
  inSchedule:()=>true,
  schedEmps:()=>S.employees.filter(e=>e.active!==false),
  eff:(id,iso)=>{const o=(S.over[id]||{})[iso];return o?{code:o.code,o}:{code:(S.base[id]||{})[iso]||'',o:null};},
  reqDays:r=>r.days||[],
  minOfShift:sh=>sh==='D'?S.settings.minD:sh==='N'?S.settings.minN:S.settings.minO,
  maxOffTeam:()=>S.settings.maxOffTeam,
  schedMonthOf:()=>'2026-08',curSchedMonth:()=>'2026-08',
  periodFor:()=>({label:'T8',from:'2026-07-21',to:'2026-08-20'}),
  daysOfPeriod:()=>[],swapBlockList:()=>[],reqHours:()=>0,poolOfId(id){return ctx.poolOf(ctx.empById(id)||{});},
  asOtLimit:()=>40};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/07-manpower.js','utf8'),ctx,{filename:'07'});
vm.runInContext(fs.readFileSync('js/18-advice.js','utf8'),ctx,{filename:'18'});

/* --- Dựng tổ A: 5 người ca D --- */
const iso='2026-08-10';
['a1','a2','a3','a4','a5','a6'].forEach((id,i)=>S.employees.push({id,name:'Người '+id.toUpperCase(),team:'A',active:true}));
S.employees.push({id:'o1',name:'Vp Một',team:'Office',active:true});
S.employees.forEach(e=>{S.base[e.id]={[iso]:e.team==='Office'?'O':'D'};});
S.base.a6={[iso]:'R'};   // a6 đang nghỉ ca R → có thể huy động cover

const T=[];const ok=(n,c,extra)=>{T.push([c,n,extra||'']);};
const bump=()=>{S.rev++;};

/* KB1: chưa ai nghỉ, quân số dư → nên duyệt */
let a=ctx.leaveAdvice('a1',iso,'AL8','r1',{at:1000});
ok('KB1 chưa ai nghỉ → ok',a.level==='ok',a.level+' | D '+a.before.D+'→'+a.after.D);

/* KB2: a2 đã nghỉ (đơn cũ, duyệt rồi) → a1 xin sau, trần 1 người/ngày → block */
S.over.a2={[iso]:{code:'AL8',reqId:'rOld'}};
S.requests.rOld={id:'rOld',empId:'a2',type:'leave',status:'approved',createdAt:500,
  days:[{iso,code:'AL8'}]};
bump();
a=ctx.leaveAdvice('a1',iso,'AL8','r1',{at:1000});
ok('KB2 có người đăng ký trước → block',a.level==='block',
   a.level+' | earlierTeam='+a.earlierTeam.length);
ok('KB2 nêu đúng tên người đăng ký trước',
   a.reasons.some(r=>/TRƯỚC đơn này/.test(r.txt)&&/A2/.test(r.txt)),
   JSON.stringify(a.reasons.map(r=>r.txt)));

/* KB3: y hệt KB2 nhưng a1 có a6 (ca R, cùng khối) nhận cover ĐÃ XÁC NHẬN
        → không thiếu quân, hạ từ block xuống warn */
a=ctx.leaveAdvice('a1',iso,'AL8','r1',{at:1000,coverId:'a6',coverSt:'confirmed'});
ok('KB3 cover đã xác nhận → hạ block xuống warn',a.level==='warn',a.level);
ok('KB3 covered=true & quân số được bù',a.covered===true&&a.after.D===a.before.D,
   'D '+a.before.D+'→'+a.after.D);
ok('KB3 có lời khen về cover',a.pluses.some(p=>/không hụt người/.test(p)),JSON.stringify(a.pluses));

/* KB4: cover mới chỉ định, CHƯA xác nhận → vẫn block + nhắc chưa xác nhận */
a=ctx.leaveAdvice('a1',iso,'AL8','r1',{at:1000,coverId:'a6',coverSt:'pending'});
ok('KB4 cover chưa xác nhận → vẫn block',a.level==='block',a.level);
ok('KB4 nhắc chưa xác nhận',a.reasons.some(r=>/chưa xác nhận/.test(r.txt)),'');

/* KB5: cover khác khối (o1 văn phòng) → không bù, cảnh báo khác khối */
a=ctx.leaveAdvice('a1',iso,'AL8','r1',{at:1000,coverId:'o1',coverSt:'confirmed'});
ok('KB5 cover khác khối → không bù',a.covered===false,'covered='+a.covered);
ok('KB5 báo khác khối',a.reasons.some(r=>/KHÁC KHỐI/.test(r.txt)),'');

/* KB6: a1 đăng ký TRƯỚC a2 (at=100 < 500) → không bị coi là đến sau */
a=ctx.leaveAdvice('a1',iso,'AL8','r1',{at:100});
ok('KB6 mình đăng ký trước → không tính người kia là "trước"',a.earlierTeam.length===0,
   'earlierTeam='+a.earlierTeam.length+' level='+a.level);

/* KB7: reqAdvice tập trung đúng ngày có người nghỉ trước */
const d2='2026-08-11',d3='2026-08-12';
S.employees.forEach(e=>{S.base[e.id][d2]=e.team==='Office'?'O':'D';S.base[e.id][d3]=e.team==='Office'?'O':'D';});
S.base.a6[d2]='R';S.base.a6[d3]='R';
bump();
const req={id:'r1',empId:'a1',type:'leave',status:'pending',createdAt:1000,
  days:[{iso,code:'AL8'},{iso:d2,code:'AL8'},{iso:d3,code:'AL8'}]};
S.requests.r1=req;bump();
const ra=ctx.reqAdvice(req);
ok('KB7 chỉ tập trung 1/3 ngày có vướng',ra.focusN===1&&ra.allN===3,
   'focus='+ra.focusN+'/'+ra.allN+' hiện '+ra.days.length+' ngày');
ok('KB7 ngày hiện ra đúng là ngày vướng',ra.days.length===1&&ra.days[0].iso===iso,
   ra.days.map(x=>x.iso).join(','));
ok('KB7 có ghi chú giải thích',ra.notes.some(n=>/Đang tập trung vào/.test(n.txt)),
   JSON.stringify(ra.notes.map(n=>n.txt)));

/* KB8: dựng HTML không ném lỗi */
try{const h=ctx.reqAdviceHtml(req);ok('KB8 dựng HTML panel duyệt',h.length>200&&/adv-box/.test(h),h.length+' ký tự');}
catch(e){ok('KB8 dựng HTML panel duyệt',false,e.message);}
try{const h=ctx.advForFormHtml('a1',[{iso,code:'AL8'}],'leave','a6');
    ok('KB9 dựng HTML nhắc người làm đơn',/adv-box emp/.test(h),h.length+' ký tự');}
catch(e){ok('KB9 dựng HTML nhắc người làm đơn',false,e.message);}

let bad=0;
T.forEach(([c,n,x])=>{if(!c)bad++;console.log((c?'  ✅ ':'  ❌ ')+n+(x?'   ['+x+']':''));});
console.log(bad?'\n❌ '+bad+'/'+T.length+' kịch bản KHÔNG đạt':'\n✅ '+T.length+'/'+T.length+' kịch bản đạt');
process.exit(bad?1:0);
