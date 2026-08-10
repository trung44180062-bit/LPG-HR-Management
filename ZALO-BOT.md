# Zalo Bot — tài liệu DUY NHẤT

> **File này thay thế toàn bộ tài liệu Zalo cũ.** Các file
> `HANDOVER-ZALO.md`, `PHUONG-AN-ZALO-BOT.md`, `MA-TRAN-THONG-BAO.md/.xlsx`,
> `MA-TRAN-ZALO-DA-CHAY.xlsx`, `js/21-zalo.js`, folder `zalo-test/`,
> `THU-ZALO-TRUC-TIEP.html`, `zalo-gas/Code.gs` đã bị xoá ngày **05/08/2026**
> vì mô tả sai hiện trạng (kiến trúc Cloud Function chưa từng dùng, quân số 20,
> các hướng đã thử và thất bại). Không tìm lại chúng.
>
> Bản app: **v5.9** · Quân số: **23** · Repo: `LPG-HR-Management`
> (GitHub Pages, tĩnh, Firebase Realtime DB gói Spark)
>
> Đi kèm: **`ZALO-PHUONG-AN.xlsx`** — bảng so sánh App ↔ Zalo để ghi ý kiến.

---

## 1. Hiện trạng — đang chạy thật, đừng làm lại

```
Trình duyệt (GitHub Pages — không chứa token)
        │  ghi
        ▼
Firebase RTDB   shiftwork_v2/zaloQueue/<notifId>
        │  Apps Script quét mỗi 60 giây
        ▼
Google Apps Script "LPGT Zalo Bot"   ← NƠI DUY NHẤT giữ bot token
        │  HTTPS
        ▼
Zalo Bot API  ──▶  một chat duy nhất
```

| Thành phần | Ở đâu | Trạng thái |
|---|---|---|
| Ma trận kênh, hàm ghi hàng đợi | `js/21-notify.js` | chạy |
| Móc vào mọi thông báo | `js/13-portal.js:100` `newNotif()` | chạy |
| Nhãn phụ `zk` | `js/08-requests.js`, `js/13-portal.js` | chạy |
| Người đưa thư, gộp tin, giờ im lặng | `_RIENG-TU-KHONG-UP-GITHUB/zalo-gas/Code-MOI.gs` | chạy, trigger bật |
| Firebase Rules cho `zaloQueue` / `zaloStat` | `_RIENG-TU-KHONG-UP-GITHUB/firebase-rules.json` | chạy |

**Mọi thông báo trong app đều đi qua đúng một hàm** — `newNotif()` ở
`js/13-portal.js:100`. Chính vì có điểm thắt duy nhất đó mà việc tích hợp chỉ
đụng vào rất ít file. **Giữ nguyên tính chất này; tuyệt đối không mở đường thứ hai
sang Zalo.**

`zaloEnqueue()` bọc kín trong `try/catch` và im lặng trả về khi có sự cố.
**Zalo không bao giờ được phép làm hỏng app.** Giữ đúng như vậy.

### Bí mật — không bao giờ để trong repo

Bot token, JSON service-account của Firebase, URL webhook và `chat_id` đích đều
chỉ nằm trong Apps Script, tại `_RIENG-TU-KHONG-UP-GITHUB/zalo-gas/Code-MOI.gs`
(folder đó nằm **ngoài** repo). Chạy `git grep -i "zapps\|private_key"` trước mỗi
lần đẩy lên GitHub.

---

## 2. Ràng buộc cứng — mỗi cái đã trả giá bằng nhiều giờ

Không tranh luận lại. Từng cái đã thử và xác nhận.

1. **Trình duyệt không gọi được API Zalo.** `bot-api.zapps.me` không trả header
   `Access-Control-Allow-Origin` nào cả, nên mọi origin đều bị CORS chặn. Bắt buộc
   phải có nơi gọi hộ phía máy chủ — đó là lý do Apps Script tồn tại.

2. **`setWebhook` bắt buộc có `secret_token`.** Thiếu là trả
   `400 Bad request: The secret_token must not be empty`. Telegram coi nó tuỳ chọn,
   Zalo thì không.

3. **`getUpdates` không kèm `timeout: 0` sẽ long-poll ~50 giây rồi trả `408`.**
   Cái 408 đó nghĩa là "không có tin nào đang chờ", không phải lỗi.

4. **`getWebhookInfo` và `deleteWebhook` trả 404 / 400.** Zalo chưa làm. Đừng xây
   công cụ chẩn đoán dựa trên chúng.

5. **Bot không nhận được tin trong nhóm.** Thêm bot vào nhóm thì nó *gửi* được,
   nhưng không bao giờ *nhận* — nên không thể dò `chat_id` của nhóm qua bot. Chỉ
   lấy được `chat_id` 1-1. Xem mục 3.3.

