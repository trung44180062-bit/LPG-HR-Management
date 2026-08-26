let pass=0,fail=0;
const ok=(name,cond,extra)=>{if(cond){pass++;console.log('  ✓',name);}
  else{fail++;console.log('  ✗',name,extra!==undefined?('→ '+JSON.stringify(extra)):'');}};

/* ---------- dữ liệu giả: 4 nhóm × (1 kỹ sư + 1 operator) ---------- */
S.employees=[
 {id:'k1',name:'Kỹ sư A1',team:'A',role:'eng', pos:'field_eng',shiftType:'type1',a1:'2026-09-01',active:true},
 {id:'o1',name:'Oper A2',  team:'A',role:'oper',pos:'operator', shiftType:'type1',a1:'2026-09-01',active:true},
 {id:'k2',name:'Kỹ sư B1',team:'B',role:'eng', pos:'boardman', shiftType:'type1',a1:'2026-09-03',active:true},
 {id:'o2',name:'Oper B2',  team:'B',role:'oper',pos:'operator', shiftType:'type1',a1:'2026-09-03',active:true},
 {id:'k3',name:'Kỹ sư C1',team:'C',role:'eng', pos:'field_eng',shiftType:'type1',a1:'2026-09-05',active:true},
 {id:'k4',name:'Kỹ sư D1',team:'D',role:'eng', pos:'boardman', shiftType:'type1',a1:'2026-09-07',active:true},
 /* người bấm nút — không xếp lịch, chỉ để nhận tin gộp gửi Zalo */
 {id:'trung',name:'Hoàng Trung',team:'Office',role:'other',pos:'supervisor',shiftType:'none',active:true}
];
S.base={};S.over={};S.notifs={};S.events={};S.reorgs={};S.requests={};
S.settings=S.settings||{};S.settings.hours=S.settings.hours||{};S.settings.customCodes=[];
S.rev=1;

/* Điền lịch chuẩn cả kỳ tháng 9 (21/08 → 20/09) và tháng 10 */
const daysAll=daysOfPeriod('2026-09').concat(daysOfPeriod('2026-10'));
S.employees.forEach(e=>{
  const g=genForEmp(e,daysAll);
  S.base[e.id]={};
  for(const iso in g)S.base[e.id][iso]=g[iso];
});

console.log('\n[1] MẪU CA TỰ KHAI');
ok('cắt được chuỗi dính liền',parseShiftPattern('OODDNNRR').join('')==='OODDNNRR',parseShiftPattern('OODDNNRR'));
ok('cắt được chuỗi có dấu cách',parseShiftPattern('D D N N R R').join('')==='DDNNRR');
ok('cắt được chuỗi có phẩy/gạch',parseShiftPattern('D,D-N|N/R R').join('')==='DDNNRR');
ok('nhận mã dài khi có dấu ngăn',parseShiftPattern('D N AL8 R').join(',')==='D,N,AL8,R');
ok('chuỗi rỗng → mảng rỗng',parseShiftPattern('   ').length===0);
ok('ký tự lạ bị bỏ, không làm hỏng mẫu',parseShiftPattern('DXN').join('')==='DN',parseShiftPattern('DXN'));
ok('mẫu hợp lệ',shiftPatternOk('D D N N R R')===true);
ok('mẫu có mã lạ bị bắt',shiftPatternOk('D D ZZ R')===false);
ok('nhãn gọn',shiftPatternLabel('DDNNRR')==='D·D·N·N·R·R',shiftPatternLabel('DDNNRR'));

/* Sinh lịch theo mẫu tự khai, neo Mốc 1 */
const eCus={id:'x1',shiftType:'custom',pattern:'D D N N R R',a1:'2026-09-21'};
const g6=genForEmp(eCus,['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27']);
ok('mẫu 6 ngày lặp đúng từ Mốc 1',
   ['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27']
     .map(i=>g6[i]).join('')==='DDNNRRD',
   ['2026-09-21','2026-09-27'].map(i=>g6[i]));
