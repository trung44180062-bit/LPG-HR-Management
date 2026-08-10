/* ============================================================
   FIREBASE LÀ NGUỒN DỮ LIỆU DUY NHẤT  ★ v6.6 — BỎ HẲN CACHE
   LPGT Cavern — Quan ly Cong Ca
   ------------------------------------------------------------
   VÌ SAO BỎ CACHE

   Trước đây toàn bộ đối tượng S được lưu vào localStorage, và mỗi máy khi
   mở lên phải ĐỐI CHIẾU bản sao cũ của mình với máy chủ. Chính việc đối
   chiếu đó đẻ ra cả một họ lỗi khó truy:
     · đơn đã xoá trên điện thoại bị máy khác đẩy ngược lên (hồi sinh)
     · phải dựng sổ bia mộ, sổ đã-đồng-bộ, so `rev`… mỗi lớp lại thêm một
       đường biên có thể sai
     · người dùng xoá đi xoá lại nhiều lần mà mở máy khác vẫn thấy

   Dữ liệu của tổ rất nhỏ (≈23 người, vài trăm đơn một kỳ). Tải trọn gói
   một lần lúc mở app rẻ hơn nhiều so với giá phải trả cho việc hợp nhất
   hai nguồn. Nên nay:

       Firebase = SỰ THẬT DUY NHẤT.  Máy không giữ bản sao dữ liệu nào.

     · Mở app  → đọc MỘT phát toàn bộ (once) → có dữ liệu mới cho dùng
     · Đang mở → nghe realtime ở mức con, chỉ phần thay đổi bay về
     · Thao tác→ ghi thẳng lên Firebase (vẫn theo delta cho nhẹ băng thông)
     · Đóng tab → không còn gì trên máy. Mở lại là lấy bản mới nhất.

   Hệ quả phải chấp nhận: KHÔNG có mạng thì app không mở được. Đổi lại,
   không bao giờ còn cảnh hai máy hiểu khác nhau về cùng một dữ liệu.

   Những thứ VẪN lưu trên máy (không phải dữ liệu nghiệp vụ, không đồng bộ):
   phiên đăng nhập, ngôn ngữ, mốc đã-đọc-thông-báo, cấu hình Firebase riêng,
   lựa chọn sắp xếp cột. Xoá cache trình duyệt chỉ mất mấy thứ đó.
   ------------------------------------------------------------
   ĐỒNG BỘ THEO DELTA (giữ từ bản v4.7)

   Bản cũ nghe `on('value')` ngay gốc và ghi bằng `set(S)`: mỗi lần BẤT KỲ
   ai đổi một ô lịch là MỌI máy tải lại TOÀN BỘ dữ liệu (nhân sự + lịch
   chuẩn + lịch thực tế + toàn bộ đơn + nhật ký in…). Gói Firebase Spark
   tính tiền theo băng thông tải xuống nên cách đó rất phí.

   Bản này chia dữ liệu thành các NHÁNH và nghe ở mức CON:
     · Nhánh dạng bảng (base / over / requests / accounts / printLog /
       notifs) → nghe child_added / child_changed / child_removed. Sửa lịch
       của một người thì chỉ nhánh của đúng người đó bay về.
     · Nhánh nhỏ, hay đọc trọn gói (employees / settings / meta) → nghe
       value như cũ, vì chúng bé và luôn cần đủ.
   Khi ghi cũng vậy: so với ảnh chụp lần đồng bộ trước rồi chỉ `update()`
   đúng những khoá đã đổi, thay vì đẩy lại cả cây.

   Kết quả: lần đầu mở app tải một lượt đủ dữ liệu cần thiết, sau đó chỉ
   còn phần thay đổi chạy qua lại. SCHEMA GIỮ NGUYÊN — dữ liệu cũ trên
   Firebase dùng lại được ngay, không cần chuyển đổi gì.
   ============================================================ */

