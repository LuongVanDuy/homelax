import { phrases } from '../../lib/phrases';

/** Landlord & operator landing copy from the 2026-10-29 reference design (AI Studio "Homelax Chủ nhà & Thầu"). */
export const landlordHero = {
  eyebrow: phrases('Dành cho chủ nhà | & đơn vị thầu | khai thác nhà cho thuê'),
  title: phrases('Thảnh thơi | sinh lời'),
  highlight: phrases('cùng Quản gia | Homelax'),
  description: 'Homelax mang đến giải pháp quản lý & vận hành tối ưu dành cho chủ nhà và đơn vị thuê thầu. Chúng tôi hỗ trợ quản lý cư dân, chăm sóc khách thuê, bảo trì tài sản, kiểm soát thu chi và hồ sơ thuế, giúp hoạt động cho thuê bài bản, giảm áp lực quản lý và hạn chế thất thoát.',
  benefits: [
    'Bớt cảnh bị khách gọi xử lý sự cố ngày đêm',
    'Hạn chế mất khách, mất uy tín vì vận hành kém',
    'Nắm rõ thu chi, công nợ và hồ sơ thuế',
  ],
  note: 'Trao đổi theo hiện trạng tòa nhà và nhu cầu thực tế, chưa cần quyết định hợp tác.',
  imageCaption: 'Đồng hành cùng chủ nhà & đơn vị thầu tại Hà Nội',
  pillars: ['Chuẩn hóa', 'Minh bạch', 'Đồng hành', 'Bền vững'],
} as const;

export const landlordPainPoints = {
  eyebrow: '2 vai trò 1 bài toán vận hành',
  title: phrases('Bạn đang'),
  highlight: phrases('đau đầu | ở khâu nào?'),
  description: 'Chủ nhà cần giữ giá trị tài sản và bớt gánh nặng. Đơn vị thầu cần giữ khách thuê, uy tín và hiệu quả kinh doanh. Homelax bắt đầu từ đúng vấn đề của từng bên.',
  roles: [
    {
      label: '01 / Chủ sở hữu tài sản',
      title: phrases('Có nhà cho thuê, | nhưng lúc nào | cũng phải tự lo?'),
      description: 'Bạn muốn tài sản tạo dòng tiền, không phải tạo thêm một công việc toàn thời gian.',
      cta: 'Tôi là chủ nhà',
      role: 'owner',
      items: [
        { icon: 'home', title: phrases('Phòng trống, | doanh thu không đều'), description: 'Tự đăng tin, dẫn khách, xử lý phòng trống trong khi chi phí vận hành vẫn phát sinh.' },
        { icon: 'phone', title: phrases('Việc lớn nhỏ | tìm đến cả ngày'), description: 'Điện nước, hỏng hóc, phản ánh của cư dân đều cần bạn đứng ra xử lý.' },
        { icon: 'calculator', title: phrases('Thu chi | và tình trạng tài sản | khó nắm'), description: 'Tiền thuê, công nợ, sửa chữa nằm rải rác ở nhiều bảng và tin nhắn.' },
        { icon: 'shield', title: phrases('Lo ngại rủi ro | khi giao vận hành'), description: 'Muốn có người quản lý thay nhưng vẫn cần quyền kiểm soát, báo cáo và trách nhiệm rõ ràng.' },
      ],
    },
    {
      label: '02 / Đơn vị thầu, đơn vị khai thác',
      title: phrases('Phòng đã kín, | nhưng vận hành | vẫn làm bạn | mất tiền?'),
      description: 'Lấp đầy phòng mới là bước đầu. Giữ khách, giữ uy tín và kiểm soát chi phí mới là bài toán dài hạn.',
      cta: 'Tôi là đơn vị thầu khai thác',
      role: 'operator',
      items: [
        { icon: 'users', title: phrases('Khách thuê | không hài lòng, | khó giữ lâu'), description: 'Phản hồi chậm, trải nghiệm thiếu nhất quán khiến khách ngại tái ký, dễ chuyển đi.' },
        { icon: 'alert', title: phrases('Một sự cố nhỏ | có thể ảnh hưởng | uy tín'), description: 'Điện nước, vệ sinh, kỹ thuật không xử lý kịp khiến đơn vị khai thác bị phàn nàn.' },
        { icon: 'layers', title: phrases('Nhiều tòa nhà, | quy trình càng rối'), description: 'Nhân sự, lịch bảo trì, công nợ và việc bàn giao khó theo sát bằng cách làm thủ công.' },
        { icon: 'file', title: phrases('Sổ sách, hóa đơn | và thuế | gây áp lực'), description: 'Hoạt động kinh doanh cần dữ liệu thu chi, chứng từ rõ ràng để đối soát và phối hợp kê khai thuế.' },
      ],
    },
  ],
  conclusion: {
    before: 'Lấp đầy phòng mới chỉ là ',
    first: 'bước đầu',
    middle: '. Duy trì chất lượng dịch vụ, giữ chân khách thuê, kiểm soát chi phí và bảo vệ dòng tiền mới là ',
    second: 'bài toán dài hạn',
    after: ' mà cả chủ nhà lẫn đơn vị thầu cần giải quyết!',
  },
} as const;

