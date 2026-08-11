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
│   ├── print.css           # Module in đơn (A5 ngang / 2up A4 dọc)
│   └── ui.css              # v5: lớp thiết kế mới (nạp CUỐI, ghi đè 2 file trên)
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
│   ├── 10-account.js       # PBKDF2, tài khoản, phân quyền, cổng đăng nhập
│   ├── 11-stats-data.js    # Thống kê, khai báo giờ, export XLSX, cài đặt
│   ├── 13-portal.js        # Trang chính nhân viên (lịch tuần/tháng, sheet theo ngày)
│   ├── 14-i18n.js          # Song ngữ Việt/Anh — nạp NGAY SAU 01-core.js
│   ├── 00-icons.js         # v5: icon SVG thay emoji (nạp NGAY SAU 14-i18n.js)
│   ├── 15-report.js        # Tab Báo cáo: Nhân lực · Thống kê · Biểu đồ (SVG thuần)
│   ├── 16-otlog-data.js    # Nhật ký tăng ca lấy từ file Excel của công ty
│   ├── 17-appr-sum.js      # Sub-tab Tổng quan trong tab Duyệt (bảng cho giám đốc)
│   ├── 18-advice.js        # Trợ lý duyệt đơn
│   ├── 19-meal.js          # Cơm phát sinh
│   ├── 20-events.js        # Sự kiện trên lịch (nhập tàu, bảo dưỡng…)
│   ├── 22-training.js      # v7.0: Lịch đào tạo (nạp NGAY SAU 20-events.js)
│   ├── 21-notify.js        # Hàng đợi + khuôn tin Zalo (tên file cố ý không có chữ "zalo")
│   └── 12-main.js          # Boot — luôn nạp CUỐI CÙNG
├── BAO-MAT.md              # Đánh giá bảo mật + việc cần làm
├── firebase-rules.json     # Luật truy cập, dán vào Firebase Console
├── mau-in-A5-xem-thu.html  # Xem thử 6 biểu mẫu in trên khung giấy A5
├── xem-thu-giao-dien.html  # Xem thử màn Duyệt & Báo cáo với dữ liệu mẫu
├── xem-thu-tong-quan-duyet.html # Xem thử sub-tab Tổng quan (dữ liệu giả)
├── .gitignore
└── README.md
```

**Thứ tự nạp script rất quan trọng** — các file dùng biến toàn cục dùng chung, không phải ES module.
`12-main.js` phải nằm cuối vì nó gọi hàm của mọi file khác.
Khi thêm file mới, chèn thẻ `<script>` vào trước `12-main.js`.

### Giao diện v5 (2026-07-31) — icon SVG + lớp `ui.css`

- **`js/00-icons.js`**: template và i18n vẫn viết emoji như cũ; script này quét DOM
  (MutationObserver, giống cơ chế i18n) và thay emoji đã khai trong `IC_MAP` bằng
  icon SVG nét mảnh kiểu Lucide (`.ici`, màu theo `currentColor`). `#printRoot`,
  `data-noic`, script/style/input/svg luôn được bỏ qua — biểu mẫu in giữ nguyên.
  Thêm emoji mới → khai thêm vào `IC_MAP` (+ `IC_SVG` nếu cần icon mới).
- **`css/ui.css`**: lớp ghi đè thiết kế (token màu, nút, thẻ, bottom nav, chip lọc,
  ô số liệu đồng bộ, `details.xp` cho đoạn giải thích gập). Nạp SAU app/portal/print.
- Màn Duyệt: bộ lọc nâng cao gập vào nút "⚙ Bộ lọc khác" (`apprAdvOpen`, 08-requests.js).

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

Xem chi tiết ở mục **Phân quyền & ngôn ngữ** phía dưới. Tóm tắt: quyền khai ở bảng
*👤 Tài khoản đăng nhập và phân quyền* (tab ⚙️ Dữ liệu), lưu ở `e.perm` —
`staff` · `sec` (Thư ký) · `appr` · `admin` · `kmgr`.

---

## Trang chính của nhân viên (`13-portal.js`)

Là màn hình đầu tiên ngay sau khi đăng nhập. Bố cục tối ưu cho điện thoại: mở app lên
là **thấy ngay lịch cả tháng**, các thẻ số liệu đẩy xuống dưới lịch.

- **Lịch cá nhân** mặc định xem **Tháng** (đổi được sang Tuần), lấy ca từ *lịch thực tế*
  (`eff()` = lịch chuẩn + điều chỉnh đã duyệt).
- Chế độ Tháng chạy theo **kỳ công của công ty: 21 tháng trước → 20 tháng này**
  (dùng `daysOfPeriod`/`periodFor`), không phải tháng dương lịch. Nút ◀ ▶ nhảy theo kỳ,
  các ngày thuộc tháng đầu kỳ (≥21) có nền nhạt + viền đứt, ngày mùng 1 hiện thêm số tháng.
- **Chạm vào ngày bất kỳ** → sheet hiện ca hôm đó, **nhân sự trong ngày xếp thành cột theo NHÓM CA THỰC TẾ**
  — ai đổi ca đã nằm sẵn ở nhóm mình thật sự đi làm hôm đó; chip viền cam có badge `⇄X` ghi ca chuẩn cũ.
  Nhãn nhóm `Office` viết gọn thành `O` (`teamShort()`). Các cột: O · D · N · OT ·
  **R nghỉ ca** · **AL nghỉ phép** — tên rút gọn 2 chữ kèm nhãn nhóm, ô của mình tô đậm.
  Bên dưới là đơn đang có và 7 nút gửi đơn (nghỉ phép · đổi ca · tăng ca · đổi mã ca · bổ sung công ·
  đi trễ/về sớm · làm liên tục nhiều ngày) — ngày đã điền sẵn.
- **Mỗi ngày 1 dòng** (đúng quy định biểu mẫu công ty): form đơn là một **danh sách dòng**,
  mỗi dòng chọn **1 ngày** + mã ca (hoặc giờ vào/ra) riêng, bấm **＋ Thêm ngày** để khai
  nhiều ngày rời rạc trong cùng một đơn (tối đa `DS_MAX_ROWS` = 10 dòng — bằng số dòng của
  biểu mẫu in). Lưu ở `r.days=[{iso,code,timeIn,timeOut}]`; `r.from`/`r.to` là ngày đầu/cuối
  để tương thích đơn cũ. Riêng **Làm liên tục nhiều ngày** vẫn chọn theo **khoảng ngày**.
- **Đổi ca chỉ giữa hai người đang có ca thật**: `SWAPPABLE()` chỉ nhận mã ca thuộc nhóm
  *work* / *rest* / *swap* — tức **O · D · N · R** (và mã tự khai cùng loại). Người đang
  **nghỉ phép** (AL8/AL4/NP/OFF) hoặc đang **tăng ca** (OTD/OTN/X) thì không đổi ca được:
  nghỉ phép rồi thì lấy ca đâu ra mà đổi. Kiểm ở ba chỗ — danh sách chọn người (xám, bấm
  không được, có ghi lý do), cảnh báo trực tiếp trong form, và chặn hẳn lúc bấm gửi
  (`swapBlockReason` / `swapBlockList`). Đơn nhiều ngày thì kiểm **từng ngày** cho cả hai người.
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

## Tab Báo cáo (gộp Nhân lực + Thống kê) — `js/15-report.js`

Trước đây là hai tab riêng và tab **Nhân lực bị lỗi trắng trang**: trong `renderMp()` cũ có
`const f=$('mpFrom').value, t=$('mpTo').value` — biến `t` che mất hàm dịch `t()`, gọi
`t('Hôm nay')` là ném lỗi ngay. Bản mới không dùng biến tên `t` nữa.

Một tab **📊 Báo cáo** với 3 chế độ chọn bằng nút gạt:

| Chế độ | Nội dung |
|---|---|
| 👥 Nhân lực | Biểu đồ cột chồng D/N/O/R theo ngày + đường định mức tối thiểu, rồi danh sách theo ngày (bấm mở tên) |
| 📊 Thống kê | 4 thẻ tổng + bảng số liệu cả tổ, nút Xuất Excel |
| 📈 Biểu đồ | Giờ công theo người · Cơ cấu ca (vành khuyên) · Giờ tăng ca theo nhóm |

Biểu đồ giờ công là **một thanh nối tiếp cho mỗi người** (`chartStackedH`): giờ công · giờ tăng ca ·
giờ phép xếp liền nhau trong cùng thanh, tổng ghi ở cuối — gọn hơn nhiều so với tách ba thanh.
Hai biểu đồ *Nhân lực theo ngày* đã bỏ vì trùng thông tin với bảng nhân lực.

**Phân quyền xem** (`repSeeAll()` = `mgr`):

- **Quản trị · Quản lý người Hàn · Duyệt đơn** → xem toàn bộ nhân sự.
- **Nhân viên thường** → chỉ thấy *📊 Số liệu của tôi* và *📈 Biểu đồ của tôi*; chế độ
  Nhân lực bị ẩn hẳn và tên người khác không xuất hiện ở đâu.

Biểu đồ vẽ bằng **SVG thuần** (`chartStacked` / `chartGroupedH` / `chartDonut`) — không
thêm thư viện ngoài, nên mở offline vẫn chạy và in ra giấy vẫn nét. Tooltip dịch ngay lúc
dựng chuỗi vì bộ quét DOM không khớp được chuỗi có chèn số.

---

## Đơn huỷ — xoá hẳn, không lưu

Huỷ đơn giờ **xoá hẳn** khỏi hệ thống, không giữ bản ghi *đã huỷ*: mỗi đơn nằm lại là thêm dữ
liệu phải đồng bộ, mà gói **Firebase Spark tính băng thông**. Nếu đơn đã duyệt thì
`revertReqSchedule()` gỡ đúng những ô lịch do nó tạo ra trước khi xoá (đổi ca hoàn tác cho cả
hai người). Trạng thái chỉ còn: `pending` · `approved` · `rejected`.

---

## Tab Duyệt — danh sách gọn

Bản cũ mỗi đơn là một thẻ to kèm 5 nút nên rất rối. Bản mới:

- **Một đơn = một dòng**: ô tích · biểu tượng loại đơn · tên · loại · trạng thái · nút ✓ ✕.
  Bấm vào dòng mới bung chi tiết từng ngày, thông tin gửi/duyệt/huỷ và các nút phụ
  (In · Huỷ đơn · Xoá hẳn).
- **Hai hàng chip lọc có số đếm**: trạng thái (Chờ duyệt · Đã duyệt · Từ chối · Tất cả) và
  tình trạng in (Mọi đơn · ○ Chưa in · 🖨️ Đã in). Số đếm tính theo các bộ lọc còn lại nên luôn khớp.
- **Lọc theo thời gian**: chọn kỳ công, hoặc *Khoảng ngày tự chọn…* rồi điền Từ / Đến.
- **🗑️ Dọn dữ liệu đang lọc** (quản trị): xoá hẳn mọi đơn đang khớp bộ lọc — dùng để dọn dữ
  liệu cũ theo kỳ hoặc theo khoảng ngày, giữ dung lượng Firebase ở mức thấp. Hộp xác nhận nói rõ
  khoảng ngày, số đơn còn chờ duyệt và cảnh báo hoàn tác lịch.
- Mỗi dòng có chip **đã in / chưa in**, chi tiết bung ra ghi cả thời điểm in và số lần in.
- **Thanh thao tác hàng loạt** chỉ hiện khi có đơn được chọn, dính trên đầu màn hình:
  Duyệt · Từ chối · In · Xoá đơn · Chọn hết · Bỏ chọn. `decide(id,ok,bulk)` nhận cờ
  `bulk` để không lưu và vẽ lại sau từng đơn.

---

## Tab Duyệt — sub-tab Tổng quan (`js/17-appr-sum.js`)

Tab Duyệt chia **2 sub-tab** (`apprTab`, nhớ ở localStorage): **📋 Danh sách đơn** (mặc định,
có badge số đơn chờ) và **📊 Tổng quan** — bảng cho giám đốc nhà máy, chỉ hiện với người có quyền duyệt.

Sub-tab Tổng quan có **kỳ công riêng** (`asYm`), **mặc định luôn là kỳ hiện tại**, không dính
vào bộ lọc của danh sách đơn. Header có nút ◀ ▶ nhảy kỳ + dropdown + nút *Về kỳ hiện tại*.

Bốn khối:

1. **6 thẻ chỉ số** — tổng đơn (kèm số dòng ngày đã khai) · đang chờ duyệt (kèm số đơn đã quá
   ngày làm) · **tổng giờ đã duyệt** · giờ tăng ca đã duyệt (kèm cờ vượt trần) · ngày phép ·
   duyệt rồi chưa in. Cố tình **không** có "tỉ lệ duyệt": cái cần điều hành là khối lượng giờ,
   không phải tỉ lệ gật/lắc của chính người đang xem.
2. **Dải tồn đọng & rủi ro** — chip chỉ hiện khi số > 0: ⌛ chờ quá 3 ngày · 🚩 quá ngày làm
   · 🖨️ duyệt rồi chưa in · 🔄 đổi ca chờ xác nhận · ✋ đổi ca bị từ chối · 👥 khai hộ.
   Cờ lưu ở `apprFilter.flag`; `apprMatch()` (08-requests.js) gọi ngược `asFlagMatch()`.
3. **Tổng hợp theo loại đơn** — mỗi loại một thẻ: số đơn (to) · tổng giờ đã duyệt · thanh so
   sánh giữa các loại · dòng chân ghi số ngày và phần đang chờ.
4. **Chi tiết theo loại đơn và trạng thái** — ma trận Loại × (Chờ · Duyệt · Từ chối) kèm
   **Tổng đơn · Số ngày · Giờ đã duyệt · Giờ đang chờ** và thanh so sánh giờ.
5. **Bảng theo nhân viên** — sắp xếp được theo tên/đơn/chờ/tổng giờ/ngày phép/giờ OT, mặc định
   top 8; ai **vượt trần** (`S.settings.otLimit`, mặc định 40h/kỳ, khai ở tab Dữ liệu) thì đỏ + 🚨.

Mọi con số bấm được → `asApply()` đặt lại bộ lọc danh sách (kể cả **kỳ công** đang xem cho khớp
tuyệt đối) rồi chuyển sang sub-tab Danh sách đơn; thanh lọc hiện dòng `.ab-flag` nói rõ đang xem
riêng nhóm nào kèm nút gỡ.

Giờ tính qua **`reqHours()`** cho MỌI loại đơn (`reqDayHours()`: ưu tiên `d.hours` nhân viên khai
→ suy từ mốc giờ `otHours()` → giờ mặc định của mã ca), nên tăng ca 14:00–19:30 ra đúng 5.5h chứ
không phải 12h. Ngày phép qua `reqLeaveDays()` (AL4 = nửa ngày).

Xem thử bố cục bằng dữ liệu giả: mở `xem-thu-tong-quan-duyet.html`.

---

## Tab Lịch — dồn về một hàng

Toàn bộ điều khiển nằm trên **một hàng duy nhất**: ◀ kỳ ▶ · Chuẩn/Thực tế · phạm vi ngày ·
nhóm · "Chỉ ô khác chuẩn" · **❔ Chú giải** (mở sheet, không còn chiếm chỗ cố định).
Đã bỏ khối tiêu đề *"Cavern Process · LỊCH CHUẨN (tham chiếu)"*, dải chú giải inline và
đoạn hướng dẫn dài phía dưới — phần trống nhường hết cho bảng lịch
(`.mtx-scroll` cao thêm ~50px).

Mở `xem-thu-giao-dien.html` bằng trình duyệt để xem thử ba màn hình này với dữ liệu mẫu.

---

## Phân quyền & ngôn ngữ

Quyền khai ở cột **Quyền** trong tab 🛠️ Nhóm & Lịch, lưu ở `e.perm`:

| Giá trị | Nhãn | Làm được gì |
|---|---|---|
| `staff` | Nhân viên | Xem lịch của mình, gửi đơn |
| `appr` | Duyệt đơn | Thêm: duyệt/từ chối đơn, sửa lịch thực tế, in đơn |
| `admin` | Quản trị | Thêm: Nhóm & Lịch, Dữ liệu, cấp/reset mật khẩu |
| `sec` | **Thư ký** | Xem hết lịch & báo cáo, in đơn, khai hộ đơn — **không** duyệt, **không** sửa cấu hình |
| `kmgr` | **Quản lý người Hàn (EN)** | Quyền y hệt `admin`, khác duy nhất: **đăng nhập vào là giao diện tiếng Anh** |

Cờ toàn cục: `adm` (admin/kmgr) · `mgr` (appr/admin/kmgr) · `secr` (sec + mgr — được xem số liệu cả tổ)
· `noSelf` (**sec / kmgr / ai đặt `shiftType='none'`** — không thuộc đối tượng chấm công).

**Người không nằm trong lịch ca** (thư ký, quản lý cấp trên) đặt **Kiểu ca = Không xếp lịch**
(`shiftType='none'`): vẫn có tài khoản và thao tác phần mềm, nhưng `schedEmps()` loại họ khỏi
bảng lịch, định mức nhân lực, thống kê và biểu đồ.

### Bỏ Trang chính với người không chấm công (`noSelf`)

Thư ký (`sec`) và quản lý người Hàn (`kmgr`) không có ca nên **Trang chính cá nhân bị bỏ hẳn**:

- `homeView()` (01-core) trả `'real'` thay vì `'me'` → đăng nhập xong vào thẳng **Lịch · Thực tế**;
  dùng ở `doLogin` và lúc boot (12-main).
- `go('me')` tự chuyển hướng sang `go('real')`; `renderMe()` thoát sớm và xoá rỗng `#meBody`.
- `applyRoleUI()` xử lý thêm hai class: **`.self-only`** (Trang chính, Gửi đơn, Tăng ca của tôi,
  Đơn của tôi) ẩn khi `noSelf`; **`.noself-only`** (nút 🔑 Tài khoản và ↪ Đăng xuất trên header)
  chỉ hiện khi `noSelf`, vì hai nút này vốn nằm trong Trang chính.
- Sheet "Tăng ca / Đơn của tôi / Phép năm / Tài khoản" chỉ còn tab **Tài khoản**.

### Chọn kỳ công bằng dropdown (Nhật ký tăng ca)

Danh sách kỳ trước đây trải thành một rừng chip. Nay gói trong `.dd` (`#otlogDD`):
nút xổ xuống hiện kỳ mới nhất đang chọn + `+N`, panel có **ô gõ để tìm kỳ**
(`otlogPerFilter`), danh sách tích chọn nhiều kỳ, và hai nút *Chỉ kỳ hiện tại* /
*Tải toàn bộ* ở chân panel. Tích chọn gọi `otlogRefresh()` — chỉ vẽ lại nhãn nút,
danh sách và bảng nên **panel không bị đóng**. Bấm ra ngoài mới đóng; bộ nghe click
bỏ qua phần tử đã rời DOM (`isConnected===false`), nếu không dropdown tự đóng ngay
khi vừa tích.

### Màu trong bảng Thống kê