6. **Không bao giờ để chuỗi `zalo` trong đường dẫn file.** Proxy mạng cơ quan giết
   `js/21-zalo.js` bằng HTTP **499** (proxy đóng kết nối) trong khi mọi file khác
   tải bình thường. Đổi tên thành `js/21-notify.js` là hết. Tên hàm thì vô tư —
   chúng không đi qua mạng.

7. **Sửa lịch GỐC không báo cho ai.** `js/04-schedule.js` không có lệnh `newNotif`
   nào. Chỉ lịch **thực tế** (`js/06-calendar.js:271`) mới báo. Đây là thiết kế sẵn
   có của app, không liên quan Zalo.

8. **Tạo đơn không báo cho ai.** Đơn chỉ sinh thông báo lúc duyệt, và
   `notifyReqParties` loại trừ chính người vừa thao tác. Quản trị tự tạo rồi tự
   duyệt đơn của mình thì không sinh thông báo nào.

---

## 2b. Thay đổi ngày 05/08/2026 — bản app v6.0

Làm theo ý kiến ghi trong `ZALO-PHUONG-AN.xlsx` (các ô K9, K13, K14).

### 2b.1 Toàn bộ tin Zalo chuyển sang TIẾNG ANH

`ZALO_TITLE`, `ZALO_ACTION` và toàn bộ hàm dựng thân tin trong
`js/21-notify.js` nay viết bằng tiếng Anh — vì Quản lý người Hàn đọc **cùng
một kênh** với người Việt. Giao diện app vẫn song ngữ như cũ; hai thứ hoàn
toàn tách biệt, sửa `21-notify.js` không đụng gì `js/14-i18n.js`.

Tên người, mã ca (`D` `N` `O` `AL8`…), mã nhân viên, ngày tháng giữ nguyên vì
đó là **dữ liệu**, không phải câu chữ. Ngày viết `Wed 19/08/2026` (hàm
`zDate`), giờ viết `14:32 05/08/2026` (hàm `zDateTime`) — cố định, không phụ
thuộc `LANG` của cái máy vô tình dựng ra tin đó.

### 2b.2 Tin mới `apprNeed` — báo cho NGƯỜI DUYỆT

Trước đây app **không báo gì** cho người duyệt; họ chỉ biết có đơn khi tự mở
tab Duyệt. Đây là nhu cầu chưa đáp ứng lớn nhất (mục E1 trong bảng cũ).

Nay mỗi lần đơn **chuyển sang một cấp mới** thì cấp đó được báo, kèm **nguyên
chi tiết đơn** nên không phải mở app mới biết đơn nói gì:

| Lúc nào | Ai được báo | Tiêu đề tin Zalo |
|---|---|---|
| Nhân viên gửi đơn | Cấp đầu trong chuỗi **+ Hoàng Trung** | `📥 APPROVAL REQUIRED — FIELD ENGINEER` |
| Field Engineer duyệt xong | Hoàng Trung | `📥 APPROVAL REQUIRED` |
| Hoàng Trung duyệt xong | Quản lý người Hàn (hoặc người đang được uỷ quyền) | `📥 FINAL APPROVAL REQUIRED` |
| Quản lý người Hàn chốt | Các bên liên quan | `✅ REQUEST APPROVED` |

Ba tin `apprNeed` này **thay luôn** cho hai tin trạng thái trung gian `fe` và
`provapproved` — hai loại đó vẫn để `null` (chỉ hiện trong app). Tổng số tin
mỗi đơn **không tăng**, mà lại tới đúng người cần biết. Quy tắc R1 giữ nguyên.

### 2b.3 Gộp lời mời xác nhận vào tin "cần duyệt" — cờ `nz`

Thông báo nào có `n.nz = 1` thì **chỉ hiện trong app**, `zaloEnqueue` bỏ qua.
Dùng ở hai chỗ:

1. **Lời mời xác nhận đổi ca / OT cover** khi gửi đơn (`js/13-portal.js`) —
   nội dung đã được gộp thành hai dòng cảnh báo trong tin `apprNeed`
   (`⚠️ ... has not accepted the OT cover yet.`). Một sự việc → **một tin**,
   mà nội dung lại đầy đủ hơn. Đúng ý ô K9.
2. ~~**Người duyệt thứ 2, 3…** trong `notifyApprovers`~~ — **đã gỡ 06/08/2026.**
   Mẹo "chỉ người đầu tiên được đẩy sang Zalo" mong manh: đúng thông báo dẫn
   đầu ấy bị gỡ (đơn huỷ, đổi cấp duyệt) là cả nhóm mất tin. Nay hộp gửi ở
   `js/21-notify.js` tự gộp mọi tin trùng nội dung thành một và liệt kê đủ
   người nhận — xem mục 3.0.