/* Nhánh dạng bảng: khoá là mã NV / id đơn → nghe & ghi ở mức con */
const FB_MAP_BRANCHES=['base','over','requests','accounts','printLog','notifs','events'];
/* Nhánh nghe trọn gói (nhỏ, và luôn cần đủ để render).
   'del' = SỔ BIA MỘ: id nào đã bị xoá thì mọi máy tôn trọng, không hồi sinh —
   xem applyTombstones() và mục "CHỐNG HỒI SINH" bên dưới. */
const FB_VAL_BRANCHES=['employees','settings','meta','del'];

let _fbLast=null;        // ảnh chụp JSON của lần đồng bộ gần nhất (để tính delta)
let _fbSeen=null;        // id nào đã thấy từ máy chủ, dùng để dọn rác cục bộ
let _fbRemoteRev=0;      // rev phía máy chủ
let _fbRenderT=null;     // gộp nhiều sự kiện con thành một lần vẽ lại
let _fbBooted=false;     // đã xử lý xong đợt đồng bộ đầu tiên chưa

/* ============================================================
   ★ v6.4 — HAI LỖ HỔNG CŨ (giữ ghi chép để không đi lại vết xe đổ)

   LỖ 1 — GHI TRƯỢT MÀ APP TƯỞNG ĐÃ GHI.  fbPush đặt `_fbLast=cur` NGAY
   TRƯỚC `fbRef.update()`, lỗi chỉ rơi vào console.warn. Firebase update()
   là NGUYÊN KHỐI: rớt mạng / sai luật / hết quota là CẢ GÓI trượt, nhưng
   mốc đã dời nên lần ghi sau tính delta so với một hiện trạng KHÔNG CÓ
   THẬT → thay đổi biến mất vĩnh viễn.
   → Vẫn đang sửa theo cách: chỉ dời mốc SAU KHI máy chủ xác nhận; trượt
     thì hoàn tác mốc, bật cờ bẩn, tự thử lại (fbRetry). Cách này còn
     nguyên giá trị ở v6.6.

   LỖ 2 — ĐẨY NGƯỢC BẢN GHI ĐÃ XOÁ (hồi sinh). Gốc rễ là app giữ MỘT BẢN
   SAO trong localStorage rồi phải đoán xem bản sao đó hay máy chủ mới
   đúng. Mọi cách đoán (so `rev`, sổ bia mộ, sổ đã-đồng-bộ) đều chỉ là
   giảm xác suất sai chứ không triệt được.
   → v6.6 GIẢI QUYẾT TẬN GỐC bằng cách BỎ HẲN BẢN SAO. Không có bản sao
     thì không có gì để đẩy ngược, và không còn câu hỏi "bên nào đúng".
     Sổ bia mộ (S.del) vẫn giữ, nhưng nay chỉ còn là lớp đỡ cho những máy
     chưa kịp cập nhật lên bản mới.
   ============================================================ */
let _fbDirty=false;      // còn thay đổi chưa ghi được lên máy chủ
let _fbRetryT=null;      // hẹn giờ thử ghi lại
let _fbRetryMs=2000;     // giãn dần 2s → 4s → … tối đa 30s

/* ★ v6.6 — CHỐT AN TOÀN QUAN TRỌNG NHẤT CỦA CHẾ ĐỘ KHÔNG CACHE.
   Lúc mới mở, S còn RỖNG. Nếu một lệnh ghi nào đó chạy trước khi dữ liệu
   từ Firebase về, delta sẽ là "máy chủ có, máy này không" → app sẽ XOÁ
   SẠCH cơ sở dữ liệu. Mọi đường ghi đều phải đi qua cờ này. */
let _fbReady=false;
function fbReady(){return _fbReady;}

