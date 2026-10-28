import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { homeSearchHref } from '../homeNavigation';
import { Box, ThemeProvider } from '@mui/material';
import { PublicButton, PublicSurface } from '../../../components/public';
import { Search } from 'lucide-react';
import { HomeMap, HomeMapIntro, HomeMapCanvas, type HomeMapOwnerType } from '../components/HomeMap';
import { homeDesign as design, homeTheme } from '../homeDesign';
import { HomeHero } from '../../../components/public/HomeHero';
import { PublicPriceFilter } from '../../../components/public/PublicPriceFilter';
import { HanoiWardSelect } from '../../locations/components/HanoiWardSelect';
import { PublicSchoolSelect } from '../../../components/public/PublicSchoolSelect';
import { HomeAvailableBuildings } from '../components/HomeAvailableBuildings';
import { HomeBrandValues } from '../components/HomeBrandValues';
import { HomeImpact, HomePartnership } from '../components/HomeImpactAndPartnership';
import { HomeNearbySchools } from '../components/HomeNearbySchools';
import { HomeConsultation } from '../components/HomeConsultation';
import { useHomeBuildingsQuery } from '../api/homeBuildings';
import { defaultPublicSearch, selectedSchoolIds } from '../../../app/router/publicSearch';
import { usePublicSearch } from '../../../app/router/usePublicSearch';
import { useBuildingMapQuery } from '../../discovery/api';
import { buildingMapParams } from '../../discovery/searchQuery';
import { SearchResultMap } from '../../discovery/components/SearchResultMap';
import type { SearchMapCamera } from '../../discovery/mapModel';
import type { PublicMapBounds } from '@tinyhouse/contracts';

export default function HomePage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [filters, updateSearch] = usePublicSearch();
  const { ward: searchWard, minPrice: searchMinPrice, maxPrice: searchMaxPrice } = filters;
  const schoolId = selectedSchoolIds(filters)[0] || 'all';
  const [mapWard, setMapWard] = useState('all');
  const [mapOwnerType, setMapOwnerType] = useState<HomeMapOwnerType>('tiny');
  const [mapRegion, setMapRegion] = useState<PublicMapBounds | null>(null);
  const mapCameraRef = useRef<SearchMapCamera | null>(null);

  const homeBuildingsQuery = useHomeBuildingsQuery();
  const homeMapFilters = useMemo(() => ({
    ...defaultPublicSearch,
    owner: mapOwnerType,
    ward: mapWard,
    availability: 'available',
    region: mapRegion,
  }), [mapOwnerType, mapWard, mapRegion]);
  const homeMapParams = useMemo(() => buildingMapParams(homeMapFilters, ''), [homeMapFilters]);
  const mapBuildingsQuery = useBuildingMapQuery(homeMapParams);
  const mapFilterKey = useMemo(() => JSON.stringify(homeMapParams), [homeMapParams]);

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(homeSearchHref(search));
  };

  return (
    <ThemeProvider theme={homeTheme}><Box sx={{ bgcolor: design.canvas, color: design.navy,
      '& .MuiButton-root': { fontSize: '.875rem', minHeight: 44 },
      // MUI scales a floating label to 75%; retain a rendered minimum of 14px.
      '& .MuiInputLabel-root': { fontSize: '1.166667rem' },
      '& .MuiOutlinedInput-notchedOutline legend': { fontSize: '.875rem' },
      '& .leaflet-control-attribution, & .pin-badge, & .pin-price': { fontSize: '14px' },
      '& .leaflet-popup-content :is(p, span, div, a)': { fontSize: '14px !important' },
      '& :is(a,button):focus-visible': { outline: `3px solid ${design.accent}`, outlineOffset: 3 },
      '@media (prefers-reduced-motion: reduce)': { '& *, & *::before, & *::after': { animation: 'none !important', transition: 'none !important' } },
    }}>
      <HomeHero imageSrc="/images/home-hero-bedroom.png">
        <PublicSurface>
          <Box component="form" onSubmit={handleSearchSubmit} aria-label="Tìm phòng nhanh"
            sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', lg: '1fr 1fr 1fr auto' }, gap: 2, alignItems: 'start' }}>
            <HanoiWardSelect value={searchWard} onChange={ward => updateSearch({ ward }, true)} />
            <PublicSchoolSelect value={schoolId} onChange={schoolId => updateSearch({ schoolId }, true)} />
            <PublicPriceFilter minPrice={searchMinPrice} maxPrice={searchMaxPrice}
              onChange={range => updateSearch(range, true)} />
            <PublicButton type="submit" startIcon={<Search size={18} aria-hidden="true" />}>Tìm kiếm</PublicButton>
          </Box>
        </PublicSurface>
      </HomeHero>

      <Box sx={{ mt: design.sectionGap }}>
        <HomeImpact />
      </Box>
      <Box sx={{ mt: design.sectionGap }}>
        <HomeMap>
          <HomeMapIntro ownerType={mapOwnerType} onOwnerTypeChange={setMapOwnerType} />
          <HomeMapCanvas ward={mapWard} onWardChange={setMapWard}>
            <SearchResultMap
              data={mapBuildingsQuery.data}
              pending={mapBuildingsQuery.isPending}
              error={mapBuildingsQuery.isError}
              onRetry={() => void mapBuildingsQuery.refetch()}
              filterKey={mapFilterKey}
              region={mapRegion}
              onRegionChange={setMapRegion}
              getSavedCamera={() => mapCameraRef.current}
              onCameraChange={camera => { mapCameraRef.current = camera; }}
              height={440}
              summaryPlacement="overlay-bottom-right"
            />
          </HomeMapCanvas>
        </HomeMap>
      </Box>
      <Box sx={{ mt: design.sectionGap }}>
        <HomeAvailableBuildings query={homeBuildingsQuery} />
      </Box>
      <Box sx={{ mt: design.sectionGap }}>
        <HomeNearbySchools />
      </Box>
      <Box sx={{ mt: design.sectionGap }}>
        <HomeBrandValues />
      </Box>
      <HomePartnership />
      <HomeConsultation />
    </Box></ThemeProvider>
  );
}
