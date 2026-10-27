import { Box, Button, Stack, Typography } from '@mui/material';
import { ArrowRight, ImagePlus, Users, Wallet } from 'lucide-react';
import { PublicLink } from '../../../app/router/PublicLink';
import type { AppIdentity } from '../../auth/identityStore';
import { canUseCtvTools, ctvToolPaths } from '../ctvTools';

export function CtvToolsSection({ currentUser }: { currentUser: AppIdentity }) {
  if (!canUseCtvTools(currentUser)) return null;
  return <Box component="section" aria-labelledby="ctv-tools-title" sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', p: { xs: 3, md: 4 }, borderRadius: '12px' }}>
    <Typography id="ctv-tools-title" component="h2" sx={{ fontSize: { xs: '1.5rem', md: '1.875rem' }, fontWeight: 800, mb: 1 }}>Không gian CTV của bạn</Typography>
    <Typography sx={{ mb: 3 }}>Theo dõi khách giới thiệu, xem hoa hồng và chuẩn bị ảnh để chia sẻ phòng.</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5 }}>
      {[
        { label: 'Khách của tôi', path: ctvToolPaths.customers, icon: Users },
        { label: 'Lịch sử hoa hồng', path: ctvToolPaths.commissions, icon: Wallet },
        { label: 'Tạo ảnh bán phòng', path: ctvToolPaths.salesImage, icon: ImagePlus },
      ].map(item => <Button key={item.path} component={PublicLink} to={item.path} variant="contained" startIcon={<item.icon size={18} />} endIcon={<ArrowRight size={17} />}>{item.label}</Button>)}
    </Stack>
  </Box>;
}
