/* ============================================================
   HARNESS KHUÔN TIN ZALO v6.4 — "3 dòng"
   Chạy:  node _test/zalo-format-harness.js
   ------------------------------------------------------------
   Ba luật phải giữ:
     1. Mọi tin liên quan lịch in được CA CHUẨN → CA MỚI
     2. KHÔNG mã nội bộ nào lọt ra Zalo: SD/SN/SO/O+N/D+N/OTD/OTN/OTL/OT2/OT3
     3. Tin ngắn — thân tin ≤ 6 dòng cho tin đơn lẻ, và bằng TIẾNG ANH
   ============================================================ */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.resolve(__dirname,'..');

const HOURS={O:8,D:12,N:12,R:0,AL8:8,AL4:4,NP:0,COM:0,SD:12,SN:12,SO:8,
             OTD:12,OTN:12,OTL:1,OT2:2,OT3:3,'O+N':20,'D+N':24};
const CAT={O:'work',D:'work',N:'work',R:'rest',SD:'swap',SN:'swap',SO:'swap',
  AL8:'leave',AL4:'leave',NP:'leave',COM:'leave',OFF:'leave',
  OTD:'ot',OTN:'ot',OTL:'ot',OT2:'ot',OT3:'ot','O+N':'combo','D+N':'combo'};
const COMBO={'O+N':{work:'O',ot:'OTN'},'D+N':{work:'D',ot:'OTN'}};

const S={rev:1,employees:[],base:{},over:{},requests:{},notifs:{},settings:{},del:{}};
const ctx={console,Date,Math,JSON,Object,Array,String,Number,Set,setTimeout,clearTimeout,
  S, localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  empById:id=>S.employees.find(e=>e.id===id)||null,
  meId:()=>'mgr', uid:()=>'n'+(Math.random()*1e9|0),
  codeInfo:c=>({c,l:c,cat:CAT[c]||'other',col:'#eee'}),
  getHours:c=>HOURS[c]||0,
  comboOf:c=>COMBO[c]||null,
  isCombo:c=>!!COMBO[c],
  eff:(id,iso)=>{const o=(S.over[id]||{})[iso];
                 return o?{code:o.code,o}:{code:(S.base[id]||{})[iso]||'',o:null};},
  reqDays:r=>r.days||[],
  reqDayHours:d=>d.hours||0,
  reqHours:r=>(r.days||[]).reduce((a,d)=>a+(d.hours||0),0),
  reqLeaveDays:r=>(r.days||[]).length,
  reqChain:r=>r.chain||['fe','trung','kmgr'],
  reqNextLevel:r=>r.next||'fe',
  krMgrName:()=>'Mr. Kim', kmgrDelegate:()=>null,
  wtReasonLabel:()=>'', ROOT_ADMIN:'mgr',
  fbRef:null, save(){}, refreshBadge(){}, toast(){}, t:s=>s,
  renderAll(){}, $:()=>null};
ctx.window=ctx; ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'js/21-notify.js'),'utf8'),ctx,{filename:'21'});

/* --- dữ liệu --- */
[['e1','Tran Van A','A'],['e2','Le Thi C','B'],['e3','Pham Van D','A'],
 ['mgr','Hoang Trung','A']].forEach(([id,name,team])=>
  S.employees.push({id,name,team,active:true}));
const ISO='2026-08-19';
S.employees.forEach(e=>{S.base[e.id]={[ISO]:'D'};});
S.base.e3={[ISO]:'O'};

const R=[]; const ok=(n,c,e)=>R.push([!!c,n,e||'']);
const body=(n,zk)=>ctx.zaloLines(n,zk);
const txt =(n,zk)=>body(n,zk).join('\n');

/* Mã nội bộ tuyệt đối không được xuất hiện */
const FORBID=/\b(SD|SN|SO|OTD|OTN|OTL|OT2|OT3)\b|O\+N|D\+N/;
function clean(name,s){
  ok(name+': không lọt mã nội bộ', !FORBID.test(s), JSON.stringify(s));
}
function short(name,s,max){
  const n=s.split('\n').length;
  ok(name+': ngắn (≤'+max+' dòng)', n<=max, n+' dòng — '+JSON.stringify(s));
}

