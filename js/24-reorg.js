/* ============================================================
   BIẾN ĐỘNG NHÂN SỰ & CƠ CẤU NHÓM  (S.reorgs)
   LPGT Cavern — Quan ly Cong Ca   ★ v9.0
   ------------------------------------------------------------
   VIỆC THẬT

   Nhân sự tổ vận hành không đứng yên: người nghỉ việc, người mới vào,
   người nghỉ thai sản ba tháng, và mỗi lần như thế thì CƠ CẤU NHÓM phải
   xếp lại — bốn nhóm luân phiên A/B/C/D không còn đủ người thì gom thành
   hai nhóm, một trực DCS một đi field.

   Cái khó KHÔNG nằm ở chỗ đổi nhóm. Nó nằm ở chỗ CÙNG MỘT KỲ CÔNG có hai
   cơ cấu: ngày trước mốc chạy cơ cấu cũ, từ mốc trở đi chạy cơ cấu mới.
   Bảng công nộp nhân sự là một bảng liền, không tách đôi được; mà điền
   lại cả kỳ theo cơ cấu mới thì lịch những ngày ĐÃ ĐI LÀM bị viết đè —
   sai bảng công, sai lương.

   CÁCH LÀM

   MỘT bản ghi "đợt biến động" gom đủ bốn loại việc, dùng chung một mốc:

       leavers  — ai nghỉ việc, ngày làm việc cuối cùng
       joiners  — ai mới vào, từ ngày nào, vào nhóm nào
       pauses   — ai nghỉ dài hạn (thai sản / ốm / biệt phái), từ ngày → ngày
       moves    — ai đổi nhóm / đổi mẫu ca

   Bốn loại đi chung một bản ghi vì ngoài đời chúng đi cùng nhau: một
   người nghỉ việc thì ba người còn lại phải xếp lại nhóm, và cả hai việc
   ấy có hiệu lực CÙNG MỘT NGÀY. Tách thành bốn màn riêng là bắt người
   dùng làm bốn lần cùng một mốc, rồi tự đối chiếu xem có khớp không.

   roApply() CHỈ ghi các ô lịch TỪ effFrom TRỞ ĐI. Ngày trước mốc không bị
   chạm một ô nào → bảng lịch tự nó là bản trộn, có VẠCH DỌC ĐẬM ở đúng
   chỗ chuyển (.mtx td.cut) và cột Tổ ghi A→DCS (.c1.movedteam).

   Trước khi ghi, mọi ô sắp bị đè được chụp vào `undo`. Áp dụng nhầm mốc —
   chuyện chắc chắn sẽ xảy ra ít nhất một lần — thì bấm Hoàn tác là lịch
   trở lại nguyên trạng, kể cả những ô vốn trống.

   HAI LỐI VÀO
     · Thanh "Cơ cấu tổ" ngay trong thẻ Tạo / điền lịch ca (tab Nhóm &
       Lịch) — đây là lối vào chính, vì người ta nghĩ tới cơ cấu đúng lúc
       đang tạo lịch. Xem renderStructBar() ở cuối file.
     · Nút 🔀 trên thanh công cụ tab Lịch.

   Lưu ở nhánh Firebase riêng `reorgs`, đồng bộ delta như requests/events.
   ============================================================ */

/* ============================================================
   CƠ CẤU DỰNG SẴN
   ------------------------------------------------------------
   Hai cơ cấu tổ thực tế đang dùng. Bấm một nút là phần mềm TỰ chia người
   và TỰ đặt mốc so le — người dùng chỉ sửa lại chỗ nào không vừa ý, thay
   vì gõ tay từng dòng cho mười mấy người.

   Chia theo VỊ TRÍ đã khai sẵn (DCS Boardman → nhóm DCS, Field Engineer →
   nhóm Field) chứ không hỏi lại: dữ liệu đã có rồi, hỏi lại là bắt người
   dùng khai hai lần cùng một thứ.
   ============================================================ */
const RO_PRESETS=[
  {v:'4team', ic:'👥', l:'4 nhóm luân phiên A · B · C · D',
   hint:'Cơ cấu cũ — mỗi nhóm 8 ngày O O D D N N R R, bốn nhóm lệch nhau 2 ngày'},
  {v:'2team', ic:'🎛', l:'2 nhóm DCS / Field',
   hint:'Kỹ sư gom về hai nhóm: một trực DCS, một đi field — chia theo Vị trí đã khai'},
  {v:'custom',ic:'✎',  l:'Tự khai từng người',
   hint:'Không dùng mẫu — tự điền nhóm, kiểu ca và mốc cho từng dòng'}
];
function roPresetInfo(v){return RO_PRESETS.find(x=>x.v===v)||RO_PRESETS[2];}

/* ============================================================
   NHÓM ĐÍCH — MỖI NHÓM MỘT MẪU CA RIÊNG
   ------------------------------------------------------------
   Bản trước ép CẢ HAI nhóm dùng chung một mẫu ca. Thực tế thì không:
   nhóm DCS đông người hơn nên vẫn chạy được chu kỳ 8 ngày O O D D N N R R,
   còn nhóm Field chỉ còn 3 người thì phải rút xuống 6 ngày D D N N R R.
   Ép chung một mẫu là làm hỏng đúng thứ người dùng cần khai.

   Nên cơ cấu nay khai theo NHÓM ĐÍCH: mỗi nhóm một dòng — tên · kiểu ca ·
   mốc gốc. Xếp một người vào nhóm nào thì họ nhận kiểu ca của nhóm đó và
   một mốc SO LE tự tính theo thứ tự trong nhóm. Người dùng chỉ còn phải
   làm một việc: thả đúng người vào đúng nhóm.
   ============================================================ */
const RO_PRESET_TEAMS={
  '2team':[{name:'DCS',  shiftType:'type1',pattern:''},
           {name:'Field',shiftType:'type2',pattern:''}],
  '4team':[{name:'A',shiftType:'type1',pattern:''},{name:'B',shiftType:'type1',pattern:''},
           {name:'C',shiftType:'type1',pattern:''},{name:'D',shiftType:'type1',pattern:''}]
};
/* Độ dài chu kỳ của một khai báo — dùng để rải mốc so le */
function roCycleLen(m){
  if(!m)return 0;
  if(m.shiftType==='custom')return (typeof parseShiftPattern==='function')?parseShiftPattern(m.pattern).length:0;
  if(m.shiftType==='type1')return 8;
  if(m.shiftType==='type2')return 6;
  return 0;                       // hành chính: không có pha để rải
}

/* Cơ cấu ĐANG chạy — đoán từ tên nhóm của những người đi ca.
   Chỉ để hiện một câu "đang chạy: …" cho người dùng khỏi phải tự nhớ. */
function roCurrentStructure(){
  const tms=[...new Set(schedEmps().filter(e=>poolOf(e)==='prod').map(e=>String(e.team||'').trim()))]
              .filter(Boolean);
  const has=re=>tms.some(x=>re.test(noAccent(x)));
  if(has(/^dcs/)&&has(/^field/))return {v:'2team',teams:tms};
  if(tms.length>=3)return {v:'4team',teams:tms};
  return {v:'custom',teams:tms};
}
function roStructLabel(){
  const s=roCurrentStructure();
  const nm=s.teams.length?s.teams.join(' · '):t('chưa phân nhóm');
  return roPresetInfo(s.v).ic+' '+nm+' ('+s.teams.length+' '+t('nhóm')+')';
}

/* ---------- Đọc dữ liệu ---------- */
function roAll(){
  return Object.values(S.reorgs||{}).filter(Boolean)
    .sort((a,b)=>String(b.effFrom||'').localeCompare(String(a.effFrom||'')));
}
function roById(id){return (S.reorgs||{})[id]||null;}
function roApplied(){return roAll().filter(r=>r.status==='applied');}

/* Ảnh chụp khai báo hiện tại của một người — dùng cho `prev` (hoàn tác)
   và để so "có gì đổi không". */
function roSnapEmp(e){
  return {team:e.team||'',shiftType:e.shiftType||'type1',
          pattern:e.pattern||'',a1:e.a1||''};
}
function roMoveChanged(cur,nw){
  if(!nw)return false;
  return String(cur.team||'')!==String(nw.team||'')
      || String(cur.shiftType||'')!==String(nw.shiftType||'')
      || String(cur.pattern||'')!==String(nw.pattern||'')
      || String(cur.a1||'')!==String(nw.a1||'');
}
/* Nhãn kiểu ca gọn cho bảng so sánh / thông báo */
function roTypeLabel(m){
  const t2=x=>(typeof t==='function')?t(x):x;
  if(!m)return '';
  if(m.shiftType==='custom')
    return (typeof shiftPatternLabel==='function'&&shiftPatternLabel(m.pattern))||t2('Mẫu ca tự khai');
  return {type1:'O·O·D·D·N·N·R·R',type2:'D·D·N·N·R·R',
          admin:t2('Hành chính T2–T6'),office6:t2('Hành chính T2–T7'),
          none:t2('Không xếp lịch')}[m.shiftType]||m.shiftType||'';
}

/* ---------- Mốc chuyển tiếp trên lịch ---------- */
let _roCut=null,_roCutRev=-1;
function roResetCache(){_roCut=null;_roCutRev=-1;}
function roCutSet(){
  if(_roCut&&_roCutRev===S.rev)return _roCut;
  const m={};
  roApplied().forEach(r=>{if(r.effFrom)m[r.effFrom]=r;});
  _roCut=m;_roCutRev=S.rev;
  return m;
}
function roCutAt(iso){return roCutSet()[iso]||null;}
function roCutTitle(iso){
  const r=roCutAt(iso);
  if(!r)return '';
  const n=Object.keys(r.moves||{}).length, k=Object.keys(r.leavers||{}).length,
        j=Object.keys(r.joiners||{}).length, p=Object.keys(r.pauses||{}).length;
  const bits=[];
  if(n)bits.push(n+' '+t('người đổi nhóm'));
  if(k)bits.push(k+' '+t('người nghỉ việc'));
  if(j)bits.push(j+' '+t('người mới vào'));
  if(p)bits.push(p+' '+t('người nghỉ dài hạn'));
  return (r.title||t('Biến động nhân sự'))+' — '+fmtVNfull(iso)
       +(bits.length?(' · '+bits.join(' · ')):'');
}
/* NHÃN NHÓM CŨ→MỚI cho cột "Tổ" — chỉ khi mốc chuyển RƠI VÀO khoảng ngày
   đang xem. Xem lịch kỳ sau thì chỉ còn nhóm mới, thêm mũi tên là nhiễu. */
