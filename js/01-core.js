/* ============================================================
   STATE + UTILS  — bien toan cuc, ma ca, ham tien ich
   LPGT Cavern — Quan ly Cong Ca v4
   ============================================================ */
/* =================== STATE =================== */
/* Cau hinh nam o js/config.js (khong up GitHub). Neu thieu file do,
   app van chay duoc o che do offline voi gia tri trung tinh duoi day. */
window.APP_CFG = window.APP_CFG || {};
APP_CFG.firebase    = APP_CFG.firebase    || null;
APP_CFG.dbPath      = APP_CFG.dbPath      || 'shiftwork_v2';
APP_CFG.storageKey  = APP_CFG.storageKey  || 'lpgt_shiftwork_v2';
APP_CFG.deptDefault = APP_CFG.deptDefault || 'Bo phan';
APP_CFG.approver1   = APP_CFG.approver1   || '';
APP_CFG.approver2   = APP_CFG.approver2   || '';
APP_CFG.defaultPin  = APP_CFG.defaultPin  || '1234';

const LS=APP_CFG.storageKey;
const DEPT_DEFAULT_FALLBACK=APP_CFG.deptDefault;
const APPROVER1_FALLBACK=APP_CFG.approver1, APPROVER2_FALLBACK=APP_CFG.approver2;
const DEFAULT_PIN=APP_CFG.defaultPin;
const DEFAULT_CODES=[
 {c:'O', l:'Office / Hành chính 08–17h', col:'var(--cO)', cat:'work'},
 {c:'D', l:'Ca ngày 08–20h', col:'var(--cD)',  cat:'work'},
 {c:'N', l:'Ca đêm 20–08h',  col:'var(--cN)',  cat:'work'},
 {c:'R', l:'Nghỉ ca (Rest)', col:'var(--cR)',  cat:'rest'},
 {c:'AL8',l:'Phép năm 8h',   col:'var(--cAL)', cat:'leave'},
 {c:'AL4',l:'Phép năm 4h',   col:'var(--cAL)', cat:'leave'},
 {c:'NP', l:'Nghỉ không lương', col:'var(--cNP)', cat:'leave'},
 {c:'OFF',l:'Nghỉ bù / OFF', col:'var(--cNP)', cat:'leave'},
 {c:'SD', l:'Đổi sang ca D', col:'var(--cSW)', cat:'swap'},
 {c:'SN', l:'Đổi sang ca N', col:'var(--cSW)', cat:'swap'},
 {c:'SO', l:'Đổi sang ca O', col:'var(--cSW)', cat:'swap'},
 {c:'OTD',l:'Tăng ca ngày',  col:'var(--cOT)', cat:'ot'},
 {c:'OTN',l:'Tăng ca đêm',   col:'var(--cOT)', cat:'ot'},
 {c:'X',  l:'Tăng ca nhập tàu', col:'var(--cOT)', cat:'ot'}
];
// Giờ công mặc định theo mã ca (chỉnh / thêm ở tab Dữ liệu)
const DEFAULT_HOURS={O:8,D:12,N:12,R:0,AL8:8,AL4:4,NP:0,OFF:0,SD:12,SN:12,SO:8,OTD:12,OTN:12,X:12};
let S={
  employees:[],           // {id,name,pos,role,team,empType,shiftType,a1,a2,order,active}
  base:{},                // base[empId][iso] = code   (bảng chuẩn, do generator điền)
  over:{},                // over[empId][iso] = {code, reqId?, by, at}  (sửa tay)
  requests:{},            // requests[id] = {...}
  accounts:{},            // accounts[empId] = {hash, by, at}  (whitelist đăng nhập nhân viên)
  settings:{pin:DEFAULT_PIN,minD:3,minN:3,hours:{},customCodes:[],deptDefault:DEPT_DEFAULT_FALLBACK,approver1:APPROVER1_FALLBACK,approver2:APPROVER2_FALLBACK},
  printLog:{},            // printLog[batchId] = {ts, by, formType, reqIds:[...], rows, pages, reprint}
  meta:{schedFrom:'',schedTo:''},
  rev:0
};
/* mgr = được duyệt đơn & sửa lịch (quyền 'appr' hoặc 'admin')
   adm = quản trị toàn quyền (quyền 'admin') — suy ra từ cột Quyền trong danh sách nhân viên */
let mgr=false, adm=false, fb=null, fbRef=null, applyingRemote=false, curCell=null, curView='cal';
/* v4 mobile cal state */
let calMode='std', calMobileView='week', calDate=null, calCollapsed={};
const isMobile=()=>window.matchMedia('(max-width:767px)').matches;

/* =================== UTILS =================== */
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const isoOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const todayIso=()=>isoOf(new Date());
const DOW=['CN','T2','T3','T4','T5','T6','T7'];
const DOW_EN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtVN=iso=>{const[y,m,d]=iso.split('-');return d+'/'+m;};
const fmtVNfull=iso=>{const[y,m,d]=iso.split('-');return d+'/'+m+'/'+y;};
const dowOf=iso=>DOW[new Date(iso+'T00:00:00').getDay()];
const dayNum=iso=>Math.round(new Date(iso+'T00:00:00').getTime()/86400000);
function toast(m){const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',2600);}
function allCodes(){return DEFAULT_CODES.concat((S.settings&&S.settings.customCodes)||[]);}
function codeInfo(c){return allCodes().find(x=>x.c===c)||{c,l:c,col:'#64748B',cat:'other'};}
function getHours(c){
  const h=(S.settings&&S.settings.hours)||{};
  if(h[c]!==undefined&&h[c]!==''&&h[c]!==null)return +h[c]||0;
  if(DEFAULT_HOURS[c]!==undefined)return DEFAULT_HOURS[c];
  return 0;
}
function chip(c,big){const i=codeInfo(c);return `<span class="cc${big?' big':''}" style="background:${i.col}">${c}</span>`;}
function eff(empId,iso){const o=S.over[empId]&&S.over[empId][iso];if(o&&o.code)return{code:o.code,ovr:true,o};const b=S.base[empId]&&S.base[empId][iso];return b?{code:b,ovr:false}:{code:'',ovr:false};}
function empById(id){return S.employees.find(e=>e.id===id);}
const ROLE_ORD={eng:0,oper:1,other:2};
function activeEmps(){return S.employees.filter(e=>e.active!==false).slice().sort((a,b)=>{
  const t=(a.team||'~~').localeCompare(b.team||'~~');if(t)return t;
  const r=(ROLE_ORD[a.role]??3)-(ROLE_ORD[b.role]??3);if(r)return r;
  return (a.order||999)-(b.order||999);});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function newVc(){let id;do{id='vc'+Math.floor(10000000+Math.random()*89999999);}while(empById(id));return id;}
function esc(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
/* Bỏ dấu tiếng Việt để tìm kiếm theo tên: "Hoàng Trung" khớp "hoang trung" */
function noAccent(s){
  return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\u0111]/g,'d').replace(/[\u0110]/g,'D').toLowerCase().trim();
}
function firstOfMonthIso(){const d=new Date();return isoOf(new Date(d.getFullYear(),d.getMonth(),1));}
function lastOfMonthIso(){const d=new Date();return isoOf(new Date(d.getFullYear(),d.getMonth()+1,0));}
function curMonthStr(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1);}
