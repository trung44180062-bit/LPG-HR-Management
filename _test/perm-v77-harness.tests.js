var P=0,F=0;
function say(s){__OUT.push(s);}
function ok(c,l){if(c){P++;say('  ✔ '+l);}else{F++;say('  ✘ '+l);}}
function mk(id,name,perm,pos,team){return {id:id,name:name,perm:perm,pos:pos||'Operator',
  role:'oper',team:team||'A',empType:'shift',shiftType:'type1',
  a1:'2026-07-21',a2:'2026-07-29',active:true,order:1};}
function setup(){
  S.employees=[mk('vc44180062','Nguyễn Hoàng Trung','admin','Field Engineer','A'),
               mk('vc44260001','Trần Thị Thư','sec','Phiên dịch kiêm thư ký','Office'),
               mk('vc44260002','Lê Văn Nhân','staff','Operator','A'),
               mk('vc44260003','Phạm Văn Duyệt','appr','DCS Boardman','B')];
  S.employees[1].shiftType='none';
  S.base={};S.over={};S.requests={};S.accounts={};S.notifs={};
  __T.length=0;
}
function login(id){_me=id;return applyPerm();}
var EXP={admin:{adm:1,mgr:1,hrm:1,secr:1,noSelf:0},
         sec  :{adm:0,mgr:0,hrm:1,secr:1,noSelf:1},
         staff:{adm:0,mgr:0,hrm:0,secr:0,noSelf:0},
         appr :{adm:0,mgr:1,hrm:0,secr:1,noSelf:0}};
function flags(){return {adm:adm,mgr:mgr,hrm:hrm,secr:secr,noSelf:noSelf};}

say('\n=== 1. CỜ QUYỀN THEO TỪNG VAI ===');
setup();
[['vc44180062','admin'],['vc44260001','sec'],['vc44260002','staff'],['vc44260003','appr']]
 .forEach(function(r){
  var got=login(r[0]),e=EXP[r[1]],f=flags(),bad=[];
  ok(got===r[1],'permOf → '+got);
  ['adm','mgr','hrm','secr','noSelf'].forEach(function(k){if(!!f[k]!==!!e[k])bad.push(k);});
  ok(!bad.length,'  '+r[1]+': adm='+(+f.adm)+' mgr='+(+f.mgr)+' hrm='+(+f.hrm)
     +' secr='+(+f.secr)+' noSelf='+(+f.noSelf)+(bad.length?' SAI: '+bad:''));
  ok(canEditSched()===!!(e.mgr||e.hrm),'  '+r[1]+': canEditSched='+canEditSched());
  ok(canAppr()===!!e.mgr,'  '+r[1]+': canAppr='+canAppr()+' (duyệt đơn)');
});

say('\n=== 2. THƯ KÝ LÀM ĐƯỢC VIỆC NHÂN LỰC ===');
setup();login('vc44260001');
var n0=S.employees.length;
prompt=function(){return 'E';};
addGroup();
ok(S.employees.length===n0+4,'thêm nhóm mới (2 kỹ sư + 2 oper): '+n0+' → '+S.employees.length);
addMember('A');
ok(S.employees.length===n0+5,'thêm người lẻ');
updEmp('vc44260002','name','Lê Văn Nhân B');
ok(empById('vc44260002').name==='Lê Văn Nhân B','sửa họ tên');
updType('vc44260002','type2');
ok(empById('vc44260002').shiftType==='type2','đổi kiểu ca');
delEmp('vc44260002');
ok(!empById('vc44260002'),'xoá người');
delGroup('E');
ok(!S.employees.some(function(e){return e.team==='E';}),'xoá nhóm');
document.getElementById('setFrom').value='2026-07-21';
document.getElementById('setTo').value='2026-08-20';
fillSchedule();
var cells=0;for(var k in S.base)for(var i in S.base[k])cells++;
ok(cells>0,'điền lịch tự động cả kỳ 21/07→20/08: '+cells+' ô ca');
clearSchedRange();
var c2=0;for(var k2 in S.base)for(var i2 in S.base[k2])c2++;
ok(c2===0,'xoá lịch theo khoảng');
ok(!__T.some(function(m){return /Cần quyền/.test(m);}),'không lần nào bị chặn vì thiếu quyền');

