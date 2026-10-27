import { Box, Stack, Typography } from '@mui/material';
import { Check, FileText, Heart, Shield } from 'lucide-react';
import { PublicContainer } from '../../../components/public';
import { homeBrandIntroduction, homeBrandValues } from '../homeContent';
import { homeDesign as design } from '../homeDesign';
import { HomeSectionHeading } from './HomeSectionHeading';

const icons = [FileText, Shield, Heart];

export function HomeBrandValues() {
  return <Box component="section" aria-label="Tại sao chọn Homelax?" sx={{ bgcolor: design.navy, py: design.sectionPadding }}>
    <PublicContainer>
      <Box sx={{ maxWidth: 720, mb: 4 }}><HomeSectionHeading eyebrow="Cam kết của Homelax" title="Tại sao chọn Homelax?" description={homeBrandIntroduction} dark /></Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
        {homeBrandValues.map((value, index) => {
          const Icon = icons[index];
          return <Stack key={value.title} sx={{ minWidth: 0, gap: 1.5, p: { xs: 3, md: 4 }, bgcolor: '#FFF', borderRadius: design.radius, borderTop: `4px solid ${design.accent}` }}>
            <Box sx={{ width: 56, height: 56, display: 'grid', placeItems: 'center', bgcolor: design.navy, color: '#FFF', borderRadius: 2 }}><Icon size={30} strokeWidth={1.8} aria-hidden="true" /></Box>
            <Typography component="h3" sx={design.subheading}>{value.title}</Typography>
            <Typography color="text.secondary" sx={{ ...design.body, minHeight: { md: 48 } }}>{value.lead}</Typography>
            <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0, gap: 1 }}>
              {value.points.map(point => <Stack key={point} component="li" direction="row" sx={{ alignItems: 'flex-start', gap: .75 }}>
                <Check size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 4, color: design.accent }} />
                <Typography sx={{ fontSize: '.875rem', lineHeight: 1.7, color: design.muted }}>{point}</Typography>
              </Stack>)}
            </Stack>
          </Stack>;
        })}
      </Box>
    </PublicContainer>
  </Box>;
}
