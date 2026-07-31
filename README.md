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