export const landlordModel = {
  title: phrases('Quản gia | Homelax'),
  subtitle: phrases('Mô hình | quản lý | & vận hành | tối ưu'),
  highlight: '10+1',
  description: 'Homelax kết hợp con người, quy trình và công nghệ để giảm gánh nặng vận hành, hạn chế sai sót. Nhờ đó, chủ nhà và đơn vị thầu có thể kiểm soát hoạt động cho thuê minh bạch hơn, hạn chế thất thoát và nâng cao hiệu quả khai thác.',
  stats: [
    { value: '10', label: 'Nhân sự chuyên môn phối hợp' },
    { value: '01', label: 'Hệ thống phần mềm quản lý' },
  ],
  features: [
    { icon: 'users', title: phrases('Có nhân sự phụ trách | thay vì tự ôm việc'), description: 'Công việc được phân công đúng chuyên môn, giảm cảnh chủ nhà và đơn vị thầu phải tự xử lý mọi phát sinh.' },
    { icon: 'workflow', title: phrases('Quy trình rõ ràng | từ tiếp nhận | đến xử lý'), description: 'Phản ánh của cư dân được tiếp nhận, phân công và theo dõi, hạn chế chậm trễ làm mất uy tín.' },
    { icon: 'monitor', title: phrases('Dữ liệu tập trung, | hạn chế thất thoát'), description: 'Hợp đồng, công nợ và thu chi được quản lý có hệ thống, dễ theo dõi và đối soát.' },
    { icon: 'clipboard', title: phrases('Giao vận hành | nhưng vẫn nắm quyền'), description: 'Trách nhiệm, quyền phê duyệt và chế độ báo cáo được thống nhất rõ theo phạm vi hợp tác.' },
  ],
  cta: {
    title: phrases('Đừng để | một tòa nhà tốt | bị kéo lùi | bởi khâu vận hành!'),
    description: 'Homelax đồng hành cùng chủ nhà và đơn vị thầu tháo gỡ những điểm nghẽn trong quản lý cư dân, xử lý sự cố và kiểm soát dòng tiền.',
    label: 'Nhận tư vấn miễn phí',
  },
} as const;

export const landlordServiceGroups = {
  eyebrow: phrases('Dành cho chủ nhà | & đơn vị thầu | khai thác'),
  title: phrases('6 Nhóm Công Việc | Vận Hành | Thiết Yếu'),
  description: 'Không chỉ là tìm khách và lấp phòng. Từ quản lý cư dân, kỹ thuật đến đối soát thu chi và hồ sơ thuế, Homelax hỗ trợ những công việc phát sinh hằng ngày để chủ nhà an tâm hơn và đơn vị thầu khai thác vận hành bài bản hơn.',
  items: [
    { icon: 'users', title: phrases('Quản lý Cư dân | & Hợp đồng') },
    { icon: 'wrench', title: phrases('Kỹ thuật | & Bảo trì | Tài sản') },
    { icon: 'shield', title: phrases('An ninh, | An toàn | & PCCC') },
    { icon: 'scale', title: phrases('Hồ sơ Vận hành | & Phối hợp | Pháp lý') },
    { icon: 'landmark', title: phrases('Thu Chi, | Công Nợ | & Hỗ trợ Thuế') },
    { icon: 'trending', title: phrases('Khai thác Phòng | & Giữ chân | Khách thuê') },
  ],
  banner: {
    title: phrases('Chủ nhà | an tâm tài sản. | Đơn vị thầu | chủ động kinh doanh.'),
    highlight: phrases('Homelax | hỗ trợ vận hành, | chăm sóc khách thuê | và kiểm soát thu chi.'),
    label: 'Nhận tư vấn vận hành',
  },
} as const;

