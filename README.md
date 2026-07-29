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
│   ├── 03-nav.js           # Chuyển tab, bottom sheet
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

**Tài khoản = phần số của mã nhân viên.** Khi quản lý thêm một người vào tab *Nhóm & Lịch*
và điền mã NV + họ tên, app tự tạo tài khoản. Không cần cấp tay.

- Mã NV trong dữ liệu giữ nguyên (vd `vc44180062`) — bảng danh sách, biểu mẫu in, file Excel không đổi.
- **Màn hình đăng nhập chỉ dùng phần số**: tên đăng nhập `44180062`, mật khẩu ban đầu cũng `44180062`.
  Hàm `loginKey()` trong `10-account.js` lo việc này; bàn phím điện thoại nhờ vậy bật sẵn chế độ số.
- Vẫn chấp nhận gõ cả mã đầy đủ `vc44180062` để không ai bị kẹt.
- Dòng chưa điền họ tên thì chưa được cấp tài khoản.
- Nếu hai người trùng phần số, app báo lỗi thay vì cho vào nhầm — quản lý phải sửa mã cho khác nhau.
- Đổi mã NV → tài khoản cũ bị thu hồi, tài khoản mới cấp lại với mật khẩu = mã số mới; đơn cũ và lịch ca tự trỏ sang mã mới.
- Xoá nhân viên → thu hồi tài khoản.
- Nhân viên vào mục **Tài khoản** (biểu tượng 🔑 ở trang chính) để đổi mật khẩu.

### Phân quyền

Không còn chế độ Quản lý mở bằng PIN. Quyền khai báo ở cột **Quyền** trong bảng
danh sách nhân viên (tab *🛠️ Nhóm & Lịch*), lưu ở trường `e.perm`:

| `perm` | Thấy được |
|---|---|
| `staff` (mặc định) | Trang chính, Lịch, Nhân lực, Thống kê, gửi đơn |
| `appr` | + tab **Duyệt**, sửa lịch thực tế, In đơn |
| `admin` | + tab **Nhóm & Lịch**, **Dữ liệu**, cấp/reset mật khẩu, đổi quyền người khác |

`ROOT_ADMIN` (`vc44180062` — Hoàng Trung) luôn là quản trị và không thể bị hạ quyền,
để luôn có người cấp quyền cho những người còn lại.

Trong code: `applyPerm()` (js/10-account.js) đọc quyền của người đang đăng nhập và đặt
hai cờ toàn cục — `mgr` (duyệt đơn trở lên) và `adm` (quản trị). `applyRoleUI()` ẩn/hiện
các phần tử mang class `.mgr-only` và `.admin-only` theo hai cờ này.

---

## Trang chính của nhân viên (`13-portal.js`)

Là màn hình đầu tiên ngay sau khi đăng nhập. Bố cục tối ưu cho điện thoại: mở app lên
là **thấy ngay lịch cả tháng**, các thẻ số liệu đẩy xuống dưới lịch.

- **Lịch cá nhân** mặc định xem **Tháng** (đổi được sang Tuần), lấy ca từ *lịch thực tế*
  (`eff()` = lịch chuẩn + điều chỉnh đã duyệt).
- Chế độ Tháng chạy theo **kỳ công của công ty: 21 tháng trước → 20 tháng này**
  (dùng `daysOfPeriod`/`periodFor`), không phải tháng dương lịch. Nút ◀ ▶ nhảy theo kỳ,
  các ngày thuộc tháng đầu kỳ (≥21) có nền nhạt + viền đứt, ngày mùng 1 hiện thêm số tháng.
- **Chạm vào ngày bất kỳ** → sheet hiện ca hôm đó, **nhân sự trong ngày xếp thành cột theo nhóm ca**
  (O · D · N · OT · **R nghỉ ca**) — tên rút gọn 2 chữ kèm số nhóm, ô của mình tô đậm —
  đơn đang có, và 7 nút gửi đơn (nghỉ phép · đổi ca · tăng ca · đổi mã ca · bổ sung công ·
  đi trễ/về sớm · làm liên tục nhiều ngày) — ngày đã điền sẵn.
- **Mỗi ngày 1 dòng** (đúng quy định biểu mẫu công ty): form đơn là một **danh sách dòng**,
  mỗi dòng chọn **1 ngày** + mã ca (hoặc giờ vào/ra) riêng, bấm **＋ Thêm ngày** để khai
  nhiều ngày rời rạc trong cùng một đơn (tối đa `DS_MAX_ROWS` = 10 dòng — bằng số dòng của
  biểu mẫu in). Lưu ở `r.days=[{iso,code,timeIn,timeOut}]`; `r.from`/`r.to` là ngày đầu/cuối
  để tương thích đơn cũ. Riêng **Làm liên tục nhiều ngày** vẫn chọn theo **khoảng ngày**.
- **Đổi ca**: ô **tìm theo tên** (gõ không dấu vẫn khớp, `noAccent()`), người **đang nghỉ (R)**
  ngày đó được xếp lên đầu. Có ô **Người đứng đơn** để **khai hộ** đồng nghiệp — đơn ghi
  `r.byId` (người bấm gửi) khác `r.empId` (người đứng đơn); khi in, mỗi ngày sinh **2 dòng**
  cho cả hai người để thấy rõ việc đổi qua đổi lại.
- **Cảnh báo trùng đơn / trùng ngày / vượt phép năm** trước khi gửi; **thông báo** khi đơn được duyệt / từ chối.
- Cảnh báo khi làm ≥ 7 ngày liên tục.
- **Thẻ số liệu**: giờ công kỳ này · tăng ca đã duyệt + đang chờ · phép năm còn lại · số đơn đang chờ.
- **Phép năm sửa được**: phần mềm đưa vào dùng giữa năm nên nhân viên tự khai **số phép còn lại**
  tại một mốc ngày trong bảng *🏖 Phép năm* (`e.alLeftBase` + `e.alLeftAt`); từ mốc đó hệ thống
  trừ dần các ngày AL. Chưa khai mốc thì vẫn tính theo quỹ `AL_QUOTA_DEFAULT`.

Tham số chỉnh nhanh ở đầu `js/13-portal.js`:
`AL_QUOTA_DEFAULT` (quỹ phép năm), `STREAK_WARN` (ngưỡng cảnh báo ngày làm liên tục),
`DS_MAX_ROWS` (số dòng tối đa mỗi đơn), `CREW_ORDER` (thứ tự nhóm ca trong sheet ngày).

> Tab **📝 Đăng ký** đã bỏ (07/2026) — mọi việc gửi đơn gom về trang chính; quản lý muốn
> nhập hộ thì dùng chính năng **khai hộ** trong đơn đổi ca.

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
