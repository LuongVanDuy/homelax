import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export function CmsPageHeader({ title, description, actions, navigation }: {
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  navigation?: ReactNode;
}) {
  return <Box sx={{ minWidth: 0 }}>
    {navigation && <Box sx={{ mb: 1 }}>{navigation}</Box>}
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.35 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .5, lineHeight: 1.6 }}>{description}</Typography>
      </Box>
      {actions && <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>{actions}</Stack>}
    </Stack>
  </Box>;
}