/* ============================================================
   1. ĐỔI CA — phải thấy CA CHUẨN → CA MỚI
   ============================================================ */
{
  const n={to:'e1',from:'mgr',iso:ISO,std:'D',oldCode:'D',newCode:'N'};
  const s=txt(n,'schedChange');
  ok('đổi ca: có ca chuẩn → ca mới', /D → N/.test(s), s);
  ok('đổi ca: có ngày và tên', /19\/08/.test(s)&&/Tran Van A/.test(s), s);
  clean('đổi ca', s); short('đổi ca', s, 3);
}
/* 1b. Đổi CHỒNG lên thay đổi cũ → phải nói rõ ca đang có là gì */
{
  const n={to:'e1',from:'mgr',iso:ISO,std:'D',oldCode:'N',newCode:'O'};
  const s=txt(n,'schedChange');
  ok('đổi chồng: nêu cả ca chuẩn lẫn ca đang có', /D → O/.test(s)&&/was N/.test(s), s);
  short('đổi chồng', s, 3);
}
/* 1c. Mã đổi ca nội bộ SD phải ra "D", không được in "SD" */
{
  const n={to:'e1',from:'mgr',iso:ISO,std:'N',oldCode:'N',newCode:'SD'};
  const s=txt(n,'schedChange');
  ok('mã SD quy về D', /N → D/.test(s), s);
  clean('mã SD', s);
}
/* 1d. Về lại ca chuẩn → "back to" */
{
  const n={to:'e1',from:'mgr',iso:ISO,std:'D',oldCode:'N',newCode:'D'};
  ok('về ca chuẩn: dùng "back to"', /back to D/.test(txt(n,'schedChange')), txt(n,'schedChange'));
}
/* 1e. Ô trống KHÔNG được in là "OFF" (OFF là mã có thật) */
{
  const n={to:'e1',from:'mgr',iso:ISO,std:'',oldCode:'',newCode:'N'};
  const s=txt(n,'schedChange');
  ok('ô trống in "—", không in "OFF"', /—/.test(s)&&!/\bOFF\b/.test(s), s);
}

/* ============================================================
   2. ĐƠN TĂNG CA — giữ ca chuẩn, in giờ OT
   ============================================================ */
{
  S.requests.r1={id:'r1',empId:'e3',type:'ot',status:'pending',createdAt:1,
    days:[{iso:ISO,code:'OTN',timeIn:'17:00',timeOut:'21:00',hours:4}],
    coverId:'e2',coverSt:'pending',note:'Ship arrival',
    appr:{fe:{by:'mgr'}},chain:['fe','trung','kmgr']};
  const n={to:'mgr',from:'e3',reqId:'r1',lvl:'trung'};
  const s=txt(n,'apprNeed');
  ok('đơn OT: giữ ca chuẩn O', /O → O \+ OT 17:00–21:00 \(4h\)/.test(s), s);
  ok('đơn OT: nêu người cover + trạng thái', /Cover: Le Thi C ⏳/.test(s), s);
  ok('đơn OT: có ghi chú', /Ship arrival/.test(s), s);
  ok('đơn OT: chuỗi cấp rút gọn', /passed FE/.test(s), s);
  clean('đơn OT', s); short('đơn OT', s, 5);
  ok('đơn OT: tiêu đề nêu cấp đang chờ',
     /Section Chief/.test(ctx.zaloTitle(n,'apprNeed')), ctx.zaloTitle(n,'apprNeed'));
}
/* 2b. Ca chuẩn là NGHỈ (R) → không bịa ra ca, chỉ có phần OT */
{
  S.base.e2={[ISO]:'R'};
  S.requests.r2={id:'r2',empId:'e2',type:'ot',status:'pending',createdAt:1,
    days:[{iso:ISO,code:'OTN',timeIn:'20:00',timeOut:'08:00',hours:8,isoEnd:'2026-08-20'}]};
  const s=txt({to:'mgr',from:'e2',reqId:'r2',lvl:'fe'},'apprNeed');
  ok('OT ngày nghỉ: không ghép "R + OT"', !/R \+ OT/.test(s), s);
  ok('OT ngày nghỉ: có dấu qua đêm', /\+1d/.test(s), s);
  clean('OT ngày nghỉ', s);
}

/* ============================================================
   3. ĐƠN NGHỈ PHÉP — ca chuẩn → loại phép
   ============================================================ */
{
  S.requests.r3={id:'r3',empId:'e1',type:'leave',status:'pending',createdAt:1,
    days:[{iso:ISO,code:'AL8'}]};
  const s=txt({to:'mgr',from:'e1',reqId:'r3',lvl:'fe'},'apprNeed');
  ok('nghỉ phép: D → AL (full day)', /D → AL \(full day\)/.test(s), s);
  clean('nghỉ phép', s); short('nghỉ phép', s, 3);
}

