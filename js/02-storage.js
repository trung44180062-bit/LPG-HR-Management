/* ============================================================
   STORAGE + FIREBASE — localStorage, dong bo Realtime DB
   LPGT Cavern — Quan ly Cong Ca v4
   ------------------------------------------------------------
   ĐỒNG BỘ THEO DELTA (từ bản v4.7)

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
let _fbSettleT=null;     // hẹn giờ "đã tải xong đợt đầu"
let _fbRenderT=null;     // gộp nhiều sự kiện con thành một lần vẽ lại
let _fbBooted=false;     // đã xử lý xong đợt đồng bộ đầu tiên chưa

/* ============================================================
   ★ v6.4 — HAI LỖ HỔNG LÀM "XOÁ RỒI VẪN HIỆN"

   LỖ 1 — GHI TRƯỢT MÀ APP TƯỞNG ĐÃ GHI
   Bản cũ đặt `_fbLast=cur` NGAY TRƯỚC `fbRef.update()`, lỗi chỉ rơi vào
   console.warn. Firebase update() là NGUYÊN KHỐI: rớt mạng, sai luật, hết
   quota → CẢ GÓI trượt. Nhưng mốc đã dời, nên lần ghi sau tính delta so với
   một hiện trạng KHÔNG CÓ THẬT trên máy chủ → thay đổi đó biến mất vĩnh
   viễn. Xoá đơn trên điện thoại rồi tắt máy đúng lúc mạng chập là mất luôn
   lệnh xoá; PC mở lên vẫn thấy đơn.
   → Nay: giữ mốc cũ, chỉ dời SAU KHI máy chủ xác nhận; ghi trượt thì bật cờ
     bẩn, báo lên thanh trạng thái và tự thử lại (fbRetry).

   LỖ 2 — ĐẨY NGƯỢC BẢN GHI ĐÃ XOÁ (HỒI SINH)
   fbBootSync cũ quyết định bằng cách so `rev`: máy chủ mới hơn thì dọn theo
   máy chủ, ngược lại thì `fbPush()` đẩy phần "máy chủ thiếu" lên. Mà `rev`
   là Date.now() của máy — lệch giờ, hoặc máy này vừa thao tác gì đó, là rơi
   vào nhánh đẩy lên, và bản ghi máy khác vừa xoá bị đẩy sống lại.
   Bia mộ chỉ đỡ được khi bia mộ TỚI ĐƯỢC máy này — mà bia mộ cũng có thể
   trượt vì LỖ 1, hoặc bị dọn sau 180 ngày, hoặc dữ liệu bị xoá tay trên
   Firebase Console.
   → Nay bỏ hẳn việc so đồng hồ. Máy giữ một SỔ ĐÃ ĐỒNG BỘ (_fbSynced):
     id nào máy này BIẾT CHẮC máy chủ đã từng có. Lúc mở app:
       · máy chủ không có + CÓ trong sổ  → máy khác đã xoá → xoá theo
       · máy chủ không có + KHÔNG trong sổ → mình tạo lúc mất mạng → đẩy lên
     Không phụ thuộc đồng hồ, không phụ thuộc bia mộ tới kịp hay không.
   ============================================================ */
let _fbSynced=null;      // {nhánh: {id:1}} — id máy này biết máy chủ đã từng có
let _fbDirty=false;      // còn thay đổi chưa ghi được lên máy chủ
let _fbRetryT=null;      // hẹn giờ thử ghi lại
let _fbRetryMs=2000;     // giãn dần 2s → 4s → … tối đa 30s

function syncedKey(){return LS+'_synced';}
function syncedLoad(){
  try{_fbSynced=JSON.parse(localStorage.getItem(syncedKey())||'null');}catch(e){_fbSynced=null;}
  const fresh=!_fbSynced;
  if(!_fbSynced)_fbSynced={};
  FB_MAP_BRANCHES.forEach(k=>{_fbSynced[k]=_fbSynced[k]||{};});
  return fresh;            // true = lần đầu chạy bản mới, chưa có sổ
}
function syncedSave(){
  try{localStorage.setItem(syncedKey(),JSON.stringify(_fbSynced));}catch(e){}
}
function syncedMark(branch,id,on){
  if(!_fbSynced)syncedLoad();
  _fbSynced[branch]=_fbSynced[branch]||{};
  if(on)_fbSynced[branch][id]=1; else delete _fbSynced[branch][id];
}
/* Ghi nhận cả một gói vừa được máy chủ XÁC NHẬN — khoá null là đã xoá */
function syncedApplyPatch(patch){
  Object.keys(patch||{}).forEach(k=>{
    const p=k.split('/');
    if(p.length!==2)return;
    if(FB_MAP_BRANCHES.indexOf(p[0])<0)return;
    syncedMark(p[0],p[1],patch[k]!==null&&patch[k]!==undefined);
  });
  syncedSave();
}