`stCnt(code,n)` tô ô đếm mã ca bằng đúng nền pastel của bảng lịch (`SCHEDBG`/`SCHEDTXT`),
số **0 thì làm mờ** (`td.z`) để mắt chỉ nhìn số có ý nghĩa. Ba cột giờ mỗi cột một tông:
`hl` xanh lá (giờ công) · `hl-ot` cam (tăng ca) · `hl-lv` xanh dương (phép), tiêu đề cột
cùng tông. Cột Nhóm là chip màu `teamChip()` (băm tên nhóm → màu cố định). Dưới bảng có
dải **Chú giải màu**.

### In đơn ngay trên tab Lịch

Nút **🖨️ In đơn** (`#calPrintBtn`, badge `#printBdgCal`) nằm cuối thanh `.cal-bar` — mọi quyền
đều bấm được để chủ động in, không phải vòng qua menu ☰ Thêm hay tab Duyệt. Vẫn mang class
`pc-only` nên điện thoại không thấy. `refreshPrintBadge()` cập nhật cả ba badge
(`printBdgSheet` / `printBdgAppr` / `printBdgCal`).

Toàn bộ việc quản lý người dùng — mã NV, họ tên, nhóm, kiểu ca, **quyền**, **mật khẩu**,
thêm/xoá người — nay gom về **một bảng duy nhất**: *👤 Tài khoản đăng nhập và phân quyền*
trong tab ⚙️ Dữ liệu. Tab *Nhóm & Lịch* chỉ còn lo xếp ca.

`ROOT_ADMIN` (Hoàng Trung, `vc44180062`) luôn là quản trị, không ai hạ quyền được, và là
người đặt lại mật khẩu / thêm / xoá người.

### Mật khẩu — xem `BAO-MAT.md`

- Chưa đặt mật khẩu riêng → **không lưu chuỗi băm nào**, chỉ ghi cờ `{init:true}`; mật khẩu tạm
  thời là chính mã số.
- Đã đặt → **PBKDF2-SHA256 150 000 vòng, muối ngẫu nhiên 16 byte riêng từng người** (WebCrypto).
- Bản băm `sha256` cũ vẫn đăng nhập được và **tự nâng cấp** sang PBKDF2 ngay lần đăng nhập kế tiếp.
- Mật khẩu tối thiểu 6 ký tự, chặn trùng mã NV và các chuỗi dễ đoán.
- **Không xem lại được mật khẩu** (băm một chiều) — chỉ *Đặt lại* hoặc *Về mặc định*.
- Nhớ dán `firebase-rules.json` vào Firebase Console; đó mới là hàng rào thật.

### Khai tăng ca linh động

Đơn tăng ca không còn chỉ chọn một mã ca cứng. Mỗi dòng khai được **mốc bắt đầu → mốc kết thúc**:

| Mẫu | Giờ | Mã lưu |
|---|---|---|
| Nghỉ trưa | 12:00–13:00 | `OTL` |
| Sau giờ HC | 18:00–20:00 | `OT2` |
| Sau giờ HC | 17:00–20:00 | `OT3` |
| Ca ngày | 08:00–20:00 | `OTD` |
| Ca đêm (qua đêm) | 20:00–08:00 | `OTN` |
| Tự điền giờ | người khai nhập | `OTD` |

- Chọn mẫu → `dsSetPreset()` tự điền giờ; mẫu ca đêm tự đặt *Đến ngày* = hôm sau.
- **Một ngày có thể tăng ca nhiều lần** — VD ngày 13 có 12:00–13:00 và 18:00–20:00 là hai dòng.
  Nên nút *Thêm lần tăng ca* **giữ nguyên ngày** (khác nghỉ phép: nhảy sang ngày kế tiếp),
  `dsSubmit()` **không gộp** các dòng trùng ngày, và form không cảnh báo "trùng ngày".
  Khi duyệt, `decide()` **cộng giờ các lần trong cùng ngày** rồi ghi vào ô lịch một lần
  (mã ca lấy theo lần dài nhất cho dễ nhìn).
- **Tăng ca vắt qua nửa đêm**: điền *Đến ngày*; để trống nghĩa là trong cùng ngày. Nếu giờ ra ≤ giờ vào
  mà bỏ trống ngày kết thúc thì `otHours()` tự hiểu là qua nửa đêm.
- Số giờ tính từ hai mốc thật (`otHours`) và lưu ở `d.hours`, không lấy số giờ cứng của mã ca —
  nên OT 14:00→19:30 ra đúng **5,5h**. Khi duyệt, số giờ thật được ghi kèm vào ô lịch
  (`S.over[id][iso].hours`) và **`effHours()`** ưu tiên số này; `calcStats`, `otSummary`,
  bảng *Tăng ca của tôi* và biểu mẫu in đều dùng nó, nên thống kê khớp đúng với giờ đã khai.
- Mã **X (tăng ca nhập tàu)** đã **bỏ khỏi danh sách chọn**, nhưng vẫn giữ trong bảng mã ca
  (`legacy:true`) để những ô lịch cũ đang dùng X vẫn hiện đúng tên và đúng số giờ.

### Màu mã ca trong bảng lịch

Trước đây mã phép / tăng ca dùng **chữ trắng trên nền đậm**, mà cột "hôm nay" có nền vàng nhạt
kèm `!important` ghi đè nền → chữ trắng trên vàng nhạt, không đọc được (đúng lỗi AL8 khó nhìn).
Nay mọi mã đều **nền pastel + chữ tối đậm** (`SCHEDBG` / `SCHEDTXT` trong `06-calendar.js`),
đọc được trong mọi trường hợp.

### Kiểu ca

| Giá trị | Nghĩa |
|---|---|
| `type1` | Ca 8 ngày — O O D D N N R R |
| `type2` | Ca 6 ngày — D D N N R R |
| `admin` | Hành chính T2–T6 (nghỉ T7, CN) |
| `office6` | **Hành chính T2–T7** — chỉ nghỉ CN, operator mới nhận việc đi ca này để học việc |
| `none` | Không xếp lịch |

**Người vào làm giữa kỳ**: điền *Ngày vào làm* (`e.joinAt`) ở dòng của họ trong tab Nhóm & Lịch,
rồi bấm **🆕 Lịch cho người mới vào giữa kỳ**. `genForEmp()` tự cắt bỏ các ngày trước `joinAt`,
và `fillScheduleForOne()` chỉ điền cho riêng người đó, không đụng lịch người khác.

### Giao diện Việt / Anh (`js/14-i18n.js`)

- Mã nguồn vẫn viết **tiếng Việt** như cũ — không phải sửa template khi thêm màn hình mới.
- Khi `LANG==='en'`, hàm `i18nApply()` **quét DOM** và thay các nút văn bản khớp **chính xác**
  với khoá trong từ điển `I18N_EN` (≈580 khoá) sau khi chuẩn hoá (gộp khoảng trắng, `&amp;`→`&`).
  Không khớp thì thử `I18N_RE` (quy tắc có chèn số/tên), rồi ghép `MÃ — nhãn`, rồi phần đuôi là ngày/giờ.
- `MutationObserver` gọi lại sau mỗi lần giao diện vẽ lại, nên màn hình mới tự được dịch.
- **`#printRoot` và mọi phần tử `data-noi18n` luôn bị bỏ qua** — biểu mẫu in là giấy tờ chính thức,
  giữ nguyên song ngữ Việt/Anh như bản gốc Hyosung.
- Chuỗi ngoài DOM (`confirm`, `prompt`, chuỗi ghép động) bọc bằng `t('…')`.
  Trong hàm đã có biến cục bộ tên `t` (loại đơn) thì dùng bí danh `t2('…')`.
- Nút **EN / VI** trên thanh tiêu đề cho ai cũng tự đổi được; lựa chọn lưu theo từng mã NV
  (`localStorage`), ưu tiên hơn mặc định theo quyền. Chuyển EN → VI thì tải lại trang
  (tiếng Việt là bản gốc, chữ đã dịch không quay ngược được).
- Thứ trong tuần, định dạng ngày giờ và nhãn kỳ công (`Kỳ T7/2026` ↔ `Period M7/2026`)
  đổi theo `isEN()`.

- **Nhãn có tiền tố biểu tượng tự dịch** (2026-07-30): `i18nLookup()` cắt phần đầu không phải
  chữ/số ra, dịch phần chữ rồi ghép lại — `🗂 Nhật ký tăng ca`, `✓ 📊 Giờ công theo người`
  chỉ cần khoá `Nhật ký tăng ca` / `Giờ công theo người`. Trước đây phải khai riêng từng
  khoá kèm emoji nên rất hay sót chữ Việt trong bản EN.

**Thêm chuỗi mới**: mở `js/14-i18n.js`, thêm một dòng `'chuỗi tiếng Việt':'English string',`
vào đúng nhóm. Khoá phải khớp đúng đoạn văn bản hiển thị (một nút văn bản, không kèm thẻ HTML).

**Rà chữ Việt còn sót**: chạy đoạn Node dưới đây — nó nạp từ điển rồi soi mọi đoạn văn bản
trong `js/*.js` và `index.html` mà `i18nLookup()` trả `null` (bỏ qua `09-print.js` vì biểu
mẫu in cố ý song ngữ):

```bash
node -e "const fs=require('fs'),vm=require('vm');
const ctx=vm.createContext({LS:'x',console,localStorage:{getItem:()=>null},document:{documentElement:{setAttribute(){}}}});
vm.runInContext('var \$=function(){return null};',ctx);
vm.runInContext(fs.readFileSync('js/14-i18n.js','utf8'),ctx);vm.runInContext('LANG=\"en\"',ctx);
const VI=/[ăâđêôơưáàảãạéèẻẽẹíìóòọúùýỳ]/;
for(const f of fs.readdirSync('js').filter(f=>/^[01]/.test(f)&&f.endsWith('.js')&&!/14-i18n|16-otlog|09-print/.test(f))){
  const s=fs.readFileSync('js/'+f,'utf8').replace(/\/\*[\s\S]*?\*\//g,' ');
  for(const m of s.matchAll(/>([^<>{}\`\$]{2,80})</g)){const v=m[1].replace(/\s+/g,' ').trim();
    if(v&&VI.test(v)&&ctx.i18nLookup(ctx.i18nKey(v))==null)console.log(f,'|',v);}}"
```

---

## Huỷ / xoá đơn

Thêm trạng thái thứ tư: `cancelled` (**ĐÃ HUỶ**), bên cạnh `pending` / `approved` / `rejected`.

- **Huỷ đơn đã duyệt thì lịch tự hoàn tác.** Khi duyệt, mỗi ô lịch ghi kèm `reqId`;
  `revertReqSchedule(rid)` gỡ đúng những ô mang mã đơn đó → lịch trả về ca chuẩn.
  Đơn đổi ca hoàn tác cho **cả hai người**.
- **Không xoá hẳn theo mặc định** — đơn chuyển sang `cancelled`, vẫn nằm trong *Lịch sử*
  kèm `cancelledAt` / `cancelledBy` / `cancelReason` để còn tra lại.
- **Quản trị xoá hẳn** bằng `purgeReq()` (nút 🗑️ Xoá hẳn, có `admin-only`), cũng hoàn tác lịch trước khi xoá.
- **Xoá nhiều người một lúc**: màn *Duyệt* có ô tích trên từng đơn (`.rqChk`) +
  các nút *Chọn tất cả · Bỏ chọn · Huỷ đơn đã chọn · Xoá hẳn đã chọn*. Hộp xác nhận
  nói rõ có bao nhiêu đơn đã duyệt (sẽ hoàn tác lịch) và bao nhiêu đơn **đã in nộp nhân sự**.
- **Nhân viên tự huỷ đơn của mình**, kể cả đơn đã duyệt — trừ đơn đã in (`r.printedAt`)
  thì phải nhờ quản lý, xem `canCancelReq(r,who)`.
- Đơn đã huỷ không tính vào cảnh báo trùng đơn, không vào hàng chờ in, và hiện mờ
  (`.req.dead`) trong danh sách.

---

## Biểu mẫu in — bám theo file gốc của công ty

Nguồn: `2023_HSVC - Timekeeping Form (New) VBA`. Sáu sheet biểu mẫu (`Leave`, `Overtime`,
`Change shift`, `WT Confirmation`, `Leave Early`, `Work multiple days`) đều dùng **cùng một
khuôn**, và `js/09-print.js` dựng lại đúng khuôn đó:

| Thông số | Giá trị lấy từ Excel |
|---|---|
| Khổ giấy | **A5 ngang** (paperSize 11, landscape) — 210 × 148 mm |
| Lề | 0.1 inch ≈ 2,5 mm |
| Font | Times New Roman |
| Tiêu đề | 16pt đậm (VN) + 16pt đậm nghiêng (EN), canh giữa |
| Bảng | 11pt, viền `thin`, **10 dòng dữ liệu** (STT 1→10 kể cả dòng trống) |
| Chú giải | 8pt — loại phép (Leave, Leave Early) / loại ca (Change shift) |
| Chữ ký | 3 ô có viền xếp chồng: nhãn → chỗ ký trống → *Ghi rõ họ tên* |

Điểm quan trọng: cột thời gian **tách riêng Giờ và Ngày** (`Từ: Giờ | Ngày`, `Đến: Giờ | Ngày`),
không gộp một ô như bản cũ. Độ rộng cột trong `W_LEAVE`, `W_OT`, `W_SHIFT`, `W_WT`,
`W_LATE`, `W_MULTI` lấy nguyên độ rộng cột của Excel rồi quy ra phần trăm.

- Đơn *Bổ sung công* có ô **Lý do** gộp 10 dòng, in danh sách ☐/☑ đúng như bản gốc,
  và khối chữ ký có thêm cột **Xác nhận bởi Người bảo lãnh**.

### Lý do in trên đơn — mặc định tiếng Anh

Người ký cuối là **Trưởng Bộ Phận người Hàn**, nên mọi lý do do phần mềm tự điền đều
viết bằng tiếng Anh. Nếu nhân viên có tự ghi lý do thì **lấy đúng chữ của nhân viên**,
thay cho lý do mặc định (`printReason()` trong `js/09-print.js`).

| Loại đơn | Lý do phần mềm tự điền |
|---|---|
| Nghỉ phép · Đổi mã ca · Đi trễ/Về sớm · Đổi ca (người đứng đơn) | `Personal matter` |
| Tăng ca · Làm liên tục nhiều ngày | `Operational requirement` |
| Đổi ca — **người nhận ca giúp** | `Cover for <tên người nhờ>` |

Cách này bám theo chính bản Excel gốc: người xin đổi ghi *Personal matter*, người nhận ca
ghi *Cover Mr. …*. Loại đơn Đi trễ/Về sớm cũng in `Come late` / `Leave early`.

**Mã loại phép** quy đổi theo chú giải in trên biểu mẫu (`printLeaveCode()`):
`AL8` và `AL4` → **AL**, `NP` → **NPL**, `OFF` → **COM**. Nửa ngày vẫn phân biệt được
vì cột *Tổng ngày* ghi `0.5`.

### Logo

Logo nhúng trong `LOGO_B64` **bị mất đúng 1 byte cuối** (18 020 / 18 021 byte, thiếu dấu
kết thúc `FF D9`) nên trình duyệt vẽ ra ảnh vỡ. Đã thay bằng ảnh gốc lấy từ chính file
biểu mẫu công ty (`xl/media/image1.jpeg`, 358 × 86 px). CSS cũng đổi sang **khoá chiều cao**
(`height:8mm; width:auto`) để ảnh không bao giờ bị bóp méo.
- Ca đêm (20:00 → 08:00) tự đẩy cột *Đến / Ngày* sang hôm sau.
- **Bộ phận** in trên đơn lấy từ `S.settings.deptDefault` (mặc định `LPG Terminal`),
  chỉ khi bỏ trống mới rơi về tên nhóm.
- Bố cục in mặc định là **1 đơn / tờ A5 ngang** (đúng chuẩn công ty); vẫn giữ tuỳ chọn
  *2 đơn / tờ A4 đứng* cho ai muốn tiết kiệm giấy. Trên 10 dòng thì tự tách thêm tờ.
- **Màn In đơn** là một danh sách chia hai nhóm: *Chưa in* (mặc định **tích hết**) và
  *Đã in rồi* (mặc định **bỏ tích**, chỉ tích lại khi cần in bù). Mỗi nhóm có ô tích ở đầu để
  chọn/bỏ cả nhóm, kèm ô tìm theo tên và lọc khoảng ngày.
- **Ai đăng nhập cũng in được.** Riêng **điện thoại ẩn hẳn mọi nút in** (class `pc-only`) vì
  công ty không cho điện thoại kết nối máy in.

Mở `mau-in-A5-xem-thu.html` bằng trình duyệt để xem thử cả 6 biểu mẫu trên khung giấy
đúng kích thước, bấm Ctrl+P chọn khổ A5 để in đối chiếu với file Excel.

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

---

## v4.7 — Trợ lý duyệt đơn · tách khối sản xuất/văn phòng · đồng bộ theo delta

### 1. Hai khối nhân lực (`js/01-core.js`)

Nhóm **A / B / C / D** là khối **sản xuất** (trực vận hành theo ca), nhóm **Office** là khối
**văn phòng**. Hai khối **không trực thay ca / tăng ca cover cho nhau**, nên phần mềm gắn một
"khoá ẩn" suy ra từ tên nhóm:

```js
poolOf(emp)        // 'prod' | 'office'
poolOfId(empId)
samePool(a,b)
isOfficeTeam(tm)   // khớp: office / văn phòng / vp / hành chính / hc / admin
shiftKey(id,code)  // 'O@prod' | 'O@office' — CHỈ dùng nội bộ
```

> **Ký hiệu in ra giấy vẫn là `O` cho cả hai** theo quy định công ty. Khoá ẩn không bao giờ
> xuất hiện trên biểu mẫu — nó chỉ để phần mềm đếm đúng.

Ảnh hưởng: `mpBuckets(iso, pool)` và `mpBucketsByPool(iso)` đếm tách khối; định mức
`minD/minN` chỉ áp cho khối sản xuất; `crewGroupOfEmp()` tách cột `O` (sản xuất) và `OVP`
(văn phòng) trong "Nhân sự trong ngày"; `swapBlockList()` chặn thẳng đổi ca khác khối.

### 2. Trợ lý duyệt đơn (`js/18-advice.js`)

Chạy **hoàn toàn bằng logic trên state `S` đã nằm sẵn trong bộ nhớ** — không gọi thêm Firebase.

| Hàm | Việc |
|---|---|
| `offListOfDay(iso)` | ai vắng mặt ngày đó: ô lịch đã mang mã nghỉ (**đã duyệt**) + đơn nghỉ **đang chờ duyệt** |
| `leaveAdvice(empId,iso,newCode,skipReqId)` | khuyến nghị cho một người – một ngày |
| `reqAdvice(r)` / `reqAdviceHtml(r)` | khuyến nghị cho cả một đơn (panel trong màn Duyệt) |
| `advForFormHtml(empId,rows,type)` | nhắc nhở cho người **làm đơn** trước khi bấm gửi |
| `apprAdviceBadge(r)` | chip 🟢🟡🔴 hiện ngay trên dòng đơn chưa cần bung |