/* =================== STORAGE =================== */
/* Lưu = ĐẨY THẲNG LÊN FIREBASE. Không còn bản sao nào trên máy. */
function save(){
  /* Nhân viên vừa thêm mới chưa có accessor tên → gắn trước khi lưu */
  if(typeof decorateEmpNames==='function')decorateEmpNames(S.employees);
  if(!_fbReady){
    /* Chưa tải xong mà đã có lệnh ghi → CHẶN. Ghi lúc này là đẩy một bộ
       dữ liệu rỗng đè lên máy chủ. Trước v6.6 chuyện này vô hại vì máy còn
       cache; nay thì không. */
    console.warn('[sync] bỏ qua lệnh ghi khi chưa tải xong dữ liệu');
    if(typeof toast==='function')toast(t('Đang tải dữ liệu — thử lại sau vài giây'));
    return;
  }
  S.rev=Date.now();
  fbPush();
  refreshBadge();
}
/* Mở app: KHÔNG đọc gì từ máy nữa, chỉ dựng khung rỗng rồi chờ Firebase.
   Giữ tên hàm để js/12-main.js và các chỗ khác không phải sửa. */
function load(){
  normalizeState();
}
/* Điền các mặc định còn thiếu — gọi sau khi nạp từ localStorage và sau mỗi
   lần nhận nhánh settings mới từ máy chủ. */
function normalizeState(){
  S.employees=S.employees||[];
  /* Gắn accessor tên hiển thị — Quản lý người Hàn luôn ra "Mr. <họ tên>".
     Gọi ở đây là phủ cả lúc nạp localStorage lẫn lúc nhánh employees về
     từ Firebase (mảng mới toanh, accessor cũ mất). Xem js/01-core.js. */
  if(typeof decorateEmpNames==='function')decorateEmpNames(S.employees);
  S.base=S.base||{};S.over=S.over||{};S.requests=S.requests||{};
  S.accounts=S.accounts||{};S.printLog=S.printLog||{};S.notifs=S.notifs||{};
  S.events=S.events||{};                 // sự kiện trên lịch — xem js/20-events.js
  S.del=S.del||{};                       // sổ bia mộ id đã xoá — xem applyTombstones()
  S.settings=S.settings||{minD:3,minN:3};
  S.settings.hours=S.settings.hours||{};
  S.settings.customCodes=S.settings.customCodes||[];
  S.settings.deptDefault=S.settings.deptDefault||DEPT_DEFAULT_FALLBACK;
  S.settings.approver1=S.settings.approver1||APPROVER1_FALLBACK;
  S.settings.approver2=S.settings.approver2||APPROVER2_FALLBACK;
  if(S.settings.minO===undefined)S.settings.minO=1;
  if(S.settings.maxOffTeam===undefined)S.settings.maxOffTeam=1;
  S.meta=Object.assign({schedFrom:'',schedTo:''},S.meta||{});
}

/* =================== DELTA =================== */
/* Ảnh chụp: mỗi nhánh value là 1 chuỗi JSON, mỗi nhánh map là bảng
   {id → chuỗi JSON}. So chuỗi là biết chính xác cái gì đã đổi. */
