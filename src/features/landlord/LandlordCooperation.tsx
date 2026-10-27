import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { ArrowRight, ChevronDown, Handshake } from 'lucide-react';
import { designTokens } from '../../app/theme/tokens';
import { landlordComparison, landlordFaqs, landlordSteps } from './landlordContent';

const heading = { fontSize: { xs: '1.5rem', md: '1.875rem' }, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-.025em' };
const body = { fontSize: '1rem', lineHeight: 1.75 };
const frame = { border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden' };

export function LandlordCooperation() {
  return <>
    <Box component="section" aria-labelledby="landlord-model">
      <Typography id="landlord-model" component="h2" sx={{ ...heading, mb: 3 }}>Mô hình hợp tác</Typography>
      <Box sx={{ ...frame, p: { xs: 3, md: 4 }, bgcolor: designTokens.colors.brand[50], mb: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 3, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '12px', p: 1.5, display: 'flex', flexShrink: 0 }}><Handshake size={26} aria-hidden="true" /></Box>
            <Box>
              <Typography component="h3" sx={{ fontSize: '1.25rem', fontWeight: 800, mb: 1 }}>Hợp tác tìm khách thuê</Typography>
              <Typography color="text.secondary" sx={{ ...body, maxWidth: 700 }}>Thêm một đối tác giới thiệu phòng và phối hợp lịch xem. Hai bên cùng trao đổi để thống nhất phạm vi hỗ trợ phù hợp với nhu cầu của chủ nhà.</Typography>
            </Box>
          </Stack>
          <Button component="a" href="#landlord-consultation" variant="contained" endIcon={<ArrowRight size={18} />} sx={{ flexShrink: 0 }}>Tư vấn phương án phù hợp</Button>
        </Stack>
      </Box>
      <TableContainer tabIndex={0} role="region" aria-label="So sánh tự cho thuê và hợp tác tìm khách thuê" sx={{ ...frame, bgcolor: 'background.paper', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
        <Table sx={{ minWidth: 620, tableLayout: 'fixed', '& td, & th': { p: { xs: 2, md: 2.5 }, verticalAlign: 'top', fontSize: '.9375rem', lineHeight: 1.65 }, '& tbody tr:last-child > *': { borderBottom: 0 } }}>
          <TableHead><TableRow>
            <TableCell scope="col" sx={{ width: '22%' }}>Tiêu chí</TableCell>
            <TableCell scope="col" sx={{ width: '39%' }}>Tự cho thuê</TableCell>
            <TableCell scope="col" sx={{ width: '39%', bgcolor: designTokens.colors.brand[50] }}>Hợp tác tìm khách thuê</TableCell>
          </TableRow></TableHead>
          <TableBody>{landlordComparison.map(row => <TableRow key={row.label}>
            <TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>{row.label}</TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>{row.self}</TableCell>
            <TableCell sx={{ bgcolor: designTokens.colors.brand[50] }}>{row.partner}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
    </Box>

    <Box component="section" aria-labelledby="landlord-process">
      <Typography id="landlord-process" component="h2" sx={{ ...heading, mb: 1 }}>Quy trình hợp tác</Typography>
      <Typography color="text.secondary" sx={{ ...body, mb: 3 }}>Từ nhu cầu ban đầu đến phương án phù hợp với tòa nhà của bạn.</Typography>
      <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
        {landlordSteps.map((step, index) => <Box component="li" key={step.title} sx={{ ...frame, p: 3, bgcolor: 'background.paper' }}>
          <Box aria-hidden="true" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 800, mb: 2 }}>{String(index + 1).padStart(2, '0')}</Box>
          <Typography component="h3" sx={{ fontWeight: 800, fontSize: '1.125rem', mb: 1 }}>{step.title}</Typography>
          <Typography sx={{ fontSize: '.8125rem', fontWeight: 700, mb: 1.5 }}>{step.timing}</Typography>
          <Typography color="text.secondary" sx={{ ...body, fontSize: '.9375rem' }}>{step.description}</Typography>
        </Box>)}
      </Box>
    </Box>

    <Box component="section" aria-labelledby="landlord-faq">
      <Typography id="landlord-faq" component="h2" sx={{ ...heading, mb: 3 }}>Câu hỏi thường gặp</Typography>
      <Box sx={{ ...frame, bgcolor: 'background.paper' }}>
        {landlordFaqs.map((faq, index) => <Accordion key={faq.question} disableGutters elevation={0} defaultExpanded={index === 0}
          sx={{ border: 0, borderRadius: '0 !important', borderBottom: index < landlordFaqs.length - 1 ? '1px solid' : 0, borderColor: 'divider', '&::before': { display: 'none' } }}>
          <AccordionSummary id={`landlord-faq-${index}-heading`} aria-controls={`landlord-faq-${index}-answer`} expandIcon={<ChevronDown size={20} />} sx={{ px: { xs: 2.5, md: 3 }, minHeight: 64 }}>
            <Typography sx={{ fontWeight: 700, pr: 2 }}>{faq.question}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2.5, md: 3 }, pb: 2.5, pt: 0 }}>
            <Typography color="text.secondary" sx={body}>{faq.answer}</Typography>
          </AccordionDetails>
        </Accordion>)}
      </Box>
    </Box>
  </>;
}
