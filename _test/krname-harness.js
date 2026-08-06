/* Kiểm tra xưng hô "Mr. " của Quản lý người Hàn (perm 'kmgr')
   — accessor tên hiển thị ở js/01-core.js, shortName ở js/13-portal.js,
     otNorm ở js/15-report.js. Chạy: node _test/krname-harness.js  */
const fs=require('fs'),vm=require('vm');

/* Bóc riêng khối helper trong 01-core.js (từ KR_TITLE tới ROLE_ORD) + 2 hàm
   phụ thuộc, để harness không phải dựng cả app. */
const core=fs.readFileSync('js/01-core.js','utf8');
const helper=core.slice(core.indexOf('const KR_TITLE'),core.indexOf('const ROLE_ORD'));
const portal=fs.readFileSync('js/13-portal.js','utf8');
const shortSrc=portal.slice(portal.indexOf('function shortName'),
                            portal.indexOf('function shortName')+400).split('\n}')[0]+'\n}';
const rep=fs.readFileSync('js/15-report.js','utf8');
const otSrc=rep.match(/function otNorm[^\n]*\n/)[0];

let S={employees:[
  {id:'K1',name:'Kim Jong Su',   team:'Office',perm:'kmgr'},
  {id:'K2',name:'Mr. Park Chan Ho',team:'Office',perm:'kmgr'},   // dữ liệu cũ đã có tiền tố
  {id:'V1',name:'Nguyễn Hoàng Trung',team:'Office',perm:'admin'},
  {id:'V2',name:'Phan Quỳnh Vân',team:'A',perm:'staff'},
  {id:'K3',name:'Lee Dong Hyun',team:'Office',perm:'kmgr',active:false}
]};
const PERM_VALUES=['staff','sec','appr','admin','kmgr'];
const ctx={S,console,Object,String,Number,Array,JSON,Math,Set,Date,
  PERM_VALUES,
  empById:id=>S.employees.find(e=>e.id===id)||null,
  permOf:id=>{const e=S.employees.find(x=>x.id===id);const p=e&&e.perm;
              return PERM_VALUES.includes(p)?p:'staff';},
  noAccent:s=>String(s||'').toLowerCase()};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(helper+'\n'+shortSrc+'\n'+otSrc,ctx,{filename:'krname'});

const T=[];const ok=(n,c,x)=>T.push([!!c,n,x===undefined?'':String(x)]);
const E=id=>ctx.empById(id);

ctx.decorateEmpNames(S.employees);

/* ---- 1. Hiển thị ---- */
ok('kmgr đọc ra "Mr. " + họ tên đầy đủ', E('K1').name==='Mr. Kim Jong Su', E('K1').name);
ok('kmgr đã có sẵn "Mr." không bị nhân đôi', E('K2').name==='Mr. Park Chan Ho', E('K2').name);
ok('người Việt giữ nguyên tên, không thêm gì', E('V1').name==='Nguyễn Hoàng Trung', E('V1').name);
ok('nhân viên thường giữ nguyên tên', E('V2').name==='Phan Quỳnh Vân', E('V2').name);
ok('tên GỐC lấy qua rawName() không có tiền tố', ctx.rawName(E('K1'))==='Kim Jong Su', ctx.rawName(E('K1')));
ok('rawName của người Việt = chính tên đó', ctx.rawName(E('V1'))==='Nguyễn Hoàng Trung');

/* ---- 2. Tên rút gọn vẫn giữ "Mr." ---- */
ok('shortName giữ "Mr." và lấy 2 chữ cuối',
   ctx.shortName(E('K1').name)==='Mr. Jong Su', ctx.shortName(E('K1').name));
ok('shortName người Việt không đổi hành vi cũ',
   ctx.shortName(E('V1').name)==='Hoàng Trung', ctx.shortName(E('V1').name));
ok('shortName tên 1 chữ vẫn ra chính nó', ctx.shortName('Mr. Kim')==='Mr. Kim', ctx.shortName('Mr. Kim'));
ok('shortName chuỗi rỗng không vỡ', ctx.shortName('')==='' , '['+ctx.shortName('')+']');