function roTeamPair(empId,days){
  if(!days||!days.length)return null;
  const a=days[0],b=days[days.length-1];
  let hit=null;
  roApplied().forEach(r=>{
    if(!r.effFrom||r.effFrom<a||r.effFrom>b)return;
    const nw=(r.moves||{})[empId], od=(r.prev||{})[empId];
    if(!nw||!od)return;
    if(String(od.team||'')===String(nw.team||''))return;  // chỉ đổi mẫu ca thì không cần mũi tên
    hit={old:od.team||'—',now:nw.team||'—',iso:r.effFrom};
  });
  return hit;
}

/* ============================================================
   ÁP DỤNG / HOÀN TÁC
   ============================================================ */
function roDayList(from,to){
  const out=[];if(!from||!to||to<from)return out;
  let d=from;for(let i=0;i<400&&d<=to;i++){out.push(d);d=addDaysIso(d,1);}
  return out;
}
/* Ghi một ô S.base có ghi sổ hoàn tác. Trả 1 nếu thật sự đổi. */
function roPut(undo,id,iso,code){
  S.base[id]=S.base[id]||{};
  const old=S.base[id][iso]||'';
  if(old===(code||''))return 0;
  undo[id]=undo[id]||{};
  /* '' nghĩa là "ô này vốn TRỐNG" — phải phân biệt với "chưa chụp", nếu
     không thì hoàn tác sẽ để lại một ô ca không ai xếp. */
  if(!(iso in undo[id]))undo[id][iso]=old;
  if(code)S.base[id][iso]=code;else delete S.base[id][iso];
  return 1;
}
/* Xem trước: mỗi người đổi bao nhiêu ô, ô nào.
   Chạy trên BẢN SAO nhân viên — tuyệt đối không đụng S.employees, vì người
   dùng còn đang bấm tới bấm lui trong hộp thoại. */
function roPreview(rec){
  const days=roDayList(rec.effFrom,rec.toIso);
  const rows=[];
  const add=(id,nw,genDays,tag)=>{
    const e=empById(id);if(!e)return;
    const clone=Object.assign({},e,{team:nw.team,shiftType:nw.shiftType,
                                    pattern:nw.pattern,a1:nw.a1||e.a1});
    if(tag==='join')clone.joinAt=nw.from||e.joinAt;
    const gen=(typeof genForEmp==='function')?genForEmp(clone,genDays):{};
    let n=0;const after=[],before=[];
    days.forEach(iso=>{
      const old=(S.base[id]&&S.base[id][iso])||'';
      const nu=genDays.includes(iso)?(gen[iso]||''):old;
      before.push(old);after.push(nu);
      if(old!==nu)n++;
    });
    rows.push({id,name:e.name||id,nw,od:roSnapEmp(e),n,before,after,days,tag});
  };
  Object.keys(rec.moves||{}).forEach(id=>add(id,rec.moves[id],days,'move'));
  Object.keys(rec.joiners||{}).forEach(id=>{
    const j=rec.joiners[id];
    add(id,j,days.filter(iso=>iso>=(j.from||rec.effFrom)),'join');
  });
  /* Nghỉ dài hạn: không sinh ca, chỉ phủ mã nghỉ lên khoảng ngày */
  Object.keys(rec.pauses||{}).forEach(id=>{
    const e=empById(id);if(!e)return;
    const p=rec.pauses[id];
    let n=0;const before=[],after=[];
    days.forEach(iso=>{
      const old=(S.base[id]&&S.base[id][iso])||'';
      const inRange=iso>=(p.from||rec.effFrom)&&iso<=(p.to||rec.toIso);
      const nu=inRange?(p.code||'NP'):old;
      before.push(old);after.push(nu);
      if(old!==nu)n++;
    });
    rows.push({id,name:e.name||id,nw:{team:e.team,shiftType:e.shiftType},
               od:roSnapEmp(e),n,before,after,days,tag:'pause',pause:p});
  });
  /* Người nghỉ việc: ô sau ngày cuối bị gỡ */
  Object.keys(rec.leavers||{}).forEach(id=>{
    const e=empById(id);if(!e)return;
    const last=rec.leavers[id];
    let n=0;const before=[],after=[];
    days.forEach(iso=>{
      const old=(S.base[id]&&S.base[id][iso])||'';
      const nu=(iso>last)?'':old;
      before.push(old);after.push(nu);
      if(old!==nu)n++;
    });
    rows.push({id,name:e.name||id,nw:{team:e.team,shiftType:e.shiftType},
               od:roSnapEmp(e),n,before,after,days,tag:'leave',last});
  });
  rows.sort((a,b)=>String(a.nw.team||'').localeCompare(String(b.nw.team||''))
                 ||String(a.name).localeCompare(String(b.name),'vi'));
  return {days,rows};
}
/* Ghi thật. Trả {cells,people}. */
function roApply(id){
  if(!hrGuard())return null;
  const rec=roById(id);
  if(!rec){toast(t('Không tìm thấy đợt biến động'));return null;}
  if(rec.status==='applied'){toast(t('Đợt này đã áp dụng rồi'));return null;}
  if(!rec.effFrom||!rec.toIso||rec.toIso<rec.effFrom){toast(t('Khoảng ngày không hợp lệ'));return null;}

  const days=roDayList(rec.effFrom,rec.toIso);
  const undo={},prev={};
  let cells=0;

  /* 1) NGƯỜI NGHỈ VIỆC — ghi mốc rời tổ rồi dọn lịch sau mốc đó.
        Không xoá người khỏi danh sách: bảng công các kỳ trước vẫn phải tra
        được, đơn cũ vẫn phải trỏ đúng tên. */
  Object.keys(rec.leavers||{}).forEach(pid=>{
    const e=empById(pid);if(!e)return;
    const last=rec.leavers[pid]||addDaysIso(rec.effFrom,-1);
    prev[pid]=Object.assign(roSnapEmp(e),{leftAt:e.leftAt||''});
    e.leftAt=last;
    undo[pid]=undo[pid]||{};
    Object.keys(S.base[pid]||{}).forEach(iso=>{
      if(iso>last)cells+=roPut(undo,pid,iso,'');
    });
    /* Ô ghi đè (đổi ca / OT đã duyệt) sau ngày nghỉ cũng phải gỡ */
    if(S.over[pid])Object.keys(S.over[pid]).forEach(iso=>{if(iso>last)delete S.over[pid][iso];});
  });

  /* 2) NGƯỜI Ở LẠI ĐỔI NHÓM — điền lại lịch TỪ MỐC TRỞ ĐI. */
  Object.keys(rec.moves||{}).forEach(pid=>{
    const e=empById(pid);if(!e)return;
    const nw=rec.moves[pid];
    prev[pid]=roSnapEmp(e);
    e.team=nw.team;e.shiftType=nw.shiftType;
    e.pattern=nw.pattern||'';
    if(nw.a1)e.a1=nw.a1;
    const gen=genForEmp(e,days);
    days.forEach(iso=>{cells+=roPut(undo,pid,iso,gen[iso]||'');});
  });

  /* 3) NGƯỜI MỚI VÀO — chỉ xếp từ ngày vào làm trở đi, không đụng ai khác. */
  Object.keys(rec.joiners||{}).forEach(pid=>{
    const e=empById(pid);if(!e)return;
    const j=rec.joiners[pid];
    prev[pid]=Object.assign(roSnapEmp(e),{joinAt:e.joinAt||''});
    e.joinAt=j.from||rec.effFrom;
    if(j.team)e.team=j.team;
    if(j.shiftType)e.shiftType=j.shiftType;
    e.pattern=j.pattern||'';
    if(j.a1)e.a1=j.a1;
    const mine=days.filter(iso=>iso>=e.joinAt);
    const gen=genForEmp(e,mine);
    mine.forEach(iso=>{cells+=roPut(undo,pid,iso,gen[iso]||'');});
  });

  /* 4) NGHỈ DÀI HẠN — phủ mã nghỉ lên khoảng ngày. KHÔNG xoá người khỏi
        nhóm: hết hạn nghỉ họ quay lại đúng chỗ cũ, lịch những ngày sau đó
        vẫn là lịch chuẩn của nhóm. */
  Object.keys(rec.pauses||{}).forEach(pid=>{
    if(!empById(pid))return;
    const p=rec.pauses[pid];
    const from=p.from||rec.effFrom, to=p.to||rec.toIso;
    roDayList(from,to).forEach(iso=>{cells+=roPut(undo,pid,iso,p.code||'NP');});
    if(S.over[pid])roDayList(from,to).forEach(iso=>{delete S.over[pid][iso];});
  });

  rec.prev=prev;rec.undo=undo;
  rec.status='applied';
  rec.appliedAt=Date.now();rec.appliedBy=meId()||'admin';
  rec.cells=cells;
  roResetCache();
  const people=Object.keys(rec.moves||{}).length+Object.keys(rec.leavers||{}).length
              +Object.keys(rec.joiners||{}).length+Object.keys(rec.pauses||{}).length;
  if(rec.notify!==false)roSendNotifs(rec);
  save();
  if(typeof fillMonthSelects==='function')fillMonthSelects();
  if(typeof renderAll==='function')renderAll();
  return {cells,people};
}
/* Hoàn tác: trả ô lịch và khai báo về đúng như trước khi áp dụng. */
function roUndo(id){
  if(!hrGuard())return null;
  const rec=roById(id);
  if(!rec||rec.status!=='applied'){toast(t('Đợt này chưa áp dụng'));return null;}
  if(!confirm(t('Hoàn tác đợt này? Lịch và khai báo nhóm sẽ trở lại như trước.')))return null;
  let cells=0;
  Object.keys(rec.undo||{}).forEach(pid=>{
    S.base[pid]=S.base[pid]||{};
    const m=rec.undo[pid];
    Object.keys(m).forEach(iso=>{
      const old=m[iso];
      if(old)S.base[pid][iso]=old;else delete S.base[pid][iso];
      cells++;
    });
  });
  Object.keys(rec.prev||{}).forEach(pid=>{
    const e=empById(pid);if(!e)return;
    const p=rec.prev[pid];
    e.team=p.team;e.shiftType=p.shiftType;e.pattern=p.pattern||'';
    if(p.a1)e.a1=p.a1;
    if(Object.prototype.hasOwnProperty.call(p,'leftAt'))e.leftAt=p.leftAt||'';
    if(Object.prototype.hasOwnProperty.call(p,'joinAt'))e.joinAt=p.joinAt||'';
  });
  roRevokeNotifs(rec.id);
  rec.status='draft';rec.undo={};rec.prev={};
  delete rec.appliedAt;delete rec.appliedBy;
  roResetCache();save();
  if(typeof renderAll==='function')renderAll();
  toast(t('Đã hoàn tác')+' — '+cells+' '+t('ô ca'));
  return {cells};
}
function roDelete(id){
  if(!hrGuard())return;
  const rec=roById(id);if(!rec)return;
  if(rec.status==='applied'){
    if(!confirm(t('Đợt này ĐANG áp dụng. Xoá bản ghi sẽ KHÔNG trả lịch về như cũ — muốn trả lịch thì bấm Hoàn tác trước. Vẫn xoá?')))return;
  }else if(!confirm(t('Xoá đợt biến động này?')))return;
  roRevokeNotifs(id);
  delete S.reorgs[id];
  roResetCache();save();
  if(roEditId===id)roNewDraft();
  renderReorgMgr();
  toast(t('Đã xoá đợt biến động'));
}

