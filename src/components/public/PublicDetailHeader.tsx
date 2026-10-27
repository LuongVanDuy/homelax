import type { ReactNode } from 'react';
import { Box, Breadcrumbs, Paper, Stack, Typography } from '@mui/material';
import { MapPin } from 'lucide-react';
import { Link as RouterLink } from 'react-router';

export function PublicDetailHeader({ breadcrumbs, title, address, badges, price, actions, notice }: {
  breadcrumbs: { label: string; href?: string }[];
  title: string; address: string; badges?: ReactNode; price: ReactNode; actions?: ReactNode; notice?: ReactNode;
}) {
  return <>
    <Breadcrumbs aria-label="Đường dẫn" sx={{ mb: 2, '& a': { color: 'text.secondary', textDecoration: 'none' } }}>
      {breadcrumbs.map((item, index) => item.href
        ? <RouterLink key={index} to={item.href}>{item.label}</RouterLink>
        : <Typography key={index} color="text.primary" sx={{ fontSize: 14, fontWeight: 600 }}>{item.label}</Typography>)}
    </Breadcrumbs>
    {notice}
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, justifyContent: 'space-between', alignItems: { md: 'flex-start' }, mb: 2.5 }}>
      <Box sx={{ minWidth: 0 }}>
        {badges && <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>{badges}</Stack>}
        <Typography component="h1" sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.2, fontWeight: 850, overflowWrap: 'anywhere' }}>{title}</Typography>
        <Stack direction="row" sx={{ mt: 1.5, gap: 0.75, alignItems: 'flex-start', color: 'text.secondary' }}>
          <MapPin size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <Typography sx={{ fontSize: 15, overflowWrap: 'anywhere' }}>{address}</Typography>
        </Stack>
        {actions && <Stack direction="row" sx={{ mt: 1.5, gap: 1, flexWrap: 'wrap' }}>{actions}</Stack>}
      </Box>
      <Paper variant="outlined" sx={{ px: 2.25, py: 1.75, minWidth: { md: 230 }, borderRadius: 2.5 }}>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 700 }}>GIÁ THUÊ</Typography>
        <Typography component="div" sx={{ mt: 0.5, fontSize: { xs: 20, md: 23 }, color: 'primary.main', fontWeight: 850 }}>{price}</Typography>
      </Paper>
    </Stack>
  </>;
}
