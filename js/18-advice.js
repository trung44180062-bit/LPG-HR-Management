/* ============================================================
   TRỢ LÝ DUYỆT ĐƠN  —  LPGT Cavern · Quản lý Công Ca
   ------------------------------------------------------------
   Mục đích: người duyệt bấm vào một đơn là thấy ngay BỐI CẢNH của
   đúng ngày đó — ai đã nghỉ, đơn của họ ở trạng thái nào, duyệt xong
   thì ca còn mấy người — kèm một khuyến nghị NÊN / CÂN NHẮC / KHÔNG NÊN.
   Người làm đơn cũng thấy cùng bối cảnh đó trước khi bấm gửi, nên đơn
   gửi lên đã "biết điều" sẵn, đỡ một vòng gửi–từ chối–gửi lại.

   NGUYÊN TẮC:
   · Toàn bộ chạy bằng LOGIC trên dữ liệu đã nằm sẵn trong bộ nhớ (state S).
     KHÔNG gọi thêm Firebase, không đọc lại gì — gói Spark nên mỗi byte
     tải về đều phải có lý do. Xem js/02-storage.js (đồng bộ theo delta).
   · Hai khối nhân lực SẢN XUẤT (A/B/C/D) và VĂN PHÒNG không cover cho
     nhau, nên mọi phép đếm đều tách theo pool. Xem poolOf() ở 01-core.js.

   Tiêu chí xếp hạng khuyến nghị (theo yêu cầu nghiệp vụ):
     1. CHÍNH — cùng NHÓM đã có bao nhiêu người nghỉ ngày đó
        (đã duyệt = chắc chắn vắng; đang chờ = vắng tiềm năng).
     2. PHỤ  — sau khi duyệt thì ca trực của khối đó còn mấy người
        so với định mức minD / minN / minO.
   ============================================================ */

/* =================== NỀN =================== */
function advIsLeaveCode(c){return !!c&&codeInfo(c).cat==='leave';}
/* Mã ca quy về "chỗ đứng" trong ngày: D / N / O / R / LEAVE / OT */
function advShiftOf(c){
  if(!c)return '';
  const cat=codeInfo(c).cat;
  if(cat==='leave')return 'LEAVE';
  if(cat==='ot')   return 'OT';
  if(cat==='rest') return 'R';
  return baseShiftOf(c)||c;
}
/* Mã ca này có làm người đó RỜI KHỎI ca trực không (nghỉ phép hoặc về nghỉ ca) */
function advCodeLeavesShift(c){
  if(!c)return false;
  const cat=codeInfo(c).cat;
  return cat==='leave'||cat==='rest';
}

/* ------------------------------------------------------------
   AI VẮNG MẶT NGÀY iso — gộp hai nguồn:
     (1) ô lịch thực tế đã mang mã nghỉ  → CHẮC CHẮN nghỉ (đã duyệt)
     (2) đơn nghỉ đang CHỜ DUYỆT phủ lên ngày đó → nghỉ tiềm năng
   skipReqId: bỏ qua chính đơn đang xét, để không tự đếm mình.
   ------------------------------------------------------------ */
function offListOfDay(iso){
  const out=[],seen={};
  schedEmps().forEach(e=>{
    const r=eff(e.id,iso);
    if(!advIsLeaveCode(r.code))return;
    const rid=(r.o&&r.o.reqId)||'';
    const src=rid?(S.requests||{})[rid]:null;
    seen[e.id]=1;
    out.push({e,code:r.code,status:'approved',reqId:rid,
              /* Mốc ĐĂNG KÝ (không phải mốc duyệt): dùng để biết ai xí chỗ
                 ngày này trước. Ô lịch quản lý gõ tay không có đơn → coi như
                 đã có từ lâu (0) nên luôn tính là "trước". */
              at:src?(src.createdAt||0):0,
              coverId:src?(src.coverId||''):'',coverSt:src?(src.coverSt||''):'',
              pool:poolOf(e),team:String(e.team||'').trim()});
  });
  Object.values(S.requests||{}).forEach(r=>{
    if(!r||r.status!=='pending')return;
    if(r.type!=='leave'&&r.type!=='change')return;
    const d=(reqDays(r)||[]).find(x=>x.iso===iso);
    if(!d||!advIsLeaveCode(d.code))return;
    if(seen[r.empId])return;
    const e=empById(r.empId);
    if(!e||e.active===false||!inSchedule(e))return;
    seen[r.empId]=1;
    out.push({e,code:d.code,status:'pending',reqId:r.id,
              at:r.createdAt||0,coverId:r.coverId||'',coverSt:r.coverSt||'',
              pool:poolOf(e),team:String(e.team||'').trim()});
  });
  return out.sort((a,b)=>
    (a.status===b.status?0:(a.status==='approved'?-1:1))||
    (a.at||0)-(b.at||0)||
    String(a.team).localeCompare(String(b.team),'vi',{numeric:true})||
    String(a.e.name||'').localeCompare(String(b.e.name||''),'vi'));
}

