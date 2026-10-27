import { useEffect, useState, type ReactNode } from 'react';
import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import type { LucideIcon } from 'lucide-react';
import { designTokens } from '../../app/theme/tokens';
import { CmsHeader } from './CmsHeader';
import { CmsSidebar } from './CmsSidebar';

export type CmsShellUser = {
  name?: unknown;
  email?: unknown;
  roleName?: unknown;
  roleCode?: unknown;
  avatar?: unknown;
};

export type CmsNavigationItem = {
  code: string;
  parentCode?: string;
  label: string;
  path: string;
  group: string;
  icon: LucideIcon;
};

export type CmsShellProps = {
  user: CmsShellUser;
  navigation: CmsNavigationItem[];
  activeSection: string;
  onProfile: () => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
};

const { colors, layout, zIndex } = designTokens;

export function CmsShell({ user, navigation, activeSection, onProfile, onLogout, children }: CmsShellProps) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const sidebarWidth = collapsed ? 80 : layout.sidebarWidth;
  const activeItem = navigation.find((item) => item.code === activeSection);

  useEffect(() => {
    const desktopQuery = window.matchMedia(`(min-width: ${theme.breakpoints.values.lg}px)`);
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    desktopQuery.addEventListener('change', handleBreakpointChange);
    return () => desktopQuery.removeEventListener('change', handleBreakpointChange);
  }, [theme.breakpoints.values.lg]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100dvh', minWidth: 0, bgcolor: colors.neutral[50], color: 'text.primary',
      '& a:focus-visible, & button:focus-visible': { outline: `3px solid ${colors.brand[500]}`, outlineOffset: 3 },
      '@media (prefers-reduced-motion: reduce)': { '& *, & *::before, & *::after': { transition: 'none', animation: 'none', scrollBehavior: 'auto' } },
    }}>
      <Box component="a" href="#cms-content" sx={{
        position: 'fixed', top: 8, left: 8, zIndex: zIndex.modal + 1,
        display: 'inline-flex', alignItems: 'center', minHeight: 44, px: 2,
        bgcolor: colors.navy[950], color: colors.neutral[0], borderRadius: 1,
        transform: 'translateY(-160%)', '&:focus': { transform: 'translateY(0)' },
      }}>
        Đi tới nội dung chính
      </Box>

      <Box component="aside" sx={{
        display: { xs: 'none', lg: 'block' }, position: 'fixed', inset: '0 auto 0 0',
        width: sidebarWidth, zIndex: zIndex.header, transition: 'width 180ms ease',
      }}>
        <CmsSidebar navigation={navigation} activeSection={activeSection}
          collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)}
          navigationId="cms-desktop-navigation" />
      </Box>

      <Drawer variant="temporary" open={mobileOpen && !desktop} onClose={() => setMobileOpen(false)}
        transitionDuration={reducedMotion ? 0 : undefined}
        slotProps={{
          root: { keepMounted: true },
          paper: { sx: { width: layout.sidebarWidth, maxWidth: 'calc(100vw - 32px)', border: 0, bgcolor: colors.navy[950] } },
        }}>
        <CmsSidebar navigation={navigation} activeSection={activeSection}
          collapsed={false} mobile onNavigate={() => setMobileOpen(false)}
          onClose={() => setMobileOpen(false)} navigationId="cms-mobile-navigation" />
      </Drawer>

      <CmsHeader user={user} title={activeSection === 'account' ? 'Tài khoản của tôi' : activeItem?.label || 'Quản trị'} group={activeSection === 'account' ? 'Cá nhân' : activeItem?.group || 'Hệ thống'}
        sidebarWidth={sidebarWidth} mobileOpen={mobileOpen} onOpenMenu={() => setMobileOpen(true)}
        onProfile={onProfile} onLogout={handleLogout} loggingOut={loggingOut} />

      <Box sx={{ ml: { xs: 0, lg: `${sidebarWidth}px` }, pt: `${layout.headerHeight}px`, minWidth: 0, transition: 'margin-left 180ms ease' }}>
        <Box component="main" id="cms-content" tabIndex={-1} sx={{
          width: '100%', maxWidth: 'none', minWidth: 0,
          minHeight: `calc(100dvh - ${layout.headerHeight}px)`, boxSizing: 'border-box',
          px: { xs: 2, sm: 3, xl: 4 }, py: { xs: 2.5, sm: 3.5 }, scrollMarginTop: `${layout.headerHeight + 16}px`,
          '&:focus-visible': { outline: `3px solid ${colors.brand[500]}`, outlineOffset: -3 },
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
