/* ============================================================
   MAU CAU HINH  —  file NAY duoc up len GitHub (khong chua du lieu that)
   Cach dung: copy file nay thanh  js/config.js  roi dien thong tin that.
   js/config.js da nam trong .gitignore nen se KHONG bi day len GitHub.
   ============================================================ */
var APP_CFG = {

  /* --- Firebase Realtime Database --- */
  firebase: {
    apiKey:            "DIEN_API_KEY_CUA_BAN",
    authDomain:        "your-project.firebaseapp.com",
    databaseURL:       "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "your-project",
    storageBucket:     "your-project.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId:             "1:000000000000:web:xxxxxxxxxxxx"
  },

  /* --- Duong dan node du lieu tren Realtime Database --- */
  dbPath: "shiftwork_v2",

  /* --- Khoa localStorage (doi neu muon chay nhieu ban song song) --- */
  storageKey: "lpgt_shiftwork_v2",

  /* --- Thong tin bo phan & nguoi duyet mac dinh (in tren bieu mau) --- */
  deptDefault: "Ten bo phan",
  approver1:   "Nguoi duyet 1",
  approver2:   "Nguoi duyet 2",

  /* --- PIN mo che do Quan ly lan dau (doi lai trong tab Du lieu) --- */
  defaultPin: "1234"
};
