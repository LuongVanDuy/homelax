import { phrases } from '../../lib/phrases';

/** CTV landing copy from the 2026-10-27 reference page; headings end with a colon per client feedback. */
export const partnerHero = {
  eyebrow: phrases('Hợp tác CTV | sale phòng | Homelax'),
  title: phrases('Giới thiệu | phòng ngay –'),
  highlight: phrases('Nhận hoa hồng | liền tay!'),
  description: 'Bạn có khách tìm phòng? Homelax có sẵn kho phòng tại Hà Nội, đội ngũ hỗ trợ dẫn khách và hệ thống theo dõi hoa hồng minh bạch.',
  note: 'Thời gian linh hoạt · Link Affiliate riêng · Theo dõi trực tuyến.',
} as const;

export const partnerBenefits = [
  { title: phrases('Kho phòng | đa dạng'), description: 'Dễ tìm phòng phù hợp với ngân sách và nhu cầu khách thuê.' },
  { title: phrases('Link Affiliate | riêng'), description: 'Mỗi CTV có link riêng để ghi nhận nguồn giới thiệu.' },
  { title: phrases('Thời gian | linh hoạt'), description: 'Chủ động giới thiệu phòng theo lịch cá nhân.' },
  { title: phrases('Đội ngũ | hỗ trợ'), description: 'Homelax phối hợp xác nhận lịch, tư vấn và dẫn khách.' },
  { title: phrases('Theo dõi | minh bạch'), description: 'Kiểm tra khách hàng, lịch hẹn và tiến độ giao dịch.' },
  { title: phrases('Hoa hồng | rõ ràng'), description: 'Theo dõi hoa hồng tạm tính, đã ghi nhận và đã thanh toán.' },
] as const;

export const partnerAudiences = [
  { title: 'Sinh viên', description: 'Tận dụng thời gian rảnh và mạng lưới bạn bè tìm trọ.' },
  { title: 'Freelancer', description: 'Linh hoạt tạo nguồn thu nhập theo kết quả.' },
  { title: phrases('Môi giới/Sale | BĐS'), description: 'Mở rộng nguồn phòng và cơ hội giao dịch.' },
  { title: phrases('Creator/Admin | cộng đồng'), description: 'Giới thiệu phòng đến cộng đồng đang có nhu cầu.' },
] as const;

export const partnerSteps = [
  { title: 'Đăng ký CTV', description: 'Chờ Homelax liên hệ & xác nhận tài khoản.' },
  { title: phrases('Lấy link | Affiliate'), description: 'Chọn phòng, sao chép link giới thiệu riêng.' },
  { title: phrases('Chia sẻ | cho khách'), description: 'Gửi qua Facebook, Zalo, Threads hoặc kênh cá nhân.' },
  { title: phrases('Khách | đặt lịch'), description: 'CMS ghi nhận nguồn CTV, Admin B2C xác nhận và cập nhật tiến độ.' },
  { title: 'Khách cọc/chốt', description: 'Hệ thống ghi nhận hoa hồng theo điều kiện; kế toán đối soát và thanh toán.' },
] as const;

export const partnerCommissionStages = [
  { title: 'Đã cọc', description: 'Hoa hồng tạm tính theo điều kiện chương trình.' },
  { title: 'Đã chốt', description: 'Admin xác nhận giao dịch và hệ thống ghi nhận hoa hồng đủ điều kiện.' },
  { title: 'Đã thanh toán', description: 'Kế toán cập nhật trạng thái chi trả và lịch sử đối soát.' },
] as const;

export const partnerFaqs = [
  { question: phrases('Có cần | kinh nghiệm?'), answer: 'Không bắt buộc; Homelax cung cấp thông tin phòng và hướng dẫn.' },
  { question: 'Ai dẫn khách?', answer: 'Bộ phận phụ trách phối hợp theo quy trình.' },
  { question: phrases('Làm sao biết | khách đặt lịch?'), answer: 'Theo dõi trong tài khoản CTV.' },
  { question: phrases('Khi nào | nhận hoa hồng?'), answer: 'Ngày 10 & 25 hàng tháng.' },
  { question: phrases('Khách đổi phòng | thì sao?'), answer: 'Lưu nguồn giới thiệu ban đầu; hưởng hoa hồng theo quy tắc xác nhận khách.' },
] as const;
