/* ============================================================
   HARNESS — CHẶN ĐƠN TRÙNG  (★ v8.3)
   ------------------------------------------------------------
   Chạy:  node _test/dup-req-harness.js
   ------------------------------------------------------------
   VIỆC NGƯỜI DÙNG NÊU (2026-08-24)

   "Xin nghỉ phép ngày đó quên ghi lý do, user tạo thêm đơn nữa ghi lý do
    => có 2 đơn y chang nhau. Cái này cần chặn, phải xoá đơn cũ mới tạo
    được đơn mới."

   D1  đúng cảnh trên: nghỉ phép 19/08 đang chờ → gửi lại 19/08 = CHẶN
   D2  đơn cũ bị TỪ CHỐI → KHÔNG chặn (phải được làm lại đơn)
   D3  đơn cũ ĐÃ DUYỆT → vẫn CHẶN
   D4  khác LOẠI đơn cùng ngày → KHÔNG chặn (mâu thuẫn nghiệp vụ, không phải trùng)
   D5  khác NGƯỜI → KHÔNG chặn
   D6  khác NGÀY → KHÔNG chặn
   D7  ★ tăng ca cùng ngày KHÁC khung giờ → KHÔNG chặn (ngoại lệ cố ý từ v4.3)
   D8  ★ tăng ca cùng ngày ĐÈ khung giờ → CHẶN
   D9  tăng ca qua nửa đêm 20:00–08:00 vs 22:00–23:00 → CHẶN
   D10 tăng ca thiếu giờ → CHẶN (thà chặn nhầm còn hơn lọt đơn trùng)
   D11 đơn khoảng ngày (multi) chồng lấn → CHẶN, trả đúng các ngày chồng
   D12 đơn nhiều dòng, chỉ 1 ngày chồng → CHẶN, isos đúng 1 ngày đó
   D13 skipId bỏ qua chính đơn đang sửa
   D14 reqDupLine ra một dòng người đọc hiểu được
   D15 ★ ĐI ĐÚNG ĐƯỜNG NGƯỜI DÙNG BẤM: dsSubmit có gọi, và gọi TRƯỚC r.before
   D16 ★ dsFormUI có dải ⛔ chặn, và dùng t2() chứ không phải t()
   D17 dsDupRows trải dateRange() bằng […] — dateRange là HÀM SINH, .map sẽ nổ
   ============================================================ */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const head=m=>console.log('\n── '+m);
const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

/* ---------- nạp LÁT js/08-requests.js ----------
   Cắt từ `function reqDays(` tới đúng đầu khối chú thích "NGƯỜI OT COVER".
   Cắt ở ĐẦU một khối /* … *​/ nên không để lại chú thích hở. */
const src=rd('js/08-requests.js');
const a=src.indexOf('function reqDays(r){');
const b=src.indexOf('   NGƯỜI OT COVER (đơn nghỉ phép)');
if(a<0||b<0){console.log('✗ không cắt được lát 08-requests.js');process.exit(1);}
const cut=src.slice(a,src.lastIndexOf('/* ====',b));

const S={requests:{},employees:[{id:'A1',name:'Tran Van A'},{id:'B2',name:'Le Thi B'}]};
const sandbox={console,JSON,Object,Array,String,Number,Math,RegExp,Set,Date,S,
  REQ_LABEL:{leave:'Nghỉ phép',swap:'Đổi ca',ot:'Tăng ca',change:'Đổi mã ca',
             wt:'Bổ sung công',late:'Đi trễ / Về sớm',multi:'Làm liên tục nhiều ngày'},
  t:s=>s,
  fmtVN:iso=>String(iso).slice(8)+'/'+String(iso).slice(5,7),
  isoOf:d=>d.toISOString().slice(0,10)};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