**Xếp hạng khuyến nghị**

1. *Tiêu chí chính* — cùng **NHÓM** đã có bao nhiêu người nghỉ ngày đó.
   Chạm trần `S.settings.maxOffTeam` (mặc định 1) → 🔴 **không nên duyệt**;
   đã có người nghỉ nhưng chưa chạm trần → 🟡; chưa ai nghỉ → 🟢.
   Còn đơn cùng nhóm **đang chờ duyệt** cùng ngày cũng đẩy lên 🟡.
2. *Tiêu chí phụ* — sau khi duyệt thì ca của **đúng khối đó** còn mấy người so với
   `minD` / `minN` / `minO`. Dưới định mức → 🔴, vừa sát định mức → 🟡.

Panel còn liệt kê **ai đã nghỉ kèm trạng thái đơn của họ** (✓ đã duyệt / ⏳ chờ duyệt),
đếm quân số **trước → sau** khi duyệt, và gợi ý **ai đang nghỉ ca R cùng khối** có thể huy động.

Ngưỡng khai ở tab **Dữ liệu → Cài đặt**: `setMinO`, `setMaxOffTeam` (cạnh `setMinD/setMinN/setOtLimit`).

> ⚠️ Bộ đệm `_advCache` khoá theo `S.rev`. Nếu viết test hoặc sửa `S` trực tiếp mà không qua
> `save()`, phải tự tăng `S.rev` rồi reset `_advCache`, nếu không kết quả cũ vẫn được dùng lại.

### 3. Lịch trên điện thoại = danh sách theo ngày (`js/06-calendar.js`)

Trên màn hình < 768px, tab **Lịch** không dựng ma trận / thẻ tuần nữa (không dựng luôn cho nhẹ
máy, chứ không phải chỉ ẩn bằng CSS) mà hiện `#calMpBox`: **mỗi ngày một dòng gọn**, chạm mới
bung tên người, tách sẵn khối sản xuất / văn phòng, có ô lọc *Chỉ ngày thiếu người*.
Hàm: `renderCalMpList()`, `calMpToggle(iso)`, `calMpSetLow(on)`. Máy tính giữ nguyên như cũ.
Hai nút **Thu/Mở** và **Theo ngày** đổi sang class `pc-only`.

### 4. Nhật ký tăng ca → sub-tab của Duyệt

`apprTab` nay có 3 giá trị: `list` | `sum` | `otlog` (`APPR_TABS`, nhớ ở `localStorage[LS+'_apprtab']`).
Panel mới `#apprOtlog` trong `index.html`; `renderAppr()` gọi `repOtLog()` của `js/15-report.js`.
`repModes()` ở tab Báo cáo đã bỏ `'otlog'` — các hàm `otlog*` vẫn nằm nguyên chỗ cũ.

### 5. Firebase đồng bộ theo DELTA (`js/02-storage.js`) — quan trọng

Bản cũ nghe `on('value')` ngay **gốc** và ghi bằng `set(S)`: đổi **một ô lịch** là **mọi máy tải
lại toàn bộ cây dữ liệu**. Gói **Spark** tính tiền theo băng thông tải xuống nên rất phí.

Bản mới chia nhánh và nghe ở mức con:

```js
FB_MAP_BRANCHES = ['base','over','requests','accounts','printLog','notifs']  // child_added/changed/removed
FB_VAL_BRANCHES = ['employees','settings','meta']                            // on('value')
```

Ghi cũng vậy: `fbSnapshot()` chụp JSON từng khoá, `fbDiff()` so với lần đồng bộ trước,
`fbPush()` chỉ `update()` đúng những đường dẫn đã đổi. `_fbLast` được ghi **trước** khi gửi nên
tiếng vọng của chính mình bị bỏ qua, không gây vẽ lại thừa. `fbTouch()` gộp nhiều sự kiện con
thành một lần `renderAll()`.

`fbBootSync()` chạy sau khi đợt sự kiện đầu tiên lặng ~900ms:
máy chủ còn trắng → đẩy toàn bộ dữ liệu máy này lên; máy chủ mới hơn (`rev` lớn hơn) → xoá những
bản ghi máy này còn giữ mà máy chủ đã bỏ (`_fbSeen`); máy này mới hơn → đẩy phần còn thiếu lên.

**SCHEMA GIỮ NGUYÊN** — dữ liệu Firebase cũ dùng lại được ngay, không cần chuyển đổi.

Đo trên bộ dữ liệu cỡ thật (40 NV · 12 kỳ lịch · 400 đơn ≈ **344 KB**):

| Thao tác | Cũ | Mới |
|---|---|---|
| Mở app lần đầu | 344 KB | 344 KB |
| Sửa 1 ô lịch (mỗi máy đang mở) | 344 KB | **~0,1 KB** |
| Duyệt 1 đơn | 344 KB | **~0,3 KB** |
| `save()` khi không có gì đổi | 344 KB | **0 KB** |

100 lượt sửa/ngày × 8 máy: **269 MB/ngày → 0,26 MB/ngày** (chưa kể lần tải đầu).

---

## v5.4 — Người OT cover · thanh lọc màn Duyệt gộp lại · dòng đơn duyệt-ngay

### 1. Chế độ in mặc định theo LOẠI ĐƠN
`REQ_MUST_PRINT=['wt','swap']` + `defaultNoPrint(type)` ở `js/08-requests.js`.
Chỉ **bổ sung công** và **đổi ca** là giấy tờ phải nộp nhân sự nên mặc định vào
hàng **chờ in**; nghỉ phép / tăng ca / đổi mã ca / đi trễ / làm liên tục mặc
định **không cần in**. `dsForm()` (13-portal) đặt `dsNoPrint=defaultNoPrint(t)`
— người khai vẫn bấm đổi được ngay trong form, quản lý đổi ở màn Duyệt bằng
`apprToggleNoPrint()` / `pbToggleNoPrint()`. Không đụng schema: vẫn là cờ
`r.noPrint` như cũ.

### 2. Thanh lọc màn Duyệt — hết trùng lặp
Trước đây kỳ công khai ở **hai** chỗ (thanh ◀▶ và select trong "Bộ lọc khác"),
chip lọc in cũng dựng **hai** lần. Nay:

| Hàng | Nội dung |
|---|---|
| `.ab-period` | ◀ · **một** dropdown kỳ công (`.ab-per-sel`, có cả *Tất cả các kỳ* và *Khoảng ngày tự chọn…*) · ▶ · chip phạm vi (Kỳ hiện tại / Kỳ này + kỳ trước / Cả năm nay) |
| `.ab-range` | chỉ hiện khi chọn *Khoảng ngày tự chọn…* |
| `.ab-chips` | chip trạng thái (có đếm) |
| `.ab-chips` | chip in: Mọi đơn / ○ Chờ in / 🚫 Không in / 🖨️ Đã in — **một lần duy nhất** |
| `.ab-tools` | ô tìm tên · select loại đơn · ↺ Bỏ lọc (chỉ hiện khi đang lọc) · ⚙ Công cụ dữ liệu (admin) · 🖨️ In đơn |
| `.ab-adv` | gập lại: xuất Excel / xuất & xoá / xoá theo năm |

⚠️ **Đừng gắn `admin-only` lên `.ab-adv`** — `applyRoleUI()` ghi thẳng
`el.style.display` nên panel gập sẽ bị bung ra với tài khoản quản trị. Gắn
`admin-only` cho từng nút bên trong.

### 3. Dòng đơn hiện sẵn thông tin quyết định (PC)
`apprQuickHtml(r)` → khối `.ar-sum.pc-only` nằm **ngoài** `.ar-d`, nên trên máy
tính nhìn vào là bấm ✓ được luôn:

* `apprDayBrief()` — mỗi ngày một viên `.aq-d`: ngày + thứ + **ca cũ → ca mới**
  (đổi ca là `A ⇄ B`, tăng ca kèm mốc giờ + số giờ). Quá `AQ_MAX_DAYS=4` ngày
  thì gộp `+N ngày`.
* `apprMetric()` — con số quyết định: `x ngày phép` (AL4 = 0,5) / `x h tăng ca`
  / số ngày khai.
* Lý do–ghi chú của nhân viên, lý do bổ sung công + người bảo lãnh, người OT cover.

Bung `▾` giờ chỉ còn **thông tin phụ**: chuỗi duyệt nhiều cấp, chi tiết đầy đủ,
cảnh báo quân số, Trợ lý duyệt đơn, mốc thời gian và các nút phụ.
Điện thoại vẫn giữ dòng gọn như cũ (`.ar-sum` mang `pc-only`), chỉ thêm badge
`🤝` nhỏ (`.mob-only`) khi đơn có người cover.

### 4. Người OT cover cho đơn nghỉ phép
Lưu trên đơn: **`r.coverId`** + **`r.coverSt`** = `pending | confirmed | declined`.

* **Khai đơn**: form nghỉ phép có `dsCoverHtml()` — ô tìm người
  (`dsPersonPicker('cover',…)`, chỉ **cùng khối**, ai đang nghỉ ca **R** hôm đó
  xếp lên đầu) + dải gợi ý nhanh lấy từ `leaveAdvice(...).cover` (18-advice).
  Không bắt buộc.
* **Thông báo**: gửi `newNotif({kind:'coverConfirm'})`. `CONFIRM_KINDS` nay gồm
  `schedChange · swapConfirm · coverConfirm` → tự vào mục *Cần bạn xác nhận* ở
  chuông 🔔 và được `notifUnseenCount()` đếm.
* **Xác nhận**: `confirmCover(nid)` / `declineCover(nid)` chỉ đặt cờ + báo lại
  người làm đơn. **KHÔNG tự sinh đơn tăng ca** — người cover muốn được tính giờ
  thì gửi đơn tăng ca như thường (đã ghi rõ trong lời nhắc).
* **Từ chối KHÔNG chặn duyệt** — chỉ hiện cờ đỏ `.cvw.declined`. Người làm đơn
  *hoặc* người duyệt bấm 🤝 mở `openCoverPicker()` đổi sang người khác:
  `reqSetCover(rid,newId,byId)` gỡ yêu cầu đang chờ của người cũ, báo người cũ
  đã được gỡ vai trò, gửi yêu cầu mới cho người mới. Quyền: `canSetCover()`.
* **Hiển thị**: `reqCoverChip()` dùng chung ở dòng đơn màn Duyệt, chi tiết đơn
  (`reqDetail`), *Đơn của tôi* và sheet theo ngày. Bảng Tổng quan thêm 2 cờ rủi
  ro `cvw` (chờ xác nhận) và `cvno` (đã từ chối) trong `AS_FLAGS`/`asFlagMatch`.
* `cancelReq()` dọn luôn thông báo `coverConfirm` của đơn bị xoá.

Modal chọn người: `#coverMask` / `#coverBody` trong `index.html`.

### 5. Ghi chú vận hành
* i18n: +39 khoá EN cuối `I18N_EN`. 8 khoá trùng trong file là **tồn tại từ
  trước**, không phải do bản này.
* `00-icons.js`: thêm `🤝→users`, `🙅→hand`.
* **Cache bump `?v=54`** trong `index.html` — mỗi lần sửa code phải tăng số này.
* Verify: 2 harness Node (`defaultNoPrint`, vòng đời cover, `apprQuickHtml`,
  bộ lọc in) — 50/50 kiểm tra đạt.

---

## v5.5 — Ẩn sub-tab Tổng quan/Biểu đồ · bấm tên xem tổng hợp cả kỳ

### 1. Tab Duyệt chỉ còn 3 sub-tab
`APPR_TABS_OFF=['sum','chart']` + `apprTabOn(v)` ở `js/08-requests.js`.
📊 **Tổng quan** và 📈 **Biểu đồ** **hiện tại chưa sử dụng** nên đã ẩn khỏi thanh
sub-tab; thanh còn *📋 Danh sách đơn · 🗂 Nhật ký tăng ca · 🧾 Bảng công tổng hợp*.

* **Code vẫn giữ nguyên** — `js/17-appr-sum.js` (`asRender`, `AS_FLAGS`,
  `asFlagMatch`) và `repChartPanel()` không bị xoá. **Bật lại = xoá tên khỏi
  `APPR_TABS_OFF`**, không phải sửa gì thêm.
* `apprTab` đọc từ localStorage cũng đi qua `apprTabOn()`, và `renderAppr()` tự
  đẩy về `'list'` nếu tab đang lưu đã bị tắt → người dùng từng mở Tổng quan hôm
  trước không bị màn trắng.
* Thanh sub-tab để lại một ghi chú mờ `.aptab-off`
  *"📊 Tổng quan · 📈 Biểu đồ: hiện tại chưa sử dụng"* (ẩn trên điện thoại).
* Bộ lọc theo cờ rủi ro (`apprFilter.flag`) vẫn chạy bình thường.

### 2. Bảng công tổng hợp — bấm tên mở tổng hợp cả kỳ của người đó
`openEmpSum(id)` / `renderEmpSum()` / `closeEmpSum()` trong `js/15-report.js`,
modal `#empSumMask` / `#empSumBody` (`.modal.wide`, 760px) trong `index.html`.
Cột **Họ tên** ở bảng PC và tên trên **thẻ mobile** đều thành nút `.st-nm`.

Nội dung popup (tất cả tính từ state đã có, **không tải thêm Firebase**):

1. Đầu trang: nhóm · họ tên · vị trí · mã NV · ngày vào làm.
2. Thanh kỳ công riêng `esYm` với ◀ ▶ + *Kỳ hiện tại* (`esShiftYm`,
   `esPeriod()` rơi về `repYm` khi để trống) — **không đụng** bộ lọc của bảng.
3. 4 thẻ: Giờ công · Giờ tăng ca (kèm số lần) · Nghỉ phép (ngày, AL4 = 0,5) ·
   Phép năm còn lại.
4. Bảng đếm ca D/N/O/R/AL8/AL4/NP/OFF/Ca OT + dải chip mọi mã ca xuất hiện.
5. Nhắc số giờ tăng ca **đang chờ duyệt** (`otSummary`).
6. Danh sách **các lần tăng ca** trong kỳ (ngày · mã · số giờ thật).
7. **Đơn trong kỳ** — mọi loại, mọi trạng thái, kể cả đơn đứng tên người khác mà
   người này là bên đổi ca; hiện cả người OT cover. Người duyệt có nút
   *Mở trong Danh sách đơn ›* → `esGoRequests()` đặt `apprFilter.q` = tên,
   `ym` = kỳ đang xem rồi nhảy sang sub-tab Danh sách.
8. **Chi tiết từng ngày**: ngày · mã ca (ô `~` = tạm duyệt, `⇄X` = khác lịch
   chuẩn) · giờ công / OT / phép + hàng tổng.

Ghi chú kỹ thuật: `SCHEDBG` / `SCHEDTXT` đọc qua `typeof … !== 'undefined'` để
hàm chạy được cả khi nạp thiếu `06-calendar.js` (harness test).

### 3. Ghi chú vận hành
* i18n: +12 khoá EN. 8 khoá trùng trong file vẫn là tồn tại từ trước.
* **Cache bump `?v=55`**.
* Verify: 3 harness Node — 80/80 kiểm tra đạt.

## v5.6 — Tách Kỹ sư/Operator ở Nhân lực · Đặt cơm tăng ca

### 1. Nhân lực theo ngày tách **Kỹ sư** và **Operator**

Đủ đầu người chưa chắc đã đủ *đúng loại* người: một ca phải có kỹ sư (Field
Engineer ngoài hiện trường + DCS Boardman trong phòng điều khiển) và operator
vận hành — ba operator không thay được một kỹ sư. Nên bảng Nhân lực nay đếm
tách hai nhóm này.

* `js/01-core.js` — `POSG_ENG`/`POSG_OPER`/`POSG_OTHER`, `POSG_LABEL/FULL/ICON/COLOR`,
  **`posGroupOf(e)`** (field_eng + boardman → `eng`, operator → `oper`, còn lại →
  `other`; chưa khai vị trí thì rơi về `e.role` cũ) và **`splitEO(list)`** chia
  một mảng nhân viên thành 3 rổ.
* `js/15-report.js` `repManpower()` (PC) — pill quân số D/N/O khối sản xuất có
  thêm `<em class="mpp-eo">🛠️n ⚙️n</em>`; bung chi tiết thì `lineEO()` xếp tên
  thành 2 hàng con Kỹ sư / Operator thay vì một dãy tên liền.
* `js/06-calendar.js` `renderCalMpList()` (điện thoại) — `calMpEoTag()` gắn chỉ
  số vào pill, `calMpNamesEO()` tách tên theo nhóm vị trí.
* CSS `.mpp-eo` `.mp-eo-sub` `.cmp-eot` `.cmp-eo` ở cuối `css/ui.css`.

Ma trận lịch, Bảng công tổng hợp và Nhân sự trong ngày **giữ nguyên** — user chỉ
yêu cầu tách ở Nhân lực theo ngày.

### 2. Cơm phát sinh — `js/19-meal.js` (nạp sau 18-advice)

Công ty nấu 4 bữa cố định: **06:00 sáng · 12:00 trưa · 18:00 tối · 22:00 khuya**.
Nhà bếp đặt cơm **một lần từ đầu kỳ theo BẢNG LỊCH CHUẨN** (`S.base`):

| Ca | Khung giờ | Suất bếp đã đặt |
|----|-----------|-----------------|
| D / SD | 08:00–20:00 | trưa + tối |
| N / SN | 20:00–08:00 | khuya + **sáng NGÀY HÔM SAU** |
| O / SO | 08:00–17:00 | trưa |
| R, nghỉ phép | — | không có |

Quy tắc gói gọn trong `SHIFT_WIN` + `mealsInWin()`: **một mốc bữa ăn nằm trong
khung giờ ca thì có suất** (`abs >= start && abs < end` — chạm đúng giờ bắt đầu
vẫn tính, kết thúc đúng mốc thì không).

**Bài toán = so LỊCH CHUẨN với LỊCH THỰC TẾ.** Trong kỳ phát sinh tăng ca, đổi
ca, nghỉ phép đột xuất, quản lý sửa tay ô lịch… nên lịch thực tế (`base + over`)
khác lịch chuẩn. Chênh lệch chính là phần phải báo bếp — **hai chiều**:

* thực tế CÓ mà chuẩn KHÔNG → **đặt thêm** (`d:+1`)
* chuẩn CÓ mà thực tế KHÔNG → **báo bớt** (`d:-1`), bếp khỏi nấu

Ví dụ: chuẩn ca D mà xin nghỉ phép cả ngày → **bớt 2 suất**; chuẩn nghỉ ca R mà
vào trực thay ca D → **thêm 2 suất**; chuẩn ca D mà đổi sang ca N → **bớt trưa +
tối, thêm khuya + sáng hôm sau**; đang ca O mà tăng ca 17–20 → **thêm 1 suất tối**.

Các hàm chính:

