import { useState } from 'react';
import { Box } from '@mui/material';
import { LandlordLanding } from '../LandlordLanding';
import { LandlordCooperation } from '../LandlordCooperation';
import type { LandlordRole } from '../landlordContent';

export default function LandlordPage() {
  // Role buttons in the pain-point cards preselect the consultation form.
  const [role, setRole] = useState<LandlordRole | ''>('');
  return <Box sx={{ bgcolor: '#FFF', typography: 'body1' }}>
    <LandlordLanding onChooseRole={setRole} />
    <LandlordCooperation role={role} />
  </Box>;
}
