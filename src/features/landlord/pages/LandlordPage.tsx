import { useState } from 'react';
import { Box } from '@mui/material';
import { LandlordLanding } from '../LandlordLanding';
import { LandlordCooperation } from '../LandlordCooperation';
import type { LandlordRole } from '../landlordContent';

export default function LandlordPage() {
  // Role buttons in the pain-point cards preselect the consultation form.
  const [role, setRole] = useState<LandlordRole | ''>('');
  // Balanced wrapping keeps headings and lead paragraphs from leaving a dangling last word.
  return <Box sx={{ bgcolor: '#FFF', typography: 'body1', '& h1, & h2, & h3': { textWrap: 'balance' }, '& p': { textWrap: 'pretty' } }}>
    <LandlordLanding onChooseRole={setRole} />
    <LandlordCooperation role={role} />
  </Box>;
}