* `plannedMealsOf(empId,iso)` — suất theo **lịch chuẩn** (`S.base`, bếp đã đặt).
* `actualMealsOf(empId,iso,inclPending)` — suất theo **lịch thực tế** (`eff()`)
  **cộng** các lần tăng ca. Ô lịch bị mã OT ghi đè thì ca nền vẫn lấy ở `S.base`.
* `otWinFromRow(d)` — khung giờ một dòng OT trong đơn (`timeIn/timeOut/isoEnd`;
  bỏ trống ngày kết thúc mà giờ ra ≤ giờ vào thì hiểu là qua nửa đêm). Dòng
  không có mốc giờ thì suy theo `OT_CODE_WIN` (OTL 12–13, OT2 18–20, OT3 17–20,
  OTD 08–20, OTN 20–08).
* `otIndex()` — **đánh chỉ mục `S.requests` theo khoá `mã NV|ngày`**, nhớ theo
  `S.rev`. Không có chỉ mục thì badge (vẽ lại sau mỗi render) phải quét toàn bộ
  đơn cho từng người từng ngày. **Dữ liệu về từ máy khác không đi qua `save()`
  nên `S.rev` không đổi → `fbTouch()` trong `02-storage.js` gọi `mealResetCache()`.**
* `mealDiffOf(empId,srcDays,inclPending)` — hợp hai tập trên rồi lấy phần chỉ
  thuộc một bên. Mỗi dòng ghi kèm `planCode`/`realCode` để biết vì sao lệch.
* `mealPlan({from,to,team,onlyMe,inclPending})` → `{days, byDay[iso][bữa], rows,
  add, cut, nPend}`. Ngày **nguồn** quét thêm hôm trước `from` (bắt ca đêm vắt
  sang) và hiện thêm ngày sau `to` nếu có suất rơi vào đó.
* `mealCell(P,iso,v)` → `{list, add, cut, pend}`; `mealAddOf()` cộng cả phần sửa tay.

**Popup**: nút `🍚 Cơm phát sinh` + badge `#mealBdg` (đếm cả thêm lẫn bớt) cuối
thanh `.cal-bar` (tab Lịch, mọi quyền đều mở được) → modal `#mealMask`/`#mealBody`.
Gồm thanh khoảng ngày (mặc định **từ hôm nay tới hết kỳ**, không lùi về quá khứ),
lọc nhóm / *Chỉ mình tôi* / *Tính cả đơn chờ duyệt*, 5 thẻ tổng (số `+` xanh trên,
số `−` đỏ dưới), bảng **ngày × 4 bữa** (bấm ngày bung danh sách ai thêm/bớt bữa
nào, kèm `chuẩn → thực tế`), nút **＋ −** sửa tay từng ô, và **📋 Copy tóm tắt
(2 mục CAN DAT THEM / CAN BOT) / 📤 Xuất Excel (2 sheet) / 🖨️ In**.

> **KHÔNG ghi lên Firebase** — user chọn bản chỉ tính & xem, schema không đổi.
> Số sửa tay (`mealAdj`) chỉ sống trong phiên, đóng app là mất; chốt xong phải
> Copy / Xuất Excel gửi bếp.

### 3. Icon & i18n

`js/00-icons.js` thêm `sunrise/sun/sunset/moon/utensils/bowl` và map
`🌅 🍚 🌆 🌙 🍽`. `js/14-i18n.js` thêm **32 khoá EN** (`Kỹ sư`, `Khác`,
`chờ duyệt` đã có sẵn từ trước và dùng lại được). Cache bump **`?v=57`**.

### 4. Kiểm thử

3 harness Node (không cần trình duyệt, xem thư mục tạm của phiên làm việc):

* `meal-harness.js` — **50 kiểm tra**: suất chuẩn theo ca; các kịch bản OT (ca O
  + OT 17–20, ca D + OT 20–24, ngày nghỉ R + OT ca đêm, ca N hôm trước vắt sang,
  chạm/không chạm mốc bữa); nhiều lần OT trong ngày; đơn chờ duyệt / bị từ chối;
  ô lịch OT điền tay; **so chuẩn ↔ thực tế** (nghỉ phép → bớt, đổi ca D→N → vừa
  bớt vừa thêm, trực thay ca R→D → thêm); `mealPlan` đếm hai chiều & lọc
  nhóm/cá nhân; `posGroupOf`/`splitEO`.
* `meal-render-smoke.js` — **24 kiểm tra** dựng HTML popup, bung chi tiết ngày,
  sửa tay, tóm tắt văn bản 2 mục, bộ lọc, badge, chiều báo bớt.
* `mp-render-smoke.js` — **7 kiểm tra** bảng Nhân lực có tách Kỹ sư/Operator.

Sandbox vẫn không chạy được trình duyệt → phần hiển thị phải mở thật trên máy để
mắt nhìn.

---

## v5.8 — Ca kép · lịch tuần trên điện thoại · sự kiện trên lịch · thu hồi thông báo

Bốn việc trong một bản. Cache bump `?v=58` (nhớ tăng số này mỗi lần sửa code,
nếu không trình duyệt vẫn giữ bản cũ).

### 1. Mã ca kép `O+N` và `D+N`

Trước đây người vừa trực ca O vừa tăng ca đêm chỉ ghi được `OTN` vào ô lịch —
nhìn vào không biết hôm đó họ đã làm ca O. Nay có hai mã ghép:

| Mã | Nghĩa | Giờ mặc định |
|----|-------|--------------|
| `O+N` | trực ca hành chính O rồi tăng ca đêm | 20h (8 công + 12 tăng ca) |
| `D+N` | trực ca ngày D rồi tăng ca đêm | 24h (12 công + 12 tăng ca) |

- **Nhìn ra ngay**: `chip()` vẽ chip **hai nửa** `O|N`, mỗi nửa giữ màu của ca
  tương ứng; ô trong bảng lịch dùng nền `linear-gradient` chia đôi chéo
  (`cellStyle`, `SCHEDBG['O+N']`). CSS ở `css/ui.css` mục `.cc.combo`.
- **Loại mã riêng `cat:'combo'`** — cố ý KHÔNG dùng `'work'` cũng không dùng
  `'ot'`, để mọi chỗ cộng giờ không nhầm cả 20h thành giờ công.
  `comboSplitHours(code,total)` tách lại: phần công lấy trọn giờ ca chuẩn,
  phần dôi ra tính tăng ca. Quản lý ghi tổng thực tế 14h → 8h công + 6h OT.
- **Helper ở `01-core.js`**: `comboOf` · `isCombo` · `comboSplitHours` ·
  `workCodeOf` (mã ca chuẩn của ô) · `otCodeOf` (mã tăng ca của ô) ·
  `cntShift(cnt,'D'|'N'|'O')` (đếm ca, gộp `SD/SN/SO` và ca kép).
- **Đã sửa theo ở**: `calcStats` + `otShifts` (10-account), `mpBuckets` /
  `mpBucketsByPool` qua `mpPut()` — ca kép **đếm hai lần có chủ đích**: vẫn là
  một đầu người ở ca chuẩn VÀ vẫn nằm trong danh sách tăng ca; `baseShiftOf`
  (08-requests) trả nửa ca chuẩn; `otSummary` / `myPanelOt` / `myPanelSum`
  (13-portal); `repStatsAll` / `esBody` / `otlogRowsForPeriod` (15-report);
  `baseShiftWin` / `otBlocksOf` / `actualMealsOf` (19-meal — ca kép vẫn tính đủ
  suất cơm của cả ca chuẩn lẫn ca tăng); tổng D/N/O ở chân ma trận và bản Excel.
- **Không lọt vào form gửi đơn**: `dsCodesFor()` lọc theo `cat` nên `combo`
  tự động bị loại — mã ghép chỉ quản lý chọn được ở hộp sửa ô lịch.
- **Khi in**: biểu mẫu công ty không có ký hiệu ghép. Nhân viên bấm xác nhận ô
  ca kép thì `inferReqFromChange()` sinh **đơn Bổ sung công 2 dòng** (một dòng
  ca chuẩn, một dòng ca tăng) đúng như bản Excel gốc.

> Thêm tổ hợp khác (VD `N+D`) chỉ cần thêm 1 dòng vào `COMBO_CODES`,
> `DEFAULT_CODES`, `DEFAULT_HOURS` và `SCHEDBG`/`SCHEDTXT` — phần còn lại tự chạy.

### 2. Lịch trên điện thoại đổi sang LỊCH TUẦN dạng lưới

Bỏ hẳn danh sách theo ngày (`renderCalMpList`, `#calMpBox`) — quân số từng ngày
đã có sub-tab **👥 Nhân lực** lo. Thay bằng `renderCalWeekGrid()` / `#calWkGrid`:

- **Lưới người × 7 ngày**: hàng = từng người, cột = từng ngày. Nhìn ngang biết
  lịch cả tuần của mình, nhìn dọc biết hôm đó cả nhóm ai trực ca gì.
- **Mặc định đúng nhóm của người đăng nhập** (`calWkDefaultTeams()`); người
  không có nhóm thì mở nhóm đầu danh sách.
- **Chuyển tuần** `◀ ▶` + nút *Tuần này* (`calWkShift` / `calWkToday`,
  state `calWkMon`).
- **Xem thêm nhóm khác**: hàng chip nhóm cuộn ngang, chạm để thêm/bớt
  (`calWkToggleTeam`, luôn chừa lại ít nhất 1 nhóm) + nút *Tất cả* / *Nhóm của tôi*.
- Chạm ô: quản lý ở chế độ *Thực tế* → sửa ca; nhân viên → mở sheet ngày.
- Thanh `cal-bar` **ẩn chọn kỳ / khoảng ngày / nhóm khi ở điện thoại**
  (`calMonth`, `calRange`, `calGroupFilter`, `calPrevBtn`, `calNextBtn`) vì lưới
  tuần đã có thanh điều hướng riêng — tránh hai chỗ điều khiển đá nhau.

### 3. Sự kiện trên lịch — `js/20-events.js`, nhánh Firebase `events`

Ngày đặc biệt (nhập tàu, bảo dưỡng, kiểm định…) đánh dấu thẳng trên lịch thay vì
nhắn tay từng nhóm. Nút **📌 Sự kiện** (`admin-only`) ở thanh `cal-bar`.

- **Chọn ngày bằng lịch nhỏ**: chạm ngày để chọn/bỏ chọn, nút *Chọn cả dải*
  (bấm 2 ngày rồi lấp đầy khoảng giữa), *Bỏ chọn hết*. Ngày liên tục lưu gọn
  bằng `from`/`to`; ngày rời rạc lưu mảng `days`.
- **Một màu duy nhất** cho mọi sự kiện (`--evc`) — yêu cầu chỉ cần khác ngày
  thường, không phân loại. Hiện ở: ma trận máy tính (`th.evday`), lưới tuần
  điện thoại (`.cwg-row.hd .c.ev`), lịch trang chính nhân viên (`.pv-d.evday`
  + nhãn tên sự kiện), dải nhắc `evBannerHtml()` ở trang chính và sheet ngày.
- **Chọn người nhận từng lần** (`EV_SCOPE`): *Tất cả mọi người* / *Chỉ nhóm có
  làm việc ngày đó* (`evIsWorkingCode` — có ca làm, kể cả tăng ca) / *Chọn nhóm
  cụ thể*. Trước khi lưu, màn hình hiện luôn **sẽ gửi tới bao nhiêu người** và
  nhóm nào đang có người làm việc trong khoảng ngày đó.
- **Sửa & xoá thu hồi thông báo**: `evSendNotifs()` LUÔN gọi `evRevokeNotifs()`
  trước, nên lưu lại không bao giờ đẻ ra hai thông báo lệch nhau; `evDelete()`
  xoá sự kiện kèm toàn bộ thông báo của nó.
- Thông báo mang `kind:'event'`, `status:'sent'` (không phải `'pending'`) để
  `pruneOldNotifs()` dọn được sau ~2 kỳ. Chuông đếm qua `SEEN_KINDS`.
- Bộ đệm `evIndex()` khoá theo `S.rev`; `evResetCache()` gọi trong `fbTouch()`.

### 4. Thu hồi thông báo khi trả lịch về ca chuẩn

Lỗi cũ: quản lý đổi ca của một người → nhân viên nhận thông báo xác nhận; quản
lý đổi ý, trả ô về ca chuẩn → **thông báo vẫn nằm đó**, nhân viên xác nhận nhầm
một thay đổi không còn tồn tại.

`setCell()` nay so mã sau khi sửa với **ca chuẩn** (`S.base`), bằng nhau thì gọi
`revokeSchedChange(empId,iso,stdCode)` ở `13-portal.js` — bắt cả hai đường:
bấm *↩︎ Về ca chuẩn* lẫn gán tay đúng mã chuẩn.

| Trạng thái thông báo | Xử lý |
|---|---|
| `pending` (chưa xác nhận) | **xoá hẳn, im lặng** — không làm phiền ai |
| `confirmed` (đã xác nhận) | chuyển `revoked` + **gửi thông báo thu hồi**, nhắc nhân viên vào *Đơn của tôi* huỷ đơn đã gửi |

### Kiểm thử

* `_test/harness-v58.js` — **42 kiểm tra** logic: tách giờ ca kép, quân số theo
  ngày, suất cơm, ngày/người nhận/thu hồi của sự kiện, hai nhánh thu hồi thông báo.
* `_test/render-v58.js` — **23 kiểm tra** dựng HTML thật (DOM giả) cho chip ca
  kép, lưới lịch tuần, ma trận có ngày sự kiện, màn quản lý sự kiện, `setCell`.

```bash
cd LPGT-CongCa-Web && node _test/harness-v58.js && node _test/render-v58.js
```

i18n: **+60 khoá EN** ở cuối `I18N_EN` (đã kiểm không trùng — 8 khoá trùng còn
lại là tồn tại từ trước). Sandbox vẫn không chạy được trình duyệt → phần hiển thị
phải mở thật trên máy để mắt nhìn.

---

## v6.1 — Xác nhận đã nhập hệ thống HR · tư vấn duyệt đơn hiểu người OT cover

### 1. Dấu “đã nhập hệ thống HR công ty” (`js/08-requests.js`)

Đơn duyệt xong trong app vẫn phải gõ lại vào hệ thống nhân sự chính thức của
công ty. Trước đây không có chỗ nào ghi nhận việc đó → in tờ đơn ra rồi vẫn
không biết đã nhập HR chưa, cuối kỳ dễ sót. Nay mỗi đơn mang thêm **2 khoá**:

```js
r.hrAt   // mốc thời gian đã nhập (không có = chưa nhập)
r.hrBy   // mã NV người bấm xác nhận
```

* **2 trạng thái** thôi — `○ chưa nhập HR` ⇄ `✅ đã nhập HR`. Bấm lần 2 thì
  **xoá hẳn 2 khoá** khỏi bản ghi chứ không ghi `false`, để đơn chưa nhập
  không tốn thêm byte nào của gói Firebase Spark.
* **Mọi người dùng đều bấm được** (`canSetHr()` chỉ đòi đã đăng nhập) — người
  gõ HR có thể là thư ký, quản lý hay chính người duyệt.
* Không sinh thông báo, không đụng lịch. Đây thuần tuý là dấu tick theo dõi.

Hàm liên quan: `reqHrDone` · `reqHrChip(r,btn)` · `toggleReqHr(id)` ·
`markPickedHr(on)` (đánh dấu hàng loạt theo ô tích).

**Chỗ hiện ra trong màn Duyệt:**

| Nơi | Cách hiện |
|---|---|
| Bảng PC | **cột “HR”** mới (giữa cột *In* và cột thao tác) — bấm thẳng vào chip để đổi |
| Thẻ mobile | badge `✅ đã nhập HR` ở hàng tiêu đề + nút trong khối thao tác phụ |
| Hàng chi tiết | mốc `Nhập HR: <giờ> · <người nhập>` trong `.ar-meta` |
| Thanh chọn nhiều | 2 nút `✅ Đã nhập HR` / `↩️ Bỏ dấu HR` |
| Xuất Excel | 2 cột mới *Nhập HR lúc* · *Người nhập HR* |

**Bộ lọc** — hàng chip thứ 3 (`apprFilter.hr`), có đếm số như 2 hàng trên:

| Chip | Nghĩa |
|---|---|
| Mọi đơn | không lọc |
| ⏰ **Cần nhập HR** | đơn **đã duyệt chốt** mà chưa nhập — đúng việc cần làm mỗi kỳ |
| ○ Chưa nhập HR | mọi đơn chưa nhập (kể cả đang chờ duyệt) |
| ✅ Đã nhập HR | đã nhập rồi |

> Bảng Duyệt trên PC nay **13 cột**. Sửa cột thì phải sửa đồng thời `AT_COLS`,
> `<colgroup>` (tổng đúng 100%), số `<td>` trong `apprTr()` và `colspan` của
> hàng chi tiết — `_test/hr-mark-harness.js` kiểm đúng chỗ này.

### 2. Trợ lý duyệt đơn: hiểu người OT cover, tập trung vào ngày đã có người nghỉ (`js/18-advice.js`)

**(a) Có người OT cover thì không thiếu nhân lực.** Bộ tư vấn trước đây không
biết `r.coverId` nên vẫn kêu “dưới định mức” dù đã có người ở lại gánh ca —
người duyệt phải tự nhẩm lại. Nay `leaveAdvice()` nhận thêm tham số thứ 5:

```js
leaveAdvice(empId, iso, newCode, skipReqId, {coverId, coverSt, at})
```

* **Chỉ cover `confirmed` mới bù quân số** (`after[shift] + 1`). Cover mới chỉ
  định mà người ta chưa bấm đồng ý thì chưa chắc có người → chỉ nhắc.
* Cover phải **cùng khối** (`poolOf`) mới bù — văn phòng và sản xuất không
  gánh ca cho nhau. Cover mà chính họ cũng nghỉ ngày đó cũng không tính.
* Có cover hợp lệ → cảnh báo hạ từ 🔴 xuống 🟡 (vấn đề còn lại chỉ là **thứ tự
  ưu tiên**, không phải thiếu người) và thôi gợi ý danh sách huy động thêm.

**(b) Tập trung vào ngày đã có người đăng ký nghỉ TRƯỚC.** `offListOfDay()` nay
ghi kèm `at` = mốc **đăng ký** (không phải mốc duyệt) và `coverId/coverSt` của
đơn nguồn. `leaveAdvice` so `at` với mốc gửi của đơn đang xét để tách
`earlier` / `earlierTeam` — ai xí chỗ trước thì được ưu tiên, đơn gửi sau phải
nhường hoặc phải có cover. Đây thành **tiêu chí số 1**, nêu đích danh tên
người và nêu trước mọi tiêu chí khác; ô lịch quản lý gõ tay (không có đơn)
tính `at=0` nên luôn là “trước”.

`reqAdvice()` tính hết mọi ngày của đơn rồi **chỉ hiện ngày đáng xem** — ngày
có người đăng ký nghỉ trước hoặc có cảnh báo — kèm ghi chú
*“Đang tập trung vào 1/3 ngày… — 2 ngày còn lại trống, duyệt được ngay.”*
Đơn 15 ngày mà chỉ 2 ngày vướng thì không bắt người duyệt cuộn qua 13 ngày trống.