> Đường A4 (quản trị **đổi** người cover sang người khác) **không** gắn `nz` —
> người cover mới vẫn nhận tin Zalo riêng, vì lúc đó không có tin nào khác gộp
> hộ được.
>
> Khi làm xong liên kết 1-1 (mục 3.3) thì **bỏ cờ `nz` ở chỗ số 2** — lúc đó
> mỗi người nhận riêng nên gửi đủ mọi người mới đúng. Chỗ số 1 thì giữ, vì đó
> là gộp theo *nội dung* chứ không phải theo *đích đến*.

### 2b.4 Giữ thông báo để gửi gộp — nút 🔕 / 🔔 trên thanh Lịch

Lúc nhập tàu hoặc bảo dưỡng, quản lý đổi lịch của rất nhiều người liên tiếp.
Báo từng ô một là spam thật: 15 người × 2 ngày = 30 tin — mà lại còn **sai**,
vì trong lúc xếp thì cùng một ô có thể bị đổi đi đổi lại vài lần.

**Cách dùng.** Vào Lịch → chế độ **Thực tế** → bấm **🔕 Giữ thông báo**. Sửa
lịch bao nhiêu người tuỳ ý. Xong bấm **🔔 Gửi thông báo**.

**Cách hoạt động** (`js/06-calendar.js`, phần `schedHold*`):

- Lịch **vẫn được ghi và đồng bộ Firebase bình thường** — chỉ hoãn phần
  *thông báo*, không hoãn *dữ liệu*. Đây là ranh giới quan trọng nhất.
- Mỗi ô ghi vào `S.settings.schedHold.items` theo khoá `"mã NV|ngày"`, nên
  sửa lại lần nữa chỉ **đè lên**. Trường `was` giữ nguyên giá trị của lần
  ĐẦU chạm vào ô đó (cái nhân viên đang biết), chỉ `now` thay đổi → luôn báo
  đúng **trạng thái cuối cùng**, không cộng dồn các bước trung gian.
- Ô nào sửa rồi trả về đúng chỗ cũ (`now === was`) thì **tự rụng** khỏi danh
  sách — không ai bị báo một thay đổi không tồn tại.
- Lúc bấm gửi: mỗi người vẫn nhận **đúng một** việc-chờ-xác-nhận trong app
  (các tin đó mang `nz:1`), còn Zalo chỉ tốn **đúng MỘT** tin `schedBulk`
  nhóm theo người:

```
📅 WORK SCHEDULE UPDATED — 4 PEOPLE

4 employee(s) · 5 change(s)
Changed by: Hoàng Trung

• Lê Minh :  Wed 19/08 D→N
• Nguyễn Văn Hoàng Nhân :  Wed 19/08 R→O
• Thuận An :  Wed 19/08 R→N  ·  Thu 20/08 R→N
• Trần Bảo :  Wed 19/08 N→D

→ Everyone listed above: open the app to confirm or decline your own change.
```

**Chống quên** — quên bấm gửi là cả nhà máy đi làm theo lịch mới mà không ai
được báo, nên có ba lớp:

1. Băng nhắc đỏ nhấp nháy ở **mọi tab**, kèm số đếm + nút Gửi ngay.
2. Đăng xuất khi còn thay đổi đang giữ → hỏi lại.
3. Đóng tab / tải lại trang → trình duyệt hỏi lại (`beforeunload`).

`S.settings.schedHold` nằm trong settings nên đồng bộ realtime: quản trị khác
mở app cũng thấy băng đỏ và **bấm gửi hộ được**.

Cờ `bcast` trên hàng đợi (hàm `zaloIsBroadcast`) báo cho Apps Script biết đây
là tin gửi chung → bỏ dòng `👤 <tên người nhận>` ở đầu tin, vì ghi tên một
người trong tin gửi cả nhóm là gây hiểu nhầm. Loại `event` cũng dùng cờ này.

### 2b.5 Uỷ quyền phê duyệt cấp cuối

`S.settings.kmgrDelegate = {on, to, by, at, note}` — công tắc bật/tắt trong
tab **Dữ liệu → 🔑 Uỷ quyền phê duyệt cấp cuối**. Khi bật, `apprLevelOf()`
(`js/01-core.js`) trả `'kmgr'` cho người được uỷ quyền, tức họ **chốt đơn
chính thức** thay Quản lý người Hàn. Chỉ chuyển quyền *duyệt* — không kèm bất
kỳ quyền quản trị nào khác.

Ảnh hưởng tới Zalo: `zLevel('kmgr')` in ra
`Korean Manager — delegated to <tên>` nên người đọc tin biết ngay đơn đang chờ
ai thật sự. `apprLevelRecipients('kmgr')` cũng thêm người đó vào danh sách
nhận tin `apprNeed`.

---

## 3. Việc còn phải giải

### 3.0 Hộp gửi ở trình duyệt — ★ v6.3, 06/08/2026

