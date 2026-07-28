# LPGT Cavern — Quản lý Công Ca (v4)

Ứng dụng web quản lý lịch ca, đăng ký / duyệt đơn và in biểu mẫu chấm công.
Chạy hoàn toàn phía trình duyệt (không cần server), đồng bộ qua Firebase Realtime Database.

---

## ⚠️ Trước khi upload lên GitHub — đọc phần này

| File | Có lên GitHub? | Vì sao |
|---|---|---|
| `index.html`, `css/`, `js/*.js` | ✅ Có | Chỉ là mã nguồn giao diện |
| `js/config.example.js` | ✅ Có | Chỉ chứa giá trị mẫu |
| **`js/config.js`** | ❌ **KHÔNG** | Chứa Firebase key, tên người duyệt, PIN — đã có trong `.gitignore` |
| File `.xlsx`, `.csv`, dữ liệu nhân sự | ❌ KHÔNG | Để **ngoài** folder này |
| `SPEC_*.md` (tài liệu nội bộ) | ❌ KHÔNG | Đã chặn trong `.gitignore` |

**Quy tắc vàng:** chỉ đặt vào folder `LPGT-CongCa-Web/` những gì thuộc về giao diện web.
Mọi dữ liệu công ty (bảng lương, danh sách nhân sự, file Excel) để ở thư mục cha, bên ngoài folder này.

Trước mỗi lần push, chạy nhanh:

```bash
git status          # js/config.js KHÔNG được xuất hiện trong danh sách
```

---

## Cấu trúc

```
LPGT-CongCa-Web/
├── index.html              # Khung HTML + nạp CSS/JS (không chứa logic)
├── css/
│   ├── app.css             # Giao diện chính: biến màu, layout, các tab
│   ├── portal.css          # Cổng đăng nhập + trang chính nhân viên
│   └── print.css           # Module in đơn (A5 ngang / 2up A4 dọc)
├── js/
│   ├── config.example.js   # MẪU cấu hình — copy thành config.js
│   ├── config.js           # ❌ Cấu hình thật (gitignored)
│   ├── 01-core.js          # State toàn cục, mã ca, hàm tiện ích
│   ├── 02-storage.js       # localStorage + đồng bộ Firebase
│   ├── 03-nav.js           # Chuyển tab, bottom sheet, chế độ quản lý
│   ├── 04-schedule.js      # Kỳ công 21→20 + bộ sinh lịch ca
│   ├── 05-roster.js        # Nhóm & danh sách nhân sự
│   ├── 06-calendar.js      # Lịch ca: matrix desktop, thẻ tuần/ngày mobile
│   ├── 07-manpower.js      # Nhân lực theo ngày
│   ├── 08-requests.js      # Đăng ký + Duyệt đơn
│   ├── 09-print.js         # Dựng biểu mẫu, in lẻ / hàng loạt, nhật ký in
│   ├── 10-account.js       # SHA-256, tài khoản tự động, cổng đăng nhập
│   ├── 11-stats-data.js    # Thống kê, khai báo giờ, export XLSX, cài đặt
│   ├── 13-portal.js        # Trang chính nhân viên (lịch tuần/tháng, sheet theo ngày)
│   └── 12-main.js          # Boot — luôn nạp CUỐI CÙNG
├── .gitignore
└── README.md
```

**Thứ tự nạp script rất quan trọng** — các file dùng biến toàn cục dùng chung, không phải ES module.
`12-main.js` phải nằm cuối vì nó gọi hàm của mọi file khác.
Khi thêm file mới, chèn thẻ `<script>` vào trước `12-main.js`.

---

## Đăng nhập & phân quyền

**Tài khoản = mã nhân viên.** Khi quản lý thêm một người vào tab *Nhóm & Lịch* và nhập mã NV thật,
app tự tạo tài khoản đăng nhập với **mật khẩu ban đầu = chính mã NV đó**. Không cần cấp tay.

- Mã tạm dạng `vc########` (do nút "＋ Người" sinh ra) chưa được coi là tài khoản.
- Đổi mã NV → tài khoản cũ bị thu hồi, tài khoản mới cấp lại với mật khẩu = mã mới; đơn cũ và lịch ca tự trỏ sang mã mới.
- Xoá nhân viên → thu hồi tài khoản.
- Nhân viên vào mục **Tài khoản** để đổi mật khẩu. Khi còn dùng mật khẩu mặc định, trang chính hiện banner nhắc.