/* ---- 3. Sửa tên: setter cất tên gốc ---- */
E('K1').name='Kim Jong Su Jr';
ok('sửa tên → đọc lại vẫn có "Mr."', E('K1').name==='Mr. Kim Jong Su Jr', E('K1').name);
ok('sửa tên → tên gốc sạch tiền tố', ctx.rawName(E('K1'))==='Kim Jong Su Jr');
E('K1').name='Mr. Kim Jong Su';
ok('gõ kèm "Mr." cũng không nhân đôi', E('K1').name==='Mr. Kim Jong Su', E('K1').name);

/* ---- 4. Đổi quyền thì tiền tố theo quyền ---- */
E('V2').perm='kmgr';
ok('nâng quyền kmgr → tự có "Mr."', E('V2').name==='Mr. Phan Quỳnh Vân', E('V2').name);
E('V2').perm='staff';
ok('hạ quyền → tiền tố biến mất', E('V2').name==='Phan Quỳnh Vân', E('V2').name);

/* ---- 5. Vòng lưu / nạp lại (localStorage + Firebase) ---- */
const js1=JSON.stringify(S.employees);
const reload=JSON.parse(js1);
ctx.S.employees=reload;ctx.decorateEmpNames(reload);
ok('nạp lại vẫn đúng, không nhân đôi "Mr."',
   ctx.empById('K1').name==='Mr. Kim Jong Su', ctx.empById('K1').name);
ok('chuỗi JSON ỔN ĐỊNH qua vòng lưu (không đẩy Firebase thừa)',
   JSON.stringify(ctx.S.employees)===js1);
ok('thứ tự khoá trong object không bị xáo',
   Object.keys(ctx.S.employees[0]).join(',')==='id,name,team,perm',
   Object.keys(ctx.S.employees[0]).join(','));
ok('_name không lọt vào JSON', js1.indexOf('_name')<0);

/* ---- 6. decorate gọi lại nhiều lần vẫn an toàn ---- */
ctx.decorateEmpNames(ctx.S.employees);
ctx.decorateEmpNames(ctx.S.employees);
ok('decorate 3 lần: tên không đổi', ctx.empById('K1').name==='Mr. Kim Jong Su');
ok('decorate 3 lần: JSON không đổi', JSON.stringify(ctx.S.employees)===js1);

/* ---- 7. Nhãn cấp duyệt & danh sách kmgr ---- */
ok('krMgrName() nối tên các Quản lý người Hàn đang hoạt động',
   ctx.krMgrName()==='Mr. Kim Jong Su, Mr. Park Chan Ho', ctx.krMgrName());
ok('người đã nghỉ việc (active:false) không lọt vào krMgrName',
   ctx.krMgrName().indexOf('Lee')<0);

/* ---- 8. So khớp với file OT nhập từ Excel ---- */
ok('otNorm bỏ "Mr." để khớp tên trần trong Excel',
   ctx.otNorm('Mr. Kim Jong Su')===ctx.otNorm('Kim Jong Su'), ctx.otNorm('Mr. Kim Jong Su'));

/* ---- 9. Biên ---- */
ok('nhân viên chưa đặt tên → không ra chuỗi "Mr. "',
   ctx.krName('K1','')==='', '['+ctx.krName('K1','')+']');
ok('stripKrTitle không cắt nhầm tên bắt đầu bằng "Mrs"',
   ctx.stripKrTitle('Mrs Kim')==='Mrs Kim', ctx.stripKrTitle('Mrs Kim'));
ok('stripKrTitle xử lý được "MR." viết hoa',
   ctx.stripKrTitle('MR.  Kim Jong Su')==='Kim Jong Su');

let bad=0;
T.forEach(([c,n,x])=>{if(!c)bad++;console.log((c?'  ✅ ':'  ❌ ')+n+(x?'   ['+x+']':''));});
console.log((bad?'\n❌ ':'\n✅ ')+(T.length-bad)+'/'+T.length+' đạt');
process.exit(bad?1:0);