Bản 05/08 đặt việc gộp ở Apps Script (mục 3.1 ngay dưới). Thực tế vẫn spam:
tạo một sự kiện là cả tổ nhận một loạt tin y hệt nhau, và đổi lịch nhiều người
rồi bấm gửi một lần cũng không gộp. Mổ ra thấy ba chuyện:

1. **Lý lẽ "23 trình duyệt không thống nhất được với nhau" sai ở chỗ quan
   trọng nhất.** Fan-out không do 23 máy sinh ra — MỘT người bấm "Tạo sự
   kiện" trên MỘT máy, máy đó chạy một vòng lặp đẻ ra 23 thông báo. Nó biết
   thừa 23 tin ấy giống hệt nhau. Đẩy việc gộp sang máy chủ nghĩa là đặt cược
   vào chuyện bản Apps Script đang triển khai có phải bản mới không, và 23
   gói có cùng đến lượt trong một lượt quét không. Sai một trong hai là ăn đủ
   23 tin.
2. **Đổi lịch nhiều người chỉ gộp khi nhớ bấm 🔕 Giữ.** Quên bấm thì mỗi ô là
   một tin 🔴 riêng, mà chúng khác nội dung nên không vân tay nào gộp được.
3. **Thu hồi chưa từng chạy một lần nào.** `zaloWithdraw` đọc
   `zaloQueue/<id>` trước khi xoá, nhưng luật Firebase đặt `.read: false` cho
   nhánh đó (cố ý, để nhân viên không đọc được tin của người khác). Lời hứa
   đọc luôn bị từ chối quyền, lỗi rơi vào `.catch(console.warn)`, nhánh xoá
   nằm sau nên không bao giờ tới lượt. Mọi tin đã vào hàng đợi đều bắn đi
   bằng hết, kể cả tin của việc vừa bị xoá.

**Cách làm mới** — `zaloEnqueue` không ghi thẳng Firebase nữa mà bỏ vào một
hộp gửi, đệm **4 giây** (ngừng thao tác) hoặc tối đa **20 giây**, rồi gộp và
ghi. Đệm không làm tin tới chậm: trigger Apps Script vốn quét mỗi phút.

| Phép gộp | Làm gì | Kết quả |
|---|---|---|
| 1 — cuộn lịch | ≥2 `schedChange` → một tin `📅 WORK SCHEDULE UPDATED — N PEOPLE`, đúng khuôn tin của nút 🔔 | 5 người = 1 tin, **không cần bấm 🔕** |
| 2 — vân tay | cùng `fp` → giữ một gói, nhập người nhận, thêm dòng `For: …` | sự kiện 23 người = 1 tin; 4 người duyệt = 1 tin |
| 3 — cùng người + cùng nhóm | nối thân tin | nhiều việc = 1 tin nhiều mục |

Trong app KHÔNG mất gì: mỗi người vẫn nhận đúng một việc-chờ-xác-nhận riêng.
Một tin gộp trong app một mình một ô lịch vẫn để tin cá nhân (rõ hơn tin gộp).

**Thu hồi sau khi gộp.** Một hàng đợi nay đại diện cho nhiều thông báo, liệt
kê ở `notifIds`; mỗi thông báo mang ngược lại `n.zq = <khoá hàng>` (nằm trong
`S.notifs` nên đồng bộ sang máy khác). `zaloWithdraw` xoá thẳng, không đọc, và
**chỉ xoá khi thông báo cuối cùng trong nhóm biến mất** — nếu không, một người
duyệt xong là làm mất tin của 22 người còn lại. `notifDrop` xoá tuần tự nên
tới lượt cuối đếm ra 0. Tin còn nằm trong hộp gửi thì nhấc thẳng ra, không tốn
gì cả.

Không phải deploy lại Apps Script: trình duyệt ghi ít hàng hơn, cấu trúc hàng
giữ nguyên (thêm vài trường `notifIds`/`tos`/`n` mà máy chủ bỏ qua).
`ONE_CHAT_DEDUPE` để nguyên làm lưới an toàn lớp hai.

Harness: `_test/zalo-merge-harness.js` — 38 phép thử.

### 3.1 Lãng phí do fan-out — ✅ ĐÃ SỬA 05/08/2026 (lớp máy chủ, nay là lưới an toàn)

> **Đã cài xong.** Trình duyệt ghi vân tay `fp` = băm FNV-1a của
> `group + title + lines + action` lên mỗi hàng đợi (`zaloFp()` ở
> `js/21-notify.js`). Apps Script bật cờ `ONE_CHAT_DEDUPE = true` thì trong
> `doTick_` các gói **cùng `fp`** chỉ gửi MỘT, những gói còn lại xoá thẳng khỏi
> hàng đợi. Một sự kiện lịch cho 23 người nay tốn **1 tin thay vì 23**.
>
> Khi làm xong liên kết 1-1 (mục 3.3) thì đặt `ONE_CHAT_DEDUPE = false` — lúc đó
> mỗi người có chat riêng nên tin không còn trùng nữa.
>
> Phần phân tích dưới đây giữ lại để hiểu vì sao lại làm như vậy.

