import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router';
import { selectedSchoolIds } from '../../../app/router/publicSearch';
import { publicHref } from '../../../app/router/publicNavigation';
import { routeHref } from '../../../app/router/routePaths';
import { searchReturnState } from '../../../app/router/searchReturn';
import { PublicBuildingCard, PublicButton, PublicListingGrid } from '../../../components/public';
import { EmptyState, ErrorState } from '../../../components/ui';
import type { useBuildingDiscovery } from '../useBuildingDiscovery';

export function SearchBuildingResults({ discovery, columns = 3, showCards = true }: {
  discovery: ReturnType<typeof useBuildingDiscovery>; columns?: 1 | 3; showCards?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { search } = location;
  const { query, pending, items, total } = discovery;
  if (pending) return <Stack role="status" aria-live="polite" aria-busy="true" sx={{ gap: 2 }}>
    <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>Đang tìm tòa nhà…</Typography>
    {showCards && <PublicListingGrid columns={columns}>
      {Array.from({ length: columns === 1 ? 2 : 3 }, (_, index) => <Box key={index} aria-hidden="true"
        sx={{ minWidth: 0, display: 'flex', flexDirection: { xs: 'column', sm: columns === 1 ? 'row' : 'column' }, gap: 0,
          border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Skeleton animation={false} variant="rectangular" sx={{ width: { xs: '100%', sm: columns === 1 ? 216 : '100%' },
          aspectRatio: '3 / 2', height: 'auto', flexShrink: 0 }} />
        <Stack sx={{ p: 2.5, gap: 1, flex: 1 }}><Skeleton animation={false} width="72%" height={30} />
          <Skeleton animation={false} width="92%" height={22} /><Skeleton animation={false} width="48%" height={22} />
          <Skeleton animation={false} width="58%" height={28} sx={{ mt: 'auto' }} /></Stack>
      </Box>)}
    </PublicListingGrid>}
  </Stack>;
  if (query.isError) return <ErrorState title="Chưa tải được danh sách tòa nhà" description="Vui lòng thử lại sau ít phút."
    action={<PublicButton disabled={query.isFetching} onClick={() => void query.refetch()}>Thử lại</PublicButton>} />;
  if (total === 0) return <EmptyState title="Không tìm thấy tòa nhà phù hợp" description="Hãy thay đổi hoặc bỏ bớt bộ lọc." />;
  return <Stack sx={{ gap: 2 }}>
    <Typography role="status" sx={{ fontSize: '1rem' }}>Tìm thấy <strong>{total.toLocaleString('vi-VN')}</strong> tòa nhà</Typography>
    {showCards && <PublicListingGrid columns={columns}>
      {items.map((building, index) => {
        const href = publicHref(routeHref.building(building.code || building.id), search);
        return <PublicBuildingCard key={building.id} building={building} href={href} onNavigate={() => navigate(href, { state: searchReturnState(location) })} priority={index < 3} horizontal={columns === 1}
          details={discovery.filters.origin && building.originDistanceKm !== null
            ? <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>Cách địa chỉ đã chọn khoảng {building.originDistanceKm.toLocaleString('vi-VN')} km</Typography>
            : selectedSchoolIds(discovery.filters).length > 0 && building.nearestSchoolId && building.nearestSchoolDistanceKm !== null
            ? <Typography sx={{ fontSize: 14, color: 'text.secondary', overflowWrap: 'anywhere' }}>
              Gần {building.nearestSchoolName}{building.nearestSchoolCampus ? ` - ${building.nearestSchoolCampus}` : ''}: {building.nearestSchoolDistanceKm.toLocaleString('vi-VN')} km
              {building.nearestSchoolEffectiveRadiusKm !== null && ` · Bán kính ${building.nearestSchoolEffectiveRadiusKm.toLocaleString('vi-VN')} km`}
            </Typography> : undefined} />;
      })}
    </PublicListingGrid>}
  </Stack>;
}
