import type { ReactNode } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { Building2 } from 'lucide-react';
import { EmptyState, ErrorState } from '../ui';
import { PublicButton, PublicListingGrid } from './PublicLayout';

export function PublicQueryContent({ pending, error, empty, onRetry, retrying = false, columns = 3, imageAspectRatio = '4 / 3', children }: {
  pending: boolean; error: boolean; empty: boolean; onRetry: () => void; retrying?: boolean; columns?: 1 | 3 | 4; imageAspectRatio?: string; children: ReactNode;
}) {
  // A failed refetch must not masquerade as a successful empty list or current stock.
  if (error) return <ErrorState title="Chưa tải được danh sách phòng" description="Vui lòng thử lại sau ít phút."
    action={<PublicButton variant="outlined" color="inherit" disabled={retrying} onClick={onRetry}>{retrying ? 'Đang thử lại…' : 'Thử lại'}</PublicButton>} />;
  if (pending) return <Box role="status" aria-live="polite" aria-busy="true">
    <Typography color="text.secondary" sx={{ mb: 2 }}>Đang tải danh sách phòng…</Typography>
    <PublicListingGrid columns={columns}>{Array.from({ length: columns === 1 ? 2 : columns }, (_, i) => <Box key={i} aria-hidden="true" sx={{ minWidth: 0, display: 'flex', flexDirection: { xs: 'column', sm: columns === 1 ? 'row' : 'column' }, gap: 2 }}>
      <Skeleton animation={false} variant="rounded" sx={{ aspectRatio: imageAspectRatio, height: 'auto', width: { xs: '100%', sm: columns === 1 ? 216 : '100%' }, flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}><Skeleton animation={false} width="70%" height={32} /><Skeleton animation={false} width="45%" height={24} /></Box>
    </Box>)}</PublicListingGrid>
  </Box>;
  if (empty) return <EmptyState title="Chưa có phòng trống" description="Bạn có thể quay lại sau để xem các phòng mới." icon={<Building2 size={28} aria-hidden="true" />} />;
  return <>{children}</>;
}
