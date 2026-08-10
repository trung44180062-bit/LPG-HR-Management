/* ============================================================
   HARNESS v6.5 — COVER / ĐỔI CA THEO TỪNG NGÀY + QUYỀN MÀN DUYỆT
   Chạy:  node _test/cover-perday-harness.js
   ------------------------------------------------------------
   Hai thay đổi lớn cần chốt bằng test:
     A. Một đơn nghỉ / đổi ca nhiều ngày có thể có NHIỀU người phụ trách,
        mỗi ngày một người. Đơn CŨ (chỉ có r.coverId) phải chạy y như trước.
     B. Màn Duyệt mở cho mọi user: xem hết, in đơn của mình + cùng nhóm,
        tích HR; KHÔNG duyệt / từ chối / huỷ được.
   ============================================================ */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.resolve(__dirname,'..');

const HOURS={O:8,D:12,N:12,R:0,AL8:8,AL4:4,NP:0,COM:0,OTD:12,OTN:12};
const CAT={O:'work',D:'work',N:'work',R:'rest',AL8:'leave',AL4:'leave',
           NP:'leave',COM:'leave',OTD:'ot',OTN:'ot'};

const S={rev:1,employees:[],base:{},over:{},requests:{},notifs:{},
         settings:{minD:1,minN:1,minO:1},del:{}};
let ME='mgr', PERM='admin';

const ctx={console,Date,Math,JSON,Object,Array,String,Number,Set,
  setTimeout,clearTimeout,
  S, localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  meId:()=>ME,
  empById:id=>S.employees.find(e=>e.id===id)||null,
  activeEmps:()=>S.employees.filter(e=>e.active!==false),
  canAppr:()=>PERM==='admin'||PERM==='appr'||PERM==='kmgr',
  codeInfo:c=>({c,l:c,cat:CAT[c]||'other',col:'#eee'}),
  getHours:c=>HOURS[c]||0,
  comboOf:()=>null,
  eff:(id,iso)=>{const o=(S.over[id]||{})[iso];
                 return o?{code:o.code,o}:{code:(S.base[id]||{})[iso]||'',o:null};},
  poolOf:e=>String((e&&e.team)||'').toLowerCase().startsWith('office')?'office':'prod',
  esc:s=>String(s==null?'':s),
  t:s=>s, t2:s=>s, toast(){}, save(){}, confirm:()=>true, alert(){},
  fmtVN:iso=>{const p=String(iso).split('-');return p.length===3?p[2]+'/'+p[1]:iso;},
  fmtVNfull:iso=>iso, fmtDateTime:()=>'', dowOf:()=>'T2',
  shortName:n=>String(n||'').split(' ').slice(-2).join(' '),
  teamShort:x=>x, noAccent:s=>String(s||'').toLowerCase(),
  chip:c=>'['+c+']', codeChip:c=>'['+(c||'')+']', rnd1:n=>Math.round(n*10)/10,
  uid:()=>'x'+(Math.random()*1e9|0),
  newNotif(n){const id=ctx.uid();S.notifs[id]=Object.assign({id,status:'pending',createdAt:Date.now()},n);return S.notifs[id];},
  notifDrop(f){Object.keys(S.notifs).forEach(k=>{if(f(S.notifs[k]))delete S.notifs[k];});},
  otHours:()=>0, isoOf:d=>d.toISOString().slice(0,10),
  REQ_LABEL:{leave:'Nghỉ phép',swap:'Đổi ca',ot:'Tăng ca'},
  REQ_ICON:{}, mgr:true, myFE:false,
  reqIsProvisional:()=>false, reqStatusClass:()=>'', reqStatusLabel:()=>'',
  apprAdviceBadge:()=>'', apprQuickHtml:()=>'', apprChainHtml:()=>'',
  apprWarnLine:()=>'', apprOpen:{}, reqNeedsMyAction:()=>false,
  swapBlockList:()=>[], poolOfId:id=>ctx.poolOf(ctx.empById(id)||{}),
  reqChain:()=>['fe','trung','kmgr'], reqHours:()=>0, reqLeaveDays:r=>(r.days||[]).length,
  schedMonthOf:()=>'2026-08', $:()=>null};