function fbSnapshot(){
  const s={v:{},m:{}};
  FB_VAL_BRANCHES.forEach(k=>{s.v[k]=JSON.stringify(S[k]===undefined?null:S[k]);});
  FB_MAP_BRANCHES.forEach(k=>{
    const src=S[k]||{},out={};
    Object.keys(src).forEach(id=>{out[id]=JSON.stringify(src[id]);});
    s.m[k]=out;
  });
  return s;
}
/* ============================================================
   CHỐNG HỒI SINH — SỔ BIA MỘ (tombstones)
   ------------------------------------------------------------
   VẤN ĐỀ CŨ: đồng bộ delta không có bia mộ. Khi xoá một đơn, khoá chỉ đơn
   giản BIẾN MẤT khỏi máy chủ. Một máy khác còn giữ đơn đó trong localStorage,
   lúc kết nối lại mà rev của nó ≥ rev máy chủ, sẽ chạy fbPush và ĐẨY LẠI đơn
   lên — vì fbDiff không phân biệt được "đơn tôi vừa tạo lúc offline" với "đơn
   máy chủ đã xoá": cả hai đều là "local có, server không". Đơn cũ sống dậy.

   CÁCH SỬA: mỗi lần xoá một khoá của nhánh bảng, ghi một BIA MỘ
   `del["<nhánh>/<id>"] = thời điểm xoá`. Sổ bia mộ đồng bộ như một nhánh nhỏ.
   Vì id là DUY NHẤT (uid() không trùng), một id đã có bia mộ là CHẾT HẲN:
     · mọi máy tự xoá id đó khỏi bộ nhớ (applyTombstones),
     · fbPush KHÔNG BAO GIỜ đẩy lại id đã có bia mộ,
     · dữ liệu lạc từ máy chưa kịp nhận bia mộ sẽ bị các máy khác gỡ khỏi
       máy chủ ngay khi thấy (xem 'put' trong fbAttach).
   Đơn TẠO MỚI mang id mới, không có bia mộ → đồng bộ bình thường. Không phụ
   thuộc đồng hồ máy, nên hết cảnh xoá rồi lại hiện.
   ============================================================ */
function applyTombstones(){
  if(!S.del)return 0;
  let n=0;
  FB_MAP_BRANCHES.forEach(k=>{
    const src=S[k];if(!src)return;
    Object.keys(src).forEach(id=>{
      if(S.del[k+'/'+id]!==undefined){delete src[id];n++;}
    });
  });
  return n;
}
/* ------------------------------------------------------------
   DỌN BIA MỘ QUÁ HẠN — để sổ del không phình theo năm tháng
   ------------------------------------------------------------
   Bia mộ chỉ cần sống đủ lâu để chặn một máy offline quay lại đẩy đơn cũ.
   Một máy phải offline LÂU HƠN 180 ngày mới có nguy cơ hồi sinh một id đã dọn
   bia — điều gần như không xảy ra; và fbBootSync còn một lớp đối chiếu rev
   nữa đỡ lưng. Chạy mỗi lần mở app (fbBootSync): máy nào dọn thì đẩy sổ đã
   gọn lên, các máy khác nhận về theo, kể cả máy để mở 24/7.
   ------------------------------------------------------------ */
