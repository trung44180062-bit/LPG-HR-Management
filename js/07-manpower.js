/* ============================================================
   NHAN LUC — thong ke nhan su theo ngay
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== NHÂN LỰC (v2 — dòng gọn, chạm mở chi tiết) =================== */
/* mpBuckets(iso)         → gộp cả tổ (giữ nguyên cách gọi cũ)
   mpBuckets(iso,'prod')  → chỉ khối sản xuất A/B/C/D
   mpBuckets(iso,'office')→ chỉ khối văn phòng
   Hai khối không cover cho nhau nên định mức phải đếm tách bạch. */
/* Xếp một người vào đúng rổ theo mã ca của ngày đó.
   CA KÉP (O+N, D+N) được đếm HAI LẦN có chủ đích: người đó thật sự có
   mặt ở ca chuẩn (nên phải tính vào quân số ca O/D) và đồng thời đang
   tăng ca ca đêm (nên phải hiện trong danh sách tăng ca). Nếu chỉ đếm
   một nơi thì hoặc là ca chuẩn hụt người, hoặc là mất dấu giờ tăng ca. */
function mpPut(B,e,c){
  const cb=(typeof comboOf==='function')&&comboOf(c);
  const w=cb?cb.work:c;
  if(cb)B.ot.push({e,c});
  if(w==='D'||w==='SD')B.D.push(e);
  else if(w==='N'||w==='SN')B.N.push(e);
  else if(w==='O'||w==='SO')B.O.push(e);
  else if(w==='R')B.R.push(e);
  else if(!cb){
    const cat=codeInfo(c).cat;
    if(cat==='leave')B.leave.push({e,c});
    else if(cat==='ot')B.ot.push({e,c});
  }
}
function mpBuckets(iso,pool){
  const B={D:[],N:[],O:[],R:[],leave:[],ot:[]};
  schedEmps().forEach(e=>{
    if(pool&&poolOf(e)!==pool)return;
    const c=eff(e.id,iso).code;if(!c)return;
    mpPut(B,e,c);
  });
  return B;
}
/* Cả hai khối trong một lần duyệt danh sách — đỡ chạy 2 vòng */
function mpBucketsByPool(iso){
  const mk=()=>({D:[],N:[],O:[],R:[],leave:[],ot:[]});
  const out={prod:mk(),office:mk()};
  schedEmps().forEach(e=>{
    const c=eff(e.id,iso).code;if(!c)return;
    mpPut(out[poolOf(e)],e,c);
  });
  return out;
}
/* ============================================================
   ★ v8.0 — HAI KHUNG TRỰC 12 GIỜ PHẢI LUÔN CÓ ĐỦ 2 KỸ SƯ
   ------------------------------------------------------------
   VÌ SAO ĐỔI CÁCH ĐẾM

   Định mức cũ (minD / minN) đếm ĐẦU NGƯỜI của ca D và ca N. Hai chỗ hở:

   1. NGƯỜI ĐI HỌC VẪN ĐƯỢC ĐẾM. Anh ta có mã ca D nên bảng Nhân lực coi
      như đang trực, trong khi thực tế đang ngồi lớp — nhà máy hụt người
      mà không có cảnh báo nào. Đây đúng là chỗ người dùng nêu.

   2. ĐỦ ĐẦU NGƯỜI KHÔNG CÓ NGHĨA LÀ VẬN HÀNH ĐƯỢC. Ba operator không
      thay được một kỹ sư. Yêu cầu vận hành tối thiểu là **lúc nào cũng
      phải có 2 kỹ sư tại chỗ**, xét trên hai khung 12 giờ:
          · 08:00 → 20:00   (khung ngày)
          · 20:00 → 08:00   (khung đêm, vắt sang hôm sau)

   CÁCH ĐẾM

   Mỗi mã ca đổi thành một hay hai KHOẢNG PHÚT trong ngày (mốc 0 = 00:00,
   khung đêm kéo tới 32:00 = 08:00 hôm sau). Ai có khoảng giao với khung
   thì tính là có mặt ở khung đó. Ca hành chính O (08–17) giao với khung
   ngày nhưng KHÔNG phủ hết — đếm riêng thành "có mặt một phần", vì từ
   17:00 tới 20:00 họ đã về.

   Rồi TRỪ NGƯỜI ĐANG ĐI HỌC: buổi đào tạo cũng là một khoảng phút; giao
   với khung nào thì người đó KHÔNG tính cho khung ấy. Cố ý xét khắt khe
   (giao một giờ cũng trừ cả khung) vì đây là kiểm tra AN TOÀN VẬN HÀNH —
   cái phải trả lời là "có lúc nào tụt xuống dưới 2 kỹ sư không", không
   phải "trung bình cả ca có mấy kỹ sư".
   ============================================================ */
const MP_WIN=[
  {k:'day',  ic:'☀️', l:'Khung ngày 08:00–20:00', from:8*60,  to:20*60},
  {k:'night',ic:'🌙', l:'Khung đêm 20:00–08:00',  from:20*60, to:32*60}
];
/* Số kỹ sư tối thiểu mỗi khung — sửa được ở màn Dữ liệu, mặc định 2 */
function minEngOfWindow(){
  const v=(S.settings||{}).minEng;
  return (v===''||v==null)?2:(+v||0);
}
function mpHm(s){
  const m=/^(\d{1,2}):(\d{2})$/.exec(String(s||''));
  return m?(+m[1]*60 + +m[2]):null;
}
/* Các khoảng CÓ MẶT của một mã ca, tính bằng phút từ 00:00 của chính ngày đó.
   Ca đêm 20:00–08:00 ghi là [1200,1920] (1920 = 32:00 = 08:00 hôm sau). */
