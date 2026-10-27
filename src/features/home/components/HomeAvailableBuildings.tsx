import { useLocation, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { Box, Stack } from '@mui/material';
import { publicHref } from '../../../app/router/publicNavigation';
import { routeHref } from '../../../app/router/routePaths';
import { PublicBuildingCard, PublicButton, PublicContainer, PublicListingGrid, PublicQueryContent } from '../../../components/public';
import { HomeSectionHeading } from './HomeSectionHeading';
import type { useHomeBuildingsQuery } from '../api/homeBuildings';

type HomeQuery = Pick<ReturnType<typeof useHomeBuildingsQuery>, 'data' | 'isPending' | 'isError' | 'isFetching' | 'refetch'>;

export function HomeAvailableBuildings({ query }: { query: HomeQuery }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const items = query.data?.items || [];
  const moreHref = publicHref('/tim-phong?availability=available', search);
  return <PublicContainer><Box component="section" aria-label="Hệ thống tòa nhà còn phòng">
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 3 }}>
      <HomeSectionHeading eyebrow="Phòng trọ nổi bật" title="Hệ thống tòa nhà còn phòng" description="Khám phá các tòa nhà, căn hộ dịch vụ tại Hà Nội." />
      <PublicButton href={moreHref} variant="outlined" endIcon={<ChevronRight size={16} aria-hidden="true" />}>Xem thêm phòng</PublicButton>
    </Stack>
    <PublicQueryContent pending={query.isPending} error={query.isError} empty={items.length === 0} columns={3} imageAspectRatio="3 / 2"
      onRetry={() => void query.refetch()} retrying={query.isFetching}>
      <PublicListingGrid columns={3}>
        {items.map(building => {
          const href = publicHref(routeHref.building(building.code || building.id), search);
          return <PublicBuildingCard key={building.id} building={building} href={href} onNavigate={() => navigate(href)} />;
        })}
      </PublicListingGrid>
    </PublicQueryContent>
  </Box></PublicContainer>;
}