ctx.window=ctx; ctx.globalThis=ctx;
vm.createContext(ctx);

/* Chỉ nạp phần logic của 08-requests.js (bỏ qua các hàm đụng DOM khi gọi) */
vm.runInContext(fs.readFileSync(path.join(ROOT,'js/08-requests.js'),'utf8'),ctx,{filename:'08'});

/* --- dữ liệu --- */
[['e1','Tran Van A','A'],['e2','Le Thi C','A'],['e3','Pham Van D','A'],
 ['e4','Vu Thi F','B'],['mgr','Hoang Trung','A']]
  .forEach(([id,name,team])=>S.employees.push({id,name,team,active:true}));
const D1='2026-08-19', D2='2026-08-20', D3='2026-08-21';
S.employees.forEach(e=>{S.base[e.id]={[D1]:'D',[D2]:'D',[D3]:'D'};});

const R=[]; const ok=(n,c,e)=>R.push([!!c,n,e||'']);
const mkLeave=(id,isos)=>({id,empId:'e1',type:'leave',status:'pending',createdAt:1,
  from:isos[0],to:isos[isos.length-1],days:isos.map(iso=>({iso,code:'AL8'}))});

/* ============================================================
   A1 — ĐƠN CŨ: chỉ có coverId, phải hiểu là gánh MỌI ngày
   ============================================================ */
{
  const r=mkLeave('rOld',[D1,D2,D3]);
  r.coverId='e2'; r.coverSt='confirmed';
  S.requests.rOld=r;
  const m=ctx.reqCoverMap(r);
  ok('A1 đơn cũ: suy ra đủ 3 ngày', Object.keys(m).length===3, JSON.stringify(m));
  ok('A1 đơn cũ: đúng người', m[D2].id==='e2'&&m[D2].st==='confirmed');
  ok('A1 đơn cũ: gộp thành 1 nhóm', ctx.reqCoverGroups(r).length===1);
  ok('A1 đơn cũ: tên hiển thị như cũ', ctx.reqCoverName(r)==='Thi C', ctx.reqCoverName(r));
}

/* ============================================================
   A2 — ĐẶT NGƯỜI KHÁC NHAU CHO TỪNG NGÀY
   ============================================================ */
{
  const r=mkLeave('r1',[D1,D2,D3]); S.requests.r1=r;
  ctx.reqSetCover('r1','e2','mgr');            // mọi ngày → e2
  ok('A2 đặt mọi ngày: 1 người / 3 ngày',
     ctx.reqCoverGroups(r).length===1&&ctx.reqCoverGroups(r)[0].isos.length===3);

  ctx.reqSetCover('r1','e3','mgr',D2);         // riêng ngày giữa → e3
  const gs=ctx.reqCoverGroups(r);
  ok('A2 đổi riêng 1 ngày → 2 người', gs.length===2, JSON.stringify(gs));
  ok('A2 e2 còn 2 ngày', gs.find(g=>g.id==='e2').isos.length===2);
  ok('A2 e3 đúng 1 ngày D2',
     gs.find(g=>g.id==='e3').isos.join()===D2, JSON.stringify(gs));
  ok('A2 tóm tắt coverId vẫn có giá trị', !!r.coverId, r.coverId);
  ok('A2 tóm tắt coverSt = pending', r.coverSt==='pending', r.coverSt);
}

/* ============================================================
   A3 — NGƯỜI CÒN NGÀY KHÁC THÌ KHÔNG BỊ BÁO "ĐÃ GỠ"
   ============================================================ */
{
  S.notifs={};
  const r=mkLeave('r2',[D1,D2,D3]); S.requests.r2=r;
  ctx.reqSetCover('r2','e2','mgr');
  S.notifs={};
  ctx.reqSetCover('r2','e3','mgr',D2);         // e2 vẫn còn D1, D3
  const removed=Object.values(S.notifs).filter(n=>n.zk==='coverRemoved');
  ok('A3 e2 còn ngày khác → KHÔNG báo đã gỡ', removed.length===0,
     JSON.stringify(removed.map(n=>n.to)));
  S.notifs={};
  ctx.reqSetCover('r2','e3','mgr',D1);
  ctx.reqSetCover('r2','e3','mgr',D3);         // e2 hết sạch ngày
  const rm2=Object.values(S.notifs).filter(n=>n.zk==='coverRemoved');
  ok('A3 e2 hết ngày → CÓ báo đã gỡ', rm2.some(n=>n.to==='e2'),
     JSON.stringify(rm2.map(n=>n.to)));
}