Một sự kiện lịch `scope: 'all'` gọi `newNotif` một lần cho mỗi nhân viên
(`js/20-events.js:135`, lặp qua `evRecipients()`). 23 người là 23 hàng trong hàng
đợi. Người đưa thư gộp theo `to | group | title`, mà `to` khác nhau ở mọi hàng, nên
nó **gửi 23 tin y hệt nhau vào cùng một chat**.

Hành vi trong app là đúng — 23 người mỗi người cần một cái chuông. Hành vi Zalo là
sai — một nhóm chỉ cần một tin.

**Nguyên nhân gốc:** hàng đợi mô hình hoá theo *người nhận*, nhưng đường truyền
hiện chỉ có một đích. Hàng theo người nhận chỉ hợp lý khi đã gửi 1-1.

**Cách sửa đề xuất — gộp nội dung trùng ở người đưa thư:**

Thêm dấu vân tay nội dung khi đẩy vào hàng đợi, ví dụ
`fp = hash(group + title + lines.join('\n'))`, lưu trên mỗi hàng. Trong `doTick_`,
gộp theo `fp` **khi đích là chat nhóm**, và gộp theo `to | group | title` khi đích
là từng người. Gửi nội dung của một hàng; `toName` của các hàng còn lại gấp lại
thành một dòng danh sách người nhận.

Kết quả cho sự kiện ở trên: **1 tin thay vì 23**.

Giữ việc gộp ở người đưa thư, không đưa về trình duyệt. Hai mươi ba trình duyệt
không thể thống nhất với nhau cái gì nên gộp; một người đưa thư thì được. Cùng một
lý lẽ đã đặt token ở đó.

### 3.2 Nhắc tên (@) nhân viên trong tin nhóm

Mong muốn: `@` đúng người liên quan trong tin nhóm để nó ping họ.

**Ẩn số phải làm rõ trước:** Zalo Bot API có hỗ trợ thực thể mention trên
`sendMessage` không, và mention có thể trỏ bằng thứ mà app đang có không. App lưu
mã nhân viên (`vc44180062`) và tên hiển thị — **không** lưu Zalo user ID. Mention
gần như chắc chắn cần Zalo user ID.

Dò trước khi thiết kế: từ Apps Script gửi `sendMessage` kèm trường `mention`,
`entities`, hoặc `mentions` rồi đọc lỗi trả về. Làm trong một hàm bỏ đi, mỗi lần
một dạng, ghi lại kết quả từng cái.

Nếu mention cần Zalo user ID thì nó bị chặn sau việc liên kết tài khoản (3.3) — mà
tới lúc đó gửi 1-1 thường là câu trả lời tốt hơn, và mention thành thừa.

Biện pháp tạm thời không tốn gì: giữ dòng chữ thuần `👤 <tên>`, và đặt nó lên
**dòng đầu** với tin nhóm để nhìn thấy ngay trong preview thông báo.

### 3.3 Một đích duy nhất cho tất cả

Cả 19 loại thông báo hiện đổ vào một chat. Hai hệ quả:

- Kết quả duyệt đơn, đổi ca, nhờ cover là chuyện cá nhân; cả nhà máy đọc được.
- Không ai liếc qua mà biết tin nào là của mình.

Kế hoạch gốc quy định liên kết theo từng người: app phát mã OTP 6 số, nhân viên
nhắn `LK <mã NV> <otp>` cho bot, webhook lưu `zalo/link/<empId> = { chatId }`.
**Webhook đã tồn tại và đã nhận được tin 1-1**, nên phần khó đã xong — `doPost`
trong `Code-MOI.gs` chỉ cần phân tích câu lệnh `LK`.

Cách chia đề xuất sau khi có liên kết:

| Nội dung | Đích |
|---|---|
| Kết quả duyệt đơn, đổi ca, cover, thay đổi lịch | 1-1 |
| Sự kiện trên lịch, thông báo chung | nhóm |

### 3.4 Mẫu tin phải là dữ liệu, không phải code

Chữ nghĩa của tin hiện nằm trong bốn hằng số của `js/21-notify.js`
(`ZALO_TITLE`, `ZALO_ACTION`, `ZALO_CHANNEL`, `ZALO_INFO_CHANNEL`) cộng với phần
dựng thân tin trong `zaloLines()`. Đổi một chữ là phải sửa file và đẩy lại.

