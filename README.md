# Kể Nè — Website V3

Bộ website gồm 12 trang HTML, index.html, CSS gốc giữ nguyên và các mô-đun bổ sung riêng cho nhận diện, ảnh và tương tác. Nội dung hiển thị đã chuyển sang Kể Nè, bỏ thông tin học phần/lớp/mã sinh viên và các nhãn bài làm lặp khắp giao diện.

## Cách mở

1. Giải nén toàn bộ thư mục, giữ nguyên img, css, js và fonts bên cạnh các file HTML.
2. Mở index.html để xem nội dung và ảnh cục bộ khi không có Internet.
3. Để dùng tài khoản và bộ nhớ ngoại tuyến, chạy `python start_kene.py` trong thư mục, hoặc `python -m http.server 8000`, rồi truy cập http://localhost:8000/. Web Crypto và Service Worker cần localhost hoặc HTTPS.
4. Khi mở bằng localhost/HTTPS, chờ dòng “Đã lưu giao diện & Ảnh ngoại tuyến” trước khi ngắt mạng. Tất cả ảnh, font chữ, biểu tượng và thư viện đều đã có trong bộ mã, không dùng CDN khi hiển thị.

## Hoàn thiện trong V3

- Logo riêng: hai bong bóng trò chuyện cùng trái tim, màu #1A1F6E và #00B4D8. Chữ có dấu được chuyển thành đường nét vector. Có bản sáng/tối/đơn sắc, PNG trong suốt, favicon và biểu tượng ứng dụng.
- 86 ảnh chụp khác nhau, 258 biến thể WebP/JPEG; ảnh lớn rộng 1.920 px, không phóng vượt nguồn. 30 bìa bài viết và 6 ảnh bối cảnh ghép nối riêng. Tám người xây dựng Kể Nè dùng ảnh chữ viết tắt, không gán người mẫu thành chân dung thật.
- Vệt ảnh tại phần Con người dùng sáu phần tử tái sử dụng, giới hạn tần suất và tự thu hồi. Có nút bấm tương đương; giảm chuyển động sẽ tắt phần trang trí này.
- Cụm ảnh giới thiệu có một bộ điều khiển, nút trước/sau, chọn bước, phím mũi tên và nội dung đồng bộ.
- Carousel có một nguồn điều khiển thời gian; dừng khi bấm, hover, focus, ẩn trang hoặc giảm chuyển động. Thanh tiến trình đồng bộ cùng thời gian đó.
- Tách hiệu ứng ảnh, lật thẻ, reveal và pointer; gộp pointermove theo frame, không blur ảnh đã tải và không chạy vòng lặp khi rảnh.
- Sửa focus cửa sổ, khôi phục đúng phần tử sau SOS/đóng, dọn camera kể cả khi quyền truy cập được trả về muộn.
- Giữ tìm kiếm, bộ lọc, so sánh, lưu bài, đọc tập trung, phóng ảnh, giỏ dịch vụ, ưu đãi, lịch đã lưu, dữ liệu tài khoản và quyền xoá/xuất thông tin.

## Trạng thái kết nối

Đây là bộ mã giao diện tĩnh. Tài khoản, giỏ và yêu cầu hiện nằm trên thiết bị. Chưa có máy chủ tài khoản, lịch chuyên gia trực tiếp, thanh toán, gửi email/SMS hoặc phòng gọi tư vấn. Luồng lưu yêu cầu ghi pending_confirmation, paymentStatus not_processed và lịch requested; không tạo thông báo đã thu tiền hay đã được chuyên gia xác nhận. Trạng thái này được giải thích ở thao tác liên quan thay cho nhãn bài làm trên mọi trang.

Để nhận giao dịch thực cần kết nối máy chủ, tài khoản/lịch người cung cấp đã xác minh, thanh toán, thông báo và phòng gọi. Không dùng localStorage làm hệ thống hồ sơ sức khoẻ vận hành. Không tự tạo địa chỉ kinh doanh, điện thoại, bằng cấp hoặc đánh giá khách hàng.

## Kiểm tra

Chạy `node tests/check.cjs`, `node tests/runtime.cjs`, `node tests/offline.cjs` nếu có Node.js. Tổng 51 kiểm tra tự động: 32 logic/tài khoản, 10 vòng đời camera và trạng thái yêu cầu, 9 ngoại tuyến/ảnh. Báo cáo được lưu trong tests. Browser QA kiểm tra 12 trang và các khung 320, 390, 768, 1024 px; báo cáo ghi rõ các trạng thái đã thử.

Môi trường xem thử HTTP không có Web Crypto/Service Worker như localhost/HTTPS; hai phần này được kiểm tra bằng runtime có Web Crypto và VM. Không khẳng định đã kiểm thử mọi trình duyệt, thiết bị hoặc nhà cung cấp thanh toán thực.

## Tệp chính

| Tệp/thư mục | Vai trò |
|---|---|
| html_*.html, index.html | 12 trang và lối mở trang chủ |
| css_trangchu.css | CSS gốc, không đổi từng byte |
| css/kene-brand.css | Nhận diện và hiệu ứng V3 có phạm vi riêng |
| js/kene-data.js | Nội dung nhất quán, 8 thành viên, 8 dịch vụ, 30 bài viết |
| js/kene-runtime.js | Vòng đời camera, có kiểm thử độc lập |
| js/kene-experience.js, kene-scenes.js | Tương tác, chuyển động, cụm ảnh và vệt ảnh |
| img/brand | Logo SVG/PNG, favicon, biểu tượng |
| img/photos | Ảnh đáp ứng cục bộ |
| PHOTO_SOURCES.md, PHOTO_SOURCES.json | Nguồn, giấy phép và thông số ảnh |
| licenses | Giấy phép thư viện/font chữ |

Ảnh là minh hoạ; người trong ảnh không được gán danh tính thành viên, chuyên gia hoặc khách hàng Kể Nè. Thông tin mô hình và danh sách tám thành viên được đối chiếu từ tài liệu chính; tài liệu thiết kế website riêng chỉ dùng tham khảo. Giá 400.000đ/phiên và 2.400.000đ/gói (6 × 400.000đ) là mức tham khảo, cần xác nhận chi phí trước sử dụng.
