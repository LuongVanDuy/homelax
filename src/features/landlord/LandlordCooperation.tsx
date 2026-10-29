import type { ReactNode } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Link, Stack, Typography } from '@mui/material';
import { ChevronDown, Clock3, ExternalLink, FileText, Home, Mail, MapPin, Phone, ReceiptText, ShieldCheck, Users, Wallet } from 'lucide-react';
import { TINY_HOUSES_PUBLIC_CONTACT } from '@tinyhouse/contracts';
import { PublicContainer } from '../../components/public';
import { publicSite } from '../../components/public/publicSite';
import { homeDesign as design } from '../home/homeDesign';
import { LandlordConsultationForm } from './LandlordConsultationForm';
import { landlordStyles as s } from './LandlordLanding';
import { landlordContact, landlordFaqs, landlordSteps, landlordValues, type LandlordRole } from './landlordContent';

const valueIcons = { home: Home, file: FileText, shield: ShieldCheck, users: Users, wallet: Wallet, receipt: ReceiptText } as const;
const mapQuery = encodeURIComponent(publicSite.address);
const formattedPhone = TINY_HOUSES_PUBLIC_CONTACT.phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

function Values() {
  return <Box component="section" aria-labelledby="landlord-values" sx={{ ...s.section, bgcolor: design.navy, color: '#FFF' }}>
    <PublicContainer>
      <Typography sx={s.eyebrow}>{landlordValues.eyebrow}</Typography>
      <Typography id="landlord-values" component="h2" sx={{ ...s.heading, mt: 1, color: '#FFF' }}>{landlordValues.title} <Box component="span" sx={{ color: design.accent }}>{landlordValues.highlight}</Box></Typography>
      <Box sx={{ mt: { xs: 4, md: 5 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
        {landlordValues.columns.map(column => <Box key={column.label} sx={{ p: { xs: 3, md: 4.5 }, borderRadius: '16px', bgcolor: '#1A3352', border: '1px solid rgba(255,255,255,.1)' }}>
          <Typography sx={s.eyebrow}>{column.label}</Typography>
          <Typography component="h3" sx={{ mt: 1.5, fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 800 }}>{column.title}</Typography>
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 3, gap: 3 }}>
            {column.items.map(item => {
              const Icon = valueIcons[item.icon as keyof typeof valueIcons] ?? Home;
              return <Stack component="li" key={item.title} direction="row" sx={{ gap: 2 }}>
                <Box sx={{ ...s.iconBox, bgcolor: 'rgba(237,90,35,.12)', borderColor: 'rgba(237,90,35,.3)' }}><Icon size={22} aria-hidden="true" /></Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.0625rem' }}>{item.title}</Typography>
                  <Typography sx={{ mt: .5, lineHeight: 1.7, color: '#CBD5E1' }}>{item.description}</Typography>
                </Box>
              </Stack>;
            })}
          </Stack>
        </Box>)}
      </Box>
    </PublicContainer>
  </Box>;
}

function Steps() {
  return <Box component="section" id="landlord-process" aria-labelledby="landlord-process-title" sx={{ ...s.section, bgcolor: '#FFF', scrollMarginTop: 80 }}>
    <PublicContainer>
      <Typography id="landlord-process-title" component="h2" sx={s.heading}><Box component="span" sx={{ color: design.accent, textTransform: 'uppercase' }}>{landlordSteps.highlight}</Box> {landlordSteps.title}</Typography>
      <Typography sx={{ ...s.body, mt: 2, maxWidth: 860 }}>{landlordSteps.description}</Typography>
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: { xs: 5, md: 7 }, position: 'relative', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 4, md: 3 },
        '&::before': { content: '""', display: { xs: 'none', md: 'block' }, position: 'absolute', top: 35, left: '12.5%', right: '12.5%', height: 2, bgcolor: design.border } }}>
        {landlordSteps.items.map((step, index) => <Box component="li" key={step.title} sx={{ position: 'relative', textAlign: 'center' }}>
          <Box sx={{ width: 70, height: 70, mx: 'auto', display: 'grid', placeItems: 'center', borderRadius: '50%', border: `2px solid ${design.accent}`, bgcolor: '#FFF', color: design.accent, fontWeight: 800, fontSize: '1.5rem', position: 'relative' }}>{index + 1}</Box>
          <Typography component="h3" sx={{ mt: 2.5, fontWeight: 800, fontSize: '1.1875rem', color: design.navy }}>{step.title}</Typography>
          <Typography sx={{ ...s.body, mt: 1, fontSize: '.9375rem' }}>{step.description}</Typography>
        </Box>)}
      </Box>
    </PublicContainer>
  </Box>;
}

