import { Box, Button, Link, Stack, Typography } from '@mui/material';
import { ArrowRight, Building2, Mail, MapPin, MessageCircle, Phone, Search, Users } from 'lucide-react';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { publicSite } from '../../../components/public/publicSite';
import { PublicLink } from '../../../app/router/PublicLink';
import { routePaths } from '../../../app/router/routePaths';
import { PublicIntakeForm } from '../../intake/PublicIntakeForm';

const heading = { fontSize: { xs: '1.5rem', md: '1.875rem' }, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-.025em' };
const frame = { border: '1px solid', borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' };
const options = [
  { title: 'Bạn đang tìm phòng?', description: 'Xem tòa nhà, chọn căn phù hợp và đặt lịch xem ngay tại trang chi tiết phòng.', label: 'Tìm phòng cho thuê', to: routePaths.search, icon: Search },
  { title: 'Bạn là chủ nhà?', description: 'Tìm hiểu cách hợp tác và để lại nhu cầu để Homelax tư vấn.', label: 'Tư vấn hợp tác chủ nhà', to: `${routePaths.landlord}#landlord-consultation`, icon: Building2 },
  { title: 'Bạn muốn làm CTV?', description: 'Tìm hiểu chính sách, gửi đăng ký hoặc trao đổi thêm trước khi bắt đầu.', label: 'Tư vấn cộng tác viên', to: `${routePaths.partner}#partner-consultation`, icon: Users },
] as const;

export default function ContactPage() {
  return <PublicSurface><PublicContainer>
    <Stack sx={{ py: { xs: 3, md: 5 }, pb: { xs: 5, md: 7 }, gap: { xs: 4, md: 5 } }}>
      <Box>
        <Typography sx={{ color: 'primary.main', fontWeight: 700, fontSize: '.8125rem', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>Kết nối với Homelax</Typography>
        <Typography component="h1" sx={{ fontSize: { xs: '1.8rem', md: '2.75rem' }, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.035em', mb: 2 }}>Chúng tôi sẵn sàng lắng nghe bạn</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.75 }}>Bạn cần tìm phòng, trao đổi hợp tác hay có câu hỏi dành cho Homelax? Liên hệ trực tiếp hoặc để lại thông tin bên dưới.</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 3, md: 4 }, alignItems: 'start' }}>
        <Box component="section" aria-labelledby="contact-details" sx={{ ...frame, p: { xs: 2.5, sm: 3 } }}>
          <Typography id="contact-details" component="h2" sx={{ ...heading, mb: 3 }}>Thông tin liên hệ</Typography>
          <Stack sx={{ gap: 3 }}>
            {[
              { icon: Phone, label: 'Điện thoại', value: publicSite.phone, href: `tel:${publicSite.phone}` },
              { icon: Mail, label: 'Email', value: publicSite.email, href: `mailto:${publicSite.email}` },
            ].map(item => <Stack key={item.label} direction="row" sx={{ gap: 2, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', p: 1.25, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '10px', flexShrink: 0 }}><item.icon size={22} aria-hidden="true" /></Box>
              <Box sx={{ minWidth: 0 }}><Typography variant="body2" color="text.secondary">{item.label}</Typography>
                <Link href={item.href} underline="hover" color="text.primary" sx={{ fontWeight: 700, minHeight: 44, display: 'flex', alignItems: 'center', overflowWrap: 'anywhere' }}>{item.value}</Link>
              </Box>
            </Stack>)}
            <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', p: 1.25, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '10px', flexShrink: 0 }}><MapPin size={22} aria-hidden="true" /></Box>
              <Box><Typography variant="body2" color="text.secondary" sx={{ mb: .5 }}>Địa chỉ</Typography><Typography component="address" sx={{ fontStyle: 'normal', lineHeight: 1.75 }}>{publicSite.address}</Typography></Box>
            </Stack>
            <Button component="a" href={publicSite.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<MessageCircle size={18} />} sx={{ alignSelf: 'flex-start' }}>Nhắn Zalo với Homelax</Button>
          </Stack>
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{publicSite.company}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>Mã số thuế: {publicSite.taxCode}<br />Ngày cấp: {publicSite.issuedOn}<br />Người đại diện: {publicSite.representative}</Typography>
          </Box>
        </Box>
        <Box id="contact-form" sx={{ scrollMarginTop: 100, '& > section': { borderRadius: '12px' } }}>
          <PublicIntakeForm kind="general_contact" />
        </Box>
      </Box>

      <Box component="section" aria-labelledby="contact-options">
        <Typography id="contact-options" component="h2" sx={{ ...heading, mb: 3 }}>Tìm đúng thông tin bạn cần</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
          {options.map(option => <Stack key={option.title} sx={{ ...frame, p: 2.5, gap: 1.5 }}>
            <Box sx={{ color: 'primary.main' }}><option.icon size={26} aria-hidden="true" /></Box>
            <Typography component="h3" sx={{ fontSize: '1.125rem', fontWeight: 700 }}>{option.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, flexGrow: 1 }}>{option.description}</Typography>
            <Button component={PublicLink} to={option.to} variant="outlined" endIcon={<ArrowRight size={17} />} sx={{ alignSelf: 'flex-start' }}>{option.label}</Button>
          </Stack>)}
        </Box>
      </Box>
    </Stack>
  </PublicContainer></PublicSurface>;
}