const gBefore=genForEmp(eCus,['2026-09-19','2026-09-20']);
ok('ngày TRƯỚC Mốc 1 vẫn tính đúng pha (lùi vòng)',gBefore['2026-09-20']==='R'&&gBefore['2026-09-19']==='R',
   [gBefore['2026-09-19'],gBefore['2026-09-20']]);
ok('mẫu rỗng thì KHÔNG sinh ô nào (không rơi về mẫu 8 ngày)',
   Object.keys(genForEmp({id:'x2',shiftType:'custom',pattern:'',a1:'2026-09-21'},['2026-09-21'])).length===0);

console.log('\n[2] NGƯỜI NGHỈ VIỆC — leftAt chặn sinh lịch');
const eLeft={id:'x3',shiftType:'type1',a1:'2026-09-01',leftAt:'2026-09-23'};
const gL=genForEmp(eLeft,['2026-09-22','2026-09-23','2026-09-24']);
ok('không sinh lịch sau ngày làm việc cuối',!!gL['2026-09-23']&&gL['2026-09-24']===undefined,Object.keys(gL));
ok('inServiceOn đúng hai đầu',
   inServiceOn(eLeft,'2026-09-23')&&!inServiceOn(eLeft,'2026-09-24'));
ok('inServiceRange giữ người nghỉ giữa kỳ',
   inServiceRange(eLeft,'2026-08-21','2026-09-20')===true);
ok('inServiceRange loại người đã nghỉ trước kỳ',
   inServiceRange(eLeft,'2026-09-24','2026-10-20')===false);

console.log('\n[3] TÁI CƠ CẤU — xem trước & áp dụng');
/* Kịch bản thật — cố tình chọn mốc GIỮA KỲ (kỳ tháng 9 = 21/08 → 20/09):
   k4 nghỉ việc 04/09; từ 05/09 gom kỹ sư còn lại thành 2 nhóm DCS (k1,k2)
   và Field (k3), mẫu ca D D N N R R lệch pha nhau. Mốc giữa kỳ mới là ca
   khó: một bảng lịch phải chứa cả cơ cấu cũ lẫn cơ cấu mới. */
const EFF='2026-09-05', TO=periodFor('2026-10').to;
const beforeSnapshot=JSON.parse(JSON.stringify(S.base));
S.reorgs.r1={
  id:'r1',title:'Rút 4 nhóm xuống 2 nhóm',effFrom:EFF,toIso:TO,
  leavers:{k4:'2026-09-04'},
  moves:{
    k1:{team:'DCS',  shiftType:'custom',pattern:'D D N N R R',a1:EFF},
    k2:{team:'DCS',  shiftType:'custom',pattern:'D D N N R R',a1:addDaysIso(EFF,3)},
    k3:{team:'Field',shiftType:'custom',pattern:'D D N N R R',a1:EFF}
  },
  joiners:{},pauses:{},kinds:['leave','struct'],preset:'custom',
  status:'draft',notify:true,by:'trung',at:Date.now()
};
const pv=roPreview(S.reorgs.r1);
ok('xem trước liệt kê cả 3 người đổi nhóm và 1 người nghỉ việc',
   pv.rows.length===4&&pv.rows.filter(r=>r.tag==='move').length===3
   &&pv.rows.filter(r=>r.tag==='leave').length===1,
   pv.rows.map(r=>r.id+':'+r.tag));
ok('xem trước chỉ tính từ mốc trở đi',pv.days[0]===EFF,pv.days[0]);
ok('xem trước có đếm ô đổi',pv.rows.every(r=>r.n>0),pv.rows.map(r=>r.n));
ok('người nghỉ việc hiện dải ô bị gỡ',
   pv.rows.find(r=>r.tag==='leave').after.every(c=>c===''),
   pv.rows.find(r=>r.tag==='leave').after.slice(0,4));

const res=roApply('r1');
ok('áp dụng trả về số ô + số người',!!res&&res.people===4&&res.cells>0,res);
ok('trạng thái chuyển applied',S.reorgs.r1.status==='applied');

