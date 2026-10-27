import { Alert, Box, Button, Link as MuiLink, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { designTokens } from '../../../app/theme/tokens';
import { publicBrand } from '../../../app/theme/publicBrand';
import { RegisterForm } from '../components/RegisterForm';
import { LoginForm } from '../components/LoginForm';
import type { AppIdentity } from '../identityStore';
import { getPublicLoginDestination, getPublicReturnTo } from '../publicAccess';

export function PublicLoginPage({ user, sessionReady, sessionError, onRetry, registration = false }: {
  user: AppIdentity; sessionReady: boolean; sessionError: boolean; onRetry: () => void; registration?: boolean;
}) {
  const { search } = useLocation();
  if (sessionReady && !sessionError && user) {
    return <Navigate to={getPublicLoginDestination(user, search)} replace />;
  }
  const back = getPublicReturnTo(new URLSearchParams(search).get('returnTo')) || '/';
  return <PublicSurface><PublicContainer>
    <Box sx={{ maxWidth: { xs: 520, md: 1000 }, mx: 'auto', py: { xs: 2, sm: 4, md: 5 } }}>
      <Button component={Link} to={back} startIcon={<ArrowLeft size={17} />} color="secondary" sx={{ mb: 1.5, minHeight: 44, px: 0.5 }}>
        Quay lại
      </Button>
      <Paper variant="outlined" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: '0.9fr 1.1fr' },
        overflow: 'hidden', borderRadius: { xs: 3, sm: 4 }, borderColor: 'divider', boxShadow: '0 12px 40px rgba(15,23,42,0.06)' }}>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, position: 'relative', minHeight: 540,
          bgcolor: designTokens.colors.navy[900], color: 'common.white', p: 4, flexDirection: 'column', justifyContent: 'space-between' }}>
          <Box component="img" src="/images/home-hero-bedroom.png" alt="" aria-hidden="true"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '65% center' }} />
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,19,43,0.4) 0%, rgba(11,19,43,0.05) 35%, rgba(11,19,43,0.9) 100%)' }} />
          <Stack direction="row" spacing={1.25} sx={{ position: 'relative', alignItems: 'center' }}>
            <Box sx={{ width: 24, height: 3, bgcolor: publicBrand.orange, borderRadius: 1 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', color: 'inherit' }}>HOMELAX</Typography>
          </Stack>
          <Box sx={{ position: 'relative', maxWidth: 300 }}>
            <Typography component="p" sx={{ fontSize: 36, fontWeight: 700, lineHeight: 1.25, color: 'inherit', mb: 1.5 }}>Tìm một nơi<br />để gọi là nhà.</Typography>
            <Typography sx={{ fontSize: 15, lineHeight: 1.7, color: designTokens.colors.neutral[200] }}>Lưu căn yêu thích, đặt lịch xem và tìm không gian phù hợp với bạn.</Typography>
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2.5, sm: 5 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <Typography component="h1" variant="h4" sx={{ fontSize: { xs: 28, sm: 30 }, fontWeight: 800, letterSpacing: '-0.025em', mb: 1 }}>{registration ? 'Tạo tài khoản' : 'Đăng nhập'}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3.5, fontSize: 15, lineHeight: 1.6 }}>{registration ? 'Bắt đầu tìm không gian sống của bạn.' : 'Chào mừng bạn trở lại Homelax.'}</Typography>
        {!sessionReady ? <Stack role="status" aria-label="Đang kiểm tra phiên đăng nhập" spacing={2}>
          <Skeleton height={50} variant="rounded" /><Skeleton height={50} variant="rounded" /><Skeleton height={50} variant="rounded" />
        </Stack> : sessionError ? <Stack spacing={2}>
          <Alert severity="warning">Chưa thể kiểm tra phiên đăng nhập. Vui lòng thử lại.</Alert>
          <Button variant="outlined" onClick={onRetry} sx={{ minHeight: 44 }}>Thử lại</Button>
        </Stack> : <Stack spacing={3}>
          {registration ? <RegisterForm /> : <LoginForm audience="public" />}
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 0.75 }}>
            <Typography component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>{registration ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</Typography>
            <MuiLink component={Link} to={`${registration ? '/dang-nhap' : '/dang-ky'}${search}`} color="secondary" underline="hover"
              sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 700, textUnderlineOffset: '4px' }}>
              {registration ? 'Đăng nhập' : 'Đăng ký ngay'}
            </MuiLink>
          </Box>
        </Stack>}
        </Box>
      </Paper>
    </Box>
  </PublicContainer></PublicSurface>;
}