Dấu hiệu trên giao diện: chip `⏱ N người đăng ký trước` ở đầu ngày, viên tên
người đăng ký trước viền cam + nhãn `⏱ đăng ký trước`, dải `🤝 Người OT cover`
xanh/vàng theo trạng thái, chip `⏱ N/M ngày cần cân nhắc` trên đầu panel.

Form gửi đơn cũng dùng chung engine: `advForFormHtml(empId, rows, type, coverId)`
truyền `dsCoverId` vào, mốc so sánh lấy `Date.now()` (đơn chưa gửi) và
`coverSt='pending'` (người vừa chọn chắc chắn chưa xác nhận).

### 3. Danh sách uỷ quyền phê duyệt cấp cuối (`js/10-account.js`)

`kdCandidates()` trước đây lọc `permOf(e.id)!=='kmgr'` → **loại sạch Quản lý
người Hàn** khỏi danh sách chọn, với giả định họ vốn đã duyệt được. Nhưng công
ty có **nhiều** quản lý người Hàn, và khi một người đi vắng thì người cần nhận
uỷ quyền thường lại chính là quản lý người Hàn còn lại. Nay chỉ loại **chính
người đang thao tác**, và xếp thứ tự `kmgr → admin/appr → sec → còn lại`
(`KD_RANK`), mỗi nhóm sắp theo tên tiếng Việt.

### Kiểm tra

* `_test/advice-cover-harness.js` — **16 kịch bản**: cover đã xác nhận / chưa
  xác nhận / khác khối, ai đăng ký trước–sau, chọn đúng ngày cần cân nhắc,
  dựng HTML cả 2 panel.
* `_test/hr-mark-harness.js` — **15 kịch bản**: bật/tắt dấu HR, xoá hẳn khoá,
  4 nhánh bộ lọc, đánh dấu hàng loạt, chip HTML, số cột Excel khớp.

```bash
cd LPGT-CongCa-Web && node _test/advice-cover-harness.js && node _test/hr-mark-harness.js
```

i18n: **+44 khoá EN** ở cuối `I18N_EN` (đã kiểm không trùng — 11 khoá trùng còn
lại là tồn tại từ trước). Cache bump **`?v=65`** trong `index.html`.

---

## v6.2 — Thu hồi triệt để thông báo đã lỗi thời

**Triệu chứng người dùng báo:** lời nhắc *“xác nhận đổi lịch”* và lời nhờ
*“OT cover”* vẫn nằm trong máy người nhận sau khi người tạo ra chúng đã xoá
việc. Nhân viên bấm vào thì không có gì xảy ra, tưởng app hỏng.

### Bốn lỗ hổng đã tìm ra

| # | Đường đi | Vì sao lọt |
|---|---|---|
| 1 | Nút **⌫ Xoá ô** trên lịch thực tế | `openCell()` gọi `setCell('')` chứ không phải `setCell(null)`. `setCell` chỉ nhận `null` là “gỡ ô”, nên `''` rơi vào nhánh GHI, tạo ra ô rỗng `{code:''}`; `newCode` thành `''` nên không bao giờ bằng ca chuẩn → nhánh `revokeSchedChange()` không chạy |
| 2 | Đơn bị **TỪ CHỐI** (khác với bị huỷ) | `cancelReq()` có dọn thông báo, nhưng `decide(id,false)` thì không → lời nhờ OT cover treo vĩnh viễn |
| 3 | Máy khác thao tác rồi đồng bộ về | Không có đường nào dọn — thông báo chỉ được gỡ ngay tại máy vừa bấm |
| 4 | `pruneOldNotifs()` | `newNotif()` mặc định gán `status:'pending'`, nên tin một chiều (`kind:'info'`) cũng lọt vào diện “giữ mãi” → chất đống trong Firebase, không bao giờ dọn |

### Cách chữa — kiểm lại từ dữ liệu, không đuổi theo từng đường đi

Vá riêng từng đường đi là trò đuổi bắt: thêm tính năng mới lại lọt tiếp. Nên
`js/13-portal.js` có thêm **`notifStaleReason(n)`** — nhìn vào dữ liệu hiện tại
và trả về lý do một việc-chờ-xác-nhận đã hết nghĩa:

| Loại | Coi là lỗi thời khi |
|---|---|
| `schedChange` | `eff(to, iso).code` **khác** `n.newCode` — ô đã trả về ca chuẩn, đã bị xoá, hoặc bị một đơn khác duyệt ghi đè |
| `coverConfirm` | đơn đã bị xoá · đơn bị từ chối · `r.coverId` đã đổi sang người khác |
| `swapConfirm` | đơn đã bị xoá · đơn bị từ chối · `r.withId` đã đổi |
| cả ba | người nhận đã nghỉ việc / bị vô hiệu hoá |

Đúng với **mọi** đường đi, kể cả những đường sẽ thêm về sau. Ba lớp áp dụng:

1. **Lớp hiển thị** — `pendingConfirms()` và `myNotifs()` lọc bỏ việc lỗi thời.
   Kể cả khi bộ quét chưa kịp chạy (vừa nhận đồng bộ từ máy khác), nó cũng
   không hiện ra và không được đếm vào chuông.
2. **Lớp dữ liệu** — `sweepStaleNotifs()` gỡ hẳn. Chạy lúc **khởi động**, mỗi
   lượt **đồng bộ Firebase** (`renderAll`, có tiết chế 30 giây, chỉ ghi khi
   thật sự gỡ được gì), và khi **mở bảng thông báo**. Xoá là thao tác luỹ đẳng
   nên nhiều máy cùng quét vẫn ra một kết quả.
3. **Lớp thao tác** — `notifTake(nid)` thay cho `S.notifs[nid]` ở cả 6 hàm
   xác nhận/từ chối. Hai người thao tác cùng lúc thì người bấm sau nhận được
   *“Việc này đã không còn — đơn đã bị xoá”* thay vì bấm vào khoảng không.

### Một cửa duy nhất để xoá thông báo — kèm rút tin Zalo

Trước đây mỗi nơi tự `delete S.notifs[k]`, nên tin trong app biến mất mà bản
đã xếp hàng ở `zaloQueue` vẫn còn → người ta **vẫn nhận tin nhắn Zalo** cho
việc đã huỷ. Nay mọi chỗ đi qua **`notifDrop(pred)`**, hàm này tự gọi
**`zaloWithdraw(notifId)`** (mới, `js/21-notify.js`): khoá hàng đợi chính là
`notifId` nên rút chỉ là xoá một nhánh con — và **chỉ rút tin còn
`state:'pending'`**, tin đã gửi thì để yên vì Zalo không cho thu hồi và xoá đi
thì mất dấu vết. `cancelReq` · `reqSetCover` · `decide(reject)` ·
`revokeSchedChange` · `evRevokeNotifs` đều đã chuyển sang dùng.

### Sửa kèm

* `setCell()` gộp `null` / `''` / `undefined` thành một nghĩa “gỡ ô đè, về ca
  chuẩn” — không nút nào lỡ tay ghi ra ô rỗng làm lệch quân số nữa.
  Nhãn nút đổi thành **⌫ Xoá ô (về ca chuẩn)** cho đúng việc nó làm.
* `apprPartyIds()` thêm **`r.coverId`** — người nhận OT cover nay được báo khi
  đơn bị huỷ / từ chối / huỷ duyệt, thay vì chỉ thấy lời nhờ biến mất.
* `pruneOldNotifs()` chỉ giữ mãi việc chờ **thật sự còn hiệu lực**
  (`notifKeepForever`), tin `info` cũ hơn 62 ngày nay dọn được.

### Kiểm tra

`_test/notif-stale-harness.js` — **22 kịch bản** dựng đúng từng lỗ hổng ở trên:
xoá ô lịch, ô bị ghi đè, bản đã xác nhận phải được giữ, đơn bị xoá/từ chối,
đổi người cover, đổi người đổi ca, người nhận nghỉ việc, chặn bấm việc lỗi
thời, tin `info` không bị quét nhầm, `pruneOldNotifs` dọn được tin cũ, tiết chế
30 giây, và **khẳng định tin trong hàng đợi Zalo được rút thật**.

Hai harness cũ cũng được vá luôn (chúng cắt lát `js/13-portal.js` nên phải lấy
thêm khối `notifDrop`; `render-v58.js` còn thiếu `document.body` khiến 4 phép
thử báo hỏng oan):

```bash
cd LPGT-CongCa-Web
node _test/harness-v58.js && node _test/render-v58.js \
  && node _test/advice-cover-harness.js && node _test/hr-mark-harness.js \
  && node _test/notif-stale-harness.js \
  && node _test/meal-harness.js . && node _test/meal-render-smoke.js . \
  && node _test/mp-render-smoke.js .
```

→ **199 phép thử, 0 hỏng.** Lưu ý 3 harness cuối cần **tham số thư mục** (`.`).

i18n: **+9 khoá EN**. Cache bump **`?v=66`**.

---

# v6.7 — XOÁ ĐƠN LÀ XOÁ THẬT

## Triệu chứng

Xoá đơn ở màn *Duyệt*, màn hình báo "Đã xoá", đơn biến mất. Đăng xuất, đăng
nhập lại → **đơn hiện lại nguyên vẹn**. Xoá bao nhiêu lần cũng vậy. Đã bỏ hẳn
cache ở v6.6 mà vẫn bị.

## Nguyên nhân thật

Không phải cache, cũng không phải "đơn nằm ở nhiều cấp duyệt". Một đơn chỉ tồn
tại **đúng một bản** ở `requests/<id>` trên Firebase; các cấp duyệt chỉ là
trường `r.appr` *bên trong* chính đơn đó, không hề nhân bản theo tài khoản.

Gốc rễ nằm ở **tên khoá của sổ bia mộ**. Từ v6.2 sổ bia mộ lưu phẳng:

```js
S.del["requests/" + id] = ts;      // ← khoá chứa dấu '/'
```

Firebase Realtime Database **cấm** các ký tự `/ . # $ [ ]` trong tên khoá. Khi
`fbPush` gửi:

```js
fbRef.update({ "requests/r_abc": null,
               del: { "requests/r_abc": 1754… },   // ← khoá không hợp lệ
               rev: … });
```

SDK kiểm dữ liệu **trước khi gọi mạng** và **NÉM LỖI ĐỒNG BỘ** (`throw`, không
phải promise bị reject). Chuỗi hậu quả:

1. `update()` là **nguyên khối** → cả gói trượt, **kể cả vế `requests/<id>: null`**.
   Máy chủ **không hề xoá đơn**.
2. Vì là `throw` chứ không phải reject, nhánh `.catch` **không chạy** → `_fbDirty`
   không bật, không có thử lại. Mà mốc `_fbLast` thì đã dời sang trạng thái
   "đã xoá" → mọi lần push sau tính delta so với một **hiện trạng không có thật**,
   nên **không bao giờ gửi lại lệnh xoá nữa**.
3. Trên màn hình đơn đã biến mất (bộ nhớ `S` đã xoá) → người dùng tin là xong.
   Mở lại app, v6.6 đọc thẳng từ Firebase → đơn còn nguyên.

Nói gọn: **lệnh xoá chưa từng tới được Firebase, mà app lại báo là xong.**

## Bốn lớp sửa

**1. Sổ bia mộ lồng hai tầng** (`js/02-storage.js`)

```
del/<nhánh>/<id> = ts        (thay cho del["<nhánh>/<id>"] = ts)
```

Tên khoá nay chỉ còn tên nhánh và id — đều hợp lệ. Lệnh ghi dùng thẳng đường
dẫn `'del/'+nhánh+'/'+id` (khoá **cấp trên** của `update()` được phép chứa `/`),
nên hai máy xoá hai đơn khác nhau cùng lúc **không đè sổ của nhau** — trước đây
gửi trọn object `del` thì có.

Hàm mới: `tombHas()` · `tombSet()` · `tombMigrate()`. `tombMigrate()` chuyển sổ
dạng phẳng cũ sang dạng lồng, chạy khi mở app và mỗi lần nhánh `del` bay về từ
một máy còn chạy bản cũ. Nếu máy chủ còn giữ sổ dạng cũ, `fbBootLoad` phát hiện
(`delFixed`) và đẩy sổ dạng mới lên **một lần duy nhất**.

**2. Không lệnh ghi nào được biến mất trong im lặng** (`js/02-storage.js`)

- `fbPush` rà toàn bộ tên khoá bằng `fbKeyOk()` / `fbPathOk()` / `fbBadKeyIn()`
  **trước khi gửi**, gỡ đúng khoá hỏng ra khỏi gói và ghi rõ ra console — thay
  vì để một khoá hỏng làm trượt cả gói.
- `fbRef.update()` được bọc `try/catch`. Throw nay đi vào **cùng một nhánh xử lý
  lỗi** với reject: hoàn tác mốc `_fbLast`, bật `_fbDirty`, hẹn `fbRetry()`.

**3. Báo "đã xoá" chỉ khi Firebase gật đầu**

`save(cb)` nay nhận callback, gọi `cb(true)` **sau khi máy chủ xác nhận**, `cb(false)`
khi trượt. `apprAfterDelete()` (`js/08-requests.js`) và `cancelMyReq()`
(`js/13-portal.js`) dùng nó:

- thành công → *"Đã xoá N đơn — máy chủ đã xác nhận"*
- trượt → cảnh báo **CHƯA xoá được**, app tự gửi lại nền, đèn đồng bộ đứng ở
  *"Chưa gửi được — đang thử lại"*

Cố tình **không** gọi `fbReconcile()` ở nhánh trượt: reconcile lấy máy chủ làm
chuẩn nên sẽ dẹp luôn lệnh xoá đang chờ gửi lại.

**4. Siết quyền xoá** (`js/08-requests.js`)

```js
const PURGE_PERMS = ['admin','kmgr','sec'];   // Quản trị · Quản lý người Hàn · Thư ký
function canPurgeReqs(){ … }
```

Trước đây bất kỳ ai vào được màn *Duyệt* (`mgr` **hoặc** Field Engineer của nhóm)
đều bấm được nút xoá hàng loạt — quá rộng so với hệ quả không hoàn tác được.
Nay `cancelPickedReqs` · `exportThenPurgeReqs` · `apprPurgeYear` · `canCancelReq`
đều đi qua `canPurgeReqs()`; nút 🗑️ chỉ hiện với ba vai trò trên.
**Field Engineer và Section Chief vẫn duyệt / từ chối / in như cũ, chỉ không xoá.**
**Nhân viên vẫn tự rút đơn của chính mình** khi còn `pending`/`approved` và chưa in.

## Kiểm chứng

`_test/delete-resurrect-harness.js` dựng Firebase giả **kiểm tên khoá y như thật
và ném lỗi đồng bộ y như thật**:

```
node _test/delete-resurrect-harness.js
```

8 nhóm bài, **31 phép thử, 0 hỏng** — trong đó bài 1 *tái hiện được lỗi cũ* (chứng
minh khoá phẳng thật sự bị Firebase chặn và máy chủ không ghi gì), bài 2–3 chứng
minh máy chủ xoá thật và mở lại không thấy đơn, bài 6 chứng minh ghi trượt thì
app không nói dối và lần gửi lại vẫn đủ.

i18n: **+3 khoá EN**. Cache bump **`?v=70`**.

> **Sau khi sửa phải đẩy lại lên GitHub Pages** — bản đang chạy trên Pages vẫn là
> bản cũ cho tới khi push.

---

# v6.8 — LỌC THEO VỊ TRÍ · BẢN TIN ZALO GOM 08:00

## 1. Lọc nhóm vị trí (Kỹ sư / Operator / Khác)

Người ngồi gõ đơn vào hệ thống HR của công ty làm hộ **theo từng nhóm** chứ không
làm lẫn lộn. Trước đây phải tự dò tên từng người trong danh sách chung.

Nhóm vị trí lấy thẳng từ `posGroupOf()` (`js/01-core.js`): `field_eng` + `boardman`
= **Kỹ sư**, `operator` = **Operator**, còn lại = **Khác** — đúng cách phân nhóm mà
bảng *Nhân lực* đang dùng, không đẻ khái niệm mới.

| Màn | Chỗ đặt | Ghi chú |
|---|---|---|
| **Duyệt** | hàng chip dưới hàng lọc HR | `apprFilter.pg` → vào `apprMatch()` nên **danh sách, xuất Excel và in đều theo** |
| **Báo cáo** (Tổng hợp cá nhân/nhóm) | hàng "Vị trí" | lọc **sau** khi đã chọn nhóm/cá nhân; đã chỉ đích danh ai thì không lọc tiếp |
| **Nhật ký tăng ca** | hàng chip dưới ô tìm | dòng Excel chỉ có TÊN → bắc cầu qua `otNorm()`; tên không tra ra người xếp vào *Khác* chứ không giấu |

Ba màn **dùng chung một lựa chọn** (`pgRemember` / `pgRecall`, nhớ trên máy, không
đồng bộ). Nút **↺ Bỏ lọc** ở màn Duyệt **không** xoá nhóm vị trí — đó là "tôi đang
làm hộ nhóm nào", không phải điều kiện lọc nhất thời.

Số trên mỗi chip là **tổng thật của nhóm đó**, không phải tổng sau khi đã lọc chính nó.

## 2. Bản tin Zalo gom lúc 08:00

### Vì sao trước nay không chạy

**Chưa từng được viết.** Không có dòng code nào về digest/08:00 trong `js/`, cũng
không có trong `ZALO-BOT.md`. Đơn tăng ca sinh thông báo `apprNeed` với kênh `'now'`
→ bắn ngay.

Và hộp gửi `zaloOut*` (v6.3) **về nguyên lý không làm nổi việc này**: nó chỉ gộp
những tin sinh ra **trên cùng một máy trong 4 giây**. Đơn tăng ca thì ngược hẳn —
20 người gửi từ 20 điện thoại, rải rác cả ngày. Không có hai tin nào rơi vào cùng
một hộp gửi.

### Cách làm — kênh thứ ba `'digest'`

```
newNotif ──▶ zaloEnqueue ──▶ pri='now'    ──▶ hộp gửi 4s ──▶ zaloQueue   (như cũ)
                        └──▶ pri='digest' ──▶ S.digest ──┐
                                                          │ 08:00 hôm sau
                                          gom theo thể loại ──▶ zaloQueue
```

- **Sổ chờ `S.digest`** là một nhánh bảng của Firebase (`FB_MAP_BRANCHES`) → mọi máy
  thấy như nhau, xoá là xoá thật (có bia mộ, cùng cơ chế đã sửa ở v6.7).
- **Giành quyền bắn** bằng `transaction` trên `meta/digestDay`. Đúng **một** máy
  thắng trong ngày, kể cả khi 23 máy cùng mở lúc 08:00:00 — so giờ ở phía máy thì
  máy nào cũng thấy "chưa ai bắn".
- **Gom theo THỂ LOẠI** (khoá `group`): mỗi thể loại đúng **một** tin.
- Kiểm lúc mở app, mỗi 5 phút, và mỗi lần tab quay lại — máy để mở qua đêm cũng bắn
  đúng 08:00.