/* ============================================================
   THÔNG BÁO
   ============================================================ */
function roRevokeNotifs(recId){
  if(!S.notifs)return 0;
  if(typeof notifDrop==='function')
    return notifDrop(x=>x.zk==='reorg'&&x.roId===recId);
  let n=0;
  for(const k in S.notifs){const x=S.notifs[k];
    if(x&&x.zk==='reorg'&&x.roId===recId){delete S.notifs[k];n++;}}
  return n;
}
/* Câu tiếng Việt hiện trong app cho MỘT người. Zalo dùng câu tiếng Anh
   riêng ở js/21-notify.js — hai chỗ, hai thứ tiếng, đúng quy ước sẵn có. */
function roPersonText(rec,pid){
  const d=fmtVN(rec.effFrom);
  if((rec.leavers||{})[pid]!==undefined)
    return '👋 '+t('Ngày làm việc cuối cùng của bạn')+': '+fmtVN(rec.leavers[pid]||rec.effFrom)
         +' — '+t('lịch sau ngày này đã được gỡ.');
  if((rec.pauses||{})[pid]){
    const p=rec.pauses[pid];
    return '🏥 '+t('Bạn nghỉ dài hạn từ')+' '+fmtVN(p.from||rec.effFrom)
         +' '+t('đến')+' '+fmtVN(p.to||rec.toIso)+' ('+(p.code||'NP')+')'
         +' — '+t('lịch những ngày này đã cập nhật.');
  }
  if((rec.joiners||{})[pid]){
    const j=rec.joiners[pid];
    return '🆕 '+t('Chào mừng! Lịch ca của bạn bắt đầu từ')+' '+fmtVN(j.from||rec.effFrom)
         +' · '+t('nhóm')+' '+(j.team||'—')+' · '+t('mẫu ca')+' '+roTypeLabel(j)+'.';
  }
  const nw=(rec.moves||{})[pid], od=(rec.prev||{})[pid];
  if(!nw)return '🔀 '+t('Lịch của bạn có thay đổi từ')+' '+d;
  const from=(od&&od.team)?od.team:'—';
  return '🔀 '+t('Từ')+' '+d+' '+t('bạn thuộc nhóm')+' '+(nw.team||'—')
       + (from&&from!==(nw.team||'')?(' ('+t('trước đây nhóm')+' '+from+')'):'')
       + ' · '+t('mẫu ca')+' '+roTypeLabel(nw)
       + ' — '+t('lịch từ ngày đó đã cập nhật, kiểm tra lại trang chính.');
}
function roSendNotifs(rec){
  roRevokeNotifs(rec.id);
  const by=meId()||'admin';
  const ids=[].concat(Object.keys(rec.moves||{}),Object.keys(rec.leavers||{}),
                      Object.keys(rec.joiners||{}),Object.keys(rec.pauses||{}));
  /* 1) Trong app: mỗi người một tin riêng, nội dung của riêng họ.
        nz:1 → không đẻ tin Zalo riêng (tin gộp ở bước 2 nói thay). */
  ids.forEach(pid=>{
    if(!empById(pid))return;
    newNotif({kind:'info',zk:'reorg',to:pid,from:by,roId:rec.id,
              iso:rec.effFrom,status:'sent',nz:1,text:roPersonText(rec,pid)});
  });
  /* 2) Zalo: ĐÚNG MỘT tin gộp, liệt kê cả đợt. Gửi tới chính người bấm —
        hiện mọi tin đều đổ vào cùng một chat nhóm (xem ZALO-BOT.md). */
  if(empById(by)){
    newNotif({kind:'info',zk:'reorg',to:by,from:by,roId:rec.id,iso:rec.effFrom,
      status:'sent',
      ro:{title:rec.title||'',effFrom:rec.effFrom,toIso:rec.toIso,
          moves:Object.keys(rec.moves||{}).map(pid=>({
            id:pid,team:(rec.moves[pid]||{}).team||'',
            old:((rec.prev||{})[pid]||{}).team||'',
            pat:roTypeLabel(rec.moves[pid])})),
          joiners:Object.keys(rec.joiners||{}).map(pid=>({
            id:pid,team:(rec.joiners[pid]||{}).team||'',from:(rec.joiners[pid]||{}).from||''})),
          pauses:Object.keys(rec.pauses||{}).map(pid=>({
            id:pid,from:(rec.pauses[pid]||{}).from||'',to:(rec.pauses[pid]||{}).to||'',
            code:(rec.pauses[pid]||{}).code||''})),
          leavers:Object.keys(rec.leavers||{}).map(pid=>({id:pid,last:rec.leavers[pid]||''}))},
      text:'🔀 '+t('Đã áp dụng thay đổi nhân sự từ')+' '+fmtVN(rec.effFrom)
           +' — '+ids.length+' '+t('người')});
  }
  return ids.length;
}

/* ============================================================
   MÀN KHAI — TRÌNH 3 BƯỚC
   ------------------------------------------------------------
   Bản trước dồn hết vào một trang dài: người dùng mở ra thấy một rừng ô,
   không biết bắt đầu từ đâu và không tìm ra chỗ chọn người nghỉ. Nay chia
   ba bước, mỗi bước hỏi ĐÚNG MỘT câu:

     Bước 1 — Chuyện gì xảy ra? (tích được nhiều loại, vì đời thật chúng
              đi cùng nhau: một người nghỉ việc kéo theo đổi cơ cấu)
     Bước 2 — Áp dụng từ ngày nào?
     Bước 3 — Khai chi tiết — chỉ hiện đúng những khối đã tích ở bước 1.

   Xem trước và nút Áp dụng nằm cố định ở chân màn.
   ============================================================ */
const RO_KINDS=[
  {v:'leave', ic:'👋', l:'Có người nghỉ việc',       hint:'Khai ngày làm việc cuối cùng, lịch sau ngày đó được gỡ'},
  {v:'struct',ic:'🔀', l:'Đổi cơ cấu nhóm',          hint:'4 nhóm A/B/C/D ↔ 2 nhóm DCS / Field, hoặc chuyển vài người sang nhóm khác'},
  {v:'join',  ic:'🆕', l:'Có người mới vào',         hint:'Xếp lịch từ ngày vào làm, không đụng lịch người khác'},
  {v:'pause', ic:'🏥', l:'Nghỉ dài hạn / quay lại',  hint:'Thai sản, ốm dài, biệt phái — phủ mã nghỉ lên khoảng ngày'}
];
function roKindInfo(v){return RO_KINDS.find(x=>x.v===v)||RO_KINDS[0];}

let roEditId='';
let roView='form';
let roStep=1;                 // 1 · 2 · 3
let roTitle='', roEff='', roTo='', roNotify=true;
let roKinds={struct:true};    // loại việc đang khai
let roPreset='2team';         // cơ cấu dựng sẵn đang chọn
let roLeavers={};             // {empId:lastDay}
let roJoiners={};             // {empId:{from,team,shiftType,pattern,a1}}
let roPauses={};              // {empId:{from,to,code}}
let roMoves={};               // {empId:{team,shiftType,pattern,a1}}
let roTeams=[];               // [{name,shiftType,pattern,a1}] — nhóm đích
let roRoleFilter='eng';       // 'eng' | 'oper' | 'all'
let roSearch='';
let roTick={};
let roBulkTeam='';
let roShowPv=false;

function roDefaultEff(){
  /* Mặc định: ngày đầu của kỳ công KẾ TIẾP. Đổi cơ cấu giữa kỳ vẫn làm
     được (chọn tay), nhưng đầu kỳ là mốc người ta hay dùng nhất. */
  return periodFor(schedYmShift(curSchedMonth(),1)).from;
}
function roNewDraft(){
  roEditId='';roTitle='';roNotify=true;roStep=1;
  roEff=roDefaultEff();
  roTo=periodFor(schedMonthOf(roEff)).to;
  roKinds={struct:true};roPreset='2team';
  roLeavers={};roJoiners={};roPauses={};roMoves={};roTeams=[];
  roTick={};roBulkTeam='';roShowPv=false;roSearch='';
}
/* `opt` = {preset, kinds:[…], step} — thanh Cơ cấu tổ mở thẳng vào đúng việc */
function openReorgMgr(view,opt){
  if(!hrGuard())return;
  roNewDraft();
  if(opt&&opt.preset)roPreset=opt.preset;
  if(opt&&opt.kinds){roKinds={};opt.kinds.forEach(k=>{roKinds[k]=true;});}
  if(opt&&opt.eff)roEff=opt.eff;
  if(opt&&opt.step)roStep=opt.step;
  if(opt&&opt.autofill&&roKinds.struct)roApplyPreset(roPreset,true);
  roView=(view==='list')?'list':'form';
  const m=$('roMask');if(!m)return;
  m.classList.add('on');
  renderReorgMgr();
}
function closeReorgMgr(){const m=$('roMask');if(m)m.classList.remove('on');}
function roSetView(v){roView=(v==='list')?'list':'form';renderReorgMgr();}
function roGoStep(n){
  const max=3;
  roStep=Math.max(1,Math.min(max,n));
  renderReorgMgr();
}
function roToggleKind(k){
  if(roKinds[k])delete roKinds[k];else roKinds[k]=true;
  renderReorgMgr();
}
function roKindOn(k){return !!roKinds[k];}
function roKindList(){return RO_KINDS.filter(x=>roKinds[x.v]).map(x=>x.v);}

