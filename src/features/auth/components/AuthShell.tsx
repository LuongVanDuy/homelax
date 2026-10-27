import type { ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import Logo from '../../../components/brand/Logo';
import { designTokens } from '../../../app/theme/tokens';

const { colors } = designTokens;

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <Box component="main" sx={{
      minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(360px, 44%) 1fr' },
      bgcolor: 'background.paper',
      '& a:focus-visible, & button:focus-visible': { outline: `3px solid ${colors.brand[500]}`, outlineOffset: 4 },
      '& input:focus': { boxShadow: 'none' },
      '@media (prefers-reduced-motion: reduce)': { '& *, & *::before, & *::after': { transition: 'none', animation: 'none' } },
    }}>
      <Box component="aside" sx={{
        display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', justifyContent: 'space-between',
        bgcolor: colors.navy[950], color: 'common.white', p: { lg: 5, xl: 7 }, overflow: 'hidden',
      }}>
        <Typography variant="overline" sx={{ color: colors.brand[200], letterSpacing: 3, fontWeight: 700 }}>
          HOMELAX / QUẢN TRỊ
        </Typography>
        <Box sx={{ py: 6, maxWidth: 480 }}>
          <Box sx={{ width: 40, height: 3, bgcolor: colors.brand[500], mb: 4 }} />
          <Typography component="p" sx={{ fontSize: { lg: 38, xl: 48 }, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.035em' }}>
            Quản lý tập trung.<br />Vận hành hiệu quả.
          </Typography>
          <Typography sx={{ color: colors.neutral[300], mt: 3, maxWidth: 340, lineHeight: 1.8 }}>
            Không gian làm việc dành cho đội ngũ quản lý và đối tác Homelax.
          </Typography>
          <Box component="svg" viewBox="0 0 440 190" aria-hidden="true" sx={{ width: '100%', mt: 6, display: 'block' }}>
            <g fill="none" stroke={colors.navy[700]} strokeWidth="1.5">
              <path d="M0 178H440M22 178V95L90 47L158 95V178M42 178V109L90 75L138 109V178M182 178V42H292V178M202 62H224V91H202ZM250 62H272V91H250ZM202 110H224V139H202ZM250 110H272V139H250ZM316 178V83L367 45L418 83V178M337 104H356V126H337ZM379 104H398V126H379Z" />
              <path d="M75 178V133H105V178M224 178V157H250V178M356 178V149H379V178" stroke={colors.brand[500]} />
            </g>
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: colors.neutral[400] }}>Kết nối không gian sống, đơn giản mỗi ngày.</Typography>
      </Box>

      <Stack sx={{ minWidth: 0, minHeight: '100dvh', px: { xs: 3, sm: 5, xl: 8 }, py: { xs: 2, sm: 4 } }}>
        <Button component={Link} to="/" color="secondary" startIcon={<ArrowLeft size={16} />} sx={{ alignSelf: 'flex-start', minHeight: 44, px: 0.5 }}>
          Về trang chủ
        </Button>
        <Box sx={{ width: '100%', maxWidth: 420, mx: 'auto', my: 'auto', py: { xs: 4, sm: 6 } }}>
          <Box sx={{ mb: 4 }}><Logo size={42} /></Box>
          {children}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 2 }}>Homelax · Hệ thống quản trị</Typography>
      </Stack>
    </Box>
  );
}
