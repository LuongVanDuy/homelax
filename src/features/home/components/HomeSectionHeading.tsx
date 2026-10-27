import { Box, Typography } from '@mui/material';
import { homeDesign as design } from '../homeDesign';

export function HomeSectionHeading({ title, eyebrow, description, id, dark = false }: {
  title: string; eyebrow: string; description?: string; id?: string; dark?: boolean;
}) {
  return <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ ...design.eyebrow, color: design.accent, mb: .75 }}>{eyebrow}</Typography>
    <Typography component="h2" id={id} sx={{ ...design.heading, color: dark ? '#FFF' : design.navy }}>{title}</Typography>
    {description && <Typography sx={{ ...design.body, color: dark ? '#CAD3DF' : design.muted, mt: 1 }}>{description}</Typography>}
  </Box>;
}