/* ============================================================
   ÁP CƠ CẤU DỰNG SẴN
   ------------------------------------------------------------
   Chia người và đặt mốc so le TỰ ĐỘNG. Đây là thứ biến màn này từ "gõ tay
   mười mấy dòng" thành "bấm một nút rồi sửa chỗ nào không vừa ý".

   Mốc so le: trong cùng một nhóm mới, người thứ i nhận Mốc 1 lệch
   round(i × độ_dài_chu_kỳ / số_người_trong_nhóm) ngày. Hai nhóm DCS lệch
   nhau nửa chu kỳ chính là cách phủ kín ca ngày và ca đêm.
   ============================================================ */
function roEngineers(){return schedEmps().filter(e=>e.role==='eng'&&poolOf(e)==='prod'&&!roLeavers[e.id]);}
function roOperators(){return schedEmps().filter(e=>e.role==='oper'&&poolOf(e)==='prod'&&!roLeavers[e.id]);}
/* Nhóm đích của một kỹ sư trong cơ cấu 2 nhóm — suy từ VỊ TRÍ đã khai */
function roTwoTeamOf(e){
  const p=(typeof posCode==='function')?posCode(e):'';
  if(p==='boardman'||p==='check_booth')return 'DCS';
  if(p==='field_eng'||p==='operator')return 'Field';
  return '';
}
/* ---------- nhóm đích: đọc / sửa ---------- */
function roTeamByName(nm){return roTeams.find(x=>x.name===String(nm||'').trim())||null;}
function roTeamNames(){return roTeams.map(x=>x.name);}
/* Ai đang được xếp vào nhóm này (theo thứ tự bảng, để rải mốc ổn định) */
function roTeamMembers(nm){
  return schedEmps().filter(e=>!roLeavers[e.id]&&(roMoves[e.id]||{}).team===nm);
}
function roAddTeam(){
  const nm=prompt(t('Tên nhóm đích mới (VD: DCS, Field, A…)'),'');
  const k=String(nm||'').trim();
  if(!k)return;
  if(roTeamByName(k)){toast(t('Nhóm này đã có'));return;}
  roTeams.push({name:k,shiftType:'type2',pattern:'',a1:roEff});
  roPreset='custom';renderReorgMgr();
}
function roDelTeam(i){
  const tm=roTeams[i];if(!tm)return;
  const mem=roTeamMembers(tm.name);
  if(mem.length&&!confirm(t('Nhóm này đang có')+' '+mem.length+' '+t('người — xoá nhóm sẽ gỡ họ khỏi cơ cấu mới. Tiếp tục?')))return;
  mem.forEach(e=>{delete roMoves[e.id];});
  roTeams.splice(i,1);roPreset='custom';renderReorgMgr();
}
/* Sửa một thuộc tính của nhóm đích → mọi người trong nhóm ăn theo ngay.
   Đây là điểm mấu chốt: khai MỘT lần cho cả nhóm thay vì sửa từng dòng. */
function roSetTeam(i,k,v){
  const tm=roTeams[i];if(!tm)return;
  const old=tm.name;
  tm[k]=(k==='name')?String(v||'').trim():v;
  if(k==='name'&&tm.name&&tm.name!==old)
    roTeamMembers(old).forEach(e=>{roMoves[e.id].team=tm.name;});
  roPreset='custom';
  roRestagger();
  renderReorgMgr();
}
/* Rải lại mốc so le cho TẤT CẢ nhóm đích.
   Trong một nhóm, người thứ i lệch round(i × độ_dài_chu_kỳ / số_người) ngày —
   đó là cách phủ đều các pha của chu kỳ. Nhóm nào cũng neo từ mốc gốc của
   chính nó, nên hai nhóm chạy lệch nhau đúng như người dùng khai. */
function roRestagger(){
  roTeams.forEach(tm=>{
    const mem=roTeamMembers(tm.name);
    const len=roCycleLen(tm);
    mem.forEach((e,i)=>{
      const m=roMoves[e.id];
      if(m.own)return;               /* dòng người dùng đã tự sửa — không đè */
      m.shiftType=tm.shiftType;m.pattern=tm.pattern||'';
      m.a1=len?addDaysIso(tm.a1||roEff,Math.round(i*len/Math.max(1,mem.length))):(tm.a1||roEff);
    });
  });
}
/* Xếp một người vào một nhóm đích (hoặc bỏ khỏi cơ cấu mới nếu nm rỗng) */
function roAssignTeam(id,nm){
  const k=String(nm||'').trim();
  if(!k){delete roMoves[id];roRestagger();renderReorgMgr();return;}
  let tm=roTeamByName(k);
  if(!tm){tm={name:k,shiftType:'type2',pattern:'',a1:roEff};roTeams.push(tm);}
  roMoves[id]={team:tm.name,shiftType:tm.shiftType,pattern:tm.pattern||'',a1:tm.a1||roEff};
  roPreset='custom';
  roRestagger();
  renderReorgMgr();
}
/* Ô chọn nhóm ở từng dòng người — DROPDOWN, không phải ô gõ tay.
   Ô gõ tay + datalist bị trình duyệt bung gợi ý che mất dòng dưới, và gõ sai
   một ký tự là đẻ ra một nhóm mới không ai để ý. */
function roTeamSelect(e){
  const cur=(roMoves[e.id]||{}).team||'';
  const names=roTeamNames().slice();
  if(cur&&!names.includes(cur))names.push(cur);
  return `<select class="inp sm" style="min-width:104px" onchange="roAssignTeam('${e.id}',this.value==='__new'?(prompt('${t('Tên nhóm mới')}')||''):this.value)">
    <option value=""${cur?'':' selected'}>— ${t('giữ nguyên')} —</option>
    ${names.map(n=>`<option value="${esc(n)}"${cur===n?' selected':''}>${esc(n)}</option>`).join('')}
    <option value="__new">✎ ${t('Nhóm khác…')}</option>
  </select>`;
}

/* ---------- áp cơ cấu dựng sẵn ---------- */
function roApplyPreset(v,silent){
  roPreset=v;
  if(v==='custom'){if(!silent)renderReorgMgr();return;}
  roMoves={};
  roTeams=(RO_PRESET_TEAMS[v]||[]).map(x=>Object.assign({a1:roEff},x));
  const eng=roEngineers();
  if(v==='2team'){
    const dcs=eng.filter(e=>roTwoTeamOf(e)==='DCS');
    const fld=eng.filter(e=>roTwoTeamOf(e)==='Field');
    const rest=eng.filter(e=>!roTwoTeamOf(e));
    /* Người chưa khai vị trí thì chia luân phiên cho hai nhóm khỏi lệch */
    rest.forEach((e,i)=>((i%2)?fld:dcs).push(e));
    /* Cả tổ khai cùng một vị trí (hay chưa ai khai) thì phép chia theo vị trí
       đẻ ra MỘT nhóm rỗng — cơ cấu "2 nhóm" mà chỉ có một nhóm là vô nghĩa.
       Chia đôi đều rồi để người dùng kéo lại vài dòng cho đúng người. */
    if(!dcs.length||!fld.length){
      const all=dcs.concat(fld);
      dcs.length=0;fld.length=0;
      all.forEach((e,i)=>(i<Math.ceil(all.length/2)?dcs:fld).push(e));
    }
    dcs.forEach(e=>{roMoves[e.id]={team:'DCS',shiftType:'type1',pattern:'',a1:roEff};});
    fld.forEach(e=>{roMoves[e.id]={team:'Field',shiftType:'type2',pattern:'',a1:roEff};});
    /* Nhóm Field neo lệch NỬA chu kỳ so với DCS — hai nhóm phủ kín ngày/đêm */
    const f=roTeamByName('Field');
    if(f)f.a1=addDaysIso(roEff,Math.floor(roCycleLen(f)/2));
  }else if(v==='4team'){
    const names=['A','B','C','D'];
    eng.forEach((e,i)=>{
      const nm=names[i%4];
      roMoves[e.id]={team:nm,shiftType:'type1',pattern:'',a1:roEff};
    });
    /* Bốn nhóm ca 8 ngày lệch nhau 2 ngày — đúng cơ cấu cũ của tổ */
    roTeams.forEach((tm,k)=>{tm.a1=addDaysIso(roEff,k*2);});
  }
  roRestagger();
  if(!silent){
    toast(t('Đã chia')+' '+Object.keys(roMoves).length+' '+t('kỹ sư theo cơ cấu')+' '+t(roPresetInfo(v).l));
    renderReorgMgr();
  }
}

/* ---- người nghỉ việc ---- */
function roToggleLeaver(id){
  if(roLeavers[id])delete roLeavers[id];
  else{
    roLeavers[id]=addDaysIso(roEff,-1);
    delete roMoves[id];delete roTick[id];delete roJoiners[id];delete roPauses[id];
  }
  /* Người nghỉ việc rời khỏi phép chia → mốc so le của cả nhóm phải tính lại.
     Đang dùng cơ cấu dựng sẵn thì chia lại từ đầu; đã sửa tay thì chỉ rải
     lại mốc, giữ nguyên ai ở nhóm nào (không tự ý xáo bảng của người dùng). */
  if(roPreset!=='custom')roApplyPreset(roPreset,true);
  else roRestagger();
  renderReorgMgr();
}
function roSetLastDay(id,v){roLeavers[id]=v;renderReorgMgr();}

/* ---- người mới vào ---- */
function roToggleJoiner(id){
  if(roJoiners[id])delete roJoiners[id];
  else{
    const e=empById(id)||{};
    roJoiners[id]={from:e.joinAt||roEff,team:e.team||'',
                   shiftType:e.shiftType||'office6',pattern:e.pattern||'',a1:e.a1||roEff};
    delete roLeavers[id];
  }
  renderReorgMgr();
}
function roSetJoiner(id,k,v){
  const j=Object.assign({},roJoiners[id]||{});
  j[k]=(k==='team')?String(v||'').trim():v;
  roJoiners[id]=j;renderReorgMgr();
}
/* ---- nghỉ dài hạn ---- */
function roTogglePause(id){
  if(roPauses[id])delete roPauses[id];
  else{
    roPauses[id]={from:roEff,to:periodFor(schedYmShift(schedMonthOf(roEff),2)).to,code:'NP'};
    delete roLeavers[id];
  }
  renderReorgMgr();
}
function roSetPause(id,k,v){
  const p=Object.assign({},roPauses[id]||{});
  p[k]=v;roPauses[id]=p;renderReorgMgr();
}
/* Mã dùng cho nghỉ dài hạn — lấy từ bảng mã, chỉ những mã loại 'leave' */
function roPauseCodes(){
  const all=(typeof allCodes==='function')?allCodes():[];
  return all.filter(c=>c.cat==='leave'&&!c.legacy);
}

