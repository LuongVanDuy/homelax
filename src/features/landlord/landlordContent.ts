import type { LandlordContent } from './LandlordLanding';

/** Editorial copy for F047–F050; user authorized creative wording on 2026-09-29. */
export const landlordContent: LandlordContent = {
  headline: 'Bạn có phòng trọ, chung cư mini muốn cho thuê?',
  introduction: 'Kết nối với Homelax để trao đổi nhu cầu và tìm phương án hợp tác phù hợp với tòa nhà của bạn.',
  audiences: [
    'Chủ nhà đang có phòng cần cho thuê',
    'Chủ nhà chuẩn bị đưa tòa nhà vào khai thác',
    'Chủ nhà muốn tìm đối tác hỗ trợ cho thuê',
  ],
  challenges: [
    'Tìm khách thuê phù hợp với phòng và điều kiện cho thuê.',
    'Cập nhật thông tin phòng và theo dõi lịch hẹn xem phòng.',
    'Dành thời gian trao đổi và dẫn khách xem phòng.',
  ],
  solutions: [
    'Giới thiệu thông tin phòng tới người đang tìm thuê.',
    'Tiếp nhận nhu cầu và phối hợp lịch xem phòng.',
    'Trao đổi phương án hợp tác theo tình trạng tòa nhà và nhu cầu của chủ nhà.',
  ],
};

/** FE07.7 approved scope: tenant sourcing; qualitative comparison, no fixed fees or SLA. */
export const landlordComparison = [
  { label: 'Công việc', self: 'Tự giới thiệu phòng, tiếp nhận liên hệ và sắp xếp lịch xem.', partner: 'Homelax hỗ trợ giới thiệu thông tin, tiếp nhận nhu cầu và phối hợp lịch xem.' },
  { label: 'Thu nhập', self: 'Phụ thuộc giá thuê thực tế, thời gian có khách và chi phí của chủ nhà.', partner: 'Cùng phụ thuộc kết quả cho thuê thực tế; chi phí hợp tác cần được trao đổi trước.' },
  { label: 'Dòng tiền', self: 'Chủ nhà chủ động theo dõi thời gian trống phòng và lịch thanh toán với khách.', partner: 'Lịch thanh toán và trách nhiệm của các bên được làm rõ khi trao đổi phương án hợp tác.' },
  { label: 'Rủi ro cần cân nhắc', self: 'Thời gian tìm khách, thông tin chưa đầy đủ và lịch hẹn thay đổi.', partner: 'Cần phối hợp cập nhật tình trạng phòng, giá thuê và điều kiện cho thuê để thông tin nhất quán.' },
  { label: 'Tiềm năng tiếp cận', self: 'Khai thác các kênh và nguồn khách do chủ nhà tự xây dựng.', partner: 'Thêm kênh giới thiệu phòng tới người tìm thuê trên hệ thống Homelax.' },
  { label: 'Nhu cầu phù hợp', self: 'Muốn trực tiếp thực hiện các công việc tìm khách và có thời gian theo sát.', partner: 'Muốn có thêm đối tác hỗ trợ tìm khách và phối hợp các lịch xem phòng.' },
] as const;

export const landlordSteps = [
  { title: 'Tiếp nhận nhu cầu', timing: 'Khi bạn gửi yêu cầu', description: 'Để lại họ tên, số điện thoại và nhu cầu tư vấn qua form hoặc chủ động liên hệ Zalo.' },
  { title: 'Trao đổi thông tin', timing: 'Sau khi tiếp nhận', description: 'Trao đổi về vị trí, tình trạng phòng, giá thuê dự kiến và mong muốn hợp tác của bạn.' },
  { title: 'Thống nhất phương án', timing: 'Trước khi triển khai', description: 'Làm rõ phạm vi hỗ trợ, chi phí, trách nhiệm và thời điểm bắt đầu phù hợp với hai bên.' },
  { title: 'Phối hợp triển khai', timing: 'Sau khi hai bên thống nhất', description: 'Chuẩn bị thông tin phòng, giới thiệu tới người tìm thuê và phối hợp lịch xem theo phương án đã thống nhất.' },
] as const;

export const landlordFaqs = [
  { question: 'Tôi cần chuẩn bị thông tin gì để được tư vấn?', answer: 'Bạn chỉ cần để lại họ tên và số điện thoại. Nếu thuận tiện, hãy ghi thêm địa chỉ tòa nhà, số phòng cần cho thuê và mong muốn hợp tác trong phần nhu cầu để Homelax có cơ sở trao đổi.' },
  { question: 'Tôi có cần tạo tài khoản để đăng ký tư vấn không?', answer: 'Không. Bạn có thể gửi form tư vấn ngay trên trang này mà không cần đăng nhập hoặc tạo tài khoản.' },
  { question: 'Homelax hỗ trợ chủ nhà những việc gì?', answer: 'Trong hình thức hợp tác tìm khách thuê, Homelax hỗ trợ giới thiệu thông tin phòng, tiếp nhận nhu cầu và phối hợp lịch xem. Phạm vi công việc cụ thể được trao đổi trước khi triển khai.' },
  { question: 'Chi phí hợp tác được xác định như thế nào?', answer: 'Bạn có thể đăng ký tư vấn miễn phí. Chi phí cho các công việc hợp tác cụ thể sẽ được trao đổi cùng phạm vi hỗ trợ, tình trạng phòng và nhu cầu của chủ nhà trước khi hai bên quyết định triển khai.' },
  { question: 'Bao lâu thì bắt đầu triển khai?', answer: 'Sau khi tiếp nhận, hai bên cần trao đổi thông tin và thống nhất phương án. Thời điểm bắt đầu sẽ được thống nhất dựa trên tình trạng phòng và mức độ sẵn sàng của chủ nhà.' },
  { question: 'Gửi yêu cầu có đồng nghĩa đã ký kết hợp tác không?', answer: 'Gửi form là bước đăng ký tư vấn. Homelax sẽ trao đổi thêm để hai bên làm rõ nhu cầu và phương án trước khi quyết định hợp tác.' },
] as const;