/* ------------------------------------------------------------
   BỘ NHỚ ĐỆM TRONG PHIÊN
   Màn Duyệt có thể vẽ 150 dòng đơn, mỗi đơn vài ngày → nếu quét lại
   toàn bộ nhân sự + đơn cho từng ngày thì rất chậm. Kết quả chỉ đổi khi
   dữ liệu đổi, mà mỗi lần dữ liệu đổi thì S.rev đổi theo, nên lấy S.rev
   làm khoá đệm là đủ. Không liên quan gì tới Firebase — thuần bộ nhớ.
   ------------------------------------------------------------ */
let _advCache={rev:-1,off:{},bkt:{}};
function _advFresh(){
  if(_advCache.rev!==S.rev)_advCache={rev:S.rev,off:{},bkt:{}};
  return _advCache;
}
function offListCached(iso){
  const c=_advFresh();
  if(!c.off[iso])c.off[iso]=offListOfDay(iso);
  return c.off[iso];
}
function mpBucketsCached(iso,pool){
  const c=_advFresh(),k=iso+'|'+(pool||'*');
  if(!c.bkt[k])c.bkt[k]=mpBuckets(iso,pool);
  return c.bkt[k];
}

/* ------------------------------------------------------------
   NGƯỜI OT COVER CỦA MỘT ĐƠN NGHỈ
   Nghiệp vụ: người xin nghỉ có thể chỉ định một đồng nghiệp ở lại tăng ca
   gánh ca thay mình (r.coverId + r.coverSt, xem js/08-requests.js). Nếu
   người đó ĐÃ XÁC NHẬN thì ca trực KHÔNG hụt người — trước đây bộ tư vấn
   không biết chuyện này nên vẫn kêu "dưới định mức" và bắt người duyệt
   phải tự nhẩm lại. Nay cover đã xác nhận được cộng bù vào quân số.

   Chỉ cover 'confirmed' mới bù (quyết định nghiệp vụ): cover mới chỉ định
   mà người ta chưa bấm đồng ý thì chưa chắc có người, chỉ nhắc chứ không bù.
   Người cover cũng phải CÙNG KHỐI mới bù được — khối văn phòng và khối
   sản xuất không gánh ca cho nhau (xem poolOf ở 01-core.js).
   ------------------------------------------------------------ */
function advCoverInfo(opt,pool,iso){
  const o=opt||{};
  const id=o.coverId||'';
  if(!id)return {id:'',st:'',ok:false,name:'',samePool:false,busy:''};
  const e=empById(id);
  const samePool=!!e&&poolOf(e)===pool;
  const st=o.coverSt||'pending';
  /* Người cover có đang vướng gì ngày đó không (chính họ cũng nghỉ / cũng xin nghỉ) */
  const c=e?eff(id,iso).code:'';
  const busy=advCodeLeavesShift(c)&&codeInfo(c).cat==='leave'?c:'';
  return {id,st,name:(e&&e.name)||id,samePool,busy,
          ok:st==='confirmed'&&samePool&&!busy};
}

/* ------------------------------------------------------------
   KHUYẾN NGHỊ CHO MỘT NGƯỜI – MỘT NGÀY
   empId    : người xin nghỉ
   iso      : ngày
   newCode  : mã sẽ áp vào ô lịch nếu duyệt (AL8 / AL4 / NP / OFF / R…)
   skipReqId: id đơn đang xét (không tự tính mình vào danh sách đã nghỉ)
   opt      : {coverId, coverSt, at} — người OT cover của đơn và mốc gửi đơn.
              `at` để biết ai ĐĂNG KÝ NGHỈ TRƯỚC ngày này (ai xí chỗ trước
              thì thường được ưu tiên; đơn gửi sau phải nhường).
   ------------------------------------------------------------ */