/* ---- khai nhóm mới cho từng người ---- */
function roMoveOf(id){
  if(roMoves[id])return roMoves[id];
  const e=empById(id)||{};
  return roSnapEmp(e);
}
function roSetMove(id,k,v){
  const cur=Object.assign({},roMoveOf(id));
  cur[k]=(k==='team')?String(v||'').trim():v;
  cur.own=1;            /* dòng này người dùng tự đặt → roRestagger() bỏ qua */
  roMoves[id]=cur;
  roPreset='custom';                 // đã sửa tay thì không còn là mẫu dựng sẵn
  renderReorgMgr();
}
function roClearMove(id){delete roMoves[id];roRestagger();renderReorgMgr();}
function roToggleTick(id){if(roTick[id])delete roTick[id];else roTick[id]=true;renderReorgMgr();}
function roTickAll(on){
  roTick={};
  if(on)roRosterRows().forEach(e=>{roTick[e.id]=true;});
  renderReorgMgr();
}
/* Ba nút gán hàng loạt cũ nay gộp vào ô "xếp vào nhóm…" + "Rải lại mốc so le"
   ở thanh ro-bulk. Giữ lại roBulkTeam để bản nháp cũ không vỡ. */

/* Danh sách người hiện trong bảng khai nhóm */
function roRosterRows(){
  const q=noAccent(roSearch);
  return schedEmps().filter(e=>{
    if(roLeavers[e.id]||roJoiners[e.id])return false;
    if(roRoleFilter==='eng'&&e.role!=='eng')return false;
    if(roRoleFilter==='oper'&&e.role!=='oper')return false;
    if(q&&!(noAccent(e.name).includes(q)||noAccent(e.id).includes(q)))return false;
    return true;
  });
}
function roEffectiveMoves(){
  const out={};
  if(!roKindOn('struct'))return out;
  Object.keys(roMoves).forEach(id=>{
    const e=empById(id);if(!e)return;
    if(roLeavers[id]||roJoiners[id])return;
    if(roMoveChanged(roSnapEmp(e),roMoves[id]))out[id]=roMoves[id];
  });
  return out;
}
function roPart(k,obj){return roKindOn(k)?Object.assign({},obj):{};}
function roDraftRec(){
  return {id:roEditId||'__draft',title:roTitle,effFrom:roEff,toIso:roTo,
          leavers:roPart('leave',roLeavers),joiners:roPart('join',roJoiners),
          pauses:roPart('pause',roPauses),moves:roEffectiveMoves(),
          prev:{},notify:roNotify,status:'draft'};
}
function roCounts(){
  const d=roDraftRec();
  return {mv:Object.keys(d.moves).length,lv:Object.keys(d.leavers).length,
          jn:Object.keys(d.joiners).length,ps:Object.keys(d.pauses).length};
}

/* ---- lưu / áp dụng ---- */
function roValidate(){
  if(!roKindList().length)return t('Chưa chọn loại thay đổi ở Bước 1');
  if(!roEff||!/^\d{4}-\d{2}-\d{2}$/.test(roEff))return t('Chưa chọn ngày áp dụng');
  if(!roTo||roTo<roEff)return t('Ngày điền lịch tới phải sau ngày áp dụng');
  const c=roCounts();
  if(!c.mv&&!c.lv&&!c.jn&&!c.ps)
    return t('Chưa khai gì ở Bước 3 — chọn người hoặc bấm một cơ cấu dựng sẵn');
  const d=roDraftRec();
  for(const id in d.moves){
    const m=d.moves[id];
    if(m.shiftType==='custom'&&!shiftPatternOk(m.pattern))
      return (empById(id)||{}).name+': '+t('mẫu ca chưa hợp lệ');
    if(m.shiftType!=='admin'&&m.shiftType!=='office6'&&m.shiftType!=='none'
       &&!(m.a1||(empById(id)||{}).a1))
      return (empById(id)||{}).name+': '+t('thiếu Mốc 1');
  }
  for(const id in d.joiners){
    const j=d.joiners[id];
    if(!j.from)return (empById(id)||{}).name+': '+t('thiếu ngày vào làm');
    if(j.shiftType==='custom'&&!shiftPatternOk(j.pattern))
      return (empById(id)||{}).name+': '+t('mẫu ca chưa hợp lệ');
  }
  for(const id in d.pauses){
    const p=d.pauses[id];
    if(!p.from||!p.to||p.to<p.from)return (empById(id)||{}).name+': '+t('khoảng nghỉ không hợp lệ');
  }
  return '';
}
function roAutoTitle(){
  const c=roCounts(),bits=[];
  if(c.mv)bits.push(t(roPresetInfo(roPreset).l));
  if(c.lv)bits.push(c.lv+' '+t('người nghỉ việc'));
  if(c.jn)bits.push(c.jn+' '+t('người mới vào'));
  if(c.ps)bits.push(c.ps+' '+t('người nghỉ dài hạn'));
  return bits.join(' · ')||t('Biến động nhân sự');
}
function roSaveDraft(silent){
  if(!hrGuard())return '';
  const err=roValidate();
  if(err){if(!silent)toast(err);return '';}
  const id=roEditId||uid();
  const old=roById(id);
  const d=roDraftRec();
  S.reorgs=S.reorgs||{};
  S.reorgs[id]=Object.assign({},old||{},{
    id,title:String(roTitle||'').trim()||roAutoTitle(),
    effFrom:roEff,toIso:roTo,preset:roPreset,kinds:roKindList(),
    teams:roTeams.map(x=>Object.assign({},x)),   /* để mở lại sửa được */
    leavers:d.leavers,joiners:d.joiners,pauses:d.pauses,moves:d.moves,
    notify:!!roNotify,
    status:(old&&old.status==='applied')?'applied':'draft',
    by:(old&&old.by)||meId()||'admin',at:(old&&old.at)||Date.now(),
    editBy:meId()||'admin',editAt:Date.now()
  });
  roEditId=id;save();
  if(!silent)toast(t('Đã lưu bản nháp'));
  return id;
}
function roApplyNow(){
  const err=roValidate();
  if(err){toast(err);return;}
  const pv=roPreview(roDraftRec());
  const c=roCounts();
  const cells=pv.rows.reduce((s,r)=>s+r.n,0);
  const bits=[];
  if(c.mv)bits.push(c.mv+' '+t('người đổi nhóm'));
  if(c.lv)bits.push(c.lv+' '+t('người nghỉ việc'));
  if(c.jn)bits.push(c.jn+' '+t('người mới vào'));
  if(c.ps)bits.push(c.ps+' '+t('người nghỉ dài hạn'));
  if(!confirm(t('Áp dụng từ')+' '+fmtVNfull(roEff)+'?\n'
    +bits.join(' · ')+' · '+cells+' '+t('ô ca sẽ được điền lại')+'.\n'
    +t('Lịch TRƯỚC ngày này không bị chạm tới. Có thể Hoàn tác sau.')))return;
  const id=roSaveDraft(true);
  if(!id)return;
  const res=roApply(id);
  if(!res)return;
  roView='list';renderReorgMgr();
  toast(t('Đã áp dụng')+' — '+res.people+' '+t('người')+' · '+res.cells+' '+t('ô ca')
        +(roNotify?(' · '+t('đã gửi thông báo')):''));
}
function roEdit(id){
  const r=roById(id);if(!r)return;
  roEditId=id;roView='form';roStep=3;
  roTitle=r.title||'';roEff=r.effFrom||roDefaultEff();
  roTo=r.toIso||periodFor(schedMonthOf(roEff)).to;
  roKinds={};(r.kinds||['struct']).forEach(k=>{roKinds[k]=true;});
  roPreset=r.preset||'custom';
  roTeams=(r.teams||[]).map(x=>Object.assign({},x));
  roLeavers=Object.assign({},r.leavers||{});
  roJoiners=Object.assign({},r.joiners||{});
  roPauses=Object.assign({},r.pauses||{});
  roMoves=Object.assign({},r.moves||{});
  roNotify=r.notify!==false;roTick={};roShowPv=false;
  /* Bản ghi cũ (trước v9.0) chưa có bảng nhóm đích — dựng lại từ chính các
     dòng moves để màn hình không hiện "chưa có nhóm đích nào". */
  if(!roTeams.length){
    Object.values(roMoves).forEach(m=>{
      if(m.team&&!roTeamByName(m.team))
        roTeams.push({name:m.team,shiftType:m.shiftType||'type2',pattern:m.pattern||'',a1:m.a1||roEff});
    });
  }
  renderReorgMgr();
}

/* ============================================================
   GIAO DIỆN
   ============================================================ */
function roSetField(k,v){
  if(k==='eff'){
    const old=roEff;
    roEff=v;
    if(!roTo||roTo<roEff)roTo=periodFor(schedMonthOf(roEff)).to;
    Object.keys(roLeavers).forEach(id=>{
      if(!roLeavers[id]||roLeavers[id]>=roEff)roLeavers[id]=addDaysIso(roEff,-1);
    });
    /* Mốc đổi thì mốc gốc của các nhóm đích chạy theo. Nhóm nào người dùng
       đã tự đặt mốc riêng thì giữ nguyên — chỉ kéo những nhóm còn neo ở mốc cũ. */
    if(roPreset!=='custom'&&Object.keys(roMoves).length)roApplyPreset(roPreset,true);
    else{roTeams.forEach(tm=>{if(!tm.a1||tm.a1===old)tm.a1=roEff;});roRestagger();}
  }
  else if(k==='to')roTo=v;
  else if(k==='role')roRoleFilter=v;
  else if(k==='bulk'){roBulkTeam=v;return;}   // gõ tên nhóm thì đừng vẽ lại, mất con trỏ
  renderReorgMgr();
}
function roTogglePv(){roShowPv=!roShowPv;renderReorgMgr();}
function roToPeriods(n){
  roTo=periodFor(schedYmShift(schedMonthOf(roEff),n-1)).to;
  renderReorgMgr();
}