/* ============================================================
   4. KẾT QUẢ DUYỆT
   ============================================================ */
{
  S.requests.r1.status='approved'; S.requests.r1.decidedBy='mgr';
  const s=txt({to:'e3',from:'mgr',reqId:'r1'},'approved');
  ok('đã duyệt: có ca chuẩn → ca mới', /O → O \+ OT/.test(s), s);
  ok('đã duyệt: nói lịch đã cập nhật', /schedule updated/i.test(s), s);
  ok('đã duyệt: KHÔNG còn chuỗi "Already approved by"', !/Already approved/.test(s), s);
  clean('đã duyệt', s); short('đã duyệt', s, 5);
}
{
  S.requests.r3.reason='Over the monthly OT cap';
  const s=txt({to:'e1',from:'mgr',reqId:'r3'},'rejected');
  ok('từ chối: có lý do', /Over the monthly OT cap/.test(s), s);
  ok('từ chối: có người từ chối', /Rejected by Hoang Trung/.test(s), s);
  short('từ chối', s, 4);
}

/* ============================================================
   5. SỬA LỊCH HÀNG LOẠT — mỗi thay đổi một dòng, thẳng cột
   ============================================================ */
{
  const hold=[{to:'e1',iso:ISO,std:'D',was:'D',now:'N'},
              {to:'e1',iso:'2026-08-20',std:'R',was:'R',now:'D'},
              {to:'e2',iso:ISO,std:'N',was:'N',now:'SO'}];
  const n={to:'mgr',from:'mgr',hold};
  const s=txt(n,'schedBulk');
  ok('sửa hàng loạt: 3 dòng dữ liệu', s.split('\n').filter(l=>/→/.test(l)).length===3, s);
  ok('sửa hàng loạt: mã SO quy về O', /N → O/.test(s), s);
  clean('sửa hàng loạt', s);
  ok('sửa hàng loạt: tiêu đề nêu số người và số ô',
     /2 people \/ 3 changes/.test(ctx.zaloTitle(n,'schedBulk')), ctx.zaloTitle(n,'schedBulk'));
}

/* ============================================================
   6. PHẢN HỒI HAI CHIỀU
   ============================================================ */
{
  const s=txt({to:'e1',from:'e2',iso:ISO,oldCode:'D'},'swapNo');
  ok('đổi ca bị từ chối: nói ca giữ nguyên', /you stay D/.test(s), s);
  short('đổi ca bị từ chối', s, 2);
}
{
  const s=txt({to:'e3',from:'mgr',iso:ISO},'coverRemoved');
  ok('gỡ cover: nhắc lại ca chuẩn', /your shift O/.test(s), s);
  short('gỡ cover', s, 2);
}
{
  const s=txt({to:'e1',from:'mgr',iso:ISO,std:'D',oldCode:'N'},'schedRevoke');
  ok('thu hồi đổi lịch: về ca chuẩn', /back to D/.test(s), s);
  short('thu hồi đổi lịch', s, 3);
}

/* ============================================================
   7. LƯỚI AN TOÀN — đơn hỏng thì vẫn phải có tin
   ============================================================ */
{
  S.requests.rX={id:'rX',empId:'e1',type:'leave',status:'pending'};  // thiếu days
  const s=txt({to:'mgr',from:'e1',reqId:'rX',lvl:'fe',text:'📥 Đơn chờ duyệt'},'apprNeed');
  ok('đơn hỏng: KHÔNG nuốt tin', s.trim().length>0, JSON.stringify(s));
}
{
  const s=txt({to:'e1',from:'mgr'},'kindLa');
  ok('loại tin lạ: vẫn ra được một dòng', s.trim().length>0, JSON.stringify(s));
}

/* ============================================================
   8. TIẾNG ANH — không lọt tiếng Việt có dấu vào tin
   ============================================================ */
{
  const all=[
    txt({to:'e1',from:'mgr',iso:ISO,std:'D',oldCode:'D',newCode:'N'},'schedChange'),
    txt({to:'mgr',from:'e3',reqId:'r1',lvl:'trung'},'apprNeed'),
    txt({to:'e1',from:'e2',iso:ISO,oldCode:'D'},'swapNo')
  ].join('\n');
  /* tên người là dữ liệu, ở đây tên đã bỏ dấu nên bắt được chữ Việt lọt vào */
  ok('tin bằng tiếng Anh', !/[àáảãạăâđêôơưèéẹìíòóùúỳý]/i.test(all), all);
}

let bad=0;
R.forEach(([p,n,e])=>{if(!p)bad++;console.log((p?'  ok  ':'  HỎNG')+'  '+n+(e&&!p?'\n         → '+String(e).replace(/\n/g,'\n           '):''));});
console.log('\n'+R.length+' phép thử · '+(R.length-bad)+' đạt · '+bad+' hỏng');
process.exit(bad?1:0);