function leaveAdvice(empId,iso,newCode,skipReqId,opt){
  const e=empById(empId)||{id:empId,name:empId,team:''};
  const pool=poolOf(e), team=String(e.team||'').trim();
  const cur=eff(empId,iso).code;
  const shift=advShiftOf(cur);
  const myAt=(opt&&opt.at)||Date.now();

  const off     = offListCached(iso).filter(x=>x.e.id!==empId&&!(skipReqId&&x.reqId===skipReqId));
  const offTeam = off.filter(x=>x.team===team);
  const offPool = off.filter(x=>x.pool===pool);
  const teamSize= schedEmps().filter(x=>String(x.team||'').trim()===team).length;
  /* Ai đã ĐĂNG KÝ NGHỈ NGÀY NÀY TRƯỚC đơn đang xét — tiêu chí ưu tiên số 1 */
  const earlier     = off.filter(x=>(x.at||0)<myAt);
  const earlierTeam = earlier.filter(x=>x.team===team);

  /* Đếm quân số CÙNG KHỐI — khối kia không cover được nên không tính vào */
  const B=mpBucketsCached(iso,pool);
  const before={D:B.D.length,N:B.N.length,O:B.O.length,R:B.R.length};
  const after=Object.assign({},before);
  const pulls=(shift==='D'||shift==='N'||shift==='O');
  if(pulls)after[shift]=Math.max(0,after[shift]-1);

  /* Có người OT cover đã xác nhận → cộng bù lại đúng 1 người vào ca đó */
  const cv=advCoverInfo(opt,pool,iso);
  const covered=!!(cv.ok&&pulls);
  if(covered)after[shift]=after[shift]+1;

  /* Đơn cùng ca, cùng khối, đang chờ duyệt → nếu duyệt hết còn rút thêm nữa */
  const pendSameShift=offPool.filter(x=>x.status==='pending'&&
      advShiftOf(eff(x.e.id,iso).code)===shift).length;

  const nTeamOk  = offTeam.filter(x=>x.status==='approved').length;
  const nTeamPend= offTeam.filter(x=>x.status==='pending').length;
  const cap      = maxOffTeam();

  const reasons=[], pluses=[];
  let level='ok';
  const bump=l=>{ if(l==='block')level='block'; else if(l==='warn'&&level!=='block')level='warn'; };
  const say=(lv,txt)=>{ reasons.push({lv,txt}); bump(lv); };
  const nameList=a=>a.slice(0,4).map(x=>shortName(x.e.name)||x.e.id).join(', ')
                   +(a.length>4?' +'+(a.length-4):'');

  /* --- Bối cảnh ca của chính người xin --- */
  if(!cur)                  say('warn', t('Ngày này chưa xếp ca cho người xin — nên kiểm tra lại lịch trước khi duyệt.'));
  else if(shift==='LEAVE')  say('warn', t('Người xin đã đang nghỉ sẵn ngày này')+' ('+cur+') — '+t('đơn có thể bị trùng.'));
  else if(shift==='OT')     say('warn', t('Ngày này người xin đang được xếp tăng ca — duyệt nghỉ sẽ huỷ mất ca tăng đó.'));
  else if(shift==='R')      pluses.push(t('Ngày này vốn là ngày nghỉ ca R — nghỉ phép không rút ai khỏi ca trực.'));

  /* --- NGƯỜI OT COVER: nói trước, vì nó đổi hẳn kết luận --- */
  if(cv.id){
    if(cv.ok)
      pluses.push(t('Đã có')+' '+shortName(cv.name)+' '+t('nhận OT cover ngày này — ca trực không hụt người.'));
    else if(!cv.samePool)
      say('warn', shortName(cv.name)+' '+t('được chọn cover nhưng KHÁC KHỐI nhân lực — không gánh ca thay được.'));
    else if(cv.busy)
      say('warn', shortName(cv.name)+' '+t('được chọn cover nhưng chính họ cũng nghỉ ngày này')+' ('+cv.busy+').');
    else
      say('warn', shortName(cv.name)+' '+t('chưa xác nhận nhận OT cover — chưa chắc chắn có người gánh ca.'));
  }

  /* --- TIÊU CHÍ CHÍNH: NGÀY NÀY ĐÃ CÓ AI ĐĂNG KÝ NGHỈ TRƯỚC CHƯA ---
     Người xin sau phải nhường người xin trước, nên nêu đích danh và nêu
     trước mọi tiêu chí khác. Có người cover thì hạ một bậc cảnh báo,
     vì lúc đó vấn đề chỉ còn là thứ tự ưu tiên chứ không phải thiếu người. */
  if(team){
    if(earlierTeam.length){
      const who=nameList(earlierTeam);
      const okN=earlierTeam.filter(x=>x.status==='approved').length;
      const pnN=earlierTeam.length-okN;
      const detail=t('Nhóm')+' '+team+' '+t('đã có')+' '+earlierTeam.length+'/'+cap+' '+
        t('người ĐĂNG KÝ NGHỈ ngày này TRƯỚC đơn này')+': '+who+
        (pnN?' ('+okN+' '+t('đã duyệt')+' · '+pnN+' '+t('chờ duyệt')+')':'')+'.';
      if(earlierTeam.length>=cap&&cap>0)
        say(covered?'warn':'block', detail+' '+
          (covered?t('Có người cover nên vẫn đủ quân, nhưng người đăng ký trước nên được ưu tiên.')
                  :t('Đủ trần nghỉ của nhóm — đơn này nên nhường hoặc phải có người OT cover.')));
      else say('warn', detail);
    }else{
      pluses.push(t('Nhóm')+' '+team+' '+t('chưa ai đăng ký nghỉ ngày này trước đơn này.'));
    }
    /* Người đăng ký SAU đơn này (nếu có) — chỉ để người duyệt biết, không hạ bậc */
    const later=offTeam.filter(x=>(x.at||0)>=myAt);
    if(later.length)
      reasons.push({lv:'ok',txt:t('Cùng nhóm còn')+' '+later.length+' '+
        t('người đăng ký nghỉ ngày này SAU đơn này')+': '+nameList(later)+'.'});
    if(nTeamPend)
      say('warn', t('Còn')+' '+nTeamPend+' '+t('đơn cùng nhóm đang CHỜ DUYỆT cùng ngày — duyệt hết sẽ vượt trần.'));
  }

  /* --- TIÊU CHÍ PHỤ: định mức ca của khối (đã tính người cover) --- */
  if(pulls){
    const need=minOfShift(shift);
    if(need>0){
      if(after[shift]<need)
        say('block', t('Ca')+' '+shift+' '+t('khối')+' '+t(POOL_LABEL[pool])+' '+t('còn')+' '+
                     after[shift]+'/'+need+' '+t('người — dưới định mức.'));
      else if(after[shift]===need)
        say(covered?'ok':'warn',
                     t('Ca')+' '+shift+' '+t('khối')+' '+t(POOL_LABEL[pool])+' '+t('còn đúng')+' '+
                     after[shift]+'/'+need+' — '+(covered
                       ? t('vừa đủ nhờ người OT cover.')
                       : t('vừa sát định mức, không còn dự phòng.')));
      else
        pluses.push(t('Ca')+' '+shift+' '+t('còn')+' '+after[shift]+'/'+need+' '+t('người, vẫn đủ.'));
    }
    if(pendSameShift&&!covered)
      say('warn', t('Cùng ca này còn')+' '+pendSameShift+' '+t('đơn đang chờ duyệt.'));
  }

  /* Ai có thể huy động cover: cùng KHỐI và đang nghỉ ca R.
     Đã có người cover xác nhận rồi thì khỏi gợi ý thêm cho đỡ rối. */
  const cover=cv.ok?[]:B.R.slice(0,8);

  return {empId,name:e.name||empId,iso,pool,team,teamSize,cur,shift,newCode,cap,
          level,reasons,pluses,off,offTeam,offPool,earlier,earlierTeam,
          before,after,cover,cv,covered,myAt,
          nTeamOk,nTeamPend,pendSameShift,pulls};
}