/* --- điều cốt lõi: lịch TRƯỚC mốc không bị chạm --- */
const untouched=daysOfPeriod('2026-09').filter(iso=>iso<EFF)
  .every(iso=>['k1','k2','k3'].every(id=>
    (S.base[id]||{})[iso]===(beforeSnapshot[id]||{})[iso]));
ok('KHÔNG một ô nào trước mốc bị viết đè',untouched===true);
ok('ô ngay trước mốc giữ nguyên lịch cũ',
   S.base.k1['2026-09-04']===beforeSnapshot.k1['2026-09-04'],
   [S.base.k1['2026-09-04'],beforeSnapshot.k1['2026-09-04']]);
ok('CÙNG MỘT KỲ chứa cả hai cơ cấu (lịch trộn)',
   S.base.k1['2026-09-04']!==undefined&&S.base.k1['2026-09-06']==='D'
   &&schedMonthOf('2026-09-04')===schedMonthOf('2026-09-06'),
   [S.base.k1['2026-09-04'],S.base.k1['2026-09-06']]);

/* --- từ mốc trở đi chạy mẫu mới --- */
ok('k1 từ mốc chạy D D N N R R',
   ['2026-09-05','2026-09-06','2026-09-07','2026-09-08','2026-09-09','2026-09-10']
     .map(i=>S.base.k1[i]).join('')==='DDNNRR',
   ['2026-09-05','2026-09-10'].map(i=>S.base.k1[i]));
ok('k2 lệch pha 3 ngày so với k1',
   S.base.k2['2026-09-05']==='N'&&S.base.k2['2026-09-08']==='D',
   [S.base.k2['2026-09-05'],S.base.k2['2026-09-08']]);
ok('nhóm mới đã ghi vào hồ sơ nhân viên',
   empById('k1').team==='DCS'&&empById('k3').team==='Field');
ok('kiểu ca + mẫu ca đã ghi',
   empById('k1').shiftType==='custom'&&empById('k1').pattern==='D D N N R R');
ok('operator KHÔNG bị đụng tới (chỉ khai cho kỹ sư)',
   empById('o1').team==='A'&&empById('o1').shiftType==='type1');
ok('lịch operator giữ nguyên sau mốc',
   S.base.o1['2026-09-10']===beforeSnapshot.o1['2026-09-10']);

/* --- người nghỉ việc --- */
ok('ghi ngày làm việc cuối',empById('k4').leftAt==='2026-09-04');
ok('lịch sau ngày nghỉ đã gỡ sạch',
   Object.keys(S.base.k4||{}).every(iso=>iso<='2026-09-04'),
   Object.keys(S.base.k4||{}).filter(i=>i>'2026-09-04'));
ok('lịch TRƯỚC ngày nghỉ vẫn còn (còn tra bảng công)',
   !!S.base.k4['2026-08-25']);

console.log('\n[4] TÁI CƠ CẤU — vạch chuyển & nhãn nhóm');
ok('roCutAt bắt đúng ngày mốc',!!roCutAt(EFF)&&!roCutAt('2026-09-04'));
const pair=roTeamPair('k1',daysOfPeriod('2026-09'));
ok('nhãn A→DCS hiện khi mốc nằm trong kỳ đang xem',
   !!pair&&pair.old==='A'&&pair.now==='DCS',pair);
ok('kỳ sau KHÔNG hiện mũi tên nữa',roTeamPair('k1',daysOfPeriod('2026-11'))===null);
ok('người không đổi nhóm thì không có nhãn',roTeamPair('o1',daysOfPeriod('2026-09'))===null);

console.log('\n[5] TÁI CƠ CẤU — thông báo');
const roNotifs=Object.values(S.notifs).filter(n=>n.zk==='reorg');
ok('mỗi người đổi/nghỉ nhận 1 tin riêng',
   roNotifs.filter(n=>n.nz).length===4,roNotifs.filter(n=>n.nz).map(n=>n.to));
ok('tin riêng KHÔNG bắn Zalo (nz:1)',roNotifs.filter(n=>n.nz).every(n=>n.nz===1));
ok('có ĐÚNG 1 tin gộp cho Zalo',roNotifs.filter(n=>n.ro).length===1);
const sum=roNotifs.find(n=>n.ro);
ok('tin gộp liệt kê đủ 3 người đổi + 1 người nghỉ',
   sum.ro.moves.length===3&&sum.ro.leavers.length===1,
   [sum.ro.moves.length,sum.ro.leavers.length]);