function mpCodeSpans(code){
  if(!code)return [];
  const cb=(typeof comboOf==='function')&&comboOf(code);
  if(cb)return mpCodeSpans(cb.work).concat(mpCodeSpans(cb.ot));
  switch(code){
    case 'D': case 'SD': case 'OTD': return [[8*60,20*60]];
    case 'N': case 'SN': case 'OTN': return [[20*60,32*60]];
    case 'O': case 'SO': case 'OTO': return [[8*60,17*60]];
    default: return [];          // R, phép, OT lẻ (OTL/OT2/OT3) không tính trực
  }
}
function mpSpanHit(spans,w){
  return (spans||[]).some(s=>Math.min(s[1],w.to)>Math.max(s[0],w.from));
}
/* Có phủ TRỌN khung không (ca O chỉ phủ một phần khung ngày) */
function mpSpanFull(spans,w){
  return (spans||[]).some(s=>s[0]<=w.from&&s[1]>=w.to);
}
/* Các khoảng BẬN ĐI HỌC của một người trong ngày iso.
   Chỉ tính buổi đã có hiệu lực — bản nhân viên tự khai còn chờ duyệt thì
   chưa chắc diễn ra, trừ người trước khi chốt là báo động giả. */
function mpTrainSpans(empId,iso){
  if(typeof trOfCell!=='function')return [];
  const out=[];
  trOfCell(empId,iso).forEach(tr=>{
    if(typeof trIsActive==='function'&&!trIsActive(tr))return;
    const w=(typeof trTimeOf==='function')?trTimeOf(tr,iso):null;
    const a=mpHm(w&&w.from), b=mpHm(w&&w.to);
    if(a==null||b==null){out.push([8*60,20*60]);return;}   // chưa khai giờ → coi như cả ngày làm việc
    out.push([a, (w.overnight||b<=a)?(b+24*60):b]);
  });
  return out;
}
function mpIsTraining(empId,iso,w){
  return mpSpanHit(mpTrainSpans(empId,iso),w);
}
/* KỸ SƯ CÓ MẶT Ở MỘT KHUNG — trả về đủ ba danh sách để giao diện nói được
   "thiếu vì sao", chứ không chỉ ném ra một con số đỏ. */
function mpEngOfWindow(iso,w,pool){
  const on=[],part=[],train=[];
  schedEmps().forEach(e=>{
    if((pool||POOL_PROD)&&poolOf(e)!==(pool||POOL_PROD))return;
    if(posGroupOf(e)!==POSG_ENG)return;
    const code=eff(e.id,iso).code;
    const spans=mpCodeSpans(code);
    if(!mpSpanHit(spans,w))return;
    if(mpIsTraining(e.id,iso,w)){train.push(e);return;}     // đi học = không sản xuất
    if(mpSpanFull(spans,w))on.push(e);else part.push(e);
  });
  return {on,part,train};
}
/* Soi cả hai khung của một ngày */
function mpEngDay(iso,pool){
  const need=minEngOfWindow();
  const out={need,low:false,win:{}};
  MP_WIN.forEach(w=>{
    const g=mpEngOfWindow(iso,w,pool);
    /* Người phủ một phần khung (ca O) KHÔNG được tính vào định mức: khung
       ngày còn 3 tiếng cuối không có họ, mà định mức là "lúc nào cũng đủ". */
    const n=g.on.length;
    const low=n<need;
    out.win[w.k]={w,n,need,low,on:g.on,part:g.part,train:g.train};
    if(low)out.low=true;
  });
  return out;
}
/* Câu ngắn nói rõ khung nào thiếu và thiếu vì ai đi học — dùng cho tooltip,
   dải cảnh báo ở màn Duyệt và bảng Nhân lực. */
function mpEngWhy(iso,pool){
  const d=mpEngDay(iso,pool),parts=[];
  MP_WIN.forEach(w=>{
    const x=d.win[w.k];
    if(!x.low)return;
    let s=w.ic+' '+t2(w.l)+': '+x.n+'/'+x.need+' '+t2('kỹ sư');
    if(x.train.length)s+=' · '+x.train.length+' '+t2('người đang đi đào tạo');
    parts.push(s);
  });
  return parts.join(' · ');
}

/* Ngày này có thiếu người không — chỉ xét khối SẢN XUẤT, vì khối văn phòng
   không trực ca D/N nên không có định mức trực.
   ★ v8.0 — thiếu KỸ SƯ ở một trong hai khung 12 giờ cũng là thiếu người,
   kể cả khi đầu người ca D/N vẫn đủ. */
function mpLowOfDay(iso){
  const B=mpBuckets(iso,POOL_PROD);
  const lowD=B.D.length<minOfShift('D'), lowN=B.N.length<minOfShift('N');
  const eng=mpEngDay(iso,POOL_PROD);
  return {lowD,lowN,lowEng:eng.low,eng,low:lowD||lowN||eng.low,B};
}
/* renderMp() đã chuyển sang js/15-report.js (tab Báo cáo).
   Lưu ý lỗi cũ ở đây: `const f=..., t=$('mpTo').value` che mất hàm dịch t()
   → cả hàm ném lỗi và tab Nhân lực trắng trơn. Bản mới không dùng biến tên `t`. */