/* =================== HIỂN THỊ =================== */
/* Hai giọng văn: 'appr' nói với người duyệt, 'emp' nói với người làm đơn */
const ADV_LV={
  ok   :{ic:'🟢',cls:'ok',   appr:'Nên duyệt',       emp:'Thuận lợi'},
  warn :{ic:'🟡',cls:'warn', appr:'Cân nhắc',        emp:'Có thể vướng'},
  block:{ic:'🔴',cls:'block',appr:'Không nên duyệt', emp:'Dễ bị từ chối'}
};
function advChip(lv,mode){
  const x=ADV_LV[lv]||ADV_LV.ok;
  return `<span class="adv-chip ${x.cls}">${x.ic} ${t(mode==='emp'?x.emp:x.appr)}</span>`;
}
function advWorst(list){
  return list.some(a=>a.level==='block')?'block'
       : list.some(a=>a.level==='warn') ?'warn':'ok';
}
/* Một người đang nghỉ → viên chip có tên + mã + trạng thái đơn.
   `at` = mốc gửi của đơn ĐANG XÉT: ai đăng ký trước mốc đó thì gắn cờ ⏱ TRƯỚC,
   vì đó chính là người được ưu tiên giữ ngày nghỉ. */
function advOffChip(x,hi,at){
  const st=x.status==='approved'
    ? `<i class="st ok">✓ ${t('đã duyệt')}</i>`
    : `<i class="st pend">⏳ ${t('chờ duyệt')}</i>`;
  const bf=at&&(x.at||0)<at;
  /* Nhãn để nguyên cụm 'đăng ký trước' chứ không rút gọn thành 'trước':
     bộ dịch quét TEXT NODE, một khoá cụt lủn như 'trước' rất dễ khớp nhầm
     chỗ khác trong giao diện. Xem js/14-i18n.js. */
  const od=bf?`<i class="st bf" title="${t('Đăng ký trước đơn đang xét')}">⏱ ${t('đăng ký trước')}</i>`:'';
  return `<span class="adv-off-i${hi?' same':''}${bf?' bf':''}">
    <b>${esc(shortName(x.e.name)||x.e.id)}</b>
    ${x.team?`<em>${esc(teamShort(x.team))}</em>`:''}
    <span class="cc" style="background:${codeInfo(x.code).col}">${esc(x.code)}</span>${st}${od}
    ${x.coverSt==='confirmed'?`<i class="st cv" title="${t('Đơn đó đã có người OT cover')}">🤝</i>`:''}</span>`;
}
/* Bảng quân số trước / sau khi duyệt */
function advCountHtml(a){
  const cell=sh=>{
    const need=minOfShift(sh), b=a.before[sh], af=a.after[sh];
    if(a.pool===POOL_OFF&&sh!=='O')return '';
    const bad=need>0&&af<need, tight=need>0&&af===need;
    return `<span class="adv-n${bad?' bad':(tight?' tight':'')}">
      ${chip(sh)}<b>${b===af?b:(b+'→'+af)}</b>${need?`<i>/${need}</i>`:''}</span>`;
  };
  return `<div class="adv-cnt">${poolChip(a.pool)}${cell('D')}${cell('N')}${cell('O')}
    <span class="adv-n rest">${chip('R')}<b>${a.before.R}</b></span></div>`;
}
/* Dải trạng thái người OT cover của chính đơn đang xét */
function advCoverHtml(a){
  const cv=a.cv;if(!cv||!cv.id)return '';
  const cls=cv.ok?'ok':'warn';
  const note=cv.ok?t('đã xác nhận — ca không hụt người')
    :(!cv.samePool?t('khác khối nhân lực — không gánh ca thay được')
    :(cv.busy?t('chính họ cũng nghỉ ngày này')
    :t('chưa xác nhận nhận cover')));
  return `<div class="adv-cvr ${cls}"><span class="lb">🤝 ${t('Người OT cover')}:</span>
    <b>${esc(shortName(cv.name)||cv.id)}</b> <em>${esc(note)}</em></div>`;
}
/* Khối chi tiết cho MỘT ngày */
function advDayHtml(a,mode){
  const same=a.offTeam.length, other=a.off.length-same;
  const bf=(a.earlierTeam||[]).length;
  const why=a.reasons.map(r=>`<li class="${r.lv}">${esc(r.txt)}</li>`).join('')
          + a.pluses.map(p=>`<li class="ok">${esc(p)}</li>`).join('');
  return `<div class="adv-day ${a.level}${bf?' hasbf':''}">
    <div class="adv-dh">
      <b>${fmtVN(a.iso)} <i>${dowOf(a.iso)}</i></b>
      ${a.cur?chip(a.cur):`<span class="muted">${t('chưa xếp ca')}</span>`}
      ${a.newCode?`<span class="arw">→</span>${chip(a.newCode)}`:''}
      ${bf?`<span class="adv-bf">⏱ ${bf} ${t('người đăng ký trước')}</span>`:''}
      ${a.covered?`<span class="adv-cvok">🤝 ${t('đã có cover')}</span>`:''}
      <span class="sp"></span>${advChip(a.level,mode)}
    </div>
    ${advCountHtml(a)}
    ${advCoverHtml(a)}
    <ul class="adv-why">${why||`<li class="ok">${t('Không có vướng mắc nào.')}</li>`}</ul>
    <div class="adv-off">
      <span class="lb">${t('Đã nghỉ ngày này')}:</span>
      ${a.off.length
        ? a.offTeam.map(x=>advOffChip(x,true,a.myAt)).join('')
          + a.off.filter(x=>x.team!==a.team).map(x=>advOffChip(x,false,a.myAt)).join('')
          + `<span class="adv-sum">${same} ${t('cùng nhóm')}${other?` · ${other} ${t('nhóm khác')}`:''}</span>`
        : `<span class="muted">${t('chưa có ai')}</span>`}
    </div>
    ${a.cover.length?`<div class="adv-cover"><span class="lb">${t('Có thể huy động')} (${t('nghỉ ca R, cùng khối')}):</span>
      ${a.cover.map(x=>`<span class="adv-cv">${esc(shortName(x.name)||x.id)}${x.team?` <em>${esc(teamShort(x.team))}</em>`:''}</span>`).join('')}</div>`:''}
  </div>`;
}

