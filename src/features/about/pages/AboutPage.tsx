import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowRight, Building2, Check, Compass, Eye, HeartHandshake, ShieldCheck, Target, Users } from 'lucide-react';
import { PublicLink } from '../../../app/router/PublicLink';
import { routePaths } from '../../../app/router/routePaths';
import { designTokens } from '../../../app/theme/tokens';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { aboutContent as content } from '../aboutContent';

const heading = { fontSize: { xs: '1.5rem', md: '1.875rem' }, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-.025em' };
const body = { fontSize: '1rem', lineHeight: 1.75 };
const eyebrow = { fontSize: '.8125rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' };
const frame = { border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden' };
const icons = [Eye, ShieldCheck, HeartHandshake];
const photo = '/images/home-hero-bedroom.png';
const iconStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, flexShrink: 0, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText' };

export default function AboutPage() {
  return <PublicSurface>
    <PublicContainer>
      <Stack sx={{ pt: { xs: 3, md: 4 }, pb: { xs: 5, md: 6 }, gap: { xs: 5, md: 6 } }}>
        <Box component="section" aria-labelledby="about-title" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 3, md: 5 }, alignItems: 'center' }}>
          <Stack sx={{ gap: 2.5, alignItems: 'flex-start', py: { md: 2 } }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
              <Box aria-hidden="true" sx={{ width: 28, height: 3, bgcolor: 'primary.main' }} />
              <Typography sx={eyebrow}>Về chúng tôi</Typography>
            </Stack>
            <Box>
              <Typography id="about-title" component="h1" className="about-hero-title" sx={{ fontSize: { xs: '2.25rem', lg: '3rem' }, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1.15 }}>{content.name}</Typography>
              <Typography sx={{ fontSize: { xs: '1.5rem', lg: '2rem' }, color: 'primary.main', fontWeight: 800, lineHeight: 1.35, mt: 1 }}>{content.headline.map(line => <Box component="span" key={line} sx={{ display: 'block' }}>{line}</Box>)}</Typography>
            </Box>
            <Typography color="text.secondary" sx={body}>{content.introduction}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
              <Button component={PublicLink} to={routePaths.search} variant="contained" endIcon={<ArrowRight size={18} />}>Khám phá phòng cho thuê</Button>
              <Button component={PublicLink} to={`${routePaths.about}#about-story`} variant="outlined" color="secondary">Câu chuyện của chúng tôi</Button>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: { xs: 1, lg: 2.5 }, width: '100%', mt: 1 }}>
              {content.values.map((value, index) => {
                const Icon = icons[index];
                return <Stack key={value.title} direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 1, alignItems: { xs: 'flex-start', lg: 'center' } }}>
                  <Box sx={iconStyle}><Icon size={22} aria-hidden="true" /></Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '.875rem' }}>{value.title}</Typography>
                </Stack>;
              })}
            </Box>
          </Stack>
          <Box sx={{ position: 'relative', minHeight: { xs: 280, sm: 360, md: 500 }, alignSelf: 'stretch', borderRadius: '12px', overflow: 'hidden', bgcolor: 'action.hover' }}>
            <Box component="img" src="/images/about-story-bedroom.png" alt="Không gian phòng ngủ minh họa - Không chỉ là phòng trọ, mà là tổ ấm" fetchPriority="high" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left center' }} />
          </Box>
        </Box>

        <Box component="section" aria-labelledby="about-story" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, .9fr) minmax(0, 1.1fr)' }, gap: { xs: 3, md: 5 }, alignItems: 'stretch' }}>
          <Box sx={{ alignSelf: 'start', position: 'relative', aspectRatio: { md: '1.08' }, borderRadius: '12px', overflow: 'hidden' }}>
            <Box component="img" src="/images/about-story-interior.png" alt="Không gian sống minh họa với thông điệp Good Rooms Better People" loading="lazy" width={1254} height={1254} sx={{ display: 'block', position: { md: 'absolute' }, inset: 0, width: '100%', height: { xs: 'auto', md: '100%' }, objectFit: 'cover', objectPosition: 'left center' }} />
          </Box>
          <Box>
            <Typography sx={{ ...eyebrow, color: 'primary.main', mb: 1 }}>Câu chuyện thương hiệu</Typography>
            <Typography id="about-story" component="h2" sx={{ ...heading, mb: 2, scrollMarginTop: 100 }}>{content.storyTitle}</Typography>
            <Stack spacing={1.5}>
              {content.story.map(paragraph => <Typography key={paragraph} color="text.secondary" sx={body}>{paragraph}</Typography>)}
            </Stack>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', m: 0, mt: 3 }}>
              {[['2024', 'Năm thành lập'], ['2029', 'Mốc tầm nhìn'], ['1.000.000', 'Mục tiêu phòng cho thuê']].map(([value, label], index) => <Box key={label} sx={{ textAlign: 'center', px: 1, borderLeft: index ? '1px solid' : 'none', borderColor: 'divider' }}>
                <Typography component="dt" sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, color: 'primary.main', fontWeight: 800 }}>{value}</Typography>
                <Typography component="dd" color="text.secondary" sx={{ m: 0, mt: .5, fontSize: '.8125rem', lineHeight: 1.5 }}>{label}</Typography>
              </Box>)}
            </Box>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="about-purpose">
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box aria-hidden="true" sx={{ width: 28, height: 3, bgcolor: 'primary.main', flexShrink: 0 }} />
            <Typography id="about-purpose" component="h2" sx={heading}>Sứ mệnh – Tầm nhìn – Giá trị cốt lõi</Typography>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
            <Box sx={{ ...frame, p: 3, bgcolor: designTokens.colors.brand[50], borderColor: alpha(designTokens.colors.brand[500], .08) }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ ...iconStyle, bgcolor: 'error.main' }}><Target size={24} aria-hidden="true" /></Box>
                <Typography component="h3" sx={{ fontSize: '1.125rem', fontWeight: 800 }}>Sứ mệnh</Typography>
              </Stack>
              <Typography sx={body}>{content.mission}</Typography>
            </Box>
            <Box sx={{ ...frame, p: 3, bgcolor: alpha(designTokens.colors.status.info, .06), borderColor: alpha(designTokens.colors.status.info, .08) }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ ...iconStyle, bgcolor: 'info.main' }}><Compass size={24} aria-hidden="true" /></Box>
                <Typography component="h3" sx={{ fontSize: '1.125rem', fontWeight: 800 }}>Tầm nhìn 2029</Typography>
              </Stack>
              <Typography sx={body}>{content.vision}</Typography>
            </Box>
            <Box sx={{ ...frame, p: 3, bgcolor: alpha(designTokens.colors.status.success, .07), borderColor: alpha(designTokens.colors.status.success, .08) }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ ...iconStyle, bgcolor: 'success.main' }}><ShieldCheck size={24} aria-hidden="true" /></Box>
                <Typography component="h3" sx={{ fontSize: '1.125rem', fontWeight: 800 }}>Giá trị cốt lõi</Typography>
              </Stack>
              <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0, gap: 1.5 }}>
                {content.values.map(value => <Stack key={value.title} component="li" direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ color: 'success.dark', flexShrink: 0, pt: .5 }}><Check size={18} aria-hidden="true" /></Box>
                  <Typography sx={{ ...body, fontSize: '.9375rem' }}><Box component="strong">{value.title}</Box> - {value.description}</Typography>
                </Stack>)}
              </Stack>
            </Box>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="about-activities" sx={{ ...frame, bgcolor: designTokens.colors.brand[50], p: { xs: 3, md: 4 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.4fr) repeat(2, minmax(0, .8fr))' }, gap: 3, alignItems: 'center' }}>
          <Box>
            <Typography sx={{ ...eyebrow, color: 'text.secondary', mb: 1 }}>Homelax</Typography>
            <Typography id="about-activities" component="h2" sx={{ ...heading, mb: 1.5 }}>Lĩnh vực hoạt động</Typography>
            <Typography color="text.secondary" sx={body}>{content.activities}</Typography>
          </Box>
          {[{ label: 'Hợp tác chủ nhà', to: routePaths.landlord, Icon: Building2 }, { label: 'Trở thành cộng tác viên', to: routePaths.partner, Icon: Users }].map(({ label, to, Icon }) => <Stack key={to} sx={{ alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ ...iconStyle, width: 56, height: 56 }}><Icon size={28} aria-hidden="true" /></Box>
            <Button component={PublicLink} to={to} color="secondary" endIcon={<ArrowRight size={17} />}>{label}</Button>
          </Stack>)}
        </Box>

        <Box component="section" aria-labelledby="about-find-room" sx={{ ...frame, position: 'relative', bgcolor: 'secondary.main', color: 'secondary.contrastText', p: { xs: 3, md: 5 }, isolation: 'isolate' }}>
          <Box component="img" src={photo} alt="" loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 65%', zIndex: -2 }} />
          <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, bgcolor: 'secondary.main', opacity: .82, zIndex: -1 }} />
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 3, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
            <Box sx={{ maxWidth: 600 }}>
              <Typography id="about-find-room" component="h2" sx={heading}>Tìm một không gian sống phù hợp với bạn</Typography>
              <Typography sx={{ ...body, mt: 1 }}>Khám phá phòng cho thuê tại Hà Nội cùng Homelax.</Typography>
            </Box>
            <Button component={PublicLink} to={routePaths.search} variant="contained" endIcon={<ArrowRight size={18} />} sx={{ flexShrink: 0 }}>Xem phòng ngay</Button>
          </Stack>
        </Box>
      </Stack>
    </PublicContainer>
  </PublicSurface>;
}
