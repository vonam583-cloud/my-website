# Thay đổi V3

Đã áp dụng logo riêng, footer thương mại thống nhất, bỏ thông tin lớp và mã sinh viên. Giữ đúng tám tên ở cả trang chủ và giới thiệu, dùng vai trò xây dựng sản phẩm và vận hành, không giới thiệu thành chuyên gia.

Ảnh được phân theo nội dung, tách mục nổi bật khỏi danh sách bài và tách khu vừa xem khỏi các ảnh trang chủ. Cụm ảnh giới thiệu dùng stage cố định, transform/opacity và một chỉ số trạng thái. Vệt ảnh dùng pool 6 phần tử, không tạo vô hạn DOM; giảm chuyển động hoặc ẩn trang sẽ dọn ngay.

Sửa các lỗi: camera trả quyền muộn sau khi đóng; focus bị chuyển sang nút SOS; khôi phục focus sau cửa sổ lồng; MutationObserver quét theo mọi ripple; nhiều nguồn điều khiển carousel; ảnh blur khi đã tải; pointer đọc/ghi layout theo từng sự kiện; bộ nhớ vừa xem sai kiểu; khung giờ có giây/mili giây; phản hồi biến lịch chờ huỷ thành hoàn tất; mất ý định đổi lịch/buổi gói khi cần sàng lọc lại; báo ngoại tuyến sẵn sàng dù worker cũ còn hoạt động.

CSS gốc được giữ nguyên. Báo cáo tài nguyên, nội dung, logic và browser QA có trong tests và IMAGE_PLACEMENT_AUDIT.json.