ok('tin riêng của k1 nói đúng nhóm mới',/DCS/.test(roNotifs.find(n=>n.to==='k1'&&n.nz).text));
ok('tin riêng của k4 nói ngày làm việc cuối',/04\/09/.test(roNotifs.find(n=>n.to==='k4').text),
   roNotifs.find(n=>n.to==='k4').text);

console.log('\n[6] TÁI CƠ CẤU — tin Zalo');
ok('kênh reorg = now',ZALO_INFO_CHANNEL.reorg==='now');
const zt=zaloTitle(sum,'reorg');
ok('tiêu đề có số người',/TEAM RESTRUCTURE — 4 people/.test(zt),zt);
ok('tin gộp là broadcast',zaloIsBroadcast(sum,'reorg')===1);
ok('tin riêng KHÔNG là broadcast',zaloIsBroadcast(roNotifs.find(n=>n.nz),'reorg')===0);
const zl=zaloLines(sum,'reorg');
ok('thân tin có dòng hiệu lực',/Effective/.test(zl[0]),zl[0]);
ok('thân tin có mũi tên nhóm cũ › mới',zl.some(x=>/A › DCS/.test(x)),zl);
ok('thân tin có dòng người nghỉ việc',zl.some(x=>/last working day/.test(x)),zl);
ok('KHÔNG lọt mã nội bộ SD/SN/SO ra Zalo',!zl.join('\n').match(/\b(SD|SN|SO)\b/),zl);

console.log('\n[7] TÁI CƠ CẤU — hoàn tác');
const undoRes=roUndo('r1');
ok('hoàn tác trả về số ô',!!undoRes&&undoRes.cells>0,undoRes);
const restored=daysAll.every(iso=>['k1','k2','k3','k4'].every(id=>
  ((S.base[id]||{})[iso]||'')===((beforeSnapshot[id]||{})[iso]||'')));
ok('MỌI ô lịch trở lại đúng như trước',restored===true);
ok('khai báo nhóm cũng trở lại',empById('k1').team==='A'&&empById('k1').shiftType==='type1');
ok('gỡ mốc nghỉ việc',!empById('k4').leftAt);
ok('thu hồi hết thông báo của đợt',
   Object.values(S.notifs).filter(n=>n.zk==='reorg').length===0);
ok('trạng thái về nháp',S.reorgs.r1.status==='draft');

console.log('\n[8] LỊCH TÀU — 3 phương án');
_me='trung';
const PLAN='pl1';
[1,2,3].forEach(i=>{
  vsWriteOpt({id:'ev'+i,plan:PLAN,vessel:'VLGC GAS SUN',planNote:'30.000 tấn',
    scope:'all',teams:[],notify:true,optNo:i,nOpt:3,optName:'',
    from:'2026-09-1'+i,to:'2026-09-1'+(i+1),note:'cập cầu 06:00',prov:1});
});
evResetCache();
let p=vsPlanById(PLAN);
ok('gom đúng 3 phương án một chuyến',p.opts.length===3,p.opts.map(x=>x.optNo));
ok('chuyến chưa chốt',p.fixed===false);
ok('tên sự kiện nói rõ PA mấy trên mấy',/PA 2\/3/.test(S.events.ev2.title),S.events.ev2.title);
ok('tên sự kiện nói rõ chưa chốt',/chưa chốt/.test(S.events.ev2.title));
ok('mọi phương án đều hiện trên lịch',eventsOfDay('2026-09-12').length>0);
ok('ngày chỉ có PA đều mang cờ prov',
   eventsOfDay('2026-09-12').every(x=>x.prov===1),eventsOfDay('2026-09-12').map(x=>x.prov));
ok('loại sự kiện là VLGC',S.events.ev1.cat==='vlgc');
ok('vsIsOpt nhận diện phương án',vsIsOpt(S.events.ev1)===true&&vsIsOpt({id:'z'})===false);
ok('đếm chuyến chưa chốt',vsPendingCount()===1);

