import { useRef, useState } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import {
  AlertCircle, ArrowRight, Building2, Calculator, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardCheck,
  FileText, Home, Landmark, Layers, MessageSquareWarning, MessageSquareText, MonitorCog, PhoneCall, Scale, ShieldAlert,
  ShieldCheck, Star, TrendingUp, Users, Workflow, Wrench, type LucideIcon,
} from 'lucide-react';
import { PublicContainer } from '../../components/public';
import { homeDesign as design } from '../home/homeDesign';
import { landlordCases, landlordHero, landlordModel, landlordPainPoints, landlordServiceGroups, type LandlordRole } from './landlordContent';

export const landlordIcons: Record<string, LucideIcon> = {
  home: Home, phone: PhoneCall, calculator: Calculator, shield: ShieldAlert, users: Users, alert: MessageSquareWarning,
  layers: Layers, file: FileText, workflow: Workflow, monitor: MonitorCog, clipboard: ClipboardCheck, wrench: Wrench,
  scale: Scale, landmark: Landmark, trending: TrendingUp, shieldCheck: ShieldCheck,
};

export const landlordStyles = {
  eyebrow: { color: design.accent, fontSize: '.8125rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' },
  heading: { fontSize: { xs: '1.75rem', md: '2.5rem' }, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.03em', color: design.navy },
  body: { fontSize: '1rem', lineHeight: 1.75, color: design.muted },
  section: { py: { xs: 7, md: 10 } },
  iconBox: { width: 44, height: 44, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '10px', bgcolor: '#FFF4E8', color: design.accent, border: '1px solid #FBD9B4' },
} as const;
const s = landlordStyles;
const consultationHref = '#landlord-consultation';

function Hero() {
  return <Box component="section" aria-labelledby="landlord-title" sx={{ background: 'linear-gradient(180deg, #F1F5F9 0%, #FFF 100%)' }}>
    <PublicContainer>
      <Box sx={{ py: { xs: 5, md: 9 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.15fr) minmax(0, .85fr)' }, gap: { xs: 4, md: 8 }, alignItems: 'center' }}>
        <Stack sx={{ gap: 2.5, alignItems: 'flex-start' }}>
          <Typography sx={{ ...s.eyebrow, px: 1.5, py: .75, borderRadius: 1, bgcolor: '#FFF1E0' }}>{landlordHero.eyebrow}</Typography>
          <Typography id="landlord-title" component="h1" sx={{ fontSize: { xs: '2.25rem', sm: '3rem', lg: '4rem' }, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-.03em', textTransform: 'uppercase', color: design.navy }}>
            {landlordHero.title}<Box component="span" sx={{ display: 'block', color: design.accent }}>{landlordHero.highlight}</Box>
          </Typography>
          <Typography sx={{ ...s.body, fontSize: { xs: '1rem', md: '1.125rem' } }}>{landlordHero.description}</Typography>
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0, gap: 1.25 }}>
            {landlordHero.benefits.map(item => <Stack component="li" key={item} direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ width: 26, height: 26, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: '#FFF1E0', color: design.accent }}><Check size={15} aria-hidden="true" /></Box>
              <Typography sx={{ fontSize: { xs: '1rem', md: '1.0625rem' }, color: design.navy }}>{item}</Typography>
            </Stack>)}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
            <Button component="a" href={consultationHref} variant="contained" size="large" sx={{ fontWeight: 800, minHeight: 52, px: 3 }}>Nhận tư vấn miễn phí</Button>
            <Button component="a" href="#landlord-model" variant="outlined" color="secondary" size="large" sx={{ fontWeight: 800, minHeight: 52, px: 3 }}>Khám phá mô hình 10+1</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">{landlordHero.note}</Typography>
        </Stack>
        <Box sx={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', minHeight: { xs: 300, md: 520 }, boxShadow: '0 24px 60px rgba(16,29,48,.16)' }}>
          <Box component="img" src="/images/landlord-hero-bedroom.png" alt="Không gian phòng cho thuê do Homelax vận hành" fetchPriority="high"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <Stack direction="row" sx={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 1.5, alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'rgba(255,255,255,.94)', borderRadius: '12px' }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Box sx={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', bgcolor: design.accent }} />
              <Typography sx={{ fontSize: '.875rem', fontWeight: 700, color: design.navy }}>{landlordHero.imageCaption}</Typography>
            </Stack>
            <Typography sx={{ fontSize: '.75rem', fontWeight: 800, letterSpacing: '.08em', color: design.muted }}>HOMELAX</Typography>
          </Stack>
        </Box>
      </Box>
      <Stack direction="row" sx={{ borderTop: `1px solid ${design.border}`, py: 3, gap: { xs: 1.5, sm: 3 }, justifyContent: 'center', flexWrap: 'wrap' }}>
        {landlordHero.pillars.map((pillar, index) => <Stack key={pillar} direction="row" sx={{ gap: { xs: 1.5, sm: 3 }, alignItems: 'center' }}>
          {index > 0 && <Box aria-hidden="true" sx={{ color: design.border }}>·</Box>}
          <Typography sx={{ fontSize: '.875rem', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: design.navy }}>{pillar}</Typography>
        </Stack>)}
      </Stack>
    </PublicContainer>
  </Box>;
}

function PainPoints({ onChooseRole }: { onChooseRole: (role: LandlordRole) => void }) {
  const { conclusion } = landlordPainPoints;
  return <Box component="section" aria-labelledby="landlord-pain" sx={{ ...s.section, bgcolor: '#EEF2F6' }}>
    <PublicContainer>
      <Typography sx={s.eyebrow}>{landlordPainPoints.eyebrow}</Typography>
      <Typography id="landlord-pain" component="h2" sx={{ ...s.heading, mt: 1 }}>{landlordPainPoints.title} <Box component="span" sx={{ color: design.accent }}>{landlordPainPoints.highlight}</Box></Typography>
      <Typography sx={{ ...s.body, mt: 2, maxWidth: 900 }}>{landlordPainPoints.description}</Typography>
      <Box sx={{ mt: { xs: 4, md: 6 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
        {landlordPainPoints.roles.map(role => <Box key={role.label} sx={{ bgcolor: '#FFF', borderRadius: '16px', border: `1px solid ${design.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: '#F8FAFC', borderBottom: `1px solid ${design.border}` }}>
            <Typography sx={s.eyebrow}>{role.label}</Typography>
            <Typography component="h3" sx={{ mt: 1.5, fontSize: { xs: '1.375rem', md: '1.75rem' }, fontWeight: 800, lineHeight: 1.3, color: design.navy }}>{role.title}</Typography>
            <Typography sx={{ ...s.body, mt: 1.5 }}>{role.description}</Typography>
          </Box>
          <Stack sx={{ p: { xs: 3, md: 4 }, flex: 1 }}>
            {role.items.map((item, index) => {
              const Icon = landlordIcons[item.icon] ?? AlertCircle;
              return <Stack key={item.title} direction="row" sx={{ gap: 2, py: 2.5, borderTop: index ? `1px solid ${design.border}` : 0 }}>
                <Box sx={s.iconBox}><Icon size={22} aria-hidden="true" /></Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, color: design.navy, fontSize: '1.0625rem' }}>{item.title}</Typography>
                  <Typography sx={{ ...s.body, mt: .5 }}>{item.description}</Typography>
                </Box>
              </Stack>;
            })}
            <Box sx={{ mt: 'auto', pt: 3 }}>
              <Button component="a" href={consultationHref} variant="contained" color="secondary" endIcon={<ArrowRight size={18} />}
                onClick={() => onChooseRole(role.role)} sx={{ fontWeight: 800 }}>{role.cta}</Button>
            </Box>
          </Stack>
        </Box>)}
      </Box>
      <Box sx={{ mt: 4, p: { xs: 2.5, md: 3.5 }, bgcolor: '#FFF', borderRadius: '12px', borderLeft: `5px solid ${design.accent}`, boxShadow: design.shadow }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', md: '1.25rem' }, lineHeight: 1.6, color: design.navy }}>
          {conclusion.before}<Box component="span" sx={{ color: design.accent }}>{conclusion.first}</Box>{conclusion.middle}
          <Box component="span" sx={{ color: design.accent }}>{conclusion.second}</Box>{conclusion.after}
        </Typography>
      </Box>
    </PublicContainer>
  </Box>;
}

function OperatingModel() {
  return <Box component="section" id="landlord-model" aria-labelledby="landlord-model-title" sx={{ ...s.section, bgcolor: '#0A0F1A', color: '#FFF', scrollMarginTop: 80 }}>
    <PublicContainer>
      <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', maxWidth: 1000, mx: 'auto' }}>
          <Typography id="landlord-model-title" component="h2" sx={{ fontSize: { xs: '2rem', md: '3.25rem' }, fontWeight: 800, letterSpacing: '-.02em', textTransform: 'uppercase', color: design.accent }}>{landlordModel.title}</Typography>
          <Typography sx={{ mt: 1, fontSize: { xs: '1.25rem', md: '2rem' }, fontWeight: 800, textTransform: 'uppercase' }}>{landlordModel.subtitle} <Box component="span" sx={{ color: design.accent }}>{landlordModel.highlight}</Box></Typography>
          <Typography sx={{ mt: 2.5, fontSize: { xs: '1rem', md: '1.125rem' }, lineHeight: 1.75, color: '#CBD5E1' }}>{landlordModel.description}</Typography>
        </Box>
        <Stack direction="row" sx={{ mt: 5, pt: 5, borderTop: '1px solid rgba(255,255,255,.12)', justifyContent: 'center', alignItems: 'center', gap: { xs: 3, md: 10 } }}>
          {landlordModel.stats.map((stat, index) => <Stack key={stat.label} direction="row" sx={{ alignItems: 'center', gap: { xs: 3, md: 10 } }}>
            {index > 0 && <Typography aria-hidden="true" sx={{ fontSize: '2rem', color: '#64748B' }}>+</Typography>}
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: { xs: '3.5rem', md: '5rem' }, fontWeight: 800, lineHeight: 1, color: design.accent }}>{stat.value}</Typography>
              <Typography sx={{ mt: 1, fontSize: { xs: '.875rem', md: '1rem' }, color: '#E2E8F0' }}>{stat.label}</Typography>
            </Box>
          </Stack>)}
        </Stack>
        <Box sx={{ mt: 6, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
          {landlordModel.features.map(feature => {
            const Icon = landlordIcons[feature.icon] ?? Users;
            return <Stack key={feature.title} direction="row" sx={{ gap: 2.5, p: { xs: 2.5, md: 3.5 }, borderRadius: '12px', bgcolor: '#101A2C', border: '1px solid rgba(255,255,255,.1)' }}>
              <Box sx={{ ...s.iconBox, bgcolor: 'rgba(237,90,35,.12)', borderColor: 'rgba(237,90,35,.3)' }}><Icon size={22} aria-hidden="true" /></Box>
              <Box>
                <Typography component="h3" sx={{ fontWeight: 800, fontSize: '1.125rem' }}>{feature.title}</Typography>
                <Typography sx={{ mt: .75, lineHeight: 1.7, color: '#CBD5E1' }}>{feature.description}</Typography>
              </Box>
            </Stack>;
          })}
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ mt: 6, p: { xs: 3, md: 4.5 }, gap: 3, alignItems: { md: 'center' }, justifyContent: 'space-between', borderRadius: '16px', bgcolor: '#13243D', border: '1px solid rgba(255,255,255,.1)' }}>
          <Box sx={{ maxWidth: 640 }}>
            <Typography component="h3" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 800, lineHeight: 1.4 }}>{landlordModel.cta.title}</Typography>
            <Typography sx={{ mt: 1.5, lineHeight: 1.7, color: '#CBD5E1' }}>{landlordModel.cta.description}</Typography>
          </Box>
          <Button component="a" href={consultationHref} variant="contained" size="large" sx={{ flexShrink: 0, borderRadius: 99, px: 4, minHeight: 56, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>{landlordModel.cta.label}</Button>
        </Stack>
      </Box>
    </PublicContainer>
  </Box>;
}

function ServiceGroups() {
  return <Box component="section" id="landlord-services" aria-labelledby="landlord-services-title" sx={{ ...s.section, bgcolor: '#F5F6F8', scrollMarginTop: 80 }}>
    <PublicContainer>
      <Typography sx={{ ...s.eyebrow, display: 'inline-block', px: 1.5, py: .75, borderRadius: 1, bgcolor: '#FFF1E0' }}>{landlordServiceGroups.eyebrow}</Typography>
      <Typography id="landlord-services-title" component="h2" sx={{ ...s.heading, mt: 2 }}>{landlordServiceGroups.title}</Typography>
      <Typography sx={{ ...s.body, mt: 2, maxWidth: 940 }}>{landlordServiceGroups.description}</Typography>
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: { xs: 4, md: 5 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
        {landlordServiceGroups.items.map((item, index) => {
          const Icon = landlordIcons[item.icon] ?? Building2;
          return <Stack component="li" key={item.title} direction="row" sx={{ gap: 2, alignItems: 'center', p: { xs: 2.5, md: 3.5 }, bgcolor: '#FFF', borderRadius: '12px', border: `1px solid ${design.border}` }}>
            <Typography aria-hidden="true" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 800, color: design.accent, minWidth: 52 }}>{String(index + 1).padStart(2, '0')}</Typography>
            <Typography component="h3" sx={{ flex: 1, fontWeight: 800, fontSize: { xs: '1.0625rem', md: '1.25rem' }, color: design.navy }}>{item.title}</Typography>
            <Box sx={s.iconBox}><Icon size={22} aria-hidden="true" /></Box>
          </Stack>;
        })}
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ mt: 5, p: { xs: 2.5, md: 3 }, gap: 2.5, alignItems: { md: 'center' }, border: `2px solid ${design.accent}`, borderRadius: { xs: '20px', md: 99 }, bgcolor: '#FFF' }}>
        <Box sx={{ ...s.iconBox, width: 56, height: 56, borderRadius: '50%' }}><Building2 size={26} aria-hidden="true" /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: design.navy, fontSize: { xs: '1rem', md: '1.125rem' } }}>{landlordServiceGroups.banner.title}</Typography>
          <Typography sx={{ fontWeight: 800, color: design.accent, fontSize: { xs: '1rem', md: '1.125rem' } }}>{landlordServiceGroups.banner.highlight}</Typography>
        </Box>
        <Button component="a" href={consultationHref} variant="contained" endIcon={<ArrowRight size={18} />} sx={{ flexShrink: 0, fontWeight: 800, minHeight: 48, px: 3 }}>{landlordServiceGroups.banner.label}</Button>
      </Stack>
    </PublicContainer>
  </Box>;
}

function Cases() {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = landlordCases.items.length;
  const scrollTo = (next: number) => {
    const target = Math.max(0, Math.min(total - 1, next));
    const card = track.current?.children[target] as HTMLElement | undefined;
    track.current?.scrollTo({ left: card ? card.offsetLeft - track.current.offsetLeft : 0, behavior: 'smooth' });
    setIndex(target);
  };
  return <Box component="section" aria-labelledby="landlord-cases" sx={{ pb: { xs: 7, md: 10 }, bgcolor: '#F5F6F8' }}>
    <PublicContainer>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'flex-end' }, justifyContent: 'space-between' }}>
        <Box sx={{ maxWidth: 880 }}>
          <Typography sx={s.eyebrow}>{landlordCases.eyebrow}</Typography>
          <Typography id="landlord-cases" component="h2" sx={{ ...s.heading, mt: 1, textTransform: 'uppercase', fontSize: { xs: '1.5rem', md: '2.25rem' } }}>{landlordCases.title}</Typography>
          <Typography sx={{ ...s.body, mt: 2 }}>{landlordCases.description}</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexShrink: 0, display: total > 3 ? 'flex' : { xs: 'flex', lg: 'none' } }}>
          <Typography variant="body2" sx={{ color: design.muted, mr: 1 }}>{index + 1} / {total}</Typography>
          <IconButton aria-label="Case trước" disabled={index === 0} onClick={() => scrollTo(index - 1)} sx={{ border: `1px solid ${design.border}` }}><ChevronLeft size={20} /></IconButton>
          <IconButton aria-label="Case tiếp theo" disabled={index >= total - 1} onClick={() => scrollTo(index + 1)}
            sx={{ bgcolor: design.navy, color: '#FFF', '&:hover': { bgcolor: design.navy }, '&.Mui-disabled': { bgcolor: design.border } }}><ChevronRight size={20} /></IconButton>
        </Stack>
      </Stack>
      <Box ref={track} onScroll={event => {
        const element = event.currentTarget;
        const width = (element.children[0] as HTMLElement | undefined)?.offsetWidth || 1;
        setIndex(Math.round(element.scrollLeft / (width + 24)));
      }} sx={{ mt: 4, display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: '85%', sm: '48%', lg: 'calc((100% - 48px) / 3)' }, gap: 3, overflowX: 'auto', scrollSnapType: 'x mandatory', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {landlordCases.items.map(item => <Stack key={item.code} component="article" sx={{ scrollSnapAlign: 'start', p: 3, bgcolor: '#FFF', borderRadius: '16px', border: `1px solid ${design.border}`, gap: 2.5 }}>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ px: 1.25, py: .25, borderRadius: 1, bgcolor: '#FFF4E8', color: design.accent, fontWeight: 800, fontSize: '.8125rem', border: '1px solid #FBD9B4' }}>CASE {item.id}</Typography>
            <Typography sx={{ px: 1.25, py: .25, borderRadius: 1, bgcolor: '#F1F5F9', color: design.navy, fontWeight: 700, fontSize: '.8125rem' }}>{item.code}</Typography>
            <Stack direction="row" sx={{ ml: 'auto', gap: .5, alignItems: 'center', px: 1.25, py: .25, borderRadius: 99, bgcolor: '#ECFDF3', color: '#15803D', fontSize: '.8125rem', fontWeight: 700 }}>
              <CircleCheck size={14} aria-hidden="true" />Đã hoàn thành
            </Stack>
          </Stack>
          <Typography component="h3" sx={{ fontWeight: 800, fontSize: '1.1875rem', lineHeight: 1.4, color: design.navy, minHeight: { sm: 54 } }}>{item.title}</Typography>
          <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 1, height: 220, borderRadius: '12px', border: `1px dashed ${design.border}`, bgcolor: '#F8FAFC', textAlign: 'center', px: 2 }}>
            <AlertCircle size={28} color={design.accent} aria-hidden="true" />
            <Typography sx={{ fontWeight: 700, color: design.navy }}>Bằng chứng đang cập nhật</Typography>
          </Stack>
          <Box sx={{ mt: 'auto', pt: 2, borderTop: `1px solid ${design.border}` }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', color: design.muted }}><CalendarDays size={16} aria-hidden="true" /><Typography variant="body2">Ngày hoàn thành:</Typography></Stack>
              <Typography variant="body2" sx={{ fontWeight: 700, color: design.navy }}>{item.completedOn}</Typography>
            </Stack>
            <Stack direction="row" sx={{ mt: 1, justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" aria-label={`${item.rating} trên 5 sao`} sx={{ gap: .25, color: '#F59E0B' }}>
                {Array.from({ length: 5 }, (_, star) => <Star key={star} size={18} fill={star < item.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 700, color: design.navy }}>{item.rating}/5 sao</Typography>
            </Stack>
            {item.comment && <Stack direction="row" sx={{ mt: 1.5, gap: 1, alignItems: 'center', p: 1.25, borderRadius: '8px', bgcolor: '#FFF7ED', border: '1px solid #FBD9B4' }}>
              <MessageSquareText size={16} color={design.accent} aria-hidden="true" />
              <Typography variant="body2" sx={{ fontStyle: 'italic', color: design.navy }}>Nhận xét: “{item.comment}”</Typography>
            </Stack>}
          </Box>
        </Stack>)}
      </Box>
      <Typography variant="body2" sx={{ mt: 4, textAlign: 'center', fontStyle: 'italic', color: design.muted }}>{landlordCases.note}</Typography>
    </PublicContainer>
  </Box>;
}

export function LandlordLanding({ onChooseRole }: { onChooseRole: (role: LandlordRole) => void }) {
  return <>
    <Hero />
    <PainPoints onChooseRole={onChooseRole} />
    <OperatingModel />
    <ServiceGroups />
    <Cases />
  </>;
}
