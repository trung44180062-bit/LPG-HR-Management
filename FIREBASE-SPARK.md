# Kiểm tra gói Firebase Spark (miễn phí) — App Công Ca LPGT

Ngày rà: 2026-07-31 · Giả định vận hành: **3–5 đơn/ngày**, ~30 nhân viên.

## Hạn mức gói Spark (Realtime Database)
| Chỉ tiêu | Hạn mức Spark | Ghi chú |
|---|---|---|
| Dung lượng lưu | **1 GB** | dữ liệu app hiện ~0,34 MB |
| Tải xuống (download) | **10 GB/tháng** | đây là chỉ tiêu dễ chạm nhất |
| Kết nối đồng thời | **100** | 30 nhân viên → dư |
| Ghi (write) | không giới hạn riêng, tính vào storage | rất nhỏ |

## Cách app tiết kiệm băng thông (đã có sẵn)
- **Đồng bộ DELTA** (`js/02-storage.js`): khi sửa 1 ô lịch chỉ đẩy đúng đường dẫn đổi (~0,1 KB) thay vì cả khối 0,34 MB.
- Nhánh dạng map (`base, over, requests, accounts, printLog, notifs`) nghe theo `child_added/changed/removed` → client chỉ tải bản ghi thay đổi, không tải lại cả nhánh.

## Ước tính thực tế
**Chi phí lớn nhất = lần tải trạng thái đầu tiên mỗi phiên** (~0,34 MB toàn bộ dữ liệu).

- 30 nhân viên × mở app 3 lần/ngày = 90 phiên/ngày.
- 90 × 0,34 MB ≈ **31 MB/ngày** ≈ **0,9 GB/tháng** → chỉ ~9% hạn mức 10 GB.

**Chi phí do đơn từ (phần bạn hỏi):**
- Mỗi đơn qua tối đa 3 cấp duyệt + vài thông báo (`notifs`) ≈ 6–10 KB toàn vòng đời.
- 5 đơn/ngày ≈ **30–50 KB/ngày** ghi + cùng chừng đó tải delta → **không đáng kể** (< 0,2% băng thông ngày).

**Kết luận: Gói Spark THỪA SỨC đáp ứng** ở mức 3–5 đơn/ngày. Kể cả tăng lên 20–30 đơn/ngày vẫn còn rất nhiều dư địa; nút thắt (nếu có) là số phiên mở app, không phải số đơn.

## Khuyến nghị giữ mức thấp lâu dài
1. **Dọn thông báo cũ**: `S.notifs` tăng dần (~30 notif/ngày với luồng duyệt mới). Nên định kỳ (VD mỗi kỳ công) xoá notif đã xem quá 60 ngày. Hiện đã có `apprPurgeFiltered` cho đơn; có thể bổ sung tương tự cho notifs nếu cần.
2. **Dọn đơn theo kỳ**: nút "Dọn dữ liệu đang lọc" (tab Duyệt, quyền quản trị) đã cho xoá đơn cũ theo kỳ — dùng mỗi 2–3 tháng.
3. Giữ `js/16-otlog-data.js` (~49 KB Nhật ký tăng ca nhúng cứng) ở mức hợp lý — nó tải theo file tĩnh, không tính vào Firebase.

*Lưu ý: hạn mức Spark có thể được Google điều chỉnh; số liệu trên theo mức phổ biến của Realtime Database. Nếu Google đổi hạn mức, tỉ lệ sử dụng vẫn rất thấp nên kết luận không đổi.*