function renderReorgMgr(){
  const box=$('roBody');if(!box)return;
  const snap=(typeof uiSnap==='function')?uiSnap('roBody',['.ro-tbl-wrap','.ro-list','.ro-pick']):null;
  const head=`
  <h3>🔀 ${t('Biến động nhân sự & cơ cấu nhóm')}</h3>
  <div class="ev-tabs">
    <button class="evtab${roView==='form'?' on':''}" onclick="roSetView('form')">✏️ ${t('Khai đợt mới')}</button>
    <button class="evtab${roView==='list'?' on':''}" onclick="roSetView('list')">📋 ${t('Các đợt đã ghi')}<i class="cnt">${roAll().length}</i></button>
  </div>`;
  if(roView==='list'){
    box.innerHTML=head+roListHtml()+`
    <div class="row" style="gap:8px;margin-top:10px">
      <button class="btn sec" style="flex:1" onclick="roNewDraft();roSetView('form')">➕ ${t('Khai đợt mới')}</button>
      <button class="btn sec" onclick="closeReorgMgr()">${t('Đóng')}</button>
    </div>`;
    if(typeof uiRestore==='function')uiRestore(snap);
    return;
  }
  box.innerHTML=head+roWizardHtml();
  if(typeof uiRestore==='function')uiRestore(snap);
}

/* ---- dải 3 bước ---- */
function roStepsHtml(){
  const c=roCounts();
  const lbl=[
    t('Chuyện gì xảy ra?'),
    t('Áp dụng từ ngày nào?'),
    t('Khai chi tiết')
  ];
  const done=[roKindList().length>0, !!roEff&&!!roTo&&roTo>=roEff, (c.mv+c.lv+c.jn+c.ps)>0];
  return `<div class="ro-steps">${lbl.map((x,i)=>`
    <button class="rost${roStep===i+1?' on':''}${done[i]?' ok':''}" onclick="roGoStep(${i+1})">
      <b>${i+1}</b><span>${esc(x)}</span></button>`).join('')}</div>`;
}
function roWizardHtml(){
  const err=roValidate();
  const c=roCounts();
  const sum=[];
  if(c.mv)sum.push(`<span class="rosum mv">🔀 ${c.mv} ${t('đổi nhóm')}</span>`);
  if(c.lv)sum.push(`<span class="rosum lv">👋 ${c.lv} ${t('nghỉ việc')}</span>`);
  if(c.jn)sum.push(`<span class="rosum jn">🆕 ${c.jn} ${t('mới vào')}</span>`);
  if(c.ps)sum.push(`<span class="rosum ps">🏥 ${c.ps} ${t('nghỉ dài hạn')}</span>`);

  let body='';
  if(roStep===1)body=roStep1Html();
  else if(roStep===2)body=roStep2Html();
  else body=roStep3Html();

  return roStepsHtml()+body+`
  <div class="ro-foot">
    <div class="ro-sum">${sum.join('')||`<span class="muted sm2">${t('chưa khai gì')}</span>`}</div>
    ${err?`<div class="pv-alert warn sm">${esc(err)}</div>`:''}
    <div class="row" style="gap:8px">
      ${roStep>1?`<button class="btn sec" onclick="roGoStep(${roStep-1})">◀ ${t('Quay lại')}</button>`:''}
      ${roStep<3?`<button class="btn ok" style="flex:1" onclick="roGoStep(${roStep+1})">${t('Tiếp')} ▶</button>`
        :`<button class="btn ok" style="flex:1" onclick="roApplyNow()" ${err?'disabled':''}>✅ ${t('Áp dụng & gửi thông báo')}</button>
          <button class="btn sec" onclick="roSaveDraft()">💾 ${t('Lưu nháp')}</button>`}
      <button class="btn sec" onclick="closeReorgMgr()">${t('Đóng')}</button>
    </div>
  </div>`;
}

/* ---- Bước 1: chuyện gì xảy ra ---- */
function roStep1Html(){
  return `
  <p class="muted sm2">${t('Tích tất cả những việc đang xảy ra — chúng dùng chung một ngày áp dụng. Người nghỉ việc thường kéo theo đổi cơ cấu, khai một lần là xong cả hai.')}</p>
  <div class="ro-kinds">
    ${RO_KINDS.map(k=>`<button type="button" class="rok${roKinds[k.v]?' on':''}" onclick="roToggleKind('${k.v}')">
      <span class="ic">${k.ic}</span>
      <span class="tx"><b>${t(k.l)}</b><i>${t(k.hint)}</i></span>
      <span class="ck">${roKinds[k.v]?'✓':''}</span></button>`).join('')}
  </div>`;
}

/* ---- Bước 2: mốc áp dụng ---- */
function roStep2Html(){
  const nDay=roDayList(roEff,roTo).length;
  return `
  <p class="muted sm2">${t('Mọi thay đổi có hiệu lực TỪ ngày này. Lịch những ngày TRƯỚC đó giữ nguyên — bảng lịch cả kỳ vẫn là một bảng liền, có vạch chuyển ở giữa.')}</p>
  <div class="ro-dates">
    <div class="fg"><label class="fl">${t('Áp dụng từ ngày')}</label>
      <input type="date" class="inp" value="${esc(roEff)}" onchange="roSetField('eff',this.value)"></div>
    <div class="fg"><label class="fl">${t('Điền lịch mới tới ngày')}</label>
      <input type="date" class="inp" value="${esc(roTo)}" onchange="roSetField('to',this.value)"></div>
  </div>
  <div class="ro-quick">
    <span class="muted sm2">${t('Nhanh')}:</span>
    <button class="btn sec sm" onclick="roToPeriods(1)">${t('hết kỳ này')}</button>
    <button class="btn sec sm" onclick="roToPeriods(2)">${t('2 kỳ')}</button>
    <button class="btn sec sm" onclick="roToPeriods(3)">${t('3 kỳ')}</button>
    <span style="flex:1"></span>
    <button class="btn sec sm" onclick="roSetField('eff',periodFor(schedYmShift(curSchedMonth(),1)).from)">${t('đầu kỳ sau')}</button>
    <button class="btn sec sm" onclick="roSetField('eff',todayIso())">${t('hôm nay')}</button>
  </div>
  <div class="pv-alert info sm">${t('Điền lại lịch từ')} <b>${esc(fmtVNfull(roEff))}</b>
    ${t('đến')} <b>${esc(fmtVNfull(roTo))}</b> — ${nDay} ${t('ngày')}.</div>
  <div class="fg"><label class="fl">${t('Tên đợt (để tra lại sau — bỏ trống thì phần mềm tự đặt)')}</label>
    <input class="inp" value="${esc(roTitle)}" placeholder="${esc(roAutoTitle())}" oninput="roTitle=this.value"></div>`;
}

/* ---- Bước 3: khai chi tiết, chỉ hiện khối đã tích ---- */
function roStep3Html(){
  let h='';
  if(roKindOn('leave'))h+=roLeaveBlock();
  if(roKindOn('struct'))h+=roStructBlock();
  if(roKindOn('join'))h+=roJoinBlock();
  if(roKindOn('pause'))h+=roPauseBlock();
  h+=`
  <div class="ro-pvbar">
    <button class="btn sec sm" onclick="roTogglePv()">${roShowPv?'▾ '+t('Ẩn xem trước'):'▸ '+t('Xem trước lịch sẽ đổi')}</button>
    <label class="cal-chk"><input type="checkbox" ${roNotify?'checked':''}
      onchange="roNotify=this.checked;renderReorgMgr()"> ${t('Gửi thông báo cho từng người')}</label>
  </div>
  ${roShowPv?roPreviewHtml():''}`;
  return h;
}

