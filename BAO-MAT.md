# Bảo mật — nói thẳng tình trạng hiện tại

Tài liệu này trả lời câu hỏi: *"mật khẩu lưu Firebase thì Google bảo mật, khó bị biết hơn đúng không?"*

**Câu trả lời ngắn: không hẳn.** Google bảo vệ *hạ tầng* của Google, không bảo vệ *dữ liệu của
bạn* nếu luật truy cập (Security Rules) để mở. Phần dưới giải thích rõ và liệt kê việc đã làm,
việc còn phải làm.

---

## 1. Điểm yếu lớn nhất KHÔNG phải là mật khẩu trong code

Cấu hình Firebase (`js/config.js`) **luôn luôn** đi xuống trình duyệt của người dùng — đó là
thiết kế của Firebase, không giấu được. Ai mở DevTools cũng đọc được `apiKey` và `databaseURL`.
Điều đó **bình thường và không phải lỗ hổng** — với điều kiện *Security Rules* chặn đúng.

Nếu rules đang để kiểu `".read": true, ".write": true` (hoặc chỉ `auth != null` trong khi app
dùng **đăng nhập ẩn danh**), thì **bất kỳ ai có đường link đều đọc và sửa được toàn bộ cơ sở
dữ liệu** — lịch ca, đơn từ, danh sách nhân sự, và cả bảng tài khoản. Đây mới là rủi ro thật,
lớn hơn nhiều so với chuyện "mật khẩu nằm trong code".

> Việc cần làm đầu tiên: vào Firebase Console → Realtime Database → Rules, dán nội dung
> trong `firebase-rules.json` (kèm theo repo) và bấm Publish.

---

## 2. Đã siết những gì trong bản này

| Trước | Nay |
|---|---|
| `sha256(mã NV + '\|' + mật khẩu)`, không muối, 1 vòng | **PBKDF2-SHA256, 150 000 vòng, muối ngẫu nhiên 16 byte riêng từng người** |
| Tài khoản mặc định vẫn lưu một chuỗi băm | Chưa đặt mật khẩu riêng thì **không lưu chuỗi băm nào**, chỉ ghi cờ `{init:true}` |
| Mật khẩu tối thiểu 4 ký tự | Tối thiểu **6 ký tự**, chặn mật khẩu trùng mã NV, chặn `111111` / `123456` |
| — | Tài khoản còn dùng bản băm cũ được **tự nâng cấp** sang PBKDF2 ngay lần đăng nhập kế tiếp |

Vì sao quan trọng: mật khẩu mặc định của mọi người **chính là mã nhân viên** (8 chữ số). Với
sha256 không muối, ai lấy được bảng băm chỉ cần thử 8 chữ số là ra hết — máy tính thường làm
trong vài giây. PBKDF2 150 000 vòng làm việc đó **chậm đi khoảng 150 000 lần**, và muối riêng
từng người khiến không thể bẻ hàng loạt.

**Không có mật khẩu nào nằm trong mã nguồn.** `ROOT_ADMIN = 'vc44180062'` chỉ là *mã nhân viên*,
không phải mật khẩu — để lộ cũng không đăng nhập được.

---

## 3. Điều thành thật phải nói: đăng nhập này vẫn là "khoá cửa gỗ"

Phần mềm chạy hoàn toàn ở trình duyệt. Nghĩa là:

- Mọi kiểm tra quyền (`mgr`, `adm`) đều ở phía máy khách. Người biết kỹ thuật mở DevTools gõ
  `adm = true` là thấy hết nút quản trị.
- Nếu rules mở, họ thậm chí không cần đăng nhập — đọc thẳng database là xong.

Nên hiểu đúng: đăng nhập hiện tại để **phân việc và tránh nhầm lẫn giữa các nhân viên**, chứ
chưa phải hàng rào chống người cố tình phá. Với dữ liệu lịch ca nội bộ thì mức này thường chấp
nhận được — nhưng đừng nhầm nó là bảo mật thật.

---

## 4. Muốn bảo mật thật thì làm thế nào (không cần email)

Cách đúng là để **Firebase Authentication** giữ mật khẩu, thay vì tự lưu chuỗi băm trong
database. Operator không có email — không sao, dùng **email giả nội bộ**:

```
vc44180062  →  44180062@lpgt.local
```

Nhân viên vẫn chỉ gõ mã số + mật khẩu; phần mềm tự ghép đuôi `@lpgt.local`. Khi đó:

- Mật khẩu **không còn nằm trong database** — Firebase giữ, băm bằng scrypt phía máy chủ.
- Rules viết được kiểu `auth.uid` — mỗi người chỉ đọc/sửa được phần của mình, người thường
  không xoá được lịch của cả tổ dù có mở DevTools.
- Có sẵn giới hạn số lần đăng nhập sai, không cần tự làm.

Việc này làm được trên **gói Spark miễn phí**. Điểm cần lưu ý: tạo tài khoản mới phải dùng một
instance Firebase phụ (`firebase.initializeApp(cfg,'admin2')`) để quản trị không bị đăng xuất
khi tạo tài khoản cho người khác.

Nếu anh muốn, tôi làm bước này — khoảng một buổi, và cần đổi rules kèm theo.

---

## 5. Vì sao không cho "xem lại mật khẩu"

Anh có nhắc quản trị gốc được *xem và sửa* mật khẩu. Sửa thì được, **xem thì không** — và đó là
điều nên giữ:

- Mật khẩu lưu dạng băm một chiều, về mặt toán học không lấy lại được chữ gốc.
- Nếu lưu thêm bản gốc để xem thì chỉ cần lộ database một lần là mất sạch mật khẩu của mọi
  người — mà nhiều người có thói quen dùng chung một mật khẩu cho nhiều nơi.

Thay vào đó, trong bảng **Tài khoản đăng nhập** quản trị gốc có:

- **🔑 Đặt lại MK** — đặt mật khẩu mới rồi báo miệng cho nhân viên.
- **↺ Về mặc định** — đưa về `mật khẩu = mã số` khi nhân viên quên.
- Cột **Mật khẩu** hiện rõ ai còn dùng mặc định (chữ *Mặc định* màu vàng) để đi nhắc.

---

## 6. Việc nên làm ngay, theo thứ tự

1. **Dán `firebase-rules.json` vào Firebase Console.** Quan trọng nhất, làm trong 2 phút.
2. Nhắc mọi người đổi mật khẩu — nhìn cột *Mật khẩu* trong bảng Tài khoản, ai còn chữ
   *Mặc định* là chưa đổi.
3. Đổi mật khẩu của các tài khoản **Quản trị / Quản lý người Hàn** trước tiên.
4. Cân nhắc chuyển sang Firebase Authentication (mục 4) nếu muốn chắc chắn.