/* dateRange thật nằm cuối file, ngoài lát — đưa vào nguyên văn cho khớp */
vm.runInContext(cut+'\n'+
  'function* dateRange(f,t){let d=new Date(f+"T00:00:00");const e=new Date(t+"T00:00:00");'+
  'let g=0;while(d<=e&&g++<62){yield isoOf(d);d.setDate(d.getDate()+1);}}\n',sandbox);
const {reqDupHits,reqDupLine,otRowsOverlap}=sandbox;

let seq=0;
function put(o){const id='r'+(++seq);S.requests[id]=Object.assign({id,status:'pending',empId:'A1'},o);return id;}
const reset=()=>{S.requests={};seq=0;};
const rows=(...isos)=>isos.map(iso=>({iso}));

/* ============================================================ */
head('A — CẢNH NGƯỜI DÙNG NÊU');
reset();
put({type:'leave',days:[{iso:'2026-08-19',code:'AL8'}],from:'2026-08-19',to:'2026-08-19'});
let h=reqDupHits('A1','leave',rows('2026-08-19'));
ok(h.length===1&&h[0].isos[0]==='2026-08-19','D1 nghỉ phép 19/08 đang chờ → đơn thứ hai bị chặn');

reset();
put({type:'leave',status:'rejected',days:[{iso:'2026-08-19'}],from:'2026-08-19',to:'2026-08-19'});
ok(reqDupHits('A1','leave',rows('2026-08-19')).length===0,'D2 đơn cũ bị TỪ CHỐI → được làm lại đơn');

reset();
put({type:'leave',status:'approved',days:[{iso:'2026-08-19'}],from:'2026-08-19',to:'2026-08-19'});
ok(reqDupHits('A1','leave',rows('2026-08-19')).length===1,'D3 đơn cũ ĐÃ DUYỆT → vẫn chặn');

reset();
put({type:'leave',days:[{iso:'2026-08-19'}],from:'2026-08-19',to:'2026-08-19'});
ok(reqDupHits('A1','change',rows('2026-08-19')).length===0,'D4 khác loại đơn cùng ngày → không chặn');
ok(reqDupHits('B2','leave',rows('2026-08-19')).length===0,'D5 khác người → không chặn');
ok(reqDupHits('A1','leave',rows('2026-08-20')).length===0,'D6 khác ngày → không chặn');

/* ============================================================ */
head('B — TĂNG CA: chỉ trùng khi ĐÈ GIỜ');
reset();
put({type:'ot',from:'2026-08-19',to:'2026-08-19',
     days:[{iso:'2026-08-19',timeIn:'08:00',timeOut:'12:00',hours:4}]});
ok(reqDupHits('A1','ot',[{iso:'2026-08-19',timeIn:'18:00',timeOut:'20:00'}]).length===0,
   'D7 OT 08–12 rồi OT 18–20 cùng ngày → GỬI ĐƯỢC');
ok(reqDupHits('A1','ot',[{iso:'2026-08-19',timeIn:'11:00',timeOut:'14:00'}]).length===1,
   'D8 OT 08–12 rồi OT 11–14 (đè 1 tiếng) → chặn');
ok(reqDupHits('A1','ot',[{iso:'2026-08-19',timeIn:'12:00',timeOut:'15:00'}]).length===0,
   'D8b chạm mép 12:00 không tính là đè');

reset();
put({type:'ot',from:'2026-08-19',to:'2026-08-19',
     days:[{iso:'2026-08-19',timeIn:'20:00',timeOut:'08:00',isoEnd:'2026-08-20',hours:12}]});
ok(reqDupHits('A1','ot',[{iso:'2026-08-19',timeIn:'22:00',timeOut:'23:00'}]).length===1,
   'D9 OT đêm 20:00–08:00 nuốt 22:00–23:00 → chặn');
ok(reqDupHits('A1','ot',[{iso:'2026-08-19',timeIn:'',timeOut:''}]).length===1,
   'D10 dòng OT thiếu giờ → chặn (thà chặn nhầm)');