function Faq() {
  return <Box component="section" id="landlord-faq" aria-labelledby="landlord-faq-title" sx={{ ...s.section, bgcolor: '#EEF2F6', scrollMarginTop: 80 }}>
    <PublicContainer>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Typography id="landlord-faq-title" component="h2" sx={{ ...s.heading, textAlign: 'center' }}>{landlordFaqs.title}</Typography>
        <Typography sx={{ ...s.body, mt: 2, textAlign: 'center' }}>{landlordFaqs.description}</Typography>
        <Stack sx={{ mt: { xs: 4, md: 5 }, gap: 2 }}>
          {landlordFaqs.items.map((faq, index) => <Accordion key={faq.question} disableGutters elevation={0} defaultExpanded={index === 0}
            sx={{ borderRadius: '12px !important', border: `1px solid ${design.border}`, '&::before': { display: 'none' } }}>
            <AccordionSummary id={`landlord-faq-${index}-heading`} aria-controls={`landlord-faq-${index}-answer`} expandIcon={<ChevronDown size={20} color={design.accent} />} sx={{ px: { xs: 2.5, md: 3.5 }, minHeight: 72 }}>
              <Typography component="h3" sx={{ fontWeight: 700, fontSize: { xs: '1rem', md: '1.125rem' }, color: design.navy, pr: 2 }}>{faq.question}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 2.5, md: 3.5 }, pb: 3, pt: 0 }}>
              <Typography sx={s.body}>{faq.answer}</Typography>
            </AccordionDetails>
          </Accordion>)}
        </Stack>
      </Box>
    </PublicContainer>
  </Box>;
}

function ContactItem({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return <Stack direction="row" sx={{ gap: 2 }}>
    <Box sx={{ ...s.iconBox, width: 40, height: 40 }}><Icon size={20} aria-hidden="true" /></Box>
    <Box>
      <Typography sx={{ fontSize: '.75rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: design.muted }}>{label}</Typography>
      <Box sx={{ mt: .25, color: design.navy, fontSize: '1rem', lineHeight: 1.6 }}>{children}</Box>
    </Box>
  </Stack>;
}

function Contact({ role }: { role: LandlordRole | '' }) {
  return <Box component="section" id="landlord-consultation" aria-labelledby="landlord-form-title" sx={{ ...s.section, bgcolor: '#E9EEF4', scrollMarginTop: 80 }}>
    <PublicContainer>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, .8fr) minmax(0, 1.2fr)' }, gap: { xs: 3, md: 5 }, alignItems: 'start' }}>
        <Stack sx={{ gap: 3, order: { xs: 2, md: 1 } }}>
          <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: '#FFF', borderRadius: '16px', border: `1px solid ${design.border}` }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1875rem', lineHeight: 1.5, color: design.navy, pb: 2.5, borderBottom: `1px solid ${design.border}` }}>{landlordContact.title}</Typography>
            <Stack sx={{ mt: 3, gap: 2.5 }}>
              <ContactItem icon={MapPin} label="Địa chỉ văn phòng">{publicSite.address}</ContactItem>
              <ContactItem icon={Phone} label="Số điện thoại"><Link href={`tel:${TINY_HOUSES_PUBLIC_CONTACT.phone}`} underline="hover" sx={{ fontWeight: 800, color: design.navy }}>{formattedPhone}</Link></ContactItem>
              <ContactItem icon={Mail} label="Hòm thư điện tử"><Link href={`mailto:${publicSite.email}`} underline="hover" sx={{ color: design.navy }}>{publicSite.email}</Link></ContactItem>
              <ContactItem icon={Clock3} label="Thời gian làm việc">{landlordContact.hours}</ContactItem>
            </Stack>
          </Box>
          <Box sx={{ bgcolor: '#FFF', borderRadius: '16px', border: `1px solid ${design.border}`, overflow: 'hidden' }}>
            <Stack direction="row" sx={{ px: 2.5, py: 1.75, alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${design.border}` }}>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                <MapPin size={18} color={design.accent} aria-hidden="true" />
                <Typography sx={{ fontWeight: 800, fontSize: '.875rem', letterSpacing: '.06em', textTransform: 'uppercase', color: design.navy }}>Bản đồ Google Maps</Typography>
              </Stack>
              <Link href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" underline="hover"
                sx={{ display: 'inline-flex', gap: .5, alignItems: 'center', fontSize: '.8125rem', color: design.accent }}>Mở trên Google Maps <ExternalLink size={14} aria-hidden="true" /></Link>
            </Stack>
            <Box component="iframe" title="Bản đồ văn phòng Homelax" src={`https://maps.google.com/maps?q=${mapQuery}&z=16&hl=vi&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              sx={{ display: 'block', width: '100%', height: 320, border: 0 }} />
          </Box>
        </Stack>
        <Box sx={{ order: { xs: 1, md: 2 }, p: { xs: 3, md: 5 }, bgcolor: '#FFF', borderRadius: '16px', border: `1px solid ${design.border}`, boxShadow: '0 20px 48px rgba(16,29,48,.08)' }}>
          <Typography id="landlord-form-title" component="h2" sx={{ ...s.heading, fontSize: { xs: '1.625rem', md: '2.25rem' } }}>{landlordContact.formTitle}</Typography>
          <Typography sx={{ ...s.body, mt: 1.5, pb: 3, mb: 3, borderBottom: `1px solid ${design.border}` }}>{landlordContact.formDescription}</Typography>
          <LandlordConsultationForm role={role} />
        </Box>
      </Box>
    </PublicContainer>
  </Box>;
}

export function LandlordCooperation({ role }: { role: LandlordRole | '' }) {
  return <>
    <Values />
    <Steps />
    <Faq />
    <Contact role={role} />
  </>;
}
