import { Box, Button, Stack, Typography } from '@mui/material';
import { ArrowRight, Building2, CalendarDays, Check, Clock3, Home, KeyRound, MessageCircle, Phone, Users } from 'lucide-react';
import { TINY_HOUSES_PUBLIC_CONTACT } from '@tinyhouse/contracts';
import { PublicContainer, PublicSurface } from '../../components/public';
import { PublicIntakeForm } from '../intake/PublicIntakeForm';
import { designTokens } from '../../app/theme/tokens';
import { PublicLink } from '../../app/router/PublicLink';
import { routePaths } from '../../app/router/routePaths';
import { LandlordCooperation } from './LandlordCooperation';

export type LandlordContent = {
  headline: string;
  introduction: string;
  audiences: readonly string[];
  challenges: readonly string[];
  solutions: readonly string[];
};

const heading = { fontSize: { xs: '1.5rem', md: '1.875rem' }, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-.025em' };
const body = { fontSize: '1rem', lineHeight: 1.75 };
const eyebrow = { fontSize: '.8125rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' };
const frame = { border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden' };
const audienceIcons = [KeyRound, Building2, Users];
const challengeIcons = [Users, CalendarDays, Clock3];

/** FE07.6 layout accepts approved editorial copy; no operational claims are calculated here. */
export function LandlordLanding({ content }: { content: LandlordContent }) {
  return <PublicSurface>
    <PublicContainer>
      <Stack sx={{ py: { xs: 3, md: 5 }, pb: { xs: 5, md: 7 }, gap: { xs: 5, md: 7 } }}>
        <Box component="section" aria-labelledby="landlord-title" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'center', gap: { xs: 3, md: 5 } }}>
          <Stack sx={{ gap: 2.5, alignItems: 'flex-start' }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
              <Box aria-hidden="true" sx={{ width: 28, height: 3, bgcolor: 'primary.main' }} />
              <Typography sx={eyebrow}>Hợp tác cùng Homelax</Typography>
            </Stack>
            <Typography id="landlord-title" component="h1" sx={{ fontSize: { xs: '1.8rem', sm: '2.25rem', lg: '2.75rem' }, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.035em' }}>{content.headline}</Typography>
            <Typography color="text.secondary" sx={body}>{content.introduction}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
              <Button component={PublicLink} to={`${routePaths.landlord}#landlord-consultation`} variant="contained" endIcon={<ArrowRight size={18} />}>Đăng ký tư vấn miễn phí</Button>
              <Button component="a" href={TINY_HOUSES_PUBLIC_CONTACT.zaloUrl} target="_blank" rel="noopener noreferrer" variant="outlined" color="secondary" startIcon={<MessageCircle size={18} />}>Nhắn Zalo ngay</Button>
            </Stack>
          </Stack>
          <Box sx={{ ...frame, position: 'relative', minHeight: { xs: 260, sm: 340, md: 400 }, alignSelf: 'stretch' }}>
            <Box component="img" src="/images/landlord-hero-bedroom.png" alt="Không gian phòng cho thuê minh họa" fetchPriority="high" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
        </Box>

        <Box component="section" aria-labelledby="landlord-audience">
          <Typography sx={{ ...eyebrow, color: 'text.secondary', mb: 1 }}>Bạn là</Typography>
          <Typography id="landlord-audience" component="h2" sx={{ ...heading, mb: 3 }}>Đối tượng phù hợp</Typography>
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
            {content.audiences.map((audience, index) => {
              const Icon = audienceIcons[index] ?? Home;
              return <Box component="li" key={audience} sx={{ ...frame, p: 3, bgcolor: 'background.paper' }}>
                <Box sx={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', bgcolor: 'primary.main', color: 'primary.contrastText', mb: 2 }}><Icon size={24} aria-hidden="true" /></Box>
                <Typography sx={{ ...body, fontWeight: 600 }}>{audience}</Typography>
              </Box>;
            })}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
          <Box component="section" aria-labelledby="landlord-challenges" sx={{ ...frame, p: { xs: 3, md: 4 }, bgcolor: 'background.paper' }}>
            <Typography id="landlord-challenges" component="h2" sx={{ ...heading, mb: 3 }}>Những khó khăn phổ biến của chủ nhà</Typography>
            <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0, gap: 2.5 }}>
              {content.challenges.map((challenge, index) => {
                const Icon = challengeIcons[index] ?? Home;
                return <Stack component="li" key={challenge} direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ color: 'text.secondary', pt: .5, flexShrink: 0 }}><Icon size={22} aria-hidden="true" /></Box>
                  <Typography sx={body}>{challenge}</Typography>
                </Stack>;
              })}
            </Stack>
          </Box>
          <Box component="section" aria-labelledby="landlord-solutions" sx={{ ...frame, p: { xs: 3, md: 4 }, bgcolor: designTokens.colors.brand[50] }}>
            <Typography id="landlord-solutions" component="h2" sx={{ ...heading, mb: 3 }}>Homelax làm gì cho bạn</Typography>
            <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0, gap: 2.5 }}>
              {content.solutions.map(solution => <Stack component="li" key={solution} direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ mt: .5, display: 'flex', p: .5, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0 }}><Check size={16} aria-hidden="true" /></Box>
                <Typography sx={body}>{solution}</Typography>
              </Stack>)}
            </Stack>
          </Box>
        </Box>

        <LandlordCooperation />

        <Box id="landlord-consultation" sx={{ scrollMarginTop: 100, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 3, md: 5 }, alignItems: 'center' }}>
          <Box>
            <Typography component="h2" sx={{ ...heading, mb: 2 }}>Trao đổi cùng Homelax</Typography>
            <Typography color="text.secondary" sx={{ ...body, mb: 3 }}>{content.introduction}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: 'flex-start' }}>
              <Button component="a" href={`tel:${TINY_HOUSES_PUBLIC_CONTACT.phone}`} variant="outlined" color="secondary" startIcon={<Phone size={18} />}>Gọi {TINY_HOUSES_PUBLIC_CONTACT.phone}</Button>
              <Button component="a" href={TINY_HOUSES_PUBLIC_CONTACT.zaloUrl} target="_blank" rel="noopener noreferrer" variant="outlined" color="secondary" startIcon={<MessageCircle size={18} />}>Nhắn Zalo ngay</Button>
            </Stack>
          </Box>
          <PublicIntakeForm kind="landlord_consultation" />
        </Box>

        <Box component="section" aria-labelledby="landlord-system" sx={{ ...frame, p: { xs: 3, md: 4 }, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 3 }}>
            <Box>
              <Typography id="landlord-system" component="h2" sx={{ ...heading, mb: 1 }}>Khám phá hệ thống Homelax</Typography>
              <Typography sx={body}>Xem thông tin tòa nhà, hình ảnh và các phòng đang được đăng cho thuê.</Typography>
            </Box>
            <Button component={PublicLink} to={`${routePaths.search}?availability=available`} variant="contained" endIcon={<ArrowRight size={18} />} sx={{ flexShrink: 0 }}>Xem các tòa nhà</Button>
          </Stack>
        </Box>
      </Stack>
    </PublicContainer>
  </PublicSurface>;
}