export const landlordCases = {
  eyebrow: 'Minh chứng xử lý công việc',
  title: phrases('Quy trình | vận hành | thực tế | & đánh giá | từ cư dân'),
  description: 'Mỗi yêu cầu hỗ trợ đều được ghi nhận, theo dõi tiến độ và đánh giá sau xử lý trên hệ thống. Minh bạch từng công việc, rõ ràng từng trách nhiệm, góp phần nâng cao chất lượng dịch vụ và trải nghiệm cư dân.',
  note: '* Dữ liệu vận hành thực tế được ghi nhận trong giai đoạn hoạt động dưới thương hiệu Tiny Houses, nay là Homelax.',
  items: [
    { id: '#01', code: 'PA144767', title: phrases('Xử lý | điều hòa | rò rỉ nước'), completedOn: '17/10/2026', rating: 5, comment: 'tuyệt' },
    { id: '#02', code: 'PA143567', title: phrases('Xử lý sự cố | nút thang máy | tầng 7'), completedOn: '12/10/2026', rating: 5, comment: '' },
    { id: '#03', code: 'PA142522', title: phrases('Hỗ trợ yêu cầu | về thời hạn | thanh toán tiền thuê'), completedOn: '04/10/2026', rating: 5, comment: '' },
  ],
} as const;

export const landlordValues = {
  eyebrow: 'Lợi ích theo đúng vai trò của bạn',
  title: phrases('Cùng 1 | Giải Pháp,'),
  highlight: phrases('2 Giá Trị | Thiết Thực'),
  columns: [
    {
      label: 'Dành cho chủ nhà',
      title: phrases('Yên tâm | về tài sản. | Chủ động | về dòng tiền.'),
      items: [
        { icon: 'home', title: phrases('Tài sản | được theo dõi | thường xuyên'), description: 'Có lịch kiểm tra, bảo trì và đầu mối tiếp nhận vấn đề phát sinh.' },
        { icon: 'file', title: phrases('Nắm rõ thu chi | và công nợ'), description: 'Dễ đối soát tiền thuê, phí dịch vụ và chi phí vận hành theo kỳ báo cáo.' },
        { icon: 'shield', title: phrases('Bớt việc | nhưng không mất | quyền kiểm soát'), description: 'Phạm vi trách nhiệm, các khoản cần phê duyệt và cách phối hợp được thống nhất rõ.' },
      ],
    },
    {
      label: phrases('Dành cho | đơn vị thầu / | đơn vị khai thác'),
      title: phrases('Giữ khách thuê. | Giữ uy tín. | Quản lý | có số liệu.'),
      items: [
        { icon: 'users', title: phrases('Trải nghiệm cư dân | nhất quán hơn'), description: 'Có kênh tiếp nhận phản hồi và quy trình xử lý, hỗ trợ duy trì quan hệ với khách thuê.' },
        { icon: 'wallet', title: phrases('Kiểm soát chi phí | và công nợ'), description: 'Theo dõi các khoản thu, chi và đầu việc phát sinh để hạn chế bỏ sót.' },
        { icon: 'receipt', title: phrases('Dữ liệu sẵn | cho đối soát, | kế toán và thuế'), description: 'Tổng hợp thông tin, chứng từ theo phạm vi hỗ trợ để giảm áp lực sổ sách khi vận hành nhiều phòng.' },
      ],
    },
  ],
} as const;

export const landlordSteps = {
  title: phrases('Tiếp Nhận | Vận Hành'),
  highlight: '4 Bước',
  description: 'Dù tòa nhà đang trống phòng hay đã kín khách, Homelax bắt đầu bằng việc hiểu cách bạn đang kinh doanh và xác định rõ phạm vi phối hợp.',
  items: [
    { title: 'Trao đổi nhu cầu', description: 'Chủ nhà hoặc đơn vị thầu chia sẻ loại hình, số phòng và vấn đề đang gặp trong vận hành.' },
    { title: 'Khảo sát hiện trạng', description: 'Rà soát tình hình phòng, cư dân, công nợ, kỹ thuật và cách quản lý đang áp dụng.' },
    { title: 'Thống nhất phương án', description: 'Làm rõ phạm vi công việc, người phụ trách, báo cáo, chi phí và quyền phê duyệt trước khi ký kết.' },
    { title: phrases('Bàn giao | & phối hợp vận hành'), description: 'Tiếp nhận dữ liệu, thống nhất quy trình xử lý và theo dõi kết quả theo lịch báo cáo đã thỏa thuận.' },
  ],
} as const;

