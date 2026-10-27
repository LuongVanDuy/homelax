import { useId } from 'react';
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { publicHref } from '../../../app/router/publicNavigation';
import { routeHref, routePaths } from '../../../app/router/routePaths';
import { PublicBuildingCard } from '../../../components/public';
import { useBuildingsPageQuery } from '../../buildings/api';

export function RoomAreaBuildings({ buildingId, ward, search }: { buildingId: string; ward: string; search: string }) {
  const titleId = useId();
  const area = ward.trim();
  const query = useBuildingsPageQuery({
    scope: 'public', status: 'active', availability: 'available', ward: area,
    page: 1, pageSize: 4, sort: 'updatedAt', order: 'desc',
  }, Boolean(area));
  const buildings = (query.data?.items || []).filter(item => item.id !== buildingId).slice(0, 3);
  const params = new URLSearchParams({ ward: area, availability: 'available' });
  const searchHref = publicHref(area ? `${routePaths.search}?${params}` : routePaths.search, search);
  const grid = { display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 };

  return <Box component="section" aria-labelledby={titleId} sx={{ mt: { xs: 4, md: 5 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ mb: 2, gap: 1.5, justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
      <Box>
        <Typography id={titleId} component="h2" sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800 }}>Các tòa nhà cùng khu vực</Typography>
        {area && <Typography sx={{ mt: 0.5, fontSize: 14, color: 'text.secondary' }}>Các tòa đang còn phòng tại {area}.</Typography>}
      </Box>
      <Button component={RouterLink} to={searchHref} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' }, flexShrink: 0 }}>
        {area ? 'Xem thêm trong khu vực' : 'Tìm tòa nhà khác'}
      </Button>
    </Stack>
    {!area ? <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Typography color="text.secondary">Chưa có thông tin xã/phường để tìm tòa nhà cùng khu vực.</Typography>
    </Paper> : query.isPending ? <Box sx={grid} aria-label="Đang tải tòa nhà cùng khu vực" aria-busy="true">
      {[0, 1, 2].map(index => <Skeleton key={index} variant="rounded" height={320} sx={{ borderRadius: 3 }} />)}
    </Box> : query.isError ? <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 700 }}>Chưa tải được các tòa nhà cùng khu vực</Typography>
      <Button variant="outlined" sx={{ mt: 1.5 }} disabled={query.isFetching} onClick={() => void query.refetch()}>Thử lại</Button>
    </Paper> : buildings.length ? <Box sx={grid}>
      {buildings.map(building => <PublicBuildingCard key={building.id} building={building}
        href={publicHref(routeHref.building(building.code || building.id), search)} />)}
    </Box> : <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Typography color="text.secondary">Hiện chưa có tòa nhà khác đang còn phòng trong khu vực này.</Typography>
    </Paper>}
  </Box>;
}
