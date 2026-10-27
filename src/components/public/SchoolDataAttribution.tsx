import { Box, Link } from '@mui/material';

export function SchoolDataAttribution() {
  return <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
    Vị trí trường: <Link href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" color="inherit">© OpenStreetMap</Link>
    {' · '}<Link href="/data/hanoi-schools-osm-20261015.json" target="_blank" rel="noopener noreferrer" color="inherit">Nguồn dữ liệu</Link>
  </Box>;
}