/* ============================================================
   A4 — MỖI NGƯỜI ĐÚNG MỘT VIỆC-CHỜ-XÁC-NHẬN, nz:1 (0 tin Zalo)
   ============================================================ */
{
  S.notifs={};
  const r=mkLeave('r3',[D1,D2,D3]); S.requests.r3=r;
  ctx.reqSetCover('r3','e2','mgr');
  ctx.reqSetCover('r3','e3','mgr',D3);
  const cc=Object.values(S.notifs).filter(n=>n.kind==='coverConfirm');
  ok('A4 mỗi người 1 việc chờ, không phải mỗi ngày',
     new Set(cc.map(n=>n.to)).size===cc.length, JSON.stringify(cc.map(n=>n.to)));
  ok('A4 mọi lời mời cover đều nz:1 (không tốn tin Zalo)',
     cc.length>0&&cc.every(n=>n.nz===1), JSON.stringify(cc.map(n=>n.nz)));
}

/* ============================================================
   A5 — ĐỒNG Ý / TỪ CHỐI chỉ đổi trạng thái của CHÍNH MÌNH
   ============================================================ */
{
  const r=mkLeave('r4',[D1,D2,D3]); S.requests.r4=r;
  ctx.reqSetCover('r4','e2','mgr');
  ctx.reqSetCover('r4','e3','mgr',D3);
  ctx.reqPartySetSt(r,'cover','e2','confirmed');
  const gs=ctx.reqCoverGroups(r);
  ok('A5 e2 confirmed', gs.find(g=>g.id==='e2').st==='confirmed');
  ok('A5 e3 vẫn pending', gs.find(g=>g.id==='e3').st==='pending');
  ok('A5 trạng thái gộp của đơn = pending', ctx.reqPartySt(r,'cover')==='pending');
  ctx.reqPartySetSt(r,'cover','e3','declined');
  ok('A5 một người từ chối → gộp = declined', ctx.reqPartySt(r,'cover')==='declined');
  ctx.reqPartySetSt(r,'cover','e3','confirmed');
  ok('A5 cả hai đồng ý → gộp = confirmed', ctx.reqPartySt(r,'cover')==='confirmed');
}

/* ============================================================
   A6 — ĐỔI CA: mỗi ngày một đối tác, ghi lịch đúng người
   ============================================================ */
{
  const r={id:'sw1',empId:'e1',type:'swap',status:'pending',createdAt:1,
    from:D1,to:D2,days:[{iso:D1},{iso:D2}]};
  S.requests.sw1=r;
  ctx.reqPartyWrite(r,'with',{[D1]:{id:'e2',st:'pending'},[D2]:{id:'e3',st:'pending'}});
  ok('A6 hai đối tác khác nhau', ctx.reqWithIds(r).join()==='e2,e3', ctx.reqWithIds(r).join());

  S.base.e1={[D1]:'D',[D2]:'D'};
  S.base.e2={[D1]:'N',[D2]:'N'};
  S.base.e3={[D1]:'R',[D2]:'R'};
  S.over={};
  ctx.writeReqToSchedule(r,false);
  ok('A6 ngày 1 đổi với e2 (D↔N)',
     S.over.e1[D1].code==='N'&&S.over.e2[D1].code==='D',
     JSON.stringify({e1:S.over.e1[D1],e2:S.over.e2[D1]}));
  ok('A6 ngày 2 đổi với e3 (D↔R)',
     S.over.e1[D2].code==='R'&&S.over.e3[D2].code==='D',
     JSON.stringify({e1:S.over.e1[D2],e3:S.over.e3&&S.over.e3[D2]}));
  ok('A6 e2 KHÔNG bị đụng vào ngày 2', !(S.over.e2&&S.over.e2[D2]),
     JSON.stringify(S.over.e2));
}