const TOMB_TTL_DAYS=180;
const TOMB_TTL_MS=TOMB_TTL_DAYS*24*60*60*1000;
function pruneTombstones(){
  if(!S.del)return 0;
  const cutoff=Date.now()-TOMB_TTL_MS;
  let n=0;
  Object.keys(S.del).forEach(tk=>{
    const ts=+S.del[tk]||0;
    if(ts&&ts<cutoff){delete S.del[tk];n++;}
  });
  return n;
}
/* Danh sách khoá cần ghi lên máy chủ (dạng đường dẫn nhiều mức của update()) */
function fbDiff(prev,cur){
  const patch={};let n=0;let delTouched=false;
  FB_VAL_BRANCHES.forEach(k=>{
    if(!prev||prev.v[k]!==cur.v[k]){patch[k]=(S[k]===undefined?null:S[k]);n++;}
  });
  FB_MAP_BRANCHES.forEach(k=>{
    const a=(prev&&prev.m[k])||{}, b=cur.m[k];
    Object.keys(b).forEach(id=>{if(a[id]!==b[id]){patch[k+'/'+id]=S[k][id];n++;}});
    Object.keys(a).forEach(id=>{if(b[id]===undefined){
      patch[k+'/'+id]=null;n++;
      /* Xoá một khoá bảng → dựng bia mộ để không máy nào hồi sinh nó */
      const tk=k+'/'+id;
      if(!S.del)S.del={};
      if(S.del[tk]===undefined){S.del[tk]=S.rev||Date.now();delTouched=true;}
    }});
  });
  return {patch,n,delTouched};
}
function fbPush(){
  if(!fbRef||applyingRemote)return;
  if(!_fbReady)return;                 // ★ chưa có dữ liệu thì tuyệt đối không ghi
  applyTombstones();                   // gỡ mọi id đã có bia mộ TRƯỚC khi so → không đẩy lại
  const cur=fbSnapshot();
  const d=fbDiff(_fbLast,cur);
  if(d.delTouched){                     // fbDiff vừa thêm bia mộ mới → phải đẩy sổ bia mộ luôn
    cur.v.del=JSON.stringify(S.del===undefined?null:S.del);
    d.patch.del=S.del;
  }
  if(!d.n){                             // không có gì mới, nhưng có thể còn nợ lần trước
    if(!_fbDirty)_fbLast=cur;
    return;
  }
  d.patch.rev=S.rev;

  /* ★ v6.4 — KHÔNG dời mốc trước khi máy chủ nhận.
     `prev` giữ nguyên hiện trạng máy chủ mà máy này đang tin. Ghi thành công
     mới dời sang `cur`; ghi trượt thì mốc đứng yên nên lần push sau tính lại
     ĐÚNG phần còn thiếu — không mất thay đổi nào.
     Vẫn phải chặn tiếng vọng: đặt mốc lạc quan sang `cur` ngay, nhưng nhớ
     `prev` để hoàn tác nếu trượt. */
  const prev=_fbLast, patch=d.patch;
  _fbLast=cur;
  fbRef.update(patch).then(()=>{
    _fbDirty=false;_fbRetryMs=2000;
    clearTimeout(_fbRetryT);_fbRetryT=null;
    setSync(true,'Đã đồng bộ');
  }).catch(e=>{
    console.warn('FB write',e);
    /* Hoàn tác mốc — chỉ khi trong lúc chờ chưa có ai dời nó (dữ liệu máy
       khác về giữa chừng cũng dời mốc qua fbMark). So tham chiếu là đủ. */
    if(_fbLast===cur)_fbLast=prev;
    _fbDirty=true;
    setSync(false,'Chưa gửi được — đang thử lại');
    fbRetry();
  });
}
/* Thử ghi lại, giãn dần. Không có nó thì một lần rớt mạng là thay đổi nằm
   im tới khi người dùng tình cờ thao tác tiếp. */
function fbRetry(){
  clearTimeout(_fbRetryT);
  _fbRetryT=setTimeout(()=>{
    _fbRetryT=null;
    _fbRetryMs=Math.min(_fbRetryMs*2,30000);
    if(_fbDirty)fbPush();
  },_fbRetryMs);
}
/* Còn thay đổi chưa lên máy chủ không? — cho chỗ khác hỏi (VD cảnh báo
   trước khi đóng tab). */
function fbPending(){return !!_fbDirty;}
/* Gộp nhiều sự kiện con thành một lần vẽ lại — nhận 30 ô lịch mà vẽ 30 lần
   thì giao diện giật, mà vẽ 1 lần là đủ. */
function fbTouch(){
  clearTimeout(_fbRenderT);
  /* Bia mộ vừa về từ máy khác (nhánh 'del') có thể vừa kết án một id còn nằm
     trong bộ nhớ máy này → gỡ ngay trước khi vẽ, không thì đơn đã xoá vẫn hiện. */
  applyTombstones();
  /* Dữ liệu về từ máy khác KHÔNG đi qua save() nên S.rev không đổi → các bộ
     đệm khoá theo S.rev phải được xoá tay ở đây, nếu không sẽ hiện số cũ. */
  if(typeof mealResetCache==='function')mealResetCache();
  if(typeof evResetCache==='function')evResetCache();
  _fbRenderT=setTimeout(()=>{
    if(typeof renderAll==='function')renderAll();
  },120);
}

