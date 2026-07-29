/* ============================================================
   STORAGE + FIREBASE — localStorage, dong bo Realtime DB
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== STORAGE + FIREBASE =================== */
function save(){
  S.rev=Date.now();
  localStorage.setItem(LS,JSON.stringify(S));
  if(fbRef && !applyingRemote){fbRef.set(S).catch(e=>console.warn('FB write',e));}
  refreshBadge();
}
function load(){
  try{const raw=localStorage.getItem(LS);if(raw){const d=JSON.parse(raw);S=Object.assign(S,d);
    S.settings=Object.assign({pin:DEFAULT_PIN,minD:3,minN:3,deptDefault:DEPT_DEFAULT_FALLBACK,approver1:APPROVER1_FALLBACK,approver2:APPROVER2_FALLBACK},d.settings||{});
    S.meta=Object.assign({schedFrom:'',schedTo:''},d.meta||{});}}catch(e){}
  S.settings.hours=S.settings.hours||{};
  S.settings.customCodes=S.settings.customCodes||[];
  S.settings.deptDefault=S.settings.deptDefault||DEPT_DEFAULT_FALLBACK;
  S.settings.approver1=S.settings.approver1||APPROVER1_FALLBACK;
  S.settings.approver2=S.settings.approver2||APPROVER2_FALLBACK;
  S.accounts=S.accounts||{};
  S.printLog=S.printLog||{};
}
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
    const done=()=>{
      fbRef=firebase.database().ref(APP_CFG.dbPath);
      fbRef.on('value',snap=>{
        const d=snap.val();
        if(d && (d.rev||0)>(S.rev||0)){
          applyingRemote=true;
          S=Object.assign(S,d);
          S.employees=S.employees||[];S.base=S.base||{};S.over=S.over||{};S.requests=S.requests||{};
          S.accounts=S.accounts||{};S.settings=S.settings||{pin:DEFAULT_PIN,minD:3,minN:3};
          S.settings.hours=S.settings.hours||{};S.settings.customCodes=S.settings.customCodes||[];
          S.settings.deptDefault=S.settings.deptDefault||DEPT_DEFAULT_FALLBACK;
          S.settings.approver1=S.settings.approver1||APPROVER1_FALLBACK;S.settings.approver2=S.settings.approver2||APPROVER2_FALLBACK;
          S.printLog=S.printLog||{};
          localStorage.setItem(LS,JSON.stringify(S));
          renderAll();applyingRemote=false;
        }else if(d===null && S.employees.length){fbRef.set(S);}
        setSync(true,'Đã đồng bộ');
      },err=>{setSync(false,'Lỗi quyền');console.warn(err);});
    };
    if(firebase.auth){firebase.auth().signInAnonymously().then(done).catch(done);}else done();
    setSync(true,'Đang kết nối…');
  }catch(e){setSync(false,'Lỗi kết nối');console.warn(e);}
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
