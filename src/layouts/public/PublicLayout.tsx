import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Box, Link } from '@mui/material';
import { designTokens as tokens } from '../../app/theme/tokens';
import type { AppIdentity } from '../../features/auth/identityStore';
import Header from '../../components/public/Header';
import Footer from '../../components/public/Footer';
import { PublicQuickContact } from '../../components/public/PublicQuickContact';

type PublicLayoutProps = {
  sessionReady: boolean;
  sessionError: boolean;
  onRetrySession: () => void;
  currentUser: AppIdentity;
  onLogout: () => Promise<void>;
};

export function PublicLayout({
  sessionReady,
  sessionError,
  onRetrySession,
  currentUser,
  onLogout,
}: PublicLayoutProps) {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    let anchor = hash.slice(1);
    try { anchor = decodeURIComponent(anchor); } catch { /* Invalid hashes have no anchor. */ }
    const element = anchor ? document.getElementById(anchor) : null;
    if (element) element.scrollIntoView();
    else window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Link href="#public-main" onClick={event => {
        event.preventDefault();
        document.getElementById('public-main')?.focus();
      }} sx={{ position: 'fixed', top: 8, left: 8, zIndex: tokens.zIndex.header + 1,
        transform: 'translateY(-160%)', minHeight: 44, px: 2, display: 'flex', alignItems: 'center',
        bgcolor: 'background.paper', color: 'text.primary', borderRadius: 1,
        '&:focus-visible': { transform: 'none', outline: `3px solid ${tokens.colors.brand[500]}` },
      }}>Chuyển đến nội dung chính</Link>
      <Header
        sessionReady={sessionReady}
        sessionError={sessionError}
        onRetrySession={onRetrySession}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <Box component="main" id="public-main" tabIndex={-1} sx={{ flex: 1, minWidth: 0, scrollMarginTop: 88 }}>
        <Outlet />
      </Box>
      <Footer flush={pathname === '/'} />
      <PublicQuickContact />
    </Box>
  );
}