const nSent=vsSendNotifs(p);
ok('gửi thông báo cho mọi người × 3 phương án',nSent===S.employees.length*3,nSent);
ok('thông báo mang cờ vs để Zalo biết là lịch dự kiến',
   Object.values(S.notifs).filter(n=>n.vs&&!n.vs.fixed).length===nSent);
const vsN=Object.values(S.notifs).find(n=>n.vs);
ok('tiêu đề Zalo ghi TENTATIVE',/TENTATIVE/.test(zaloTitle(vsN,'event')),zaloTitle(vsN,'event'));
const vsL=zaloLines(vsN,'event');
ok('thân tin ghi rõ chưa chốt',vsL.some(x=>/TENTATIVE/.test(x)),vsL);
ok('thân tin có tên tàu + số phương án',vsL.some(x=>/GAS SUN/.test(x)&&/Option \d\/3/.test(x)),vsL);

console.log('\n[9] LỊCH TÀU — chốt phương án');
vsFix(PLAN,'ev2');
ok('phương án sai bị xoá hẳn',!S.events.ev1&&!S.events.ev3,Object.keys(S.events));
ok('phương án đúng còn lại',!!S.events.ev2);
ok('bỏ cờ chưa chốt',S.events.ev2.prov===0);
ok('đánh số lại thành PA 1',S.events.ev2.optNo===1&&!/PA 1\/3/.test(S.events.ev2.title),S.events.ev2.title);
ok('tên sự kiện không còn chữ chưa chốt',!/chưa chốt/.test(S.events.ev2.title),S.events.ev2.title);
ok('thu hồi hết thông báo của phương án sai',
   Object.values(S.notifs).filter(n=>n.evId==='ev1'||n.evId==='ev3').length===0);
const fixN=Object.values(S.notifs).filter(n=>n.vs&&n.vs.fixed);
ok('gửi thông báo ĐÃ CHỐT cho mọi người',fixN.length===S.employees.length,fixN.length);
ok('tiêu đề Zalo ghi CONFIRMED',/CONFIRMED/.test(zaloTitle(fixN[0],'event')),zaloTitle(fixN[0],'event'));
ok('thân tin ghi CONFIRMED',zaloLines(fixN[0],'event').some(x=>/CONFIRMED/.test(x)));
ok('lịch không còn ngày của phương án sai',eventsOfDay('2026-09-11').length===0);
ok('lịch giữ ngày của phương án đã chốt',eventsOfDay('2026-09-12').length===1);
ok('ngày đã chốt KHÔNG còn cờ prov',eventsOfDay('2026-09-12')[0].prov===0);
ok('hết chuyến chưa chốt',vsPendingCount()===0);

console.log('\n[10] LỊCH TÀU — xoá phương án lẻ & đánh số lại');
['a1','a2','a3'].forEach((id,i)=>{
  vsWriteOpt({id,plan:'pl2',vessel:'VLGC BLUE',scope:'all',notify:false,
    optNo:i+1,nOpt:3,from:'2026-10-0'+(i+2),to:'2026-10-0'+(i+2),prov:1});
});
evResetCache();
vsDelOpt('pl2','a2');
const p2=vsPlanById('pl2');
ok('còn 2 phương án',p2.opts.length===2,p2.opts.map(x=>x.id));
ok('đánh số lại liền mạch 1,2',p2.opts.map(x=>x.optNo).join(',')==='1,2',p2.opts.map(x=>x.optNo));
ok('tên sự kiện cập nhật theo số mới',/PA 2\/2/.test(S.events.a3.title),S.events.a3.title);

console.log('\n[11] BẢO TOÀN: không đụng gì tới phần đang chạy');
ok('sự kiện thường KHÔNG bị coi là phương án tàu',
   vsIsOpt({id:'e9',title:'Bảo dưỡng',cat:'maint'})===false);
S.events.plain={id:'plain',title:'Bảo dưỡng bơm',cat:'maint',from:'2026-10-15',to:'2026-10-15',
  scope:'all',teams:[],notify:true};