- **Không cần sửa Apps Script.** Phía máy chủ vẫn chỉ thấy những hàng `zaloQueue`
  bình thường.

### Phạm vi — cố ý hẹp

| | Vào bản tin 08:00 |
|---|---|
| Loại **đơn** | `ot` · `multi` · `late` · `wt` |
| Loại **tin** | `apprNeed` (có đơn chờ duyệt) · `cancelled` (đơn bị huỷ) |

**KHÔNG** gom `approved` / `rejected` / `revoked`: đơn tăng ca tối nay mà sáng mai
mới báo kết quả thì tin đến sau khi việc đã xong. Việc gấp (đổi ca, OT cover, sửa
lịch) vẫn đi kênh `'now'` như cũ, **không hề bị chạm tới**.

### Các mép đã bịt

- **Đơn huỷ trước 08:00** → `zaloWithdraw` gỡ khỏi sổ chờ, tin bốc hơi mà không tốn gì.
- **Mục lỗi thời** (thông báo đã bị gỡ) bị loại trước khi dựng tin; sổ chờ chỉ toàn
  mục lỗi thời thì **không gửi tin rỗng** (quy tắc R5).
- **Ghi trượt** thì mục **ở lại** sổ chờ và mốc ngày được trả về để lần mở app sau
  bắn lại — đúng bài học v6.7, không bao giờ coi là xong khi máy chủ chưa nhận.
- **Cả ngày không ai mở app** → bản tin dồn sang lần mở kế tiếp, tiêu đề ghi rõ
  khoảng ngày đã gom (`10/08→12/08`).
- Tin quá dài thì cắt ở 60 dòng, kèm `… and N more line(s)`.

### Chỗ theo dõi

Màn **Dữ liệu** → thẻ *🌅 Bản tin Zalo gom lúc 08:00*: số mục đang chờ, ngày gom gần
nhất, và nút **📨 Gửi ngay bản tin gom** (quản trị, không cần đợi 08:00).

## Kiểm chứng

```
node _test/digest-pg-harness.js     # 40 phép thử
```

A1–A9 phủ bản tin gom (kể cả hai máy cùng bắn, không bắn lại trong ngày, đơn huỷ,
tin rỗng, dồn nhiều ngày); B1–B4 phủ bộ lọc vị trí.

Toàn bộ 12 harness xanh. i18n **+10 khoá EN**. Cache bump **`?v=71`**.

> `pgChips()` là HÀM chứ không phải hằng — hằng sẽ đọc `POSG_*` ngay lúc nạp file,
> mà thứ tự nạp script chỉ đúng trong trình duyệt; các harness nạp lẻ `08-requests.js`
> sẽ nổ `POSG_OPER is not defined`. Đã vấp một lần, ghi lại để khỏi vấp lại.

---

# v6.9 — KẾT QUẢ DUYỆT OT GOM VỀ 08:00 · TRỪ GIỜ NGHỈ TRƯA

## 1. "Đã duyệt" của đơn OT cũng gom về bản tin sáng

**Lý do nghiệp vụ:** app chỉ để **phê duyệt và lưu dữ liệu**; hệ thống chấm công
chính thức nằm ở HR **ngoài app**. Báo từng đơn "đã duyệt" ngay lập tức không đổi
được việc gì ở hiện trường — chỉ tốn tin Zalo.

`DIGEST_ZK` nay là `['apprNeed','approved','cancelled']`.

| Tin | Đơn `ot·multi·late·wt` | Đơn `leave·swap·change` |
|---|---|---|
| `apprNeed` (chờ duyệt) | 🌅 gom 08:00 | 🔴 ngay |
| `approved` (đã duyệt) | 🌅 **gom 08:00** ← mới | 🔴 ngay |
| `rejected` (bị từ chối) | 🔴 **ngay** | 🔴 ngay |
| `revoked` (thu hồi) | 🔴 ngay | 🔴 ngay |
| `cancelled` (bị huỷ) | 🌅 gom 08:00 | 🟡 batch |

**Vì sao `rejected` KHÔNG gom:** người đã đăng ký OT tối nay mà bị từ chối phải biết
sớm, không thì họ đi làm thừa. Nghỉ phép và đổi ca thì **mọi tin đều `now`** — chúng
đổi lịch đi làm thật, biết muộn là đi sai ca.

**Cấu trúc tin gom** dùng lại `zReqLines()` sẵn có nên mỗi mục đã đủ *ai · OT kiểu gì*:

```
✅ DAILY DIGEST — REQUESTS APPROVED / CLOSED · 5 item(s) · 12/08

Wed 12/08  NGUYEN VAN A  D → D + OT 08:00–20:00 (11h, −1h lunch)
Final: HONG GIL DONG — schedule updated
— — —
Wed 12/08  TRAN VAN B  R → OT 17:00–20:00 (3h)
Final: HONG GIL DONG — schedule updated
```

## 2. Ô tích "Không làm trưa" — trừ 1 giờ khỏi giờ OT

Tăng ca 08:00→20:00 mà vẫn nghỉ trưa như thường thì công thực nhận là **11h** chứ
không phải 12h. Trước đây app lấy trọn hiệu hai mốc giờ, nên người khai phải tự bịa
giờ (khai 08:00→19:00) cho ra đúng số — dữ liệu sai so với thực tế đi làm, mà bản in
nộp nhân sự cũng sai theo.

**Ba hàm mới ở `js/01-core.js`:**

```js
const LUNCH_BREAK_H = 1;                    // cố định 1 giờ
otSpansLunch(iso,tFrom,isoEnd,tTo)          // khung giờ có phủ 12:00–13:00?
otNetHours(iso,tFrom,isoEnd,tTo,noLunch)    // giờ THỰC NHẬN, đã trừ
otDayHours(d)                               // tiện cho chỗ đã có sẵn cả dòng
```

**Hai chốt để không trừ nhầm:**

1. Ô tích **chỉ hiện** khi khung giờ khai thật sự phủ 12:00–13:00. OT 17:00–20:00 thì
   không có ô để mà tích nhầm.
2. Người khai sửa giờ / đổi ngày / đổi mẫu OT thành không còn phủ trưa → **cờ tự rơi**.
   Thiếu chốt này thì cờ cũ nằm lại và trừ oan 1 giờ.

Thêm: dòng ra **0 giờ** (khai đúng đoạn 12:00–13:00 rồi tích) bị **chặn ngay lúc gửi**.

**Số giờ chảy đi đâu:** `d.hours` lưu xuống Firebase **là số đã trừ**, nên bản in ·
Excel · suất cơm · Nhật ký tăng ca · Tổng quan tự khớp. Mọi chỗ còn gọi `otHours()`
trực tiếp đã đổi sang `otNetHours()` — harness C5 canh không cho lọt lại.

**Hiển thị:** dấu hổ phách `−1h trưa` ở màn Duyệt (dòng tóm tắt và chi tiết), Excel ghi
`12/08(OTD)[-1h trưa]` trong ô *Ngày (mã)*, tờ đơn in ghi *(trừ 1h nghỉ trưa / minus 1h
lunch)* trong phần lý do, tin Zalo ghi `(11h, −1h lunch)`. Người đọc thấy 08:00–20:00
mà chỉ 11h thì phải hiểu ngay vì sao — không thì họ tưởng app tính sai.

**Dữ liệu cũ không đổi số:** dòng đơn không có `d.noLunch` tính y như trước.

## Kiểm chứng

```
node _test/digest-pg-harness.js     # 67 phép thử (A·B·C·D)
```

C1–C6 phủ phép trừ giờ trưa (kể cả biên 12:00 / 13:00, dữ liệu cũ, và quét không cho
chỗ nào lọt `otHours` trần); D1–D3 phủ kênh của `approved` / `rejected`.

Toàn bộ harness xanh. i18n **+4 khoá EN**. Cache bump **`?v=72`**.

---

# v7.0 — Lịch đào tạo · mã BT (công tác) · tự chuyển kỳ ca

## 1. Lịch đào tạo — `js/22-training.js` (nạp ngay sau `20-events.js`)

### Vấn đề đang có

Đào tạo trước nay đi bằng miệng và tin nhắn lẻ: quản lý nhắn "thứ Năm anh đi học an
toàn", người nghe tự nhớ. Đến ngày mới lòi ra hai chuyện:

* hôm đó anh ta **trực ca đêm** — không ai đối chiếu trước;
* học **ngoài giờ** mà **không ai khai đơn tăng ca** → không được tính giờ.

### Mô hình dữ liệu

Một **buổi đào tạo** = một bản ghi `S.trainings[id]`, gồm **nhiều ngày** và **nhiều
người**. Xếp cho 8 người học 2 ngày vẫn chỉ là MỘT bản ghi — sửa một lần là sửa cho
tất cả, đúng cách người ta nghĩ về việc này.

```js
S.trainings[id] = {
  id, title, place, note,
  days : ['2026-08-24','2026-08-25'],   // các ngày
  emps : ['e1','e2'],                   // ai đi học
  mode : 'shift' | 'ot',                // trong ca / tính tăng ca
  otCode, preset, timeIn, timeOut, overnight, noLunch,   // chỉ khi mode='ot'
  status: 'active' | 'pending',         // pending = NV tự khai, chờ duyệt
  notify, by, at, editBy, editAt
}
```

Nhánh Firebase riêng `trainings`, đồng bộ **delta** như `requests`/`notifs`/`events`
(thêm vào `FB_MAP_BRANCHES` ở `js/02-storage.js`).

### Ai xếp được cho ai

| Quyền | Xếp cho người khác | Xếp cho mình | Duyệt |
|---|---|---|---|
| Quản trị (`admin`) · QL người Hàn (`kmgr`) · SC / Duyệt đơn (`appr`) · Thư ký (`sec`) | ✅ | ✅ | ✅ |
| Nhân viên (`staff`) | ❌ | ✅ (chờ duyệt) | ❌ |

Đúng bằng cờ `secr` đã có sẵn — **không đẻ thêm khái niệm quyền mới**. Chặn ở
`trSave()` chứ không chỉ ở giao diện, nên gọi thẳng hàm trong console cũng không lách được.

Nút mở: `🎓 Đào tạo` trên thanh tab **Lịch** (class `.secr-only` mới), kèm phù hiệu đỏ
đếm số buổi đang chờ duyệt. Nhân viên thường vào bằng nút `🎓 Lịch đào tạo của tôi` ở
Trang chính.

### Hai chế độ

**`shift` — trong ca làm việc.** Không sinh đơn, không đổi mã ca. Ô lịch chỉ đổi màu.

**`ot` — ngoài ca, tính tăng ca.** Mỗi người **một đơn tăng ca THẬT** (`type:'ot'`), đi
đúng luồng duyệt FE › SC › QL người Hàn, **in được biểu mẫu**, vào **báo cáo giờ OT** và
**suất cơm**. Đơn ghi lý do `Đào tạo: <tên buổi>` và mang `r.trId` — sợi dây nối ngược
về buổi đào tạo để về sau còn sửa/gỡ được.

Màn xếp lịch hiện **tổng giờ tăng ca ước tính** (`giờ/người × số người`) **trước khi bấm
lưu**. Con số này quyết định tiền — phải thấy ở đây, không phải phát hiện ở bảng lương.

### Duyệt

* Quản lý xếp → `status:'active'` ngay.
* Nhân viên tự khai → `status:'pending'`, **luôn cần duyệt**. Bản chờ duyệt **vẫn hiện
  trên lịch nhưng gạch sọc**, để người xếp ca biết "có người xin đi học ngày này" mà
  chưa chốt. Chỉ khi duyệt xong mới sinh đơn tăng ca — bản chưa chốt mà đẻ đơn ngay thì
  người duyệt nhận hai luồng cho một việc.

Duyệt **ĐÀO TẠO** là chốt lịch; duyệt **ĐƠN OT** là chốt tiền. Hai việc khác nhau, cố ý
tách.

### Sửa lại sau khi assign

`trSave()` với `id` có sẵn:

1. **Gỡ trước** mọi đơn OT chưa duyệt của buổi (`trDropReqs`) — ngày/người/giờ có thể
   đã đổi hết, giữ lại là để đơn mồ côi khai sai giờ.
2. Ghi bản ghi mới.
3. Tạo lại đơn theo giờ mới.
4. **Thu hồi** thông báo cũ (xoá hẳn khỏi `S.notifs`, rút luôn khỏi hàng đợi Zalo qua
   `notifDrop`) rồi **gửi lại** bản mới — cùng cơ chế với sự kiện và đổi lịch.

Đơn **đã duyệt** thì **không đụng vào**: giấy tờ đã chốt, có thể đã in nộp nhân sự.
Toast báo rõ `⚠ N đơn đã duyệt được giữ nguyên, kiểm tra lại`.

> **Bẫy đã tránh:** `trDelete()` **KHÔNG** tự gọi `tombSet('trainings', id)`. `fbDiff()`
> thấy khoá biến mất là tự dựng bia mộ **và** nhét `del/trainings/<id>` vào gói ghi; gọi
> trước thì `tombSet` trả `false` ở trong `fbDiff`, đường dẫn `del` không được gửi lên,
> và bản ghi **sống lại ở máy khác** — đúng cái bẫy đã sửa ở v6.7. Harness C4 canh chỗ này.

### Mã màu trên lịch

Ô có đào tạo tô **NỀN MÀU RIÊNG đè lên màu mã ca** (`--trc:#7C3AED`). Cố ý đè: nhìn cả
bảng một lượt phải bật ra ngay hôm nào ai đi học. Mã ca vẫn đọc được vì chỉ đổi nền,
chữ ép sang trắng cho đủ tương phản.

| Lớp | Nghĩa | Chỗ áp dụng |
|---|---|---|
| `.trday` | buổi đã có hiệu lực (nền đặc) | ma trận PC · lưới tuần ĐT · lịch trang chính |
| `.trday.trpend` | NV tự khai, chờ duyệt (nền **sọc**) | như trên |

`trCellCls(empId, iso)` trả chuỗi lớp, `trCellTitle()` trả tooltip. Cả hai đọc từ chỉ
mục `(empId|iso) → buổi` nhớ theo `S.rev` — ô lịch hỏi cho **từng ô** nên phải nhanh
(cùng khuôn `evIndex()` ở `20-events.js`). `trResetCache()` được gọi trong
`applyRemote()` cùng với `evResetCache()`.

Chú giải mã ca thêm một dòng nói rõ **đào tạo không phải một mã ca** mà là lớp màu phủ.

### Thông báo

**Trong app** (`kind:'training'`, khối 🎓 riêng trong chuông, thêm vào `SEEN_KINDS`):

* bản `active` → báo cho **từng người đi học**;
* bản `pending` → báo cho **người duyệt được** (`admin`/`kmgr`/`appr`/`sec`), **không**
  tự gửi cho chính người khai.

**Zalo** — kênh `'batch'`, khoá gộp `'training'`, tin gửi CHUNG (`zaloIsBroadcast`):

```
🎓 TRAINING SCHEDULE
Chemical safety training
Wed 19/08 · Thu 20/08
Overtime for training  17:00–20:00
Venue: Meeting room 2
Attendees (2): Tran Van A, Le Thi C
An overtime request has been created for each attendee.
👉 See the training schedule in app
```

Thân tin dựng từ **chính bản ghi**, không bê câu tiếng Việt của app sang. Nhãn nhóm
`n.aud` giống nhau ở mọi tin của cùng một buổi → vân tay trùng → **8 người vẫn chỉ tốn
ĐÚNG MỘT tin Zalo**.

Vì sao `'batch'` chứ không `'now'`: đào tạo luôn được xếp trước vài ngày, biết muộn 10
phút không ai đi sai giờ. **Không** cho vào kênh `'digest'` — digest chỉ nhận tin giấy
tờ thuần (`apprNeed`/`approved`/`cancelled`), còn đây là tin đổi lịch đi làm.

## 2. Mã **BT** — đi công tác (Business trip)

```js
{c:'BT', l:'Đi công tác (Business trip)', col:'var(--cBT)', cat:'leave'}   // 8 giờ
```

Xếp `cat:'leave'` vì cùng nghĩa vận hành với các mã nghỉ: hôm đó người này **không có
mặt ở ca trực**, đếm quân số phải trừ ra. Nhưng **vẫn ăn 8h công** (khác hẳn NP/COM ăn
0h) — đi công tác là đang làm việc cho công ty.

Nhờ `cat:'leave'`, mã này **tự động** có mặt trong form đơn nghỉ phép (`dsCodesFor`) và
trong hộp chọn mã ở ô lịch — **không phải khai thêm chỗ nào**.

Màu `--cBT:#0E7490` (xanh mòng két), **cố ý không dùng đỏ** như các mã nghỉ: nhìn lịch
phải phân biệt được ngay "vắng vì nghỉ" với "vắng vì đi làm việc chỗ khác".

Kèm theo: `Z_SHIFT.BT = 'Business trip'` cho tin Zalo, và dòng
`BT: Đi công tác (Business trip)` trong chú giải biểu mẫu in.

## 3. Sang kỳ mới thì tự nhảy sang kỳ mới — `js/04-schedule.js`

Kỳ công cắt ở **ngày 21**. App để mở suốt (máy phòng điều độ, điện thoại để nền cả
tuần) nên sáng 21 vẫn đang hiển thị **kỳ cũ**: ô chọn kỳ giữ nguyên giá trị hôm qua,
các màn Báo cáo / Tổng hợp duyệt / Thống kê cá nhân thì nhớ kỳ trong biến (`repYm`,
`asYm`, `myStatYm`, `esYm`, `evYm`, `trYm`) và không ai xoá.

`fillMonthSelects()` không cứu được: nó **cố ý** giữ lựa chọn đang có
(`ms.includes(cur)?cur:…`) — phải thế, không thì đang xem kỳ tháng 5 mà dữ liệu đồng bộ
về là bị đá ngược về kỳ hiện tại giữa chừng.

**Cách làm:** nhớ kỳ hiện tại lúc khởi động (`_perWatch`), mỗi phút so lại
(`perCheckRollover`), **chỉ khi mốc kỳ thật sự đổi** mới xoá các biến nhớ kỳ và kéo mọi
ô chọn về kỳ mới (`perJumpTo`), kèm toast báo. Máy tính ngủ rồi mở lại có thể nhảy qua
cả ngày mà không tick nào chạy → soi thêm ở `visibilitychange`.

Nghĩa là **trong cùng một kỳ, người dùng vẫn tự do lật về kỳ cũ để tra cứu mà không bị
giật lại** — chỉ đúng thời khắc sang kỳ mới app mới can thiệp, và đó chính là lúc người
ta muốn nó can thiệp.

## Kiểm chứng

```
node _test/training-harness.js       # 71 phép thử (A·B·C·D·E·F·G·H)
node _test/zalo-format-harness.js    # 61 phép thử (mục 9 = tin đào tạo)
```

* **A** phân quyền · **B** sinh đơn tăng ca (kể cả trừ giờ trưa) · **C** sửa & xoá
  (gồm C4 canh bẫy bia mộ) · **D** thông báo & thu hồi · **E** mã màu ô lịch ·
  **F** mã BT · **G** tự chuyển kỳ ca · **H** dựng giao diện không nổ.