/* =================== KẾT NỐI =================== */
function initFb(){
  const cfgRaw=localStorage.getItem(LS+'_fb');
  let cfg;
  if(cfgRaw){try{cfg=JSON.parse(cfgRaw);}catch(e){setSync(false,'Config lỗi');return;}}
  else{cfg=APP_CFG.firebase;} // config mac dinh lay tu js/config.js
  if(!cfg){setSync(false,'Chua co config (js/config.js)');return;}
  if(typeof firebase==='undefined'){setSync(false,'SDK chưa tải');return;}
  try{
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    fb=firebase;
    const done=()=>fbAttach();
    if(firebase.auth){firebase.auth().signInAnonymously().then(done).catch(done);}else done();
    setSync(true,'Đang kết nối…');
  }catch(e){setSync(false,'Lỗi kết nối');console.warn(e);}
}
function fbErr(err){setSync(false,'Lỗi quyền');console.warn(err);}

/* ============================================================
   MỞ APP — TẢI TRỌN GÓI MỘT PHÁT, RỒI MỚI NGHE REALTIME  ★ v6.6
   ------------------------------------------------------------
   Thứ tự BẮT BUỘC, đảo là hỏng:
     1. once('value') — đọc nguyên trạng máy chủ. Đây là toàn bộ dữ liệu
        app cần; tổ ~23 người nên một lượt tải là vài chục KB.
     2. Áp vào S, đặt mốc _fbLast = đúng ảnh máy chủ, bật cờ _fbReady.
     3. Từ giờ mới gắn listener con để nhận thay đổi realtime, và mới cho
        phép ghi.
   Bản cũ gắn listener trước rồi đoán "im lặng 900ms là xong" — vừa mong
   manh, vừa để hở khoảng thời gian mà S còn rỗng nhưng lệnh ghi đã chạy
   được. Nay không còn khoảng hở đó.

   Tải trượt (mất mạng, sai luật) → KHÔNG bật _fbReady, app đứng ở màn
   đăng nhập với thông báo rõ ràng và tự thử lại. Thà không mở được còn
   hơn mở ra với dữ liệu rỗng rồi ghi đè lên máy chủ.
   ============================================================ */
let _fbBootT=null, _fbBootMs=3000;

function fbAttach(){
  fbRef=firebase.database().ref(APP_CFG.dbPath);
  _fbLast=null;
  _fbSeen={};_fbBooted=false;_fbRemoteRev=0;_fbReady=false;
  FB_MAP_BRANCHES.forEach(k=>{_fbSeen[k]={};});

  /* Nối lại mạng: đọc lại một phát cho chắc (Firebase không bắn lại
     child_added cho những con không đổi trong lúc rớt). */
  try{
    firebase.database().ref('.info/connected').on('value',s=>{
      const on=!!(s&&s.val());
      if(!on){setSync(false,'Mất kết nối');return;}
      if(!_fbReady){fbBootLoad();return;}
      fbReconcile();
      if(_fbDirty)fbPush();
    });
  }catch(e){}

  fbBootLoad();
}

/* Bước 1–2: tải trọn gói rồi bật cờ sẵn sàng */
function fbBootLoad(){
  if(!fbRef||_fbReady)return;
  setSync(true,'Đang tải dữ liệu…');
  fbRef.once('value').then(snap=>{
    const srv=snap.val()||{};
    applyingRemote=true;
    FB_VAL_BRANCHES.forEach(k=>{ if(srv[k]!==undefined&&srv[k]!==null)S[k]=srv[k]; });
    FB_MAP_BRANCHES.forEach(k=>{
      S[k]=srv[k]||{};
      _fbSeen[k]={};Object.keys(S[k]).forEach(id=>{_fbSeen[k][id]=1;});
    });
    S.rev=+srv.rev||0;
    _fbRemoteRev=S.rev;
    normalizeState();
    applyTombstones();          // id đã có bia mộ thì không hiện, dù máy chủ còn
    applyingRemote=false;

    _fbLast=fbSnapshot();       // mốc = đúng hiện trạng máy chủ
    _fbReady=true;              // ★ từ đây mới được ghi
    _fbBooted=true;
    _fbBootMs=3000;
    clearTimeout(_fbBootT);_fbBootT=null;

    fbListen();                 // bước 3
    if(typeof renderAll==='function')renderAll();
    setSync(true,'Đã đồng bộ');

    /* Máy chủ trắng tinh (dự án mới) → không có gì để làm; người dùng sẽ
       nhập nhân sự rồi save() đẩy lên. KHÔNG tự đẩy dữ liệu rỗng. */
  }).catch(e=>{
    console.warn('FB tải dữ liệu',e);
    setSync(false,'Không tải được dữ liệu — đang thử lại');
    clearTimeout(_fbBootT);
    _fbBootT=setTimeout(()=>{_fbBootMs=Math.min(_fbBootMs*2,30000);fbBootLoad();},_fbBootMs);
  });
}

