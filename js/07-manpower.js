/* ============================================================
   NHAN LUC — thong ke nhan su theo ngay
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== NHÂN LỰC (v2 — dòng gọn, chạm mở chi tiết) =================== */
function mpBuckets(iso){
  const B={D:[],N:[],O:[],R:[],leave:[],ot:[]};
  activeEmps().forEach(e=>{
    const c=eff(e.id,iso).code;if(!c)return;
    const cat=codeInfo(c).cat;
    if(c==='D'||c==='SD')B.D.push(e);
    else if(c==='N'||c==='SN')B.N.push(e);
    else if(c==='O'||c==='SO')B.O.push(e);
    else if(c==='R')B.R.push(e);
    else if(cat==='leave')B.leave.push({e,c});
    else if(cat==='ot')B.ot.push({e,c});
  });
  return B;
}
function renderMp(){
  $('minDLbl').textContent=S.settings.minD;$('minNLbl').textContent=S.settings.minN;
  if(!$('mpFrom').value){$('mpFrom').value=todayIso();}
  if(!$('mpTo').value){const d=new Date();d.setDate(d.getDate()+6);$('mpTo').value=isoOf(d);}
  const f=$('mpFrom').value,t=$('mpTo').value;
  if(!f||!t||t<f){$('mpList').innerHTML='<p class="muted">Chọn khoảng ngày hợp lệ.</p>';return;}
  const onlyLow=$('mpOnlyLow').checked;
  const pill=(n,lbl,col,isLow)=>`<span class="mpp${isLow?' low':''}${n?'':' zero'}" style="background:${col}">${n}<small>${lbl}</small></span>`;
  let rows='',d=new Date(f+'T00:00:00');const end=new Date(t+'T00:00:00');
  let guard=0,nDays=0,nLow=0;
  while(d<=end&&guard++<62){
    const iso=isoOf(d);
    const B=mpBuckets(iso);
    const lowD=B.D.length<S.settings.minD,lowN=B.N.length<S.settings.minN,low=lowD||lowN;
    nDays++;if(low)nLow++;
    if(onlyLow&&!low){d.setDate(d.getDate()+1);continue;}
    const dw=d.getDay();
    const line=(code,arr)=>`<div class="mp-line">${chip(code)}<span class="who">${arr.length?arr.map(e=>esc(e.name||e.id)).join(', '):'—'}</span></div>`;
    rows+=`<div class="mp2-row${iso===todayIso()?' today':''}${low?' low':''}">
      <div class="mp2-main" onclick="this.parentElement.classList.toggle('open')">
        <div class="dt"><div class="d1">${fmtVN(iso)}</div><div class="d2 ${dw===0?'dowSun':dw===6?'dowSat':''}">${DOW[dw]}${iso===todayIso()?' · Hôm nay':''}</div></div>
        <div class="pillrow">
          ${pill(B.D.length,'NGÀY','var(--cD)',lowD)}
          ${pill(B.N.length,'ĐÊM','var(--cN)',lowN)}
          ${pill(B.O.length,'VP','var(--cO)',false)}
          ${pill(B.R.length,'NGHỈ CA','var(--cR)',false)}
          ${pill(B.leave.length,'PHÉP','var(--cAL)',false)}
          ${pill(B.ot.length,'TĂNG CA','var(--cOT)',false)}
        </div>
        ${low?'<span class="st rejected">⚠</span>':''}
        <span class="chev">▼</span>
      </div>
      <div class="mp2-det">
        ${line('D',B.D)}
        ${line('N',B.N)}
        ${line('O',B.O)}
        <div class="mp-line">${chip('R')}<span class="who" title="Có thể huy động tăng ca">${B.R.length?B.R.map(e=>esc(e.name||e.id)).join(', '):'—'}</span></div>
        ${B.leave.length?`<div class="mp-line">${chip('AL8')}<span class="who">${B.leave.map(x=>esc(x.e.name||x.e.id)+' ('+x.c+')').join(', ')}</span></div>`:''}
        ${B.ot.length?`<div class="mp-line">${chip('OTD')}<span class="who">${B.ot.map(x=>esc(x.e.name||x.e.id)+' ('+x.c+')').join(', ')}</span></div>`:''}
      </div>
    </div>`;
    d.setDate(d.getDate()+1);
  }
  const head=`<div class="card" style="padding:10px 13px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="font-weight:800">${nDays} ngày</span>
    <span class="st ${nLow?'rejected':'approved'}">${nLow?('⚠ '+nLow+' ngày thiếu nhân lực'):'✓ Đủ nhân lực toàn khoảng'}</span>
    <span class="muted">Chạm vào từng ngày để xem danh sách tên</span></div>`;
  $('mpList').innerHTML=rows?head+`<div class="mp2">${rows}</div>`:'<p class="muted">Không có ngày nào khớp bộ lọc.</p>';
}