Toàn bộ harness cũ vẫn xanh (403 phép thử). i18n **+62 khoá EN** (đã soi trùng khoá —
`chờ duyệt` / `CHỜ DUYỆT` / `tăng ca` đã có sẵn nên **không khai lại**, khoá trùng trong
object literal thì bản sau đè bản trước và làm đổi chữ ở màn khác). Cache bump **`?v=73`**.

---

# v7.1 — Đào tạo quyết theo TỪNG NGƯỜI TỪNG NGÀY · mã OTO · nới khổ màn hình

## 1. Vì sao phải sửa ngay bản v7.0

Bản v7.0 bắt chọn MỘT chế độ cho cả buổi. Thực tế không như vậy:

* Buổi học hai ngày thì **hai ngày khác bản chất**: ngày 18 anh A nghỉ ca (R) nên đi
  học là **tăng ca**; ngày 19 anh A trực ca hành chính (O) nên học **trong giờ làm**.
* Tệ hơn: **cùng một ngày**, anh A đang R còn anh B đang O. Một chế độ cho cả buổi thì
  dù chọn kiểu gì cũng sai với một nửa số người.

Nên đơn vị quyết định nhỏ nhất phải là **cặp (người, ngày)**, không phải buổi.

## 2. Ba tầng luật — tầng trên thắng tầng dưới

| Tầng | Nguồn | Ý nghĩa |
|---|---|---|
| 1 | `tr.dayMode[iso]` | người xếp ép tay cho **riêng ngày đó** |
| 2 | `tr.mode` = `'shift'` / `'ot'` | ép tay cho **cả buổi** |
| 3 | `tr.mode` = `'auto'` (**mặc định**) | **app tự soi** ca thực tế của chính người đó |

`trModeFor(tr, empId, iso)` là hàm kết luận duy nhất; mọi chỗ khác (sinh đơn, tô ô lịch,
dựng tin Zalo, câu thông báo) đều đi qua nó — không nơi nào tự suy luận lại.

### Luật "tự soi" (`trAutoModeFor`)

```
ca thực tế của người đó hôm đó (workCodeOf → baseShiftOf)
  · không có ca (R / nghỉ phép / trống)     → TĂNG CA
  · có ca, chưa khai giờ học                → TRONG CA
  · có ca, giờ học NẰM GỌN trong ca         → TRONG CA
  · có ca, giờ học TRÀN RA ngoài ca         → TĂNG CA
```

Phép "nằm gọn" (`trShiftCovers`) quy về phút: D = 08:00–20:00, O = 08:00–17:00,
N = 20:00–08:00 **hôm sau** (nên đuôi cộng 1440 phút, và mốc bắt đầu trước 08:00 cũng
thuộc phần hôm sau của ca đêm — học lúc 02:00 là **đang giữa ca N**, không phải ngoài ca).

**Không vòng luẩn quẩn:** khi chưa khai giờ, phép soi chỉ xét vế "có ca hay không" — vế
đó không phụ thuộc vào giờ. Nhờ vậy `trValidate()` mới hỏi được "có cặp nào tính tăng ca
không" trước khi đòi khung giờ.

## 3. Hệ quả ở đơn tăng ca

`trMakeReqs()` nay gom **cặp (người, ngày)** rồi mới chia về từng người:

* Người nào **mọi ngày đều trong ca** → **không có đơn nào**. Trước kia ai cũng có đơn
  đủ mọi ngày, kể cả ngày họ đang trực — giấy tờ rỗng và sai giờ.
* Đơn của một người **chỉ chứa những ngày tăng ca của chính họ**.

Ví dụ đúng theo ảnh minh hoạ trên: 4 người học 2 ngày → chỉ **2 đơn** (hai người ngày 18
đang R), mỗi đơn **1 dòng**.

## 4. Mã **OTO** — tăng ca ca hành chính 08–17h

```js
{c:'OTO', l:'Tăng ca hành chính 08–17h', col:'var(--cOT)', cat:'ot'}   // 8 giờ
```

Khác **OTD** (08–20h, ca vận hành, 12 giờ): người đang nghỉ ca mà được gọi lên làm hoặc
học nguyên ngày hành chính thì khai mã này — **8 giờ chứ không phải 12**.

Mẫu giờ `OT_PRESETS` của OTO mang cờ **`noLunch:1`** — đây là mẫu **duy nhất** tự tích
sẵn ô trừ trưa, vì 08:00→17:00 là **9 giờ đồng hồ** nhưng ca hành chính chỉ tính **8 giờ
công**. OTD 08–20h thì công ty vẫn trả trọn 12 giờ nên **không** tích. Người khai bỏ tích
lại được — chỉ là giá trị mặc định. Áp cho cả form đơn tăng ca (`dsSetPreset`) lẫn màn
đào tạo (`trSetPreset`).

Đã nối đủ: `baseShiftOf` quy về ca O · màu `SCHEDBG`/`SCHEDTXT` · đếm quân số cột O ở ma
trận và thống kê · `Z_SHIFT.OTO` cho Zalo · gợi ý mẫu khi xác nhận ô lịch.

## 5. Giao diện

**Khổ rộng** `.modal.xwide` (960px) cho riêng màn đào tạo — khổ 560px cũ cắt cụt tên
("Nguyễn Xuân Á…").

**Thẻ người hai dòng:** tên chiếm **trọn dòng trên** nên không bao giờ bị cắt; dòng dưới
là nhóm + ô ngày. Mỗi ô ngày hiện **số ngày + mã ca**, viền **xanh lá** = ngày đó tính
tăng ca, viền **xanh dương** = trong ca. Nhìn một lượt là biết ai đi học ngày nào và ngày
đó tính kiểu gì.

**Bảng "Từng ngày là trong ca hay tăng ca?"** — mỗi ngày một dòng: ngày · các ca đang có
(`D×1 O×1 R×2`) · kết luận của app (`2 tăng ca (8h) · 2 trong ca`) · ba nút
**Tự động / Trong ca / Tăng ca**. Bấm lại đúng nút đang sáng = trả về Tự động.

**Xem trước tiền:** `⚡ Sẽ tạo N đơn tăng ca · tổng H giờ (M lượt người-ngày)` — tính bằng
**chính** `trOtPairs()` dùng lúc lưu, nên màn xem trước và kết quả thật không thể lệch nhau.

**Ô lịch:** ô đào tạo tính tăng ca thêm **vạch xanh mép phải** (`--cOT`), phân biệt với ô
học trong ca.

**Thứ tự form** đổi lại cho đúng cách người ta nghĩ: chọn ngày → chọn người → chọn hình
thức → khung giờ → **bảng từng ngày** → ước tính. Bảng kết luận phải đứng **sau** phần
chọn người, vì nó đếm chính những người đó.

## 6. Tin nhắn

Tin Zalo nay in **mỗi ngày một dòng**, ngày trộn cả hai thì ghi số người mỗi bên:

```
🎓 TRAINING SCHEDULE
Mixed session
Wed 19/08  overtime 22:00–23:30 (1.5h) for 1 · during shift for 1
Attendees (2): Tran Van A, Hoang Trung
An overtime request has been created for each affected attendee.
```

Trước đây in một câu duy nhất cho cả buổi — với tin gửi chung thì đó là **nói sai với một
nửa người nhận**. Câu thông báo **trong app** thì nói theo góc nhìn của **chính người
nhận** (`trSummaryText(tr, id)`): họ chỉ cần biết ngày nào của mình là tăng ca.

## 7. Tương thích ngược

Bản ghi đào tạo **cũ** (v7.0, chỉ có `'shift'`/`'ot'` cho cả buổi) được **giữ nguyên ý
người đã xếp** — `trEdit()` không tự nâng lên `'auto'` rồi phân loại lại sau lưng họ. Chỉ
buổi tạo mới mới mặc định `'auto'`.

`trCleanDayMode()` loại bỏ ép tay của những ngày **không còn được chọn**: bỏ ngày ra rồi
chọn lại thì ép tay cũ **không sống lại** — người xếp đã không còn thấy nó trên màn hình,
để nó âm thầm có hiệu lực là bẫy.

## Kiểm chứng

```
node _test/training-harness.js       # 112 phép thử (thêm I · J · K)
node _test/zalo-format-harness.js    # 64 phép thử (mục 9 = tin đào tạo)
```

* **I** — trong ca hay tăng ca theo từng cặp: R→tăng ca, O+giờ trong ca→trong ca, tràn ra
  ngoài ca→tăng ca, ca đêm 22:00→trong ca / 13:00→tăng ca, cùng ngày hai người hai kết
  luận, đơn chỉ chứa ngày của chính người đó, ba tầng ép tay, ép tay ngày đã bỏ chọn.
* **J** — mã OTO: 8 giờ, mẫu 08–17h, tự tích trừ trưa và tự rơi khi đổi mẫu.
* **K** — bảng từng ngày & thẻ người dựng được, **hiện tên đầy đủ**, tô đúng ot/shift,
  bản nháp và bản lưu dùng chung một phép tính.

> **Bẫy đã dính và đã ghi lại:** harness không nạp `js/08-requests.js` nên thiếu
> `baseShiftOf` → `trAutoModeFor()` trả `'ot'` cho **mọi** ngày và 13 bài đỏ vì lý do sai.
> Nay harness chép nguyên văn hàm đó vào sandbox. Bài kiểm dựa vào hàm của file khác thì
> phải bơm hàm đó vào, không thì nó xanh/đỏ vì lý do không liên quan đến thứ đang kiểm.

Toàn bộ harness cũ vẫn xanh (**443 phép thử**). i18n **+31 khoá EN** (đã soi trùng khoá).
Cache bump **`?v=74`**.

---

# v7.2 — Giờ học khai riêng từng ngày · cột "Giờ đào tạo"

## 1. Vấn đề

Rất ít buổi đào tạo chiếm trọn một ngày. Phần lớn là **vài tiếng hoặc nửa buổi**, và một
khoá 3 ngày thì ngày đầu học cả ngày, ngày sau chỉ sáng, ngày cuối hai tiếng rồi thi.

Bản v7.1 chỉ có **một** khung giờ cho cả buổi, nên hoặc phải tách thành ba buổi rời (mất
tính liền mạch của khoá học, ba lần thông báo, ba lần duyệt), hoặc khai một khung giờ sai
cho hai ngày còn lại — mà khung giờ đó lại là **căn cứ tính tiền tăng ca**.

## 2. Mô hình

```js
S.trainings[id] = {
  timeIn:'08:00', timeOut:'17:00', overnight:false, noLunch:true,   // khung CHUNG
  dayTime: {                                                        // ngày nào khác
    '2026-08-19': {from:'08:00', to:'12:00'},
    '2026-08-20': {from:'14:00', to:'16:00'}
  }, …
}
```

`trTimeOf(tr, iso)` là cửa duy nhất đọc giờ của một ngày: có khai riêng thì lấy riêng,
không thì lấy khung chung. **Không nơi nào đọc thẳng `tr.timeIn` nữa** — nếu không, sửa
một chỗ mà quên chỗ khác là số giờ ở bản in lệch số giờ trên màn hình.

Kéo theo: `trAutoModeFor` (soi trong ca / tăng ca), `trHoursOfDay`, `trMakeReqs`,
`trZaloDayLines`, tooltip ô lịch, dải nhắc — tất cả đi qua `trTimeOf`.

### Mẫu giờ nhanh

```js
const TRAIN_PRESETS=[
  {v:'full', label:'Cả ngày 08:00–17:00',   noLunch:1},   // → 8 giờ học
  {v:'am',   label:'Buổi sáng 08:00–12:00'},              // → 4 giờ
  {v:'pm',   label:'Buổi chiều 13:00–17:00'},             // → 4 giờ
  {v:'',     label:'Tự điền giờ'}
];
```

Khác `OT_PRESETS` ở `js/01-core.js` — cái đó là mẫu giờ **tăng ca**, cái này là mẫu giờ
**học**. Chọn ở đầu form thì áp cho mọi ngày; chọn ngay trên dòng của một ngày thì chỉ
ngày đó.

### Mã OT suy từ khung giờ, không chọn tay

`trOtCodeFor(from, to, overnight)`: khớp đúng một mẫu OT chuẩn của công ty thì lấy mã đó,
không khớp thì quy theo khung ca mà đoạn giờ nằm vào — biểu mẫu HR chỉ có mấy ký hiệu này.

| Khung giờ | Mã |
|---|---|
| gói gọn trong 08:00–17:00 (kể cả nửa buổi) | `OTO` |
| 17:00–20:00 | `OT3` · 18:00–20:00 → `OT2` · 12:00–13:00 → `OTL` |
| tràn quá 17:00 nhưng trong ngày | `OTD` |
| vắt qua nửa đêm / bắt đầu ≥20:00 | `OTN` |

Nhờ vậy người xếp lịch **không phải biết mã OT nào** — chỉ khai giờ học, app lo phần ký
hiệu giấy tờ.

## 3. Giờ học nay là BẮT BUỘC

Bản v7.1 chỉ đòi khung giờ khi có phần tăng ca. Nay **mọi ngày đều phải có giờ**, kể cả
buổi hoàn toàn trong ca — vì số giờ đó là nguồn của cột báo cáo. `trValidate()` chặn cả
hai lỗi: chưa khai giờ, và khung giờ ra 0 giờ.

## 4. Cột "Giờ đào tạo"

`calcStats()` ở `js/10-account.js` trả thêm `hTrain`, cộng **trước** lối thoát
`if(!c)return` (buổi học có thể rơi vào ngày chưa xếp ca — bỏ qua thì dòng Tổng có số mà
không dòng nào bên trên giải thích được).

> **`hTrain` ĐỨNG RIÊNG — không cộng vào giờ công, không cộng vào giờ OT.** Học trong ca
> thì giờ công đã tính theo mã ca rồi; học ngoài ca thì đã có đơn tăng ca riêng. Cộng
> thêm lần nữa là **tính hai lần**. Cột này chỉ trả lời "kỳ này ai đã học bao nhiêu giờ".
> Harness M2 canh đúng chỗ này.

Chỉ tính buổi **đã có hiệu lực** — bản nhân viên tự khai còn chờ duyệt thì chưa phải là
giờ đã học (harness M3).

Đã gắn vào: bảng công tổng hợp (cột tím, có dòng TỔNG) · thẻ điện thoại · ô số tổng đầu
tab · bảng tổng hợp cả kỳ của một người (cột mới + dòng từng ngày) · Bảng công cá nhân ·
file Excel xuất ra · email báo cáo.

## 5. Giao diện

Bảng từng ngày nay có **ô khai giờ ngay trên dòng**: mẫu nhanh · giờ từ · giờ đến · ô trừ
trưa · **số giờ tính ra** (`8h` / `4h` / `2h`). Dòng nào khai riêng thì nền hổ phách và có
nút *Về giờ chung*.

Ô **trừ trưa CHỈ hiện khi khung giờ thật sự phủ 12:00–13:00**, và cờ cũ **tự rơi** khi sửa
giờ ra ngoài trưa — cùng luật đã làm cho đơn tăng ca ở v6.9. Không có chốt này thì người
xếp thấy ô đang tích mà số giờ lại không trừ, tưởng app tính sai (`otNetHours` vốn đã tự
bảo vệ con số, nhưng giao diện nói dối thì vẫn là lỗi).

Ô lịch, dải nhắc, thông báo trong app và tin Zalo nay đều ghi **giờ học của đúng ngày đó**,
kể cả buổi học trong ca:

```
🎓 TRAINING SCHEDULE
Half day course
Wed 19/08  08:00–17:00  (8h)  overtime
Thu 20/08  08:00–12:00  (4h)  overtime
Lunch hour deducted.
```

## Kiểm chứng

```
node _test/training-harness.js       # 150 phép thử (thêm L · M)
node _test/zalo-format-harness.js    # 67 phép thử
```

* **L** — giờ riêng từng ngày (8/4/2h), giờ riêng đổi luôn kết luận trong ca/tăng ca, đơn
  OT lấy giờ của chính ngày đó, 4 mẫu nhanh, bỏ ngày → giờ riêng biến mất, cờ trừ trưa tự rơi.
* **M** — cột giờ đào tạo cộng đúng, **không** lọt vào giờ công / giờ OT, bản chờ duyệt
  chưa tính.

> **Bẫy đã dính lần hai:** stub `otNetHours` trong `zalo-format-harness.js` bỏ qua tham số
> `noLunch`, nên tin mẫu in `9h` cho một buổi thật ra `8h`. Đã sửa stub cho đúng thay vì
> nới lỏng phép kiểm — stub sai làm bài kiểm xanh trong khi sản phẩm sai là kiểu hỏng tệ
> nhất, vì nó còn cho cảm giác an toàn.

Toàn bộ harness cũ vẫn xanh (**479 phép thử**). i18n **+18 khoá EN**. Cache bump **`?v=75`**.

---

# v7.3 — Vẽ lại không còn nhảy về đầu trang

## Lỗi người dùng báo

> "Mỗi lần click nó lại nhảy lên trên cùng, gõ search cũng thế."

Ở màn Đào tạo: tích một người là màn hình vọt về đầu hộp thoại, phải cuộn lại từ đầu để
tích người tiếp theo. Gõ vào ô tìm kiếm thì mất con trỏ ngay sau ký tự đầu tiên — gõ được
đúng một chữ.

## Nguyên nhân

`renderTrainMgr()` (và `renderEventMgr()`) vẽ lại bằng cách **ghi đè toàn bộ innerHTML**.
Cách này nhanh và dễ viết, nhưng trình duyệt vứt sạch mọi thứ **không nằm trong HTML**:

* `scrollTop` của hộp thoại **và** của các danh sách cuộn bên trong (`.tr-people`, `.tr-days`)
* phần tử đang có focus, và vị trí con trỏ trong phần tử đó

Không phải lỗi CSS, không phải lỗi ở chỗ nào cụ thể — là hệ quả trực tiếp của kiểu vẽ lại.

## Cách chữa

Hai lớp, mỗi lớp giải một nửa vấn đề.

### 1. Chụp và đặt lại trạng thái — `uiSnap` / `uiRestore` (`js/03-nav.js`)

```js
const snap = uiSnap('trBody', ['.tr-people','.tr-days']);
box.innerHTML = …;
uiRestore(snap);
```

Chụp `scrollTop` của hộp thoại + của từng danh sách con, và phần tử đang focus kèm
`selectionStart/End`. Đặt ở `js/03-nav.js` (hạ tầng giao diện) chứ không nhân bản ở hai
file — màn **Sự kiện** dính đúng lỗi này nên được chữa cùng lượt.

Ba chốt nhỏ nhưng cần thiết:

* Nhận diện ô bằng thuộc tính **`data-k`**, không phải bằng vị trí trong DOM — cây DOM
  vừa bị dựng mới nên vị trí cũ vô nghĩa. **Mọi** `<input>` / `<select>` của màn Đào tạo
  đều đã gắn `data-k`; harness D1 quét cả file để canh không sót ô nào về sau.