/* ============================================================
   A7 — MỌI BÊN LIÊN QUAN đều được tính (để gửi thông báo)
   ============================================================ */
{
  const r=mkLeave('r5',[D1,D2]); S.requests.r5=r;
  ctx.reqSetCover('r5','e2','mgr');
  ctx.reqSetCover('r5','e3','mgr',D2);
  const ids=ctx.apprPartyIds(r);
  ok('A7 gồm cả hai người cover',
     ids.indexOf('e2')>=0&&ids.indexOf('e3')>=0, ids.join());
}

/* ============================================================
   A8 — ĐƠN 1 NGÀY: hành vi y hệt bản cũ, không đẻ thêm gì
   ============================================================ */
{
  const r=mkLeave('r6',[D1]); S.requests.r6=r;
  ctx.reqSetCover('r6','e2','mgr');
  ok('A8 một ngày: đúng 1 nhóm', ctx.reqCoverGroups(r).length===1);
  ok('A8 một ngày: coverId như cũ', r.coverId==='e2'&&r.coverSt==='pending');
  ctx.reqSetCover('r6','','mgr');
  ok('A8 gỡ hẳn: sạch mọi trường',
     !r.coverId&&!r.coverSt&&!r.covers, JSON.stringify({c:r.coverId,m:r.covers}));
}

/* ============================================================
   B — QUYỀN MÀN DUYỆT
   ============================================================ */
{
  const setPerm=p=>{PERM=p;ctx.mgr=(p==='admin'||p==='appr'||p==='kmgr');};
  setPerm('admin'); ME='mgr';
  ok('B1 quản trị: thao tác được', ctx.apprCanAct()===true);

  setPerm('staff'); ME='e1';
  ok('B2 nhân viên: KHÔNG thao tác được', ctx.apprCanAct()===false);

  const mine=mkLeave('p1',[D1]); mine.empId='e1'; S.requests.p1=mine;
  const sameTeam=mkLeave('p2',[D1]); sameTeam.empId='e3'; S.requests.p2=sameTeam;   // e3 nhóm A
  const other=mkLeave('p3',[D1]);   other.empId='e4';    S.requests.p3=other;       // e4 nhóm B

  ok('B3 in được đơn của chính mình', ctx.canPrintReq(mine,'e1')===true);
  ok('B4 in được đơn người CÙNG nhóm', ctx.canPrintReq(sameTeam,'e1')===true);
  ok('B5 KHÔNG in được đơn nhóm khác', ctx.canPrintReq(other,'e1')===false);

  setPerm('admin');
  ok('B6 người duyệt in được mọi đơn', ctx.canPrintReq(other,'mgr')===true);

  setPerm('staff'); ME='e1';
  ok('B7 nhân viên vẫn tích được HR', ctx.canSetHr()===true);
  ok('B8 nhân viên KHÔNG đổi được người cover',
     ctx.canSetCover(S.requests.p2,'e1')===false);
  ok('B9 nhân viên vẫn đổi được cover ĐƠN CỦA MÌNH',
     ctx.canSetCover(S.requests.p1,'e1')===true);
  ok('B10 nhân viên huỷ được đơn của mình',
     ctx.canCancelReq(S.requests.p1,'e1')===true);
  ok('B11 nhân viên KHÔNG huỷ được đơn người khác',
     ctx.canCancelReq(S.requests.p2,'e1')===false);
}

let bad=0;
R.forEach(([p,n,e])=>{if(!p)bad++;console.log((p?'  ok  ':'  HỎNG')+'  '+n+(e&&!p?'\n         → '+e:''));});
console.log('\n'+R.length+' phép thử · '+(R.length-bad)+' đạt · '+bad+' hỏng');
process.exit(bad?1:0);