/* Bước 3: nghe thay đổi realtime ở mức con */
function fbListen(){
  /* rev — chỉ để biết máy chủ vừa đổi, tốn vài byte */
  fbRef.child('rev').on('value',s=>{_fbRemoteRev=+s.val()||0;},fbErr);

  /* Nhánh nhỏ: nghe trọn gói */
  FB_VAL_BRANCHES.forEach(k=>{
    fbRef.child(k).on('value',snap=>{
      const val=snap.val();
      if(val===null){setSync(true,'Đã đồng bộ');return;}
      const js=JSON.stringify(val);
      if(_fbLast&&_fbLast.v[k]===js){setSync(true,'Đã đồng bộ');return;}  // tiếng vọng của chính mình
      applyingRemote=true;
      S[k]=val;
      normalizeState();
      applyingRemote=false;
      fbMark(k,null,JSON.stringify(S[k]));
      fbTouch();
      setSync(true,'Đã đồng bộ');
    },fbErr);
  });

  /* Nhánh bảng: nghe ở mức con → chỉ phần thay đổi bay về */
  FB_MAP_BRANCHES.forEach(k=>{
    const ref=fbRef.child(k);
    const put=snap=>{
      const id=snap.key, val=snap.val(), js=JSON.stringify(val);
      _fbSeen[k][id]=1;
      /* Id đã có bia mộ mà vẫn thấy trên máy chủ = tin lạc từ một máy CHƯA
         cập nhật bản mới (còn cache cũ) → gỡ khỏi máy chủ lần nữa và không
         nhận về. Giữ lớp này trong thời gian còn máy chạy bản cũ. */
      if(S.del&&S.del[k+'/'+id]!==undefined){
        if(!applyingRemote)fbRef.child(k).child(id).remove().catch(()=>{});
        if(S[k]&&S[k][id]!==undefined){applyingRemote=true;delete S[k][id];applyingRemote=false;fbTouch();}
        return;
      }
      if(_fbLast&&_fbLast.m[k]&&_fbLast.m[k][id]===js)return;
      applyingRemote=true;
      S[k]=S[k]||{};S[k][id]=val;
      applyingRemote=false;
      fbMark(k,id,js);
      fbTouch();
    };
    const del=snap=>{
      const id=snap.key;
      delete _fbSeen[k][id];
      if(!S[k]||S[k][id]===undefined)return;
      applyingRemote=true;
      delete S[k][id];
      applyingRemote=false;
      fbMark(k,id,undefined);
      fbTouch();
    };
    ref.on('child_added',put,fbErr);
    ref.on('child_changed',put,fbErr);
    ref.on('child_removed',del,fbErr);
  });
}
/* Ghi lại mốc đồng bộ cho một khoá vừa nhận từ máy chủ */
function fbMark(branch,id,js){
  if(!_fbLast)_fbLast={v:{},m:{}};
  FB_MAP_BRANCHES.forEach(b=>{_fbLast.m[b]=_fbLast.m[b]||{};});
  if(id===null){_fbLast.v[branch]=js;return;}
  if(js===undefined)delete _fbLast.m[branch][id];
  else _fbLast.m[branch][id]=js;
}

