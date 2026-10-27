import { homeDesign as design } from '../homeDesign';
import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { BedDouble, House, UsersRound } from 'lucide-react';

const metricIcons = [House, BedDouble, UsersRound];

export function AnimatedMetric({ value, label, index }: { value: string; label: string; index: number }) {
  const target = Number.parseInt(value, 10);
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(target);
  const [entered, setEntered] = useState(false);
  const Icon = metricIcons[index] || House;

  useEffect(() => {
    const element = ref.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || motion.matches || !('IntersectionObserver' in window)) return;
    let frame = 0;
    let start: number | undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setEntered(true);
      setCount(0);
      const tick = (now: number) => {
        start ??= now;
        const progress = Math.min(1, Math.max(0, (now - start - index * 120) / 1200));
        setCount(Math.round(target * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    observer.observe(element);
    const stopMotion = () => {
      if (motion.matches) {
        observer.disconnect();
        cancelAnimationFrame(frame);
        setCount(target);
        setEntered(false);
      }
    };
    motion.addEventListener('change', stopMotion);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', stopMotion);
    };
  }, [index, target]);

  return <Box ref={ref} sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 1, px: 1,
    borderLeft: index ? '1px solid rgba(255,255,255,.18)' : 'none',
    '@keyframes metricEnter': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    animation: entered ? `metricEnter 600ms ease-out ${index * 120}ms both` : 'none',
  }}>
    <Typography component="dt" sx={{ fontSize: { xs: '.8125rem', sm: '.875rem' }, color: '#E2E8F0', mt: 1, order: 2 }}>{label}</Typography>
    <Typography component="dd" aria-label={value} sx={{ m: 0, fontSize: { xs: '1.75rem', sm: '2.75rem', md: '3rem' }, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-.045em', fontVariantNumeric: 'tabular-nums', color: '#FFF' }}>
      <Box sx={{ display: 'flex', mb: 1.5, color: design.accent, justifyContent: 'center' }}><Icon size={28} strokeWidth={1.7} aria-hidden="true" /></Box>
      <Box component="span" aria-hidden="true">{count}<Box component="span" sx={{ color: design.accent, ml: .25 }}>+</Box></Box>
    </Typography>
  </Box>;
}
