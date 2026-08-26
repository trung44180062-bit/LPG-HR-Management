## ★ v9.0 — Biến động nhân sự / cơ cấu nhóm & Lịch nhập tàu nhiều phương án

Hai việc thật ngoài hiện trường, hai màn mới, không đụng tới phần đang chạy.

### 1. Mẫu ca tự khai (`shiftType='custom'`)

Bộ sinh lịch cũ chỉ biết hai mẫu cứng: 8 ngày `O-D-N-R` (type1) và 6 ngày
`D-N-R` (type2), chia đều bằng `buildSlots()`. Mẫu cứng đủ dùng khi tổ có 4
nhóm luân phiên; rút xuống 2 nhóm thì chu kỳ không chia đều được nữa.

Thêm kiểu ca thứ sáu + trường `e.pattern` là chuỗi mã ca, lặp lại vô hạn kể
từ **Mốc 1** (`e.a1`) — cùng mốc neo với các kiểu ca cũ, nên điền lịch, người
vào giữa kỳ, tái cơ cấu đều dùng lại nguyên xi.

| Hàm | File | Việc |
|---|---|---|
| `parseShiftPattern(str)` | `js/04-schedule.js` | cắt chuỗi thành mảng mã |
| `shiftPatternOk(str)` | `js/04-schedule.js` | mẫu có mã lạ không |
| `shiftPatternLabel(str)` | `js/04-schedule.js` | viết gọn `D·D·N·N·R·R` |
| `PATTERN_PRESETS` | `js/04-schedule.js` | vài mẫu hay dùng |

Viết sao cũng nhận: `OODDNNRR` · `O-O-D-D-N-N-R-R` · `O,O,D,D,N,N,R,R` ·
`o o d d n n r r`. **Mã dài (AL8, OTD…) phải có dấu ngăn** — dính liền thì
không cách nào biết `ALO` là `AL8` hay `A`+`L`+`O`.

Khai mẫu sai / bỏ trống thì **KHÔNG rơi về mẫu 8 ngày**: rơi âm thầm là cách
chắc chắn nhất để cả nhóm nhận nhầm lịch mà không ai biết vì sao.

Ô khai nằm ở cột *Kiểu ca* trong tab **Nhóm & Lịch** và trong bảng Tài khoản
(tab Dữ liệu). Mẫu sai tô viền đỏ (`.inp.pat.bad`).

### 2. Người nghỉ việc — `e.leftAt`

`e.leftAt` = **ngày làm việc CUỐI CÙNG**, đối xứng với `e.joinAt`:

* `genForEmp()` không sinh lịch quá `leftAt`.
* `inServiceOn(e,iso)` / `inServiceRange(e,from,to)` ở `js/01-core.js` —
  mọi chỗ vẽ lịch phải hỏi qua hai hàm này thay vì chỉ nhìn `e.active`.
* Bảng lịch (`renderMatrix`) bỏ dòng của người đã nghỉ **trước** khoảng đang
  xem. Kỳ có ngày nghỉ việc thì họ VẪN hiện, ô ca dừng đúng ngày cuối — đó
  chính là bản lịch bàn giao người ta cần.
* Người đã nghỉ **không bị xoá** khỏi `S.employees`: bảng công và đơn của
  các kỳ trước vẫn phải tra được.
* `roSweepLeavers()` chạy lúc boot, dọn nốt ô lịch lỡ có sau `leftAt`.

### 3. Biến động nhân sự & cơ cấu nhóm — `js/24-reorg.js`, nhánh Firebase `reorgs`

**Cái khó không nằm ở chỗ đổi nhóm.** Nó nằm ở chỗ CÙNG MỘT KỲ CÔNG có hai
cơ cấu: ngày trước mốc chạy 4 nhóm cũ, từ mốc trở đi chạy 2 nhóm mới. Bảng
công nộp nhân sự là một bảng liền, không tách đôi được; mà điền lại cả kỳ
theo cơ cấu mới thì lịch những ngày ĐÃ ĐI LÀM bị viết đè — sai lương.

