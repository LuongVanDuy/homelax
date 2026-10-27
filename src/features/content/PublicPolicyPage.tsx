import { Box, Typography } from '@mui/material';
import { PublicContainer, PublicSurface } from '../../components/public';

/** Legal copy will be supplied separately; only approved titles are published. */
export function PublicPolicyPage({ title }: { title: string }) {
  return <PublicSurface><PublicContainer><Box sx={{ py: { xs: 4, md: 6 }, minHeight: '45vh' }}>
    <Typography component="h1" variant="h4" sx={{ fontWeight: 800 }}>{title}</Typography>
  </Box></PublicContainer></PublicSurface>;
}