Mong muốn: một tab quản trị để sửa mẫu tin. **Xem tab «Tab quản trị mẫu tin»
trong `ZALO-PHUONG-AN.xlsx` để biết chi tiết khả thi và lộ trình.**

Tóm tắt: chuyển bốn bảng hằng số vào `S.settings.zaloTpl`, mồi từ hằng số hiện tại
ở lần chạy đầu để không vỡ gì. Dựng màn quản trị liệt kê 19 loại với ô sửa
tiêu đề / thân / việc-phải-làm / kênh / khoá gộp, có xem trước bằng dữ liệu mẫu và
nút "gửi thử cho tôi".

Thân tin cần biến thay thế. Giữ bộ nhỏ và có tài liệu:
`{name}` `{empId}` `{date}` `{oldCode}` `{newCode}` `{reqType}` `{by}` `{reason}`
`{eventTitle}` `{link}`. Thay bằng lệnh thay chuỗi thuần; **tuyệt đối không**
`eval` bất cứ thứ gì đọc từ settings.

Ra bản chỉ-đọc trước (cho xem tin sẽ gửi ra sao), rồi mới cho sửa. Thứ tự đó bắt
được lỗi mẫu tin trước khi nó tới tay 23 người.

---

## 4. Ý tưởng đáng cân nhắc

Xếp theo giá trị trên công sức. Hai cái đầu bỏ xa phần còn lại.

1. **Bản tin cho người duyệt (E1).** App vẫn không nói gì với người duyệt khi có
   đơn tới; họ chỉ biết khi mở tab Duyệt đơn. Hai bản tin mỗi ngày (11:00, 16:30)
   liệt kê số đơn đang chờ và đơn chờ lâu nhất. Danh sách rỗng thì không gửi gì.
   Chạy hoàn toàn trong Apps Script — một trigger giờ đọc `S.requests` và
   `reqNextLevel`. Không cần sửa app.

2. **Đơn gấp (E2).** Đơn tăng ca hoặc đổi ca cho *hôm nay hoặc ngày mai* không chờ
   bản tin được. Gửi ngay cho người duyệt đang tới lượt.

3. **Bản tin nhân sự hằng sáng cho nhóm.** 06:00 mỗi ngày, đăng lên nhóm nhân lực
   hôm nay: ai ca D, ai ca N, ai cover, quân số so với `minD`/`minN`. Suy hoàn toàn
   từ dữ liệu app đã có, và làm nhóm chat có ích với cả người không mở app.

4. **Cảnh báo thiếu quân.** Khi một lần sửa hoặc duyệt làm một ngày rơi xuống dưới
   `S.settings.minD` / `minN` / `minO`, cảnh báo nhóm ngay. Đây là thông báo duy
   nhất có hậu quả vận hành thật ở kho LPG — mọi thứ khác chờ được vài phút.

5. **Nhắc chốt kỳ (E4).** Ngày 18–19 của chu kỳ 21→20, liệt kê từng người còn bao
   nhiêu ngày đã làm tăng ca mà chưa có đơn. Giá trị cao, ít ồn, mỗi tháng một lần.

6. **Nhắc đơn ế (E3) và nhắc cover chưa trả lời (E6).** Mỗi thứ đúng một lần,
   không lặp. Rẻ, làm chung với trigger bản tin.

7. **Tổng hợp suất cơm.** `js/19-meal.js` đã tính sẵn suất cơm tăng ca. Một dòng
   ngắn đăng nhóm mỗi ngày ("mai: thêm 7 suất tối") tiết kiệm cho nhà bếp một cuộc
   gọi. Không phải tính thêm gì.

8. **Báo cáo hạn mức hằng tuần.** `zaloStat/<YYYY-MM>` đã được người đưa thư ghi.
   Đăng mỗi tuần một dòng: số tin đã gửi, tỷ lệ so với hạn mức free 3.000, nhóm tin
   nhiều nhất. Giữ kênh trung thực và bắt sớm vòng lặp điên.

9. **Xác nhận in phiếu.** `S.printLog` đã có nhưng không ai được báo khi phiếu được
   in. Một dòng đăng nhóm là khép vòng cho văn phòng.

Mục 3, 4, 7, 8 không cần liên kết từng người — chúng vốn hợp với nhóm, nên làm
được trước mục 3.3.

---

## 5. Nguyên tắc phải giữ

- **Ngân sách: ~16 tin/người/tháng.** Gói free (3.000 tin/tháng, 50 user) không
  phải giới hạn — **uy tín của kênh** mới là. Bot ping 25 lần một tháng toàn chuyện
  vặt thì bị tắt tiếng, và rồi tin "đơn bị từ chối" cũng không ai đọc.
- **Một sự kiện, một tin.** Gộp luôn tốt hơn gửi thêm tin thứ hai.
- **Dòng đầu là kết luận.** Người đọc phải hiểu ngay trong preview thông báo.
- **Mọi tin cần hành động phải kết bằng hành động.** Không có hành động thì tin đó
  đáng lẽ không nên gửi.
