var P=0,F=0;
function say(s){__OUT.push(s);}
function ok(c,l){if(c){P++;say('  ✔ '+l);}else{F++;say('  ✘ '+l);}}
function mk(id,name,perm,pos,team){return {id:id,name:name,perm:perm,pos:pos||'Operator',
  role:'oper',team:team||'A',empType:'shift',shiftType:'type1',
  a1:'2026-07-21',a2:'2026-07-29',active:true,order:1};}
S.employees=[mk('vc44180062','Nguyễn Hoàng Trung','admin','Field Engineer','A'),
             mk('vc44260001','Trần Thị Thư','sec','Phiên dịch kiêm thư ký','Office'),
             mk('vc44260002','Lê Văn Nhân','staff','Operator','A'),
             mk('vc44260003','Phạm Văn Duyệt','appr','DCS Boardman','B')];
S.employees[1].shiftType='none';
S.base={};S.over={};S.accounts={};S.notifs={};
S.base['vc44260002']={'2026-08-11':'D'};
S.requests={r1:{id:'r1',type:'leave',status:'pending',empId:'vc44260002',byId:'vc44260002',
  from:'2026-08-11',to:'2026-08-11',days:[{iso:'2026-08-11',code:'AL8'}],createdAt:1}};
function login(id){_me=id;return applyPerm();}

say('\n=== A. SỬA Ô LỊCH THỰC TẾ ===');
[['vc44260001','thư ký'],['vc44180062','quản trị'],['vc44260003','duyệt đơn'],['vc44260002','nhân viên']]
.forEach(function(r){
  login(r[0]);curCell=null;__T.length=0;
  openCell('vc44260002','2026-08-11');
  var opened=!!curCell;
  var expect=(r[1]!=='nhân viên');
  ok(opened===expect,r[1]+': mở được hộp sửa ca = '+opened+(expect?'':' (đúng: bị chặn)'));
});
login('vc44260001');curCell={empId:'vc44260002',iso:'2026-08-11'};
setCell('OTD');
ok(S.over['vc44260002']&&S.over['vc44260002']['2026-08-11'].code==='OTD',
   'thư ký ghi được ô lịch thực tế (OTD) — người sửa: '+S.over['vc44260002']['2026-08-11'].by);

say('\n=== B. THANH SUB-TAB MÀN DUYỆT ===');
var box=document.getElementById('apprTabs');
function tabsOf(id){login(id);apprTab='list';renderApprTabs();
  return (box.innerHTML.match(/class="aptab[^-]/g)||[]).length;}   // bỏ .aptab-off (ghi chú)
/* Tổng quan & Biểu đồ đang tắt bằng APPR_TABS_OFF → còn 3 sub-tab đang bật */
var nAdm=tabsOf('vc44180062'), nSec=tabsOf('vc44260001'), nApr=tabsOf('vc44260003');
ok(nAdm===3,'quản trị: '+nAdm+' sub-tab đang bật');
ok(nSec===nAdm,'thư ký: '+nSec+' sub-tab — GIỐNG quản trị');
ok(nApr===nAdm,'duyệt đơn: '+nApr+' sub-tab — giống quản trị');
ok(tabsOf('vc44260002')===1,'nhân viên thường: chỉ 1 sub-tab Danh sách');

say('\n=== C. THƯ KÝ KHÔNG DUYỆT ĐƠN ===');
login('vc44260001');
ok(apprCanAct()===false,'apprCanAct() = false → không dựng nút ✓ / ✕ trên dòng đơn');
__T.length=0;
var st0=S.requests.r1.status;
decide('r1',true);
ok(S.requests.r1.status===st0,'gọi thẳng decide() cũng không đổi được trạng thái đơn ('+S.requests.r1.status+')');

say('\n=== D. IN ĐƠN CỦA NHÓM KHÁC ===');
var r1=S.requests.r1;
login('vc44260001');var pSec=canPrintReq(r1,'vc44260001');
login('vc44260002');var pOwn=canPrintReq(r1,'vc44260002');
login('vc44260003');var pOther=canPrintReq(r1,'vc44260003');
ok(pSec===true,'thư ký in được đơn của nhóm A (dù mình ở nhóm Office)');
ok(pOwn===true,'nhân viên in được đơn của chính mình');
ok(pOther===true,'người duyệt in được mọi đơn');

say('\n=== KẾT QUẢ: '+P+' đạt / '+F+' trượt ===');
__FAIL=F;