* `selectionStart` của `<input type="time">` và `<select>` **ném lỗi** khi đọc → bọc
  `try/catch`, không thì mở màn là vỡ.
* `focus({preventScroll:true})` — không có cờ này thì chính thao tác trả focus lại kéo
  màn hình đi lần nữa, chữa xong vẫn nhảy.

### 2. Gõ tìm kiếm chỉ vẽ lại danh sách người

Giữ focus mới chỉ là băng bó. Vấn đề thật: **không có lý do gì** để dựng lại cả hộp thoại
sau mỗi phím — bảng từng ngày, ước tính giờ, danh sách buổi đã xếp đều không phụ thuộc
vào chữ đang tìm.

Danh sách người nay nằm trong `#trPeopleBox`; `trSetQ()` gọi `trRenderPeople()` chỉ ghi
lại đúng hộp đó (và giữ chỗ cuộn bên trong nó). Tích một người thì vẫn vẽ lại đủ — lúc đó
số liệu ở bảng ngày và dòng ước tính **thật sự** đổi.

## Kiểm chứng

```
node _test/uistate-harness.js        # 19 phép thử
```

Harness dựng một DOM giả đủ dùng (`scrollTop`, `focus`, `setSelectionRange`,
`querySelector` theo `data-k`) rồi mô phỏng đúng cái trình duyệt làm: thay toàn bộ phần
tử con bằng phần tử mới, `scrollTop` về 0, `activeElement` về null. Sau `uiRestore` phải
thấy chỗ cuộn và con trỏ y như cũ.

Phủ cả bốn trường hợp biên: ô `type=time` ném lỗi khi đọc `selectionStart`; ô đã biến mất
sau khi lọc; không có ai đang gõ (đừng tự cướp focus); và quét file để canh không ô nào
thiếu `data-k`.

> **Bẫy đã dính:** đặt `uiSnap` ở `js/03-nav.js` rồi gọi thẳng trong `20-events.js` làm
> `render-v58.js` đỏ 6 bài — harness đó nạp `20-events.js` mà không nạp `03-nav.js`. Đã
> bọc `typeof uiSnap==='function'` theo đúng lệ gọi chéo file của cả app. Bài kiểm cũ bắt
> được lỗi này là đúng việc của nó: nó nói rằng file vừa mọc thêm một phụ thuộc ngầm.

Toàn bộ harness xanh (**498 phép thử**). Cache bump **`?v=76`**.

---

# v7.4 — Dải nhắc đào tạo có đếm ngược · Bảng tin cho thư ký & QL người Hàn

## 1. Dải nhắc: thêm đếm ngược, nhìn xa hơn kỳ hiện tại

Dải nhắc **đào tạo** nay hiện ở Trang chính đúng như dải **sự kiện** (cùng khuôn
`.ev-banner`, khác màu tím), và cả hai được thêm:

* **Chip đếm ngược** *hôm nay · ngày mai · còn N ngày*. Cái người ta thật sự cần ở một
  dải nhắc là **còn bao lâu**, không phải ngày tháng tuyệt đối — nhìn "12/08" phải nhẩm,
  nhìn "ngày mai" thì không.
* **Xếp ngày gần nhất lên trước.** Buổi học ngày mai không được nằm dưới buổi tuần sau.
* **Nhìn 30 ngày tới** thay vì chỉ phần còn lại của kỳ đang xem (`pvAheadDays()`). Trước
  đây buổi đào tạo rơi vào đầu kỳ sau thì tới ngày 20 mới hiện — quá muộn để thu xếp.

Dải nhắc đào tạo chỉ nói về buổi **của chính người đang xem**, kèm giờ học từng ngày.

## 2. Bảng tin — `noSelfHomeHtml()` ở `js/13-portal.js`

### Vì sao cần

Thư ký, quản lý người Hàn và ai đặt *Kiểu ca = Không xếp lịch* (`noSelf`) trước đây
**không có Trang chính**: đăng nhập vào là rơi thẳng vào bảng lịch ca — một ma trận 30 cột
mà họ không có tên trong đó. Thông báo, sự kiện, đơn chờ họ duyệt đều nằm sau một cái
chuông nhỏ trên header. Việc quan trọng nhất của quản lý người Hàn — **duyệt đơn cấp
cuối** — không có chỗ nào nhắc.

### Cách làm

Dùng **lại đúng khung Trang chính** của nhân viên (cùng thẻ tên, cùng dải nhắc, cùng dãy ô
số ở cuối), chỉ thay phần **giữa**: chỗ lịch ca cá nhân đổi thành **lịch điều hành**.

| Khối | Nội dung |
|---|---|
| Thẻ tên | tên · **chức danh** (thay cho "Nhóm A") · chuông có số · Báo cáo · Tài khoản · Thoát |
| 📥 Lời gọi | *"N đơn đang chờ bạn duyệt"* — bấm cả dải là sang tab Duyệt |
| 🎓 Lời gọi | *"N lịch đào tạo chờ duyệt"* — chỉ hiện với người duyệt được |
| 📌 Dải nhắc | sự kiện 30 ngày tới, kèm đếm ngược |
| 🗓 Sắp tới | lịch điều hành 3 tuần — xem dưới |
| Ô số | Đơn chờ tôi duyệt · Quân số hôm nay D/N · Sự kiện 3 tuần · Buổi đào tạo sắp tới |

### Lịch điều hành

Ba tuần tới, **chỉ những ngày CÓ CHUYỆN**: sự kiện · buổi đào tạo (đã duyệt, kèm số người
và giờ học) · **ngày thiếu quân số** (so ca D/N của khối sản xuất với `minD`/`minN`). Bấm
một dòng là mở chi tiết ngày đó.

> Nguyên tắc: **không liệt kê ngày trống**. Một danh sách 21 dòng trống trơn thì không ai
> đọc tới dòng thứ ba, và ngày thật sự cần chú ý bị chìm mất.

Buổi đào tạo **chờ duyệt** không lên lịch điều hành — chưa chốt thì chưa phải là lịch.

### Định tuyến

`homeView()` nay trả `'me'` cho **mọi người**. Ba chốt chặn cũ đã gỡ: `go()` không còn đá
`noSelf` sang Lịch, `applyRoleUI()` không còn đẩy họ ra khỏi tab me, và tab Trang chính
không còn class `.self-only`. Với nhóm `noSelf` tab đó **đổi tên thành "Bảng tin"** —
cùng một màn nhưng nội dung khác hẳn, để tên gọi khỏi hứa nhầm.

Các mục *Gửi đơn · Tăng ca của tôi · Đơn của tôi · Bảng công* vẫn ẩn với họ (`.self-only`)
— họ không thuộc diện chấm công nên những màn đó rỗng.

## Kiểm chứng

```
node _test/noself-home-harness.js    # 32 phép thử (A · B · C · D · E)
```

* **A** định tuyến (5 chốt) · **B** lịch điều hành chỉ ngày có chuyện, kể cả ngày thiếu
  quân số, và bỏ qua buổi chờ duyệt · **C** đếm ngược · **D** dải nhắc nhìn 30 ngày và xếp
  đúng thứ tự · **E** bảng tin dựng được cho cả thư ký lẫn QL người Hàn.

> **Hai bẫy đã dính:**
> 1. Dữ liệu mẫu ban đầu cho **cả tổ trực ca D** → ca N rỗng → **mọi** ngày đều "thiếu
>    quân số", làm B1/B2 đỏ vì lý do chẳng liên quan tới thứ đang kiểm. Bài kiểm mà dữ
>    liệu mẫu sai thì nó kiểm nhầm chuyện khác.
> 2. Khoá i18n `'còn'` **đã tồn tại** với nghĩa "has"; khai đè thì câu đếm ngược tiếng Anh
>    thành *"has 4 days"*. Đã đổi sang khoá cả cụm `'còn N ngày' → 'in N days'`, chỗ số
>    thay bằng `N` — khoá cụm thì không thể va vào ai.

Toàn bộ harness xanh (**530 phép thử**). i18n **+17 khoá EN**. Cache bump **`?v=77`**.

---

# v7.5 — Tên quản lý người Hàn hiện đầy đủ

## Lỗi

Thẻ tên trên Bảng tin hiện **"Mr. Ji Min"**, trong khi tên đầy đủ là *Mr. Kim Ji Min*.

## Nguyên nhân

`shortName()` rút mọi tên xuống **hai chữ cuối** rồi gắn lại tiền tố "Mr.":
`"Mr. Kim Ji Min"` → `"Mr. Ji Min"`.

Quy tắc đó đúng với **tên Việt** — họ đứng trước, tên gọi đứng sau, nên hai chữ cuối là
phần người ta gọi nhau hằng ngày. Nhưng với **tên Hàn thì họ đứng TRƯỚC**: cắt hai chữ
cuối là **cắt mất họ**, tức là gọi sai người chứ không phải gọi tắt.

Nó cũng mâu thuẫn với quy tắc xưng hô đã ghi sẵn ở `js/01-core.js`:

> Ở MỌI vị trí trong app và MỌI tin nhắn Zalo bot, người có quyền `kmgr` phải hiện là
> **"Mr. + họ tên đầy đủ"**.

Tin Zalo vốn đã đúng (`zName()` đọc thẳng `e.name`); chỉ giao diện app bị `shortName()`
cắt. Sửa ở **một chỗ** là đúng cho cả **43 nơi** đang gọi hàm này — thẻ tên, thông báo,
màn Duyệt, danh sách người, bản in cover.

## Sửa

```js
function shortName(n){
  const s=String(n||'').trim();
  if(/^mr\.?\s+/i.test(s))return s;      // quản lý người Hàn → giữ nguyên
  const w=s.split(/\s+/).filter(Boolean);
  return w.slice(-2).join(' ')||s;
}
```

Nhận diện bằng chính tiền tố `"Mr."` mà accessor tên đã gắn sẵn — không phải tra quyền ở
đây, nên hàm vẫn thuần tuý và dùng được cả trong bài kiểm.

## Kèm theo: chữ cái trên ô avatar

Cùng một lỗi logic, chỗ khác: avatar lấy **hai chữ cái cuối** nên tên Hàn ra `JM` thay vì
`KJ`. Tách thành `avatarInitials()`:

| Kiểu tên | Quy tắc | Ví dụ |
|---|---|---|
| Việt (họ trước, tên sau) | hai chữ **CUỐI** | Nguyễn Hoàng Trung → `HT` |
| Hàn (họ trước) | hai chữ **ĐẦU**, bỏ "Mr." | Mr. Kim Ji Min → `KJ` |
| Một chữ / mã NV | hai **ký tự đầu** của chính nó | vc44180062 → `VC` |

Trường hợp cuối là sửa thêm: một chữ cái đơn độc trong ô avatar 46px nhìn như lỗi hiển thị.

## Kiểm chứng

```
node _test/krname-harness.js         # 33 phép thử
node _test/noself-home-harness.js    # 35 phép thử
```

Phủ cả bốn hướng: tên Hàn không bị rút · tên Việt **giữ nguyên hành vi cũ** · tên Việt lỡ
có chữ "Mr" ở giữa không bị bắt nhầm · avatar đúng quy tắc cho từng kiểu tên.

> **Bẫy đã dính:** `noself-home-harness.js` tự viết một `shortName` giả rút gọn kiểu cũ,
> nên nó **vẫn xanh** trong khi sản phẩm đang hiển thị sai. Nay harness chép **nguyên văn**
> `shortName` + `avatarInitials` từ `js/13-portal.js`. Đây là lần thứ ba trong đợt này một
> stub viết tay che mất lỗi thật — hàm giả chỉ nên thay thứ **không phải** là đối tượng
> đang kiểm.

Toàn bộ harness xanh (**535 phép thử**). Cache bump **`?v=78`**.

---

# v7.6 — Thông báo trong app dịch theo ngôn ngữ đang xem

## Lỗi

Quản lý người Hàn bật giao diện **EN**, nhưng chuông vẫn toàn tiếng Việt:

> 📥 Đơn Tăng ca của Vũ Ngọc Quốc đang chờ Quản lý người Hàn duyệt · 07/08

## Nguyên nhân

`n.text` được dựng **ngay lúc TẠO**, bằng ngôn ngữ của **người tạo**, rồi cất xuống
Firebase. Nhân viên người Việt gửi đơn → câu tiếng Việt bị **đóng băng** → ai mở ra cũng
thấy tiếng Việt. Nút EN/VI không cứu được: nó chỉ dịch được thứ dựng lúc **VẼ**.

Đây không phải lỗi thiếu khoá từ điển — thêm bao nhiêu khoá cũng vô ích, vì chuỗi đã ghép
xong không còn khớp khoá nào.

## Cách chữa

Dựng lại câu từ **dữ liệu gốc** ngay lúc vẽ — đúng nguyên tắc đã dùng cho tin Zalo:

| Loại tin | Dựng lại từ |
|---|---|
| về đơn (`apprNeed` / `approved` / `rejected` / …) | `S.requests[n.reqId]` |
| sự kiện | `S.events[n.evId]` |
| đào tạo | `S.trainings[n.trId]` |
| phản hồi hai chiều (nhóm C) | `n.iso` / `n.oldCode` / `n.newCode` |

`notifText(n)` là cửa duy nhất; ba khối chuông (sự kiện · đào tạo · thông báo) đều gọi nó
thay vì đọc thẳng `n.text`.

**`n.text` vẫn giữ nguyên** làm bản dự phòng: tin cũ tạo trước bản này, và trường hợp bản
ghi gốc đã bị xoá. Thà một câu tiếng Việt còn hơn một dòng trống.

### `tf()` — dịch câu có chỗ trống

```js
tf('Đơn {type} của {who} đang chờ {lvl} duyệt', {type, who, lvl})
// EN: "{type} request from {who} — waiting for {lvl}"
```

Cả câu là **một khoá**, không ghép mảnh — trật tự từ tiếng Anh khác tiếng Việt, ghép mảnh
thì bản EN đọc như máy dịch. Chỗ trống mang **tên có nghĩa** (không phải `%s`) nên người
dịch đổi vị trí thoải mái. Chỗ trống nào không được truyền giá trị thì **xoá hẳn** — thà
thiếu một mẩu còn hơn để người dùng đọc thấy `{type}` giữa câu.

### Cái gì KHÔNG dịch

Tên người, tên sự kiện, tên buổi học, **lý do từ chối do người dùng gõ** — đó là **dữ
liệu**, không phải câu chữ của app. Harness B5 canh riêng chỗ này.

### Hai chỗ phải sửa kèm

* `lvlLabel('kmgr')` trả chuỗi Việt cứng `'Quản lý người Hàn'` → nay đi qua `t()`. Tên
  người trong ngoặc vẫn giữ nguyên.
* `setLang()` nay **vẽ lại** chuông và các hộp thoại đang mở. Không có bước này thì bấm EN
  xong chuông vẫn tiếng Việt cho tới khi người dùng tự đóng mở lại — `i18nApply()` chỉ
  dịch được chữ có sẵn trong HTML, không dịch được câu do JS ghép.

## Kiểm chứng

```
node _test/notif-i18n-harness.js     # 38 phép thử (A–F)
```

Harness nạp **i18n thật** (`js/14-i18n.js`) chứ không stub — chính nó là thứ đang kiểm.
Phủ: `tf()` với chỗ trống thiếu/thừa · cả 7 loại tin về đơn · sự kiện · đào tạo · 3 loại
phản hồi hai chiều · bản dự phòng khi bản ghi gốc đã xoá · và quét file để canh không nơi
nào còn vẽ thẳng `n.text`.

Phép kiểm chính: **bóc tên người ra rồi soi xem còn chữ Việt nào không**. Tên là dữ liệu
cố ý giữ nguyên — không bóc thì bài kiểm báo đỏ ở đúng chỗ sản phẩm đang làm đúng.

Toàn bộ harness xanh (**573 phép thử**). i18n **+15 khoá EN** (dạng câu có chỗ trống).
Cache bump **`?v=79`**.

---

# v7.6.1 — SỬA GẤP: app đơ ở cổng đăng nhập

## Triệu chứng

Cổng đăng nhập đứng ở *"Đang tải dữ liệu… · chưa có dữ liệu nhân sự"*, **không gõ được**
mã NV lẫn mật khẩu, cả giao diện đơ. Do bản v7.6 gây ra.

## Nguyên nhân

v7.6 cho `setLang()` **vẽ lại màn hình** để chuông đổi ngôn ngữ ngay. Nhưng vẽ lại đi qua
một **vòng gọi kín** đã có sẵn trong app:

```
setLang → renderMe → applyRoleUI → applyPerm → applyLangForUser → setLang → …
```

`applyPerm()` (`js/10-account.js`) gọi `applyLangForUser()` ở cuối, mà hàm đó lại gọi
`setLang()`. Lặp vô hạn ngay trong lượt khởi động → luồng JS không bao giờ nhả → trình
duyệt treo, không nhận cả thao tác gõ phím.

## Sửa

Hai chốt, **mỗi chốt tự nó đủ** để chặn:

1. **Ngôn ngữ không đổi thì không vẽ lại** (`if(!changed||_langBusy)return`).
   `applyLangForUser()` luôn gọi lại đúng ngôn ngữ đang dùng nên rơi vào đây, thoát ngay.
2. **Cờ `_langBusy`** — đang trong một lượt `setLang` thì lượt lồng bên trong chỉ đặt biến
   rồi thoát. Thả cờ trong `finally` để vẽ lỗi cũng không kẹt cờ.

Lỗi vẽ lại nay được `catch` và ghi `console.warn` thay vì nuốt im lặng.

## Vì sao 573 phép thử không bắt được

Vì **không phép thử nào nạp cả app**. Mỗi harness dựng sandbox riêng với đúng vài file nó
cần, nên một **vòng gọi kín bắc qua bốn file** (`14-i18n` → `13-portal` → `10-account` →
ngược lại `14-i18n`) rơi vào đúng khoảng trống giữa chúng.

Đã bổ sung `_test/boot-harness.js`:

* Đọc **thứ tự nạp thẳng từ `index.html`** (không chép tay — thêm file mới là nó tự biết),
  nạp lần lượt vào một DOM giả, rồi chạy nguyên trình tự khởi động của `js/12-main.js`.
* Vòng lặp vô hạn thì Node **treo im lặng**, không ném lỗi — nên harness **đếm số lần vào
  `setLang`** và ném lỗi khi vượt ngưỡng, biến "treo" thành "đỏ rõ ràng".

**Đã kiểm ngược:** bỏ chốt ra → `B1`/`B2` đỏ ngay (`setLang lặp vô hạn`, 52 lần); gắn chốt
lại → xanh. Một bài kiểm hồi quy chưa từng thấy nó đỏ thì chưa chứng minh được điều gì.

## Bài học ghi lại

> Thêm lời gọi **vẽ lại** vào một hàm nằm **trên đường vẽ lại** là tự tạo vòng lặp.
> Trước khi đặt `renderX()` vào đâu, phải hỏi: *hàm này có bị chính `renderX()` gọi lại
> không?* Ở đây câu trả lời là có, qua bốn file.

Toàn bộ harness xanh (**585 phép thử**). Cache bump **`?v=80`**.
