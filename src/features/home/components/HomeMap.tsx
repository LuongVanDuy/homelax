import { Box, ButtonBase, IconButton } from '@mui/material';
import { MapPin, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { PublicContainer } from '../../../components/public';
import { HanoiWardSelect } from '../../locations/components/HanoiWardSelect';
import { homeDesign as design } from '../homeDesign';
import { HomeSectionHeading } from './HomeSectionHeading';

export function HomeMap({ children }: { children: ReactNode }) {
  return <PublicContainer><Box component="section" aria-label="Bản đồ các tòa nhà" sx={{ p: 2, bgcolor: '#F0F4F8',
    border: '8px solid white', borderRadius: '20px', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '260px minmax(0, 1fr)' }, gap: 3, alignItems: 'center',
    boxShadow: design.shadow }}>{children}</Box></PublicContainer>;
}

export type HomeMapOwnerType = 'all' | 'tiny' | 'partner';

export function HomeMapIntro({ ownerType, onOwnerTypeChange }: { ownerType: HomeMapOwnerType; onOwnerTypeChange: (value: HomeMapOwnerType) => void }) {
  return <Box sx={{ minWidth: 0 }}>
    <HomeSectionHeading eyebrow="Tìm kiếm theo bản đồ" title="Bản đồ các tòa nhà" description="Khám phá vị trí các tòa nhà để tìm phòng gần khu vực bạn mong muốn." />
    <Box role="group" aria-label="Loại tòa nhà" sx={{ mt: 3, p: 1, bgcolor: '#FFF', borderRadius: design.radius,
      display: 'grid', gap: .5, width: 'fit-content', minWidth: 200, boxShadow: design.shadow }}>
      {([{ value: 'tiny', label: 'Tòa Homelax' }, { value: 'partner', label: 'Tòa đối tác' }] as const).map(option => {
        const active = ownerType === option.value;
        return <Box key={option.value} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 36px', gap: .5, alignItems: 'center' }}>
          <ButtonBase onClick={() => onOwnerTypeChange(option.value)} aria-pressed={active}
            sx={{ typography: 'button', fontFamily: theme => theme.typography.fontFamily, textTransform: 'none',
              minHeight: 44, px: 1.5, py: 1, gap: 1.25, justifyContent: 'flex-start', borderRadius: '8px',
              fontSize: '.875rem', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
              color: active ? 'primary.contrastText' : design.muted,
              bgcolor: active ? 'primary.main' : '#FFF',
              '&:hover': { bgcolor: active ? 'primary.dark' : design.canvas },
              '&.Mui-focusVisible': { outline: `2px solid ${design.accent}`, outlineOffset: 2 } }}>
            <MapPin size={22} aria-hidden="true" style={{ flexShrink: 0 }} />
            {option.label}
          </ButtonBase>
          {active && <IconButton onClick={() => onOwnerTypeChange('all')} color="primary"
            aria-label="Bỏ lọc loại tòa, hiển thị tất cả" title="Hiển thị tất cả tòa"
            sx={{ width: 36, height: 44, borderRadius: '8px' }}>
            <X size={18} aria-hidden="true" />
          </IconButton>}
        </Box>;
      })}
    </Box>
  </Box>;
}

export function HomeMapCanvas({ ward, onWardChange, children }: { ward: string; onWardChange: (ward: string) => void; children: ReactNode }) {
  return <Box sx={{ position: 'relative', minWidth: 0, isolation: 'isolate' }}>
    <Box sx={{
      mb: 1.5, ml: 'auto', width: { xs: '100%', sm: 260 },
      '& .MuiAutocomplete-root, & .MuiOutlinedInput-root': { height: 44, minHeight: 44 },
      '& .MuiOutlinedInput-root': { bgcolor: '#FFF', borderRadius: '8px', boxShadow: design.shadow },
      '& .MuiInputLabel-root': { display: 'none' },
      '& .MuiOutlinedInput-notchedOutline legend': { width: 0 },
    }}>
      <HanoiWardSelect label="Khu vực trên bản đồ" allLabel="Tất cả khu vực" value={ward} onChange={onWardChange} />
    </Box>
    {children}
  </Box>;
}