**Quản lý** vào bằng nút *🔑 Vào chế độ Quản lý (PIN)* ngay ở màn hình đăng nhập.
PIN đặt trong `js/config.js` (`defaultPin`), đổi lại được ở tab Dữ liệu.
Chế độ quản lý lưu trong `sessionStorage` → tự tắt khi đóng trình duyệt.
Các nút chỉ dành cho quản lý mang class `.mgr-only` và bị ẩn với nhân viên thường.

---

## Trang chính của nhân viên (`13-portal.js`)

Là màn hình đầu tiên ngay sau khi đăng nhập:

- **Lịch cá nhân** xem theo **Tuần** hoặc **Tháng**, lấy ca từ *lịch thực tế* (`eff()` = lịch chuẩn + điều chỉnh đã duyệt).
- **Chạm vào ngày bất kỳ** → sheet hiện ca hôm đó, đồng nghiệp trực cùng, đơn đang có, và 7 nút gửi đơn
  (nghỉ phép · đổi ca · tăng ca · đổi mã ca · bổ sung công · đi trễ/về sớm · làm liên tục nhiều ngày) — ngày đã điền sẵn.
- **Đổi ca**: danh sách đồng nghiệp tự xếp người **đang nghỉ (R)** lên đầu, rồi tới người cùng nhóm.
- **Cảnh báo trùng đơn** trước khi gửi; **thông báo** khi đơn được duyệt / từ chối.
- **Đếm ngược ca kế tiếp**, ngày nghỉ gần nhất, cảnh báo khi làm ≥ 7 ngày liên tục.
- **Thẻ số liệu**: giờ công kỳ này · tăng ca đã duyệt + đang chờ · phép năm còn lại · số đơn đang chờ.
- **Xuất lịch `.ics`** để thêm vào Lịch điện thoại.

Tham số chỉnh nhanh ở đầu `js/13-portal.js`:
`SHIFT_CLOCK` (giờ ca), `AL_QUOTA_DEFAULT` (quỹ phép năm), `STREAK_WARN` (ngưỡng cảnh báo ngày làm liên tục).

---

## Cài đặt trên máy mới

1. Clone / tải repo về.
2. Copy `js/config.example.js` → `js/config.js`.
3. Mở `js/config.js`, điền `firebase`, `deptDefault`, `approver1/2`, `defaultPin`.
4. Mở `index.html` bằng trình duyệt (double-click là chạy được, không cần server).

Nếu thiếu `js/config.js`, app vẫn mở được nhưng chỉ chạy offline (localStorage), thanh trạng thái báo *"Chưa có config"*.

---

## Publish lên GitHub Pages

```bash
cd LPGT-CongCa-Web
git init
git add .
git commit -m "LPGT Cong Ca v4"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Vào **Settings → Pages → Source: main / (root)** → link dạng `https://<user>.github.io/<repo>/`.

> Vì `js/config.js` không được push, bản GitHub Pages sẽ chạy offline.
> Muốn bản online đồng bộ Firebase: hoặc để repo **Private** rồi bỏ dòng `js/config.js` khỏi `.gitignore`,
> hoặc người dùng tự dán `firebaseConfig` một lần ở tab **Dữ liệu** (lưu trong localStorage của máy họ).

---

## Bảo mật Firebase

API key của Firebase Web **không phải mật khẩu** — ai mở app cũng đọc được từ trình duyệt.
Lớp bảo vệ thật nằm ở **Realtime Database Rules**. Hãy giới hạn quyền đọc/ghi trên node `shiftwork_v2`
(ví dụ chỉ cho user đã xác thực), thay vì trông cậy vào việc giấu key.

---

## Nâng cấp về sau

- Sửa giao diện → `css/app.css`; sửa biểu mẫu in → `css/print.css` + `js/09-print.js`.
- Thêm mã ca mặc định → `DEFAULT_CODES` / `DEFAULT_HOURS` trong `js/01-core.js`.
- Đổi quy tắc sinh lịch → `js/04-schedule.js`.
- Thêm tab mới → thêm `<section class="view" id="v-xxx">` trong `index.html`, thêm file JS mới, khai báo script ở cuối `index.html`.