/* =================== STORAGE =================== */
function save(){
  /* Nhân viên vừa thêm mới chưa có accessor tên → gắn trước khi lưu */
  if(typeof decorateEmpNames==='function')decorateEmpNames(S.employees);
  S.rev=Date.now();
  localStorage.setItem(LS,JSON.stringify(S));
  fbPush();
  refreshBadge();
}
function load(){
  try{const raw=localStorage.getItem(LS);if(raw){const d=JSON.parse(raw);S=Object.assign(S,d);
    S.settings=Object.assign({minD:3,minN:3,deptDefault:DEPT_DEFAULT_FALLBACK,approver1:APPROVER1_FALLBACK,approver2:APPROVER2_FALLBACK},d.settings||{});
    S.meta=Object.assign({schedFrom:'',schedTo:''},d.meta||{});}}catch(e){}
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
    syncedApplyPatch(patch);           // máy chủ đã xác nhận → cập nhật sổ đã-đồng-bộ
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
    localStorage.setItem(LS,JSON.stringify(S));
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

function fbAttach(){
  fbRef=firebase.database().ref(APP_CFG.dbPath);
  _fbLast=null;                 // chưa biết máy chủ có gì → đợi đợt đầu về
  _fbSeen={};_fbBooted=false;_fbRemoteRev=0;
  FB_MAP_BRANCHES.forEach(k=>{_fbSeen[k]={};});
  syncedLoad();

  /* ------------------------------------------------------------
     ĐỐI CHIẾU LẠI KHI CÓ MẠNG TRỞ LẠI  ★ v6.4
     Máy để mở cả ngày (PC trong phòng điều độ) không chạy lại fbAttach nên
     fbBootSync chỉ chạy đúng một lần lúc sáng. Rớt mạng vài phút rồi nối
     lại, Firebase KHÔNG bắn lại child_added cho những con không đổi, nên
     bản ghi bị xoá trong lúc rớt có thể nằm lại trên màn hình tới hết ca.
     Ở đây bắt '.info/connected': hễ nối lại thì đọc một phát hiện trạng và
     đối chiếu. Tốn một lượt tải nhưng chỉ khi vừa mất mạng xong.
     ------------------------------------------------------------ */
  try{
    firebase.database().ref('.info/connected').on('value',s=>{
      const on=!!(s&&s.val());
      if(!on){setSync(false,'Mất kết nối');return;}
      if(_fbBooted)fbReconcile();
      if(_fbDirty)fbPush();          // gửi nốt phần còn nợ
    });
  }catch(e){}

  /* rev — chỉ để biết dữ liệu bên nào mới hơn, tốn vài byte */
  fbRef.child('rev').on('value',s=>{_fbRemoteRev=+s.val()||0;fbSettle();},fbErr);

  /* Nhánh nhỏ: nghe trọn gói */
  FB_VAL_BRANCHES.forEach(k=>{
    fbRef.child(k).on('value',snap=>{
      const val=snap.val();
      if(val===null){fbSettle();setSync(true,'Đã đồng bộ');return;}
      const js=JSON.stringify(val);
      if(_fbLast&&_fbLast.v[k]===js){setSync(true,'Đã đồng bộ');fbSettle();return;}  // tiếng vọng của chính mình
      applyingRemote=true;
      S[k]=val;
      normalizeState();
      applyingRemote=false;
      fbMark(k,null,JSON.stringify(S[k]));
      fbTouch();fbSettle();
      setSync(true,'Đã đồng bộ');
    },fbErr);
  });

  /* Nhánh bảng: nghe ở mức con → chỉ phần thay đổi bay về */
  FB_MAP_BRANCHES.forEach(k=>{
    const ref=fbRef.child(k);
    const put=snap=>{
      const id=snap.key, val=snap.val(), js=JSON.stringify(val);
      _fbSeen[k][id]=1;
      /* Id đã có bia mộ mà vẫn thấy trên máy chủ = tin lạc từ một máy chưa kịp
         nhận bia mộ → gỡ khỏi máy chủ lần nữa và KHÔNG nhận về. Nhờ vậy dù
         một máy lỡ đẩy lại, các máy khác sẽ dọn sạch, hội tụ về đã-xoá. */
      if(S.del&&S.del[k+'/'+id]!==undefined){
        if(!applyingRemote){fbRef.child(k).child(id).remove().catch(()=>{});}
        if(S[k]&&S[k][id]!==undefined){applyingRemote=true;delete S[k][id];applyingRemote=false;fbTouch();}
        syncedMark(k,id,0);syncedSave();
        fbSettle();return;
      }
      /* Máy chủ ĐANG CÓ id này → ghi vào sổ đã-đồng-bộ. Nhờ vậy lần mở app
         sau, nếu máy chủ không còn id đó nữa thì máy này biết chắc là ĐÃ BỊ
         XOÁ (chứ không phải bản ghi mình tạo lúc mất mạng) và xoá theo. */
      syncedMark(k,id,1);syncedSave();
      if(_fbLast&&_fbLast.m[k]&&_fbLast.m[k][id]===js){fbSettle();return;}
      applyingRemote=true;
      S[k]=S[k]||{};S[k][id]=val;
      applyingRemote=false;
      fbMark(k,id,js);
      fbTouch();fbSettle();
    };
    const del=snap=>{
      const id=snap.key;
      delete _fbSeen[k][id];
      syncedMark(k,id,0);syncedSave();
      if(!S[k]||S[k][id]===undefined){fbSettle();return;}
      applyingRemote=true;
      delete S[k][id];
      applyingRemote=false;
      fbMark(k,id,undefined);
      fbTouch();fbSettle();
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
   XONG ĐỢT ĐẦU
   Firebase bắn hàng loạt sự kiện khi vừa gắn listener; đợi im lặng
   ~900ms là coi như đã tải xong ảnh hiện trạng của máy chủ. Lúc đó mới
   quyết định: máy chủ trống thì đẩy dữ liệu máy này lên (khởi tạo lần
   đầu); ngược lại thì dọn những bản ghi máy này còn giữ mà máy chủ đã xoá.
   ------------------------------------------------------------ */
function fbSettle(){
  clearTimeout(_fbSettleT);
  _fbSettleT=setTimeout(fbBootSync,900);
}
function fbBootSync(){
  if(_fbBooted||!fbRef)return;
  _fbBooted=true;
  setSync(true,'Đã đồng bộ');

  /* Bia mộ đã về từ máy chủ → dọn sạch id đã xoá còn sót trong bộ nhớ máy này
     TRƯỚC khi quyết định đẩy hay dọn, để không bao giờ đẩy lại đơn đã xoá. */
  const tombed=applyTombstones();

  const serverEmpty=!_fbRemoteRev&&!(_fbLast&&_fbLast.v.employees);
  if(serverEmpty){
    // Cơ sở dữ liệu còn trắng → đẩy toàn bộ dữ liệu máy này lên làm bản gốc
    if((S.employees||[]).length){_fbLast=null;fbPush();}
    if(tombed)fbTouch();
    return;
  }

  /* ============================================================
     ĐỐI CHIẾU LÚC MỞ APP  ★ v6.4 — KHÔNG CÒN SO ĐỒNG HỒ
     Với mỗi id máy này còn giữ mà máy chủ KHÔNG có:
       · có trong sổ đã-đồng-bộ  → máy khác đã xoá  → XOÁ THEO
       · không có trong sổ       → mình tạo lúc mất mạng → ĐỂ fbPush đẩy lên
     Lần đầu chạy bản mới chưa có sổ (freshBook): MÁY CHỦ LÀ ĐÚNG — dọn hết
     phần lệch, vì đó chính là đống rác tồn từ các lần hồi sinh trước.
     ============================================================ */
  const freshBook=syncedLoad();
  let n=0;
  applyingRemote=true;
  FB_MAP_BRANCHES.forEach(k=>{
    Object.keys(S[k]||{}).forEach(id=>{
      if(_fbSeen[k][id])return;                       // máy chủ đang có → giữ
      const known=freshBook || (_fbSynced[k]&&_fbSynced[k][id]);
      if(known){delete S[k][id];syncedMark(k,id,0);n++;}
    });
  });
  applyingRemote=false;
  syncedSave();
  if(n||tombed)fbTouch();                             // ★ có gỡ thì PHẢI vẽ lại
  if(n)console.info('[sync] gỡ '+n+' bản ghi máy chủ đã xoá');

  fbPush();   // đẩy phần máy chủ thật sự chưa có (bản ghi tạo lúc mất mạng)

  /* Dọn bia mộ quá hạn — mỗi lần mở app. Máy nào dọn thì đẩy sổ del đã gọn
     lên (kèm rev mới), các máy khác nhận về theo → sổ không phình năm tháng. */
  const pruned=pruneTombstones();
  if(pruned&&fbRef){
    S.rev=Date.now();
    fbRef.update({del:S.del,rev:S.rev}).catch(e=>console.warn('FB prune bia mộ',e));
    _fbLast=fbSnapshot();     // đồng bộ mốc để chặn tiếng vọng của chính mình
    fbTouch();
  }
}

/* ------------------------------------------------------------
   ĐỐI CHIẾU TOÀN PHẦN — đọc một phát hiện trạng máy chủ rồi khớp lại.
   Dùng khi: vừa nối lại mạng, hoặc người dùng bấm "Đồng bộ lại".
   Đây là lưới an toàn cuối: kể cả bia mộ mất, sổ sai, listener hụt sự kiện,
   một lần chạy hàm này là mọi máy về đúng bằng máy chủ.
   ------------------------------------------------------------ */
function fbReconcile(cb){
  if(!fbRef){cb&&cb(0);return;}
  fbRef.once('value').then(snap=>{
    const srv=snap.val()||{};
    let n=0;
    applyingRemote=true;
    FB_MAP_BRANCHES.forEach(k=>{
      const s=srv[k]||{};
      _fbSeen[k]={};Object.keys(s).forEach(id=>{_fbSeen[k][id]=1;});
      /* máy chủ có mà mình thiếu / khác → lấy về */
      Object.keys(s).forEach(id=>{
        if(S.del&&S.del[k+'/'+id]!==undefined)return;      // đã có bia mộ thì bỏ
        const js=JSON.stringify(s[id]);
        if(JSON.stringify((S[k]||{})[id])!==js){S[k]=S[k]||{};S[k][id]=s[id];n++;}
        syncedMark(k,id,1);
      });
      /* mình có mà máy chủ không → xoá nếu từng đồng bộ (tức là đã bị xoá) */
      Object.keys(S[k]||{}).forEach(id=>{
        if(s[id]!==undefined)return;
        if(_fbSynced[k]&&_fbSynced[k][id]){delete S[k][id];syncedMark(k,id,0);n++;}
      });
    });
    FB_VAL_BRANCHES.forEach(k=>{if(srv[k]!==undefined&&srv[k]!==null)S[k]=srv[k];});
    normalizeState();
    applyingRemote=false;
    n+=applyTombstones();
    syncedSave();
    _fbLast=fbSnapshot();
    if(n)fbTouch();
    setSync(true,'Đã đồng bộ');
    cb&&cb(n);
  }).catch(e=>{console.warn('FB reconcile',e);cb&&cb(-1);});
}
/* Nút "Đồng bộ lại" cho màn Dữ liệu — người dùng nghi ngờ lệch thì bấm. */
function fbResync(){
  if(!fbRef){toast(t('Chưa kết nối Firebase'));return;}
  setSync(true,'Đang đối chiếu…');
  fbReconcile(n=>{
    if(n<0){toast(t('Đối chiếu thất bại'));return;}
    toast(n?(t('Đã khớp lại')+' '+n+' '+t('bản ghi')):t('Dữ liệu đã khớp'));
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
function wipeAll(){if(!confirm(t('Xoá toàn bộ dữ liệu trên máy này?')))return;localStorage.removeItem(LS);location.reload();}