evResetCache();
ok('sự kiện thường vẫn hiện trên lịch',eventsOfDay('2026-10-15').length===1);
ok('sự kiện thường không có cờ prov',!eventsOfDay('2026-10-15')[0].prov);
ok('vsPlans bỏ qua sự kiện thường',!vsPlans().some(x=>x.opts.some(o=>o.id==='plain')));



console.log('\n[12] NGƯỜI MỚI VÀO & NGHỈ DÀI HẠN (★ v9.0)');
/* Dựng lại nền sạch: hoàn tác ở [7] đã trả mọi thứ về nguyên trạng */
S.notifs={};
S.employees.push({id:'n1',name:'Oper mới',team:'A',role:'oper',pos:'operator',
                  shiftType:'office6',active:true});
S.reorgs.r2={
  id:'r2',title:'Người mới + thai sản',effFrom:'2026-09-05',toIso:'2026-09-20',
  kinds:['join','pause'],preset:'custom',
  leavers:{},moves:{},
  joiners:{n1:{from:'2026-09-08',team:'A',shiftType:'office6',pattern:'',a1:''}},
  pauses:{o2:{from:'2026-09-05',to:'2026-09-20',code:'MAT'}},
  status:'draft',notify:true,by:'trung',at:Date.now()
};
const snap2=JSON.parse(JSON.stringify(S.base));
const r2=roApply('r2');
ok('áp dụng được đợt có người mới + nghỉ dài hạn',!!r2&&r2.people===2,r2);
ok('người mới CHƯA có lịch trước ngày vào làm',
   !(S.base.n1||{})['2026-09-07'],Object.keys(S.base.n1||{}).slice(0,3));
ok('người mới có lịch từ đúng ngày vào làm',!!(S.base.n1||{})['2026-09-08']);
ok('ghi ngày vào làm vào hồ sơ',empById('n1').joinAt==='2026-09-08');
ok('người mới đi hành chính T2–T7 thì CN nghỉ',
   S.base.n1['2026-09-13']==='R',S.base.n1['2026-09-13']);  // 13/09/2026 là Chủ nhật
ok('nghỉ dài hạn phủ mã MAT cả khoảng',
   ['2026-09-05','2026-09-12','2026-09-20'].every(i=>S.base.o2[i]==='MAT'),
   ['2026-09-05','2026-09-12','2026-09-20'].map(i=>S.base.o2[i]));
ok('ngày TRƯỚC khoảng nghỉ không bị chạm',
   S.base.o2['2026-09-04']===snap2.o2['2026-09-04']);
ok('người nghỉ dài hạn VẪN thuộc nhóm cũ',empById('o2').team==='B');
ok('tin riêng cho người mới nói ngày bắt đầu',
   /08\/09/.test(Object.values(S.notifs).find(n=>n.to==='n1').text),
   Object.values(S.notifs).find(n=>n.to==='n1').text);
ok('tin riêng cho người nghỉ dài hạn có mã nghỉ',
   /MAT/.test(Object.values(S.notifs).find(n=>n.to==='o2'&&n.nz).text));
const sum2=Object.values(S.notifs).find(n=>n.ro);
const zl2=zaloLines(sum2,'reorg');
ok('tin Zalo có dòng người mới',zl2.some(x=>/joins/i.test(x)),zl2);
ok('tin Zalo có dòng nghỉ dài hạn',zl2.some(x=>/long leave/i.test(x)),zl2);

roUndo('r2');
ok('hoàn tác trả lịch người nghỉ dài hạn về cũ',
   S.base.o2['2026-09-12']===snap2.o2['2026-09-12'],
   [S.base.o2['2026-09-12'],snap2.o2['2026-09-12']]);
ok('hoàn tác gỡ hết lịch người mới',Object.keys(S.base.n1||{}).length===0,
   Object.keys(S.base.n1||{}));