/* ------------------------------------------------------------
   KHUYẾN NGHỊ CHO CẢ MỘT ĐƠN
   Trả về {kind, days:[advice], level, notes:[...]}
   kind: 'leave'  — đơn làm người đó vắng ca (nghỉ phép / đổi sang mã nghỉ)
         'swap'   — đổi ca (kiểm tra hai khối)
         'ot'     — tăng ca (trần giờ, ai cover được)
         'info'   — các loại còn lại: chỉ cho biết ai đang nghỉ hôm đó
   ------------------------------------------------------------ */
function reqAdvice(r){
  const out={kind:'info',days:[],level:'ok',notes:[]};
  if(!r)return out;
  const days=(r.type==='multi')?[]:(reqDays(r)||[]);

  if(r.type==='swap'){
    out.kind='swap';
    const pa=poolOfId(r.empId), pb=r.withId?poolOfId(r.withId):pa;
    if(r.withId&&pa!==pb){
      out.level='block';
      out.notes.push({lv:'block',txt:t('Hai người khác khối nhân lực')+' ('+t(POOL_LABEL[pa])+' ⇄ '+
        t(POOL_LABEL[pb])+') — '+t('khối văn phòng và khối sản xuất không trực thay ca cho nhau được.')});
    }else{
      out.notes.push({lv:'ok',txt:t('Hai người cùng khối')+' '+t(POOL_LABEL[pa])+' — '+t('đổi ca hợp lệ về mặt bố trí.')});
    }
    days.forEach(d=>{
      const bad=swapBlockList(r.empId,r.withId,[d.iso]);
      if(bad.length){out.level='block';out.notes.push({lv:'block',txt:bad.join(' · ')});}
    });
    return out;
  }

  if(r.type==='ot'){
    out.kind='ot';
    const lim=(typeof asOtLimit==='function')?asOtLimit():40;
    const ym=days.length?schedMonthOf(days[0].iso):curSchedMonth();
    const used=advOtUsedInPeriod(r.empId,ym,r.id);
    const add=(typeof reqHours==='function')?reqHours(r):0;
    if(used+add>lim){
      out.level='warn';
      out.notes.push({lv:'warn',txt:t('Tăng ca kỳ')+' '+periodFor(ym).label+': '+rnd1(used)+'h + '+
        rnd1(add)+'h = '+rnd1(used+add)+'h > '+t('trần')+' '+lim+'h.'});
    }else{
      out.notes.push({lv:'ok',txt:t('Tăng ca kỳ')+' '+periodFor(ym).label+': '+rnd1(used+add)+'h / '+lim+'h '+t('trần')+'.'});
    }
    days.forEach(d=>{
      const cur=eff(r.empId,d.iso).code, sh=advShiftOf(cur);
      if(sh==='LEAVE'){out.level='warn';
        out.notes.push({lv:'warn',txt:fmtVN(d.iso)+': '+t('người này đang nghỉ phép')+' ('+cur+') '+t('mà lại xin tăng ca.')});}
    });
    return out;
  }

  /* Đơn làm người đó rời ca: nghỉ phép, hoặc đổi mã ca sang mã nghỉ */
  const leaveDays=days.filter(d=>advCodeLeavesShift(d.code)||r.type==='leave');
  if(leaveDays.length){
    out.kind='leave';
    const opt=advOptOfReq(r);
    /* Tính hết mọi ngày (đơn dài nhất cũng chỉ một kỳ công) rồi mới chọn
       ngày nào ĐÁNG XEM. Đơn 15 ngày mà chỉ 2 ngày vướng thì hiện 13 ngày
       "không có gì" chỉ làm người duyệt phải cuộn, dễ bỏ sót đúng 2 ngày kia. */
    const all=leaveDays.slice(0,31).map(d=>leaveAdvice(r.empId,d.iso,d.code||'AL8',r.id,opt));
    out.level=advWorst(all);
    /* NGÀY ĐÁNG XEM = ngày đã có người đăng ký nghỉ TRƯỚC, hoặc ngày có
       cảnh báo. Đây chính là chỗ người duyệt phải cân nhắc; ngày trống trơn
       thì chỉ cần biết số lượng. */
    const focus=all.filter(a=>(a.earlierTeam&&a.earlierTeam.length)||a.level!=='ok');
    const rest =all.filter(a=>focus.indexOf(a)<0);
    out.days=(focus.length?focus:all).slice(0,10);
    out.focusN=focus.length;out.allN=all.length;
    if(focus.length&&rest.length)
      out.notes.push({lv:'ok',txt:t('Đang tập trung vào')+' '+focus.length+'/'+all.length+' '+
        t('ngày có người đã đăng ký nghỉ trước hoặc có cảnh báo')+' — '+rest.length+' '+
        t('ngày còn lại trống, duyệt được ngay.')});
    else if(!focus.length)
      out.notes.push({lv:'ok',txt:t('Không ngày nào trong đơn có người đăng ký nghỉ trước — không vướng nhân lực.')+
        ' ('+all.length+' '+t('ngày')+')'});
    if(all.length>10&&(focus.length?focus.length>10:true))
      out.notes.push({lv:'ok',txt:t('Đơn có')+' '+leaveDays.length+' '+t('ngày — đang hiện 10 ngày đầu.')});
    return out;
  }

  /* Còn lại: chỉ cho biết bối cảnh ngày đó */
  out.days=days.slice(0,6).map(d=>leaveAdvice(r.empId,d.iso,d.code||'',r.id,advOptOfReq(r)));
  out.level='ok';
  return out;
}
/* Gói thông tin của đơn mà bộ tư vấn cần: người OT cover + mốc gửi đơn */
function advOptOfReq(r){
  return {coverId:(r&&r.coverId)||'',coverSt:(r&&r.coverSt)||'',at:(r&&r.createdAt)||0};
}
/* Giờ tăng ca đã duyệt trong kỳ (không tính đơn đang xét) */
function advOtUsedInPeriod(empId,ym,skipReqId){
  let h=0;
  daysOfPeriod(ym).forEach(iso=>{
    const o=S.over[empId]&&S.over[empId][iso];
    if(!o||!o.code||codeInfo(o.code).cat!=='ot')return;
    if(skipReqId&&o.reqId===skipReqId)return;
    h+=(typeof o.hours==='number'&&o.hours>0)?o.hours:getHours(o.code);
  });
  return h;
}

