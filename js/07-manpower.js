/* ============================================================
   NHAN LUC — thong ke nhan su theo ngay
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== NHÂN LỰC (v2 — dòng gọn, chạm mở chi tiết) =================== */
function mpBuckets(iso){
  const B={D:[],N:[],O:[],R:[],leave:[],ot:[]};
  schedEmps().forEach(e=>{
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
/* renderMp() đã chuyển sang js/15-report.js (tab Báo cáo).
   Lưu ý lỗi cũ ở đây: `const f=..., t=$('mpTo').value` che mất hàm dịch t()
   → cả hàm ném lỗi và tab Nhân lực trắng trơn. Bản mới không dùng biến tên `t`. */