/* ------------------------------------------------------------
   ĐỐI CHIẾU TOÀN PHẦN — đọc lại hiện trạng máy chủ và LẤY NGUYÊN.
   Dùng khi: vừa nối lại mạng, hoặc người dùng bấm "Đồng bộ lại".

   ★ v6.6 — không còn "đối chiếu" gì nữa, vì máy không giữ bản sao: máy chủ
   nói sao thì đúng vậy. Cái gì máy chủ không có thì máy này cũng không
   được có. Trước đây phải tra sổ đã-đồng-bộ để đoán "bản ghi này bị xoá
   hay là mình vừa tạo lúc offline" — nay không có offline nên không có
   câu hỏi đó.
   ------------------------------------------------------------ */
function fbReconcile(cb){
  if(!fbRef){cb&&cb(0);return;}
  fbRef.once('value').then(snap=>{
    const srv=snap.val()||{};
    const before=JSON.stringify(fbSnapshot());
    applyingRemote=true;
    FB_VAL_BRANCHES.forEach(k=>{ if(srv[k]!==undefined&&srv[k]!==null)S[k]=srv[k]; });
    FB_MAP_BRANCHES.forEach(k=>{
      S[k]=srv[k]||{};
      _fbSeen[k]={};Object.keys(S[k]).forEach(id=>{_fbSeen[k][id]=1;});
    });
    S.rev=+srv.rev||0;_fbRemoteRev=S.rev;
    normalizeState();
    applyTombstones();
    applyingRemote=false;
    _fbLast=fbSnapshot();
    _fbReady=true;
    const changed=(before!==JSON.stringify(_fbLast));
    if(changed)fbTouch();
    setSync(true,'Đã đồng bộ');
    cb&&cb(changed?1:0);
  }).catch(e=>{console.warn('FB reconcile',e);cb&&cb(-1);});
}
/* Nút "Đồng bộ lại" cho màn Dữ liệu — người dùng nghi ngờ lệch thì bấm. */
function fbResync(){
  if(!fbRef){toast(t('Chưa kết nối Firebase'));return;}
  setSync(true,'Đang đối chiếu…');
  fbReconcile(n=>{
    if(n<0){toast(t('Đối chiếu thất bại'));return;}
    toast(n?t('Đã tải lại dữ liệu mới nhất từ Firebase'):t('Dữ liệu đã khớp'));
  });
}

function setSync(on,txt){
  $('syncDot').classList.toggle('on',on);$('syncTxt').textContent=txt;$('fbStatus').textContent=txt;
  // Hiện luôn trạng thái ở màn hình đăng nhập — không thì người dùng không biết vì sao login trượt
  const gd=$('gateDot'),gt=$('gateStatusTxt');
  if(gd)gd.classList.toggle('on',on);
  if(gt){
    const n=(S.employees||[]).length;
    gt.textContent=txt+(n?(' · '+n+' nhân viên'):' · chưa có dữ liệu nhân sự');
  }
}
function saveFbCfg(){
  const v=$('fbCfg').value.trim();
  if(!v){toast('Chưa dán config');return;}
  try{JSON.parse(v);}catch(e){toast('JSON không hợp lệ');return;}
  localStorage.setItem(LS+'_fb',v);toast('Đã lưu — đang kết nối');initFb();
}
function clearFbCfg(){localStorage.removeItem(LS+'_fb');if(fbRef){fbRef.off();fbRef=null;}$('fbCfg').value='';toast('Về config mặc định — đang kết nối');initFb();}
/* Máy không còn giữ dữ liệu nghiệp vụ nào, nên nút này chỉ còn ý nghĩa
   "tải lại từ đầu từ Firebase". Giữ tên hàm cho chỗ gọi khỏi phải sửa. */
function wipeAll(){
  if(!confirm(t('Tải lại toàn bộ dữ liệu từ Firebase?')))return;
  try{localStorage.removeItem(LS);localStorage.removeItem(LS+'_synced');}catch(e){}
  location.reload();
}