console.log('\n[13] KỊCH BẢN THẬT — Nam nghỉ 06/09, Thạnh sang DCS');
/* Đúng tình huống người dùng mô tả:
     · Nam (DCS Boardman, nhóm A) nghỉ việc, ngày làm cuối 05/09
     · từ 06/09 Thạnh (Field Engineer, nhóm A) chuyển sang nhóm DCS
     · nhóm DCS chạy ca 8 ngày O O D D N N R R
     · nhóm Field chạy ca 6 ngày D D N N R R, chỉ còn 3 người
   Đây là ca mà bản v9.0 KHÔNG làm được: preset ép cả hai nhóm cùng một mẫu. */
S.employees=[
 {id:'thanh',name:'Dương Xuân Thạnh',team:'A',role:'eng',pos:'field_eng',shiftType:'type1',a1:'2026-07-08',active:true},
 {id:'nam',  name:'Vũ Văn Nam',      team:'A',role:'eng',pos:'boardman', shiftType:'type1',a1:'2026-07-08',active:true},
 {id:'hung', name:'Nguyễn Quốc Hùng',team:'B',role:'eng',pos:'field_eng',shiftType:'type1',a1:'2026-07-02',active:true},
 {id:'loc',  name:'Nguyễn Bá Lộc',   team:'B',role:'eng',pos:'boardman', shiftType:'type1',a1:'2026-07-02',active:true},
 {id:'an',   name:'Lâm Thuận An',    team:'C',role:'eng',pos:'field_eng',shiftType:'type1',a1:'2026-07-04',active:true},
 {id:'binh', name:'Trần Bình',       team:'C',role:'eng',pos:'boardman', shiftType:'type1',a1:'2026-07-04',active:true},
 {id:'cuong',name:'Lê Cường',        team:'D',role:'eng',pos:'field_eng',shiftType:'type1',a1:'2026-07-06',active:true},
 {id:'trung',name:'Hoàng Trung',team:'Office',role:'other',pos:'supervisor',shiftType:'none',active:true}
];
S.base={};S.over={};S.notifs={};S.reorgs={};S.rev++;
S.employees.forEach(e=>{const g=genForEmp(e,daysOfPeriod('2026-09').concat(daysOfPeriod('2026-10')));
  S.base[e.id]={};for(const i in g)S.base[e.id][i]=g[i];});

roNewDraft();
roEff='2026-09-06';roTo=periodFor('2026-10').to;
roKinds={leave:true,struct:true};
roToggleLeaver('nam');
ok('Nam có ngày làm việc cuối = hôm trước mốc',roLeavers.nam==='2026-09-05',roLeavers.nam);
roApplyPreset('2team',true);
ok('Nam KHÔNG còn nằm trong phép chia',!roMoves.nam,roMoves.nam);
ok('6 kỹ sư còn lại đều được chia',Object.keys(roMoves).length===6,Object.keys(roMoves));

/* --- điều bản cũ không làm được: hai nhóm hai mẫu ca khác nhau --- */
ok('nhóm đích DCS mặc định ca 8 ngày',roTeamByName('DCS').shiftType==='type1');
ok('nhóm đích Field mặc định ca 6 ngày',roTeamByName('Field').shiftType==='type2');

/* --- chuyển Thạnh sang DCS bằng MỘT thao tác --- */
ok('preset xếp Thạnh vào Field (theo Vị trí Field Engineer)',roMoves.thanh.team==='Field',roMoves.thanh.team);
roAssignTeam('thanh','DCS');
ok('chuyển Thạnh sang DCS bằng một lần chọn',roMoves.thanh.team==='DCS');
ok('Thạnh tự nhận ca 8 ngày của nhóm DCS',roMoves.thanh.shiftType==='type1',roMoves.thanh.shiftType);
ok('Field còn đúng 3 người',roTeamMembers('Field').length===3,roTeamMembers('Field').map(e=>e.id));
ok('DCS có 3 người',roTeamMembers('DCS').length===3,roTeamMembers('DCS').map(e=>e.id));
ok('cả nhóm Field chạy ca 6 ngày',
   roTeamMembers('Field').every(e=>roMoves[e.id].shiftType==='type2'));