/* --- khối NGƯỜI NGHỈ VIỆC --- */
function roLeaveBlock(){
  const n=Object.keys(roLeavers).length;
  return `
  <h4 class="ro-h">👋 ${t('Người nghỉ việc')} ${n?`<span class="ro-badge">${n}</span>`:''}</h4>
  <p class="muted sm2">${t('Bấm vào tên người sẽ nghỉ, rồi chỉnh ngày làm việc cuối cùng. Lịch sau ngày đó được gỡ; dữ liệu các kỳ trước giữ nguyên để còn tra bảng công.')}</p>
  <div class="ro-pick">
    ${schedEmps().map(e=>{
      const on=!!roLeavers[e.id];
      return `<div class="ropk${on?' on':''}">
        <button type="button" class="nm" onclick="roToggleLeaver('${e.id}')">
          <span class="ck">${on?'✓':''}</span>
          <b>${esc(e.name||e.id)}</b>
          <i>${esc(e.team?t('Nhóm')+' '+e.team:'')}${e.role==='eng'?' · '+t('Kỹ sư'):''}</i></button>
        ${on?`<label class="fl2">${t('Ngày cuối')}
          <input type="date" class="inp sm" value="${esc(roLeavers[e.id]||'')}"
            onchange="roSetLastDay('${e.id}',this.value)"></label>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

/* --- khối ĐỔI CƠ CẤU ---
   Hai phần rõ ràng: KHAI NHÓM ĐÍCH (mỗi nhóm một mẫu ca riêng) rồi XẾP
   NGƯỜI vào nhóm. Trước đây gộp làm một bảng nên muốn cho DCS chạy 8 ngày
   còn Field chạy 6 ngày thì phải sửa tay từng dòng — đúng thứ người dùng
   kêu là không làm được. */
function roStructBlock(){
  const rows=roRosterRows();
  const n=Object.keys(roEffectiveMoves()).length;
  const allTicked=rows.length&&rows.every(e=>roTick[e.id]);
  const noLeaveYet=!roKindOn('leave');
  return `
  <h4 class="ro-h">🔀 ${t('Cơ cấu nhóm')} ${n?`<span class="ro-badge">${n}</span>`:''}</h4>
  ${noLeaveYet?`<div class="ro-tip">${t('Đợt này có ai nghỉ việc không? Tích trước rồi phần mềm mới chia lại đúng số người còn lại.')}
    <button class="btn sec sm" onclick="roToggleKind('leave')">👋 ${t('Thêm người nghỉ việc')}</button></div>`:''}
  <p class="muted sm2">${t('Bấm một cơ cấu dựng sẵn để chia nhanh, hoặc tự khai nhóm đích bên dưới. Mỗi nhóm có mẫu ca RIÊNG.')}</p>
  <div class="ro-presets">
    ${RO_PRESETS.map(p=>`<button type="button" class="rop${roPreset===p.v?' on':''}"
      onclick="roApplyPreset('${p.v}')">
      <span class="ic">${p.ic}</span>
      <span class="tx"><b>${t(p.l)}</b><i>${t(p.hint)}</i></span></button>`).join('')}
  </div>

  <div class="ro-sub">① ${t('Nhóm đích — mỗi nhóm một mẫu ca')}</div>
  ${roTeamsHtml()}

  <div class="ro-sub">② ${t('Xếp người vào nhóm')}</div>
  <div class="ro-flt">
    <div class="seg sm">
      <button class="${roRoleFilter==='eng'?'on':''}" onclick="roSetField('role','eng')">${t('Kỹ sư')}</button>
      <button class="${roRoleFilter==='oper'?'on':''}" onclick="roSetField('role','oper')">${t('Operator')}</button>
      <button class="${roRoleFilter==='all'?'on':''}" onclick="roSetField('role','all')">${t('Tất cả')}</button>
    </div>
    <input class="inp sm" id="roSearchBox" value="${esc(roSearch)}" placeholder="${t('Tìm tên…')}"
      oninput="roSearch=this.value;roRefreshTbl()">
  </div>
  <div class="ro-bulk">
    <label class="cal-chk"><input type="checkbox" ${allTicked?'checked':''} onchange="roTickAll(this.checked)"> ${t('Chọn tất cả')}</label>
    <span class="muted sm2">${t('Người đã tích')} →</span>
    <select class="inp sm" onchange="roBulkTo(this.value);this.value=''">
      <option value="">${t('xếp vào nhóm…')}</option>
      ${roTeamNames().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}
    </select>
    <button class="btn sec sm" onclick="roRestagger();renderReorgMgr()">${t('Rải lại mốc so le')}</button>
  </div>
  <div class="ro-tbl-wrap">${roTableHtml(rows)}</div>`;
}
/* Bảng nhóm đích */
function roTeamsHtml(){
  if(!roTeams.length)
    return `<div class="ro-teams empty"><p class="muted sm2">${t('Chưa có nhóm đích nào — bấm một cơ cấu dựng sẵn ở trên, hoặc thêm nhóm bằng tay.')}</p>
      <button class="btn sec sm" onclick="roAddTeam()">➕ ${t('Thêm nhóm')}</button></div>`;
  return `<div class="ro-teams">
    <table class="ro-ttbl"><thead><tr>
      <th>${t('Nhóm')}</th><th>${t('Mẫu ca của nhóm')}</th><th>${t('Mốc gốc')}</th>
      <th class="ct">${t('Số người')}</th><th></th></tr></thead><tbody>
    ${roTeams.map((tm,i)=>{
      const mem=roTeamMembers(tm.name);
      const len=roCycleLen(tm);
      return `<tr>
        <td><input class="inp sm" style="width:96px;font-weight:700" value="${esc(tm.name)}"
              onchange="roSetTeam(${i},'name',this.value)"></td>
        <td>${roTypeSelect(tm,`roSetTeam(${i},'shiftType',this.value)`)}
            ${tm.shiftType==='custom'?`<input class="inp sm pat${shiftPatternOk(tm.pattern)?'':' bad'}"
              style="margin-top:4px;width:100%;font-family:var(--mono)" value="${esc(tm.pattern||'')}"
              placeholder="D D N N R R" onchange="roSetTeam(${i},'pattern',this.value)">`:''}
            ${len?`<i class="nt">${t('chu kỳ')} ${len} ${t('ngày')}${mem.length>1?(' · '+t('lệch')+' '+Math.round(len/mem.length)+' '+t('ngày/người')):''}</i>`:''}</td>
        <td><input type="date" class="inp sm" value="${esc(tm.a1||'')}"
              title="${t('Ngày bắt đầu chu kỳ của nhóm này')}" onchange="roSetTeam(${i},'a1',this.value)"></td>
        <td class="ct"><b>${mem.length}</b></td>
        <td class="nw"><button class="btn warn sm ico" onclick="roDelTeam(${i})" title="${t('Xoá nhóm đích')}">✕</button></td>
      </tr>`;
    }).join('')}
    </tbody></table>
    <button class="btn sec sm" onclick="roAddTeam()">➕ ${t('Thêm nhóm')}</button>
  </div>`;
}
/* Xếp mọi người đang tích vào một nhóm */
function roBulkTo(nm){
  const ids=Object.keys(roTick);
  if(!nm)return;
  if(!ids.length){toast(t('Chưa tích ai'));return;}
  ids.forEach(id=>{
    const tm=roTeamByName(nm);
    roMoves[id]={team:nm,shiftType:tm?tm.shiftType:'type2',pattern:tm?(tm.pattern||''):'',a1:tm?tm.a1:roEff};
  });
  roPreset='custom';roRestagger();
  toast(t('Đã xếp')+' '+ids.length+' '+t('người vào nhóm')+' '+nm);
  renderReorgMgr();
}

/* --- khối NGƯỜI MỚI VÀO --- */
function roJoinBlock(){
  const n=Object.keys(roJoiners).length;
  /* Người "mới" = chưa có ô lịch nào, hoặc có joinAt trong tương lai gần.
     Vẫn cho chọn cả tổ, vì có người được thêm vào danh sách từ lâu mà giờ
     mới đi làm. */
  return `
  <h4 class="ro-h">🆕 ${t('Người mới vào')} ${n?`<span class="ro-badge">${n}</span>`:''}</h4>
  <p class="muted sm2">${t('Thêm người vào danh sách nhân sự bên dưới trước (nút ＋ Người), rồi chọn tên ở đây để xếp lịch từ ngày vào làm. Không đụng lịch của ai khác.')}</p>
  <div class="ro-pick">
    ${schedEmps().filter(e=>!roLeavers[e.id]).map(e=>{
      const on=!!roJoiners[e.id];
      const j=roJoiners[e.id]||{};
      const nCell=Object.keys(S.base[e.id]||{}).length;
      return `<div class="ropk${on?' on':''}">
        <button type="button" class="nm" onclick="roToggleJoiner('${e.id}')">
          <span class="ck">${on?'✓':''}</span>
          <b>${esc(e.name||e.id)}</b>
          <i>${nCell?(nCell+' '+t('ô lịch đã có')):('<b class="new">'+t('chưa có lịch')+'</b>')}</i></button>
        ${on?`<span class="jn-f">
          <label class="fl2">${t('Vào làm từ')}<input type="date" class="inp sm" value="${esc(j.from||'')}"
            onchange="roSetJoiner('${e.id}','from',this.value)"></label>
          <label class="fl2">${t('Nhóm')}<input class="inp sm" style="width:80px" value="${esc(j.team||'')}"
            list="roTeamList" onchange="roSetJoiner('${e.id}','team',this.value)"></label>
          <label class="fl2">${t('Kiểu ca')}${roTypeSelect(j,`roSetJoiner('${e.id}','shiftType',this.value)`)}</label>
          ${j.shiftType==='custom'?`<input class="inp sm pat${shiftPatternOk(j.pattern)?'':' bad'}"
             style="width:120px;font-family:var(--mono)" value="${esc(j.pattern||'')}" placeholder="D D N N R R"
             onchange="roSetJoiner('${e.id}','pattern',this.value)">`:''}
          <label class="fl2">${t('Mốc 1')}<input type="date" class="inp sm" value="${esc(j.a1||'')}"
            onchange="roSetJoiner('${e.id}','a1',this.value)"></label></span>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

/* --- khối NGHỈ DÀI HẠN --- */
function roPauseBlock(){
  const n=Object.keys(roPauses).length;
  const codes=roPauseCodes();
  return `
  <h4 class="ro-h">🏥 ${t('Nghỉ dài hạn')} ${n?`<span class="ro-badge">${n}</span>`:''}</h4>
  <p class="muted sm2">${t('Thai sản, ốm dài, biệt phái… Người này VẪN thuộc nhóm cũ — hết hạn nghỉ là lịch chuẩn của nhóm chạy tiếp, không phải xếp lại.')}</p>
  <div class="ro-pick">
    ${schedEmps().filter(e=>!roLeavers[e.id]).map(e=>{
      const on=!!roPauses[e.id];
      const p=roPauses[e.id]||{};
      return `<div class="ropk${on?' on':''}">
        <button type="button" class="nm" onclick="roTogglePause('${e.id}')">
          <span class="ck">${on?'✓':''}</span>
          <b>${esc(e.name||e.id)}</b>
          <i>${esc(e.team?t('Nhóm')+' '+e.team:'')}</i></button>
        ${on?`<span class="jn-f">
          <label class="fl2">${t('Từ ngày')}<input type="date" class="inp sm" value="${esc(p.from||'')}"
            onchange="roSetPause('${e.id}','from',this.value)"></label>
          <label class="fl2">${t('Đến ngày')}<input type="date" class="inp sm" value="${esc(p.to||'')}"
            onchange="roSetPause('${e.id}','to',this.value)"></label>
          <label class="fl2">${t('Mã nghỉ')}<select class="inp sm" onchange="roSetPause('${e.id}','code',this.value)">
            ${codes.map(c=>`<option value="${c.c}"${p.code===c.c?' selected':''}>${c.c} — ${esc(t(c.l))}</option>`).join('')}
          </select></label></span>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

/* Ô chọn kiểu ca dùng chung cho bảng cơ cấu và khối người mới */
function roTypeSelect(m,onch){
  const sel=(v)=>v===m.shiftType?' selected':'';
  return `<select class="inp sm" onchange="${onch}">
    <option value="type1"${sel('type1')}>O·O·D·D·N·N·R·R</option>
    <option value="type2"${sel('type2')}>D·D·N·N·R·R</option>
    <option value="custom"${sel('custom')}>${t('Mẫu tự khai')}</option>
    <option value="admin"${sel('admin')}>${t('Hành chính T2–T6')}</option>
    <option value="office6"${sel('office6')}>${t('Hành chính T2–T7')}</option>
  </select>`;
}
/* Vẽ lại RIÊNG bảng người — ô tìm kiếm phải giữ được con trỏ (cùng lỗi và
   cùng cách chữa với ô tìm tên ở màn Duyệt, xem js/08-requests.js). */
function roRefreshTbl(){
  const box=document.querySelector('.ro-tbl-wrap');
  if(!box){renderReorgMgr();return;}
  box.innerHTML=roTableHtml(roRosterRows());
}
function roTableHtml(rows){
  if(!rows.length)return `<p class="muted sm2" style="padding:10px">${t('Không có ai khớp bộ lọc.')}</p>`;
  return `<table class="ro-tbl"><thead><tr>
    <th></th><th>${t('Họ tên')}</th><th>${t('Nhóm hiện tại')}</th>
    <th>${t('Nhóm mới')}</th><th>${t('Ca & mốc')}</th><th></th>
  </tr></thead><tbody>${rows.map(e=>{
    const m=roMoves[e.id];
    const chg=roMoveChanged(roSnapEmp(e),m);
    /* Ca và Mốc 1 SUY TỪ NHÓM, hiện dạng chữ chứ không phải ô nhập: khai một
       lần ở bảng nhóm đích là xong cho cả nhóm. Ai cần khác nhóm thì bấm ✎
       để tách riêng dòng đó (cờ own → roRestagger bỏ qua). */
    let cell;
    if(!m)cell=`<i class="nt">${t('chưa xếp')}</i>`;
    else if(m.own)cell=`<span class="ro-own">
        ${roTypeSelect(m,`roSetMove('${e.id}','shiftType',this.value)`)}
        ${m.shiftType==='custom'?`<input class="inp sm pat${shiftPatternOk(m.pattern)?'':' bad'}"
           style="margin-top:4px;width:100%;font-family:var(--mono)" value="${esc(m.pattern||'')}"
           placeholder="D D N N R R" onchange="roSetMove('${e.id}','pattern',this.value)">`:''}
        <input type="date" class="inp sm" style="margin-top:4px" value="${esc(m.a1||'')}"
           onchange="roSetMove('${e.id}','a1',this.value)"></span>`;
    else cell=`<span class="ro-derived">${esc(roTypeLabel(m))}
        <i class="nt">${t('Mốc 1')} ${esc(fmtVN(m.a1||''))}</i>
        <button class="btn sec sm ico" title="${t('Đặt ca / mốc riêng cho người này')}"
          onclick="roSetMove('${e.id}','a1','${esc(m.a1||'')}')">✎</button></span>`;
    return `<tr class="${chg?'chg':''}">
      <td><input type="checkbox" ${roTick[e.id]?'checked':''} onchange="roToggleTick('${e.id}')"></td>
      <td><b>${esc(e.name||e.id)}</b><i class="nt">${esc(posLabel(posCode(e))||'')}</i></td>
      <td class="nw">${esc(e.team||'—')}</td>
      <td>${roTeamSelect(e)}</td>
      <td>${cell}</td>
      <td class="nw">${chg?`<button class="btn sec sm ico" title="${t('Bỏ thay đổi của dòng này')}"
            onclick="roClearMove('${e.id}')">↺</button>`:''}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}
/* Bảng xem trước: mỗi người một dòng, dải ô ca TRƯỚC và SAU xếp thẳng cột
   để nhìn phát thấy chỗ nào đổi. */
function roPreviewHtml(){
  const pv=roPreview(roDraftRec());
  if(!pv.rows.length)return `<p class="muted sm2">${t('Chưa có thay đổi nào để xem trước.')}</p>`;
  const days=pv.days;
  const TAG={move:'🔀',leave:'👋',join:'🆕',pause:'🏥'};
  const head=days.map(iso=>`<th class="${iso===roEff?'cut':''}">${+iso.slice(8)}</th>`).join('');
  return `<div class="ro-pv"><table class="ro-pvtbl"><thead>
    <tr><th class="nm">${t('Họ tên')}</th><th class="nm2"></th>${head}</tr></thead><tbody>
    ${pv.rows.map(r=>`
      <tr class="b"><td class="nm" rowspan="2"><b>${TAG[r.tag]||''} ${esc(r.name)}</b>
          <i class="nt">${r.tag==='move'?(esc(r.od.team||'—')+' → '+esc(r.nw.team||'—')+' · '+esc(roTypeLabel(r.nw)))
            :r.tag==='leave'?(t('nghỉ việc')+' '+fmtVN(r.last||''))
            :r.tag==='join'?(t('vào làm')+' '+fmtVN(r.nw.from||'')+' · '+esc(r.nw.team||''))
            :(t('nghỉ')+' '+(r.pause.code||'')+' '+fmtVN(r.pause.from||'')+'→'+fmtVN(r.pause.to||''))}</i>
          <i class="nt">${r.n} ${t('ô đổi')}</i></td>
        <td class="nm2">${t('cũ')}</td>
        ${r.before.map((c,i)=>`<td class="${c!==r.after[i]?'x':''}${days[i]===roEff?' cut':''}">${esc(c||'')}</td>`).join('')}</tr>
      <tr class="a"><td class="nm2">${t('mới')}</td>
        ${r.after.map((c,i)=>`<td class="${c!==r.before[i]?'x':''}${days[i]===roEff?' cut':''}">${esc(c||'')}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}
function roListHtml(){
  const list=roAll();
  if(!list.length)return `<p class="muted sm2">${t('Chưa có đợt biến động nào.')}</p>`;
  return `<div class="ro-list">${list.map(r=>{
    const nMv=Object.keys(r.moves||{}).length,nLv=Object.keys(r.leavers||{}).length,
          nJn=Object.keys(r.joiners||{}).length,nPs=Object.keys(r.pauses||{}).length;
    const on=r.status==='applied';
    const bits=[];
    if(nMv)bits.push(nMv+' '+t('đổi nhóm'));
    if(nLv)bits.push(nLv+' '+t('nghỉ việc'));
    if(nJn)bits.push(nJn+' '+t('mới vào'));
    if(nPs)bits.push(nPs+' '+t('nghỉ dài hạn'));
    return `<div class="ro-it${on?' on':''}">
      <span class="tx"><b>${esc(r.title||t('Biến động nhân sự'))}
        <span class="evtag ${on?'ok':''}">${on?t('đang áp dụng'):t('nháp')}</span></b>
        <i>${t('Từ')} ${esc(fmtVNfull(r.effFrom||''))} → ${esc(fmtVNfull(r.toIso||''))}
           · ${bits.join(' · ')||'—'}${on&&r.cells?(' · '+r.cells+' '+t('ô ca')):''}</i>
        ${on&&r.appliedAt?`<i class="nt">${t('áp dụng')} ${fmtDateTime(r.appliedAt)}</i>`:''}</span>
      <span class="ac">
        <button class="btn sec sm ico" onclick="roEdit('${r.id}')" title="${t('Xem / sửa')}">✏️</button>
        ${on?`<button class="btn sec sm" onclick="roUndo('${r.id}');renderReorgMgr()">↺ ${t('Hoàn tác')}</button>`
            :`<button class="btn ok sm" onclick="roEdit('${r.id}');roApplyNow()">✅ ${t('Áp dụng')}</button>`}
        <button class="btn warn sm ico" onclick="roDelete('${r.id}')" title="${t('Xoá')}">✕</button>
      </span></div>`;
  }).join('')}</div>`;
}

/* ============================================================
   THANH "CƠ CẤU TỔ" — LỐI VÀO CHÍNH
   ------------------------------------------------------------
   Nằm ngay trong thẻ Tạo / điền lịch ca, vì người ta nghĩ tới cơ cấu đúng
   lúc đang tạo lịch. Ba nút to = ba cơ cấu; bấm là mở thẳng trình khai với
   cơ cấu đó ĐÃ CHIA SẴN người, chỉ còn xem lại rồi bấm Áp dụng.
   ============================================================ */
function renderStructBar(){
  const box=$('structBar');if(!box)return;
  if(typeof hrGuard!=='function'||!(typeof adm==='undefined'?true:(adm||(typeof hrm!=='undefined'&&hrm)||(typeof kmgr!=='undefined'&&kmgr)))){
    /* Người không có quyền sửa nhân sự thì không thấy thanh này */
  }
  const cur=roCurrentStructure();
  const drafts=roAll().filter(r=>r.status!=='applied').length;
  box.innerHTML=`
  <div class="struct-bar">
    <div class="sb-now">
      <span class="lb">${t('Cơ cấu tổ đang chạy')}</span>
      <b>${esc(roStructLabel())}</b>
    </div>
    <div class="sb-acts">
      ${RO_PRESETS.filter(p=>p.v!=='custom').map(p=>`
        <button class="btn ${cur.v===p.v?'sec':''} sm sb-btn${cur.v===p.v?' cur':''}"
          onclick="openReorgMgr('form',{preset:'${p.v}',kinds:['struct'],step:3,autofill:1})"
          title="${esc(t(p.hint))}">${p.ic} ${t(p.l)}${cur.v===p.v?(' · '+t('đang dùng')):''}</button>`).join('')}
      <button class="btn sm" style="background:var(--brand2)"
        onclick="openReorgMgr('form',{step:1})">🔀 ${t('Biến động nhân sự')}${drafts?`<span class="bdg" style="position:static;margin-left:6px">${drafts}</span>`:''}</button>
      <button class="btn sec sm" onclick="openReorgMgr('list')">📋 ${t('Lịch sử thay đổi')}</button>
    </div>
    <div class="sb-hint muted sm2">
      ${t('Có người nghỉ việc, người mới vào, nghỉ thai sản, hay cần gom 4 nhóm thành 2 nhóm DCS / Field? Bấm')}
      <b>🔀 ${t('Biến động nhân sự')}</b> ${t('— chọn ngày áp dụng, phần mềm chỉ điền lại lịch TỪ NGÀY ĐÓ trở đi, những ngày trước giữ nguyên.')}
    </div>
  </div>`;
}

/* ============================================================
   DỌN DẸP KHI ĐÃ QUA NGÀY NGHỈ VIỆC
   ------------------------------------------------------------
   Người đã nghỉ vẫn nằm trong S.employees (bảng công kỳ cũ cần họ) nhưng
   không nên chiếm chỗ trong bảng lịch kỳ mới. genForEmp() đã không sinh
   lịch quá e.leftAt; hàm này chỉ dọn nốt những ô lỡ có từ trước.
   Gọi một lần lúc khởi động (js/12-main.js).
   ============================================================ */
function roSweepLeavers(){
  let n=0;
  (S.employees||[]).forEach(e=>{
    if(!e.leftAt)return;
    [S.base,S.over].forEach(tbl=>{
      const mine=tbl[e.id];if(!mine)return;
      Object.keys(mine).forEach(iso=>{if(iso>e.leftAt){delete mine[iso];n++;}});
    });
  });
  return n;
}
