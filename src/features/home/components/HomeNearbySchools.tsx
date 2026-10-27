import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { ChevronDown, GraduationCap } from 'lucide-react';
import { EmptyState, ErrorState } from '../../../components/ui';
import { PublicButton, PublicContainer } from '../../../components/public';
import { PublicSchoolCard } from '../../../components/public/PublicSchoolCard';
import { SchoolDataAttribution } from '../../../components/public/SchoolDataAttribution';
import { useHomeSchoolsQuery } from '../api/homeSchools';
import { homeDesign as design } from '../homeDesign';
import { HomeSectionHeading } from './HomeSectionHeading';

export function HomeNearbySchools() {
  const query = useHomeSchoolsQuery();

  const items = query.data?.items || [];
  return <PublicContainer><Box component="section" aria-label="Tìm phòng gần trường" sx={{ display: 'grid',
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, .75fr) minmax(0, 1.25fr)' }, gap: { xs: 3, lg: 4 }, alignItems: 'start' }}>
    <Box component="figure" sx={{ m: 0, position: 'relative', height: { xs: 220, lg: 440 }, borderRadius: design.radius, overflow: 'hidden', bgcolor: '#E2E8F0' }}>
      <Box component="img" src="/images/home-campus.png" alt="Khuôn viên Đại học Bách khoa Hà Nội" loading="lazy" decoding="async"
        sx={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }} />
      <Box component="figcaption" sx={{ position: 'absolute', inset: 'auto 0 0', p: 3, pt: 6, color: '#FFF', background: 'linear-gradient(transparent, rgba(16,29,48,.85))' }}>
        <Typography sx={{ ...design.subheading }}>Gần trường, thuận tiện mỗi ngày</Typography>
        <Typography sx={{ ...design.body, mt: .5, color: '#F1F5F9' }}>Tìm nơi ở phù hợp quanh các trường tại Hà Nội.</Typography>
      </Box>
    </Box>
    <Box sx={{ minWidth: 0, py: { lg: 1 } }}>
    <Box sx={{ mb: 3 }}><HomeSectionHeading eyebrow="Gần giảng đường" title="Tìm phòng gần trường" description="Chọn trường hoặc cơ sở để xem các phòng còn trống gần bạn." /></Box>
    {query.isError && !query.isFetchNextPageError ? <ErrorState title="Chưa tải được danh sách trường" description="Vui lòng thử lại sau ít phút."
      action={<PublicButton variant="outlined" disabled={query.isFetching} onClick={() => void query.refetch()}>
        {query.isFetching ? 'Đang thử lại…' : 'Thử lại'}
      </PublicButton>} />
      : query.isPending ? <Box role="status" aria-busy="true" aria-live="polite">
        <Typography color="text.secondary" sx={{ mb: 2 }}>Đang tải trường học…</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: design.gridGap }}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} aria-hidden="true" variant="rounded" animation={false} height={80} />)}</Box>
      </Box>
      : items.length === 0 ? <EmptyState title="Chưa có trường học khả dụng" description="Bạn có thể tìm phòng bằng bộ lọc ở đầu trang."
        icon={<GraduationCap size={28} aria-hidden="true" />} />
      : <>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: design.gridGap }}>{items.map(school => <PublicSchoolCard key={school.id} school={school} />)}</Box>
        <Stack sx={{ mt: 3, gap: 1, alignItems: 'center' }}>
          <Typography role="status" variant="body2" color="text.secondary">Đang hiển thị {items.length} / {query.data?.pagination.total || 0} trường</Typography>
          <SchoolDataAttribution />
          {query.isFetchNextPageError && <Typography role="alert" color="error">Chưa tải được thêm trường. Bạn có thể thử lại.</Typography>}
          {query.hasNextPage && <PublicButton variant="outlined" disabled={query.isFetching}
            endIcon={<ChevronDown size={18} aria-hidden="true" />} onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? 'Đang tải…' : query.isFetchNextPageError ? 'Thử tải thêm trường' : 'Xem thêm trường'}
          </PublicButton>}
        </Stack>
      </>}
    </Box>
  </Box></PublicContainer>;
}