Nên `roApply()` **chỉ ghi các ô từ `effFrom` trở đi**. Ngày trước mốc không
bị chạm một ô nào → bảng lịch tự nó là bản trộn, có **vạch dọc đậm** ở đúng
chỗ chuyển (`.mtx td.cut`) và cột *Tổ* ghi `A→DCS` (`.c1.movedteam`).

#### Bốn loại việc, MỘT bản ghi

Ngoài đời chúng đi cùng nhau — một người nghỉ việc thì ba người còn lại phải
xếp lại nhóm, và cả hai việc ấy có hiệu lực **cùng một ngày**. Tách thành bốn
màn riêng là bắt người dùng làm bốn lần cùng một mốc rồi tự đối chiếu.

```
S.reorgs[id] = {
  id, title, effFrom, toIso, preset, kinds:['leave','struct',…],
  leavers: {empId: lastDay},                       // 👋 nghỉ việc
  joiners: {empId: {from,team,shiftType,pattern,a1}}, // 🆕 mới vào
  pauses:  {empId: {from,to,code}},                // 🏥 nghỉ dài hạn
  moves:   {empId: {team,shiftType,pattern,a1}},   // 🔀 đổi nhóm
  prev, undo, status:'draft'|'applied', notify, cells, … }
```

`undo` phân biệt `''` (ô vốn TRỐNG) với "chưa chụp" — nếu không, hoàn tác sẽ
để lại một ô ca không ai xếp. `roUndo()` trả cả lịch lẫn khai báo (kể cả
`leftAt` / `joinAt`) về nguyên trạng và thu hồi thông báo đã gửi.

Nghỉ dài hạn **không** gỡ người khỏi nhóm: hết hạn nghỉ, lịch chuẩn của nhóm
chạy tiếp, không phải xếp lại — chỉ phủ mã nghỉ lên khoảng ngày.

#### Hai lối vào

1. **Thanh Cơ cấu tổ** (`renderStructBar()`, `#structBar`) nằm ngay trong thẻ
   *Tạo / điền lịch ca* ở tab Nhóm & Lịch. Đây là lối vào chính — người ta
   nghĩ tới cơ cấu đúng lúc đang tạo lịch. Thanh này hiện **cơ cấu đang chạy**
   (đoán từ tên nhóm qua `roCurrentStructure()`) và ba nút: `👥 4 nhóm`,
   `🎛 2 nhóm DCS / Field`, `🔀 Biến động nhân sự`.
2. Nút 🔀 trên thanh công cụ tab Lịch.

#### Trình 3 bước

Bản đầu dồn hết vào một trang dài, người dùng mở ra không tìm ra chỗ chọn
người nghỉ. Nay mỗi bước hỏi **đúng một câu**:

| Bước | Hỏi gì | Ghi chú |
|---|---|---|
| 1 | Chuyện gì xảy ra? | 4 thẻ tích được nhiều loại cùng lúc |
| 2 | Áp dụng từ ngày nào? | nút nhanh *đầu kỳ sau* / *hôm nay* / *1–3 kỳ* |
| 3 | Khai chi tiết | chỉ hiện đúng những khối đã tích ở Bước 1 |

Chân màn có dải chip tóm tắt (`🔀 3 đổi nhóm · 👋 1 nghỉ việc`), lý do chặn
nếu còn thiếu, và nút Áp dụng.

#### Cơ cấu dựng sẵn — bấm một nút là chia xong

`roApplyPreset('2team')` chia kỹ sư theo **Vị trí đã khai**: `DCS Boardman` →
nhóm DCS, `Field Engineer` → nhóm Field (dữ liệu đã có sẵn, không hỏi lại).
Mẫu ca mặc định `D D N N R R`; **mốc rải so le tự động** — trong cùng nhóm,
người thứ *i* lệch `round(i × độ_dài_chu_kỳ / số_người)` ngày, và nhóm Field
lệch nửa chu kỳ so với DCS để phủ kín ca ngày lẫn ca đêm. Cả tổ khai cùng
một vị trí thì phép chia đẻ ra một nhóm rỗng → tự chia đôi đều thay vì im
lặng trả về "2 nhóm" chỉ có một nhóm.

`roApplyPreset('4team')` đưa về A/B/C/D, kiểu ca 8 ngày, lệch 2 ngày mỗi nhóm.