export const landlordFaqs = {
  title: phrases('Chủ Nhà | & Đơn Vị Thầu | Thường Hỏi Gì?'),
  description: 'Những băn khoăn cần rõ trước khi giao tài sản hoặc một phần hoạt động vận hành cho đơn vị khác.',
  items: [
    { question: phrases('Homelax làm việc | với chủ sở hữu | hay cả đơn vị thầu | đang thuê khai thác?'), answer: 'Cả hai. Chủ nhà có thể cần một đơn vị hỗ trợ vận hành và bảo vệ tài sản. Đơn vị thầu hoặc doanh nghiệp khai thác có thể cần chuẩn hóa chăm sóc cư dân, kỹ thuật, thu chi và báo cáo. Phạm vi công việc sẽ được trao đổi theo hiện trạng và quyền hạn của từng bên.' },
    { question: phrases('Tòa nhà | đã kín phòng | thì có cần | dịch vụ vận hành không?'), answer: 'Lấp đầy phòng mới là bước đầu. Khi đã kín phòng, việc chăm sóc cư dân, xử lý sự cố, bảo trì và kiểm soát thu chi quyết định khả năng giữ khách và dòng tiền lâu dài. Homelax có thể hỗ trợ một phần hoặc toàn bộ các công việc này tùy nhu cầu.' },
    { question: phrases('Đơn vị thầu | có được hỗ trợ | sổ sách, hóa đơn | và khai thuế không?'), answer: 'Có. Thu chi, công nợ và hỗ trợ thuế là một trong 6 nhóm công việc vận hành. Homelax tổng hợp dữ liệu và chứng từ theo phạm vi hỗ trợ đã thống nhất để thuận tiện đối soát và phối hợp kê khai.' },
    { question: phrases('Khi giao vận hành, | ai quyết định | giá thuê | và khoản sửa chữa?'), answer: 'Quyền phê duyệt được thống nhất trước khi ký kết. Chủ nhà hoặc đơn vị thầu vẫn giữ quyền quyết định các khoản theo phạm vi đã thỏa thuận; Homelax đề xuất, thực hiện và báo cáo minh bạch.' },
    { question: phrases('Đang tự quản lý | thì chuyển sang Homelax | có xáo trộn | khách thuê không?'), answer: 'Homelax khảo sát hiện trạng, tiếp nhận dữ liệu và thống nhất quy trình xử lý trước khi bàn giao, để việc chuyển đổi diễn ra theo kế hoạch và hạn chế ảnh hưởng tới cư dân.' },
    { question: phrases('Homelax | có hỗ trợ tìm khách | khi có phòng trống | không?'), answer: 'Có. Khai thác phòng và giữ chân khách thuê là một trong 6 nhóm công việc Homelax hỗ trợ, bên cạnh quản lý cư dân, kỹ thuật và thu chi.' },
    { question: phrases('Chi phí hợp tác | và cách nhận báo cáo | được xác định | thế nào?'), answer: 'Chi phí, nội dung và lịch báo cáo được trao đổi theo loại hình, số phòng và phạm vi công việc, rồi thống nhất trước khi ký kết. Bạn có thể đăng ký tư vấn miễn phí để nhận phương án phù hợp.' },
  ],
} as const;

export const landlordContact = {
  title: phrases('Homelax - | Đơn vị hỗ trợ | quản lý vận hành | cho chủ nhà | và đơn vị thầu khai thác | tại Hà Nội'),
  hours: '08:00 – 21:00 (Thứ 2 – Chủ Nhật)',
  formTitle: phrases('Nhận Tư Vấn | Vận Hành | Phù Hợp'),
  formDescription: 'Bạn là chủ nhà hay đơn vị thầu đang khai thác? Chia sẻ vấn đề cần hỗ trợ để Homelax trao đổi phương án phù hợp với hiện trạng tòa nhà.',
  roles: { owner: 'Chủ nhà', operator: 'Đơn vị thầu / đơn vị khai thác' },
  propertyTypes: ['Chung cư mini', 'Nhà trọ / phòng trọ', 'Nhà nguyên căn', 'Khác'],
  privacy: 'Homelax bảo mật thông tin và chỉ liên hệ để tư vấn phương án theo yêu cầu của bạn.',
} as const;

export type LandlordRole = keyof typeof landlordContact.roles;