say('\n=== 3. NHÂN VIÊN THƯỜNG VẪN BỊ CHẶN ===');
setup();login('vc44260002');
var m0=S.employees.length;
addMember('A');delEmp('vc44260003');addGroup();fillSchedule();
ok(S.employees.length===m0,'không thêm được người/nhóm');
ok(!!empById('vc44260003'),'không xoá được người');
var c3=0;for(var k3 in S.base)for(var i3 in S.base[k3])c3++;
ok(c3===0,'không điền được lịch');
ok(__T.filter(function(m){return /Cần quyền quản trị hoặc thư ký/.test(m);}).length>=4,
   'mỗi lần đều báo "Cần quyền quản trị hoặc thư ký" ('+__T.length+' lời nhắc)');

say('\n=== 4. MẬT KHẨU & PHÂN QUYỀN VẪN CHỈ QUẢN TRỊ ===');
setup();login('vc44260001');
updPerm('vc44260002','admin');
ok(empById('vc44260002').perm==='staff','thư ký KHÔNG đổi được quyền của ai');
resetToDefaultPw('vc44260003');
ok(!S.accounts['vc44260003'],'thư ký KHÔNG đặt lại được mật khẩu');
var before=S.employees.length;addAccountRow();
ok(S.employees.length===before,'thư ký KHÔNG thêm được người từ bảng Tài khoản');
ok(__T.filter(function(m){return m==='Cần quyền quản trị';}).length>=3,
   'cả 3 việc bảo mật đều báo "Cần quyền quản trị"');
login('vc44180062');
updPerm('vc44260002','sec');
ok(empById('vc44260002').perm==='sec','quản trị vẫn đổi được quyền');

say('\n=== 5. BẢNG TÀI KHOẢN: THƯ KÝ CHỈ ĐỌC ===');
setup();
var tb=document.getElementById('accTbl');
login('vc44180062');renderAccTbl();var hAdm=tb.innerHTML;
login('vc44260001');renderAccTbl();var hSec=tb.innerHTML;
login('vc44260002');renderAccTbl();var hStaff=tb.innerHTML;
ok(/<select/.test(hAdm)&&/setPass/.test(hAdm),'quản trị: có ô chọn quyền + nút mật khẩu');
ok(!/<select/.test(hSec)&&!/<input/.test(hSec),'thư ký: không một ô nhập / ô chọn nào');
ok(!/setPass|resetToDefaultPw|delEmp|changeId|updPerm/.test(hSec),
   'thư ký: không nút sửa / xoá / mật khẩu nào');
ok(/Trần Thị Thư/.test(hSec)&&/Thư ký/.test(hSec),'thư ký: vẫn đọc được tên + quyền của mọi người');
ok(/Mặc định/.test(hSec),'thư ký: vẫn thấy trạng thái mật khẩu (Mặc định / Đã đặt riêng)');
ok(/Cần quyền quản trị/.test(hStaff),'nhân viên thường: không thấy bảng');

say('\n=== 6. GIAO DIỆN HOME CỦA THƯ KÝ = QUẢN LÝ NGƯỜI HÀN ===');
setup();
/* KHÔNG dùng vc44180062: đó là ROOT_ADMIN, permOf() luôn trả 'admin'. */
S.employees[3].perm='kmgr';
login('vc44260003');var kHome=homeView(),kNoSelf=noSelf,kSecr=secr,kHrm=hrm;
login('vc44260001');var sHome=homeView(),sNoSelf=noSelf,sSecr=secr,sHrm=hrm;
ok(kHome===sHome,'cùng màn đầu tiên: '+sHome);
ok(kNoSelf===true&&sNoSelf===true,'cả hai đều noSelf → dùng noSelfHomeHtml() (bảng tin điều hành)');
ok(kSecr===sSecr&&kHrm===sHrm,'cùng mức xem báo cáo + quản lý nhân lực (secr/hrm)');
ok(kHome==='me'&&sHome==='me','vào app là thấy bảng tin điều hành, không phải lịch cá nhân');

say('\n=== KẾT QUẢ: '+P+' đạt / '+F+' trượt ===');
__FAIL=F;
