import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, Typography } from '@mui/material';
import { ArrowRight, Building2, ChevronDown, Image, Link2, MessageCircle, Wallet } from 'lucide-react';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { PublicLink } from '../../../app/router/PublicLink';
import { routePaths } from '../../../app/router/routePaths';
import { designTokens } from '../../../app/theme/tokens';
import { PublicIntakeForm } from '../../intake/PublicIntakeForm';
import { partnerBenefits, partnerFaqs, partnerSteps } from '../partnerContent';
import type { AppIdentity } from '../../auth/identityStore';
import { CtvToolsSection } from '../../affiliate/components/CtvToolsSection';

const heading = { fontSize: { xs: '1.5rem', md: '1.875rem' }, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-.025em' };
const frame = { border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden' };
const icons = [Building2, Link2, Wallet, Image];

export default function PartnerPage({ currentUser }: { currentUser: AppIdentity }) {
  return <PublicSurface><PublicContainer>
    <Stack sx={{ py: { xs: 3, md: 5 }, pb: { xs: 5, md: 7 }, gap: { xs: 5, md: 7 } }}>
      <Box component="section" aria-labelledby="partner-title" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 3, md: 5 }, alignItems: 'center' }}>
        <Stack sx={{ gap: 2.5, alignItems: 'flex-start' }}>
          <Typography sx={{ color: 'primary.main', fontWeight: 700, fontSize: '.8125rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Cộng tác viên Homelax</Typography>
          <Typography id="partner-title" component="h1" sx={{ fontSize: { xs: '1.8rem', sm: '2.25rem', lg: '2.75rem' }, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.035em' }}>Kết nối một nơi ở.<br /><Box component="span" sx={{ color: 'primary.main' }}>Mở thêm cơ hội thu nhập.</Box></Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>Đồng hành cùng Homelax, giới thiệu không gian sống phù hợp đến người đang tìm thuê. Có nguồn phòng để chia sẻ, công cụ hỗ trợ và thông tin hoa hồng để bạn theo dõi.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
            <Button component={PublicLink} to={`${routePaths.partner}#partner-registration`} variant="contained" endIcon={<ArrowRight size={18} />}>Đăng ký làm CTV ngay</Button>
            <Button component={PublicLink} to={`${routePaths.partner}#partner-consultation`} variant="outlined" startIcon={<MessageCircle size={18} />}>Tư vấn miễn phí</Button>
          </Stack>
        </Stack>
        <Box sx={{ ...frame, position: 'relative', minHeight: { xs: 260, sm: 340, md: 400 }, alignSelf: 'stretch' }}>
          <Box component="img" src="/images/partner-hero-bedroom.png" alt="Không gian phòng ở minh họa của Homelax" fetchPriority="high" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
      </Box>

      <CtvToolsSection currentUser={currentUser} />

      <Box component="section" aria-labelledby="partner-benefits">
        <Typography id="partner-benefits" component="h2" sx={{ ...heading, mb: 1 }}>Cùng bạn trên hành trình giới thiệu phòng</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Các công cụ dành cho CTV sau khi được duyệt và cấp quyền.</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2.5 }}>
          {partnerBenefits.map((item, index) => {
            const Icon = icons[index] ?? Building2;
            return <Box key={item.title} sx={{ ...frame, p: 2.5, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'inline-flex', p: 1.25, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '10px', mb: 2 }}><Icon size={24} aria-hidden="true" /></Box>
              <Typography component="h3" sx={{ fontSize: '1.0625rem', fontWeight: 700, mb: 1 }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>{item.description}</Typography>
            </Box>;
          })}
        </Box>
      </Box>

      <Box component="section" aria-labelledby="partner-policy" sx={{ ...frame, p: { xs: 3, md: 4 }, bgcolor: designTokens.colors.brand[50] }}>
        <Typography id="partner-policy" component="h2" sx={{ ...heading, mb: 2 }}>Rõ điều kiện, rõ cách ghi nhận hoa hồng</Typography>
        <Typography sx={{ lineHeight: 1.75, mb: 1.5 }}>Hoa hồng được tính theo chính sách áp dụng cho vị trí của bạn và khoản hoa hồng từ chủ nhà của từng giao dịch. Khách ký hợp đồng và đóng đủ cọc là điều kiện ghi nhận.</Typography>
        <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>Thanh toán một lần theo đợt ngày 1 và 15 sau khi đủ phê duyệt của quản trị viên và kế toán. Hãy trao đổi với Homelax để hiểu chính sách trước khi bắt đầu hợp tác.</Typography>
      </Box>

      <Box component="section" aria-labelledby="partner-steps">
        <Typography id="partner-steps" component="h2" sx={{ ...heading, mb: 3 }}>Bắt đầu cùng Homelax</Typography>
        <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
          {partnerSteps.map((step, index) => <Box component="li" key={step.title}>
            <Typography aria-hidden="true" sx={{ color: 'primary.main', fontSize: '2rem', fontWeight: 800, mb: 1 }}>0{index + 1}</Typography>
            <Typography component="h3" sx={{ fontSize: '1.125rem', fontWeight: 700, mb: 1 }}>{step.title}</Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>{step.description}</Typography>
          </Box>)}
        </Box>
      </Box>

      <Box component="section" aria-labelledby="partner-faq">
        <Typography id="partner-faq" component="h2" sx={{ ...heading, mb: 3 }}>Câu hỏi thường gặp</Typography>
        <Box sx={frame}>{partnerFaqs.map((faq, index) => <Accordion key={faq.question} disableGutters elevation={0} defaultExpanded={index === 0} sx={{ '&:before': { display: 'none' }, borderBottom: index < partnerFaqs.length - 1 ? '1px solid' : 0, borderColor: 'divider' }}>
          <AccordionSummary expandIcon={<ChevronDown size={20} />} id={`partner-faq-${index}-header`} aria-controls={`partner-faq-${index}-content`} sx={{ px: { xs: 2, md: 3 }, minHeight: 64 }}>
            <Typography component="h3" sx={{ fontSize: '1rem', fontWeight: 700 }}>{faq.question}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: 3 }}><Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>{faq.answer}</Typography></AccordionDetails>
        </Accordion>)}</Box>
      </Box>

      <Box component="section" aria-labelledby="partner-forms">
        <Typography id="partner-forms" component="h2" sx={{ ...heading, mb: 1 }}>Chọn bước tiếp theo của bạn</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Sẵn sàng hợp tác hoặc cần tìm hiểu thêm? Chọn một form phù hợp bên dưới.</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5, alignItems: 'start' }}>
          <Box id="partner-registration" sx={{ scrollMarginTop: 100, '& > section': { borderRadius: '12px' } }}>
            <PublicIntakeForm kind="collaborator_registration" />
          </Box>
          <Box id="partner-consultation" sx={{ scrollMarginTop: 100, '& > section': { borderRadius: '12px' } }}>
            <PublicIntakeForm kind="collaborator_consultation" />
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Đăng ký được tiếp nhận để xét duyệt. Tài khoản và quyền CTV do quản trị viên phê duyệt riêng.</Typography>
      </Box>

      <Box component="section" aria-labelledby="partner-system" sx={{ ...frame, p: { xs: 3, md: 4 }, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 3 }}>
          <Box>
            <Typography id="partner-system" component="h2" sx={{ ...heading, mb: 1 }}>Khám phá hệ thống Homelax</Typography>
            <Typography sx={{ fontSize: '1rem', lineHeight: 1.75 }}>Xem thông tin tòa nhà, hình ảnh và các phòng đang được đăng cho thuê.</Typography>
          </Box>
          <Button component={PublicLink} to={`${routePaths.search}?availability=available`} variant="contained" endIcon={<ArrowRight size={18} />} sx={{ flexShrink: 0 }}>Xem các tòa nhà</Button>
        </Stack>
      </Box>
    </Stack>
  </PublicContainer></PublicSurface>;
}