/* Panel gắn vào một dòng đơn ở màn Duyệt */
function reqAdviceHtml(r){
  const a=reqAdvice(r);
  const head=`<div class="adv-head">🧭 <b>${t('Trợ lý duyệt đơn')}</b>${advChip(a.level,'appr')}
    ${a.focusN?`<span class="adv-bf">⏱ ${a.focusN}/${a.allN} ${t('ngày cần cân nhắc')}</span>`:''}
    <span class="muted sm2">${t('tính theo lịch & đơn đang có, không tải thêm dữ liệu')}</span></div>`;
  const notes=a.notes.length
    ? `<ul class="adv-why">${a.notes.map(n=>`<li class="${n.lv}">${esc(n.txt)}</li>`).join('')}</ul>`:'';
  const body=a.days.map(x=>advDayHtml(x,'appr')).join('');
  return `<div class="adv-box ${a.level}">${head}${notes}${body||
    (a.notes.length?'':`<p class="muted sm2">${t('Loại đơn này không ảnh hưởng tới bố trí ca.')}</p>`)}</div>`;
}

/* ------------------------------------------------------------
   NHẮC NHỞ CHO NGƯỜI LÀM ĐƠN (trong form gửi đơn ở trang chính)
   Cùng một engine, đổi giọng: cho biết hôm đó ai đã nghỉ, đơn của họ
   đang ở trạng thái nào, và khả năng đơn của mình có bị vướng không.
   ------------------------------------------------------------ */