- **Tin tốt không cần hồi đáp thì để trong app.** Xem các dòng ⚪ trong ma trận —
  `swapOk`, `coverOk`, `fe`, `provapproved`.
- **Tin trạng thái trung gian không bao giờ sang Zalo** (quy tắc R1). Đây là chỗ
  tiết kiệm lớn nhất: cắt khoảng 135 tin mỗi tháng.

### Quy tắc chống spam — tình trạng

| Quy tắc | Trạng thái | Cần gì |
|---|---|---|
| R1 — bỏ tin trung gian | ✅ đã cài | `fe`, `provapproved` = `null`; `apprNeed` nói thay |
| R2 — cửa sổ gộp | ✅ đã cài | gộp theo người nhận + khoá nhóm, `BATCH_WAIT_MIN = 8` phút |
| R3 — huỷ tin nếu đã đọc trong app | ❌ chưa | app phải lưu mốc `lastSeen` từng người |
| R7 — gộp tin trùng nội dung | ✅ **chuyển về trình duyệt 06/08/2026** | hộp gửi `zaloOut*` ở `js/21-notify.js`; `ONE_CHAT_DEDUPE` giữ làm lưới an toàn |
| R8 — một sự việc một tin | ✅ đã cài 05/08/2026 | cờ `nz` gộp lời mời cover/đổi ca vào tin `apprNeed` |
| R9 — cuộn thay đổi lịch rời rạc | ✅ đã cài 06/08/2026 | ≥2 `schedChange` trong một cửa sổ → 1 tin gộp, không cần bấm 🔕 |
| R10 — thu hồi thật sự chạy | ✅ sửa 06/08/2026 | `zaloWithdraw` bỏ bước đọc hàng đợi (luật cấm đọc) |
| R4 — giờ im lặng | ⚠️ nửa vời | 21:30–06:30 chặn tin 🟡; **ca đêm N (20:00–08:00) chưa được miễn trừ** — câu Q1 chưa ai trả lời |
| R5 — không gửi bản tin rỗng | — | chưa có bản tin nào |
| R6 — chống trùng | ✅ đã cài | khoá hàng đợi chính là `notifId` |
| R11 — bản tin gom 08:00 | ✅ đã cài 10/08/2026 | kênh `'digest'` + sổ chờ `S.digest`; transaction trên `meta/digestDay` chọn đúng 1 máy bắn. Áp cho đơn `ot/multi/late/wt`, tin `apprNeed`/`cancelled`. Hộp gửi `zaloOut*` KHÔNG làm nổi việc này vì chỉ gộp được tin cùng máy trong 4 giây. Xem `js/21-notify.js` và README mục v6.8 |
| R12 — kết quả duyệt OT không bắn lẻ | ✅ đã cài 10/08/2026 | `approved` của đơn `ot/multi/late/wt` vào bản tin 08:00. `rejected` GIỮ kênh 'now' (bị từ chối mà biết muộn thì đi làm thừa). Nghỉ phép / đổi ca vẫn 'now' toàn bộ |

---

## 6. Cách kiểm thử một thay đổi

1. Đẩy lên GitHub, mở app, tải lại cứng (`Ctrl+Shift+R`).
2. Kiểm tra console: `typeof zaloEnqueue` phải trả `"function"`. Nếu trả
   `"undefined"` là file không tải được — soi lỗi HTTP 499 (ràng buộc số 6).
3. Làm một thao tác **thật sự** sinh thông báo. Cách thử một-người đáng tin cậy là
   sửa ô lịch **thực tế** của nhân viên khác sang mã khác mã chuẩn. Không phải dòng
   của mình, không sửa về mã chuẩn, không sửa thành cùng mã, không xoá ô — cả bốn
   đều bị bỏ qua trong im lặng theo thiết kế (`js/06-calendar.js:257–272`).
4. **Đợi 4 giây** rồi mới soi hàng đợi — tin nằm trong hộp gửi chờ gộp (mục
   3.0). Muốn ép đi ngay: gõ `zaloFlush()` trong console, hoặc `zaloOutPending()`
   để xem còn bao nhiêu gói đang chờ gộp.
5. Apps Script → `B4_XEM_HANG_DOI` để xem hàng đợi.
6. `B5_GUI_NGAY` gửi ngay, bỏ qua cửa sổ gộp và giờ im lặng.
7. Apps Script → Executions để xem lỗi người đưa thư.
8. Trước khi đẩy lên: `node _test/zalo-merge-harness.js` phải xanh cả 38 phép.

Trigger chạy mỗi phút, nên tin 🔴 tới trong vòng 60 giây mà không cần thao tác gì.
Tin 🟡 chờ `BATCH_WAIT_MIN` (hiện 8 phút) — Zalo im ắng ngay sau khi tạo sự kiện là
**bình thường**, không phải lỗi.