Sau đó vẫn sửa tay từng dòng được, hoặc tích nhiều người rồi *Gán nhóm* /
*Gán mẫu ca* / *Rải mốc so le*. Sửa tay một dòng thì `roPreset` tự chuyển
`'custom'` — nhãn cơ cấu không được nói dối.

#### Thông báo

Mỗi người một tin riêng trong app mang `nz:1` (không tốn Zalo), nội dung
đúng loại việc của họ; Zalo nhận **đúng một tin gộp** (`zk:'reorg'`, `n.ro`)
liệt kê cả đợt. Tiêu đề đổi theo việc chính: có người đổi nhóm thì
`🔀 TEAM RESTRUCTURE — N people`, không thì `👥 STAFF CHANGE — N people`.

### 4. Lịch nhập tàu nhiều phương án — `js/25-vessel.js`

Ngày cập gần như không bao giờ chắc, nhưng tổ phải chuẩn bị trước. Nên khai
2–3 **phương án**, cả tổ nắm trước, có lịch chốt thì xoá các phương án sai.

**Không đẻ thêm một loại dữ liệu mới.** Mỗi phương án chính là một sự kiện
trên lịch (`S.events`), chỉ mang thêm ba trường:

```
ev.plan   — mã chuyến, các phương án cùng chuyến dùng chung
ev.optNo  — số thứ tự phương án (1, 2, 3…)
ev.prov   — 1 = CHƯA CHỐT
```

Nhờ vậy phương án có sẵn: vẽ lên ma trận máy tính, lưới tuần điện thoại,
lịch trang chính nhân viên, dải nhắc trong sheet ngày, thông báo trong app,
tin Zalo, cơ chế thu hồi thông báo. Không một dòng nào phải viết lại.

Ngày chỉ có phương án chưa chốt vẽ **nhạt + viền đứt** (`.evprov`), tên ghi
rõ `PA 2/3 (chưa chốt)`.

`vsFix(plan,evId)` — chốt một phương án: bỏ cờ `prov`, **xoá hẳn** các phương
án còn lại và **thu hồi** thông báo của chúng (kể cả tin còn nằm trong hàng
đợi Zalo), rồi gửi tin mới "ngày cập đã chốt". `vsDelOpt()` xoá lẻ và **đánh
số lại** cho liền mạch — xoá PA2 thì PA3 phải thành PA2.

Màn Sự kiện thường **chặn sửa/xoá lẻ** một phương án tàu (`evEdit`/`evDelete`
gọi `vsIsOpt()` rồi chuyển sang màn Lịch tàu) — sửa ở đó sẽ làm lệch đánh số.

Badge trên nút 🚢 Lịch tàu = số chuyến còn phương án chưa chốt, để không ai
quên chốt lại khi hãng báo giờ cập chính thức.

### 5. Tin Zalo

| `zk` | Kênh | Tiêu đề |
|---|---|---|
| `reorg` (tin gộp) | `now` | `🔀 TEAM RESTRUCTURE — N people` |
| `event` + `n.vs.fixed=0` | `batch` | `🚢 VESSEL SCHEDULE — TENTATIVE` |
| `event` + `n.vs.fixed=1` | `batch` | `🚢 VESSEL SCHEDULE — CONFIRMED` |

Chữ `TENTATIVE` nằm **trong thân tin** nữa, không chỉ ở tiêu đề: tin gộp
nhiều phương án thì tiêu đề chỉ hiện một lần. Vẫn giữ nguyên hai luật cứng
của `ZALO-BOT.md`: chỉ in mã ca `D/N/O/R`, **không bao giờ** in mã nội bộ
`SD/SN/SO`.

### 6. Kiểm thử

```
cd LPGT-CongCa-Web
node _test/harness-v89.js    # 117 kiểm tra logic
node _test/render-v89.js     # 39 kiểm tra dựng HTML (DOM giả)
```

Harness cố tình chọn mốc **giữa kỳ** (05/09 trong kỳ 21/08→20/09) — mốc đầu
kỳ là ca dễ, không chứng minh được gì về lịch trộn.

### 7. Cache

Mọi `js`/`css` trong `index.html` đã lên `?v=90`. **Tăng số này mỗi lần sửa
code**, nếu không trình duyệt giữ bản cũ.