function advForFormHtml(empId,rows,type,coverId){
  if(!empId||!rows||!rows.length)return '';
  const isos=[...new Set(rows.map(r=>r.iso).filter(Boolean))].sort().slice(0,6);
  if(!isos.length)return '';

  if(type==='swap'){
    return '';   // đơn đổi ca đã có cảnh báo riêng ở dsFormUI()
  }
  /* Đơn chưa gửi nên chưa có createdAt: lấy mốc HIỆN TẠI làm mốc so sánh →
     mọi đơn đã có trên hệ thống đều tính là "đăng ký trước". Người cover mới
     chọn trong form thì chắc chắn CHƯA xác nhận, nên truyền coverSt='pending'. */
  const opt={coverId:coverId||'',coverSt:coverId?'pending':'',at:Date.now()};
  const leaveLike=(type==='leave')||rows.some(r=>advCodeLeavesShift(r.code));
  const list=isos.map(iso=>{
    const row=rows.find(r=>r.iso===iso)||{};
    return leaveAdvice(empId,iso,leaveLike?(row.code||'AL8'):'',null,opt);
  });
  const lv=leaveLike?advWorst(list):'ok';

  const dayHtml=list.map(a=>{
    const same=a.offTeam.length, bf=(a.earlierTeam||[]).length;
    const who=a.off.length
      ? a.offTeam.map(x=>advOffChip(x,true,a.myAt)).join('')+
        a.off.filter(x=>x.team!==a.team).map(x=>advOffChip(x,false,a.myAt)).join('')
      : `<span class="muted">${t('chưa có ai')}</span>`;
    const tip=leaveLike
      ? a.reasons.filter(x=>x.lv!=='ok').map(x=>`<li class="${x.lv}">${esc(x.txt)}</li>`).join('')
      : '';
    return `<div class="adv-day ${leaveLike?a.level:'ok'}${bf?' hasbf':''}">
      <div class="adv-dh"><b>${fmtVN(a.iso)} <i>${dowOf(a.iso)}</i></b>
        ${a.cur?chip(a.cur):`<span class="muted">${t('chưa xếp ca')}</span>`}
        ${bf?`<span class="adv-bf">⏱ ${bf} ${t('người đăng ký trước')}</span>`:''}
        <span class="sp"></span>${leaveLike?advChip(a.level,'emp'):''}</div>
      <div class="adv-off"><span class="lb">${t('Đã nghỉ ngày này')}:</span>${who}
        ${a.off.length?`<span class="adv-sum">${same} ${t('cùng nhóm')}</span>`:''}</div>
      ${tip?`<ul class="adv-why">${tip}</ul>`:''}
    </div>`;
  }).join('');

  return `<div class="adv-box emp ${lv}">
    <div class="adv-head">🔎 <b>${t('Trước khi gửi, xem qua ngày này')}</b>${leaveLike?advChip(lv,'emp'):''}</div>
    ${dayHtml}
    <p class="muted sm2">${t('Danh sách gồm cả đơn của người khác đang chờ duyệt — nếu trùng ngày, ai gửi trước thường được xét trước.')}</p>
  </div>`;
}