---

## 7. Bảng file

| Đường dẫn | Vai trò |
|---|---|
| `js/21-notify.js` | ma trận kênh, dựng nội dung tin, **hộp gửi gộp tin**, ghi & thu hồi hàng đợi |
| `_test/zalo-merge-harness.js` | 38 phép thử lớp gộp — `node _test/zalo-merge-harness.js` |
| `js/13-portal.js:100` | `newNotif()` — điểm móc duy nhất |
| `js/06-calendar.js:257` | sửa lịch thực tế; chú ý bốn điều kiện bỏ qua ở 257–272 |
| `js/08-requests.js:867` | `notifyReqParties()` — kết quả duyệt đơn |
| `js/20-events.js:126` | `evSendNotifs()` — chỗ fan-out nói ở 3.1 |
| `ZALO-PHUONG-AN.xlsx` | bảng so sánh App ↔ Zalo, cơ chế gửi, phương án tab mẫu tin, việc còn nợ |
| `_RIENG-TU-KHONG-UP-GITHUB/zalo-gas/Code-MOI.gs` | người đưa thư — **giữ toàn bộ bí mật** |
| `_RIENG-TU-KHONG-UP-GITHUB/zalo-gas/HUONG-DAN.md` | hướng dẫn cài Apps Script một lần |
| `_RIENG-TU-KHONG-UP-GITHUB/firebase-rules.json` | rules cho `zaloQueue`, `zaloStat` |

---

## 8. Thứ tự làm đề xuất

1. **3.1 gộp fan-out** — lãng phí lớn nhất, chỉ sửa người đưa thư, không đẩy app.
2. **4.1 bản tin cho người duyệt** — nhu cầu chưa đáp ứng lớn nhất, chỉ Apps Script.
3. **4.4 cảnh báo thiếu quân** — giá trị vận hành cao nhất.
4. **3.4 tab mẫu tin** — làm mọi việc sau đó rẻ hơn khi cần chỉnh chữ nghĩa.
5. **3.3 liên kết từng người** — mở khoá quyền riêng tư, và có lẽ cả mention (3.2).

Bước 1–3 hoàn toàn không cần sửa app. Điều đó là có chủ đích: mỗi lần đẩy lên
GitHub Pages là một lần tải folder bằng tay, và proxy cơ quan đã nuốt mất một file
rồi.

---

## 2c. Sửa thêm 05/08/2026 (chiều)

### Bảng Duyệt đơn không còn cuộn ngang

`apprTableHtml` khai `<colgroup>` cộng đúng **100%** + `table-layout:fixed`
trong `css/app.css`. Ô nào chữ dài thì **xuống dòng trong ô**, không đẩy cả
bảng ra ngoài như bản đầu (bản đầu để `white-space:nowrap` ở cột Trạng thái và
Cover nên bảng phình ra). `.at{min-width:940px}` là lưới an toàn cho màn hình
hẹp 768–940px: thà cuộn ngang còn hơn bóp chữ nát.

Màn hình từ 1500px trở lên: `.wrap{max-width:1640px}` — nới khung chính ra để
bảng có chỗ thở, đỡ phải xuống dòng. Lịch ca cũng được lợi.

### Chuông cho người KHÔNG có Trang chính

Thư ký, Quản lý người Hàn và ai đặt Kiểu ca = *Không xếp lịch* đều có
`noSelf = true` → không có tab Trang chính. Mà chuông thông báo lại nằm **trên
Trang chính**, nên trước đây họ **không có chỗ nào xem được thông báo của app**
— kể cả tin `apprNeed` báo có đơn chờ họ duyệt. Lỗi im lặng, không ai nhận ra
cho tới khi có tin mới.

Đã bổ sung ba chỗ:

1. Nút 🔔 trên **header** (`#hdrBell`, class `noself-only`) kèm chấm đỏ đếm số.
2. Mục 🔔 **Thông báo** trong sheet **☰ Thêm** — trên điện thoại các nút icon ở
   header bị `@media(max-width:767px){.hdr .icobtn{display:none}}` ẩn đi, nên
   đây là lối duy nhất của họ.
3. `MP_NOSELF_TABS = ['ntf','acc']` — bảng phụ của nhóm noSelf nay có tab
   Thông báo, trước chỉ có Tài khoản.

Tin `apprNeed` trong bảng Thông báo **bấm được**, nhảy thẳng sang tab Duyệt đơn.
Đây là lối vào chính của Quản lý người Hàn.

`refreshBellBadge()` ở `js/03-nav.js` cập nhật cả hai chấm đỏ; gọi từ
`refreshBadge()`, `openMoreSheet()` và sau khi `markSeen`.
