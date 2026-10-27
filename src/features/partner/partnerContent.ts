/** FE07.8 editorial copy grounded in D05 and the existing CTV workspace. */
export const partnerBenefits = [
  { title: 'Nguồn phòng để giới thiệu', description: 'Khám phá tòa nhà, loại phòng và căn còn trống cùng hình ảnh, giá thuê và tiện ích trên trang web.' },
  { title: 'liên kết giới thiệu riêng', description: 'Sau khi được cấp quyền CTV, sử dụng liên kết giới thiệu của bạn để khách tìm phòng và đặt lịch xem.' },
  { title: 'Theo dõi khách và hoa hồng', description: 'Xem khách được liên kết với bạn, tiến trình giao dịch và lịch sử hoa hồng trong tài khoản CTV.' },
  { title: 'Công cụ tạo ảnh giới thiệu', description: 'Tạo ảnh từ thông tin phòng và thêm số điện thoại của bạn bằng công cụ dành cho CTV.' },
] as const;

export const partnerSteps = [
  { title: 'Để lại thông tin', description: 'Gửi tên, số điện thoại và nhu cầu hợp tác của bạn.' },
  { title: 'Trao đổi và xét duyệt', description: 'Homelax liên hệ, trao đổi chính sách và xem xét đăng ký. Quản trị viên duyệt và cấp quyền CTV.' },
  { title: 'Bắt đầu giới thiệu phòng', description: 'Khi đã được cấp quyền, dùng liên kết giới thiệu và theo dõi khách, giao dịch, hoa hồng của bạn.' },
] as const;

export const partnerFaqs = [
  { question: 'Tôi cần có tài khoản trước khi đăng ký không?', answer: 'Không. Bạn có thể gửi đăng ký bằng tên và số điện thoại, nhu cầu là thông tin tùy chọn. Gửi form chỉ tạo yêu cầu để Homelax xem xét; tài khoản CTV cần được quản trị viên duyệt và cấp quyền riêng.' },
  { question: 'Tôi chưa rõ cách hợp tác, có thể được tư vấn trước không?', answer: 'Có. Chọn “Đăng ký tư vấn miễn phí” và để lại thông tin. Yêu cầu tư vấn được tiếp nhận riêng với yêu cầu đăng ký làm CTV.' },
  { question: 'Hoa hồng của tôi được tính như thế nào?', answer: 'Hoa hồng dựa trên khoản hoa hồng từ chủ nhà được ghi nhận cho giao dịch. Sau khấu trừ 10%, 90% còn lại là quỹ phân chia; phần CTV được tính theo tỷ lệ áp dụng cho vị trí của bạn. Thưởng CTV, nếu có, được cộng nguyên sau phần hoa hồng cơ bản. Đây không phải tỷ lệ trên giá thuê tháng và không có một mức cố định cho mọi CTV.' },
  { question: 'Khi nào giao dịch đủ điều kiện ghi nhận hoa hồng?', answer: 'Khách cần ký hợp đồng và đóng đủ cọc. Nếu hủy giao dịch hoặc thay đổi tiền cọc, khoản hoa hồng được xem xét theo số tiền thực thu hoặc được giữ lại của từng trường hợp.' },
  { question: 'Hoa hồng được thanh toán khi nào?', answer: 'Hoa hồng được trả một lần theo đợt ngày 1 và 15, sau khi có đủ phê duyệt của quản trị viên và kế toán. Bạn có thể theo dõi trạng thái hoa hồng trong tài khoản CTV được cấp quyền.' },
  { question: 'Tôi có thể theo dõi những thông tin nào?', answer: 'Tài khoản CTV được cấp quyền có thể xem khách được liên kết với mình, lịch xem, giao dịch và hoa hồng liên quan. Thông tin của CTV khác không nằm trong phạm vi truy cập của bạn.' },
] as const;
