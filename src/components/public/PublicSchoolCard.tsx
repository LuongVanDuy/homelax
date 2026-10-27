import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { ArrowUpRight, School } from 'lucide-react';
import type { PublicSchool } from '@tinyhouse/contracts';
import { PublicLink } from '../../app/router/PublicLink';
import { designTokens as tokens } from '../../app/theme/tokens';
import { publicSchoolLabel } from '../../features/schools/schoolPresentation';

type SchoolCardData = Pick<PublicSchool, 'id' | 'name' | 'campus' | 'effectiveRadiusKm' | 'availableUnitCount'>;
const number = new Intl.NumberFormat('vi-VN');

export function PublicSchoolCard({ school }: { school: SchoolCardData }) {
  const query = new URLSearchParams({ schoolId: school.id, availability: 'available' });
  return <ButtonBase component={PublicLink} to={`/tim-phong?${query}`} aria-label={`Tìm phòng gần ${publicSchoolLabel(school)}`}
    sx={{ width: '100%', height: '100%', minHeight: 80, textAlign: 'left', justifyContent: 'space-between', gap: 1.5, p: 2,
      border: `1px solid ${tokens.colors.neutral[200]}`, borderRadius: '10px', bgcolor: '#FFF', boxShadow: '0 4px 20px rgba(16,29,48,.035)', color: 'text.primary', textDecoration: 'none',
      transition: 'background-color 180ms ease',
      '&.Mui-focusVisible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      '@media (hover: hover)': { '&:hover': { bgcolor: tokens.colors.neutral[50] }, '&:hover .school-arrow': { transform: 'translate(2px, -2px)' } },
    }}>
    <Box sx={{ width: 36, height: 40, flexShrink: 0, borderRadius: '8px', bgcolor: tokens.colors.neutral[50], color: 'primary.main', display: 'grid', placeItems: 'center' }}><School size={21} aria-hidden="true" /></Box>
    <Stack sx={{ minWidth: 0, gap: .25, flex: 1 }}>
      <Typography component="h3" sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{school.name}</Typography>
      {school.campus && <Typography sx={{ fontSize: '.875rem' }} color="text.secondary">{school.campus}</Typography>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '.875rem', lineHeight: 1.6, fontWeight: 500, color: school.availableUnitCount > 0 ? 'primary.main' : 'text.secondary' }}>
          {school.availableUnitCount > 0 ? `${number.format(school.availableUnitCount)} căn đang trống` : 'Chưa có căn trống'}
        </Typography>
        <Typography sx={{ fontSize: '.875rem', lineHeight: 1.6 }} color="text.secondary">Bán kính {number.format(school.effectiveRadiusKm)} km</Typography>
      </Box>
    </Stack>
    <Box className="school-arrow" sx={{ display: 'flex', flexShrink: 0, transition: 'transform 180ms ease', color: 'primary.main' }}>
      <ArrowUpRight size={16} aria-hidden="true" />
    </Box>
  </ButtonBase>;
}