ok('cả nhóm DCS chạy ca 8 ngày',
   roTeamMembers('DCS').every(e=>roMoves[e.id].shiftType==='type1'));

/* --- mốc so le trong từng nhóm, tính theo chu kỳ RIÊNG của nhóm --- */
const aD=roTeamMembers('DCS').map(e=>roMoves[e.id].a1).sort();
const aF=roTeamMembers('Field').map(e=>roMoves[e.id].a1).sort();
ok('3 người DCS có 3 mốc khác nhau',new Set(aD).size===3,aD);
ok('3 người Field có 3 mốc khác nhau',new Set(aF).size===3,aF);
ok('DCS lệch ~8/3 ngày mỗi người',
   dayNum(aD[2])-dayNum(aD[0])===5,[aD[0],aD[2]]);
ok('Field lệch ~6/3 = 2 ngày mỗi người',
   dayNum(aF[1])-dayNum(aF[0])===2&&dayNum(aF[2])-dayNum(aF[1])===2,aF);

/* --- áp dụng thật --- */
const before13=JSON.parse(JSON.stringify(S.base));
roSaveDraft(true);
const r13=roApply(roEditId);
ok('áp dụng được',!!r13&&r13.people===7,r13);
ok('lịch trước 06/09 không bị chạm',
   daysOfPeriod('2026-09').filter(i=>i<'2026-09-06')
     .every(i=>Object.keys(before13).every(id=>(S.base[id]||{})[i]===(before13[id]||{})[i])));
ok('Nam hết lịch từ 06/09',!(S.base.nam||{})['2026-09-06']&&!!S.base.nam['2026-09-05']);
ok('Thạnh chạy mẫu 8 ngày O O D D N N R R từ mốc của mình',
   (function(){const a=empById('thanh').a1;
     return ['O','O','D','D','N','N','R','R'].every((c,k)=>S.base.thanh[addDaysIso(a,k)]===c);})(),
   [empById('thanh').a1,['0','1','2','3','4','5','6','7'].map(k=>S.base.thanh[addDaysIso(empById('thanh').a1,+k)])]);
ok('Hùng (Field) chạy mẫu 6 ngày D D N N R R',
   (function(){const a=empById('hung').a1;
     return ['D','D','N','N','R','R'].every((c,k)=>S.base.hung[addDaysIso(a,k)]===c);})(),
   ['0','1','2','3','4','5'].map(k=>S.base.hung[addDaysIso(empById('hung').a1,+k)]));
ok('hồ sơ ghi đúng nhóm mới',empById('thanh').team==='DCS'&&empById('hung').team==='Field');
ok('mọi ngày từ 06/09 tới hết kỳ 10 đều có ca cho người ở lại',
   roDayList('2026-09-06',periodFor('2026-10').to)
     .every(i=>['thanh','hung','loc','an','binh','cuong'].every(id=>!!S.base[id][i])));
roUndo(roEditId);
ok('hoàn tác trả lịch về nguyên trạng',
   Object.keys(before13).every(id=>Object.keys(before13[id]).every(i=>S.base[id][i]===before13[id][i])));
ok('hoàn tác trả nhóm về A',empById('thanh').team==='A');

console.log('\n[14] TRÌNH 3 BƯỚC — kiểm tra đầu vào');
roNewDraft();
roKinds={};
ok('chưa chọn loại việc thì chặn',/Bước 1/.test(roValidate()),roValidate());
roKinds={struct:true};
ok('chọn loại rồi nhưng chưa khai gì thì vẫn chặn',/Bước 3/.test(roValidate()),roValidate());
roEff='2026-10-05';roTo='2026-10-01';
ok('ngày kết thúc trước ngày áp dụng thì chặn',/tới phải sau/.test(roValidate()),roValidate());
roNewDraft();roKinds={pause:true};
roPauses.o1={from:'2026-10-10',to:'2026-10-01',code:'NP'};
ok('khoảng nghỉ ngược thì chặn',/khoảng nghỉ/.test(roValidate()),roValidate());

console.log('\n────────────────────────');
console.log(pass+' đạt · '+fail+' hỏng');
if(fail)process.exitCode=1;