ok(otRowsOverlap({iso:'x',timeIn:'08:00',timeOut:'17:00'},
                 {iso:'x',timeIn:'16:00',timeOut:'18:00'})===true,'D10b otRowsOverlap tự nó đúng');

/* ============================================================ */
head('C — ĐƠN NHIỀU NGÀY / KHOẢNG NGÀY');
reset();
put({type:'multi',from:'2026-08-18',to:'2026-08-22'});
h=reqDupHits('A1','multi',rows('2026-08-21','2026-08-22','2026-08-23'));
ok(h.length===1&&h[0].isos.join()==='2026-08-21,2026-08-22',
   'D11 khoảng ngày chồng lấn → chặn, trả đúng 2 ngày chồng');

reset();
put({type:'leave',from:'2026-08-19',to:'2026-08-21',
     days:[{iso:'2026-08-19'},{iso:'2026-08-20'},{iso:'2026-08-21'}]});
h=reqDupHits('A1','leave',rows('2026-08-21','2026-08-25'));
ok(h.length===1&&h[0].isos.join()==='2026-08-21','D12 chỉ 1 ngày chồng → isos đúng 1 ngày đó');

reset();
const rid=put({type:'leave',days:[{iso:'2026-08-19'}],from:'2026-08-19',to:'2026-08-19'});
ok(reqDupHits('A1','leave',rows('2026-08-19'),rid).length===0,'D13 skipId bỏ qua chính đơn đang sửa');

reset();
put({type:'leave',status:'approved',days:[{iso:'2026-08-19',code:'AL8'}],from:'2026-08-19',to:'2026-08-19'});
const line=reqDupLine(reqDupHits('A1','leave',rows('2026-08-19'))[0]);
ok(/Nghỉ phép/.test(line)&&/19\/08/.test(line)&&/đã duyệt/.test(line),
   'D14 reqDupLine → "'+line+'"');

/* ============================================================ */
head('D — ĐI ĐÚNG ĐƯỜNG NGƯỜI DÙNG BẤM  (soi mã nguồn)');
const por=rd('js/13-portal.js');
const sub=por.slice(por.indexOf('function dsSubmit(t){'));
const iDup=sub.indexOf('reqDupHits'), iBefore=sub.indexOf('r.before={}');
ok(iDup>0,'D15a dsSubmit có gọi reqDupHits');
ok(iDup>0&&iBefore>0&&iDup<iBefore,'D15b gọi TRƯỚC khi chụp r.before');
ok(/if\(!confirm\([\s\S]{0,200}?\)\)return;/.test(sub.slice(iDup,iDup+1600)),
   'D15c đơn cũ còn chờ duyệt → hỏi huỷ rồi mới gửi');
ok(/alert\(t2\(/.test(sub.slice(iDup,iDup+1800)),'D15d đơn đã duyệt/đã in → chặn hẳn bằng alert');

const fui=por.slice(por.indexOf('function dsFormUI(){'),por.indexOf('function dsSubmit(t){'));
ok(/pv-alert stop/.test(fui),'D16a dsFormUI có dải ⛔ chặn (.pv-alert.stop)');
ok(fui.indexOf('reqDupHits')<fui.indexOf('conflictReqs('),'D16b dải chặn đứng TRƯỚC cảnh báo mềm');
const badT=/\$\{t\('/.test(fui.slice(fui.indexOf('reqDupHits'),fui.indexOf('conflictReqs(')));
ok(!badT,"D16c dùng t2() — trong dsFormUI biến `t` LÀ loại đơn");
ok(/\.pv-alert\.stop\{/.test(rd('css/portal.css')),'D16d css/portal.css có .pv-alert.stop');

ok(/\[\.\.\.dateRange\(/.test(por),'D17 dsDupRows trải dateRange() bằng […] (dateRange là hàm sinh)');

/* ============================================================ */
console.log('\n════════ '+pass+' đạt · '+fail+' hỏng ════════');
process.exit(fail?1:0);
