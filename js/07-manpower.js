/* ============================================================
   NHAN LUC — thong ke nhan su theo ngay
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== NHÂN LỰC (v2 — dòng gọn, chạm mở chi tiết) =================== */
/* mpBuckets(iso)         → gộp cả tổ (giữ nguyên cách gọi cũ)
   mpBuckets(iso,'prod')  → chỉ khối sản xuất A/B/C/D
   mpBuckets(iso,'office')→ chỉ khối văn phòng
   Hai khối không cover cho nhau nên định mức phải đếm tách bạch. */
function mpBuckets(iso,pool){
  const B={D:[],N:[],O:[],R:[],leave:[],ot:[]};
  schedEmps().forEach(e=>{
    if(pool&&poolOf(e)!==pool)return;
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
/* Cả hai khối trong một lần duyệt danh sách — đỡ chạy 2 vòng */
function mpBucketsByPool(iso){
  const mk=()=>({D:[],N:[],O:[],R:[],leave:[],ot:[]});
  const out={prod:mk(),office:mk()};
  schedEmps().forEach(e=>{
    const c=eff(e.id,iso).code;if(!c)return;
    const B=out[poolOf(e)], cat=codeInfo(c).cat;
    if(c==='D'||c==='SD')B.D.push(e);
    else if(c==='N'||c==='SN')B.N.push(e);
    else if(c==='O'||c==='SO')B.O.push(e);
    else if(c==='R')B.R.push(e);
    else if(cat==='leave')B.leave.push({e,c});
    else if(cat==='ot')B.ot.push({e,c});
  });
  return out;
}
/* Ngày này có thiếu người không — chỉ xét khối SẢN XUẤT, vì khối văn phòng
   không trực ca D/N nên không có định mức trực. */
function mpLowOfDay(iso){
  const B=mpBuckets(iso,POOL_PROD);
  const lowD=B.D.length<minOfShift('D'), lowN=B.N.length<minOfShift('N');
  return {lowD,lowN,low:lowD||lowN,B};
}
/* renderMp() đã chuyển sang js/15-report.js (tab Báo cáo).
   Lưu ý lỗi cũ ở đây: `const f=..., t=$('mpTo').value` che mất hàm dịch t()
   → cả hàm ném lỗi và tab Nhân lực trắng trơn. Bản mới không dùng biến tên `t`. */
