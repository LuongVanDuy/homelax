import { useId } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ArrowRight, Building2 } from 'lucide-react';
import { PublicLink } from '../../../app/router/PublicLink';
import { PublicContainer } from '../../../components/public';
import { homeBriefMetrics } from '../homeContent';
import { homeDesign as design } from '../homeDesign';
import { AnimatedMetric } from './AnimatedMetric';

export function HomeImpact() {
  return <Box component="section" aria-label="Quy mô Homelax" sx={{ bgcolor: design.navy, color: '#FFF', py: { xs: 3, md: 4 } }}>
      <PublicContainer>
          <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', m: 0 }}>
            {homeBriefMetrics.map((metric, index) => <AnimatedMetric key={metric.label} {...metric} index={index} />)}
          </Box>
      </PublicContainer>
    </Box>;
}

export function HomePartnership() {
  const landlordTitleId = useId();
  return <Box component="section" aria-labelledby={landlordTitleId} sx={{ bgcolor: '#FFF', py: design.sectionPadding }}>
      <PublicContainer>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 3, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}>
          <Box>
            <Typography component="h2" id={landlordTitleId} sx={design.heading}>Bạn có tòa nhà muốn cho thuê?</Typography>
            <Typography sx={{ ...design.body, color: design.muted, mt: 1 }}>Đồng hành cùng Homelax để kết nối với người thuê.</Typography>
          </Box>
          <Button component={PublicLink} to="/chu-nha" variant="contained" startIcon={<Building2 size={18} aria-hidden="true" />} endIcon={<ArrowRight size={16} aria-hidden="true" />}
            sx={{ minHeight: 44, flexShrink: 0, px: 3 }}>Tìm hiểu thêm</Button>
        </Stack>
      </PublicContainer>
    </Box>;
}
